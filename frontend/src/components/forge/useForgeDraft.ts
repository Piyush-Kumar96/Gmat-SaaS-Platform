import { useEffect, useRef } from 'react';
import { ForgeQuestionType, ForgeState } from './types';

/**
 * localStorage autosave for Forge drafts. Key is per-type so switching the
 * picker doesn't blow away in-progress work.
 *
 * In edit mode, pass `editId` to scope the draft to a specific question.
 */
const draftKey = (forgeType: ForgeQuestionType, editId?: string) =>
  editId ? `forge:draft:edit:${editId}` : `forge:draft:${forgeType}`;

export const loadDraft = (forgeType: ForgeQuestionType, editId?: string): ForgeState | null => {
  try {
    const raw = localStorage.getItem(draftKey(forgeType, editId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.forgeType ? (parsed as ForgeState) : null;
  } catch {
    return null;
  }
};

export const clearDraft = (forgeType: ForgeQuestionType, editId?: string) => {
  try {
    localStorage.removeItem(draftKey(forgeType, editId));
  } catch {
    /* noop */
  }
};

/**
 * Debounced autosave hook. Writes to localStorage 800ms after the last edit.
 */
export const useForgeAutosave = (state: ForgeState, editId?: string) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(state.forgeType, editId), JSON.stringify(state));
      } catch {
        /* noop — quota or disabled */
      }
    }, 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state, editId]);
};
