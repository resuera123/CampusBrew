import { useState } from "react";
import Modal from "./Modal";

type Props = {
  /** Who is being suspended; null closes the modal. */
  name: string | null;
  defaultReason?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

/** Asks for an optional suspension reason before suspending an account. */
export default function SuspendModal({ name, defaultReason = "", onCancel, onConfirm }: Props) {
  return (
    <Modal open={!!name} onClose={onCancel} title={`Suspend ${name ?? ""}?`}>
      {/* Keyed by name so each opening starts with a fresh form. */}
      {name && <SuspendForm key={name} defaultReason={defaultReason} onCancel={onCancel} onConfirm={onConfirm} />}
    </Modal>
  );
}

function SuspendForm({ defaultReason, onCancel, onConfirm }: Omit<Props, "name">) {
  const [reason, setReason] = useState(defaultReason ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <p>They'll be signed out right away and can't log in until you lift the suspension.</p>
      <div className="modal-confirm">
        <label htmlFor="suspend-reason">Reason for suspending (optional)</label>
        <textarea
          id="suspend-reason"
          rows={3}
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Abusive messages in an order chat"
          autoFocus
        />
      </div>
      {error && <p className="admin-error" style={{ marginTop: 12 }}>{error}</p>}
      <div className="modal-actions">
        <button className="modal-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="danger" onClick={confirm} disabled={busy}>{busy ? "Suspending…" : "Suspend"}</button>
      </div>
    </>
  );
}
