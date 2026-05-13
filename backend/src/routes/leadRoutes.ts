/**
 * Lead capture routes.
 *
 * Public POST /api/leads — accepts an access-request (name, email, phone,
 * source) and writes a `LeadRequest` row. No auth. Idempotent on email:
 * a duplicate email re-submission updates the existing 'new' lead rather
 * than creating a second row.
 *
 * Admin GET / PATCH endpoints are deferred to Phase 4 (super-admin CRM).
 *
 * See `LAUNCH_BUILD_PLAN.md` Phase 1b.
 */
import express, { Request, Response } from 'express';
import { LeadRequest, LeadSource } from '../models/LeadRequest';

const router = express.Router();

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const ALLOWED_SOURCES: LeadSource[] = ['login_page', 'whatsapp', 'referral', 'other'];

router.post('/', async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = req.body?.phone ? String(req.body.phone).trim() : undefined;
    const sourceRaw = String(req.body?.source || 'login_page');
    const source: LeadSource = (ALLOWED_SOURCES as string[]).includes(sourceRaw)
      ? (sourceRaw as LeadSource)
      : 'login_page';

    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    if (!email || !isEmail(email)) {
      return res.status(400).json({ success: false, message: 'A valid email is required.' });
    }
    if (phone && phone.length > 30) {
      return res.status(400).json({ success: false, message: 'Phone is too long.' });
    }

    // Idempotent on email when the prior lead is still 'new'. If the lead
    // has been actioned (contacted / converted / rejected), keep the
    // historical row and create a fresh one so the audit trail is intact.
    const existing = await LeadRequest.findOne({ email, status: 'new' });
    if (existing) {
      existing.name = name;
      existing.phone = phone;
      existing.source = source;
      await existing.save();
      return res.status(200).json({ success: true, message: 'Request received. We will reach out soon.', id: existing._id });
    }

    const lead = await LeadRequest.create({ name, email, phone, source });
    return res.status(201).json({
      success: true,
      message: 'Request received. We will reach out soon.',
      id: lead._id,
    });
  } catch (err) {
    console.error('Lead capture error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
