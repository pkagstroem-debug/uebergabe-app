// Kleine wiederverwendbare UI-Bausteine (Dark Theme)

import React from 'react';

export const Card = ({ children, className = '' }) => (
  <div className={`rounded-xl bg-[#1a1a19] border border-white/10 p-4 ${className}`}>{children}</div>
);

export const SectionTitle = ({ children, right }) => (
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-base font-semibold text-white">{children}</h2>
    {right}
  </div>
);

export const Button = ({ children, onClick, variant = 'primary', disabled, type = 'button', className = '' }) => {
  const styles = {
    primary: 'bg-[#3987e5] text-white hover:bg-[#2a78d6] disabled:opacity-40',
    ghost: 'bg-white/5 text-[#c3c2b7] hover:bg-white/10 disabled:opacity-40',
    danger: 'bg-[#d03b3b]/15 text-[#e66767] hover:bg-[#d03b3b]/25 disabled:opacity-40',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder-[#898781] focus:outline-none focus:border-[#3987e5] ${props.className ?? ''}`}
  />
);

export const Textarea = (props) => (
  <textarea
    {...props}
    className={`w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder-[#898781] focus:outline-none focus:border-[#3987e5] ${props.className ?? ''}`}
  />
);

export const Select = (props) => (
  <select
    {...props}
    className={`w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3987e5] ${props.className ?? ''}`}
  />
);

export const Label = ({ children }) => <label className="block text-xs text-[#898781] mb-1">{children}</label>;

export const Badge = ({ children, color = '#898781', title }) => (
  <span
    title={title}
    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
    style={{ background: `${color}22`, color }}
  >
    {children}
  </span>
);

export const StatusBadge = ({ status }) => {
  const map = {
    offen: { label: '⏳ offen', color: '#c3c2b7' },
    richtig: { label: '✓ richtig', color: '#0ca30c' },
    falsch: { label: '✗ falsch', color: '#e66767' },
  };
  const s = map[status] ?? map.offen;
  return <Badge color={s.color}>{s.label}</Badge>;
};

export const EmptyHint = ({ children }) => (
  <div className="text-sm text-[#898781] border border-dashed border-white/10 rounded-xl p-6 text-center">
    {children}
  </div>
);
