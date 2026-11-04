import { useState } from "react";
import { api } from "../../lib/api";
import { useAdminList, matches } from "../../lib/adminList";
import Modal from "./Modal";
import Toolbar from "./Toolbar";

type Suspended = {
  userId: string; fullName: string; email: string; role: string; dasherApproved: boolean;
  reason?: string; suspendedAt?: string;
};

const ROLES: Record<string, string> = {
  CUSTOMER: "Customer", DELIVERY_PERSONNEL: "Dasher", SHOP_OPERATOR: "Shop operator", ADMIN: "Admin",
};
const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : "–");
const roleOf = (u: Suspended) =>
  u.role === "CUSTOMER" && u.dasherApproved ? "Customer · Dasher" : ROLES[u.role] ?? u.role;

/** Every suspended account, with a way to lift each suspension. */
export default function SuspendedPanel() {
  const { items: users, error, refreshing, reload: load } = useAdminList<Suspended>("/api/admin/users/suspended");
  const [query, setQuery] = useState("");
  const [lifting, setLifting] = useState<Suspended | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  async function lift() {
    if (!lifting) return;
    setBusy(true);
    setActionError("");
    try {
      await api(`/api/admin/users/${lifting.userId}/unsuspend`, { method: "PUT" });
      setLifting(null);
      load();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const shown = users.filter((u) => matches(query, u.fullName, u.email, u.userId, u.reason, roleOf(u)));

  return (
    <section>
      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Search by name, email or reason"
        onRefresh={load}
        refreshing={refreshing}
      />
      {error && <p className="admin-error">{error}</p>}
      {!error && !refreshing && users.length === 0 && <p className="admin-empty">No suspended accounts.</p>}
      {!error && users.length > 0 && shown.length === 0 && <p className="admin-empty">No accounts match “{query}”.</p>}

      {shown.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Reason</th><th>Since</th><th></th></tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.userId}>
                <td><strong>{u.fullName}</strong></td>
                <td>{u.email}</td>
                <td>{roleOf(u)}</td>
                <td>{u.reason ?? "—"}</td>
                <td>{fmt(u.suspendedAt)}</td>
                <td><button onClick={() => { setActionError(""); setLifting(u); }}>Unsuspend</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={!!lifting} onClose={() => !busy && setLifting(null)} title={`Unsuspend ${lifting?.fullName ?? ""}?`}>
        <p>They'll be able to log in and use CampusBrew again.</p>
        {actionError && <p className="admin-error" style={{ marginTop: 12 }}>{actionError}</p>}
        <div className="modal-actions">
          <button className="modal-cancel" onClick={() => setLifting(null)} disabled={busy}>Cancel</button>
          <button onClick={lift} disabled={busy}>{busy ? "Lifting…" : "Unsuspend"}</button>
        </div>
      </Modal>
    </section>
  );
}
