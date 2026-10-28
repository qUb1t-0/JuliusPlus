import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { addMonths, addMonthsToDate, currentMonth, monthLabel, monthOf, pad, todayISO } from '../lib/format';
import { stopEscape, useFloating } from './useFloating';

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const s = new Date(2000, i, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
});

function addDays(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(y, m - 1, d + delta);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Calendário próprio no lugar de <input type="date|month">: mesmo valor em string
// (YYYY-MM-DD ou YYYY-MM), visual do tema e navegação por teclado.
export function DatePicker({ value, onChange, mode = 'date', min, placeholder, clearable, invalid }: {
  value: string;
  onChange: (value: string) => void;
  mode?: 'date' | 'month';
  min?: string;
  placeholder?: string;
  clearable?: boolean;
  invalid?: boolean;
}) {
  const isMonth = mode === 'month';
  const today = isMonth ? currentMonth() : todayISO();
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(today);
  const close = useCallback(() => setOpen(false), []);
  const { anchorRef, floatRef } = useFloating(open, close);
  const gridRef = useRef<HTMLDivElement>(null);

  // Mês exibido (modo data) ou ano exibido (modo mês) seguem o item focado.
  const view = isMonth ? focus.slice(0, 4) : monthOf(focus);
  const blocked = (v: string) => !!min && v < min;

  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-v="${focus}"]`)?.focus({ preventScroll: true });
  }, [open, focus]);

  const show = () => {
    const start = value || (min && today < min ? min : today);
    setFocus(start);
    setOpen(true);
  };
  const dismiss = () => { setOpen(false); anchorRef.current?.focus(); };
  const pick = (v: string) => { if (blocked(v)) return; onChange(v); dismiss(); };
  const shift = (delta: number) => setFocus((f) => (isMonth ? addMonths(f, delta) : addDays(f, delta)));
  const page = (delta: number) => setFocus((f) => (isMonth ? addMonths(f, delta * 12) : addMonthsToDate(f, delta)));

  function onGridKey(e: KeyboardEvent) {
    if (stopEscape(e, dismiss)) return;
    const row = isMonth ? 3 : 7;
    switch (e.key) {
      case 'ArrowRight': shift(1); break;
      case 'ArrowLeft': shift(-1); break;
      case 'ArrowDown': shift(row); break;
      case 'ArrowUp': shift(-row); break;
      case 'PageDown': page(1); break;
      case 'PageUp': page(-1); break;
      default: return;
    }
    e.preventDefault();
  }

  const label = value ? (isMonth ? monthLabel(value) : longDate(value)) : placeholder ?? (isMonth ? 'Escolher mês' : 'Escolher data');
  const prevBlocked = !!min && (isMonth ? `${Number(view) - 1}-12` < min : addMonths(view, -1) < monthOf(min));

  let cells: string[];
  if (isMonth) {
    cells = MONTHS.map((_, i) => `${view}-${pad(i + 1)}`);
  } else {
    const [y, m] = view.split('-').map(Number);
    const first = `${view}-01`;
    const offset = new Date(y, m - 1, 1).getDay();
    cells = Array.from({ length: 42 }, (_, i) => addDays(first, i - offset));
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="date-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <span className={`trigger-value${value ? '' : ' placeholder'}`}>{label}</span>
        <svg className="trigger-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      </button>
      {open && (
        <div ref={floatRef} popover="manual" className="pop cal" role="dialog" aria-label={isMonth ? 'Escolher mês' : 'Escolher data'}
          onClick={(e) => e.preventDefault()} onKeyDown={(e) => stopEscape(e, dismiss)}>
          <div className="cal-head">
            <button type="button" className="cal-nav" aria-label={isMonth ? 'Ano anterior' : 'Mês anterior'} disabled={prevBlocked} onClick={() => page(-1)}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 4L6 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span className="cal-title" aria-live="polite">{isMonth ? view : monthLabel(view)}</span>
            <button type="button" className="cal-nav" aria-label={isMonth ? 'Próximo ano' : 'Próximo mês'} onClick={() => page(1)}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          {!isMonth && <div className="cal-week" aria-hidden="true">{WEEK.map((d, i) => <span key={i}>{d}</span>)}</div>}
          <div ref={gridRef} className={`cal-grid${isMonth ? ' cal-months' : ''}`} onKeyDown={onGridKey}>
            {cells.map((v, i) => {
              const out = !isMonth && monthOf(v) !== view;
              return (
                <button
                  key={v}
                  type="button"
                  data-v={v}
                  tabIndex={v === focus ? 0 : -1}
                  className={`cal-cell${out ? ' out' : ''}${v === today ? ' today' : ''}`}
                  aria-pressed={v === value}
                  aria-current={v === today ? 'date' : undefined}
                  aria-disabled={blocked(v) || undefined}
                  aria-label={isMonth ? monthLabel(v) : longDate(v)}
                  onClick={() => pick(v)}
                >
                  {isMonth ? MONTHS[i] : Number(v.slice(8))}
                </button>
              );
            })}
          </div>
          <div className="cal-foot">
            <button type="button" className="link" disabled={blocked(today)} onClick={() => pick(today)}>{isMonth ? 'Este mês' : 'Hoje'}</button>
            {clearable && value && <button type="button" className="link muted-link" onClick={() => { onChange(''); dismiss(); }}>Limpar</button>}
          </div>
        </div>
      )}
    </>
  );
}
