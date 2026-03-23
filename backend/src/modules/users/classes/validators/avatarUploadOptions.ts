import multer from "multer";
import { BadRequestError } from "routing-controllers";

export const avatarUploadOptions: multer.Options = {
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }, // max 1 mb for avatar
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new BadRequestError("Only image files are allowed"));
    }
  },
};
