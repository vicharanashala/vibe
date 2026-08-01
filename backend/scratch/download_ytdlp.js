import youtubedl from 'youtube-dl-exec';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const targetUrl = 'https://www.youtube.com/watch?v=94BdnDVHrP0';
  const outputDir = path.join(__dirname, '..', '..', 'frontend', 'public', 'videos');
  const outputPath = path.join(outputDir, 'lecture.mp4');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Downloading video via yt-dlp...');
  try {
    await youtubedl(targetUrl, {
      format: '18', // 360p mp4
      output: outputPath,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificates: true,
    });
    console.log('✅ Video downloaded successfully!');
  } catch (err) {
    console.error('❌ Failed to download video:', err);
  }
}

main();
