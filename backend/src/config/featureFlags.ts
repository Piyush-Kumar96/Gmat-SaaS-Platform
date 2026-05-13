/**
 * Runtime feature flags. Toggle in the source (or via env) — no rebuild
 * dance needed beyond restarting ts-node-dev. Keep the surface tiny: this
 * file is the index, the comments are the docs.
 */

const envBool = (name: string, fallback: boolean): boolean => {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return ['1', 'true', 'on', 'yes'].includes(v.toLowerCase());
};

export type QuestionSourceMode = 'legacy_global' | 'tenant_scoped';

const envEnum = <T extends string>(name: string, allowed: readonly T[], fallback: T): T => {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export const featureFlags = {
  /**
   * When true, every quiz fetch (`/random` on both V2 and V3) runs the
   * deterministic question validator from `services/questionQA.ts` over the
   * candidate pool, drops anything that fails the checks, and tops up from
   * the same source. When false, candidates pass through unchanged.
   *
   * Set to false if QA starts blocking quiz generation while we tune it.
   * Override at runtime with `QUIZ_QA_ENABLED=false` in `backend/.env`.
   */
  QUIZ_QA_ENABLED: envBool('QUIZ_QA_ENABLED', true),

  /**
   * Controls which question pool end-user routes serve.
   *
   * - 'legacy_global': legacy / dev posture. Routes serve QuestionBagV2 / V3
   *   without account scoping (current pre-tenancy behavior). Default for
   *   local dev and ongoing testing while the tenancy migration lands.
   * - 'tenant_scoped': production posture. Routes filter by the caller's
   *   `accountId`. Plus, if the caller has `legacyAccessEnabled=true`, the
   *   query also includes the super-admin's account (the legacy OG pool).
   *
   * Override at runtime with `QUESTION_SOURCE_MODE=tenant_scoped` in
   * `backend/.env`. See `LAUNCH_BUILD_PLAN.md` Phase 0b/1 for context.
   */
  QUESTION_SOURCE_MODE: envEnum<QuestionSourceMode>(
    'QUESTION_SOURCE_MODE',
    ['legacy_global', 'tenant_scoped'] as const,
    'legacy_global'
  ),

  /**
   * Super-admin CRM visibility mode. Defaults to FALSE (privacy-safe
   * production posture) — super-admin sees only aggregates / metadata,
   * cannot view individual question content or quiz answers without an
   * explicit support ticket reference.
   *
   * Set `CRM_FULL_VISIBILITY=true` in `backend/.env` for ops mode (debug
   * pre-launch and during incident triage). Every drill-down made under
   * full-visibility mode is logged to `SuperAdminAuditLog`.
   */
  CRM_FULL_VISIBILITY: envBool('CRM_FULL_VISIBILITY', false),
};
