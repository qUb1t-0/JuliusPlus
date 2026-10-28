import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';

// Painel flutuante via Popover API: fica na top layer (acima de <dialog>), sem ser cortado
// por overflow, e continua dentro da árvore do modal para não ficar inerte.
export function useFloating(open: boolean, onClose: () => void) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const pop = floatRef.current;
    const anchor = anchorRef.current;
    if (!open || !pop || !anchor) return;
    pop.showPopover?.();

    const place = () => {
      const r = anchor.getBoundingClientRect();
      pop.style.minWidth = `${r.width}px`;
      const h = pop.offsetHeight;
      const w = pop.offsetWidth;
      const below = innerHeight - r.bottom - 8;
      const up = below < h && r.top > below;
      pop.style.top = `${up ? Math.max(8, r.top - h - 6) : r.bottom + 6}px`;
      pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
      pop.dataset.side = up ? 'top' : 'bottom';
    };
    place();

    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.contains(t) && !anchor.contains(t)) closeRef.current();
    };
    addEventListener('scroll', place, true);
    addEventListener('resize', place);
    document.addEventListener('pointerdown', onDown);
    return () => {
      removeEventListener('scroll', place, true);
      removeEventListener('resize', place);
      document.removeEventListener('pointerdown', onDown);
      if (pop.matches(':popover-open')) pop.hidePopover();
    };
  }, [open]);

  return { anchorRef, floatRef };
}

// Esc fecha só o painel, sem disparar o fechamento do <dialog> que o contém.
export function stopEscape(e: KeyboardEvent, close: () => void) {
  if (e.key !== 'Escape') return false;
  e.preventDefault();
  e.stopPropagation();
  close();
  return true;
}
