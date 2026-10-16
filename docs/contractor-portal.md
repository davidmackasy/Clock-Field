# Contractor quality management

Status: production rollout authorized by the business owner on October 16, 2026. No production invitations sent during implementation or release checks.

## Repository review and design

The existing application uses Passport email/password sessions, company-scoped users, Drizzle/PostgreSQL, shared locations, private persistent storage backed by the existing Supabase bucket (or local disk), Mailgun and a signed five-minute scheduled worker request. Existing employee schedules, clock-in and payroll are separate services. Work submissions and incidents are employee/client oriented; reusing their ownership fields for contractors would grant the wrong permissions and conflate service approval with employee attendance.

This extension reuses users and sign-in, companies, locations, brand assets, storage adapters, mail delivery and the scheduled job trigger. New contractor records cover the missing business/membership/assignment/quality workflow. `users.role = contractor` is a distinct access role; it does not determine a worker's legal status. Existing employee users and records are not converted or backfilled. New admin permission: `contractors`; unrestricted company admins inherit access, restricted staff require an explicit grant.

## Setup and review before deployment

1. Review `migrations/20261016-contractors.sql`. It only creates contractor tables/indexes and adds an optional IANA timezone to existing locations. Take the normal database backup before any approved release.
2. Apply the migration to a **staging database** with `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261016-contractors.sql`, or start the staging app: the same SQL is embedded in `server/contractor-migration.ts` and is called by the existing startup migration runner. The SQL is transactional and repeatable. Table definitions are also exported from the existing Drizzle schema so schema tooling recognizes these records. New tables have row-level security enabled with no public policies, and public/anonymous/authenticated table grants are revoked. The checked application server uses its table-owning database connection; do not expose service credentials to clients. Existing employee tables are unchanged. Use the reviewed SQL for this release, rather than an unreviewed broad schema push.
3. Keep the existing `SESSION_SECRET`, `APP_URL`, database and Mailgun settings. No new paid integration or production dependency is required. During staging testing, omit the real mail-delivery key or use approved sandbox recipients; the isolated suites stub delivery and the preview clears mail/storage credentials. Set `APP_URL` to the staging/public origin before generating invitation links.
4. Private files use the **new `private_contractors` directory/prefix**, never the public `/uploads` route. Ensure the existing Supabase bucket stays private; if using disk, persist `DATA_DIR`. PDF, JPEG, PNG and WebP are accepted up to 10 MB, with MIME/signature validation. Successful uploads are shown only after storage and metadata commit.
5. The existing signed `/api/internal/payroll-summary` cron also processes contractor outbox messages and overdue items. It runs every five minutes in the Cloudflare worker. Contractor job failures are isolated so they cannot block employee payroll summaries. A local/staging scheduler must invoke the existing signed job or explicitly call `processContractorJobs`. No new public scheduler endpoint is exposed.
6. Build normally with `node --import tsx script/build.ts`. Contractor admin route: `/admin/contractors`; workspace: `/contractor`; invitations: `/contractor-invite/:token`. Contractors use the existing email/password sign-in screen.
7. The user approved production deployment on October 16, 2026. Real invitation distribution is a separate business action; release checks must not invite real recipients.

## Operating the first full flow

- In **Contractors**, add business/contact details, agreement dates and any required document type names. Create a manager invitation and copy its seven-day link. Share it only with that named person after approval. Tokens are stored as hashes, are single-use, and can be revoked. Creating a link does not send an email automatically.
- The invitee creates their own password. Existing employee/admin identities are preserved: a contractor account needs a separate unique email. One contractor membership per account is supported in this first version. Optional team leads use their own invitation/account.
- The contractor manager can open **Business profile, documents and team** even before a location is assigned, upload the requested documents and specify document type and expiry. Admin approves documents and the business. Assigning new service requires all configured document types to have current approved files.
- Propose an assignment to an existing location, with effective dates (up to one year), service days, weekly/fortnightly recurrence, start/end times, scope, checklist, supplies/equipment responsibilities and admin contact. An earlier end time means an overnight service window. The site timezone is used when set; otherwise its company timezone is used. Every proposed assignment is explicitly accepted or declined by the contractor manager.
- Acceptance generates individual visits for the full dated assignment. Generation can be repeated without duplicates. A manager can allocate an active team lead from the same business. Managers see their business's assignments; leads see only assignments currently allocated to them.
- Admin publishes versioned instructions and explicitly chooses any members allowed to see the separate sensitive access details. Important instructions require the submitting member's acknowledgement. Prior versions, acknowledgements, submissions and inspections remain recorded. Sensitive access details never appear in normal state responses, reports, CSVs, notifications or logs.
- A contractor opens the visit, uploads relevant evidence, completes the checklist, selects required task photos where configured, and submits. A future service date cannot be submitted. Submitting does not approve work.
- Admin reviews the current revision and either approves or requests corrections with findings and a future deadline. The contractor submits a new revision; admin verifies that revision. Each submission and review remains in history, and reports update from the shared records.
- Either side can report location/visit issues and comment, assign an authorized owner and record response/resolution targets. Contractors can mark resolved; only admin can close. Urgent safety notices direct people to the site's emergency procedure, not an app response.

## Roles, transitions and revocation

| Operation | Authorized company admin | Contractor manager | Allocated team lead |
|---|---|---|---|
| Business, invitation, member revocation and assignment configuration | Yes | Own business documents only | No |
| Accept/decline proposed assignment | No | Own business | No |
| Allocate lead | Yes | Own active lead | No |
| Read instructions, acknowledge, submit or correct service | Review only | Own business | Allocated assignment |
| Approve / request correction / close issue | Yes | No | No |
| Report issues / comment / resolve | Yes | Own business | Allocated assignment |
| Sensitive site access | Explicit admin capability | Explicit named grant and current assignment | Explicit named grant and current assignment |
| Reports / private files | Own company | Own permitted records | Allocated records |

`scheduled → submitted → approved` is the main path; `submitted → correction_required → submitted` retains revisions. Contractors can record blocked work and reopen a blocked visit. Admin controls missed/cancelled/reopening transitions. Terminal approved work cannot be silently rewritten. Optimistic versions reject stale changes; row locks, transactional updates and unique request/event keys guard competing requests.

Membership status, membership dates, business status and current lead allocation are checked again on requests, not cached in the login session. Contractors cannot use general employee/payroll/client/location APIs. Suspension or archive immediately blocks contractor API and file access. Revocation or ended memberships continue to be denied; explicitly reactivating a business restores only memberships that were not revoked. Ending an assignment immediately revokes its access details and private service/issue files. Service history remains available to authorized admin and scoped historical reports. Already downloaded bytes cannot be recalled.

## Reports and reliability

Weekly/monthly/custom date-range reports group by contractor and location; the date range uses each location's local **service start date**, including overnight visits. Reports distinguish scheduled, ever-submitted, approved, missed, cancelled, inspections, inspection coverage, scored visits, uninspected work, explicitly categorized complaints (ordinary client requests are excluded), repeated correction findings, open issues, overdue corrections and resolution time. Exact definitions and denominators appear in the UI and API. A missing inspection is not a failed inspection, and missing scores render as “Not measured.” CSV exports contain aggregate metrics only.

Dashboard data refreshes every 15 seconds and on focus, with explicit retry/loading/empty/error states. In-app updates plus a transactional, deduplicated email outbox notify authorized company admins and active contractor managers. Email failures retry after five minutes; recipients are checked again at delivery. Leads receive their scoped dashboard changes; manager accounts receive contractual email notices. As with the existing mail provider integration, an ambiguous provider timeout after accepting an email cannot guarantee exactly-once external delivery. Database event deduplication prevents ordinary repeated-job notifications.

Unsubmitted scheduled visits become missed after their local service day ends, allowing an overnight window to finish the next day. Admin can reopen a missed visit if a late submission should be accepted. Blocked, cancelled and correction-required visits are not automatically overwritten. Overdue issues/corrections create deduplicated escalations. Required-document expiry gates **new assignments**; it does not silently cancel historical or already accepted services.

## Local test setup

The database suites use **PGlite 0.5.10**, a temporary isolated PostgreSQL runtime, not `DATABASE_URL`. With a normal npm environment it can be installed just for development using `npm install --no-save --package-lock=false @electric-sql/pglite@0.5.10`. Alternatively point `PGLITE_TEST_MODULE` at a separately unpacked official package's `dist/index.js` (this was the method used here). It is not a production dependency. In this workspace, the unpacked test module is `/private/tmp/clockfield-pglite/package/dist/index.js`; set `PGLITE_TEST_MODULE` to that path when running the suites. If `node` is not on PATH, the available executable is `/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.

```sh
node --import tsx script/test-contractors.ts
node --import tsx script/test-contractors-http.ts
node --import tsx script/test-people-workflow.ts
node --import tsx script/test-payroll-workflow.ts
node --import tsx script/test-settings-attendance-alerts.ts
node --import tsx script/test-training-workflow.ts
node --import tsx script/test-worklog-workflow.ts
node --import tsx script/test-admin-flows.ts
```

The first suite exercises the complete invite → assignment → acknowledgement → evidence submission → correction → resubmission → approval → report flow, duplicate/concurrent requests, scoped lead access, cross-company/contractor denial, direct file access, expired/revoked invitations, revocation, suspension, ended assignments, timezone boundaries and overnight recurrence. The HTTP suite runs the actual routes on an ephemeral localhost port, tests unauthenticated/direct employee/payroll/client API denial, rejected and simulated failed uploads, private downloads and existing-session revocation. Mail is stubbed; no real invitations or notifications are sent.

For visual review, after building:

```sh
CLOCKFIELD_CONTRACTOR_PREVIEW=1 node --import tsx script/contractor-preview.ts
```

Open `http://127.0.0.1:5191/preview/admin` and `/preview/manager`. These are **test-harness-only role switches** over disposable example records and never get registered in the production app. The harness clears external storage/mail configuration and uses a temporary private directory. Never expose this local harness publicly.

Browser checks covered desktop and 390-pixel mobile layout, instruction acknowledgement, server-confirmed checklist submission, report distinction between submitted/uninspected work, labelled controls, keyboard Escape dismissal and no horizontal overflow. The native datetime-local picker was not automated by the browser tool; correction deadline validation and the full review/correction flow were verified through the actual service/database tests. Existing repository-wide type errors remain separate from the new contractor files; the production build passes.

## Remaining decisions and limits

- Production rollout was approved on October 16, 2026. Invitation links remain manually shared by authorized admins; release testing does not distribute them.
- Choose each business's required documents, approval policy, service checklists, site timezones, instruction recipients and issue/correction targets. No client location or access secret was invented or imported.
- This first version refreshes the full permitted workspace dataset; large multi-year histories should be profiled before rollout and may need pagination. It supports one contractor business per user account, weekly/fortnightly recurrence and manually shared invitation links. It does not convert existing employee identities or send invitation emails automatically.
- Keep the existing organization's retention/backup policy for service evidence and documents. There are no delete endpoints that remove the historical service trail.
- Payments, invoicing, employee clock-in, payroll and continuous GPS tracking are intentionally outside the contractor workspace.
