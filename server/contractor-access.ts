import { pool } from './db';
import { isActiveMembership } from '../shared/contractor';
// Evaluated on every request; existing login sessions do not retain old grants.
export async function contractorSessionActive(user: any, database: any = pool) { const { rows: [m] } = await database.query(`SELECT m.*,b.status business_status FROM contractor_memberships m JOIN contractor_businesses b ON b.id=m.business_id AND b.company_id=m.company_id WHERE m.user_id=$1 AND m.company_id=$2`, [user.id, user.companyId]); return isActiveMembership(m); }
export function makeContractorBoundary(database: any = pool) {
    return async function contractorBoundary(req: any, res: any, next: any) {
        const requestPath=String(req.path).toLowerCase();
        if (req.user?.role !== 'contractor' || !requestPath.startsWith('/api/'))
            return next();
        if (requestPath === '/api/auth/logout')
            return next();
        try {
            if (!req.user.isActive || !await contractorSessionActive(req.user, database))
                return res.status(403).json({ message: 'Contractor access has ended or is suspended' });
            if (requestPath !== '/api/auth/me' && !requestPath.startsWith('/api/contractors/'))
                return res.status(403).json({ message: 'This area is outside your contractor workspace' });
            next();
        }
        catch {
            res.status(503).json({ message: 'Unable to verify contractor access. Please retry.' });
        }
    };
}
export const contractorBoundary = makeContractorBoundary();
