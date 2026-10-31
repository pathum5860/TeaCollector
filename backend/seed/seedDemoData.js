import "dotenv/config";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { hashPassword } from "../utils/auth.js";
import User from "../models/User.js";
import Company from "../models/Company.js";
import Lorry from "../models/Lorry.js";
import CollectionRequest from "../models/CollectionRequest.js";
import RequestSequence from "../models/RequestSequence.js";
import Notification from "../models/Notification.js";
import MonthlySettlement from "../models/MonthlySettlement.js";

const DEMO_COMPANY_NAME = "Wijaya Tea";
const DEMO_COMPANY_EMAIL = "wijayatea@example.com";
const DEMO_RATE_CENTS = 23500;
const YEAR = 2026;
const now = () => new Date().toISOString();

function report(kind, label, detail = "") {
  console.log(`${kind.padEnd(8)} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function findOrCreate(model, filter, data, label) {
  const existing = await model.findOne(filter).lean();
  if (existing) {
    report("REUSED", label, existing.id || existing.number || existing.email);
    return existing;
  }
  const created = await model.create(data);
  const result = created.toObject();
  report("CREATED", label, result.id || result.number || result.email);
  return result;
}

async function ensureUser({ email, name, phone, address = "", role, companyId, password }) {
  const existing = await User.findOne({ email: email.toLowerCase() }).lean();
  if (existing) {
    if (existing.role !== role || (role === "collector" && existing.companyId !== companyId)) {
      throw new Error(`Existing user ${email} has a conflicting role or company; no records were changed.`);
    }
    report("REUSED", `${role} ${name}`, email);
    return existing;
  }
  const created = await User.create({
    id: randomUUID(),
    name,
    email: email.toLowerCase(),
    phone,
    address,
    role,
    companyId,
    active: true,
    passwordHash: await hashPassword(password),
    createdAt: now(),
  });
  const result = created.toObject();
  report("CREATED", `${role} ${name}`, email);
  return result;
}

async function nextRequestNumber() {
  for (;;) {
    const sequence = await RequestSequence.findOneAndUpdate(
      { year: YEAR },
      { $inc: { value: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    const requestNumber = `TC-${YEAR}-${String(sequence.value).padStart(4, "0")}`;
    if (!(await CollectionRequest.exists({ requestNumber }))) return requestNumber;
  }
}

async function ensureLorry({ vehicleNumber, label, driverId, capacityGrams, areas, companyId, active }) {
  const existing = await Lorry.findOne({ vehicleNumber }).lean();
  if (existing) {
    if (existing.companyId !== companyId) {
      throw new Error(`Lorry ${vehicleNumber} already belongs to another company; no records were changed.`);
    }
    report("REUSED", `lorry ${vehicleNumber}`, existing.id);
    return existing;
  }
  const created = await Lorry.create({
    id: randomUUID(), companyId, vehicleNumber, label, driverId,
    capacityGrams, areas, active, createdAt: now(),
  });
  const result = created.toObject();
  report("CREATED", `lorry ${vehicleNumber}`, result.id);
  return result;
}

async function ensureRequest({ request, company, owner, lorry, collector, settlementNumber }) {
  const existing = await CollectionRequest.findOne({
    companyId: company.id,
    ownerId: owner.id,
    lorryId: lorry.id,
    date: request.date,
    area: request.area,
    estimatedGrams: request.estimatedGrams,
  }).lean();
  if (existing) {
    report("REUSED", `request ${existing.requestNumber}`, existing.status);
    return existing;
  }
  const requestNumber = await nextRequestNumber();
  const createdAt = `${request.date}T09:00:00.000Z`;
  const data = {
    id: randomUUID(), requestNumber,
    ownerId: owner.id, companyId: company.id, lorryId: lorry.id,
    ownerName: owner.name, ownerPhone: owner.phone,
    companyName: company.name, companyPhone: company.phone,
    vehicleNumber: lorry.vehicleNumber, date: request.date,
    timeWindow: request.timeWindow, area: request.area, location: request.location,
    notes: request.notes || "", estimatedGrams: request.estimatedGrams,
    rateCents: DEMO_RATE_CENTS, status: request.status,
    createdAt, updatedAt: createdAt,
  };
  if (request.bill) {
    data.bill = {
      number: `BILL-${requestNumber}`, requestNumber,
      collectorName: collector.name,
      grossGrams: request.bill.grossGrams,
      rejectedGrams: request.bill.rejectedGrams,
      otherDeductionGrams: request.bill.otherDeductionGrams,
      netGrams: request.bill.netGrams,
      pricePerKgAtCollection: DEMO_RATE_CENTS,
      pricePerKgCents: DEMO_RATE_CENTS,
      totalCents: request.bill.totalCents,
      note: "Demo collection record", issuedAt: createdAt,
      recordedBy: collector.name, paymentStatus: request.bill.paymentStatus,
      ...(request.bill.paymentReference ? { paymentReference: request.bill.paymentReference } : {}),
      ...(request.bill.paymentStatus === "paid" ? { paidAt: createdAt, paidBy: company.name } : {}),
      ...(request.bill.paymentStatus === "paid" && settlementNumber ? { settlementNumber } : {}),
    };
  }
  const created = await CollectionRequest.create(data);
  const result = created.toObject();
  report("CREATED", `request ${requestNumber}`, request.status);
  return result;
}

async function ensureNotification({ recipientId, requestId, requestNumber, type, title, message }) {
  const existing = await Notification.findOne({ recipientId, requestId, type }).lean();
  if (existing) {
    report("REUSED", `notification ${type}`, existing.id);
    return existing;
  }
  const created = await Notification.create({
    id: randomUUID(), recipientId, requestId, type, title, message,
    requestNumber, read: false, createdAt: now(),
  });
  const result = created.toObject();
  report("CREATED", `notification ${type}`, result.id);
  return result;
}

async function seed() {
  const mongoUri = process.env.MONGO_URI || process.env.DATABASE_URI;
  if (!mongoUri) throw new Error("Set MONGO_URI in backend/.env before running the seed.");
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  try {
    const existingCompanyLogin = await User.findOne({ email: DEMO_COMPANY_EMAIL }).lean();
    const company = await findOrCreate(
      Company,
      existingCompanyLogin?.companyId
        ? { id: existingCompanyLogin.companyId }
        : { name: DEMO_COMPANY_NAME },
      {
        id: randomUUID(), name: DEMO_COMPANY_NAME, phone: "0710001000",
        address: "Mathugama, Kalutara",
        areas: ["Mathugama", "Agalawatta", "Dodangoda", "Neboda", "Baduraliya", "Bulathsinhala", "Kalutara"],
        rateCents: DEMO_RATE_CENTS, createdAt: now(),
      },
      "company Wijaya Tea",
    );
    if (company.name !== DEMO_COMPANY_NAME) {
      throw new Error(`Existing demo login is linked to ${company.name}; no records were changed.`);
    }
    const companyUser = await ensureUser({
      email: DEMO_COMPANY_EMAIL, name: DEMO_COMPANY_NAME, phone: "0710001000",
      address: company.address, role: "company", companyId: company.id, password: "Demo@123",
    });
    const owners = await Promise.all([
      ensureUser({ email: "nimal.seller@example.com", name: "Nimal Perera", phone: "0710002001", address: "Mathugama, Kalutara", role: "owner", password: "Demo@123" }),
      ensureUser({ email: "saman.seller@example.com", name: "Saman Kumara", phone: "0710002002", address: "Agalawatta, Kalutara", role: "owner", password: "Demo@123" }),
      ensureUser({ email: "chamara.seller@example.com", name: "Chamara Silva", phone: "0710002003", address: "Dodangoda, Kalutara", role: "owner", password: "Demo@123" }),
    ]);
    const collectors = await Promise.all([
      ensureUser({ email: "kasun.collector@example.com", name: "Kasun Silva", phone: "0710003001", role: "collector", companyId: company.id, password: "Demo@123" }),
      ensureUser({ email: "tharindu.collector@example.com", name: "Tharindu Fernando", phone: "0710003002", role: "collector", companyId: company.id, password: "Demo@123" }),
    ]);
    const lorries = await Promise.all([
      ensureLorry({ vehicleNumber: "WP-LD-4521", label: "Mathugama collection lorry", driverId: collectors[0].id, capacityGrams: 3000000, areas: ["Mathugama", "Neboda"], companyId: company.id, active: true }),
      ensureLorry({ vehicleNumber: "WP-LK-7814", label: "Agalawatta collection lorry", driverId: collectors[1].id, capacityGrams: 2500000, areas: ["Agalawatta", "Baduraliya", "Bulathsinhala"], companyId: company.id, active: true }),
      ensureLorry({ vehicleNumber: "WP-LD-3345", label: "Dodangoda reserve lorry", driverId: collectors[0].id, capacityGrams: 2000000, areas: ["Dodangoda", "Kalutara"], companyId: company.id, active: false }),
    ]);
    const settlementNumber = `SET-2026-10-${owners[0].id.slice(0, 8).toUpperCase()}`;
    const requests = await Promise.all([
      ensureRequest({ company, owner: owners[0], lorry: lorries[0], collector: collectors[0], settlementNumber, request: { date: "2026-10-10", timeWindow: "Morning", area: "Mathugama", location: "Mathugama tea estate gate", estimatedGrams: 450000, status: "paid", bill: { grossGrams: 438000, rejectedGrams: 8000, otherDeductionGrams: 2000, netGrams: 428000, totalCents: 10058000, paymentStatus: "paid", paymentReference: "WJT-PAY-001" } } }),
      ensureRequest({ company, owner: owners[1], lorry: lorries[1], collector: collectors[1], request: { date: "2026-10-14", timeWindow: "Afternoon", area: "Agalawatta", location: "Agalawatta collection shed", estimatedGrams: 380000, status: "completed", bill: { grossGrams: 372000, rejectedGrams: 7000, otherDeductionGrams: 0, netGrams: 365000, totalCents: 8577500, paymentStatus: "unpaid" } } }),
      ensureRequest({ company, owner: owners[2], lorry: lorries[2], collector: collectors[0], request: { date: "2026-10-17", timeWindow: "Morning", area: "Dodangoda", location: "Dodangoda estate entrance", estimatedGrams: 320000, status: "completed", bill: { grossGrams: 315000, rejectedGrams: 5000, otherDeductionGrams: 2000, netGrams: 308000, totalCents: 7238000, paymentStatus: "unpaid" } } }),
      ensureRequest({ company, owner: owners[0], lorry: lorries[0], collector: collectors[0], request: { date: "2026-10-25", timeWindow: "Morning", area: "Mathugama", location: "Mathugama tea estate gate", estimatedGrams: 500000, status: "on_the_way" } }),
      ensureRequest({ company, owner: owners[1], lorry: lorries[1], collector: collectors[1], request: { date: "2026-10-28", timeWindow: "Afternoon", area: "Agalawatta", location: "Agalawatta collection shed", estimatedGrams: 420000, status: "assigned" } }),
      ensureRequest({ company, owner: owners[2], lorry: lorries[2], collector: collectors[0], request: { date: "2026-10-05", timeWindow: "Morning", area: "Dodangoda", location: "Dodangoda estate entrance", estimatedGrams: 280000, status: "cancelled" } }),
      ensureRequest({ company, owner: owners[0], lorry: lorries[0], collector: collectors[0], request: { date: "2026-11-02", timeWindow: "Morning", area: "Mathugama", location: "Mathugama tea estate gate", estimatedGrams: 350000, status: "assigned" } }),
    ]);
    const paidRequest = requests[0];
    const settlement = await findOrCreate(
      MonthlySettlement,
      { companyId: company.id, ownerId: owners[0].id, month: "2026-10" },
      {
        id: randomUUID(), number: settlementNumber, companyId: company.id, ownerId: owners[0].id,
        ownerName: owners[0].name, companyName: company.name, month: "2026-10",
        requestIds: [paidRequest.id], requestNumbers: [paidRequest.requestNumber], requestCount: 1,
        totalCents: 10058000, status: "paid", paymentReference: "WJT-PAY-001",
        createdAt: now(), paidAt: now(), paidBy: companyUser.name,
      },
      "October settlement for Nimal Perera",
    );
    await Promise.all([
      ensureNotification({ recipientId: owners[0].id, requestId: requests[3].id, requestNumber: requests[3].requestNumber, type: "lorry_assigned", title: "Collection assigned", message: "Your collection request has been assigned to WP-LD-4521." }),
      ensureNotification({ recipientId: owners[0].id, requestId: paidRequest.id, requestNumber: paidRequest.requestNumber, type: "collection_completed", title: "Collection completed", message: "Your tea collection has been completed." }),
      ensureNotification({ recipientId: owners[0].id, requestId: paidRequest.id, requestNumber: paidRequest.requestNumber, type: "payment_completed", title: "Payment recorded", message: "Payment of Rs. 100,580 has been recorded." }),
      ensureNotification({ recipientId: collectors[0].id, requestId: requests[3].id, requestNumber: requests[3].requestNumber, type: "lorry_assigned", title: "Collection assigned", message: "You have a collection assigned in Mathugama." }),
    ]);
    console.log(`\nDemo seed complete: ${company.name}, ${owners.length} tea sellers, ${collectors.length} collectors, ${lorries.length} lorries, ${requests.length} requests, ${settlement.number}.`);
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
});
