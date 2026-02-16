import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.8;

/**
 * Resize an image file so neither width nor height exceeds MAX_DIMENSION.
 * Returns a compressed JPEG Blob.
 */
function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Only resize if the image exceeds the max dimension
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload a boat image to Firebase Storage and return the download URL.
 * Images are automatically resized to max 1200px and compressed as JPEG.
 * Stored at `boat-images/{resourceId}/{filename}`.
 */
export async function uploadBoatImage(
  file: File,
  resourceId: string
): Promise<string> {
  // Resize and compress the image before uploading
  const resizedBlob = await resizeImage(file);

  // Use .jpg extension since we convert to JPEG
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const fileName = `${baseName}.jpg`;

  const storageRef = ref(storage, `boat-images/${resourceId}/${fileName}`);
  const snapshot = await uploadBytes(storageRef, resizedBlob, {
    contentType: "image/jpeg",
  });
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}
