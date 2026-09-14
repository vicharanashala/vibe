import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".wasm": "application/wasm",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".tflite": "application/octet-stream",
  ".html": "text/html",
};

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(res);
}

// Serves the eval dataset + the app's real self-hosted mediapipe assets +
// the tasks-vision bundle straight out of frontend/node_modules, so a
// headless browser page can run the *identical* detector code path
// production does (see run-eval.mjs for why this matters).
export function startEvalServer({ framesDir, mediapipeAssetsDir, tasksVisionBundle }) {
  const server = http.createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<!doctype html><title>face-detection-eval</title>");
    } else if (pathname.startsWith("/frames/")) {
      serveFile(res, path.join(framesDir, decodeURIComponent(pathname.slice(8))));
    } else if (pathname.startsWith("/mediapipe/")) {
      serveFile(res, path.join(mediapipeAssetsDir, decodeURIComponent(pathname.slice(11))));
    } else if (pathname === "/tasks-vision/vision_bundle.mjs") {
      serveFile(res, tasksVisionBundle);
    } else {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}
