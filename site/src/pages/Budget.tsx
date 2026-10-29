import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useConfirm } from '../components/Confirm';
import { EmojiPicker } from '../components/EmojiPicker';
import { Empty, Field, Modal, Money, Progress } from '../components/ui';
import { centsToInput, money, parseMoney, pct, uid } from '../lib/format';
import { expenseByCategory, monthSummary, pace, statusFor } from '../lib/selectors';
import { useStore } from '../lib/store';
import type { Budget as BudgetT } from '../types';

const STATUS_TEXT = { ok: 'No ritmo', warning: 'Atenção', over: 'Estourou' };

export function Budget({ month }: { month: string }) {
  const { data, dispatch } = useStore();
  const [editing, setEditing] = useState(false);
  const { total, limits } = data.budget;
  const spentByCat = new Map(expenseByCategory(data, month).map((c) => [c.category.id, c.total]));
  const s = monthSummary(data, month);
  const allocated = Object.values(limits).reduce((a, b) => a + b, 0);
  const p = pace(s.expense, total, month);
  const expenseCats = data.categories.filter((c) => c.kind === 'expense');
  // Ordem escolhida pelo usuário (arrastando); o que não está nela vem depois, do mais usado ao menos usado.
  const order = data.budget.order ?? [];
  const rank = (id: string) => { const i = order.indexOf(id); return i < 0 ? Infinity : i; };
  const limited = expenseCats.filter((c) => limits[c.id]).sort((a, b) =>
    (rank(a.id) - rank(b.id)) || (pct(spentByCat.get(b.id) ?? 0, limits[b.id]) - pct(spentByCat.get(a.id) ?? 0, limits[a.id])));
  const unlimited = expenseCats.filter((c) => !limits[c.id] && spentByCat.get(c.id));

  // Arrastar pelo ícone ⠿: a lista se reorganiza ao vivo e a ordem é salva ao soltar.
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<{ id: string; ids: string[] } | null>(null);
  const byId = new Map(limited.map((c) => [c.id, c]));
  const shown = drag ? drag.ids.map((id) => byId.get(id)!).filter(Boolean) : limited;

  function saveOrder(ids: string[]) {
    const rest = order.filter((id) => !ids.includes(id));
    dispatch({ type: 'setBudget', budget: { ...data.budget, order: [...ids, ...rest] } });
  }

  // Efeito de arrastar: o item segura no ponto clicado e segue o mouse; os outros deslizam
  // até o lugar novo (técnica FLIP) e, ao soltar, o item "assenta" na posição.
  const grab = useRef({ offset: 0, y: 0 });
  const flipFrom = useRef<Map<string, number> | null>(null);
  const items = () => (listRef.current ? [...listRef.current.children] as HTMLElement[] : []);
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

  function captureRects() {
    flipFrom.current = new Map(items().map((el) => [el.dataset.id!, el.getBoundingClientRect().top]));
  }

  function placeDragged(id: string) {
    const el = items().find((x) => x.dataset.id === id);
    if (!el) return;
    el.style.transform = '';
    const natural = el.getBoundingClientRect().top;
    el.style.transform = `translateY(${grab.current.y - grab.current.offset - natural}px) scale(1.02)`;
  }

  const orderKey = shown.map((c) => c.id).join();
  useLayoutEffect(() => {
    const from = flipFrom.current;
    flipFrom.current = null;
    if (drag) placeDragged(drag.id);
    if (!from || reduceMotion()) return;
    for (const el of items()) {
      if (el.dataset.id === drag?.id) continue;
      const prev = from.get(el.dataset.id!);
      if (prev === undefined) continue;
      el.getAnimations().forEach((a) => a.cancel());
      const dy = prev - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 220, easing: EASE });
    }
    // Só a mudança de ordem dispara a animação; drag é lido no momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey]);

  function startDrag(e: PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus();
    const li = e.currentTarget.closest('li');
    grab.current = { offset: e.clientY - (li?.getBoundingClientRect().top ?? e.clientY), y: e.clientY };
    setDrag({ id, ids: limited.map((c) => c.id) });
  }

  // Movimento e soltura ouvidos na janela: reordenar move o <li> no DOM, o que cancelaria
  // um setPointerCapture na alça e faria o "soltar" se perder.
  const dragHandlers = useRef({ move: moveDrag, end: endDrag });
  dragHandlers.current = { move: moveDrag, end: endDrag };
  const dragging = drag?.id;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: globalThis.PointerEvent) => dragHandlers.current.move(e);
    const end = () => dragHandlers.current.end();
    addEventListener('pointermove', move);
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    return () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', end);
      removeEventListener('pointercancel', end);
    };
  }, [dragging]);

  function moveDrag(e: { clientY: number }) {
    if (!drag) return;
    grab.current.y = e.clientY;
    // Troca assim que a borda do item arrastado passa do meio do vizinho:
    // descendo, a borda de baixo; subindo, a de cima.
    const height = items().find((el) => el.dataset.id === drag.id)?.offsetHeight ?? 0;
    const top = e.clientY - grab.current.offset;
    const bottom = top + height;
    const pos = drag.ids.indexOf(drag.id);
    const others = items().filter((el) => el.dataset.id !== drag.id);
    let index = 0;
    others.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (i < pos ? top >= mid : bottom > mid) index = i + 1;
    });
    const ids = drag.ids.filter((id) => id !== drag.id);
    ids.splice(index, 0, drag.id);
    if (ids.join() !== drag.ids.join()) {
      captureRects();
      setDrag({ ...drag, ids });
    } else {
      placeDragged(drag.id);
    }
  }

  function endDrag() {
    if (!drag) return;
    const el = items().find((x) => x.dataset.id === drag.id);
    if (el) {
      const visual = el.getBoundingClientRect().top;
      el.style.transform = '';
      const dy = visual - el.getBoundingClientRect().top;
      if (!reduceMotion() && Math.abs(dy) > 1) {
        el.classList.add('dropping');
        el.animate([{ transform: `translateY(${dy}px) scale(1.02)` }, { transform: 'none' }], { duration: 200, easing: EASE })
          .finished.then(() => el.classList.remove('dropping'), () => el.classList.remove('dropping'));
      }
    }
    if (drag.ids.join() !== limited.map((c) => c.id).join()) saveOrder(drag.ids);
    setDrag(null);
  }

  // Teclado: setas para cima/baixo movem a categoria focada.
  function keyMove(e: KeyboardEvent<HTMLButtonElement>, id: string) {
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    const ids = limited.map((c) => c.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    captureRects();
    saveOrder(ids);
    const target = e.currentTarget;
    requestAnimationFrame(() => target.focus());
  }

  return (
    <div className="page">
      {total <= 0 ? (
        <div className="card">
          <Empty icon="🎯" title="Você ainda não tem um orçamento">
            <p className="muted">Uma boa referência é gastar até 80% da renda e guardar o resto.</p>
            <button className="btn primary" onClick={() => setEditing(true)}>Criar orçamento</button>
          </Empty>
        </div>
      ) : (
        <>
          <section className="card">
            <header className="card-head"><h2>Limite total do mês</h2><button className="btn ghost sm" onClick={() => setEditing(true)}>Editar orçamento</button></header>
            <p className="big"><Money cents={s.expense} /> <small>de <Money cents={total} /></small></p>
            <Progress value={s.expense} max={total} status={statusFor(s.expense, total)} label="Uso do orçamento total" />
            <div className="stats">
              <div><small className="muted">Esperado até hoje</small><Money cents={p.expectedByToday} /></div>
              <div><small className="muted">Projeção do mês</small><Money cents={p.projected} className={p.projected > total ? 'expense' : ''} /></div>
              <div><small className="muted">Distribuído em categorias</small><Money cents={allocated} /></div>
            </div>
            {p.projected > total && <p className="callout warn">No ritmo atual você deve fechar o mês <Money cents={p.projected - total} /> acima do limite.</p>}
            {allocated > total && <p className="callout warn">A soma dos limites por categoria (<Money cents={allocated} />) passou do total. Aumente o total ou reduza alguma categoria.</p>}
          </section>

          <section className="card">
            <header className="card-head"><h2>Por categoria</h2></header>
            {limited.length === 0 ? <Empty icon="🗂️" title="Nenhuma categoria com limite" /> : (
              <ul ref={listRef} className={`budget-list${drag ? ' sorting' : ''}`}>
                {shown.map((c) => {
                  const spent = spentByCat.get(c.id) ?? 0;
                  const st = statusFor(spent, limits[c.id]);
                  return (
                    <li key={c.id} data-id={c.id} className={drag?.id === c.id ? 'dragging' : undefined}>
                      <div className="budget-row">
                        <span className="budget-name">
                          <button type="button" className="drag-handle" aria-label={`Reordenar ${c.name} (arraste ou use as setas)`} title="Arraste para reorganizar"
                            onPointerDown={(e) => startDrag(e, c.id)}
                            onKeyDown={(e) => keyMove(e, c.id)}>
                            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="currentColor">
                              <circle cx="4.5" cy="3" r="1.3" /><circle cx="9.5" cy="3" r="1.3" />
                              <circle cx="4.5" cy="7" r="1.3" /><circle cx="9.5" cy="7" r="1.3" />
                              <circle cx="4.5" cy="11" r="1.3" /><circle cx="9.5" cy="11" r="1.3" />
                            </svg>
                          </button>
                          <span><span aria-hidden>{c.emoji}</span> {c.name}</span>
                        </span>
                        <span className={`pill pill-${st}`}>{STATUS_TEXT[st]}</span>
                      </div>
                      <Progress value={spent} max={limits[c.id]} status={st} label={`Uso do limite de ${c.name}`} />
                      <small className="muted"><Money cents={spent} /> de <Money cents={limits[c.id]} /> · {spent <= limits[c.id] ? <>restam <Money cents={limits[c.id] - spent} /></> : <>passou <Money cents={spent - limits[c.id]} /></>}</small>
                    </li>
                  );
                })}
              </ul>
            )}
            {unlimited.length > 0 && (
              <p className="muted small">Sem limite definido: {unlimited.map((c) => `${c.emoji} ${c.name} (${data.settings.hideValues ? '••••' : money(spentByCat.get(c.id) ?? 0)})`).join(' · ')}</p>
            )}
          </section>
        </>
      )}

      <Modal title="Editar orçamento" open={editing} onClose={() => setEditing(false)}>
        {editing && <BudgetForm budget={data.budget} suggestion={Math.round(s.income * 0.8)} onSave={(b) => { dispatch({ type: 'setBudget', budget: b }); setEditing(false); }} />}
      </Modal>
    </div>
  );
}

// Linha editável do formulário: categoria existente (nome/ícone renomeáveis) ou campo novo ainda não salvo.
interface Row { id: string; name: string; emoji: string; limit: string; isNew?: boolean }

function BudgetForm({ budget, suggestion, onSave }: { budget: BudgetT; suggestion: number; onSave: (b: BudgetT) => void }) {
  const { data, dispatch } = useStore();
  const ask = useConfirm();
  const cats = data.categories.filter((c) => c.kind === 'expense' && !c.archived);
  const [removed, setRemoved] = useState<string[]>([]);
  const [total, setTotal] = useState(budget.total ? centsToInput(budget.total) : '');
  const [rows, setRows] = useState<Row[]>(() => cats.map((c) => ({
    id: c.id, name: c.name, emoji: c.emoji, limit: budget.limits[c.id] ? centsToInput(budget.limits[c.id]) : '',
  })));
  const [draft, setDraft] = useState({ name: '', emoji: '🏷️', limit: '' });
  const [error, setError] = useState('');
  const totalCents = parseMoney(total) ?? 0;
  const allocated = rows.reduce((s, r) => s + (parseMoney(r.limit) ?? 0), 0);

  async function removeRow(r: Row) {
    if (!r.isNew) {
      const used = data.transactions.some((t) => t.categoryId === r.id && !t.deletedAt);
      const ok = await ask({
        title: `Excluir “${r.name}”?`,
        message: used
          ? 'Ela some do orçamento e das opções de novas transações, mas os lançamentos já registrados continuam no histórico com este nome. A exclusão vale ao salvar o orçamento.'
          : 'A categoria será excluída ao salvar o orçamento.',
        confirmLabel: 'Excluir', danger: true,
      });
      if (!ok) return;
      setRemoved((ids) => [...ids, r.id]);
    }
    setRows((rs) => rs.filter((x) => x.id !== r.id));
    setError('');
  }

  const update = (id: string, patch: Partial<Row>) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))); setError(''); };

  function addField() {
    const name = draft.name.trim();
    if (!name) return setError('Dê um nome para o novo campo.');
    if (rows.some((r) => r.name.trim().toLowerCase() === name.toLowerCase())) return setError(`Já existe um campo chamado “${name}”.`);
    if (draft.limit.trim() && parseMoney(draft.limit) === null) return setError(`Valor inválido em ${name}.`);
    setRows((rs) => [...rs, { id: `custom-${uid().slice(0, 8)}`, name, emoji: draft.emoji, limit: draft.limit, isNew: true }]);
    setDraft({ name: '', emoji: '🏷️', limit: '' });
    setError('');
  }

  function save() {
    if (totalCents <= 0) return setError('Informe o limite total do mês.');
    const unnamed = rows.find((r) => !r.name.trim());
    if (unnamed) return setError('Todos os campos precisam de um nome.');
    const bad = rows.find((r) => r.limit.trim() && parseMoney(r.limit) === null);
    if (bad) return setError(`Valor inválido em ${bad.name}.`);
    if (draft.name.trim()) return setError('Clique em “Adicionar” para incluir o novo campo, ou apague o nome digitado.');

    // Exclusões só valem ao salvar (fechar com Esc ou ✕ desfaz tudo).
    removed.forEach((id) => dispatch({ type: 'deleteCategory', id }));
    // Nomes e ícones alterados, e campos novos, viram categorias de despesa (aparecem também em Transações).
    rows.forEach((r) => {
      const cat = cats.find((c) => c.id === r.id);
      const name = r.name.trim();
      if (!cat) dispatch({ type: 'upsertCategory', category: { id: r.id, name, emoji: r.emoji, group: 'Personalizadas', kind: 'expense', custom: true } });
      else if (cat.name !== name || cat.emoji !== r.emoji) dispatch({ type: 'upsertCategory', category: { ...cat, name, emoji: r.emoji } });
    });
    const parsed: Record<string, number> = {};
    rows.forEach((r) => { const n = parseMoney(r.limit); if (n) parsed[r.id] = n; });
    onSave({ total: totalCents, limits: parsed, order: budget.order });
  }

  return (
    <div className="form">
      <Field label="Limite total do mês" hint={suggestion > 0 ? `Sugestão: ${money(suggestion)} (80% da renda deste mês)` : undefined} error={error}>
        <input inputMode="decimal" placeholder="0,00" value={total} onChange={(e) => { setTotal(e.target.value); setError(''); }} />
      </Field>
      <p className={`small ${allocated > totalCents ? 'expense' : 'muted'}`}>Distribuído: {money(allocated)} de {money(totalCents)}</p>
      <div className="limits-grid">
        {rows.map((r) => (
          <div key={r.id} className={`limit-item${r.isNew ? ' is-new' : ''}`}>
            <div className="limit-name">
              <EmojiPicker value={r.emoji} onChange={(emoji) => update(r.id, { emoji })} label={`Ícone de ${r.name || 'campo'}`} />
              <input className="limit-name-input" value={r.name} maxLength={40} aria-label="Nome do campo" title="Clique para renomear"
                onChange={(e) => update(r.id, { name: e.target.value })} />
              <button type="button" className="icon-btn limit-remove" aria-label={`Excluir categoria ${r.name}`} title="Excluir categoria"
                onClick={() => removeRow(r)}>
                <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
            <input inputMode="decimal" placeholder="sem limite" aria-label={`Limite de ${r.name}`} value={r.limit}
              onChange={(e) => update(r.id, { limit: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="limit-item limit-new">
          <div className="limit-name">
            <EmojiPicker value={draft.emoji} onChange={(emoji) => setDraft({ ...draft, emoji })} label="Ícone do novo campo" />
            <input className="limit-name-input" value={draft.name} maxLength={40} placeholder="Novo campo (ex.: Pets)" aria-label="Nome do novo campo"
              onChange={(e) => { setDraft({ ...draft, name: e.target.value }); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }} />
          </div>
          <div className="limit-new-row">
            <input inputMode="decimal" placeholder="sem limite" aria-label="Limite do novo campo" value={draft.limit}
              onChange={(e) => setDraft({ ...draft, limit: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }} />
            <button type="button" className="btn primary sm" onClick={addField}>+ Adicionar</button>
          </div>
      </div>
      <div className="form-actions">
        <button className="btn primary" onClick={save}>Salvar orçamento</button>
      </div>
    </div>
  );
}
