import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import {execFile} from 'child_process';
import {promisify} from 'util';
import {Service} from 'typedi';
import {InternalServerError} from 'routing-controllers';

const execFileAsync = promisify(execFile);

@Service()
export class VideoService {
  public async downloadVideo(youtubeUrl: string): Promise<string> {
    try {
      const videoId = new URL(youtubeUrl).searchParams.get('v');
      if (!videoId) {
        throw new InternalServerError('Invalid YouTube URL: Missing video ID');
      }

      // Use a more flexible output path that allows yt-dlp to choose the extension
      const outputTemplate = path.join(
        __dirname,
        '..',
        'videos',
        `${videoId}.%(ext)s`,
      );

      // Ensure the videos directory exists
      const videosDirPath = path.dirname(outputTemplate);
      if (!fs.existsSync(videosDirPath)) {
        await fsp.mkdir(videosDirPath, {recursive: true});
      }

      // More robust format selection for HLS streams and separated video/audio
      // This handles the case where only separated streams are available
      const formatSelector = 'bv*[height<=720]+ba/bv*+ba/best';

      // Arguments for yt-dlp with HLS support
      const args = [
        '-f',
        formatSelector,
        '--merge-output-format',
        'mp4',
        '--no-playlist',
        '--hls-prefer-ffmpeg',
        '-o',
        outputTemplate,
        youtubeUrl,
      ];

      console.log('Executing yt-dlp with args:', args);

      // Execute the command using execFile
      const {stdout, stderr} = await execFileAsync('yt-dlp', args);

      // Log output for debugging
      if (stdout) {
        console.log(`yt-dlp stdout: ${stdout}`);
      }
      if (stderr) {
        console.log(`yt-dlp stderr: ${stderr}`);
      }

      // Find the actual downloaded file (since extension might vary)
      const files = await fsp.readdir(videosDirPath);
      const downloadedFile = files.find(file => file.startsWith(videoId));

      if (!downloadedFile) {
        console.error(
          `yt-dlp completed but no file found. Video ID: ${videoId}. Files in directory: ${files.join(', ')}`,
        );
        throw new InternalServerError(
          'Failed to download video: Output file not found after yt-dlp execution',
        );
      }

      const finalPath = path.join(videosDirPath, downloadedFile);
      console.log(`Video downloaded successfully to ${finalPath}`);
      return finalPath;
    } catch (error: any) {
      console.error('Error downloading video:', error);

      if (error instanceof InternalServerError) {
        throw error;
      }

      // Provide more detailed error information
      const errorMessage =
        error.message || 'Unknown error occurred during video download';
      throw new InternalServerError(
        `Failed to download video: ${errorMessage}`,
      );
    }
  }
}
