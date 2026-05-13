/**
 * /api/my-questions/* — tenant-scoped CRUD over a user's account questions.
 *
 * For B2C individuals: their account is private, so this is effectively a
 * personal question bank.
 * For B2B accounts: routes are scoped to the user's `accountId`. Members
 * see only `shared_within_account` questions plus their own; owners and
 * admins see and manage everything in the account. Members cannot create,
 * update, or delete.
 *
 * Always uses QuestionBagV3 as the underlying collection. Legacy V2 docs
 * are read-only via the random-pull endpoint and don't need a separate
 * write surface for end users.
 *
 * See LAUNCH_BUILD_PLAN.md Phase 2 + 3.
 */
import express, { Response } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/roleAuth';
import { QuestionBagV3 } from '../models/QuestionBagV3';
import {
  tenantScope,
  visibilityFilterForRead,
  canManageAccountQuestions,
  TenancyMissingAccountError,
} from '../services/tenancy';

const router = express.Router();

const MAX_LIST_LIMIT = 200;

function handleTenancyError(err: unknown, res: Response): boolean {
  if (err instanceof TenancyMissingAccountError) {
    res.status(500).json({ success: false, code: err.code, message: err.message });
    return true;
  }
  return false;
}

/**
 * Minimal validation for user-uploaded questions. The admin Question Forge
 * has stricter validation in questionBagV3Routes.ts; here we only check the
 * critical structural requirements so a user can save a draft and refine.
 */
function validateQuestionPayload(body: any): string[] {
  const errors: string[] = [];
  if (!body?.questionText || typeof body.questionText !== 'string' || body.questionText.trim().length < 5) {
    errors.push('questionText is required (min 5 chars).');
  }
  if (!body?.questionType || typeof body.questionType !== 'string') {
    errors.push('questionType is required.');
  }
  if (!body?.category || typeof body.category !== 'string') {
    errors.push('category is required (Quant / Verbal / DI).');
  }
  // Single-answer types need options + correctAnswer; the DI multi-part
  // types use subQuestions which we trust the frontend to assemble correctly.
  const singleAnswerTypes = ['PS', 'DS', 'CR', 'RC', 'DI-DS'];
  if (singleAnswerTypes.includes(body.questionType)) {
    if (!body.options || typeof body.options !== 'object' || Object.keys(body.options).length < 2) {
      errors.push('options is required (at least 2 entries).');
    }
    if (!body.correctAnswer || typeof body.correctAnswer !== 'string') {
      errors.push('correctAnswer is required.');
    }
  }
  return errors;
}

// GET /api/my-questions — list questions in caller's account
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const scope = await tenantScope(req);
    const visibility = visibilityFilterForRead(req);

    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, MAX_LIST_LIMIT);
    const skip = parseInt(String(req.query.skip || '0'), 10) || 0;
    const questionType = req.query.questionType ? String(req.query.questionType) : undefined;

    const filter: any = { ...scope, ...visibility };
    if (questionType) filter.questionType = questionType;

    const [items, total] = await Promise.all([
      QuestionBagV3.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      QuestionBagV3.countDocuments(filter),
    ]);

    return res.json({ success: true, items, total, limit, skip });
  } catch (err: any) {
    if (handleTenancyError(err, res)) return;
    console.error('Error listing my-questions:', err);
    return res.status(500).json({ success: false, message: 'Failed to list questions.' });
  }
});

// POST /api/my-questions — create in caller's account
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!canManageAccountQuestions(req)) {
      return res.status(403).json({
        success: false,
        message: 'Account members are read-only. Ask an account admin to add questions.',
      });
    }

    if (req.body?.attestation !== true) {
      return res.status(400).json({
        success: false,
        message: 'You must confirm you have the right to upload this content.',
      });
    }

    const errors = validateQuestionPayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const accountId = req.user?.accountId;
    if (!accountId) throw new TenancyMissingAccountError(req.user?.userId);

    // Strip any client-supplied accountId / createdByUserId; we set them
    // server-side. Also strip attestation since it's metadata, not a field.
    const { attestation: _att, accountId: _aid, createdByUserId: _cuid, ...rest } = req.body;

    const doc = await QuestionBagV3.create({
      ...rest,
      source: rest.source || 'User-uploaded',
      sourceDetails: rest.sourceDetails || { url: '' },
      tags: rest.tags || [],
      metadata: rest.metadata || {},
      statistics: rest.statistics || { answeredCount: 0, correctPercentage: '' },
      entryMethod: 'manual',
      validationStatus: rest.validationStatus || null,
      accountId: new mongoose.Types.ObjectId(accountId),
      createdByUserId: new mongoose.Types.ObjectId(req.user!.userId),
      visibility: rest.visibility === 'private_to_creator' ? 'private_to_creator' : 'shared_within_account',
    });

    return res.status(201).json({ success: true, question: doc });
  } catch (err: any) {
    if (handleTenancyError(err, res)) return;
    console.error('Error creating my-question:', err);
    if (err?.name === 'ValidationError' && err?.errors) {
      const errors = Object.entries(err.errors).map(
        ([path, e]: [string, any]) => `${path}: ${e.message || String(e)}`
      );
      return res.status(400).json({ success: false, message: 'Schema validation failed', errors });
    }
    return res.status(500).json({ success: false, message: 'Failed to create question.' });
  }
});

// Helper: load a question and confirm caller is allowed to mutate it.
async function loadOwnedQuestion(req: AuthRequest, res: Response) {
  if (!canManageAccountQuestions(req)) {
    res.status(403).json({
      success: false,
      message: 'Account members cannot edit or delete questions.',
    });
    return null;
  }
  const scope = await tenantScope(req);
  const q: any = await QuestionBagV3.findOne({ _id: req.params.id, ...scope });
  if (!q) {
    res.status(404).json({ success: false, message: 'Question not found in your account.' });
    return null;
  }
  // Owners/admins can mutate any question in the account; others (shouldn't
  // reach here given canManageAccountQuestions) only their own creations.
  const isOwnerOrAdmin = req.user?.accountRole === 'owner' || req.user?.accountRole === 'admin' || req.user?.role === 'admin';
  if (!isOwnerOrAdmin) {
    if (q.createdByUserId?.toString() !== req.user?.userId) {
      res.status(403).json({
        success: false,
        message: 'You can only edit questions you created.',
      });
      return null;
    }
  }
  return q;
}

// PUT /api/my-questions/:id
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const q = await loadOwnedQuestion(req, res);
    if (!q) return;

    // Block client overrides of tenancy fields and identity fields.
    const { accountId: _a, createdByUserId: _c, _id: _id2, ...patch } = req.body;

    Object.assign(q, patch);
    await q.save();
    return res.json({ success: true, question: q });
  } catch (err: any) {
    if (handleTenancyError(err, res)) return;
    console.error('Error updating my-question:', err);
    return res.status(500).json({ success: false, message: 'Failed to update question.' });
  }
});

// DELETE /api/my-questions/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const q = await loadOwnedQuestion(req, res);
    if (!q) return;
    await q.deleteOne();
    return res.json({ success: true });
  } catch (err: any) {
    if (handleTenancyError(err, res)) return;
    console.error('Error deleting my-question:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete question.' });
  }
});

export default router;
