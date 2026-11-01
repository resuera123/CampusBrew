import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken } from "../lib/api";
import ApplicationsPanel from "../components/admin/ApplicationsPanel";
import ReportsPanel from "../components/admin/ReportsPanel";
import Modal from "../components/admin/Modal";
import "../styles/admin.css";

const TABS = ["Dasher applications", "Shop applications", "Reports"] as const;

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
          <div>
            <h1>CampusBrew Admin</h1>
            <p className="admin-sub">Review applications and handle reports</p>
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

        {tab === "Dasher applications" && <ApplicationsPanel key="d" base="/api/admin/applications" />}
        {tab === "Shop applications" && <ApplicationsPanel key="s" base="/api/admin/shop-applications" />}
        {tab === "Reports" && <ReportsPanel />}
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