import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MyQuestion,
  MyQuestionInput,
  createMyQuestion,
  deleteMyQuestion,
  listMyQuestions,
  updateMyQuestion,
} from '../services/myQuestions';

// Phase 2 (B2C) + Phase 3 (B2B) UGC question bank.
// Supports the simple multiple-choice types here (PS / DS / CR / RC).
// DI types (MSR / TPA / GT) live in the admin Question Forge — they have
// nested artifacts that need a richer editor than this page.

type QType = 'PS' | 'DS' | 'CR' | 'RC';

interface FormState {
  questionType: QType;
  category: 'Quant' | 'Verbal';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionText: string;
  passageText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  correctAnswer: string;
  explanation: string;
  attestation: boolean;
}

const EMPTY_FORM: FormState = {
  questionType: 'PS',
  category: 'Quant',
  difficulty: 'Medium',
  questionText: '',
  passageText: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  optionE: '',
  correctAnswer: 'A',
  explanation: '',
  attestation: false,
};

const TYPE_TO_CATEGORY: Record<QType, 'Quant' | 'Verbal'> = {
  PS: 'Quant',
  DS: 'Quant',
  CR: 'Verbal',
  RC: 'Verbal',
};

function formToInput(form: FormState): MyQuestionInput {
  const options: Record<string, string> = {};
  if (form.optionA) options.A = form.optionA;
  if (form.optionB) options.B = form.optionB;
  if (form.optionC) options.C = form.optionC;
  if (form.optionD) options.D = form.optionD;
  if (form.optionE) options.E = form.optionE;
  return {
    questionText: form.questionText.trim(),
    questionType: form.questionType,
    category: form.category,
    difficulty: form.difficulty,
    options,
    correctAnswer: form.correctAnswer,
    passageText: form.questionType === 'RC' || form.questionType === 'CR' ? form.passageText.trim() || undefined : undefined,
    explanation: form.explanation.trim() || undefined,
    source: 'User-uploaded',
  };
}

function questionToForm(q: MyQuestion): FormState {
  return {
    questionType: (q.questionType as QType) || 'PS',
    category: (q.category as 'Quant' | 'Verbal') || 'Quant',
    difficulty: (q.difficulty as 'Easy' | 'Medium' | 'Hard') || 'Medium',
    questionText: q.questionText || '',
    passageText: q.passageText || '',
    optionA: q.options?.A || '',
    optionB: q.options?.B || '',
    optionC: q.options?.C || '',
    optionD: q.options?.D || '',
    optionE: q.options?.E || '',
    correctAnswer: q.correctAnswer || 'A',
    explanation: q.explanation || '',
    attestation: true, // editing a saved question — already attested
  };
}

const MyQuestionsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<MyQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('');

  const [editing, setEditing] = useState<MyQuestion | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isMember = useMemo(() => {
    // Members can read but not write. AuthContext doesn't expose accountRole
    // yet (Phase 4 will). Until then, treat everyone as able to manage; the
    // backend enforces the real check.
    return false;
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filterType]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await listMyQuestions({
        limit: 100,
        questionType: filterType || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load your questions.');
    } finally {
      setLoading(false);
    }
  }

  // Admin users get routed to the Question Forge — it handles all the
  // non-DI shapes (RC passages, DS statements, math symbols for PS) plus
  // the DI shapes the inline modal here can't represent. Non-admin users
  // stay on the inline modal: it covers their use case (simple PS/DS/CR/RC)
  // and the Forge currently requires admin to write to the global banks.
  function openCreate() {
    if (user?.role === 'admin') {
      navigate('/forge');
      return;
    }
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(q: MyQuestion) {
    setEditing(q);
    setForm(questionToForm(q));
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'questionType') {
        next.category = TYPE_TO_CATEGORY[value as QType];
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!editing && !form.attestation) {
      setFormError('Please confirm you have the right to upload this content.');
      return;
    }
    if (form.questionText.trim().length < 5) {
      setFormError('Question text is required (at least 5 characters).');
      return;
    }
    const filledOptions = ['A', 'B', 'C', 'D', 'E'].filter(
      (k) => (form as any)[`option${k}`]?.trim()
    );
    if (filledOptions.length < 2) {
      setFormError('At least two answer options are required.');
      return;
    }
    if (!filledOptions.includes(form.correctAnswer)) {
      setFormError('The correct answer must match one of the filled-in options.');
      return;
    }

    setSaving(true);
    try {
      const input = formToInput(form);
      if (editing) {
        await updateMyQuestion(editing._id, input);
      } else {
        await createMyQuestion(input);
      }
      await load();
      closeForm();
    } catch (e: any) {
      const msg = e?.response?.data?.errors?.join('; ') || e?.response?.data?.message || 'Save failed.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(q: MyQuestion) {
    if (!window.confirm(`Delete this ${q.questionType} question? This cannot be undone.`)) return;
    try {
      await deleteMyQuestion(q._id);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Delete failed.');
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Questions</h1>
          <p className="text-sm text-gray-600 mt-1">
            Your private question bank. Only you (and other members of your account, if any) can see these.
          </p>
        </div>
        {!isMember && (
          <button
            onClick={openCreate}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
          >
            + Add question
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm text-gray-600">Filter:</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All types</option>
          <option value="PS">Problem Solving</option>
          <option value="DS">Data Sufficiency</option>
          <option value="CR">Critical Reasoning</option>
          <option value="RC">Reading Comprehension</option>
        </select>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-600 mb-3">No questions yet.</p>
          {!isMember && (
            <button
              onClick={openCreate}
              className="text-indigo-600 font-medium hover:text-indigo-500"
            >
              Add your first question →
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Difficulty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Answer</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((q) => (
                <tr key={q._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{q.questionType}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-md truncate">{q.questionText}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{q.difficulty || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{q.correctAnswer || '—'}</td>
                  <td className="px-4 py-3 text-sm text-right space-x-3">
                    {!isMember && (
                      <>
                        <button
                          onClick={() => openEdit(q)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(q)}
                          className="text-red-600 hover:text-red-900 font-medium"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full my-8">
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editing ? 'Edit question' : 'New question'}
                </h2>
                <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                  ×
                </button>
              </div>

              <div className="px-6 py-4 space-y-4">
                {formError && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">{formError}</div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={form.questionType}
                      onChange={(e) => updateForm('questionType', e.target.value as QType)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="PS">PS — Problem Solving</option>
                      <option value="DS">DS — Data Sufficiency</option>
                      <option value="CR">CR — Critical Reasoning</option>
                      <option value="RC">RC — Reading Comprehension</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={form.category}
                      readOnly
                      className="w-full border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                    <select
                      value={form.difficulty}
                      onChange={(e) => updateForm('difficulty', e.target.value as 'Easy' | 'Medium' | 'Hard')}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option>Easy</option>
                      <option>Medium</option>
                      <option>Hard</option>
                    </select>
                  </div>
                </div>

                {(form.questionType === 'RC' || form.questionType === 'CR') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {form.questionType === 'RC' ? 'Passage' : 'Argument / Stimulus'}
                    </label>
                    <textarea
                      value={form.passageText}
                      onChange={(e) => updateForm('passageText', e.target.value)}
                      rows={5}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder={form.questionType === 'RC' ? 'Paste the reading passage here…' : 'Paste the argument here…'}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                  <textarea
                    value={form.questionText}
                    onChange={(e) => updateForm('questionText', e.target.value)}
                    rows={3}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="The question stem…"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['A', 'B', 'C', 'D', 'E'] as const).map((letter) => {
                    const key = `option${letter}` as keyof FormState;
                    return (
                      <div key={letter}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Option {letter}</label>
                        <input
                          type="text"
                          value={form[key] as string}
                          onChange={(e) => updateForm(key, e.target.value as any)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          placeholder={letter === 'E' ? 'Optional' : ''}
                        />
                      </div>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correct answer</label>
                  <select
                    value={form.correctAnswer}
                    onChange={(e) => updateForm('correctAnswer', e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    {(['A', 'B', 'C', 'D', 'E'] as const).map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Explanation <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={form.explanation}
                    onChange={(e) => updateForm('explanation', e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>

                {!editing && (
                  <label className="flex items-start gap-2 text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <input
                      type="checkbox"
                      checked={form.attestation}
                      onChange={(e) => updateForm('attestation', e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      I confirm I have the right to upload this content for my personal study, and I am not
                      uploading copyrighted material that I do not own or have permission to use.
                    </span>
                  </label>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyQuestionsPage;
