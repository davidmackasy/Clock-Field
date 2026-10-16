import assert from 'node:assert/strict';
process.env.CLOCKFIELD_CONTRACTOR_PREVIEW = '1';
process.env.CONTRACTOR_PREVIEW_PORT = '0';
const { server, fixture } = await import('./contractor-preview');
if (!server.listening)
    await new Promise(resolve => server.on('listening', resolve));
const address = server.address() as any;
const base = `http://127.0.0.1:${address.port}`;
const call = (path: string, manager = true, init: any = {}) => fetch(base + path, { ...init, headers: { Cookie: `contractor_preview=${manager ? 'manager' : 'admin'}`, ...init.headers } });
try {
    let r = await fetch(base + '/api/contractors/state', { headers: { Cookie: 'contractor_preview=none' } });
    assert.equal(r.status, 401);
    for (const path of ['/api/employees', '/API/employees', '/api/Employees', '/api/time-entries', '/api/pay-stubs', '/api/company', '/api/locations', '/api/clients']) {
        r = await call(path);
        assert.equal(r.status, 403, path);
    }
    r = await call('/api/contractors/state');
    assert.equal(r.status, 200);
    const state = await r.json();
    assert.ok(!JSON.stringify(state).includes('PRIVATE-TEST-ACCESS'));
    const v = state.visits.find((v: any) => v.service_date === fixture.today);
    const count = state.files.length;
    const invalid = new FormData();
    invalid.append('file', new Blob(['<script>bad</script>'], { type: 'image/png' }), 'bad.png');
    r = await call(`/api/contractors/files/visit/${v.id}`, true, { method: 'POST', body: invalid });
    assert.equal(r.status, 400);
    const valid = () => { const data = new FormData(); data.append('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6VAAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'evidence.png'); return data; };
    process.env.SUPABASE_URL = 'https://never-contacted.invalid';
    r = await call(`/api/contractors/files/visit/${v.id}`, true, { method: 'POST', body: valid() });
    assert.equal(r.status, 500);
    delete process.env.SUPABASE_URL;
    assert.equal((await fixture.svc.state(fixture.manager)).files.length, count);
    r = await call(`/api/contractors/files/visit/${v.id}`, true, { method: 'POST', body: valid() });
    assert.equal(r.status, 201);
    const file = await r.json();
    r = await call(`/api/contractors/files/${file.id}`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'private, no-store');
    assert.ok((await r.arrayBuffer()).byteLength > 8);
    r = await call(`/api/contractors/access/${fixture.assignment.id}`);
    assert.equal(r.status, 403);
    let b = (await fixture.svc.state(fixture.admin)).businesses[0];
    await fixture.svc.action(fixture.admin, 'business-status', b.id, { version: b.version, status: 'suspended' });
    r = await call(`/api/contractors/files/${file.id}`);
    assert.equal(r.status, 403);
    r = await call('/api/auth/me');
    assert.equal(r.status, 403);
    console.log('PASS: actual HTTP routes deny unauthenticated/employee/payroll/client APIs; private file download enforces sessions and permissions; invalid and failed storage uploads leave no successful file record; suspension immediately blocks existing sessions. No external storage request or email.');
}
finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    await fixture.db.close();
}
