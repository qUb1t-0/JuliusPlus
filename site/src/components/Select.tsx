import { Fragment, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { stopEscape, useFloating } from './useFloating';

export interface SelectOption<T> { value: T; label: string; group?: string }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase();

// Lista suspensa no padrão ARIA "select-only combobox": setas, Home/End, Enter, Esc e busca por letra.
export function Select<T extends string | number>({ value, onChange, options, placeholder = 'Selecione…', invalid, className = '', 'aria-label': ariaLabel }: {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const { anchorRef, floatRef } = useFloating(open, close);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const id = useId();
  const selected = options.findIndex((o) => o.value === value);
  const current = options[selected];

  useEffect(() => { if (open) listRef.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const show = (i = selected) => { setActive(Math.max(0, i)); setOpen(true); };
  const dismiss = () => { setOpen(false); anchorRef.current?.focus(); };
  const choose = (i: number) => { onChange(options[i].value); dismiss(); };
  const last = options.length - 1;

  function typeahead(key: string) {
    const now = Date.now();
    typed.current = { text: (now - typed.current.at > 600 ? '' : typed.current.text) + norm(key), at: now };
    const q = typed.current.text;
    const order = [...options.keys()].map((k) => (active + (q.length === 1 ? 1 : 0) + k) % options.length);
    const hit = order.find((i) => norm(options[i].label).startsWith(q));
    if (hit !== undefined) setActive(hit);
  }

  function onListKey(e: KeyboardEvent) {
    if (stopEscape(e, dismiss)) return;
    switch (e.key) {
      case 'ArrowDown': setActive((a) => Math.min(last, a + 1)); break;
      case 'ArrowUp': setActive((a) => Math.max(0, a - 1)); break;
      case 'PageDown': setActive((a) => Math.min(last, a + 8)); break;
      case 'PageUp': setActive((a) => Math.max(0, a - 8)); break;
      case 'Home': setActive(0); break;
      case 'End': setActive(last); break;
      case 'Enter': case ' ': choose(active); break;
      case 'Tab': setOpen(false); return;
      default:
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        typeahead(e.key);
    }
    e.preventDefault();
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={`select-trigger ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel ? `${ariaLabel}: ${current?.label ?? placeholder}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show(); }
        }}
      >
        <span className={`trigger-value${current ? '' : ' placeholder'}`}>{current ? current.label : placeholder}</span>
        <svg className="trigger-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        // preventDefault evita que o <label> do Field repasse o clique de volta ao botão.
        <div ref={floatRef} popover="manual" className="pop" onClick={(e) => e.preventDefault()}>
          <ul ref={listRef} id={id} role="listbox" tabIndex={-1} className="select-list" aria-label={ariaLabel}
            aria-activedescendant={`${id}-${active}`} onKeyDown={onListKey}>
            {options.map((o, i) => (
              <Fragment key={String(o.value)}>
                {o.group && o.group !== options[i - 1]?.group && <li role="presentation" className="select-group">{o.group}</li>}
                <li id={`${id}-${i}`} data-i={i} role="option" aria-selected={i === selected}
                  className={i === active ? 'active' : undefined}
                  onPointerMove={() => setActive(i)} onClick={() => choose(i)}>
                  <span>{o.label}</span>
                  {i === selected && (
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </li>
              </Fragment>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
