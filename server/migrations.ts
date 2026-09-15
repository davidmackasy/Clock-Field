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
      ALTER TABLE fit_for_duty_verifications
      ADD COLUMN IF NOT EXISTS face_photo_path text;
      ALTER TABLE fit_for_duty_verifications
      ADD COLUMN IF NOT EXISTS face_photo_captured_at text;
    `);
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS fit_for_duty_email_preference text NOT NULL DEFAULT 'flagged_only';
    `);
    await client.query(`
      ALTER TABLE training_assignments
      ADD COLUMN IF NOT EXISTS last_reminder_email_sent_at text;
    `);

    // 6. Incident Reports: immutable employee snapshots, private evidence,
    // templates/questions, additive amendments and admin investigation data.
    // All DDL is idempotent because deployments may be restarted repeatedly.
    await client.query(`
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS incident_min_photos integer NOT NULL DEFAULT 0;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS incident_questions_json text;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS incident_declaration_text text;
      CREATE TABLE IF NOT EXISTS incident_employee_snapshots (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(), report_id varchar NOT NULL UNIQUE,
        company_id varchar NOT NULL, employee_id varchar NOT NULL,
        employee_id_snapshot text NOT NULL, employee_name_snapshot text NOT NULL,
        position_snapshot text, statement_snapshot text NOT NULL,
        answers_json text NOT NULL DEFAULT '{}',
        declaration_text_snapshot text NOT NULL, signature_data_url text NOT NULL,
        signed_at text NOT NULL, submitted_at text NOT NULL, created_at text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS incident_evidence (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(), report_id varchar NOT NULL,
        company_id varchar NOT NULL, storage_name text NOT NULL UNIQUE,
        original_name text NOT NULL, mime_type text NOT NULL, file_size integer NOT NULL,
        caption text, uploaded_by_user_id varchar NOT NULL, uploaded_at text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS incident_templates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(), company_id varchar NOT NULL,
        name text NOT NULL, version integer NOT NULL DEFAULT 1,
        questions_json text NOT NULL DEFAULT '[]', active boolean NOT NULL DEFAULT true,
        created_by_user_id varchar NOT NULL, created_at text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS incident_amendments (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(), report_id varchar NOT NULL,
        company_id varchar NOT NULL, requested_by_user_id varchar NOT NULL,
        requested_by_role text NOT NULL, reason text NOT NULL, content_json text NOT NULL,
        status text NOT NULL DEFAULT 'requested', submitted_at text, created_at text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS incident_investigations (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(), report_id varchar NOT NULL UNIQUE,
        company_id varchar NOT NULL, findings text, corrective_action text,
        final_decision text, next_steps text, client_allowlist_json text NOT NULL DEFAULT '[]',
        updated_by_user_id varchar NOT NULL, updated_at text NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_incident_snapshots_company ON incident_employee_snapshots(company_id);
      CREATE INDEX IF NOT EXISTS idx_incident_evidence_report ON incident_evidence(report_id, company_id);
      CREATE INDEX IF NOT EXISTS idx_incident_amendments_report ON incident_amendments(report_id, company_id);
      CREATE INDEX IF NOT EXISTS idx_incident_templates_company ON incident_templates(company_id, active);
      CREATE INDEX IF NOT EXISTS idx_incident_investigations_company ON incident_investigations(company_id);
    `);

    log("Startup migrations complete.", "migrations");
  } catch (err: any) {
    log(`Migration error (non-fatal): ${err.message}`, "migrations");
  } finally {
    client.release();
  }
}
