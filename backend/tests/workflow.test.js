import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import workflowRoutes from "../routes/workflowRoutes.js";
import { hashPassword, checkPassword, signToken, authenticate } from "../utils/auth.js";
import { calculateBill } from "../utils/validation.js";
import { createModels } from "../models/workflowModels.js";

test("billing precision, password hashing, JWT authentication, and Mongo model mapping", async () => {
  assert.equal(calculateBill(18500, 0, 22000, 0).totalCents, 407000);
  assert.throws(() => calculateBill(1000, 1001, 22000, 0));
  const passwordHash = await hashPassword("Integration123!");
  assert.equal(await checkPassword("Integration123!", passwordHash), true);
  assert.equal(await checkPassword("incorrect", passwordHash), false);

  const user = { id: "test-user", role: "owner", active: true, passwordHash };
  const secret = "test-secret-longer-than-32-characters";
  const token = signToken(user, secret);
  let authenticated = false;
  await authenticate({ one: async () => user }, secret)(
    { headers: { authorization: `Bearer ${token}` } },
    { status() { return this; }, json() { throw new Error("Unexpected auth failure"); } },
    () => { authenticated = true; },
  );
  assert.equal(authenticated, true);

  const models = createModels();
  assert.deepEqual(Object.keys(models), ["users", "companies", "lorries", "requests", "requestSequences", "notifications", "settlements"]);
  assert.equal(models.requests.collection.name, "requests");
});

class MemoryStore {
  mode = "test";
  tables = { users: [], companies: [], lorries: [], requests: [], notifications: [], settlements: [] };
  sequence = 0;
  async nextRequestNumber(year) {
    this.sequence += 1;
    return `TC-${year}-${String(this.sequence).padStart(4, "0")}`;
  }
  matches(doc, filter) {
    return Object.entries(filter).every(([key, value]) => doc[key] === value);
  }
  async list(name, filter = {}) {
    return structuredClone(this.tables[name].filter((row) => this.matches(row, filter)));
  }
  async one(name, filter = {}) {
    const found = this.tables[name].find((row) => this.matches(row, filter));
    return found ? structuredClone(found) : null;
  }
  async create(name, data) {
    const row = structuredClone(data);
    this.tables[name].push(row);
    return structuredClone(row);
  }
  async update(name, id, patch, guard = {}) {
    const row = this.tables[name].find((item) => item.id === id && this.matches(item, guard));
    if (!row) return null;
    Object.assign(row, structuredClone(patch));
    return structuredClone(row);
  }
  async remove(name, id) {
    this.tables[name] = this.tables[name].filter((row) => row.id !== id);
  }
}

test("company-to-lorry collection and billing workflow", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/api", workflowRoutes(new MemoryStore(), "test-secret-longer-than-32-characters"));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({ error: error.message });
  });
  let server;
  try {
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("This sandbox does not allow binding a local HTTP test server.");
      return;
    }
    throw error;
  }
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (route, method = "GET", body, token) => {
    const response = await fetch(base + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const unique = Date.now();
  const password = "Integration123!";
  const register = async (role, label) => {
    const result = await call("/auth/register", "POST", {
      role,
      name: label,
      email: `${label}-${unique}@example.test`,
      password,
      phone: "0770000000",
      address: "Akuressa",
      companyName: label,
      areas: "Akuressa, Deniyaya",
      rate: "220.00",
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return result.body;
  };

  assert.equal((await call("/state")).status, 401);
  const company = await register("company", "company");
  const owner = await register("owner", "seller");
  const companyToken = company.token;
  const ownerToken = owner.token;
  assert.equal(company.user.role, "company");
  assert.equal(owner.user.role, "owner");

  const companyUpdate = await call("/company", "PATCH", {
    name: "Green Leaf Collectors",
    phone: "0770000001",
    address: "Akuressa",
    areas: "Akuressa, Deniyaya",
    rate: "220.00",
  }, companyToken);
  assert.equal(companyUpdate.status, 200);

  const collectorResult = await call("/collectors", "POST", {
    name: "Nimal Collector",
    email: `collector-${unique}@example.test`,
    phone: "0770000002",
    password,
  }, companyToken);
  assert.equal(collectorResult.status, 201);
  const collectorLogin = await call("/auth/login", "POST", {
    email: collectorResult.body.email,
    password,
  });
  assert.equal(collectorLogin.status, 200);

  const lorryResult = await call("/lorries", "POST", {
    label: "Main lorry",
    vehicleNumber: "WP-ABC-1234",
    driverId: collectorResult.body.id,
    capacity: "500",
    areas: "Akuressa, Deniyaya",
    active: true,
  }, companyToken);
  assert.equal(lorryResult.status, 201, JSON.stringify(lorryResult.body));

  await t.test("Lorry Management: create, read, update, delete and access controls", async () => {
    const input = {
      label: "CRUD demonstration",
      vehicleNumber: " wp-test-1234 ",
      driverId: collectorResult.body.id,
      capacity: "100.125",
      areas: "Akuressa, Deniyaya",
      active: true,
    };
    const created = await call("/lorries", "POST", input, companyToken);
    assert.equal(created.status, 201);
    assert.equal(created.body.vehicleNumber, "WP-TEST-1234");
    assert.equal(created.body.capacityGrams, 100125);
    const path = `/lorries/${created.body.id}`;
    const list = await call("/lorries", "GET", undefined, companyToken);
    assert.equal(list.status, 200);
    assert.ok(list.body.some((lorry) => lorry.id === created.body.id));
    assert.equal((await call("/lorries?q=crud", "GET", undefined, companyToken)).body.length, 1);
    assert.equal((await call("/lorries?status=paused", "GET", undefined, companyToken)).body.length, 0);
    assert.equal((await call("/lorries?area=deniyaya&sort=capacity", "GET", undefined, companyToken)).body.length, 2);
    assert.equal((await call("/lorries?status=unknown", "GET", undefined, companyToken)).status, 400);
    const missing = await call("/lorries", "POST", { label: "Missing vehicle" }, companyToken);
    assert.equal(missing.status, 400);
    assert.match(missing.body.error, /collector|vehicle|capacity|areas/i);
    const read = await call(path, "GET", undefined, companyToken);
    assert.equal(read.status, 200);
    assert.equal(read.body.driverName, "Nimal Collector");
    const duplicate = await call("/lorries", "POST", input, companyToken);
    assert.equal(duplicate.status, 409);
    assert.match(duplicate.body.error, /vehicle number.*already registered/i);
    for (const patch of [{ capacity: "0" }, { driverId: "missing" }, { areas: " , " }, { active: "false" }, { label: " " }]) {
      assert.equal((await call(path, "PATCH", { ...input, ...patch }, companyToken)).status, 400);
    }
    assert.equal((await call(path, "GET", undefined, companyToken)).body.capacityGrams, 100125);
    const updatedInput = { ...input, label: "Updated lorry", vehicleNumber: "WP-EDIT-1234", capacity: "250.5", areas: "Deniyaya", active: false };
    const updated = await call(path, "PATCH", updatedInput, companyToken);
    assert.equal(updated.status, 200);
    const reread = (await call(path, "GET", undefined, companyToken)).body;
    assert.equal(reread.label, "Updated lorry");
    assert.equal(reread.vehicleNumber, "WP-EDIT-1234");
    assert.equal(reread.capacityGrams, 250500);
    assert.deepEqual(reread.areas, ["Deniyaya"]);
    assert.equal(reread.active, false);
    const state = (await call("/state", "GET", undefined, companyToken)).body;
    assert.equal(state.lorries.find((lorry) => lorry.id === created.body.id).label, "Updated lorry");
    assert.ok(!(await call("/state", "GET", undefined, ownerToken)).body.lorries.some((lorry) => lorry.id === created.body.id));
    const other = await register("company", "crud-other-company");
    assert.deepEqual((await call("/lorries", "GET", undefined, other.token)).body, []);
    for (const method of ["GET", "PATCH", "DELETE"]) {
      const body = method === "PATCH" ? updatedInput : undefined;
      assert.equal((await call(path, method, body, other.token)).status, 404);
      assert.equal((await call(path, method, body, ownerToken)).status, 403);
      assert.equal((await call(path, method, body, collectorLogin.body.token)).status, 403);
      assert.equal((await call(path, method, body)).status, 401);
    }
    assert.equal((await call("/lorries", "POST", input, ownerToken)).status, 403);
    assert.equal((await call(path, "DELETE", undefined, companyToken)).status, 200);
    assert.equal((await call(path, "GET", undefined, companyToken)).status, 404);
    assert.equal((await call(path, "PATCH", updatedInput, companyToken)).status, 404);
    assert.equal((await call(path, "DELETE", undefined, companyToken)).status, 404);
    assert.ok(!(await call("/state", "GET", undefined, companyToken)).body.lorries.some((lorry) => lorry.id === created.body.id));
  });

  const ownerState = await call("/state", "GET", undefined, ownerToken);
  assert.equal(ownerState.status, 200);
  assert.equal(ownerState.body.lorries.length, 1);
  const requestResult = await call("/requests", "POST", {
    lorryId: lorryResult.body.id,
    date: ownerState.body.today,
    timeWindow: "Morning",
    area: "Akuressa",
    location: "Tea estate main gate",
    estimatedWeight: "20",
    notes: "Please call on arrival.",
  }, ownerToken);
  assert.equal(requestResult.status, 201, JSON.stringify(requestResult.body));
  assert.match(requestResult.body.requestNumber, /^TC-\d{4}-\d{4}$/);
  assert.equal(requestResult.body.status, "assigned");
  assert.equal((await call(`/lorries/${lorryResult.body.id}`, "DELETE", undefined, companyToken)).status, 409);
  assert.equal((await call(`/lorries/${lorryResult.body.id}`, "GET", undefined, companyToken)).status, 200);
  
  const collectorState = await call("/state", "GET", undefined, collectorLogin.body.token);
  assert.equal(collectorState.status, 200);
  assert.equal(collectorState.body.requests.length, 1);
  assert.equal((await call(`/requests/${requestResult.body.id}/on-the-way`, "POST", {}, collectorLogin.body.token)).status, 200);
  const billResult = await call(`/requests/${requestResult.body.id}/collect`, "POST", {
    grossWeight: "18.5",
    rejectedWeight: "0",
    otherDeduction: "0",
    note: "Collection completed.",
  }, collectorLogin.body.token);
  assert.equal(billResult.status, 200, JSON.stringify(billResult.body));
  assert.equal(billResult.body.bill.totalCents, 407000);
  assert.equal(billResult.body.status, "completed");

  const paidResult = await call(`/requests/${requestResult.body.id}/pay`, "POST", {
    reference: "RCPT-001",
  }, companyToken);
  assert.equal(paidResult.status, 200);
  assert.equal(paidResult.body.bill.paymentStatus, "paid");

  const stranger = await register("company", "other-company");
  const forbidden = await call(`/lorries/${lorryResult.body.id}`, "PATCH", {
    label: "Hijack",
    vehicleNumber: "WP-ABC-1234",
    driverId: collectorResult.body.id,
    capacity: "500",
    areas: "Akuressa",
    active: true,
  }, stranger.token);
  assert.equal(forbidden.status, 404);
});
