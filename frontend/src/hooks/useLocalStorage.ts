import { useState, useCallback } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      const next = value instanceof Function ? value(stored) : value;
      setStored(next);
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* */ }
    },
    [key, stored],
  );

  return [stored, setValue] as const;
}
