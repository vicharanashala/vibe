import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import {injectable} from 'inversify';
import util from 'util';
import {exec} from 'child_process';
import {InternalServerError} from 'routing-controllers';
import {fileURLToPath} from 'url';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supported languages for transcription
const SUPPORTED_LANGUAGES = ['English', 'Hindi'] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

@injectable()
export class TranscriptionService {
  // Adapted from runWhisperAndGetText, now a private method
  private async runWhisperAndGetTextInternal(
    whisperCommand: string,
    expectedTranscriptFilePath: string,
    // tempTranscriptDir: string, // No longer needed as argument
  ): Promise<string> {
    // The tempTranscriptDir is created by the calling method `transcribe`
    const {stdout, stderr} = await execAsync(whisperCommand); // stdout from whisper CLI might not be useful

    // Whisper CLI can write to stderr for progress/info even on success.
    // The primary check is the existence of the transcript file.
    if (stderr && !fs.existsSync(expectedTranscriptFilePath)) {
      console.error(`Whisper CLI stderr: ${stderr}`);
      // Throw error only if the expected file isn't there and there's stderr
      throw new InternalServerError(`Whisper processing error: ${stderr}`);
    }

    if (!fs.existsSync(expectedTranscriptFilePath)) {
      console.error(
        `Whisper output file not found: ${expectedTranscriptFilePath}. stderr: ${stderr}`,
      );
      throw new InternalServerError(
        `Whisper output file not found. stderr: ${stderr}`,
      );
    }

    const text = await fsp.readFile(expectedTranscriptFilePath, 'utf-8');
    return text.trim();
    // Removed outer try-catch; specific errors are thrown, others will propagate.
  }

  /**
   * Parses VTT format to the desired timestamp format
   * @param vttContent Raw VTT file content
   * @returns Formatted transcript with timestamps
   */
  private parseVttToTimestampFormat(vttContent: string): string {
    const lines = vttContent.split('\n');
    const result: string[] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      // Look for timestamp lines (format: "00:00:00.000 --> 00:00:09.880")
      if (line.includes(' --> ')) {
        const timestampLine = line;
        i++;

        // Get the text content (next non-empty line(s))
        let textContent = '';
        while (i < lines.length && lines[i].trim() !== '') {
          if (textContent) textContent += ' ';
          textContent += lines[i].trim();
          i++;
        }

        if (textContent) {
          // Convert timestamp format from VTT (00:00:00.000) to desired format (00:00.000)
          const convertedTimestamp = timestampLine
            .replace(/(\d{2}):(\d{2}):(\d{2}\.\d{3})/g, '$2:$3')
            .replace(/(\d{2}):(\d{2}):(\d{2}\.\d{3})/g, '$2:$3');

          result.push(`[${convertedTimestamp}]  ${textContent}`);
        }
      }
      i++;
    }

    return result.join('\n');
  }

  /**
   * Validates if the provided language is supported
   * @param language The language to validate
   * @returns boolean indicating if the language is supported
   */
  private isLanguageSupported(language: string): language is SupportedLanguage {
    return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);
  }

  /**
   * Transcribes an audio file using Whisper CLI.
   * @param audioPath Path to the input audio file (WAV format expected).
   * @param language Optional language for transcription. Defaults to 'English'. Supported: 'English', 'Hindi'
   * @returns Promise<string> The transcribed text with timestamps.
   * @throws InternalServerError if transcription fails.
   */
  public async transcribe(audioPath: string, language: string = 'English'): Promise<string> {
    if (!fs.existsSync(audioPath)) {
      throw new InternalServerError(`Input audio file not found: ${audioPath}`);
    }

    // Validate language support
    if (!this.isLanguageSupported(language)) {
      throw new InternalServerError(
        `Unsupported language: ${language}. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`
      );
    }

    const tempTranscriptDir = path.join(__dirname, '..', 'temp_transcripts');

    try {
      // This try is now primarily for the finally block
      await fsp.mkdir(tempTranscriptDir, {recursive: true});
      console.log(
        `Temporary transcript directory created: ${tempTranscriptDir}`,
      );

      // OLD CODE (Windows-style path construction) - kept as reference:
      // const projectRoot = path.resolve(__dirname, '..', '..');
      // const venvScriptsPath = path.join(
      //   projectRoot,
      //   'onnx_generation_env',
      //   'Scripts',
      // );
      // let finalWhisperExecutablePath = path.join(
      //   venvScriptsPath,
      //   'whisper.exe',
      // );
      // if (!fs.existsSync(finalWhisperExecutablePath)) {
      //   // Fallback for different OS or if .exe is not found, try without .exe
      //   const altPath = path.join(venvScriptsPath, 'whisper');
      //   if (!fs.existsSync(altPath)) {
      //     console.error(
      //       `Whisper executable not found at: ${finalWhisperExecutablePath} or ${altPath}`,
      //     );
      //     throw new InternalServerError(
      //       `Whisper executable not found. Checked: ${finalWhisperExecutablePath} and ${altPath}`,
      //     );
      //   }
      //   finalWhisperExecutablePath = altPath;
      // }

      // NEW CODE - Use the system-installed whisper executable
      let finalWhisperExecutablePath = '/home/lab_user/miniconda3/bin/whisper';

      // Fallback to check if whisper is in PATH
      if (!fs.existsSync(finalWhisperExecutablePath)) {
        // Removed try-catch around execAsync, errors will propagate
        const {stdout} = await execAsync('which whisper');
        finalWhisperExecutablePath = stdout.trim();
        console.log(`Found whisper in PATH: ${finalWhisperExecutablePath}`);
        if (!finalWhisperExecutablePath) {
          // Added a check for empty stdout
          throw new InternalServerError(
            'Whisper not found in PATH and not at default location.',
          );
        }
      }

      const audioFileNameWithoutExt = path.basename(
        audioPath,
        path.extname(audioPath),
      );
      const expectedTranscriptFilePath = path.join(
        tempTranscriptDir,
        `${audioFileNameWithoutExt}.vtt`,
      );

      // Use VTT format to get timestamps, and add --verbose=False to reduce stderr output
      const whisperCommand = `"${finalWhisperExecutablePath}" "${audioPath}" --model small --language ${language} --output_format vtt --output_dir "${tempTranscriptDir}" --verbose False`;

      console.log(`Executing Whisper CLI: ${whisperCommand}`);

      const vttContent = await this.runWhisperAndGetTextInternal(
        whisperCommand,
        expectedTranscriptFilePath,
      );

      // Parse VTT content to desired timestamp format
      const formattedTranscript = this.parseVttToTimestampFormat(vttContent);

      console.log('Whisper CLI transcription successful.');
      return formattedTranscript;
    } catch (error: any) {
      // This catch handles errors from the try block above
      console.error(`Error during transcription: ${error.message}`, error);
      if (error instanceof InternalServerError) throw error;
      // Ensure a generic error related to transcription is thrown
      throw new InternalServerError(`Transcription failed: ${error.message}`);
    } finally {
      // Cleanup: Remove the temporary transcript directory and its contents
      if (fs.existsSync(tempTranscriptDir)) {
        try {
          // Keep try-catch for cleanup as it should not hide the primary error
          await fsp.rm(tempTranscriptDir, {recursive: true, force: true});
          console.log(
            `Cleaned up temporary transcript directory: ${tempTranscriptDir}`,
          );
        } catch (cleanupError: any) {
          console.error(
            `Failed to cleanup temporary transcript directory ${tempTranscriptDir}: ${cleanupError.message}`,
          );
          // Not re-throwing here as the main operation might have succeeded or failed already.
        }
      }
      // The input audioPath should be cleaned up by the AudioService or the orchestrating controller,
      // as TranscriptionService might not know if it's a temporary file or not.
      // However, the problem description implies AudioService's output is what's fed here.
      // And AudioService cleans its *input* (the video file).
      // The output of AudioService (the WAV file) might be temporary too.
      // For now, this service only cleans its *own* temp files (transcript files).
    }
  }
}
