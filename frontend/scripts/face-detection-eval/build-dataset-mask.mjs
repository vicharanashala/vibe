// Fetches the "mask" edge-case slice of the labeled test set: single-face
// crops of people wearing a face mask, sourced from a public HF-hosted
// mirror of the Kaggle "Face Mask 12K Images" dataset. WIDER FACE predates
// widespread mask-wearing so it has no mask examples of its own.
//
// These are tightly-cropped face-only images (not full webcam-style scenes)
// — the closest available real, individually-fetchable, ground-truthed mask
// data. That trade-off is called out explicitly in REPORT.md.
//
// Source: https://huggingface.co/datasets/DamarJati/Face-Mask-Detection
//         (mirror of https://www.kaggle.com/datasets/ashishjangra27/face-mask-12k-images-dataset)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMES_DIR = path.join(__dirname, "frames");
const TARGET_COUNT = 20;
const MIN_SIDE_PX = 80; // skip thumbnail-sized crops too small to meaningfully test detection on

const DATASET = "DamarJati/Face-Mask-Detection";

async function fetchPage(offset, length) {
  const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(DATASET)}&config=default&split=train&offset=${offset}&length=${length}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HF datasets-server error ${res.status}`);
  return res.json();
}

async function main() {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  const rows = [];
  let offset = 0;
  const pageSize = 100;
  while (rows.length < TARGET_COUNT && offset < 2000) {
    const page = await fetchPage(offset, pageSize);
    for (const r of page.rows) {
      if (r.row.label !== 0) continue; // 0 = WithMask
      if (r.row.image.width < MIN_SIDE_PX || r.row.image.height < MIN_SIDE_PX) continue;
      rows.push(r);
      if (rows.length >= TARGET_COUNT) break;
    }
    offset += pageSize;
  }

  console.log(`Selected ${rows.length} WithMask frames (>= ${MIN_SIDE_PX}px)`);

  const labelRows = [];
  let seq = 1;
  for (const r of rows) {
    const imgRes = await fetch(r.row.image.src);
    if (!imgRes.ok) {
      console.warn(`  skip row ${r.row_idx}: download failed (${imgRes.status})`);
      continue;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const frameId = `mask_${String(seq).padStart(4, "0")}.jpg`;
    seq++;
    fs.writeFileSync(path.join(FRAMES_DIR, frameId), buf);
    labelRows.push({
      frame_id: frameId,
      ground_truth_face_count: 1,
      condition_tags: "mask",
      source_dataset: "DamarJati/Face-Mask-Detection (Kaggle face-mask-12k-images-dataset)",
      source_image: `row_${r.row_idx}`,
      license: "see-source-dataset",
    });
  }

  fs.writeFileSync(
    path.join(__dirname, "mask-selection.json"),
    JSON.stringify(labelRows, null, 2),
  );
  console.log(`Wrote ${labelRows.length} mask frames`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
