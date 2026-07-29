import { useEffect, useState } from "react";

export function useImageDimensions(url: string | null) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!url) { setDims(null); return; }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setDims({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => { if (!cancelled) setDims(null); };
    img.src = url;
    return () => { cancelled = true; };
  }, [url]);
  return dims;
}
