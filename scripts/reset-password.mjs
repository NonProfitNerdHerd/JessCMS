#!/usr/bin/env node

import { parseArgs } from "node:util";
import {
  hashPassword,
  listUsers,
  runWrangler,
  sqlString,
} from "./password-utils.mjs";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
    remote: { type: "boolean", default: false },
    list: { type: "boolean", default: false },
  },
});

const email = (values.email ?? process.env.ADMIN_EMAIL)?.trim().toLowerCase();
const password = values.password ?? process.env.ADMIN_PASSWORD;
const remote = values.remote ?? false;
const shouldList = values.list ?? false;

if (shouldList) {
  const { emails } = listUsers(remote);
  if (emails.length === 0) {
    console.log(`No users found in ${remote ? "remote" : "local"} D1.`);
  } else {
    console.log(`Users in ${remote ? "remote" : "local"} D1:`);
    for (const userEmail of emails) {
      console.log(`  - ${userEmail}`);
    }
  }
  process.exit(0);
}

if (!email || !password) {
  console.error("Usage: npm run user:reset-password -- --email you@example.com --password 'newpassword' [--remote]");
  console.error("Or set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.");
  console.error("List users: npm run user:reset-password -- --list [--remote]");
  process.exit(1);
}

if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

try {
  const lookup = runWrangler(
    `SELECT id, email FROM users WHERE email = ${sqlString(email)}`,
    remote,
  );

  if (!lookup.includes('"id"')) {
    console.error(`No user found with email: ${email}`);
    const { emails } = listUsers(remote);
    if (emails.length > 0) {
      console.error("Existing users:");
      for (const userEmail of emails) {
        console.error(`  - ${userEmail}`);
      }
    }
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  runWrangler(
    `
      UPDATE users
      SET password_hash = ${sqlString(passwordHash)},
          updated_at = datetime('now')
      WHERE email = ${sqlString(email)}
    `.replace(/\s+/g, " ").trim(),
    remote,
  );

  runWrangler(
    `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = ${sqlString(email)})`,
    remote,
  );

  console.log(`Password reset for: ${email}`);
  console.log(`Target: ${remote ? "remote D1" : "local D1"}`);
  console.log("All existing sessions for this user were revoked.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
