import { useRef, useState } from "react";
import { RotateCcw, Shield, Upload, Trash2, CheckCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthStatus, importCookies, removeCookies } from "@/api";
import { useSettings } from "./store";
import type { DownloadQuality, DownloadContainer } from "@/features/download/types";

const QUALITY_OPTIONS: { value: DownloadQuality; label: string }[] = [
  { value: "best", label: "Best" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CONTAINER_OPTIONS: { value: DownloadContainer; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "m4a", label: "M4A" },
  { value: "opus", label: "Opus" },
  { value: "original", label: "Original" },
];

export function SettingsPage() {
  const { settings, updateDownloads, updatePlaylist, resetToDefaults } = useSettings();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: authStatus } = useQuery({
    queryKey: ["auth-status"],
    queryFn: () => getAuthStatus(),
  });

  const isConfigured = authStatus?.configured ?? false;
  const importedAt = authStatus?.imported_at ?? null;

  const importMutation = useMutation({
    mutationFn: (file: File) => importCookies(file),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["auth-status"] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => removeCookies(),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["auth-status"] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    importMutation.mutate(file);
    e.target.value = "";
  };

  const handleRemove = () => {
    if (window.confirm("Remove imported cookies? Downloads will run anonymously.")) {
      removeMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col gap-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure default preferences for downloads and playlists.
        </p>
      </div>

      {/* Downloads Section */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Downloads</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Default quality
          </label>
          <select
            value={settings.downloads.quality}
            onChange={(e) => updateDownloads({ quality: e.target.value as DownloadQuality })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {QUALITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Default format
          </label>
          <select
            value={settings.downloads.container}
            onChange={(e) => updateDownloads({ container: e.target.value as DownloadContainer })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CONTAINER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.downloads.embed_thumbnail}
              onChange={(e) => updateDownloads({ embed_thumbnail: e.target.checked })}
              className="size-4 rounded border-input"
            />
            Embed thumbnail
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.downloads.embed_metadata}
              onChange={(e) => updateDownloads({ embed_metadata: e.target.checked })}
              className="size-4 rounded border-input"
            />
            Embed metadata
          </label>
        </div>
      </section>

      {/* Playlists Section */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Playlists</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Default quality
          </label>
          <select
            value={settings.playlist.quality}
            onChange={(e) => updatePlaylist({ quality: e.target.value as DownloadQuality })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {QUALITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Default format
          </label>
          <select
            value={settings.playlist.container}
            onChange={(e) => updatePlaylist({ container: e.target.value as DownloadContainer })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CONTAINER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.playlist.embed_thumbnail}
              onChange={(e) => updatePlaylist({ embed_thumbnail: e.target.checked })}
              className="size-4 rounded border-input"
            />
            Embed thumbnail
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.playlist.embed_metadata}
              onChange={(e) => updatePlaylist({ embed_metadata: e.target.checked })}
              className="size-4 rounded border-input"
            />
            Embed metadata
          </label>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.playlist.skip_existing}
              onChange={(e) => updatePlaylist({ skip_existing: e.target.checked })}
              className="size-4 rounded border-input"
            />
            Skip already downloaded songs
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Retry failed downloads
          </label>
          <input
            type="number"
            min={0}
            max={5}
            value={settings.playlist.retries}
            onChange={(e) => updatePlaylist({ retries: Math.max(0, Math.min(5, Number(e.target.value))) })}
            className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </section>

      {/* YouTube Authentication Section */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-medium">YouTube Authentication</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Import a cookies.txt file to authenticate with YouTube and avoid bot detection.
        </p>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`size-2 rounded-full ${
                isConfigured ? "bg-green-500" : "bg-muted-foreground/50"
              }`}
            />
            <span className="text-sm">
              {isConfigured ? "Configured" : "Not configured"}
            </span>
            {isConfigured && importedAt && (
              <span className="text-xs text-muted-foreground">
                — imported {new Date(importedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending}
              className="flex items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              {isConfigured ? (
                <>
                  <Upload className="size-3.5" />
                  Replace cookies
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  Import cookies.txt
                </>
              )}
            </button>

            {isConfigured && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={removeMutation.isPending}
                className="flex items-center gap-2 rounded-md border border-destructive/50 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                Remove cookies
              </button>
            )}
          </div>

          {isConfigured && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <CheckCircle className="size-3" />
              Authentication active — downloads use imported cookies
            </div>
          )}
        </div>
      </section>

      {/* Reset */}
      <div>
        <button
          type="button"
          onClick={resetToDefaults}
          className="flex items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <RotateCcw className="size-3.5" />
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
