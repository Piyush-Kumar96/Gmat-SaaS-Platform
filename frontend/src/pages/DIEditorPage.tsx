import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { message, Modal } from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  ReloadOutlined,
  HistoryOutlined,
  EditOutlined,
  ExperimentOutlined
} from '@ant-design/icons';

import { ForgeQuestionType, ForgeState, FORGE_TYPES } from '../components/forge/types';
import { buildTemplate } from '../components/forge/templates';
import { useForgeAutosave, loadDraft, clearDraft } from '../components/forge/useForgeDraft';
import { forgeToPayload } from '../components/forge/serializer';
import TypePicker from '../components/forge/TypePicker';
import PreviewPane from '../components/forge/PreviewPane';
import DSForm from '../components/forge/forms/DSForm';
import GTMCForm from '../components/forge/forms/GTMCForm';
import GTYesNoForm from '../components/forge/forms/GTYesNoForm';
import GTDropdownForm from '../components/forge/forms/GTDropdownForm';
import MSRForm from '../components/forge/forms/MSRForm';
import TPAForm from '../components/forge/forms/TPAForm';
import ClassicForm from '../components/forge/forms/ClassicForm';
import { forgeClassicToV2Payload } from '../components/forge/serializer';
import {
  createQuestionBagV3,
  updateQuestionBagV3,
  getQuestionBagV3ById,
  createQuestionBagItem,
  updateQuestionBagV2
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { iconProps } from '../components/forge/iconProps';

const FORGE_VERSION = 'forge_v1';

/**
 * Best-effort hydration of a saved V3 doc back into a Forge editor state.
 * Used in edit mode (`/forge/:id`).
 */
const docToForge = (doc: any): ForgeState => {
  const persistedType = doc.questionType;
  let forgeType: ForgeQuestionType;
  if (persistedType === 'DI-DS' || persistedType === 'DS') {
    forgeType = 'DI-DS';
  } else if (persistedType === 'DI-GT') {
    const sub = (doc.subQuestions || [])[0];
    if (sub?.questionType === 'yes_no_table') forgeType = 'DI-GT-YESNO';
    else if (sub?.questionType === 'multiple_choice') forgeType = 'DI-GT-DROPDOWN';
    else forgeType = 'DI-GT-MC';
  } else if (persistedType === 'DI-MSR') {
    forgeType = 'DI-MSR';
  } else if (persistedType === 'DI-TPA') {
    forgeType = 'DI-TPA';
  } else {
    forgeType = 'DI-GT-MC';
  }

  // Reverse the FE-array transform back to A..E object
  let optionsObj: any = {};
  if (Array.isArray(doc.options)) {
    ['A', 'B', 'C', 'D', 'E'].forEach((k, i) => { optionsObj[k] = doc.options[i] || ''; });
  } else if (doc.options && typeof doc.options === 'object') {
    optionsObj = doc.options;
  }

  return {
    forgeType,
    questionText: doc.questionText || '',
    difficulty: doc.difficulty || 'Medium',
    category: doc.category || 'Data Insights',
    source: doc.source || 'Manual entry',
    sourceUrl: doc.sourceDetails?.url || '',
    tags: doc.tags || [],
    topic: doc.metadata?.topic || '',
    subtopic: doc.metadata?.subtopic || '',
    explanation: doc.explanation || '',
    readyForQuiz: !!doc.readyForQuiz,
    options: optionsObj.A !== undefined ? optionsObj : undefined,
    correctAnswer: doc.correctAnswer || '',
    artifact: {
      imageUrls: doc.artifactImages || [],
      tablesHtml: doc.artifactTables || [],
      description: doc.artifactDescription || ''
    },
    msrSources: (doc.msrSources || []).map((s: any) => ({
      tabName: s.tabName || '',
      content: s.content || '',
      imageUrls: (s.images || []).map((i: any) => i.src),
      tablesHtml: (s.tables || []).map((t: any) => t.html)
    })),
    subQuestions: (doc.subQuestions || []).map((sq: any) => ({
      questionId: sq.questionId,
      questionText: sq.questionText || '',
      questionType: sq.questionType,
      options: sq.options,
      correctMC: sq.questionType === 'multiple_choice' ? sq.correctAnswer : undefined,
      columnHeaders: sq.columnHeaders,
      statements: sq.statements,
      correctYesNo: sq.questionType === 'yes_no_table'
        ? (Array.isArray(sq.correctAnswer) ? sq.correctAnswer : [])
        : undefined,
      rowOptions: sq.rowOptions,
      correctTPA: sq.questionType === 'two_part_analysis'
        ? (Array.isArray(sq.correctAnswer) ? (sq.correctAnswer as [string, string]) : ['', ''])
        : undefined
    }))
  };
};

const DIEditorPage: React.FC = () => {
  const { id: editId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [state, setState] = useState<ForgeState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Load existing question in edit mode
  useEffect(() => {
    if (!editId) return;
    setLoading(true);
    getQuestionBagV3ById(editId)
      .then((doc) => {
        const editorState = docToForge(doc);
        const draft = loadDraft(editorState.forgeType, editId);
        if (draft) {
          setRestoredFromDraft(true);
          setState(draft);
        } else {
          setState(editorState);
        }
      })
      .catch((e) => {
        console.error(e);
        message.error('Could not load question for editing.');
        navigate('/forge');
      })
      .finally(() => setLoading(false));
  }, [editId, navigate]);

  // The picker shows inline whenever there's no chosen state — no modal toggle needed.

  useForgeAutosave(state || ({} as ForgeState), editId);

  const handlePick = (forgeType: ForgeQuestionType) => {
    const draft = loadDraft(forgeType);
    if (draft) {
      setRestoredFromDraft(true);
      setState(draft);
    } else {
      setState(buildTemplate(forgeType));
    }
    setPickerOpen(false);
  };

  const handleChange = useCallback((patch: Partial<ForgeState>) => {
    setState((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const handleResetTemplate = () => {
    if (!state) return;
    Modal.confirm({
      title: 'Reset to template?',
      content: 'This clears the current form and your local draft for this type.',
      okText: 'Reset',
      okButtonProps: { danger: true },
      onOk: () => {
        clearDraft(state.forgeType, editId);
        setState(buildTemplate(state.forgeType));
        setRestoredFromDraft(false);
      }
    });
  };

  const handleSwitchType = () => {
    setPickerOpen(true);
  };

  // CLASSIC tile (PS/DS/CR/RC) writes to QuestionBagV2; everything else is V3.
  // The branch lives here so the rest of the editor — autosave, draft restore,
  // type picker — stays type-agnostic.
  const isClassic = state?.forgeType === 'CLASSIC';

  const reportSaveError = (e: any) => {
    const data = e?.response?.data;
    const errors = data?.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      message.error({ content: errors.join(' • '), duration: 8 });
    } else {
      const detail = data?.error || data?.message || e?.message || 'Save failed.';
      message.error({ content: String(detail), duration: 8 });
    }
    console.error('[Forge save] error response:', data || e);
  };

  const handleSave = async () => {
    if (!state) return;
    if (!state.questionText || !state.questionText.trim()) {
      message.error('Question text is required.');
      return;
    }
    setSaving(true);
    try {
      let saved;
      if (isClassic) {
        const v2Payload = forgeClassicToV2Payload(state);
        if (editId) {
          saved = await updateQuestionBagV2(editId, v2Payload);
          message.success('Question updated.');
        } else {
          saved = await createQuestionBagItem(v2Payload);
          message.success('Question saved to bank.');
        }
      } else {
        const payload = forgeToPayload(state);
        payload.extractionVersion = FORGE_VERSION;
        if (editId) {
          saved = await updateQuestionBagV3(editId, payload);
          message.success('Question updated.');
        } else {
          saved = await createQuestionBagV3(payload);
          message.success('Question saved to bank.');
        }
      }
      clearDraft(state.forgeType, editId);
      if (!editId && saved?._id && !isClassic) {
        // CLASSIC edit lives in /review (V2 admin surface), not /forge/:id.
        navigate(`/forge/${saved._id}`);
      }
    } catch (e: any) {
      reportSaveError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndNew = async () => {
    if (!state) return;
    setSaving(true);
    try {
      if (isClassic) {
        await createQuestionBagItem(forgeClassicToV2Payload(state));
      } else {
        const payload = forgeToPayload(state);
        payload.extractionVersion = FORGE_VERSION;
        await createQuestionBagV3(payload);
      }
      message.success('Saved. Cleared for next question.');
      clearDraft(state.forgeType);
      setState(buildTemplate(state.forgeType));
    } catch (e: any) {
      reportSaveError(e);
    } finally {
      setSaving(false);
    }
  };

  // Cmd/Ctrl+S hotkey
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const typeMeta = useMemo(
    () => state ? FORGE_TYPES.find((t) => t.id === state.forgeType) : null,
    [state]
  );

  const formNode = useMemo(() => {
    if (!state) return null;
    const props = { state, onChange: handleChange };
    switch (state.forgeType) {
      case 'CLASSIC': return <ClassicForm {...props} />;
      case 'DI-DS': return <DSForm {...props} />;
      case 'DI-GT-MC': return <GTMCForm {...props} />;
      case 'DI-GT-YESNO': return <GTYesNoForm {...props} />;
      case 'DI-GT-DROPDOWN': return <GTDropdownForm {...props} />;
      case 'DI-MSR': return <MSRForm {...props} />;
      case 'DI-TPA': return <TPAForm {...props} />;
      default: return null;
    }
  }, [state, handleChange]);

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-semibold text-gray-700 mb-2">Question Forge</h1>
        <p className="text-gray-500">Admin access required.</p>
      </div>
    );
  }

  // Show the picker as the page's primary content when there's no chosen type yet,
  // OR when the user explicitly opens it via "Switch type". This avoids relying on
  // a Modal portal at all and gives a clean splash-style entry experience.
  const showPickerSplash = !loading && (!state || pickerOpen);

  return (
    <div className="min-h-screen relative">
      {/* Background — soft gradient + subtle noise */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50/60 to-rose-50/40 pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.6) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Sticky toolbar */}
      <div className="sticky top-16 z-20 bg-white/70 backdrop-blur-xl border-b border-gray-200/70">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/review-di"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Back to DI Question Bank"
            >
              <ArrowLeftOutlined {...iconProps} />
            </Link>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-sm shadow-orange-500/30 flex items-center justify-center text-lg">
                <ExperimentOutlined {...iconProps} />
              </div>
              <div className="leading-tight min-w-0">
                <div className="text-[11px] uppercase tracking-[0.14em] text-orange-600/80 font-semibold">
                  {editId ? 'Editing' : 'Create'} · Question Forge
                </div>
                <div className="text-base font-semibold text-gray-900 truncate">
                  {typeMeta ? typeMeta.label : 'Pick a type to begin'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {state && (
              <>
                <button
                  onClick={handleSwitchType}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <EditOutlined {...iconProps} /> Switch type
                </button>
                <button
                  onClick={handleResetTemplate}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <ReloadOutlined {...iconProps} /> Reset
                </button>
                {!editId && (
                  <button
                    onClick={handleSaveAndNew}
                    disabled={saving}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 transition-colors disabled:opacity-60"
                  >
                    Save &amp; New
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-rose-500 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-px transition-all disabled:opacity-60"
                >
                  <SaveOutlined {...iconProps} />
                  {saving ? 'Saving…' : (editId ? 'Save changes' : 'Save question')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Slim progress dots — replaces AntD Steps */}
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 pb-3">
          <ol className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-semibold">
            {[
              { label: 'Type', done: !!state, active: !state },
              { label: 'Compose', done: false, active: !!state },
              { label: 'Save', done: false, active: false }
            ].map((s, i, arr) => (
              <li key={s.label} className="flex items-center gap-2 min-w-0">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
                  s.done
                    ? 'bg-emerald-500 text-white'
                    : s.active
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/40'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {s.done ? '✓' : i + 1}
                </span>
                <span className={s.active ? 'text-orange-700' : s.done ? 'text-emerald-700' : 'text-gray-400'}>
                  {s.label}
                </span>
                {i < arr.length - 1 && (
                  <span className="w-6 h-px bg-gray-300/70" aria-hidden />
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Body */}
      <div className="relative max-w-[1720px] mx-auto px-4 sm:px-6 py-8">
        {loading && (
          <div className="space-y-3">
            <div className="h-6 w-1/3 bg-gray-200/70 rounded animate-pulse" />
            <div className="h-32 bg-gray-200/50 rounded-2xl animate-pulse" />
            <div className="h-32 bg-gray-200/40 rounded-2xl animate-pulse" />
          </div>
        )}

        {showPickerSplash && (
          <TypePicker
            onPick={handlePick}
            onCancel={state ? () => setPickerOpen(false) : undefined}
          />
        )}

        {!loading && state && !pickerOpen && (
          <>
            {restoredFromDraft && (
              <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-200 text-amber-700">
                  <HistoryOutlined {...iconProps} />
                </span>
                <div>
                  <div className="font-semibold">Draft restored</div>
                  <div className="text-amber-700/80 text-[13px]">We picked up where you left off. Hit "Reset" in the toolbar to start over.</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(560px,1fr)] gap-6">
              {/* Editor pane */}
              <div className="bg-white/90 backdrop-blur border border-gray-200/80 rounded-2xl shadow-xl shadow-gray-900/[0.04] overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-white to-orange-50/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-gray-600">
                      Editor
                    </span>
                  </div>
                  {typeMeta && (
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-700 bg-orange-100 px-2.5 py-1 rounded-full">
                      {typeMeta.shortLabel}
                    </span>
                  )}
                </div>
                <div className="p-6">
                  {formNode}
                </div>
              </div>

              {/* Preview pane (sticky on lg+) */}
              <div className="lg:sticky lg:top-40 lg:self-start">
                <PreviewPane state={state} />
              </div>
            </div>

            {/* Mobile save bar */}
            <div className="sm:hidden mt-6 flex gap-2">
              {!editId && (
                <button
                  onClick={handleSaveAndNew}
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 disabled:opacity-60"
                >
                  Save &amp; New
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-rose-500 shadow-lg shadow-orange-500/30 disabled:opacity-60"
              >
                {saving ? 'Saving…' : (editId ? 'Save changes' : 'Save question')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DIEditorPage;
