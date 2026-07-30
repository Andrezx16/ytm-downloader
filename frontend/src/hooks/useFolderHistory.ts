import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";

const HISTORY_LIMIT = 10;

export function useFolderHistory(namespace: string) {
  const key = `ytm-folder-history-${namespace}`;
  const [history, setHistory] = useLocalStorage<string[]>(key, []);

  const add = useCallback(
    (path: string) => {
      const trimmed = path.trim();
      if (!trimmed) return;
      setHistory((prev) => {
        const filtered = prev.filter((p) => p !== trimmed);
        return [trimmed, ...filtered].slice(0, HISTORY_LIMIT);
      });
    },
    [setHistory],
  );

  const remove = useCallback(
    (path: string) => {
      setHistory((prev) => prev.filter((p) => p !== path));
    },
    [setHistory],
  );

  const clear = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  return { history, add, remove, clear };
}
