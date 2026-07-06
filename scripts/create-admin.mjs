import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import {
  hashPassword,
  runWrangler,
  sqlString,
} from "./password-utils.mjs";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
    name: { type: "string", default: "Admin User" },
    remote: { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  },
});

const email = (values.email ?? process.env.ADMIN_EMAIL)?.trim().toLowerCase();
const password = values.password ?? process.env.ADMIN_PASSWORD;
const name = values.name ?? process.env.ADMIN_NAME ?? "Admin User";
const remote = values.remote ?? false;
const force = values.force ?? false;

if (!email || !password) {
  console.error("Usage: npm run user:create-admin -- --email you@example.com --password 'secret'");
  console.error("Or set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.");
  process.exit(1);
}

if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

try {
  const countOutput = runWrangler("SELECT COUNT(*) AS count FROM users", remote);
  const countMatch = countOutput.match(/"count"\s*:\s*(\d+)/);
  const userCount = countMatch ? Number(countMatch[1]) : 0;

  if (userCount > 0 && !force) {
    console.error("Users already exist. Refusing to create another admin.");
    console.error("Pass --force if you really want to add another admin user.");
    process.exit(1);
  }

  const existing = runWrangler(`SELECT id FROM users WHERE email = ${sqlString(email)}`, remote);
  if (existing.includes('"id"') && !force) {
    console.error(`User ${email} already exists.`);
    process.exit(1);
  }

  const userId = `usr_${randomUUID().replace(/-/g, "")}`;
  const passwordHash = await hashPassword(password);

  runWrangler(
    `INSERT INTO users (id, email, password_hash, name, role) VALUES (${sqlString(userId)}, ${sqlString(email)}, ${sqlString(passwordHash)}, ${sqlString(name)}, 'admin')`,
    remote,
  );

  runWrangler(
    `INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (${sqlString(userId)}, 'role_admin')`,
    remote,
  );

  console.log(`Admin user created: ${email}`);
  console.log(`User id: ${userId}`);
  console.log(`Target: ${remote ? "remote D1" : "local D1"}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
