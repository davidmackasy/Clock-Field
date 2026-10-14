import { randomBytes } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { emptyProfile, safePerson } from '../shared/people';
import { dataDirectory } from './file-storage';
import { readPersistentFile, writePersistentFile } from './persistent-files';
export function registerPeopleProfile(app: any, storage: any, requireRole: any, requireAuth: any) {
    app.get('/api/employees/:id/profile', requireRole('admin'), async (req: any, res: any) => { try {
        const employee = await storage.getUser(req.params.id);
        if (!employee || employee.companyId !== req.user.companyId || employee.role !== 'employee')
            return res.status(404).json({ message: 'Employee not found' });
        res.json({ ...safePerson(employee), profileDetails: employee.profileDetails || emptyProfile() });
    }
    catch {
        res.status(500).json({ message: 'Could not load employee profile' });
    } });
    app.get('/api/employees/:id/activity', requireRole('admin'), async (req: any, res: any) => { try {
        const employee = await storage.getUser(req.params.id);
        if (!employee || employee.companyId !== req.user.companyId || employee.role !== 'employee')
            return res.status(404).json({ message: 'Employee not found' });
        const [entries, shifts, schedules, company, locations] = await Promise.all([storage.getTimeEntriesByEmployee(employee.id), storage.getShiftsByEmployee(employee.id), storage.getRecurringSchedulesByEmployee(employee.id), storage.getCompany(req.user.companyId), storage.getLocationsByCompany(req.user.companyId)]);
        const locationName = (id: string) => locations.find((l: any) => l.id === id)?.name || null;
        res.json({ entries: entries.map((e: any) => ({ ...e, locationName: locationName(e.locationId) || locationName(shifts.find((s: any) => s.id === e.shiftId)?.locationId) })).filter((e: any) => e.companyId === req.user.companyId).sort((a: any, b: any) => b.clockInAt.localeCompare(a.clockInAt)), shifts: shifts.map((s: any) => ({ ...s, locationName: locationName(s.locationId) })).filter((s: any) => s.companyId === req.user.companyId).sort((a: any, b: any) => b.shiftDate.localeCompare(a.shiftDate)), schedules: schedules.filter((s: any) => s.companyId === req.user.companyId), timezone: company?.timezone || 'UTC' });
    }
    catch {
        res.status(500).json({ message: 'Could not load employee activity' });
    } });
    for (const kind of ['clients', 'employees']) {
        const targetFor = async (id: string) => kind === 'clients' ? storage.getClient(id) : storage.getUser(id);
        app.post(`/api/${kind}/:id/avatar`, requireRole('admin'), async (req: any, res: any) => { try {
            const target = await targetFor(req.params.id);
            if (!target || target.companyId !== req.user.companyId || (kind === 'employees' && target.role !== 'employee'))
                return res.status(404).json({ message: 'Profile not found' });
            const data = req.body.imageData;
            const match = typeof data === 'string' && data.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
            if (!match)
                return res.status(400).json({ message: 'Choose a PNG, JPEG or WebP image' });
            const buffer = Buffer.from(match[2], 'base64');
            if (!buffer.length || buffer.length > 2 * 1024 * 1024)
                return res.status(400).json({ message: 'Profile image must be smaller than 2 MB' });
            const actual = buffer.subarray(0, 8).toString('hex');
            if (!(match[1] === 'jpeg' && actual.startsWith('ffd8ff') || match[1] === 'png' && actual === '89504e470d0a1a0a' || match[1] === 'webp' && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'))
                return res.status(400).json({ message: 'This image could not be verified' });
            const directory = path.join(dataDirectory, 'private_profile_photos');
            await fs.mkdir(directory, { recursive: true });
            const file = path.join(directory, `${req.user.companyId}-${target.id}-${randomBytes(16).toString('hex')}`);
            const mime = `image/${match[1]}`;
            await writePersistentFile(file, buffer, mime);
            const updates = { avatarFilePath: file, avatarMimeType: mime, avatarUrl: `/api/${kind}/${target.id}/avatar?v=${Date.now()}` };
            const updated = kind === 'clients' ? await storage.updateClient(target.id, updates) : await storage.updateUser(target.id, updates);
            res.json(kind === 'clients' ? { ...updated, avatarFilePath: undefined, avatarMimeType: undefined } : safePerson(updated));
        }
        catch {
            res.status(500).json({ message: 'The image could not be saved. Please retry.' });
        } });
        app.get(`/api/${kind}/:id/avatar`, requireAuth, async (req: any, res: any) => { try {
            const target = await targetFor(req.params.id);
            if (!target || target.companyId !== req.user.companyId || (req.user.role !== 'admin' && !(kind === 'employees' && target.id === req.user.id) && !(kind === 'clients' && target.userId === req.user.id)))
                return res.sendStatus(404);
            if (!target.avatarFilePath)
                return res.sendStatus(404);
            const data = await readPersistentFile(target.avatarFilePath);
            if (!data)
                return res.sendStatus(404);
            res.set({ 'Content-Type': target.avatarMimeType, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' }).send(data);
        }
        catch {
            res.sendStatus(503);
        } });
    }
}
