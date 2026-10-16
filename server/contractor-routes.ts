import type { Express } from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ContractorQueries } from './contractor-queries';
import { fail } from './contractor-service';
import { contractorFilesDirectory } from './file-storage';
import { readPersistentFile, writePersistentFile, removePersistentFile } from './persistent-files';
import { date } from '../shared/contractor';
export function contractorUploadType(data: Buffer, mime: string) { return mime === 'application/pdf' && data.subarray(0, 5).toString() === '%PDF-' || mime === 'image/jpeg' && data[0] === 255 && data[1] === 216 && data[2] === 255 || mime === 'image/png' && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || mime === 'image/webp' && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP'; }
export function registerContractors(app: Express, pool: any, requireAuth: any, hashPassword: (p: string) => Promise<string>) {
    const svc = new ContractorQueries(pool);
    const wrap = (fn: any) => async (req: any, res: any) => {
        try {
            res.set('Cache-Control', 'private, no-store');
            await fn(req, res);
        }
        catch (e: any) {
            res.status(e instanceof z.ZodError ? 400 : ['23505', '40001', '40P01'].includes(e.code) ? 409 : e.status || 500).json({ message: e instanceof z.ZodError ? e.issues[0]?.message : ['23505', '40001', '40P01'].includes(e.code) ? 'This record changed or conflicts with another request. Refresh and retry.' : e.status ? e.message : 'Contractor operation failed. Please retry.' });
        }
    };
    app.get('/api/contractors/state', requireAuth, wrap(async (req: any, res: any) => res.json(await svc.state(req.user))));
    app.post('/api/contractors/action/:action/:id', requireAuth, wrap(async (req: any, res: any) => res.json(await svc.action(req.user, req.params.action, req.params.id, req.body))));
    app.get('/api/contractors/access/:id', requireAuth, wrap(async (req: any, res: any) => res.json(await svc.accessDetails(req.user, req.params.id))));
    app.get('/api/contractors/reports', requireAuth, wrap(async (req: any, res: any) => {
        const report = await svc.report(req.user, String(req.query.from || ''), String(req.query.to || ''), req.query.business && String(req.query.business), req.query.location && String(req.query.location));
        if (req.query.format === 'csv') {
            const keys = ['business_id', 'location_id', 'name', 'timezone', 'scheduled', 'submitted', 'approved', 'missed', 'cancelled', 'inspections', 'inspected_visits', 'inspection_coverage', 'uninspected_submissions', 'quality_score', 'scored_visits', 'complaints', 'repeat_defects', 'open_issues', 'overdue_corrections', 'resolution_hours'];
            const cell = (s: any) => '"' + String(s ?? '').replace(/^[=+@\-]/, "'$&").replace(/"/g, '""') + '"';
            res.set('Content-Disposition', 'attachment; filename="contractor-report.csv"').type('text/csv').send([keys.map(cell).join(','), ...report.groups.map((g: any) => keys.map(k => cell(g[k])).join(','))].join('\r\n'));
        }
        else
            res.json(report);
    }));
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 6 } }).single('file');
    app.post('/api/contractors/files/:kind/:entity', requireAuth, (req: any, res: any, next: any) => upload(req, res, (err: any) => err ? res.status(400).json({ message: 'Upload one PDF, JPEG, PNG or WebP file, up to 10 MB.' }) : next()), wrap(async (req: any, res: any) => {
        const f = req.file;
        if (!f || !contractorUploadType(f.buffer, f.mimetype))
            fail(400, 'Upload a valid PDF, JPEG, PNG or WebP file');
        const name = String(f.originalname || 'document').replace(/[\r\n\/\\\x00-\x1f]/g, '_').slice(0, 200), expires = req.body.expires_on ? date.parse(req.body.expires_on) : null, type = z.string().max(120).parse(req.body.document_type || '');
        const fid = randomUUID(), storageName = randomUUID();
        const filePath = path.join(contractorFilesDirectory, storageName);
        let written = false;
        try {
            await svc.run(req.user, async (db, c) => { const business = await svc.fileScope(db, c, req.params.kind, req.params.entity); await writePersistentFile(filePath, f.buffer, f.mimetype); written = true; await db.query(`INSERT INTO contractor_files(id,company_id,business_id,kind,entity_id,name,storage_name,mime,size,document_type,expires_on,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [fid, c.companyId, business, req.params.kind, req.params.entity, name, storageName, f.mimetype, f.size, type, expires, c.id]); await svc.audit(db, c, business, 'file', fid, 'uploaded', { kind: req.params.kind, entity_id: req.params.entity }); });
            res.status(201).json({ id: fid, name });
        }
        catch (e) {
            if (written)
                await removePersistentFile(filePath).catch(() => { });
            throw e;
        }
    }));
    app.get('/api/contractors/files/:id', requireAuth, wrap(async (req: any, res: any) => {
        await svc.withFile(req.user, req.params.id, async (f: any) => {
            const data = await readPersistentFile(path.join(contractorFilesDirectory, f.storage_name));
            if (!data)
                fail(404, 'File unavailable');
            res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.name)}` }).type(f.mime).send(data);
        });
    }));
    app.get('/api/public/contractor-invites/:token', wrap(async (req: any, res: any) => res.json(await svc.invitation(req.params.token))));
    app.post('/api/public/contractor-invites/:token/accept', wrap(async (req: any, res: any) => { await svc.invitation(req.params.token); const password = z.string().min(12).max(128).parse(req.body.password); res.json(await svc.accept(req.params.token, req.body, await hashPassword(password))); }));
}
