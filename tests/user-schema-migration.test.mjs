import assert from "node:assert/strict";
import test from "node:test";

import { ensureUserRoleSchema } from "../functions/_shared/user-schema.js";

test("user role migration preserves the live users table and adds an access role", async () => {
  const prepared = [];
  const runs = [];

  const db = {
    prepare(sql) {
      prepared.push(sql);
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
  };

  await ensureUserRoleSchema(db);

  assert.ok(runs.some((sql) => /ALTER TABLE users ADD COLUMN access_role/i.test(sql)));
  assert.ok(runs.some((sql) => /SET access_role = CASE/i.test(sql)));
  assert.ok(runs.some((sql) => /idx_users_access_role_active/.test(sql)));
  assert.equal(prepared.some((sql) => /DROP TABLE users/i.test(sql)), false);
  assert.equal(prepared.some((sql) => /ALTER TABLE users_role_upgrade RENAME TO users/i.test(sql)), false);
  assert.equal("batch" in db, false);
});
