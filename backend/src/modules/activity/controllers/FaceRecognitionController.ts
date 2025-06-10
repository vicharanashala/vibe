import 'reflect-metadata';
import {
  JsonController,
  Get,
  Post,
  Param,
  UploadedFile,
  HttpCode,
  BadRequestError,
} from 'routing-controllers';
import {injectable, inject} from 'inversify';
import {FaceRecognitionService} from '../services/FaceRecognitionService.js';
import TYPES from '../types.js';
import {
  KnownFacesResponse,
  UploadFaceResponse,
  AddPersonResponse,
} from '../classes/validators/FaceRecognitionValidators.js';

/**
 * Face Recognition Controller
 *
 * Endpoints:
 * 1. GET /api/activity/known-faces
 *    - Returns list of all known faces with their image paths
 *
 * 2. POST /api/activity/known-faces/:personName
 *    - Creates a new person directory in Cloud Storage
 *
 * 3. POST /api/activity/known-faces/:personName/upload
 *    - Uploads a face image for a person to Cloud Storage
 *    - Supported formats: jpg, jpeg, png
 */
@JsonController('/activity')
@injectable()
export class FaceRecognitionController {
  constructor(
    @inject(TYPES.FaceRecognitionService)
    private readonly faceRecognitionService: FaceRecognitionService,
  ) {}

  @Get('/known-faces/check-connection')
  @HttpCode(200)
  async checkGCSConnection(): Promise<{status: string; message: string}> {
    try {
      const result = await this.faceRecognitionService.verifyGCSConnection();
      return {
        status: result.success ? 'connected' : 'error',
        message: result.message,
      };
    } catch (error) {
      console.error('Error checking GCS connection:', error);
      return {
        status: 'error',
        message: `Error checking connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  @Get('/known-faces')
  @HttpCode(200)
  async getKnownFaces(): Promise<KnownFacesResponse> {
    const faces = await this.faceRecognitionService.getKnownFaces();
    return {faces};
  }
  @Post('/known-faces/:personName/upload')
  @HttpCode(201)
  async uploadFace(
    @Param('personName') personName: string,
    @UploadedFile('image', {required: true}) file: Express.Multer.File,
  ): Promise<UploadFaceResponse> {
    try {
      // Thorough file validation
      if (!file) {
        throw new BadRequestError('No file uploaded');
      }

      if (!file.buffer || file.buffer.length === 0) {
        throw new BadRequestError('Uploaded file is empty');
      }

      if (!file.mimetype) {
        throw new BadRequestError('File mimetype is missing');
      }

      // Add detailed logging to help troubleshoot
      console.log('Received file upload request:', {
        personName,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.buffer.length,
        fileInfo: file.mimetype ? 'Valid mimetype' : 'Invalid mimetype',
      });

      if (!file.mimetype.match(/^image\/(jpg|jpeg|png)$/)) {
        throw new BadRequestError(
          `Only .jpg, .jpeg and .png files are allowed! Received: ${file.mimetype}`,
        );
      }

      // Before uploading, check the GCS connection
      const connectionStatus =
        await this.faceRecognitionService.verifyGCSConnection();
      if (!connectionStatus.success) {
        throw new BadRequestError(`Cannot upload: ${connectionStatus.message}`);
      }

      const result = await this.faceRecognitionService.uploadFaceImage(
        personName,
        file,
      );
      return {
        message: 'Face image uploaded successfully',
        path: result.path,
        details: {
          personName,
          filename: file.originalname,
          filesize: file.buffer.length,
          mimetype: file.mimetype,
        },
      };
    } catch (error) {
      console.error('Error in uploadFace:', error);
      if (error instanceof BadRequestError) {
        throw error;
      } else if (error instanceof Error) {
        throw new BadRequestError(
          `Failed to upload face image: ${error.message}`,
        );
      } else {
        throw new BadRequestError('Failed to upload face image: Unknown error');
      }
    }
  }

  @Post('/known-faces/:personName')
  @HttpCode(201)
  async addPerson(
    @Param('personName') personName: string,
  ): Promise<AddPersonResponse> {
    try {
      const result = await this.faceRecognitionService.addNewPerson(personName);
      return {message: 'Person added successfully', path: result.path};
    } catch (error) {
      console.error('Error in addPerson:', error);
      if (error instanceof BadRequestError) {
        throw error;
      } else if (error instanceof Error) {
        throw new BadRequestError(`Failed to add person: ${error.message}`);
      } else {
        throw new BadRequestError('Failed to add person: Unknown error');
      }
    }
  }
}
