import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface Ask {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type Confirm = (ask: Ask) => Promise<boolean>;

const Ctx = createContext<Confirm>(async () => false);

// Confirmação própria no lugar de window.confirm, que alguns navegadores embutidos bloqueiam
// (devolve "Cancelar" sem mostrar nada). Abre por cima de qualquer outra janela.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<(Ask & { resolve: (ok: boolean) => void }) | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const confirm = useCallback<Confirm>((a) => new Promise((resolve) => setAsk({ ...a, resolve })), []);

  useEffect(() => {
    const el = ref.current;
    if (!ask || !el || el.open) return;
    el.showModal();
    // Em ações destrutivas o foco começa no "Cancelar", para Enter não apagar sem querer.
    el.querySelector<HTMLButtonElement>(ask.danger ? '.confirm-cancel' : '.confirm-ok')?.focus();
  }, [ask]);

  function answer(ok: boolean) {
    ask?.resolve(ok);
    setAsk(null);
    ref.current?.close();
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <dialog ref={ref} className="modal confirm-dialog" aria-labelledby={titleId}
        onCancel={(e) => { e.preventDefault(); answer(false); }}>
        {ask && (
          <div className="modal-body">
            <h2 id={titleId} className="confirm-title">{ask.title ?? (ask.danger ? 'Tem certeza?' : 'Confirmar')}</h2>
            <p className="confirm-message">{ask.message}</p>
            <div className="form-actions">
              <button type="button" className="btn ghost confirm-cancel" onClick={() => answer(false)}>{ask.cancelLabel ?? 'Cancelar'}</button>
              <button type="button" className={`btn ${ask.danger ? 'danger-solid' : 'primary'} confirm-ok`} onClick={() => answer(true)}>
                {ask.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  return useContext(Ctx);
}
