import multer from "multer";
import { BadRequestError } from "routing-controllers";
export const mediaUploadOptions: multer.Options = {
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, //  max 20 mb
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new BadRequestError("Only image and audio files are allowed"));
    }
  },
};
