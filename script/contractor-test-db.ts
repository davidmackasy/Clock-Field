import { ContractorQueries } from '../server/contractor-queries';
import { CONTRACTOR_MIGRATION } from '../server/contractor-migration';
import { localDate } from '../shared/contractor';
export async function contractorTestDB() {
    const { PGlite } = await import(process.env.PGLITE_TEST_MODULE || '@electric-sql/pglite');
    const db = new PGlite();
    const query = async (sql: string, values?: any[]) => { const r = await db.query(sql, values); return { ...r, rowCount: r.affectedRows ?? r.rows.length }; };
    let lock = Promise.resolve();
    const pool: any = { query, connect: async () => { let release!: () => void; const prev = lock; lock = new Promise<void>(r => release = r); await prev; return { query, release: () => release() }; } };
    await db.exec(`CREATE TABLE companies(id varchar PRIMARY KEY,name text,timezone text,company_logo_url text,brand_color text);CREATE TABLE users(id varchar PRIMARY KEY,company_id varchar,email text UNIQUE,password text,role text,first_name text,last_name text,is_active boolean DEFAULT true,login_enabled boolean,account_status text,admin_permissions text[]);CREATE TABLE locations(id varchar PRIMARY KEY,company_id varchar,name text,address text);INSERT INTO companies VALUES('co','Example Cleaning Company','America/Winnipeg',NULL,'#006bbd');INSERT INTO users VALUES('admin','co','owner@example.test','hash','admin','Example','Owner',true,true,'active',NULL);INSERT INTO locations VALUES('site','co','Example Building Centre','Example address');`);
    await db.exec(CONTRACTOR_MIGRATION);
    const svc = new ContractorQueries(pool), admin: any = { id: 'admin', companyId: 'co', role: 'admin', isActive: true, adminPermissions: null, firstName: 'Example', lastName: 'Owner', email: 'owner@example.test' };
    const b = await svc.action(admin, 'create-business', 'new', { name: 'Example Contractor Services', contact_name: 'Example Manager', email: 'manager@example.test', phone: '2045550100', approval_status: 'approved' });
    const inv = await svc.action(admin, 'invite', b.id, { email: 'contractor@example.test', role: 'manager' });
    await svc.accept(inv.url.split('/').at(-1)!, { first_name: 'Example', last_name: 'Manager' }, 'hash');
    const { rows: [u] } = await query("SELECT id FROM users WHERE email='contractor@example.test'");
    const manager: any = { id: u.id, companyId: 'co', role: 'contractor', isActive: true, firstName: 'Example', lastName: 'Manager', email: 'contractor@example.test' };
    const today = localDate(new Date(), 'America/Winnipeg');
    const end = new Date(Date.parse(today) + 7 * 86400000).toISOString().slice(0, 10);
    const a = await svc.action(admin, 'create-assignment', 'new', { business_id: b.id, location_id: 'site', starts_on: today, ends_on: end, timezone: 'America/Winnipeg', weekdays: [1, 2, 3, 4, 5, 6, 0], start_time: '17:00', end_time: '22:00', scope: 'Clean reception, meeting rooms and shared washrooms.', checklist: [{ id: 'task1', label: 'Reception and meeting rooms', required: true, photo_required: false }, { id: 'task2', label: 'Washrooms restocked and cleaned', required: true, photo_required: false }], supplies: 'Contractor provides consumables; report low site stock.', equipment: 'Contractor vacuum and cleaning equipment.', admin_contact: 'Example Owner – site contact on file' });
    await svc.action(manager, 'assignment-decision', a.id, { version: 1, decision: 'accepted' });
    let state = await svc.state(admin);
    await svc.action(admin, 'instructions', a.id, { version: state.assignments[0].version, content: 'Check in with the site contact. Keep walkways clear and follow posted safety instructions. Report blocked access in Issues.', access_details: 'PRIVATE-TEST-ACCESS', access_member_ids: [], important: true });
    return { db, pool, svc, admin, manager, business: b, assignment: a, today, end };
}
