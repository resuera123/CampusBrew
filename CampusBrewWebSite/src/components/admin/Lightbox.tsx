import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Full-size view of an application photo. The photos are data URIs, which
 * browsers won't open in a new tab, so they're enlarged in place instead.
 */
export default function Lightbox({ src, caption, onClose }: { src: string | null; caption?: string; onClose: () => void }) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    // Capture phase, so Escape closes the photo before the modal under it.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [src, onClose]);

  if (!src) return null;
  // Rendered on <body> so the modal's own layout can't clip it.
  return createPortal(
    <div className="lightbox" onMouseDown={(e) => { e.stopPropagation(); onClose(); }} role="dialog" aria-label={caption ?? "Photo"}>
      <figure onMouseDown={(e) => e.stopPropagation()}>
        <img src={src} alt={caption ?? ""} />
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
      <button className="lightbox-x" onClick={onClose} aria-label="Close photo">×</button>
    </div>,
    document.body,
  );
}
