const YT_URL_RE =
  /^https?:\/\/(?:www\.)?(?:music\.)?youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|v\/)|^https?:\/\/youtu\.be\//i;

export function isYouTubeUrl(input: string): boolean {
  return YT_URL_RE.test(input.trim());
}
