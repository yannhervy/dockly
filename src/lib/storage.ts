import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Delete a file from Firebase Storage given its download URL.
 * Extracts the storage path from the Firebase download URL and deletes the object.
 */
export async function deleteStorageFile(downloadUrl: string): Promise<void> {
  if (!downloadUrl) return;
  try {
    // Firebase download URLs: .../o/path%2Fto%2Ffile.jpg?alt=media&token=...
    const url = new URL(downloadUrl);
    const pathSegment = url.pathname.split("/o/")[1];
    if (!pathSegment) {
      console.warn("deleteStorageFile: could not parse path from URL:", downloadUrl);
      return;
    }
    const storagePath = decodeURIComponent(pathSegment);
    const fileRef = ref(storage, storagePath);
    await deleteObject(fileRef);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    // object-not-found means already deleted — safe to ignore
    if (code === "storage/object-not-found") return;
    console.error("Failed to delete storage file:", downloadUrl, err);
  }
}

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.8;

/**
 * Resize an image file so neither width nor height exceeds MAX_DIMENSION.
 * Preserves PNG format for transparent images; others get JPEG compression.
 */
export function resizeImage(file: File, maxDimension = MAX_DIMENSION): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Only resize if the image exceeds the max dimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
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

      // Preserve PNG for formats that support transparency
      const transparentTypes = ["image/png", "image/webp", "image/gif"];
      const isTransparent = transparentTypes.includes(file.type);
      const outputType = isTransparent ? "image/png" : "image/jpeg";
      const quality = isTransparent ? undefined : JPEG_QUALITY;

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        outputType,
        quality
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

/**
 * Upload a dock image to Firebase Storage and return the download URL.
 * Images are resized to max 1200px and compressed as JPEG.
 * Stored at `dock-images/{dockId}/{filename}`.
 */
export async function uploadDockImage(
  file: File,
  dockId: string
): Promise<string> {
  const resizedBlob = await resizeImage(file);
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const fileName = `${baseName}.jpg`;
  const storageRef = ref(storage, `dock-images/${dockId}/${fileName}`);
  const snapshot = await uploadBytes(storageRef, resizedBlob, {
    contentType: "image/jpeg",
  });
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}

/**
 * Upload a profile image to Firebase Storage and return the download URL.
 * Images are resized to max 1200px and compressed as JPEG.
 * Stored at `profile-images/{userId}/profile.jpg`.
 */
export async function uploadProfileImage(
  file: File,
  userId: string
): Promise<string> {
  const resizedBlob = await resizeImage(file);
  const storageRef = ref(storage, `profile-images/${userId}/profile.jpg`);
  const snapshot = await uploadBytes(storageRef, resizedBlob, {
    contentType: "image/jpeg",
  });
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}

/**
 * Upload a land storage image to Firebase Storage and return the download URL.
 * Images are resized to max 1200px and compressed as JPEG.
 * Stored at `land-storage-images/{entryId}/{filename}`.
 */
export async function uploadLandStorageImage(
  file: File,
  entryId: string
): Promise<string> {
  const resizedBlob = await resizeImage(file);
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const fileName = `${baseName}.jpg`;
  const storageRef = ref(storage, `land-storage-images/${entryId}/${fileName}`);
  const snapshot = await uploadBytes(storageRef, resizedBlob, {
    contentType: "image/jpeg",
  });
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}

/**
 * Upload an abandoned object image to Firebase Storage and return the download URL.
 * Images are resized to max 1200px and compressed as JPEG.
 * Stored at `abandoned-object-images/{entryId}/{filename}`.
 */
export async function uploadAbandonedObjectImage(
  file: File,
  entryId: string
): Promise<string> {
  const resizedBlob = await resizeImage(file);
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const fileName = `${baseName}.jpg`;
  const storageRef = ref(storage, `abandoned-object-images/${entryId}/${fileName}`);
  const snapshot = await uploadBytes(storageRef, resizedBlob, {
    contentType: "image/jpeg",
  });
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}

/**
 * Upload a POI image to Firebase Storage.
 * Path: poi-images/{poiId}/{fileName}
 */
export async function uploadPOIImage(
  file: File,
  poiId: string
): Promise<string> {
  const resizedBlob = await resizeImage(file);
  const isTransparent = ["image/png", "image/webp", "image/gif"].includes(file.type);
  const ext = isTransparent ? "png" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const fileName = `${baseName}.${ext}`;
  const storageRef = ref(storage, `poi-images/${poiId}/${fileName}`);
  const snapshot = await uploadBytes(storageRef, resizedBlob, {
    contentType: resizedBlob.type || "image/jpeg",
  });
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}
