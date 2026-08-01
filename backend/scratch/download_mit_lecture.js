import https from 'https';
import fs from 'fs';
import path from 'path';

// MIT Introduction to Computer Science and Programming in Python Lecture 1 (approx 68MB total, we'll download it)
const url = 'https://archive.org/download/MIT6.00S11/MIT6_0001F16_L01_512kb.mp4';
const dest = path.join(process.cwd(), '../frontend/public/videos/coding_lecture.mp4');

console.log('Downloading MIT CS lecture video from:', url);
console.log('Saving to:', dest);

const file = fs.createWriteStream(dest);

const reqOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
};

https.get(url, reqOptions, (response) => {
  if (response.statusCode === 302 || response.statusCode === 301) {
    const redirectUrl = response.headers.location;
    console.log('Following redirect to:', redirectUrl);
    https.get(redirectUrl, reqOptions, (res2) => {
      res2.pipe(file);
    });
  } else if (response.statusCode === 200) {
    response.pipe(file);
  } else {
    console.error(`Failed to download: Status Code ${response.statusCode}`);
  }

  file.on('finish', () => {
    file.close();
    console.log('Download completed successfully!');
  });
}).on('error', (err) => {
  fs.unlink(dest, () => {});
  console.error('Error downloading file:', err.message);
});
