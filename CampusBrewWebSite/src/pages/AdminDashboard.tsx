import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken } from "../lib/api";
import ApplicationsPanel from "../components/admin/ApplicationsPanel";
import ReportsPanel from "../components/admin/ReportsPanel";
import SupportPanel from "../components/admin/SupportPanel";
import SuspendedPanel from "../components/admin/SuspendedPanel";
import Modal from "../components/admin/Modal";
import "../styles/admin.css";

const TABS = [
  "User applications",
  "Dasher applications",
  "Shop applications",
  "Reports",
  "Support",
  "Suspensions",
] as const;

export default function AdminDashboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const navigate = useNavigate();

  function logout() {
    clearToken();
    navigate("/admin/login");
  }

  return (
    <div className="admin-page">
      <div className="admin">
        <header className="admin-header">
          <div className="admin-brand">
            <img src="/logo-badge.png" alt="" aria-hidden="true" />
            <div>
              <h1>CampusBrew Admin</h1>
              <p className="admin-sub">Review applications, reports, support messages and suspensions</p>
            </div>
          </div>
          <button className="admin-logout" onClick={() => setConfirmLogout(true)}>Log out</button>
        </header>

        <div className="admin-tabs">
          {TABS.map((t) => (
            <button key={t} className={t === tab ? "active" : ""} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        {tab === "User applications" && (
          <ApplicationsPanel key="v" base="/api/admin/verifications" noun="verification request" />
        )}
        {tab === "Dasher applications" && <ApplicationsPanel key="d" base="/api/admin/applications" />}
        {tab === "Shop applications" && <ApplicationsPanel key="s" base="/api/admin/shop-applications" />}
        {tab === "Reports" && <ReportsPanel />}
        {tab === "Support" && <SupportPanel />}
        {tab === "Suspensions" && <SuspendedPanel />}
      </div>

      <Modal open={confirmLogout} onClose={() => setConfirmLogout(false)} title="Log out?">
        <p>You'll need to sign in again to access the admin console.</p>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={() => setConfirmLogout(false)}>Cancel</button>
          <button className="danger" onClick={logout}>Log out</button>
        </div>
      </Modal>
    </div>
  );
}