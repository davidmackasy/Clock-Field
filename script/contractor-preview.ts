// Local-only test harness. No production data, authentication overrides or emails.
if (process.env.CLOCKFIELD_CONTRACTOR_PREVIEW !== '1')
    throw Error('Set CLOCKFIELD_CONTRACTOR_PREVIEW=1 for the isolated preview');
process.env.DATA_DIR = '/private/tmp/clockfield-contractor-preview-data';
process.env.APP_URL = `http://127.0.0.1:${process.env.CONTRACTOR_PREVIEW_PORT || 5191}`;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_STORAGE_KEY;
delete process.env.MAILGUN_API_KEY;
const { contractorTestDB } = await import('./contractor-test-db');
const { registerContractors } = await import('../server/contractor-routes');
const { makeContractorBoundary } = await import('../server/contractor-access');
const { requireAuth } = await import('../server/auth');
const { default: express } = await import('express');
const { default: path } = await import('node:path');
export const fixture = await contractorTestDB();
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use((req: any, _res, next) => { req.user = req.headers.cookie?.includes('contractor_preview=none') ? null : req.headers.cookie?.includes('contractor_preview=manager') ? fixture.manager : fixture.admin; req.isAuthenticated = () => !!req.user; req.logout = (fn: any) => fn(); next(); });
app.use(makeContractorBoundary(fixture.pool));
app.get('/preview/:role', (req, res) => { res.cookie('contractor_preview', req.params.role, { httpOnly: true, sameSite: 'lax' }); res.redirect(req.params.role === 'manager' ? '/contractor' : '/admin/contractors'); });
app.get('/api/auth/me', (req: any, res) => res.json(req.user));
app.get('/api/auth/company', (_req, res) => res.json({ id: 'co', name: 'Example Cleaning Company', planCode: 'legacy', accountStatus: 'active', subscriptionStatus: 'active', internalBypass: true }));
app.get('/api/settings/timezone', (_req, res) => res.json({ timezone: 'America/Winnipeg' }));
registerContractors(app, fixture.pool, requireAuth, async (p: string) => 'isolated-hash');
app.get('/api/{*path}', (_req, res) => res.json([]));
app.use(express.static(path.resolve('dist/public')));
app.get('/{*path}', (_req, res) => res.sendFile(path.resolve('dist/public/index.html')));
const port = Number(process.env.CONTRACTOR_PREVIEW_PORT || 5191);
export const server = app.listen(port, '127.0.0.1', () => console.log(`Isolated contractor preview: http://127.0.0.1:${port}/preview/admin and /preview/manager`));
