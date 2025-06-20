import * as fs from 'fs';
import {promises as fsp} from 'fs';
import {InternalServerError} from 'routing-controllers';

const performCleanup = async (
  processedAudioPath,
  ytdlpOutputPath,
  tempTranscriptDir,
  filePath,
) => {
  const cleanupTasks: Promise<void>[] = [];

  if (processedAudioPath && fs.existsSync(processedAudioPath)) {
    cleanupTasks.push(
      fsp
        .unlink(processedAudioPath)
        .then(() =>
          console.log('Cleaned up processed audio:', processedAudioPath),
        )
        .catch((delErr: any) =>
          console.error('Error deleting processed audio:', delErr),
        ),
    );
  }

  if (ytdlpOutputPath && fs.existsSync(ytdlpOutputPath)) {
    cleanupTasks.push(
      fsp
        .unlink(ytdlpOutputPath)
        .then(() =>
          console.log('Cleaned up ytdlp temp audio:', ytdlpOutputPath),
        )
        .catch((delErr: any) =>
          console.error('Error deleting ytdlp temp audio:', delErr),
        ),
    );
  }

  if (tempTranscriptDir && fs.existsSync(tempTranscriptDir)) {
    cleanupTasks.push(
      fsp
        .rm(tempTranscriptDir, {recursive: true, force: true})
        .catch((rmDirError: any) => {
          throw new InternalServerError(
            `Error deleting temp transcript directory: ${rmDirError}`,
          );
        }),
    );
  }

  if (filePath && fs.existsSync(filePath)) {
    cleanupTasks.push(
      fsp.unlink(filePath).catch((pdfDelErr: any) => {
        throw new InternalServerError(
          `Error deleting uploaded PDF file: ${pdfDelErr}`,
        );
      }),
    );
  }

  await Promise.allSettled(cleanupTasks);
};
export {performCleanup};
