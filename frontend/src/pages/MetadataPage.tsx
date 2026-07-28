import { Tag } from "lucide-react";

export function MetadataPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Tag className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Metadata</h1>
      <p className="text-muted-foreground">Enrich and write metadata to downloaded files.</p>
    </div>
  );
}
