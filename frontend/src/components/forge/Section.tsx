import React from 'react';

/**
 * Reusable section primitive used inside form bodies. Replaces the heavier
 * <Card> + AntD chrome with a cleaner Tailwind-first styling.
 */
interface SectionProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Subdued background for nested sections inside another card */
  tone?: 'default' | 'subtle';
}

const Section: React.FC<SectionProps> = ({
  title,
  description,
  badge,
  children,
  actions,
  className = '',
  tone = 'default'
}) => {
  return (
    <section
      className={`rounded-2xl border border-gray-200/80 ${
        tone === 'subtle' ? 'bg-gray-50/60' : 'bg-white'
      } overflow-hidden ${className}`}
    >
      <header className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 leading-tight">{title}</h3>
            {badge}
          </div>
          {description && (
            <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
};

export default Section;

/** Primitive labelled field — replaces AntD Form.Item to keep the look consistent. */
export const Field: React.FC<{
  label: React.ReactNode;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ label, hint, required, children, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <label className="text-[13px] font-medium text-gray-700 flex items-center gap-1">
      {label}
      {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
    {hint && <div className="text-[12px] text-gray-400">{hint}</div>}
  </div>
);

/** Soft note / instruction block — replaces AntD <Alert /> */
export const Note: React.FC<{
  tone?: 'info' | 'warning';
  title?: React.ReactNode;
  children: React.ReactNode;
}> = ({ tone = 'info', title, children }) => {
  const palette =
    tone === 'warning'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-orange-50/70 border-orange-200 text-orange-900';
  return (
    <div className={`rounded-xl border ${palette} px-4 py-3 text-[13px] leading-relaxed`}>
      {title && <div className="font-semibold mb-0.5">{title}</div>}
      <div className={tone === 'warning' ? 'text-amber-800/90' : 'text-orange-800/90'}>
        {children}
      </div>
    </div>
  );
};
