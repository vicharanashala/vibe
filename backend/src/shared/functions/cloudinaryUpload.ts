import { v2 as cloudinary } from 'cloudinary';
import { appConfig } from '#root/config/app.js';

// Configure Cloudinary inside the function to ensure appConfig is correctly loaded

/**
 * Uploads a buffer (e.g. from multer) to Cloudinary.
 * Returns the secure URL of the uploaded image.
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: string = 'vibe/avatars',
  publicId?: string, // New optional parameter
): Promise<string> {
  // Configure Cloudinary inside the function to ensure appConfig is initialized
  cloudinary.config({
    cloud_name: appConfig.cloudinary.cloudName,
    api_key: appConfig.cloudinary.apiKey,
    api_secret: appConfig.cloudinary.apiSecret,
  });

  if (!appConfig.cloudinary.cloudName || !appConfig.cloudinary.apiKey || !appConfig.cloudinary.apiSecret) {
    throw new Error('Cloudinary configuration is missing. Please check your environment variables.');
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId, // Use userId as filename if provided
        overwrite: true,     // Overwrite if same public_id/folder
        invalidate: true,    // Invalidate CDN cache
        resource_type: 'image',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary Upload Stream Error:', error);
          return reject(error);
        }
        if (!result) {
          return reject(new Error('No result returned from Cloudinary upload.'));
        }
        resolve(result.secure_url);
      },
    );
    uploadStream.end(fileBuffer);
  });
}

/**
 * Deletes an image from Cloudinary using its URL.
 * It extracts the public_id from the URL and calls the Cloudinary API.
 */
export async function deleteFromCloudinary(url: string | undefined): Promise<void> {
  if (!url) return;
  
  // Only attempt to delete if it's a Cloudinary URL
  if (!url.includes('cloudinary.com')) {
    console.log('Skipping deletion: Not a Cloudinary URL:', url);
    return;
  }

  try {
    // Use regex to extract public_id
    // Matches everything after /upload/(v[version]/)? and before the extension
    const regex = /\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/;
    const match = url.match(regex);
    
    if (!match) {
      console.log('[Cloudinary Cleanup] Could not parse public_id from URL:', url);
      return;
    }

    const publicId = match[1];
    console.log('[Cloudinary Cleanup] Final Extracted Public ID:', publicId);

    cloudinary.config({
      cloud_name: appConfig.cloudinary.cloudName,
      api_key: appConfig.cloudinary.apiKey,
      api_secret: appConfig.cloudinary.apiSecret,
    });

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true
    });

    console.log('[Cloudinary Cleanup] Deletion result:', result);
  } catch (error) {
    console.error('[Cloudinary Cleanup] Error during deletion process:', error);
  }
}

export { cloudinary };
