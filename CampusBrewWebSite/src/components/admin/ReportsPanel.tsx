import { useState } from "react";
import { api } from "../../lib/api";
import { useAdminList, matches, refOf } from "../../lib/adminList";
import Toolbar from "./Toolbar";
import SuspendModal from "./SuspendModal";

type Summary = {
  id: string; ref?: string; type: string; status: string; createdAt: string;
  reporterName?: string; orderId?: string; note?: string;
};
type Person = { userId: string; name: string; role: string; reporter: boolean; suspended: boolean };
type Detail = Summary & {
  messages?: { senderName: string; senderRole: string; text: string; createdAt: string }[];
  payment?: { amount: number; type: string; method: string; status: string; referenceNo: string; createdAt: string };
  people?: Person[];
};

const STATUSES = ["OPEN", "RESOLVED", "ALL"];
const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : "–");
const typeLabel = (t: string) => (t === "CHAT" ? "Chat" : t === "PAYMENT" ? "Payment" : t);

export default function ReportsPanel() {
  const [status, setStatus] = useState("OPEN");
  const { items: reports, error, refreshing, reload: load } = useAdminList<Summary>(`/api/admin/reports?status=${status}`);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [suspending, setSuspending] = useState<Person | null>(null);

  const open = (id: string) => {
    setActionError("");
    return api<Detail>(`/api/admin/reports/${id}`).then(setDetail).catch((e) => setActionError(e.message));
  };

  async function resolve(id: string) {
    setActionError("");
    try {
      setDetail(await api<Detail>(`/api/admin/reports/${id}/resolve`, { method: "PUT" }));
      load();
    } catch (e) { setActionError((e as Error).message); }
  }

  async function suspend(reason: string) {
    if (!suspending) return;
    await api(`/api/admin/users/${suspending.userId}/suspend`, { method: "PUT", body: JSON.stringify({ reason }) });
    setSuspending(null);
    if (detail) await open(detail.id);
  }

  async function unsuspend(userId: string) {
    setActionError("");
    try {
      await api(`/api/admin/users/${userId}/unsuspend`, { method: "PUT" });
      if (detail) open(detail.id);
    } catch (e) { setActionError((e as Error).message); }
  }

  if (detail) {
    return (
      <section>
        <button className="admin-back" onClick={() => setDetail(null)}>← Back to reports</button>
        <article className="admin-card">
          <div className="admin-card-head">
            <div>
              <span className="admin-ref">{refOf(detail)}</span>
              <h2>{typeLabel(detail.type)} report</h2>
            </div>
            <span className={`badge ${detail.status.toLowerCase()}`}>{detail.status}</span>
          </div>
          <p>Reported by <strong>{detail.reporterName ?? "Unknown"}</strong> on {fmt(detail.createdAt)}</p>
          {detail.orderId && <p>Order: #{detail.orderId.slice(-6).toUpperCase()}</p>}
          {detail.note && <p>Note: {detail.note}</p>}

          {detail.payment && (
            <div>
              <h3>Payment</h3>
              <p>
                ₱{detail.payment.amount} · {detail.payment.method} · {detail.payment.type} ·{" "}
                {detail.payment.status} · Ref {detail.payment.referenceNo ?? "–"}
              </p>
            </div>
          )}

          {detail.messages && detail.messages.length > 0 && (
            <div>
              <h3>Chat</h3>
              <ul className="admin-chat">
                {detail.messages.map((m, i) => (
                  <li key={i}>
                    <strong>{m.senderName}</strong> ({m.senderRole}) · {fmt(m.createdAt)}
                    <br />{m.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h3>People involved</h3>
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Role</th><th></th><th></th></tr></thead>
            <tbody>
              {detail.people?.map((p) => (
                <tr key={p.userId}>
                  <td>{p.name}{p.reporter ? " (reporter)" : ""}</td>
                  <td>{p.role}</td>
                  <td>{p.suspended ? <span className="badge rejected">Suspended</span> : "Active"}</td>
                  <td>
                    {p.role !== "Admin" && (p.suspended
                      ? <button onClick={() => unsuspend(p.userId)}>Unsuspend</button>
                      : <button className="danger" onClick={() => setSuspending(p)}>Suspend</button>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {actionError && <p className="admin-error" style={{ marginTop: 12 }}>{actionError}</p>}

          {detail.status !== "RESOLVED" && (
            <div className="admin-actions">
              <button onClick={() => resolve(detail.id)}>Mark as resolved</button>
            </div>
          )}
        </article>

        <SuspendModal
          name={suspending?.name ?? null}
          defaultReason={`From ${refOf(detail)} (${typeLabel(detail.type).toLowerCase()} report)`}
          onCancel={() => setSuspending(null)}
          onConfirm={suspend}
        />
      </section>
    );
  }

  const shown = reports.filter((r) => matches(query, refOf(r), r.id, r.reporterName, r.note, typeLabel(r.type)));

  return (
    <section>
      <Toolbar
        statuses={STATUSES}
        status={status}
        onStatus={setStatus}
        query={query}
        onQuery={setQuery}
        placeholder="Search by report ID (e.g. RPT-0004) or name"
        onRefresh={load}
        refreshing={refreshing}
      />
      {error && <p className="admin-error">{error}</p>}
      {actionError && <p className="admin-error">{actionError}</p>}
      {!error && !refreshing && reports.length === 0 && <p className="admin-empty">No reports.</p>}
      {!error && reports.length > 0 && shown.length === 0 && <p className="admin-empty">No reports match “{query}”.</p>}
      {shown.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr><th>ID</th><th>Type</th><th>Reported by</th><th>Note</th><th>When</th><th>Status</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => open(r.id)}>
                <td><span className="admin-ref">{refOf(r)}</span></td>
                <td>{typeLabel(r.type)}</td>
                <td>{r.reporterName ?? "Unknown"}</td>
                <td>{r.note ?? ""}</td>
                <td>{fmt(r.createdAt)}</td>
                <td><span className={`badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
