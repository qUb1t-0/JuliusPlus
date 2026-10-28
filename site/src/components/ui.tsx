import { useEffect, useId, useRef, type ReactNode } from 'react';
import { money, pct } from '../lib/format';
import { useStore } from '../lib/store';
import type { BudgetStatus } from '../lib/selectors';
import type { Cents } from '../types';

export function Money({ cents, signed = false, className = '' }: { cents: Cents; signed?: boolean; className?: string }) {
  const { data } = useStore();
  const hidden = data.settings.hideValues;
  const sign = signed && cents > 0 ? '+' : '';
  return (
    <span className={`money ${className}`} aria-label={hidden ? 'Valor oculto' : undefined}>
      {hidden ? money(cents, true) : sign + money(cents)}
    </span>
  );
}

// Diálogo nativo <dialog>: foco preso, Esc para fechar e fundo inerte sem bibliotecas.
// Clicar fora não fecha, para não perder o que já foi digitado; só Esc ou o ✕.
export function Modal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onClose={onClose}
    >
      {open && (
        <div className="modal-body">
          <header className="modal-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">✕</button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Progress({ value, max, status = 'ok', label }: { value: number; max: number; status?: BudgetStatus; label: string }) {
  const p = Math.min(100, pct(value, max));
  return (
    <div className={`progress progress-${status}`} role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct(value, max)}>
      <div className="progress-fill" style={{ width: `${p}%` }} />
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>{icon}</div>
      <p className="empty-title">{title}</p>
      {children}
    </div>
  );
}

export const CHART_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];

export function Donut({ slices, center }: { slices: { label: string; value: number }[]; center: ReactNode }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 128 128" role="img" aria-label={slices.map((s) => `${s.label} ${pct(s.value, total)}%`).join(', ')}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--track)" strokeWidth="16" />
        {total > 0 && slices.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle key={s.label} cx="64" cy="64" r={r} fill="none" stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth="16" strokeDasharray={`${Math.max(len - 1.5, 0)} ${c}`} strokeDashoffset={-offset}
              transform="rotate(-90 64 64)" />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="donut-center">{center}</div>
    </div>
  );
}

export function Bars({ data, hidden }: { data: { label: string; income: number; expense: number }[]; hidden: boolean }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  return (
    <div className="bars" role="img"
      aria-label={hidden ? 'Gráfico de receitas e despesas (valores ocultos)' : data.map((d) => `${d.label}: receitas ${money(d.income)}, despesas ${money(d.expense)}`).join('; ')}>
      {data.map((d) => (
        <div key={d.label} className="bars-col">
          <div className="bars-pair">
            <div className="bar bar-income" style={{ height: `${(d.income / max) * 100}%` }} />
            <div className="bar bar-expense" style={{ height: `${(d.expense / max) * 100}%` }} />
          </div>
          <span className="bars-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
