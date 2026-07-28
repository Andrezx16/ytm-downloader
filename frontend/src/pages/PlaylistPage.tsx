import { ListMusic } from "lucide-react";

export function PlaylistPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <ListMusic className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Playlist</h1>
      <p className="text-muted-foreground">Browse and download YouTube playlists.</p>
    </div>
  );
}
