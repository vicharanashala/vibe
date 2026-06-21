/**
 * Returns `url` only if it is a locally-generated image preview — a
 * `data:image/*` URL (canvas.toDataURL) or a `blob:` URL (URL.createObjectURL).
 * Anything else collapses to "" so it can never be reinterpreted as HTML or an
 * unexpected scheme. Defense-in-depth; also clears CodeQL js/xss-through-dom on
 * `<img src={...}>` photo previews.
 */
export function safeImagePreviewSrc(url: string | null | undefined): string {
  if (typeof url === "string" && (url.startsWith("data:image/") || url.startsWith("blob:"))) {
    return url;
  }
  return "";
}
