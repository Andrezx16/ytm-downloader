import { Search } from "lucide-react";

export function SearchPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Search className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Search</h1>
      <p className="text-muted-foreground">Search for songs, albums, and playlists.</p>
    </div>
  );
}
