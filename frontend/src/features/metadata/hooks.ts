import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { scanFolder, analyzeStream, selectMatch, write, readTags } from "@/api/pipeline";
import type { ScanFile, MatchCandidate } from "@/api/pipeline";
import { ApiError } from "@/api/errors";
import { useFolderHistory } from "@/hooks";
import type { MetadataFields, MetadataStep, QueueEntry } from "./types";
import { matchToFields, EMPTY_FIELDS, fileInfoToFields } from "./types";

const PREFETCH_DELAY_MS = 3000;

export { useFolderHistory };

export function useScanFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (path: string) => scanFolder({ path }),
    onSuccess: (data, path) => {
      queryClient.setQueryData(["pipeline", "scan", path], data);
    },
  });
}

export function useSelectMatch() {
  return useMutation({
    mutationFn: (params: { path: string; matches: MatchCandidate[]; selected_index: number }) =>
      selectMatch(params),
  });
}

export function useWriteMetadata() {
  const mutation = useMutation({
    mutationFn: (params: { path: string; metadata: Record<string, unknown> }) =>
      write(params),
  });

  const submit = useCallback(
    (path: string, fields: MetadataFields) => {
      const metadata: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== "") {
          if (key === "year" || key === "track" || key === "disc") {
            const n = Number(value);
            if (!isNaN(n)) metadata[key === "track" ? "track_number" : key === "disc" ? "disc_number" : key] = n;
          } else {
            metadata[key] = value;
          }
        }
      }
      mutation.mutate({ path, metadata });
    },
    [mutation],
  );

  return {
    submit,
    isLoading: mutation.isPending,
    error: mutation.error as ApiError | null,
    reset: mutation.reset,
  };
}

// --- Queue Hook ---

function createEntry(file: ScanFile): QueueEntry {
  return {
    file,
    status: "pending",
    fileInfo: null,
    matches: [],
    loadingProviders: new Set<string>(),
    selectedIndex: null,
    fields: null,
    lyrics: null,
    error: null,
    abortController: null,
    manualEdit: false,
  };
}

export function useMetadataFlow() {
  // Scan state
  const [folderPath, setFolderPath] = useState("");
  const [files, setFiles] = useState<ScanFile[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Queue state
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const queueRef = useRef<QueueEntry[]>([]);
  const currentIndexRef = useRef(0);
  const processingRef = useRef(false);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchPromiseRef = useRef<Promise<boolean> | null>(null);

  // Sync refs
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  // Prefetch ref (to avoid circular dependency with analyzeEntry)
  const prefetchNextRef = useRef<() => void>(() => {});

  // Mutations
  const scanMutation = useScanFolder();
  const selectMutation = useSelectMatch();
  const { submit: writeSubmit, isLoading: isWriting, error: writeError, reset: writeReset } = useWriteMetadata();

  // Derive current entry
  const currentEntry = queue[currentIndex] ?? null;
  const isQueueActive = queue.length > 0;
  const isDone = isQueueActive && queue.every((e) => e.status === "completed" || e.status === "skipped");
  const completedCount = queue.filter((e) => e.status === "completed" || e.status === "skipped").length;

  const step: MetadataStep = useMemo(() => {
    if (!isQueueActive) return "scan";
    if (isDone) return "done";
    return "processing";
  }, [isQueueActive, isDone]);

  // --- Core async analysis loop (NO React effect triggers this) ---

  const analyzeEntry = useCallback(async (entry: QueueEntry, controller: AbortController, overrides?: { title?: string; artist?: string; album?: string }): Promise<boolean> => {
    entry.status = "analyzing";
    entry.error = null;
    entry.loadingProviders = new Set();
    setQueue((prev) => [...prev]);

    try {
      for await (const event of analyzeStream({ path: entry.file.path, overrides }, controller.signal)) {
        if (controller.signal.aborted) return false;

        if (event.event === "provider") {
          entry.loadingProviders.add(event.source);
          entry.matches = [...entry.matches, ...event.matches];
          setQueue((prev) => [...prev]);
        } else if (event.event === "complete") {
          entry.fileInfo = event.file_info;
          entry.matches = event.all_matches;
          entry.loadingProviders = new Set();
        } else if (event.event === "error") {
          entry.error = event.detail;
          entry.status = "error";
          entry.loadingProviders = new Set();
          setQueue((prev) => [...prev]);
          return false;
        }
      }

      if (controller.signal.aborted) return false;
      entry.status = entry.matches.length > 0 ? "ready" : "error";
      if (entry.matches.length === 0) entry.error = "No candidates found";
      if (entry.status === "ready") prefetchNextRef.current();
    } catch (err) {
      if (controller.signal.aborted) return false;
      entry.error = err instanceof Error ? err.message : "Analysis failed";
      entry.status = "error";
    } finally {
      entry.loadingProviders = new Set();
      entry.abortController = null;
    }
    return true;
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      while (true) {
        const q = queueRef.current;
        const idx = currentIndexRef.current;
        if (idx >= q.length) break;

        const entry = q[idx];
        if (entry.status === "completed" || entry.status === "skipped") {
          currentIndexRef.current = idx + 1;
          setCurrentIndex(idx + 1);
          continue;
        }

        if (entry.status === "ready" || entry.fields !== null) {
          // Already analyzed, waiting for user action (write/skip)
          break;
        }

        // Start analysis
        const controller = new AbortController();
        entry.abortController = controller;

        const success = await analyzeEntry(entry, controller);

        if (controller.signal.aborted) break;

        if (!success) {
          // Error or no matches — stay on this entry so user can skip
          setQueue((prev) => [...prev]);
          break;
        }

        // Analysis complete — update state and wait for user
        setQueue((prev) => [...prev]);
        break;
      }
    } finally {
      processingRef.current = false;
    }
  }, [analyzeEntry]);

  // --- Prefetch next entry after current becomes ready ---

  const prefetchNext = useCallback(() => {
    // Clear any pending timer
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }

    prefetchTimerRef.current = setTimeout(() => {
      prefetchTimerRef.current = null;
      const q = queueRef.current;
      const idx = currentIndexRef.current;
      const nextIdx = idx + 1;

      if (nextIdx >= q.length) return;
      if (processingRef.current) return; // already processing, skip prefetch

      const next = q[nextIdx];
      if (next.status !== "pending") return;

      // Already analyzing this entry, don't duplicate
      if (next.abortController) return;

      const controller = new AbortController();
      next.abortController = controller;
      next.status = "analyzing";
      next.error = null;
      next.loadingProviders = new Set();
      setQueue((prev) => [...prev]);

      prefetchPromiseRef.current = analyzeEntry(next, controller).then((ok) => {
        prefetchPromiseRef.current = null;
        setQueue((prev) => [...prev]);
        return ok;
      });
    }, PREFETCH_DELAY_MS);
  }, [analyzeEntry]);

  prefetchNextRef.current = prefetchNext;

  // Queue advance event
  const advanceHandlerRef = useRef<() => void>(() => {});
  advanceHandlerRef.current = () => {
    selectMutation.reset();
    writeReset();
  };

  useEffect(() => {
    const handler = () => advanceHandlerRef.current();
    window.addEventListener("ytm:queue-advance", handler);
    return () => window.removeEventListener("ytm:queue-advance", handler);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel prefetch timer
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }
      // Abort in-flight prefetch
      if (prefetchPromiseRef.current) {
        prefetchPromiseRef.current = null;
      }
      // Abort all entry controllers
      for (const entry of queueRef.current) {
        if (entry.abortController) {
          entry.abortController.abort();
          entry.abortController = null;
        }
      }
    };
  }, []);

  // --- Handlers ---

  const handleScan = useCallback(
    (path: string) => {
      setFolderPath(path);
      scanMutation.mutate(path, {
        onSuccess: (data) => {
          setFiles(data);
          setSelectedIndices(new Set());
          setQueue([]);
          setCurrentIndex(0);
        },
      });
    },
    [scanMutation],
  );

  const handleStartQueue = useCallback(() => {
    if (files.length === 0) return;
    const indices = selectedIndices.size > 0 ? Array.from(selectedIndices) : files.map((_, i) => i);
    const entries = indices.map((i) => createEntry(files[i]));
    processingRef.current = false;
    setQueue(entries);
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    // Start processing after state is set (next tick)
    setTimeout(() => processQueue(), 0);
  }, [files, selectedIndices, processQueue]);

  const handleSkip = useCallback(async () => {
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    if (idx >= q.length) return;
    const entry = q[idx];
    if (entry.abortController) {
      entry.abortController.abort();
      entry.abortController = null;
    }
    entry.status = "skipped";
    setQueue([...q]);
    window.dispatchEvent(new Event("ytm:queue-advance"));
    const nextIdx = idx + 1;
    currentIndexRef.current = nextIdx;
    setCurrentIndex(nextIdx);
    // Clear pending prefetch timer, await in-flight prefetch if any
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
    if (prefetchPromiseRef.current) {
      await prefetchPromiseRef.current;
      prefetchPromiseRef.current = null;
    }
    processingRef.current = false;
    setTimeout(() => processQueue(), 0);
  }, [processQueue]);

  const handleWriteAndNext = useCallback(() => {
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    if (idx >= q.length) return;
    const entry = q[idx];
    writeSubmit(entry.file.path, entry.fields ?? EMPTY_FIELDS);
  }, [writeSubmit]);

  const handleWriteSuccess = useCallback(async () => {
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    if (idx >= q.length) return;
    const entry = q[idx];
    if (entry.abortController) {
      entry.abortController.abort();
      entry.abortController = null;
    }
    entry.status = "completed";
    setQueue([...q]);
    window.dispatchEvent(new Event("ytm:queue-advance"));
    const nextIdx = idx + 1;
    currentIndexRef.current = nextIdx;
    setCurrentIndex(nextIdx);
    // Clear pending prefetch timer, await in-flight prefetch if any
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
    if (prefetchPromiseRef.current) {
      await prefetchPromiseRef.current;
      prefetchPromiseRef.current = null;
    }
    processingRef.current = false;
    setTimeout(() => processQueue(), 0);
  }, [processQueue]);

  // Listen for write success
  const writeSuccessRef = useRef<() => void>(() => {});
  writeSuccessRef.current = handleWriteSuccess;

  useEffect(() => {
    const handler = () => writeSuccessRef.current();
    window.addEventListener("ytm:write-success", handler);
    return () => window.removeEventListener("ytm:write-success", handler);
  }, []);

  // Trigger write success after mutation succeeds
  const writeMutationPendingRef = useRef(false);
  useEffect(() => {
    if (writeMutationPendingRef.current && !isWriting) {
      writeMutationPendingRef.current = false;
      window.dispatchEvent(new Event("ytm:write-success"));
    }
    writeMutationPendingRef.current = isWriting;
  }, [isWriting]);

  const handleSelectCandidate = useCallback(
    (index: number) => {
      const q = queueRef.current;
      const idx = currentIndexRef.current;
      if (idx >= q.length) return;
      const entry = q[idx];
      if (!entry.matches[index]) return;

      entry.selectedIndex = index;
      entry.manualEdit = false;
      setQueue([...q]);

      selectMutation.mutate(
        { path: entry.file.path, matches: entry.matches, selected_index: index },
        {
          onSuccess: (data) => {
            const e = queueRef.current[idx];
            if (e) {
              e.fields = matchToFields(data.match, data.lyrics);
              e.lyrics = data.lyrics;
              e.status = "ready";
              setQueue([...queueRef.current]);
            }
          },
        },
      );
    },
    [selectMutation],
  );

  const handleSelectNone = useCallback(async () => {
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    if (idx >= q.length) return;
    const entry = q[idx];

    entry.selectedIndex = -1;
    entry.manualEdit = true;

    // Restore fields from a previous re-scan if available
    if (entry._savedFields) {
      entry.fields = entry._savedFields;
      delete entry._savedFields;
    } else if (entry.fileInfo) {
      entry.fields = fileInfoToFields(entry.fileInfo);
    } else {
      try {
        const tags = await readTags(entry.file.path);
        entry.fields = {
          title: tags.title ?? "",
          artist: tags.artist ?? "",
          album: tags.album ?? "",
          album_artist: tags.album_artist ?? "",
          genre: tags.genre ?? "",
          year: tags.year ?? "",
          track: tags.track ?? "",
          disc: tags.disc ?? "",
          lyrics: "",
          cover_url: "",
        };
      } catch {
        entry.fields = { ...EMPTY_FIELDS, title: entry.file.name.replace(/\.[^.]+$/, "") };
      }
    }

    entry.lyrics = null;
    entry.status = "ready";
    setQueue([...q]);
  }, []);

  const handleRescan = useCallback(() => {
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    if (idx >= q.length) return;
    const entry = q[idx];

    const savedFields = entry.fields;
    entry.selectedIndex = null;
    entry.manualEdit = false;
    entry.fields = null;
    entry.lyrics = null;
    entry.status = "pending";
    entry.matches = [];
    entry.loadingProviders = new Set();
    setQueue([...q]);

    const controller = new AbortController();
    entry.abortController = controller;
    selectMutation.reset();
    writeReset();

    // Build overrides from user-edited fields so matcher searches
    // using the modified values instead of re-reading the file.
    const overrides = savedFields
      ? { title: savedFields.title, artist: savedFields.artist, album: savedFields.album }
      : undefined;

    analyzeEntry(entry, controller, overrides).then(() => {
      // Re-scan done: show candidate list. If user clicks "None" again,
      // handleSelectNone will restore savedFields via entry._savedFields.
      entry.status = entry.matches.length > 0 ? "ready" : "error";
      if (entry.matches.length === 0) entry.error = "No candidates found";
      if (savedFields) entry._savedFields = savedFields;
      setQueue([...queueRef.current]);
    });
  }, [analyzeEntry, selectMutation, writeReset]);

  const handleSelectFile = useCallback(
    (fileIndex: number) => {
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        if (next.has(fileIndex)) {
          next.delete(fileIndex);
        } else {
          next.add(fileIndex);
        }
        return next;
      });
    },
    [],
  );

  const handleSelectAll = useCallback(() => {
    setSelectedIndices((prev) => {
      if (prev.size === files.length) return new Set();
      return new Set(files.map((_, i) => i));
    });
  }, [files]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const handleBack = useCallback(() => {
    writeReset();
    selectMutation.reset();
    for (const entry of queueRef.current) {
      if (entry.abortController) {
        entry.abortController.abort();
        entry.abortController = null;
      }
    }
    processingRef.current = false;
    setQueue([]);
    setCurrentIndex(0);
    setSelectedIndices(new Set());
  }, [writeReset, selectMutation]);

  const handleSetFields = useCallback((fields: MetadataFields) => {
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    if (idx < q.length) {
      q[idx].fields = fields;
      setQueue([...q]);
    }
  }, []);

  return {
    // State
    step,
    folderPath,
    files,
    selectedIndices,
    queue,
    currentIndex,
    currentEntry,
    isQueueActive,
    isDone,
    completedCount,

    // Derived from current entry
    currentMatches: currentEntry?.matches ?? [],
    currentLoadingProviders: currentEntry?.loadingProviders ?? new Set<string>(),
    currentFields: currentEntry?.fields ?? EMPTY_FIELDS,
    currentLyrics: currentEntry?.lyrics ?? null,

    // Scan
    isScanning: scanMutation.isPending,
    scanError: scanMutation.error as ApiError | null,
    handleScan,

    // Queue
    handleStartQueue,
    handleSelectFile,
    handleSelectAll,
    handleDeselectAll,
    handleSkip,
    handleWriteAndNext,
    handleBack,

    // Current song
    handleSelectCandidate,
    handleSelectNone,
    handleRescan,
    isManualEdit: currentEntry?.manualEdit ?? false,
    isSelecting: selectMutation.isPending,
    selectError: selectMutation.error as ApiError | null,
    handleSetFields,

    // Write
    isWriting,
    writeError,
  };
}
