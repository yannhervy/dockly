// Script to set CORS configuration on Firebase Storage bucket
// Uses firebase-admin which is already available

const { initializeApp, cert } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");

// Initialize with application default credentials
// This requires `gcloud auth application-default login` or a service account key
// Alternative: use the Google Cloud Console to set CORS

const corsConfig = [
  {
    origin: [
      "http://localhost:3000",
      "https://stegerholmenshamn.web.app",
      "https://stegerholmenshamn.firebaseapp.com",
    ],
    method: ["GET", "POST", "PUT", "DELETE", "HEAD"],
    maxAgeSeconds: 3600,
    responseHeader: [
      "Content-Type",
      "Authorization",
      "Content-Length",
      "X-Requested-With",
    ],
  },
];

async function setCors() {
  try {
    // Use the @google-cloud/storage package directly
    const { Storage } = require("@google-cloud/storage");
    const storage = new Storage();
    const bucket = storage.bucket("stegerholmenshamn.firebasestorage.app");
    await bucket.setCorsConfiguration(corsConfig);
    console.log("CORS configuration set successfully!");
  } catch (err) {
    console.error("Error setting CORS:", err.message);
    console.log("\n--- ALTERNATIVE: Set CORS manually ---");
    console.log("1. Go to: https://console.cloud.google.com/storage/browser/stegerholmenshamn.firebasestorage.app");
    console.log("2. Or install Google Cloud SDK: https://cloud.google.com/sdk/docs/install");
    console.log("3. Run: gsutil cors set cors.json gs://stegerholmenshamn.firebasestorage.app");
  }
}

setCors();
