import {
  IWatchTime,
  IVideoDetails,
  IBlogDetails,
} from '#root/shared/interfaces/models.js';

// Pure form of ProgressService.isValidWatchTime, extracted so it can be
// unit-tested without bootstrapping the DI container. Behaviour matches
// the original verbatim, including throwing on malformed time strings.

function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  throw new Error('Invalid time format');
}

export function isValidWatchTime(
  watchTime: IWatchTime,
  item: { type: string; details: IVideoDetails | IBlogDetails | null | undefined },
): boolean {
  if (!watchTime.startTime || !watchTime.endTime || !item.details) return false;

  const serverDuration =
    Math.abs(
      new Date(watchTime.endTime).getTime() -
        new Date(watchTime.startTime).getTime(),
    ) / 1000;
  const adjustedDuration = serverDuration + 5;

  switch (item.type) {
    case 'VIDEO': {
      const v = item.details as IVideoDetails;
      if (!v.startTime || !v.endTime) return false;
      const total = parseTimeToSeconds(v.endTime) - parseTimeToSeconds(v.startTime);
      const minimumRequired = Math.min(total * 0.15, 30);
      const maxAllowed = total * 3 + 60;
      if (serverDuration > maxAllowed) return false;
      return adjustedDuration >= minimumRequired;
    }
    case 'BLOG': {
      const b = item.details as IBlogDetails;
      const readSec = (b.estimatedReadTimeInMinutes || 1) * 60;
      const minReadTime = Math.min(readSec * 0.1, 10);
      const maxAllowed = readSec * 5 + 60;
      if (serverDuration > maxAllowed) return false;
      return adjustedDuration >= minReadTime;
    }
    default:
      return true;
  }
}
