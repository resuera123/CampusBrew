import { useCallback, useState } from "react";
import { api } from "../../lib/api";
import { useAdminList, matches, refOf } from "../../lib/adminList";
import Modal from "./Modal";
import Toolbar from "./Toolbar";

type Ticket = {
  id: string; ref?: string; email: string; name?: string; topic: string; message: string;
  status: string; createdAt: string; resolvedAt?: string;
  userId?: string; accountName?: string; accountRole?: string; suspended: boolean; suspendedReason?: string;
};

const STATUSES = ["OPEN", "RESOLVED", "ALL"];
const TOPICS: Record<string, string> = { APPEAL: "Suspension appeal", QUESTION: "Question", OTHER: "Other" };
const ROLES: Record<string, string> = {
  CUSTOMER: "Customer", DELIVERY_PERSONNEL: "Dasher", SHOP_OPERATOR: "Shop operator", ADMIN: "Admin",
};
const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : "–");

/** Messages sent from the app's Contact Support screen, including suspension appeals. */
export default function SupportPanel() {
  const [status, setStatus] = useState("OPEN");
  const { items: tickets, error, refreshing, reload: load } = useAdminList<Ticket>(`/api/admin/support?status=${status}`);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const close = useCallback(() => setSelected(null), []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setActionError("");
    try {
      await action();
      load();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const resolve = (t: Ticket) => run(async () => {
    setSelected(await api<Ticket>(`/api/admin/support/${t.id}/resolve`, { method: "PUT" }));
  });

  const lift = (t: Ticket) => run(async () => {
    await api(`/api/admin/users/${t.userId}/unsuspend`, { method: "PUT" });
    setSelected(await api<Ticket>(`/api/admin/support/${t.id}`));
  });

  const shown = tickets.filter((t) =>
    matches(query, refOf(t), t.id, t.email, t.name, t.accountName, TOPICS[t.topic], t.message));

  return (
    <section>
      <Toolbar
        statuses={STATUSES}
        status={status}
        onStatus={setStatus}
        query={query}
        onQuery={setQuery}
        placeholder="Search by ticket ID (e.g. SUP-0002), email or name"
        onRefresh={load}
        refreshing={refreshing}
      />
      {error && <p className="admin-error">{error}</p>}
      {!error && !refreshing && tickets.length === 0 && <p className="admin-empty">No support messages.</p>}
      {!error && tickets.length > 0 && shown.length === 0 && <p className="admin-empty">No messages match “{query}”.</p>}

      <div className="admin-list">
        {shown.map((t) => (
          <div
            key={t.id}
            className="admin-row"
            role="button"
            tabIndex={0}
            onClick={() => { setActionError(""); setSelected(t); }}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(t)}
          >
            <span className="admin-ref">{refOf(t)}</span>
            <div className="admin-row-main">
              <strong>{TOPICS[t.topic] ?? t.topic} · {t.name || t.accountName || t.email}</strong>
              <span>{t.message}</span>
            </div>
            {t.topic === "APPEAL" && t.suspended && <span className="badge rejected">Suspended</span>}
            <span className={`badge ${t.status.toLowerCase()}`}>{t.status}</span>
            <span className="admin-chevron" aria-hidden="true">›</span>
          </div>
        ))}
      </div>

      <Modal open={!!selected} onClose={close} title={selected ? `${refOf(selected)} · ${TOPICS[selected.topic] ?? selected.topic}` : ""} wide>
        {selected && (
          <>
            <div className="modal-statusline">
              <span className={`badge ${selected.status.toLowerCase()}`}>{selected.status}</span>
              <span className="admin-sub">Sent {fmt(selected.createdAt)}</span>
            </div>

            <dl className="admin-fields">
              <div><dt>Email</dt><dd>{selected.email}</dd></div>
              {selected.name && <div><dt>Name given</dt><dd>{selected.name}</dd></div>}
              <div>
                <dt>Account</dt>
                <dd>
                  {selected.userId
                    ? `${selected.accountName ?? "—"} (${ROLES[selected.accountRole ?? ""] ?? selected.accountRole ?? "User"})`
                    : "No account with this email"}
                </dd>
              </div>
              {selected.userId && (
                <div>
                  <dt>Account status</dt>
                  <dd>{selected.suspended ? "Suspended" : "Active"}</dd>
                </div>
              )}
            </dl>

            {selected.suspended && selected.suspendedReason && (
              <p className="admin-reason"><strong>Suspended for:</strong> {selected.suspendedReason}</p>
            )}

            <h3>Message</h3>
            <p className="admin-message">{selected.message}</p>

            {actionError && <p className="admin-error" style={{ marginTop: 12 }}>{actionError}</p>}

            <div className="modal-actions">
              <a
                className="admin-link-btn"
                href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: CampusBrew support ${refOf(selected)}`)}`}
              >
                Reply by email
              </a>
              {selected.suspended && selected.userId && (
                <button onClick={() => lift(selected)} disabled={busy}>Lift suspension</button>
              )}
              {selected.status !== "RESOLVED" && (
                <button onClick={() => resolve(selected)} disabled={busy}>{busy ? "Saving…" : "Mark as resolved"}</button>
              )}
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}
