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

    // 4. Training Hub: image_size column + training_image_cache table.
    //    Idempotent — safe to run on every boot.
    await client.query(`
      ALTER TABLE training_lesson_blocks
      ADD COLUMN IF NOT EXISTS image_size text;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS training_image_cache (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id varchar NOT NULL,
        prompt_hash text NOT NULL,
        prompt text NOT NULL,
        style text,
        image_data text NOT NULL,
        created_at text NOT NULL
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_training_image_cache_company_hash
      ON training_image_cache (company_id, prompt_hash);
    `);

    // 5. Training assignment email tracking columns
    await client.query(`
      ALTER TABLE training_assignments
      ADD COLUMN IF NOT EXISTS email_notification_sent_at text;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS fit_for_duty_verifications (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(), company_id varchar NOT NULL,
        employee_id varchar NOT NULL, shift_id varchar, location_id varchar, clock_in_id varchar,
        question_text_snapshot text NOT NULL, answer_snapshot text NOT NULL,
        declaration_text_snapshot text NOT NULL, declaration_version text NOT NULL DEFAULT '1',
        confirmation_accepted boolean NOT NULL DEFAULT false, accepted_at text NOT NULL,
        status text NOT NULL DEFAULT 'flagged', original_submission text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS fit_for_duty_reviews (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(), verification_id varchar NOT NULL,
        company_id varchar NOT NULL, decision text NOT NULL, reviewer_id varchar NOT NULL,
        note text, created_at text NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_fit_for_duty_company ON fit_for_duty_verifications(company_id);
      CREATE INDEX IF NOT EXISTS idx_fit_for_duty_company_status ON fit_for_duty_verifications(company_id, status);
      CREATE INDEX IF NOT EXISTS idx_fit_for_duty_employee_submitted ON fit_for_duty_verifications(employee_id, accepted_at);
      CREATE INDEX IF NOT EXISTS idx_fit_for_duty_reviews_verification ON fit_for_duty_reviews(verification_id);
    `);
    await client.query(`
      ALTER TABLE training_assignments
      ADD COLUMN IF NOT EXISTS last_reminder_email_sent_at text;
    `);

    log("Startup migrations complete.", "migrations");
  } catch (err: any) {
    log(`Migration error (non-fatal): ${err.message}`, "migrations");
  } finally {
    client.release();
  }
}
