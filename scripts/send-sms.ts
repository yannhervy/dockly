/**
 * Test script for SMS service.
 *
 * Usage:
 *   npx tsx scripts/send-sms.ts "+46701234567" "Hello from Dockly!"
 *
 * Or dry-run (no actual SMS sent):
 *   npx tsx scripts/send-sms.ts --dry-run "+46701234567" "Test message"
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { sendSms, normalizePhoneNumber } from "./sms-service";

// Load .env.local from project root
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filtered = args.filter((a) => a !== "--dry-run");

  if (filtered.length < 2) {
    console.log("Usage: npx tsx scripts/send-sms.ts [--dry-run] <phone> <message>");
    console.log("");
    console.log("Examples:");
    console.log('  npx tsx scripts/send-sms.ts "+46701234567" "Hello!"');
    console.log('  npx tsx scripts/send-sms.ts --dry-run "0701234567" "Test"');
    process.exit(1);
  }

  const [phone, ...messageParts] = filtered;
  const message = messageParts.join(" ");
  const normalized = normalizePhoneNumber(phone);

  console.log(`📱 To:      ${normalized}`);
  console.log(`📝 Message: ${message}`);
  console.log(`📤 Sender:  Hamnen`);

  if (dryRun) {
    console.log("\n🔸 DRY RUN – no SMS was sent.");
    return;
  }

  console.log("\nSending...");
  const result = await sendSms(normalized, message);

  if (result.success) {
    console.log(`✅ SMS sent! ID: ${result.id}`);
  } else {
    console.error(`❌ Failed: ${result.error}`);
    process.exit(1);
  }
}

main();
