#!/usr/bin/env node

/** Quick check: worker crypto.ts verifyPassword against remote D1 hash */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { runWrangler, sqlString } from "./password-utils.mjs";

// Import compiled logic by duplicating fromBase64Url + pbkdf2 from crypto.ts path
import { pbkdf2Sync } from "node:crypto";

const email = process.argv[2];
const password = process.argv[3];
const remote = process.argv.includes("--remote");

function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLength);
  const binary = Buffer.from(base64, "base64");
  return new Uint8Array(binary);
}

function fromBase64UrlAtob(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLength);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function verifyPassword(password, stored, fromB64) {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
    const iterations = Number(parts[1]);
    const salt = fromB64(parts[2]);
    const expectedHash = fromB64(parts[3]);
    const actualHash = new Uint8Array(pbkdf2Sync(password, salt, iterations, 32, "sha256"));
    if (expectedHash.length !== actualHash.length) return false;
    let mismatch = 0;
    for (let index = 0; index < expectedHash.length; index += 1) {
      mismatch |= expectedHash[index] ^ actualHash[index];
    }
    return mismatch === 0;
  } catch (e) {
    console.error("verify error:", e);
    return false;
  }
}

const output = runWrangler(
  `SELECT email, password_hash FROM users WHERE email = ${sqlString(email)}`,
  remote,
);
const hashMatch = output.match(/"password_hash"\s*:\s*"([^"]+)"/);
if (!hashMatch) {
  console.error("User not found");
  process.exit(1);
}
const stored = hashMatch[1];
console.log("Buffer decode verify:", await verifyPassword(password, stored, fromBase64Url));
console.log("atob decode verify:", await verifyPassword(password, stored, fromBase64UrlAtob));
