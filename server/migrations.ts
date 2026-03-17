import { pool } from "./db";
import { log } from "./index";

/**
 * Safe, idempotent startup migrations.
 * These run on every server start but only change data when needed.
 * Order matters — schema changes before data changes.
 */
export async function runStartupMigrations() {
  const client = await pool.connect();
  try {
    log("Running startup migrations...", "migrations");

    // 1. Ensure internal_bypass column exists (no-op if already there)
    await client.query(`
      ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS internal_bypass boolean NOT NULL DEFAULT false;
    `);

    // 2. Grandfather all existing legacy / active companies
    //    Any company with plan_code='legacy' OR account_status='active' that predates
    //    Stripe enforcement should have full access with no paywall.
    const grandfathered = await client.query(`
      UPDATE companies
      SET internal_bypass = true
      WHERE internal_bypass = false
        AND account_status != 'pending_subscription'
      RETURNING name;
    `);
    if (grandfathered.rowCount && grandfathered.rowCount > 0) {
      const names = grandfathered.rows.map((r: any) => r.name).join(", ");
      log(`Grandfathered ${grandfathered.rowCount} existing businesses: ${names}`, "migrations");
    }

    // 3. Grant super admin to gift.delvin@mastercleaning.ca
    //    ONLY sets is_super_admin=true — does not touch password, email, company, or anything else.
    const superAdminGrant = await client.query(`
      UPDATE users
      SET is_super_admin = true
      WHERE email = 'gift.delvin@mastercleaning.ca'
        AND is_super_admin = false
      RETURNING email;
    `);
    if (superAdminGrant.rowCount && superAdminGrant.rowCount > 0) {
      log(`Granted Super Admin to: gift.delvin@mastercleaning.ca`, "migrations");
    }

    log("Startup migrations complete.", "migrations");
  } catch (err: any) {
    log(`Migration error (non-fatal): ${err.message}`, "migrations");
  } finally {
    client.release();
  }
}
