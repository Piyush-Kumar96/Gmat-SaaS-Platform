import React from 'react';
import { FORGE_TYPES, ForgeQuestionType } from './types';

/**
 * Inline type picker — rendered as the initial "splash" state of the Forge
 * page (not a Modal) so the entry experience looks like a deliberate
 * landing rather than a popup that may or may not appear.
 *
 * Each tile is a large gradient card with a hover-lift effect.
 */
interface Props {
  onPick: (t: ForgeQuestionType) => void;
  /** When the picker is shown after a type was already chosen (e.g. via "Switch type"), allow cancel. */
  onCancel?: () => void;
}

const TYPE_GRADIENTS: Record<ForgeQuestionType, { from: string; to: string; ring: string; text: string; iconBg: string; }> = {
  'CLASSIC':         { from: 'from-indigo-500',  to: 'to-violet-600',  ring: 'hover:ring-indigo-300',  text: 'text-indigo-50',  iconBg: 'bg-indigo-400/30' },
  'DI-DS':           { from: 'from-blue-500',    to: 'to-indigo-600',  ring: 'hover:ring-blue-300',    text: 'text-blue-50',    iconBg: 'bg-blue-400/30' },
  'DI-GT-MC':        { from: 'from-teal-500',    to: 'to-emerald-600', ring: 'hover:ring-teal-300',    text: 'text-teal-50',    iconBg: 'bg-teal-400/30' },
  'DI-GT-YESNO':     { from: 'from-emerald-500', to: 'to-green-600',   ring: 'hover:ring-emerald-300', text: 'text-emerald-50', iconBg: 'bg-emerald-400/30' },
  'DI-GT-DROPDOWN':  { from: 'from-cyan-500',    to: 'to-sky-600',     ring: 'hover:ring-cyan-300',    text: 'text-cyan-50',    iconBg: 'bg-cyan-400/30' },
  'DI-MSR':          { from: 'from-purple-500',  to: 'to-fuchsia-600', ring: 'hover:ring-purple-300',  text: 'text-purple-50',  iconBg: 'bg-purple-400/30' },
  'DI-TPA':          { from: 'from-orange-500',  to: 'to-rose-600',    ring: 'hover:ring-orange-300',  text: 'text-orange-50',  iconBg: 'bg-orange-400/30' }
};

const TYPE_GLYPH: Record<ForgeQuestionType, string> = {
  'CLASSIC': '✎',
  'DI-DS': '⊃',
  'DI-GT-MC': '⌗',
  'DI-GT-YESNO': '✓',
  'DI-GT-DROPDOWN': '▾',
  'DI-MSR': '☰',
  'DI-TPA': '⇆'
};

const TypePicker: React.FC<Props> = ({ onPick, onCancel }) => {
  return (
    <div className="relative">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold tracking-wide uppercase mb-4">
          Question Forge · Step 1
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
          What kind of question are we forging?
        </h2>
        <p className="mt-3 text-gray-500 max-w-xl mx-auto">
          Pick a Data Insights question shape. The editor adapts to the type, and your draft is auto-saved as you go.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {FORGE_TYPES.map((t) => {
          const g = TYPE_GRADIENTS[t.id];
          return (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${g.from} ${g.to} text-left p-6 ring-1 ring-black/5 shadow-lg shadow-gray-900/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:ring-2 ${g.ring}`}
            >
              {/* decorative blob */}
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none transition-opacity duration-300 group-hover:opacity-80" />
              <div className="absolute -bottom-16 -left-12 w-44 h-44 rounded-full bg-white/5 blur-2xl pointer-events-none" />

              <div className={`relative w-12 h-12 rounded-xl ${g.iconBg} flex items-center justify-center text-2xl font-bold ${g.text} mb-5`}>
                {TYPE_GLYPH[t.id]}
              </div>
              <div className={`relative text-xs font-semibold uppercase tracking-wider ${g.text} opacity-80`}>
                {t.shortLabel}
              </div>
              <div className="relative mt-1 text-lg font-semibold text-white leading-snug">
                {t.label}
              </div>
              <div className={`relative mt-3 text-sm ${g.text} opacity-90 leading-relaxed`}>
                {t.blurb}
              </div>

              <div className="relative mt-5 inline-flex items-center gap-1 text-sm font-semibold text-white/90 group-hover:text-white">
                Start
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </div>
            </button>
          );
        })}
      </div>

      {onCancel && (
        <div className="mt-8 text-center">
          <button
            onClick={onCancel}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 underline-offset-4 hover:underline"
          >
            Cancel — keep editing the current question
          </button>
        </div>
      )}
    </div>
  );
};

export default TypePicker;
