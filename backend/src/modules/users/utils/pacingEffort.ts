import { Item } from '#courses/classes/transformers/Item.js';
import { IVideoDetails, IQuizDetails, IBlogDetails } from '#root/shared/interfaces/models.js';

function parseHHMMSSToMinutes(time: string): number {
  const parts = time.split(':').map(p => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return 0;
  const [hh, mm, ss] = parts;
  return Math.round(hh * 60 + mm + ss / 60);
}

export function getItemEffortMinutes(item: Item): number {
  try {
    const details = item.details as any;
    if (!details) return 10;
    switch (item.type) {
      case 'VIDEO': {
        const videoDetails = details as IVideoDetails;
        if (videoDetails.startTime && videoDetails.endTime) {
          const minutes = parseHHMMSSToMinutes(videoDetails.endTime) - parseHHMMSSToMinutes(videoDetails.startTime);
          return minutes > 0 ? minutes : 10;
        }
        return 10;
      }
      case 'QUIZ': {
        const quizDetails = details as IQuizDetails;
        if (quizDetails.approximateTimeToComplete) {
          const minutes = parseHHMMSSToMinutes(quizDetails.approximateTimeToComplete);
          return minutes > 0 ? minutes : 10;
        }
        return 10;
      }
      case 'BLOG': {
        const blogDetails = details as IBlogDetails;
        if (typeof blogDetails.estimatedReadTimeInMinutes === 'number') {
          return Math.round(blogDetails.estimatedReadTimeInMinutes);
        }
        return 10;
      }
      default:
        return 10;
    }
  } catch (_) {
    return 10;
  }
}
