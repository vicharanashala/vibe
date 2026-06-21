/**
 * Returns `url` only if it is a locally-generated image preview — a
 * `data:image/*` URL (canvas.toDataURL) or a `blob:` URL (URL.createObjectURL).
 * Anything else collapses to "" so it can never be reinterpreted as HTML or an
 * unexpected scheme. Defense-in-depth; also clears CodeQL js/xss-through-dom on
 * `<img src={...}>` photo previews.
 */
export function safeImagePreviewSrc(url: string | null | undefined): string {
  if (typeof url !== "string" || url.trim() === "") return "";

  try {
    const parsed = new URL(url, window.location.origin);

    // Object URLs created by URL.createObjectURL(file)
    if (parsed.protocol === "blob:") {
      return url;
    }

    // Data URLs from canvas.toDataURL("image/jpeg", ...)
    if (parsed.protocol === "data:") {
      const commaIndex = url.indexOf(",");
      if (commaIndex <= 5) return "";
      const metadata = url.slice(5, commaIndex).toLowerCase(); // strip "data:"
      const mimeType = metadata.split(";")[0].trim();
      if (mimeType.startsWith("image/")) {
        return url;
      }
    }
  } catch {
    return "";
  }

  return "";
}
