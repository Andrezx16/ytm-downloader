import { useMutation } from "@tanstack/react-query";
import { download } from "@/api";
import type { DownloadRequest } from "@/api/download";
import type { ApiError } from "@/api/errors";

export function useDownload() {
  const mutation = useMutation({
    mutationFn: (params: DownloadRequest) => download(params),
  });

  return {
    download: mutation.mutate,
    result: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error as ApiError | null,
    reset: mutation.reset,
  };
}
