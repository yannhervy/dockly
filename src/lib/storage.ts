import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Upload a boat image to Firebase Storage and return the download URL.
 * Images are stored at `boat-images/{resourceId}/{filename}`.
 */
export async function uploadBoatImage(
  file: File,
  resourceId: string
): Promise<string> {
  const storageRef = ref(storage, `boat-images/${resourceId}/${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}
