/**
 * Cloudinary — video upload and 9:16 vertical reframing.
 *
 * The `cloudinary` SDK auto-configures itself from the CLOUDINARY_URL
 * environment variable (format: cloudinary://key:secret@cloud_name).
 */

import { v2 as cloudinary } from "cloudinary";

export type UploadResult = {
  publicId: string;
  originalUrl: string;
  reframedUrl: string;
  format: string;
  duration: number;
  bytes: number;
};

/**
 * Upload a video from a public URL and eagerly generate a 1080×1920
 * (9:16 portrait) rendition suitable for Instagram Reels.
 */
export async function uploadAndReframe(
  videoUrl: string,
): Promise<UploadResult> {
  if (!process.env.CLOUDINARY_URL) {
    throw new Error("CLOUDINARY_URL is not configured.");
  }

  const result = await cloudinary.uploader.upload(videoUrl, {
    resource_type: "video",
    folder: "insta-auto/reels",
    eager: [
      {
        width: 1080,
        height: 1920,
        crop: "fill",
        gravity: "auto",
        format: "mp4",
      },
    ],
    eager_async: false,
  });

  // Build a stable HTTPS URL for the 9:16 rendition.
  const reframedUrl = cloudinary.url(result.public_id, {
    resource_type: "video",
    secure: true,
    transformation: [
      {
        width: 1080,
        height: 1920,
        crop: "fill",
        gravity: "auto",
        format: "mp4",
      },
    ],
  });

  return {
    publicId: result.public_id,
    originalUrl: result.secure_url,
    reframedUrl,
    format: "1080×1920",
    duration: Math.round(result.duration ?? 0),
    bytes: result.bytes ?? 0,
  };
}
