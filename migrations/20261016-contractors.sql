-- Additive contractor quality management. No employee tables or existing rows are changed.
BEGIN;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS timezone text;
CREATE TABLE IF NOT EXISTS contractor_businesses (
 id text PRIMARY KEY, company_id varchar NOT NULL REFERENCES companies(id), name text NOT NULL,
 contact_name text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
 agreement_start text, agreement_end text, required_documents jsonb NOT NULL DEFAULT '[]',
 approval_status text NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','rejected')),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','archived')),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,id)
);
CREATE TABLE IF NOT EXISTS contractor_memberships (
 id text PRIMARY KEY, company_id varchar NOT NULL, business_id text NOT NULL, user_id varchar NOT NULL REFERENCES users(id),
 role text NOT NULL CHECK(role IN ('manager','lead')), status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
 starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz,
 FOREIGN KEY(company_id,business_id) REFERENCES contractor_businesses(company_id,id), UNIQUE(user_id), UNIQUE(business_id,id)
);
CREATE TABLE IF NOT EXISTS contractor_invitations (
 id text PRIMARY KEY, company_id varchar NOT NULL, business_id text NOT NULL, email text NOT NULL,
 role text NOT NULL CHECK(role IN ('manager','lead')), token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
 revoked_at timestamptz, accepted_at timestamptz, created_by varchar NOT NULL REFERENCES users(id),
 FOREIGN KEY(company_id,business_id) REFERENCES contractor_businesses(company_id,id)
);
CREATE TABLE IF NOT EXISTS contractor_assignments (
 id text PRIMARY KEY, company_id varchar NOT NULL, business_id text NOT NULL, location_id varchar NOT NULL REFERENCES locations(id),
 starts_on text NOT NULL, ends_on text NOT NULL, timezone text NOT NULL,
 weekdays integer[] NOT NULL CHECK(cardinality(weekdays)>0), start_time text NOT NULL, end_time text NOT NULL,
 scope text NOT NULL, frequency text NOT NULL DEFAULT 'weekly', checklist jsonb NOT NULL DEFAULT '[]',
 supplies text NOT NULL DEFAULT '', equipment text NOT NULL DEFAULT '', admin_contact text NOT NULL DEFAULT '',
 state text NOT NULL DEFAULT 'proposed' CHECK(state IN ('proposed','accepted','declined','ended')), decision_reason text,
 lead_member_id text REFERENCES contractor_memberships(id), version integer NOT NULL DEFAULT 1,
 FOREIGN KEY(company_id,business_id) REFERENCES contractor_businesses(company_id,id), UNIQUE(company_id,business_id,id)
);
CREATE TABLE IF NOT EXISTS contractor_instructions (
 id text PRIMARY KEY, assignment_id text NOT NULL REFERENCES contractor_assignments(id), version integer NOT NULL,
 content text NOT NULL, access_details text NOT NULL DEFAULT '', access_member_ids text[] NOT NULL DEFAULT '{}',
 important boolean NOT NULL DEFAULT true, created_by varchar NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(assignment_id,version)
);
CREATE TABLE IF NOT EXISTS contractor_acknowledgements (
 instruction_id text NOT NULL REFERENCES contractor_instructions(id), member_id text NOT NULL REFERENCES contractor_memberships(id),
 acknowledged_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(instruction_id,member_id)
);
CREATE TABLE IF NOT EXISTS contractor_visits (
 id text PRIMARY KEY, company_id varchar NOT NULL, business_id text NOT NULL, assignment_id text NOT NULL,
 service_date text NOT NULL, status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','submitted','approved','blocked','missed','cancelled','correction_required')),
 version integer NOT NULL DEFAULT 1, deadline timestamptz, review_findings text, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(company_id,business_id,assignment_id) REFERENCES contractor_assignments(company_id,business_id,id), UNIQUE(assignment_id,service_date)
);
CREATE TABLE IF NOT EXISTS contractor_submissions (
 id text PRIMARY KEY, visit_id text NOT NULL REFERENCES contractor_visits(id), revision integer NOT NULL,
 submitted_by varchar NOT NULL REFERENCES users(id), checklist jsonb NOT NULL, notes text NOT NULL DEFAULT '',
 file_ids text[] NOT NULL DEFAULT '{}', submitted_at timestamptz NOT NULL DEFAULT now(), request_key text NOT NULL,
 UNIQUE(visit_id,revision), UNIQUE(visit_id,request_key)
);
CREATE TABLE IF NOT EXISTS contractor_inspections (
 id text PRIMARY KEY, visit_id text NOT NULL REFERENCES contractor_visits(id), revision integer NOT NULL,
 reviewer_id varchar NOT NULL REFERENCES users(id), decision text NOT NULL CHECK(decision IN ('approved','correction_required')),
 findings text NOT NULL DEFAULT '', deadline timestamptz, score integer CHECK(score BETWEEN 0 AND 100),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(visit_id,revision)
);
CREATE TABLE IF NOT EXISTS contractor_issues (
 id text PRIMARY KEY, company_id varchar NOT NULL, business_id text NOT NULL, assignment_id text NOT NULL, visit_id text REFERENCES contractor_visits(id),
 category text NOT NULL, severity text NOT NULL CHECK(severity IN ('low','medium','high','urgent')),
 description text NOT NULL, owner_id varchar REFERENCES users(id), response_target timestamptz NOT NULL,
 resolution_target timestamptz NOT NULL, responded_at timestamptz, resolved_at timestamptz,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed')),
 raised_by varchar NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 FOREIGN KEY(company_id,business_id,assignment_id) REFERENCES contractor_assignments(company_id,business_id,id)
);
CREATE TABLE IF NOT EXISTS contractor_comments (
 id text PRIMARY KEY, issue_id text NOT NULL REFERENCES contractor_issues(id), author_id varchar NOT NULL REFERENCES users(id),
 body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), request_key text NOT NULL, UNIQUE(issue_id,author_id,request_key)
);
CREATE TABLE IF NOT EXISTS contractor_files (
 id text PRIMARY KEY, company_id varchar NOT NULL, business_id text NOT NULL, kind text NOT NULL CHECK(kind IN ('business','visit','issue')),
 entity_id text NOT NULL, name text NOT NULL, storage_name text NOT NULL UNIQUE, mime text NOT NULL, size integer NOT NULL,
 document_type text NOT NULL DEFAULT '', expires_on text, approval_status text NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','rejected')),
 uploaded_by varchar NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 FOREIGN KEY(company_id,business_id) REFERENCES contractor_businesses(company_id,id)
);
CREATE TABLE IF NOT EXISTS contractor_audit (
 id text PRIMARY KEY, company_id varchar NOT NULL, business_id text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL,
 actor_id varchar REFERENCES users(id), action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(company_id,business_id) REFERENCES contractor_businesses(company_id,id)
);
CREATE TABLE IF NOT EXISTS contractor_notifications (
 id text PRIMARY KEY, company_id varchar NOT NULL, business_id text NOT NULL, recipient_id varchar NOT NULL REFERENCES users(id),
 event_key text NOT NULL, body text NOT NULL, href text NOT NULL, read_at timestamptz,
 email_state text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(event_key,recipient_id),
 FOREIGN KEY(company_id,business_id) REFERENCES contractor_businesses(company_id,id)
);
CREATE INDEX IF NOT EXISTS contractor_visit_company_date ON contractor_visits(company_id,service_date);
CREATE INDEX IF NOT EXISTS contractor_issues_targets ON contractor_issues(status,resolution_target);
CREATE INDEX IF NOT EXISTS contractor_file_entity ON contractor_files(company_id,business_id,kind,entity_id);

-- Server-owned tables: no public/PostgREST policies. Checked application routes own access.
ALTER TABLE contractor_businesses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_businesses FROM PUBLIC;
ALTER TABLE contractor_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_memberships FROM PUBLIC;
ALTER TABLE contractor_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_invitations FROM PUBLIC;
ALTER TABLE contractor_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_assignments FROM PUBLIC;
ALTER TABLE contractor_instructions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_instructions FROM PUBLIC;
ALTER TABLE contractor_acknowledgements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_acknowledgements FROM PUBLIC;
ALTER TABLE contractor_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_visits FROM PUBLIC;
ALTER TABLE contractor_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_submissions FROM PUBLIC;
ALTER TABLE contractor_inspections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_inspections FROM PUBLIC;
ALTER TABLE contractor_issues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_issues FROM PUBLIC;
ALTER TABLE contractor_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_comments FROM PUBLIC;
ALTER TABLE contractor_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_files FROM PUBLIC;
ALTER TABLE contractor_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_audit FROM PUBLIC;
ALTER TABLE contractor_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contractor_notifications FROM PUBLIC;
DO $guard$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE contractor_businesses,contractor_memberships,contractor_invitations,contractor_assignments,contractor_instructions,contractor_acknowledgements,contractor_visits,contractor_submissions,contractor_inspections,contractor_issues,contractor_comments,contractor_files,contractor_audit,contractor_notifications FROM anon'; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'REVOKE ALL ON TABLE contractor_businesses,contractor_memberships,contractor_invitations,contractor_assignments,contractor_instructions,contractor_acknowledgements,contractor_visits,contractor_submissions,contractor_inspections,contractor_issues,contractor_comments,contractor_files,contractor_audit,contractor_notifications FROM authenticated'; END IF;
END $guard$;
COMMIT;
