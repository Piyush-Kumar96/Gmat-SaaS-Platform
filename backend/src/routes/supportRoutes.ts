/**
 * Support / contact routes.
 *
 * Public POST /api/support — anyone (auth optional) can submit a support
 * request. When a Bearer token is provided we attach the user id, otherwise
 * the visitor supplies their own name + email.
 *
 * Admin GET / PATCH / DELETE live in `/api/admin/support` (see adminRoutes).
 */
import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { SupportRequest, SUPPORT_CATEGORY_VALUES, SupportCategory } from '../models/SupportRequest';
import { User } from '../models/User';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-do-not-use-in-production';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

router.post('/', async (req: Request, res: Response) => {
  try {
    const categoryRaw = String(req.body?.category || 'other');
    const category: SupportCategory = (SUPPORT_CATEGORY_VALUES as string[]).includes(categoryRaw)
      ? (categoryRaw as SupportCategory)
      : 'other';

    const message = String(req.body?.message || '').trim();
    if (!message || message.length < 5) {
      return res.status(400).json({ success: false, message: 'Please describe your issue (at least 5 characters).' });
    }
    if (message.length > 4000) {
      return res.status(400).json({ success: false, message: 'Message is too long (max 4000 characters).' });
    }

    let name = String(req.body?.name || '').trim();
    let email = String(req.body?.email || '').trim().toLowerCase();
    let userId: string | undefined;

    // If a token is supplied, prefer the authenticated user's identity.
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        const user = await User.findById(decoded.userId).select('email fullName');
        if (user) {
          userId = user._id.toString();
          email = user.email;
          name = user.fullName || name;
        }
      } catch {
        // Token bad / expired — fall through to anonymous submission.
      }
    }

    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, message: 'Please provide your name.' });
    }
    if (!email || !isEmail(email)) {
      return res.status(400).json({ success: false, message: 'A valid email is required.' });
    }

    const pageUrl = req.body?.pageUrl ? String(req.body.pageUrl).slice(0, 500) : undefined;
    const userAgent = req.headers['user-agent'] ? String(req.headers['user-agent']).slice(0, 500) : undefined;

    const ticket = await SupportRequest.create({
      name,
      email,
      userId,
      category,
      message,
      pageUrl,
      userAgent,
    });

    return res.status(201).json({
      success: true,
      message: 'Thanks — we received your request and will respond within 48 hours.',
      id: ticket._id,
    });
  } catch (err) {
    console.error('Support request capture error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
