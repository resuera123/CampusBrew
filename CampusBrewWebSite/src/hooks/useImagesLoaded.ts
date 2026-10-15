import { useEffect, useState } from "react";

export function useImagesLoaded(urls: string[], timeoutMs = 1200): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loads = urls.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
        })
    );
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));

    Promise.race([Promise.all(loads), timeout]).then(() => {
      if (cancelled) return;
      // two frames so the browser paints the hidden starting state first
      requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return ready;
}