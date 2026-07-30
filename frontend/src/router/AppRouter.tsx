import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { SearchPage } from "@/features/search";
import { PlaylistPage } from "@/features/playlist";
import { DownloadsPage } from "@/features/downloads";
import { MetadataPage } from "@/features/metadata";
import { SettingsPage } from "@/features/settings";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="playlist" element={<PlaylistPage />} />
        <Route path="downloads" element={<DownloadsPage />} />
        <Route path="metadata" element={<MetadataPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
