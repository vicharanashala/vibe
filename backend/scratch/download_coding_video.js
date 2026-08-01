import https from 'https';
import fs from 'fs';
import path from 'path';

const url = 'https://assets.mixkit.co/videos/preview/mixkit-computer-screen-with-running-code-34279-large.mp4';
const dest = path.join(process.cwd(), '../frontend/public/videos/coding_lecture.mp4');

console.log('Downloading coding video from:', url);
console.log('Saving to:', dest);

const file = fs.createWriteStream(dest);

const reqOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
};

https.get(url, reqOptions, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download: Status Code ${response.statusCode}`);
    return;
  }
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Download completed successfully!');
  });
}).on('error', (err) => {
  fs.unlink(dest, () => {});
  console.error('Error downloading file:', err.message);
});
