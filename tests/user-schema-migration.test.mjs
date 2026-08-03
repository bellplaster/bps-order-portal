import assert from "node:assert/strict";
import test from "node:test";

import { ensureUserRoleSchema } from "../functions/_shared/user-schema.js";

test("user role table rebuild defers foreign-key checks before replacing users", async () => {
  const batches = [];
  const runs = [];

  const db = {
    prepare(sql) {
      const statement = {
        sql,
        bind() { return statement; },
        async first() {
          if (sql.includes("sqlite_master") && sql.includes("name = 'users'")) {
            return { sql: "CREATE TABLE users (role TEXT CHECK (role IN ('admin', 'customer')))" };
          }
          return null;
        },
        async all() {
          if (sql.startsWith("PRAGMA table_info(users)")) {
            return {
              results: [
                { name: "is_primary" },
                { name: "default_contact_name" },
                { name: "default_mobile" },
                { name: "order_defaults_json" },
              ],
            };
          }
          return { results: [] };
        },
        async run() {
          runs.push(sql);
          return { success: true };
        },
      };
      return statement;
    },
    async batch(statements) {
      batches.push(statements.map((statement) => statement.sql));
      return statements.map(() => ({ success: true }));
    },
  };

  await ensureUserRoleSchema(db);

  assert.equal(batches.length, 1);
  assert.match(batches[0][0], /PRAGMA defer_foreign_keys\s*=\s*ON/i);
  assert.ok(batches[0].findIndex((sql) => /DROP TABLE users$/i.test(sql.trim())) > 0);
  assert.ok(batches[0].findIndex((sql) => /ALTER TABLE users_role_upgrade RENAME TO users/i.test(sql)) > 0);
  assert.ok(runs.some((sql) => /idx_users_role_active/.test(sql)));
});
