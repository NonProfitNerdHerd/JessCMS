import { execSync } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";

export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;

function toBase64Url(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, "sha256");

  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function runWrangler(command, remote) {
  const flag = remote ? "--remote" : "--local";
  return execSync(
    `npx wrangler d1 execute jesscms-db ${flag} --command ${JSON.stringify(command)}`,
    {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    },
  );
}

export function listUsers(remote) {
  const output = runWrangler(
    "SELECT id, email, name, role FROM users ORDER BY email",
    remote,
  );
  const users = [];
  const pattern = /"email"\s*:\s*"([^"]+)"/g;
  let match = pattern.exec(output);
  while (match) {
    users.push(match[1]);
    match = pattern.exec(output);
  }
  return { output, emails: users };
}
