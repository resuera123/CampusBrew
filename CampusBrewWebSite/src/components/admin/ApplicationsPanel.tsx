import { useCallback, useState } from "react";
import { api } from "../../lib/api";
import { useAdminList, matches, refOf } from "../../lib/adminList";
import Modal from "./Modal";
import Lightbox from "./Lightbox";
import Toolbar from "./Toolbar";

type Item = Record<string, unknown> & { id: string; status?: string };
type Mode = "view" | "approve" | "reject";

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "ALL"];
const TITLE_KEYS = ["stallName", "shopName", "fullName", "accountName", "operatorName"];
const HIDE = new Set(["id", "ref", "reapplied", "userId", "shopId", "status", "createdAt", "reviewedAt", "rejectionReason"]);

const isPhotoKey = (k: string) => /(photo|image|selfie)$/i.test(k);
const isImg = (v: unknown): v is string =>
  typeof v === "string" && /^(https?:\/\/|data:image)/i.test(v);

const label = (k: string) =>
  k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function show(v: unknown): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const titleOf = (item: Item) =>
  (TITLE_KEYS.map((k) => item[k]).find((v) => typeof v === "string" && v) as string | undefined) ??
  "Application";

export default function ApplicationsPanel({ base, noun = "application" }: { base: string; noun?: string }) {
  const [status, setStatus] = useState("PENDING");
  const { items, error, refreshing, reload: load } = useAdminList<Item>(`${base}?status=${status}`);
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<{ src: string; caption: string } | null>(null);

  const [selected, setSelected] = useState<Item | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  // The list leaves the photos out (they're large); opening an item fetches the
  // full application. Tracks which id is loading so a late reply can't overwrite
  // a different application.
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function openItem(item: Item) {
    setSelected(item);
    setMode("view");
    setReason("");
    setActionError("");
    setLoadingId(item.id);
    api<Item>(`${base}/${item.id}`)
      .then((full) => setSelected((cur) => (cur?.id === full.id ? full : cur)))
      .catch((e) => setActionError(`Couldn't load the photos: ${(e as Error).message}`))
      .finally(() => setLoadingId((id) => (id === item.id ? null : id)));
  }

  const closeModal = useCallback(() => {
    setSelected(null);
    setLoadingId(null);
  }, []);

  async function approve() {
    if (!selected) return;
    setBusy(true);
    setActionError("");
    try {
      await api(`${base}/${selected.id}/approve`, { method: "PUT" });
      setSelected(null);
      load();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!selected) return;
    setBusy(true);
    setActionError("");
    try {
      await api(`${base}/${selected.id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setSelected(null);
      load();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const photoKeys = selected ? Object.keys(selected).filter(isPhotoKey) : [];
  const fields = selected
    ? Object.entries(selected).filter(([k, v]) => !HIDE.has(k) && !isPhotoKey(k) && v !== null && v !== "")
    : [];
  const selStatus = selected?.status ?? "PENDING";
  const shown = items.filter((item) =>
    matches(query, refOf(item), item.id, ...TITLE_KEYS.map((k) => item[k]), item.email, item.schoolEmail, item.studentId));

  return (
    <section>
      <Toolbar
        statuses={STATUSES}
        status={status}
        onStatus={setStatus}
        query={query}
        onQuery={setQuery}
        placeholder={`Search ${noun}s by ID or name`}
        onRefresh={load}
        refreshing={refreshing}
      />

      {error && <p className="admin-error">{error}</p>}
      {!error && !refreshing && items.length === 0 && <p className="admin-empty">Nothing here.</p>}
      {!error && items.length > 0 && shown.length === 0 && (
        <p className="admin-empty">No {noun}s match “{query}”.</p>
      )}

      <div className="admin-list">
        {shown.map((item) => {
          const st = item.status ?? "PENDING";
          const sub = [item.email, typeof item.createdAt === "string" ? show(item.createdAt) : null]
            .filter(Boolean)
            .join(" · ");
          return (
            <div
              key={item.id}
              className="admin-row"
              role="button"
              tabIndex={0}
              onClick={() => openItem(item)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openItem(item)}
            >
              <span className="admin-ref">{refOf(item)}</span>
              <div className="admin-row-main">
                <strong>{titleOf(item)}</strong>
                <span>{sub}</span>
              </div>
              {item.reapplied === true && <span className="badge reapplied">Re-Applied</span>}
              <span className={`badge ${st.toLowerCase()}`}>{st}</span>
              <span className="admin-chevron" aria-hidden="true">›</span>
            </div>
          );
        })}
      </div>

      <Modal open={!!selected} onClose={closeModal} title={selected ? `${refOf(selected)} · ${titleOf(selected)}` : ""} wide>
        {selected && (
          <>
            <div className="modal-statusline">
              <span className={`badge ${selStatus.toLowerCase()}`}>{selStatus}</span>
              {selected.reapplied === true && <span className="badge reapplied">Re-Applied</span>}
              {typeof selected.createdAt === "string" && (
                <span className="admin-sub">Submitted {show(selected.createdAt)}</span>
              )}
            </div>

            <dl className="admin-fields">
              {fields.map(([k, v]) => (
                <div key={k}>
                  <dt>{label(k)}</dt>
                  <dd>{show(v)}</dd>
                </div>
              ))}
            </dl>

            {photoKeys.length > 0 && (
              <div className="admin-photos">
                {photoKeys.map((k) => (
                  <figure key={k}>
                    {isImg(selected[k]) ? (
                      <button
                        type="button"
                        className="admin-photo-btn"
                        onClick={() => setViewing({ src: selected[k] as string, caption: label(k) })}
                        title="Click to enlarge"
                      >
                        <img src={selected[k] as string} alt={label(k)} />
                        <span className="admin-photo-zoom" aria-hidden="true">⤢</span>
                      </button>
                    ) : (
                      <div className="admin-nophoto">
                        {loadingId === selected.id ? "Loading photo…" : "No photo uploaded"}
                      </div>
                    )}
                    <figcaption>{label(k)}</figcaption>
                  </figure>
                ))}
              </div>
            )}

            {typeof selected.rejectionReason === "string" && selected.rejectionReason && (
              <p className="admin-reason"><strong>Rejection reason:</strong> {selected.rejectionReason}</p>
            )}

            <details className="admin-ids">
              <summary>Technical IDs</summary>
              <p>Application: {selected.id}</p>
              {typeof selected.userId === "string" && <p>User: {selected.userId}</p>}
              {typeof selected.shopId === "string" && <p>Shop: {selected.shopId}</p>}
            </details>

            {actionError && <p className="admin-error">{actionError}</p>}

            {selStatus === "PENDING" && mode === "view" && (
              <div className="modal-actions">
                {selected.reapplied === true && (
                  <span className="badge reapplied" title="This applicant was rejected before and applied again">
                    Re-Applied
                  </span>
                )}
                <button onClick={() => setMode("approve")}>Approve</button>
                <button className="danger" onClick={() => setMode("reject")}>Reject</button>
              </div>
            )}

            {mode === "approve" && (
              <div className="modal-confirm">
                <p>Approve <strong>{titleOf(selected)}</strong>? They'll be notified and gain access right away.</p>
                <div className="modal-actions">
                  <button className="modal-cancel" onClick={() => setMode("view")} disabled={busy}>Back</button>
                  <button onClick={approve} disabled={busy}>{busy ? "Approving…" : "Yes, approve"}</button>
                </div>
              </div>
            )}

            {mode === "reject" && (
              <div className="modal-confirm">
                <label htmlFor="reject-reason">Reason for rejecting</label>
                <textarea
                  id="reject-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="This will be shown to the applicant"
                />
                <div className="modal-actions">
                  <button className="modal-cancel" onClick={() => setMode("view")} disabled={busy}>Back</button>
                  <button className="danger" onClick={reject} disabled={busy || !reason.trim()}>
                    {busy ? "Rejecting…" : "Confirm reject"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
      <Lightbox src={viewing?.src ?? null} caption={viewing?.caption} onClose={() => setViewing(null)} />
    </section>
  );
}