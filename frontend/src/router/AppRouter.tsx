import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { HomePage } from "@/pages/HomePage";
import { SearchPage } from "@/pages/SearchPage";
import { PlaylistPage } from "@/pages/PlaylistPage";
import { DownloadsPage } from "@/pages/DownloadsPage";
import { MetadataPage } from "@/pages/MetadataPage";
import { SettingsPage } from "@/pages/SettingsPage";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<Layout />}>
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
