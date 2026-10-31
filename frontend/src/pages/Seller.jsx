import { Fragment } from "react";
import { api, session, money, kg, downloadCSV } from "../api/client.js";
import { Brand, Icon, Badge, Empty, Form, Field } from "../components/ui.jsx";
import Dialogs from "../components/Dialogs.jsx";
import WorkspaceLayout from "../components/WorkspaceLayout.jsx";

const navByRole = {
  owner: [
    ["overview", "grid", "Overview"],
    ["browse", "truck", "Find a lorry"],
    ["collections", "list", "My collections"],
    ["bills", "bill", "My bills"],
    ["monthly", "bill", "Monthly payments"],
    ["profile", "user", "My profile"],
  ],
  company: [
    ["overview", "grid", "Overview"],
    ["collections", "list", "Collections"],
    ["lorries", "truck", "Lorry Management"],
    ["collectors", "user", "Collectors"],
    ["bills", "bill", "Bills & payments"],
    ["monthly", "bill", "Monthly payments"],
    ["company", "settings", "Company settings"],
  ],
  collector: [
    ["overview", "grid", "Overview"],
    ["collections", "truck", "Pickup list"],
    ["bills", "bill", "Collection bills"],
    ["profile", "user", "My profile"],
  ],
};
const descriptions = {
  overview: "A clear view of your collections, from pickup to payment.",
  browse: "Choose a company and lorry that serve your estate.",
  collections: "Keep track of every pickup and its collection status.",
  bills: "Weight, rates and payments, all in one place.",
  monthly: "Review monthly payments and every collection included in them.",
  lorries: "Create, view, edit and delete your company's lorries.",
  collectors: "Create login accounts for your company's collectors.",
  company: "Manage your company profile and the rate for new requests.",
  profile: "Keep your contact and pickup details up to date.",
};

const lorrySortFields = {
  vehicle: "vehicleNumber",
  label: "label",
  capacity: "capacityGrams",
  status: "active",
  created: "createdAt",
};
function filterAndSortLorries(lorries, query, bookingStatus, area, sortBy) {
  const needle = query.trim().toLowerCase();
  return lorries
    .filter((lorry) => {
      const searchable = [lorry.vehicleNumber, lorry.label, lorry.driverName, ...lorry.areas];
      const matchesSearch = !needle || searchable.some((value) => value.toLowerCase().includes(needle));
      const matchesStatus = bookingStatus === "all" || (bookingStatus === "active" ? lorry.active : !lorry.active);
      const matchesArea = area === "all" || lorry.areas.includes(area);
      return matchesSearch && matchesStatus && matchesArea;
    })
    .sort((a, b) => {
      const field = lorrySortFields[sortBy];
      const left = a[field];
      const right = b[field];
      return typeof left === "number"
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true });
    });
}



export default function Seller({
  data, view, navigate, setView, modal, setModal, toast, setToast, error, setError,
  notificationsOpen, setNotificationsOpen, selectedSettlement, setSelectedSettlement,
  query, setQuery, status, setStatus, date, setDate, customer, setCustomer,
  lorryQuery, setLorryQuery, lorryStatus, setLorryStatus, lorryArea, setLorryArea,
  lorrySort, setLorrySort, setData, save, markNotification, markAllNotifications,
  confirm,
}) {
  const user = data.user;
  const lorryAreas = [...new Set((data?.lorries || []).flatMap((lorry) => lorry.areas))].sort();
  const visibleLorries = filterAndSortLorries(
    data?.lorries || [],
    lorryQuery,
    lorryStatus,
    lorryArea,
    lorrySort,
  );
  function openMonthlySettlement(settlement) {
    setSelectedSettlement(settlement);
    setView("monthlyDetail");
  }
  const isOwner = user.role === "owner";
  const isCompany = user.role === "company";
  const nav = navByRole[user.role];
  const company = data.companies.find((c) => c.id === user.companyId);
  const requests = data.requests;
  const filtered = requests.filter(
    (r) =>
      (status === "all" ||
        r.status === status ||
        r.bill?.paymentStatus === status) &&
      (!date || r.date === date) &&
      (customer === "all" || r.ownerId === customer),
  );
  const bills = isCompany ? filtered : filtered.filter((r) => r.bill);
  const settlements = data.settlements || [];
  const active = requests.filter((r) =>
    ["pending", "requested", "accepted", "assigned", "on_the_way"].includes(r.status),
  );
  const netGrams = requests.reduce(
    (sum, r) => sum + (r.bill?.netGrams || 0),
    0,
  );
  const billed = requests.reduce(
    (sum, r) => sum + (r.bill?.totalCents || 0),
    0,
  );
  const unpaid = requests
    .filter((r) => r.bill?.paymentStatus === "unpaid")
    .reduce((sum, r) => sum + r.bill.totalCents, 0);
  const heading =
    view === "overview"
      ? isOwner
        ? "Your tea, collected."
        : isCompany
          ? "Your collection desk."
          : "Ready for the next pickup?"
      : view === "monthlyDetail"
        ? "Monthly payment details"
        : nav.find((n) => n[0] === view)?.[2];

  function recordActions(r) {
    const truck = data.lorries.find((t) => t.id === r.lorryId);
    return (
      <div className="row-actions">
        {r.bill && (
          <button
            className="button small secondary"
            onClick={() => setModal({ type: "invoice", record: r })}
          >
            View bill
          </button>
        )}
        {r.bill && isCompany && r.status === "completed" && r.bill.paymentStatus === "unpaid" && (
          <button
            className="button small"
            onClick={() => setModal({ type: "pay", record: r })}
          >
            Record payment
          </button>
        )}
        {isOwner && ["pending", "requested", "assigned"].includes(r.status) && (
          <>
            {truck && ["pending", "requested"].includes(r.status) && (
              <button
                className="button small secondary"
                onClick={() =>
                  setModal({ type: "editRequest", record: r, lorry: truck })
                }
              >
                Edit
              </button>
            )}
            <button
              className="link danger"
              onClick={() =>
                confirm(
                  "Cancel this pickup?",
                  `Cancel the collection with ${r.vehicleNumber} on ${r.date}?`,
                  `/requests/${r.id}/cancel`,
                  "POST",
                  "Pickup cancelled.",
                  "Cancel pickup",
                )
              }
            >
              Cancel
            </button>
          </>
        )}
        {isCompany && r.status === "assigned" && (
          <button className="link danger" onClick={() => confirm("Reject this pickup?", `Reject the pickup scheduled for ${r.date}?`, `/requests/${r.id}/reject`, "POST", "Request rejected.", "Reject pickup")}>
            Reject
          </button>
        )}
        {!isOwner && r.status === "assigned" && (
          <button
            className="button small secondary"
            disabled={r.date > data.today}
            onClick={() =>
              confirm(
                "Start this pickup?",
                `Let ${r.ownerName} know the collector is on the way.`,
                `/requests/${r.id}/on-the-way`,
                "POST",
                "Pickup is now on the way.",
                "Mark on the way",
              )
            }
          >
            On the way
          </button>
        )}
        {!isOwner && r.status === "on_the_way" && (
          <button
            className="button small"
            disabled={r.date > data.today}
            onClick={() => setModal({ type: "collect", record: r })}
          >
            Record weight
          </button>
        )}
      </div>
    );
  }
  function collectionTable(rows) {
    if (!rows.length)
      return (
        <Empty title="No collections to show">
          {isOwner
            ? "Choose a lorry to arrange your first pickup."
            : "Requests will appear here when a Tea Seller chooses your lorry."}
        </Empty>
      );
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>{isOwner ? "Company & lorry" : "Owner"}</th>
              <th>Pickup details</th>
              <th>Weight</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.requestNumber}</strong>
                  <small>{r.date}</small>
                  <small>
                    {r.timeWindow} · {r.area}
                  </small>
                </td>
                <td>
                  <strong>{isOwner ? r.companyName : r.ownerName}</strong>
                  <small>
                    {r.vehicleNumber}
                    {!isOwner && (
                      <>
                        {" "}
                        · <a href={`tel:${r.ownerPhone}`}>{r.ownerPhone}</a>
                      </>
                    )}
                  </small>
                </td>
                <td className="pickup-details-cell">
                  <div>
                    {r.id === "__pickup_details_removed__" && (
                      <>
                        <p><strong>Pickup:</strong> {r.date} · {r.timeWindow}</p>
                        <p><strong>Area:</strong> {r.area}</p>
                        <p><strong>Estimated weight:</strong> {kg(r.estimatedGrams)} kg</p>
                      </>
                    )}
                    <p>{r.location}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.location + ", " + r.area + ", Sri Lanka")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open location search →
                    </a>
                  </div>
                </td>
                <td>
                  <strong>
                    {kg(r.bill?.netGrams ?? r.estimatedGrams)} kg
                  </strong>
                  <small>
                    {r.bill ? "Accepted weight" : "Estimated weight"}
                  </small>
                </td>
                <td>
                  <Badge value={r.status} />
                  {r.bill && (
                    <div className="sub-badge">
                      <Badge value={r.bill.paymentStatus} />
                    </div>
                  )}
                </td>
                <td>{recordActions(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  function filterBar(forBills = false) {
    const options = forBills
      ? isCompany
        ? [
            { value: "all", label: "All collection statuses" },
            { value: "assigned", label: "Assigned" },
            { value: "on_the_way", label: "On the way" },
            { value: "collected", label: "Collected" },
            { value: "completed", label: "Completed" },
            { value: "paid", label: "Paid" },
            { value: "rejected", label: "Rejected" },
            { value: "cancelled", label: "Cancelled" },
          ]
        : [
            { value: "all", label: "All payments" },
            { value: "unpaid", label: "Unpaid" },
            { value: "paid", label: "Paid" },
          ]
      : [
          { value: "all", label: "All statuses" },
          { value: "pending", label: "Pending" },
          { value: "accepted", label: "Accepted" },
          { value: "assigned", label: "Assigned" },
          { value: "on_the_way", label: "On the way" },
          { value: "collected", label: "Collected" },
          { value: "completed", label: "Completed" },
          { value: "rejected", label: "Rejected" },
          { value: "cancelled", label: "Cancelled" },
        ];
    return (
      <div className="filter-bar">
        <Field
          label="Status"
          value={status}
          onChange={setStatus}
          options={options}
        />
        <Field
          label="Collection date"
          value={date}
          onChange={setDate}
          type="date"
        />
        {forBills && isCompany && (
          <Field
            label="Tea Seller"
            value={customer}
            onChange={setCustomer}
            options={[
              { value: "all", label: "All Tea Sellers" },
              ...[...new Map(requests.map((request) => [request.ownerId, request])).values()].map((request) => ({
                value: request.ownerId,
                label: request.ownerName,
              })),
            ]}
          />
        )}
        <button
          className="link"
          onClick={() => {
            setStatus("all");
            setDate("");
            setCustomer("all");
          }}
        >
          Clear filters
        </button>
        <button
          className="button secondary export"
          onClick={() => downloadCSV(forBills ? bills : filtered)}
        >
          Export CSV
        </button>
      </div>
    );
  }
  function monthlyDetailPage() {
    if (!selectedSettlement) return null;
    const settlement =
      settlements.find((item) => item.id === selectedSettlement.id) ||
      selectedSettlement;
    const collectionRows = requests
      .filter((request) => settlement.requestIds.includes(request.id))
      .sort((a, b) => a.date.localeCompare(b.date));
    return (
      <section className="panel monthly-detail-page">
        <div className="monthly-print-header">
          <Brand />
          <div>
            <span>Monthly payment statement</span>
            <strong>{settlement.number}</strong>
          </div>
        </div>
        <div className="page-heading monthly-detail-heading">
          <div>
            <span className="eyebrow green">MONTHLY PAYMENT</span>
            <h2>{settlement.month}</h2>
            <p>
              {isCompany ? settlement.ownerName : settlement.companyName} ·{" "}
              {settlement.number}
            </p>
          </div>
          <div className="monthly-detail-actions no-print">
            <button className="button secondary" onClick={() => navigate("monthly")}>
              Back to monthly payments
            </button>
            <button
              className="button"
              onClick={() => setModal({ type: "monthlySummary", record: settlement })}
            >
              View bill
            </button>
          </div>
        </div>
        <div className="monthly-detail-summary">
          <div><span>Total amount</span><strong>{money(settlement.totalCents)}</strong></div>
          <div><span>Collection days</span><strong>{settlement.requestCount}</strong></div>
          <div><span>Payment status</span><Badge value={settlement.status} /></div>
        </div>
        <div className="monthly-print-parties">
          <div><span>Tea Seller</span><strong>{settlement.ownerName}</strong></div>
          <div><span>Company</span><strong>{settlement.companyName}</strong></div>
          <div><span>Collection month</span><strong>{settlement.month}</strong></div>
        </div>
        {isCompany && settlement.status === "pending" && (
          <div className="no-print">
            <Form
              initial={{ reference: "" }}
              submit="Record monthly payment"
              onCancel={() => navigate("monthly")}
              onSubmit={(values) =>
                save(
                  "/settlements/" + settlement.id + "/pay",
                  "POST",
                  values,
                  "Monthly payment recorded.",
                )
              }
            >
              {(bind) => (
                <Field
                  label="Bank reference / cash receipt"
                  required
                  maxLength={100}
                  {...bind("reference")}
                />
              )}
            </Form>
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Request</th>
                <th>Gross weight</th>
                <th>Rejected weight</th>
                <th>Other deduction</th>
                <th>Net weight</th>
                <th>Rate per kg</th>
                <th>Amount</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {collectionRows.map((request) => (
                <tr key={request.id}>
                  <td>{request.date}</td>
                  <td><strong>{request.requestNumber}</strong></td>
                  <td>{request.bill ? kg(request.bill.grossGrams) + " kg" : "—"}</td>
                  <td>{request.bill ? kg(request.bill.rejectedGrams) + " kg" : "—"}</td>
                  <td>{request.bill ? kg(request.bill.otherDeductionGrams) + " kg" : "—"}</td>
                  <td>{request.bill ? kg(request.bill.netGrams) + " kg" : "—"}</td>
                  <td>{request.bill ? money(request.bill.pricePerKgCents) : "—"}</td>
                  <td>{request.bill ? money(request.bill.totalCents) : "—"}</td>
                  <td>
                    <Badge value={request.bill?.paymentStatus || request.status} />
                    {request.bill?.paymentReference && <small>{request.bill.paymentReference}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="monthly-print-footer">
          <span>Generated by TeaCollector</span>
          <span>Payment status: {settlement.status}</span>
          <span>Authorized signature: ____________________</span>
        </div>
      </section>
    );
  }
  return (
    <>
      <WorkspaceLayout
      user={user}
      company={company}
      nav={nav}
      view={view}
      navigate={navigate}
      active={active}
      data={data}
      notificationsOpen={notificationsOpen}
      setNotificationsOpen={setNotificationsOpen}
      markNotification={markNotification}
      markAllNotifications={markAllNotifications}
      onSignOut={() => {
        session.clear();
        setData(null);
        setModal(null);
        setToast("");
      }}
    >
        
        <div className="page-body">
          {toast && (
            <div className="toast" role="status">
              <Icon name="check" />
              {toast}
              <button
                aria-label="Dismiss notification"
                onClick={() => setToast("")}
              >
                ×
              </button>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow green">
                {new Date(`${data.today}T12:00:00+05:30`).toLocaleDateString(
                  "en-GB",
                  {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: "Asia/Colombo",
                  },
                )}
              </span>
              <h1>{heading}</h1>
              <p>{descriptions[view]}</p>
            </div>
            {isOwner && view !== "browse" && (
              <button className="button" onClick={() => navigate("browse")}>
                <Icon name="plus" />
                Request collection
              </button>
            )}
            {isCompany && view === "lorries" && (
              <button
                className="button"
                onClick={() =>
                  data.collectors.length
                    ? setModal({ type: "lorry" })
                    : navigate("collectors")
                }
              >
                <Icon name="plus" />
                Add lorry
              </button>
            )}
            {isCompany && view === "collectors" && (
              <button
                className="button"
                onClick={() => setModal({ type: "collector" })}
              >
                <Icon name="plus" />
                Add collector
              </button>
            )}
          </div>

          {view === "overview" && (
            <>
              <div className="stats">
                {[
                  [active.length, "Active pickups", "clock"],
                  [`${kg(netGrams)} kg`, "Net tea collected", "leaf"],
                  [money(unpaid), "Awaiting payment", "bill"],
                  [money(billed), "Total billed", "check"],
                ].map(([value, label, icon]) => (
                  <article className="stat-card" key={label}>
                    <div className="stat-icon">
                      <Icon name={icon} />
                    </div>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
              <section className="welcome-card">
                <div>
                  <span className="eyebrow">
                    {isOwner
                      ? "FROM LEAF TO LORRY"
                      : isCompany
                        ? "KEEP YOUR COLLECTIONS MOVING"
                        : "YOUR COLLECTION DAY"}
                  </span>
                  <h2>
                    {isOwner
                      ? "Fresh tea ready for pickup?"
                      : isCompany
                        ? "A simpler way to collect."
                        : "Your route starts here."}
                  </h2>
                  <p>
                    {isOwner
                      ? "Find a lorry serving your area and send your request directly."
                      : isCompany
                        ? "Add your collectors and lorries, set your rate, and let owners book."
                        : "See the requests for your lorry, collect the tea and record its weight."}
                  </p>
                  <button
                    className="button light"
                    onClick={() =>
                      navigate(
                        isOwner
                          ? "browse"
                          : isCompany
                            ? "lorries"
                            : "collections",
                      )
                    }
                  >
                    {isOwner
                      ? "Find a lorry"
                      : isCompany
                        ? "Manage lorries"
                        : "View pickup list"}
                    <Icon name="arrow" size={18} />
                  </button>
                </div>
                <div className="welcome-art">
                  <Icon name={isOwner ? "leaf" : "truck"} size={108} />
                </div>
              </section>
              {isCompany && company.rateCents === 0 && (
                <div className="notice">
                  Set your tea rate in{" "}
                  <button className="link" onClick={() => navigate("company")}>
                    Company settings
                  </button>{" "}
                  before Tea Sellers can book your lorries.
                </div>
              )}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recent collections</h2>
                    <p>Your latest pickup activity</p>
                  </div>
                  <button
                    className="link"
                    onClick={() => navigate("collections")}
                  >
                    View all <span aria-hidden="true">→</span>
                  </button>
                </div>
                {collectionTable(requests.slice(0, 5))}
              </section>
            </>
          )}

          {view === "browse" && (
            <>
              <div className="browse-search">
                <Field
                  label="Search companies, lorries or collection areas"
                  value={query}
                  onChange={setQuery}
                  placeholder="Try an area, company, or vehicle number…"
                />
                <span>
                  {data.lorries.length} registered{" "}
                  {data.lorries.length === 1 ? "lorry" : "lorries"}
                </span>
              </div>
              <div className="lorry-grid">
                {data.lorries
                  .filter((l) => {
                    const c = data.companies.find((x) => x.id === l.companyId);
                    return `${l.vehicleNumber} ${l.label} ${l.areas.join(" ")} ${c?.name}`
                      .toLowerCase()
                      .includes(query.toLowerCase());
                  })
                  .map((l) => {
                    const c = data.companies.find((x) => x.id === l.companyId);
                    return (
                      <article className="lorry-card" key={l.id}>
                        <div className="lorry-card-top">
                          <span className="truck-icon">
                            <Icon name="truck" size={28} />
                          </span>
                          <span className="available">
                            {c?.rateCents > 0
                              ? "Open for bookings"
                              : "Rate not set"}
                          </span>
                        </div>
                        <span className="eyebrow green">{c?.name}</span>
                        <h2>{l.vehicleNumber}</h2>
                        <p>{l.label}</p>
                        <div className="area-tags">
                          {l.areas.map((a) => (
                            <span key={a}>
                              <Icon name="pin" size={12} />
                              {a}
                            </span>
                          ))}
                        </div>
                        <dl>
                          <div>
                            <dt>Collector</dt>
                            <dd>{l.driverName}</dd>
                          </div>
                          <div>
                            <dt>Daily capacity</dt>
                            <dd>{kg(l.capacityGrams)} kg</dd>
                          </div>
                        </dl>
                        <div className="lorry-card-footer">
                          <div>
                            <strong>{money(c?.rateCents)}</strong>
                            <small>per kg of accepted tea</small>
                          </div>
                          <button
                            className="button small"
                            disabled={!c?.rateCents}
                            onClick={() =>
                              setModal({ type: "request", lorry: l })
                            }
                          >
                            Choose lorry
                            <Icon name="arrow" size={16} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>
              {!data.lorries.length && (
                <Empty title="No lorries registered yet">
                  A company needs to add a collector, a lorry and a tea rate
                  first.
                </Empty>
              )}
              {data.lorries.length > 0 &&
                !data.lorries.some((l) =>
                  `${l.vehicleNumber} ${l.label} ${l.areas.join(" ")} ${data.companies.find((c) => c.id === l.companyId)?.name}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                ) && (
                  <Empty title="No matching lorries">
                    Try another area or company name.
                  </Empty>
                )}
            </>
          )}

          {view === "collections" && (
            <section className="panel">
              {filterBar()}
              {collectionTable(filtered)}
            </section>
          )}
          {(view === "bills" || view === "monthly") && (
            <section className="panel">
              {view === "bills" && filterBar(true)}
              {view === "monthly" && user.role !== "collector" && (
                <div className="monthly-payments">
                  <div className="panel-heading">
                    <div>
                      <h2>Monthly payments</h2>
                      <p>Group completed collection bills into one monthly payment.</p>
                    </div>
                    {isCompany && (
                      <button className="button small" onClick={() => setModal({ type: "settlement" })}>
                        Create monthly payment
                      </button>
                    )}
                  </div>
                  {!settlements.length ? (
                    <p className="monthly-empty muted">No monthly payments yet.</p>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Settlement</th>
                            <th>{isCompany ? "Tea Seller" : "Company"}</th>
                            <th>Collections</th>
                            <th>Total</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {settlements.map((settlement) => {
                            const collectionRows = data.requests.filter((request) =>
                              settlement.requestIds.includes(request.id),
                            );
                            return (
                              <Fragment key={settlement.id}>
                                <tr
                                  key={settlement.id}
                                  className="monthly-settlement-row"
                                  role="button"
                                  tabIndex="0"
                                  onClick={() => openMonthlySettlement(settlement)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      openMonthlySettlement(settlement);
                                    }
                                  }}
                                >
                                  <td><strong>{settlement.number}</strong><small>{settlement.month}</small></td>
                                  <td>{isCompany ? settlement.ownerName : settlement.companyName}</td>
                                  <td>{settlement.requestCount}</td>
                                  <td><strong>{money(settlement.totalCents)}</strong></td>
                                  <td><Badge value={settlement.status} /></td>
                                </tr>
                                <tr key={`${settlement.id}-details`} className="settlement-details-row">
                                  <td colSpan={isCompany ? 6 : 5}>
                                    <div className="monthly-collection-list">
                                      <div className="monthly-collection-head">
                                        <strong>Date</strong>
                                        <strong>Request</strong>
                                        <strong>Net weight</strong>
                                        <strong>Amount</strong>
                                        <strong>Payment</strong>
                                      </div>
                                      {collectionRows.map((request) => (
                                          <div key={request.id}>
                                            <strong>{request.date}</strong>
                                            <span>{request.requestNumber}</span>
                                            <span>{request.bill ? `${kg(request.bill.netGrams)} kg` : "Not collected"}</span>
                                            <span>{request.bill ? money(request.bill.totalCents) : "—"}</span>
                                            <Badge value={request.bill?.paymentStatus || request.status} />
                                          </div>
                                        ))}
                                    </div>
                                  </td>
                                </tr>
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              {view === "bills" && (!bills.length ? (
                <Empty title={isCompany ? "No collections to show" : "No bills to show"}>
                  {isCompany
                    ? "Collection requests will appear here for your company."
                    : "Bills appear after a collector records the actual tea weight."}
                </Empty>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{isCompany ? "Request / bill" : "Bill"}</th>
                        <th>{isOwner ? "Company" : "Tea Seller"}</th>
                        <th>Net weight</th>
                        <th>Net amount</th>
                        <th>{isCompany ? "Status / payment" : "Payment"}</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong className="bill-number">
                              {r.bill?.number || r.requestNumber}
                            </strong>
                            <small>{r.date}</small>
                          </td>
                          <td>
                            {isOwner ? r.companyName : r.ownerName}
                            <small>{r.vehicleNumber}</small>
                          </td>
                          <td>
                            {r.bill ? `${kg(r.bill.netGrams)} kg` : "—"}
                            {!r.bill && <small>Not collected</small>}
                          </td>
                          <td>
                            {r.bill ? <strong>{money(r.bill.totalCents)}</strong> : "—"}
                          </td>
                          <td>
                            <Badge value={r.status} />
                            {r.bill && <div className="sub-badge"><Badge value={r.bill.paymentStatus} /></div>}
                          </td>
                          <td>{recordActions(r)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          )}

          {view === "monthlyDetail" && monthlyDetailPage()}

          {view === "lorries" && (
            <section className="panel">
              <div className="filters lorry-filters" aria-label="Lorry search and filters">
                <label className="field"><span>Search lorries</span><input value={lorryQuery} onChange={(e) => setLorryQuery(e.target.value)} placeholder="Vehicle, label or collector" /></label>
                <label className="field"><span>Booking status</span><select value={lorryStatus} onChange={(e) => setLorryStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Open</option><option value="paused">Paused</option></select></label>
                <label className="field"><span>Collection area</span><select value={lorryArea} onChange={(e) => setLorryArea(e.target.value)}><option value="all">All areas</option>{lorryAreas.map((area) => <option key={area} value={area}>{area}</option>)}</select></label>
                <label className="field"><span>Sort by</span><select value={lorrySort} onChange={(e) => setLorrySort(e.target.value)}><option value="vehicle">Vehicle number</option><option value="label">Lorry label</option><option value="capacity">Capacity</option><option value="status">Booking status</option><option value="created">Date added</option></select></label>
              </div>
              {!data.lorries.length ? (
                <Empty title="Add your first lorry">
                  Create a collector account, then add the lorry and its
                  collection areas.
                </Empty>
              ) : !visibleLorries.length ? (
                <Empty title="No lorries match these filters">Try a different search, status, or collection area.</Empty>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Lorry</th>
                        <th>Collector</th>
                        <th>Areas</th>
                        <th>Daily capacity</th>
                        <th>Bookings</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLorries.map((l) => (
                        <tr key={l.id}>
                          <td>
                            <strong>{l.vehicleNumber}</strong>
                            <small>{l.label}</small>
                          </td>
                          <td>{l.driverName}</td>
                          <td>{l.areas.join(", ")}</td>
                          <td>{kg(l.capacityGrams)} kg</td>
                          <td>
                            <span
                              className={`badge ${l.active ? "collected" : "cancelled"}`}
                            >
                              {l.active ? "Open" : "Paused"}
                            </span>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="button secondary small"
                                onClick={async () => {
                                  try {
                                    const record = await api(`/lorries/${l.id}`);
                                    setModal({ type: "lorryDetails", record });
                                  } catch (err) {
                                    setError(err.message);
                                  }
                                }}
                              >
                                View
                              </button>
                              <button
                                className="button secondary small"
                                onClick={() =>
                                  setModal({ type: "lorry", record: l })
                                }
                              >
                                Edit
                              </button>
                              <button
                                className="link danger"
                                onClick={() =>
                                  confirm(
                                    "Delete this lorry?",
                                    "Only lorries with no collection history can be deleted. Pause bookings to keep an existing lorry's history.",
                                    `/lorries/${l.id}`,
                                    "DELETE",
                                    "Lorry deleted.",
                                    "Delete lorry",
                                  )
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {view === "collectors" && (
            <section className="panel">
              {!data.collectors.length ? (
                <Empty title="Add your first collector">
                  Create an account here, then choose that collector when adding
                  a lorry.
                </Empty>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Collector</th>
                        <th>Login email</th>
                        <th>Phone</th>
                        <th>Lorries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.collectors.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.name}</strong>
                            <small>Collector account</small>
                          </td>
                          <td>{c.email}</td>
                          <td>{c.phone}</td>
                          <td>
                            {data.lorries
                              .filter((l) => l.driverId === c.id)
                              .map((l) => l.vehicleNumber)
                              .join(", ") || "No lorry yet"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="panel-note">
                Collectors log in with the email and password you create. They
                see requests for their own lorries.
              </div>
            </section>
          )}

          {view === "company" && (
            <section className="panel settings-panel">
              <h2>Company details</h2>
              <p className="muted">
                This information helps Tea Sellers choose your collection
                service.
              </p>
              <Form
                key={company.id + company.rateCents + company.name}
                initial={{
                  name: company.name,
                  phone: company.phone,
                  address: company.address,
                  areas: company.areas.join(", "),
                  rate: company.rateCents / 100,
                }}
                onSubmit={(v) =>
                  save(
                    "/company",
                    "PATCH",
                    v,
                    "Company details updated. Existing request rates stay unchanged.",
                  )
                }
              >
                {(bind) => (
                  <>
                    <Field
                      label="Company name"
                      {...bind("name")}
                      required
                      maxLength={100}
                    />
                    <div className="form-grid">
                      <Field
                        label="Phone"
                        {...bind("phone")}
                        required
                        maxLength={30}
                      />
                      <Field
                        label="Tea rate (LKR / kg)"
                        {...bind("rate")}
                        type="number"
                        min="0"
                        max="100000"
                        step="0.01"
                        required
                      />
                    </div>
                    <Field
                      label="Address"
                      {...bind("address")}
                      maxLength={300}
                    />
                    <Field
                      label="Collection areas"
                      {...bind("areas")}
                      required
                      hint="Separate areas with commas. Set each lorry's areas in Lorries."
                    />
                    <div className="notice">
                      Rate changes apply to new requests. Existing requests and
                      bills retain their saved rate.
                    </div>
                  </>
                )}
              </Form>
            </section>
          )}
          {view === "profile" && (
            <section className="panel settings-panel">
              <h2>Contact details</h2>
              <p className="muted">Signed in as {user.email}</p>
              <Form
                key={user.name + user.phone + user.address}
                initial={{
                  name: user.name,
                  phone: user.phone,
                  address: user.address,
                }}
                onSubmit={(v) =>
                  save(
                    "/profile",
                    "PATCH",
                    v,
                    "Profile updated. New requests use these details.",
                  )
                }
              >
                {(bind) => (
                  <>
                    <Field
                      label="Your name"
                      {...bind("name")}
                      required
                      maxLength={100}
                    />
                    <Field
                      label="Phone"
                      {...bind("phone")}
                      required
                      maxLength={30}
                    />
                    <Field
                      label="Address"
                      {...bind("address")}
                      multiline
                      maxLength={300}
                    />
                  </>
                )}
              </Form>
            </section>
          )}
          <footer className="page-footer">
            <span>TeaCollector · Tea collection & billing</span>
            <span>Currency: LKR · Dates: Sri Lanka</span>
          </footer>
        </div>
        
      </WorkspaceLayout>
      <Dialogs
        modal={modal}
        close={() => setModal(null)}
        data={data}
        save={save}
      />
    </>
  );
}
