import { Brand, Icon } from "./ui.jsx";

export default function WorkspaceLayout({
  user,
  company,
  nav,
  view,
  navigate,
  active,
  data,
  notificationsOpen,
  setNotificationsOpen,
  markNotification,
  markAllNotifications,
  onSignOut,
  children,
}) {
  const isOwner = user.role === "owner";
  const unread = (data.notifications || []).some((item) => !item.read);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace">
          <span className="eyebrow">WORKSPACE</span>
          <strong>{isOwner ? "Tea Seller" : company?.name || "Collection team"}</strong>
          <small>{user.role === "collector" ? "Collector dashboard" : "Tea collection management"}</small>
        </div>
        <nav aria-label="Main navigation">
          {nav.map(([key, icon, label]) => (
            <button
              key={key}
              className={view === key ? "nav-item active" : "nav-item"}
              onClick={() => navigate(key)}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {key === "collections" && active.length > 0 && <em>{active.length}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{user.name[0].toUpperCase()}</div>
          <div>
            <strong>{user.name}</strong>
            <small>{user.role === "company" ? "Company manager" : isOwner ? "Tea Seller" : "Collector"}</small>
          </div>
          <button className="icon-button" title="Sign out" aria-label="Sign out" onClick={onSignOut}>
            <Icon name="exit" />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <span>
            TeaCollector{" "}
            <span className="breadcrumb">/ {nav.find((item) => item[0] === view)?.[2]}</span>
          </span>
          <div className="topbar-account notification-wrap">
            <button
              className="icon-button topbar-notification"
              aria-label="Notifications"
              title="Notifications"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Icon name="bell" size={18} />
              {unread && <span className="notification-dot" aria-label="Unread notifications" />}
            </button>
            {notificationsOpen && (
              <div className="notification-panel">
                <div className="notification-panel-head">
                  <strong>Notifications</strong>
                  {unread && <button className="link" onClick={markAllNotifications}>Mark all read</button>}
                </div>
                {!data.notifications?.length ? (
                  <p className="small muted notification-empty">No notifications yet.</p>
                ) : (
                  data.notifications.map((item) => (
                    <button
                      className={`notification-item${item.read ? " read" : ""}`}
                      key={item.id}
                      onClick={() => {
                        markNotification(item.id);
                        if (item.requestId) navigate("collections");
                      }}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                      <small>{new Date(item.createdAt).toLocaleString("en-GB")}</small>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
