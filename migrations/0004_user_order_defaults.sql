-- Optional manual recovery migration.
-- Normal application startup now creates these columns and performs this
-- migration automatically through functions/_shared/setup.js.
-- Run this file only against an older database where the three users columns
-- below do not yet exist. SQLite rejects duplicate ALTER TABLE columns.

PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN default_contact_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN default_mobile TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN order_defaults_json TEXT NOT NULL DEFAULT '{}';

-- A legacy customer-level default can only be assigned safely when the
-- customer has exactly one portal user. Multi-user customer defaults are left
-- blank because their original owner cannot be determined reliably.
UPDATE users
SET default_contact_name = COALESCE((
      SELECT a.default_contact_name
      FROM customer_accounts a
      WHERE a.id = users.account_id
    ), ''),
    default_mobile = COALESCE((
      SELECT a.default_mobile
      FROM customer_accounts a
      WHERE a.id = users.account_id
    ), ''),
    order_defaults_json = COALESCE((
      SELECT a.order_defaults_json
      FROM customer_accounts a
      WHERE a.id = users.account_id
    ), '{}')
WHERE role = 'customer'
  AND account_id IS NOT NULL
  AND (SELECT COUNT(*)
       FROM users peers
       WHERE peers.account_id = users.account_id
         AND peers.role = 'customer') = 1;

-- These legacy fields are retained for backwards-compatible schema reads but
-- no longer drive the portal. Defaults now belong to individual users.
UPDATE customer_accounts
SET default_contact_name = '',
    default_mobile = '',
    order_defaults_json = '{}';

INSERT OR REPLACE INTO portal_settings (key, value, updated_at)
VALUES ('user_order_defaults_v1', 'complete', datetime('now'));
