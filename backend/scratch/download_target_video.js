import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const targetUrl = 'https://www.youtube.com/watch?v=94BdnDVHrP0';
  const outputDir = path.join(__dirname, '..', '..', 'frontend', 'public', 'videos');
  const outputPath = path.join(outputDir, 'lecture.mp4');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Starting dynamic ytdl download for iNotebook course: ${targetUrl}...`);
  console.log(`Saving directly to local public video asset path: ${outputPath}`);

  const writeStream = fs.createWriteStream(outputPath);

  // Download 360p muxed stream format (contains both video and audio)
  ytdl(targetUrl, { 
    quality: '18' // Format 18 is 360p mp4 muxed (contains audio and video)
  })
  .pipe(writeStream)
  .on('finish', () => {
    console.log('✅ iNotebook video download complete! Saved as local public asset lecture.mp4.');
    process.exit(0);
  })
  .on('error', (err) => {
    console.error('❌ Failed to download YouTube video stream:', err);
    process.exit(1);
  });
}

main().catch(console.error);
