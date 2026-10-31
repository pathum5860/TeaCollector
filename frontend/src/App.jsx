import { useEffect, useState } from "react";
import { api, session } from "./api/client.js";
import { Brand } from "./components/ui.jsx";
import Login from "./components/Login.jsx";
import Seller from "./pages/Seller.jsx";
import Company from "./pages/Company.jsx";
import Collector from "./pages/Collector.jsx";

export default function App() {
  const [config, setConfig] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("overview");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [date, setDate] = useState("");
  const [customer, setCustomer] = useState("all");
  const [lorryQuery, setLorryQuery] = useState("");
  const [lorryStatus, setLorryStatus] = useState("all");
  const [lorryArea, setLorryArea] = useState("all");
  const [lorrySort, setLorrySort] = useState("vehicle");

  async function refresh() {
    const token = session.get();
    if (!token) {
      setData(null);
      return;
    }
    try {
      const result = await api("/state");
      if (session.get() === token) {
        setData(result);
        setError("");
      }
    } catch (err) {
      if (err.status === 401) {
        session.clear();
        setData(null);
      } else {
        throw err;
      }
    }
  }

  useEffect(() => {
    (async () => {
      try {
        setConfig(await api("/config"));
        await refresh();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const userId = data?.user.id;
  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(
      () => refresh().catch(() => setError("Could not refresh. Check that the backend is still running.")),
      20000,
    );
    return () => clearInterval(timer);
  }, [userId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  function navigate(next) {
    setView(next);
    setStatus("all");
    setDate("");
    setCustomer("all");
    setQuery("");
  }

  async function save(path, method, body, message = "Saved.") {
    await api(path, method, body);
    setModal(null);
    setToast(message);
    try {
      await refresh();
    } catch {
      setError("Your change was saved. Reload the page to see the latest records.");
    }
  }

  async function markNotification(id) {
    try {
      await api(`/notifications/${id}/read`, "PATCH");
      setData((current) => current && {
        ...current,
        notifications: (current.notifications || []).map((item) =>
          item.id === id ? { ...item, read: true } : item,
        ),
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function markAllNotifications() {
    try {
      await api("/notifications/read-all", "POST", {});
      setData((current) => current && {
        ...current,
        notifications: (current.notifications || []).map((item) => ({ ...item, read: true })),
      });
    } catch (err) {
      setError(err.message);
    }
  }

  const confirm = (title, message, path, method, success, submit) =>
    setModal({ type: "confirm", title, message, path, method, success, submit });

  if (loading) return <div className="loading"><Brand /><p>Opening your workspace…</p></div>;
  if (!config) {
    return <div className="loading"><Brand /><h2>Cannot reach the backend</h2><p>{error || "Start the backend, then try again."}</p><button className="button" onClick={() => location.reload()}>Try again</button></div>;
  }
  if (!data) {
    return <Login onLogin={async () => { await refresh(); setView("overview"); }} />;
  }

  const Page = data.user.role === "owner" ? Seller : data.user.role === "company" ? Company : Collector;
  return <Page data={data}
      view={view}
      navigate={navigate}
      setView={setView}
      modal={modal}
      setModal={setModal}
      toast={toast}
      setToast={setToast}
      error={error}
      setError={setError}
      notificationsOpen={notificationsOpen}
      setNotificationsOpen={setNotificationsOpen}
      selectedSettlement={selectedSettlement}
      setSelectedSettlement={setSelectedSettlement}
      query={query}
      setQuery={setQuery}
      status={status}
      setStatus={setStatus}
      date={date}
      setDate={setDate}
      customer={customer}
      setCustomer={setCustomer}
      lorryQuery={lorryQuery}
      setLorryQuery={setLorryQuery}
      lorryStatus={lorryStatus}
      setLorryStatus={setLorryStatus}
      lorryArea={lorryArea}
      setLorryArea={setLorryArea}
      lorrySort={lorrySort}
      setLorrySort={setLorrySort}
      setData={setData}
      save={save}
      markNotification={markNotification}
      markAllNotifications={markAllNotifications}
      confirm={confirm} />;
}
