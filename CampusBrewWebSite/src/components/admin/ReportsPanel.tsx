import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";

type Summary = {
  id: string; type: string; status: string; createdAt: string;
  reporterName?: string; orderId?: string; note?: string;
};
type Detail = Summary & {
  messages?: { senderName: string; senderRole: string; text: string; createdAt: string }[];
  payment?: { amount: number; type: string; method: string; status: string; referenceNo: string; createdAt: string };
  people?: { userId: string; name: string; role: string; reporter: boolean; suspended: boolean }[];
};

const STATUSES = ["OPEN", "RESOLVED", "ALL"];
const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : "–");

export default function ReportsPanel() {
  const [status, setStatus] = useState("OPEN");
  const [reports, setReports] = useState<Summary[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    api<Summary[]>(`/api/admin/reports?status=${status}`)
      .then(setReports)
      .catch((e) => setError(e.message));
  }, [status]);

  useEffect(load, [load]);

  const open = (id: string) =>
    api<Detail>(`/api/admin/reports/${id}`).then(setDetail).catch((e) => alert(e.message));

  async function resolve(id: string) {
    try {
      setDetail(await api<Detail>(`/api/admin/reports/${id}/resolve`, { method: "PUT" }));
      load();
    } catch (e) { alert((e as Error).message); }
  }

  async function suspend(userId: string) {
    const reason = prompt("Reason for suspending (optional):");
    if (reason === null) return;
    try {
      await api(`/api/admin/users/${userId}/suspend`, { method: "PUT", body: JSON.stringify({ reason }) });
      if (detail) open(detail.id);
    } catch (e) { alert((e as Error).message); }
  }

  async function unsuspend(userId: string) {
    try {
      await api(`/api/admin/users/${userId}/unsuspend`, { method: "PUT" });
      if (detail) open(detail.id);
    } catch (e) { alert((e as Error).message); }
  }

  if (detail) {
    return (
      <section>
        <button className="admin-back" onClick={() => setDetail(null)}>← Back to reports</button>
        <article className="admin-card">
          <h2>{detail.type} report · {detail.status}</h2>
          <p>Reported by <strong>{detail.reporterName ?? "Unknown"}</strong> on {fmt(detail.createdAt)}</p>
          {detail.orderId && <p>Order: {detail.orderId}</p>}
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
                  <td>{p.suspended ? "Suspended" : "Active"}</td>
                  <td>
                    {p.role !== "Admin" && (p.suspended
                      ? <button onClick={() => unsuspend(p.userId)}>Unsuspend</button>
                      : <button className="danger" onClick={() => suspend(p.userId)}>Suspend</button>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {detail.status !== "RESOLVED" && (
            <div className="admin-actions">
              <button onClick={() => resolve(detail.id)}>Mark as resolved</button>
            </div>
          )}
        </article>
      </section>
    );
  }

  return (
    <section>
      <div className="admin-filters">
        {STATUSES.map((s) => (
          <button key={s} className={s === status ? "active" : ""} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      {error && <p className="admin-error">{error}</p>}
      {!error && reports.length === 0 && <p>No reports.</p>}
      <table className="admin-table">
        <tbody>
          {reports.map((r) => (
            <tr key={r.id} className="clickable" onClick={() => open(r.id)}>
              <td>{r.type}</td>
              <td>{r.reporterName ?? "Unknown"}</td>
              <td>{r.note ?? ""}</td>
              <td>{fmt(r.createdAt)}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}