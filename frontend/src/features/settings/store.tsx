import { createContext, useContext, useCallback } from "react";
import { useLocalStorage } from "@/hooks";
import type { Settings, DownloadSettings, PlaylistSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

interface SettingsContextValue {
  settings: Settings;
  updateDownloads: (partial: Partial<DownloadSettings>) => void;
  updatePlaylist: (partial: Partial<PlaylistSettings>) => void;
  resetToDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function mergeDefaults(stored: Settings): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    downloads: { ...DEFAULT_SETTINGS.downloads, ...stored.downloads },
    playlist: { ...DEFAULT_SETTINGS.playlist, ...stored.playlist },
  };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useLocalStorage<Settings>("ytm-settings", DEFAULT_SETTINGS);

  const merged = mergeDefaults(settings);

  const updateDownloads = useCallback(
    (partial: Partial<DownloadSettings>) => {
      setSettings((prev) => ({
        ...mergeDefaults(prev),
        downloads: { ...prev.downloads, ...partial },
      }));
    },
    [setSettings],
  );

  const updatePlaylist = useCallback(
    (partial: Partial<PlaylistSettings>) => {
      setSettings((prev) => ({
        ...mergeDefaults(prev),
        playlist: { ...prev.playlist, ...partial },
      }));
    },
    [setSettings],
  );

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, [setSettings]);

  return (
    <SettingsContext.Provider value={{ settings: merged, updateDownloads, updatePlaylist, resetToDefaults }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
