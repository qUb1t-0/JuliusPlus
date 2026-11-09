import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useConfirm } from '../components/Confirm';
import { DatePicker } from '../components/DatePicker';
import { EmojiPicker } from '../components/EmojiPicker';
import { Select } from '../components/Select';
import { Empty, Field, Modal, Money } from '../components/ui';
import { centsToInput, parseMoney, todayISO, uid } from '../lib/format';
import { useStore } from '../lib/store';
import type { FutureProject, ProjectStatus } from '../types';

const STATUS: { id: ProjectStatus; label: string; icon: string; pill: string }[] = [
  { id: 'idea', label: 'Ideia', icon: '💡', pill: 'pill-neutral' },
  { id: 'analysis', label: 'Em análise', icon: '🔍', pill: 'pill-warning' },
  { id: 'done', label: 'Efetivado', icon: '✅', pill: 'pill-ok' },
  { id: 'dropped', label: 'Descartado', icon: '❌', pill: 'pill-over' },
];
const statusOf = (id: ProjectStatus) => STATUS.find((s) => s.id === id)!;

function createdLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function Projects() {
  const { data, dispatch } = useStore();
  const ask = useConfirm();
  const projects = data.projects ?? [];
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const [editing, setEditing] = useState<FutureProject | 'new' | null>(null);

  const count = (id: ProjectStatus) => projects.filter((p) => p.status === id).length;
  // Ordem escolhida arrastando; projetos novos (fora dela) vêm primeiro, do mais recente ao mais antigo.
  const order = data.projectOrder ?? [];
  const rank = (id: string) => order.indexOf(id);
  const sorted = [...projects].sort((a, b) => {
    const ra = rank(a.id), rb = rank(b.id);
    if (ra < 0 || rb < 0) return ra < 0 && rb < 0 ? b.createdAt.localeCompare(a.createdAt) : ra < 0 ? -1 : 1;
    return ra - rb;
  });
  const list = sorted.filter((p) => filter === 'all' || p.status === filter);

  // Arrastar pela alça ⠿: a grade se reorganiza ao vivo e a ordem é salva ao soltar.
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; ids: string[] } | null>(null);
  const byId = new Map(list.map((p) => [p.id, p]));
  const shown = drag ? drag.ids.map((id) => byId.get(id)!).filter(Boolean) : list;

  // Com filtro ativo, só os cards visíveis trocam de lugar entre si; os demais mantêm a posição.
  function saveOrder(ids: string[]) {
    const visible = new Set(ids);
    let i = 0;
    dispatch({ type: 'setProjectOrder', order: sorted.map((p) => (visible.has(p.id) ? ids[i++] : p.id)) });
  }

  // Mesmo efeito do Orçamento, em duas dimensões: o card segue o mouse e os outros deslizam (FLIP).
  const grab = useRef({ dx: 0, dy: 0, x: 0, y: 0 });
  const flipFrom = useRef<Map<string, DOMRect> | null>(null);
  const items = () => (gridRef.current ? [...gridRef.current.children] as HTMLElement[] : []);
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

  function captureRects() {
    flipFrom.current = new Map(items().map((el) => [el.dataset.id!, el.getBoundingClientRect()]));
  }

  function placeDragged(id: string) {
    const el = items().find((x) => x.dataset.id === id);
    if (!el) return;
    el.style.transform = '';
    const r = el.getBoundingClientRect();
    const g = grab.current;
    el.style.transform = `translate(${g.x - g.dx - r.left}px, ${g.y - g.dy - r.top}px) scale(1.02)`;
  }

  const orderKey = shown.map((p) => p.id).join();
  useLayoutEffect(() => {
    const from = flipFrom.current;
    flipFrom.current = null;
    if (drag) placeDragged(drag.id);
    if (!from || reduceMotion()) return;
    for (const el of items()) {
      if (el.dataset.id === drag?.id) continue;
      const prev = from.get(el.dataset.id!);
      if (!prev) continue;
      el.getAnimations().forEach((a) => a.cancel());
      const r = el.getBoundingClientRect();
      const dx = prev.left - r.left, dy = prev.top - r.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 240, easing: EASE });
    }
    // Só a mudança de ordem dispara a animação; drag é lido no momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey]);

  function startDrag(e: PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus();
    const r = e.currentTarget.closest('article')?.getBoundingClientRect();
    grab.current = { dx: e.clientX - (r?.left ?? e.clientX), dy: e.clientY - (r?.top ?? e.clientY), x: e.clientX, y: e.clientY };
    setDrag({ id, ids: list.map((p) => p.id) });
  }

  // Movimento e soltura ouvidos na janela (reordenar move o card no DOM e perderia o pointer capture).
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

  function moveDrag(e: { clientX: number; clientY: number }) {
    if (!drag) return;
    grab.current.x = e.clientX;
    grab.current.y = e.clientY;
    // Troca quando o centro do card arrastado entra em outro card: ele assume o lugar daquele.
    const el = items().find((x) => x.dataset.id === drag.id);
    const cx = e.clientX - grab.current.dx + (el?.offsetWidth ?? 0) / 2;
    const cy = e.clientY - grab.current.dy + (el?.offsetHeight ?? 0) / 2;
    const over = items().find((x) => {
      if (x.dataset.id === drag.id) return false;
      const r = x.getBoundingClientRect();
      return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
    });
    if (over) {
      const ids = drag.ids.filter((id) => id !== drag.id);
      ids.splice(drag.ids.indexOf(over.dataset.id!), 0, drag.id);
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
      const visual = el.getBoundingClientRect();
      el.style.transform = '';
      const r = el.getBoundingClientRect();
      const dx = visual.left - r.left, dy = visual.top - r.top;
      if (!reduceMotion() && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        el.classList.add('dropping');
        el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(1.02)` }, { transform: 'none' }], { duration: 220, easing: EASE })
          .finished.then(() => el.classList.remove('dropping'), () => el.classList.remove('dropping'));
      }
    }
    if (drag.ids.join() !== list.map((p) => p.id).join()) saveOrder(drag.ids);
    setDrag(null);
  }

  // Teclado: setas movem o card focado uma posição (←/↑ para trás, →/↓ para frente).
  function keyMove(e: KeyboardEvent<HTMLButtonElement>, id: string) {
    const delta = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    const ids = list.map((p) => p.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    captureRects();
    saveOrder(ids);
    const target = e.currentTarget;
    requestAnimationFrame(() => target.focus());
  }

  async function remove(p: FutureProject) {
    if (await ask({ title: `Apagar “${p.name}”?`, message: 'Essa ação não pode ser desfeita.', confirmLabel: 'Apagar', danger: true })) {
      dispatch({ type: 'deleteProject', id: p.id });
    }
  }

  return (
    <div className="page">
      <div className="project-stats">
        {STATUS.map((s) => (
          <section key={s.id} className="card stat-card">
            <p className="muted small">{s.icon} {s.label}</p>
            <p className="big">{count(s.id)}</p>
          </section>
        ))}
      </div>

      <section className="card">
        <header className="card-head">
          <h2>Suas ideias de negócio</h2>
          <button className="btn primary sm" onClick={() => setEditing('new')}>+ Novo projeto</button>
        </header>

        {projects.length > 0 && (
          <div className="tabs project-filter" role="group" aria-label="Filtrar por situação">
            <button className={filter === 'all' ? 'on' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todos ({projects.length})</button>
            {STATUS.map((s) => (
              <button key={s.id} className={filter === s.id ? 'on' : ''} aria-pressed={filter === s.id} onClick={() => setFilter(s.id)}>
                {s.label} ({count(s.id)})
              </button>
            ))}
          </div>
        )}

        {projects.length === 0 ? (
          <Empty icon="🚀" title="Registre aqui as ideias de negócio que você quer tirar do papel">
            <button className="btn primary sm" onClick={() => setEditing('new')}>Registrar primeira ideia</button>
          </Empty>
        ) : list.length === 0 ? (
          <Empty icon="🔎" title="Nenhum projeto com essa situação" />
        ) : (
          <div ref={gridRef} className={`goal-grid sortable-grid${drag ? ' sorting' : ''}`}>
            {shown.map((p) => {
              const s = statusOf(p.status);
              return (
                <article key={p.id} data-id={p.id} className={`goal project project-${p.status}${drag?.id === p.id ? ' dragging' : ''}`}>
                  <header className="goal-head">
                    <span className="goal-emoji" aria-hidden>{p.emoji}</span>
                    <div className="grow">
                      <h3>{p.name}</h3>
                      <small className="muted">criado em {createdLabel(p.createdAt)}</small>
                    </div>
                    {list.length > 1 && (
                      <button type="button" className="drag-handle" aria-label={`Reordenar ${p.name} (arraste ou use as setas)`} title="Arraste para reorganizar"
                        onPointerDown={(e) => startDrag(e, p.id)}
                        onKeyDown={(e) => keyMove(e, p.id)}>
                        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="currentColor">
                          <circle cx="4.5" cy="3" r="1.3" /><circle cx="9.5" cy="3" r="1.3" />
                          <circle cx="4.5" cy="7" r="1.3" /><circle cx="9.5" cy="7" r="1.3" />
                          <circle cx="4.5" cy="11" r="1.3" /><circle cx="9.5" cy="11" r="1.3" />
                        </svg>
                      </button>
                    )}
                  </header>
                  <span className={`pill ${s.pill} project-status`}>{s.icon} {s.label}</span>
                  {p.status === 'done' && p.doneAt && (
                    <p className="small project-done-date">
                      Efetivado em <strong>{createdLabel(p.doneAt)}</strong>
                      {p.transactionId && <> · <a href="#transactions">lançado em Transações</a></>}
                    </p>
                  )}
                  {p.description && <p className="project-desc">{p.description}</p>}
                  {p.investment != null && (
                    <p className="small"><span className="muted">Investimento estimado:</span> <strong><Money cents={p.investment} /></strong></p>
                  )}
                  <div className="goal-actions project-actions">
                    <button className="btn ghost sm" aria-label={`Editar projeto ${p.name}`} onClick={() => setEditing(p)}>✎ Editar</button>
                    <button className="btn danger sm" aria-label={`Apagar projeto ${p.name}`} onClick={() => remove(p)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                      </svg>
                      Apagar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Modal title={editing === 'new' ? 'Novo projeto' : 'Editar projeto'} open={!!editing} onClose={() => setEditing(null)}>
        {editing && <ProjectForm project={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}


// Categoria criada na primeira vez que um projeto é efetivado.
const PROJECT_CATEGORY = { id: 'projetos', name: 'Projetos', emoji: '🚀', group: 'Investimentos', kind: 'expense' as const, custom: true };
const PROJECT_NOTE = 'Projeto Futuro efetivado';

function ProjectForm({ project, onDone }: { project?: FutureProject; onDone: () => void }) {
  const { data, dispatch } = useStore();
  const ask = useConfirm();
  const [doneAt, setDoneAt] = useState(project?.doneAt ?? todayISO());
  const [emoji, setEmoji] = useState(project?.emoji ?? '🚀');
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [investment, setInvestment] = useState(project?.investment != null ? centsToInput(project.investment) : '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'idea');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function save() {
    const cents = investment.trim() ? parseMoney(investment) : undefined;
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Dê um nome para o projeto.';
    if (cents === null) errs.investment = 'Valor inválido. Use o formato 1.500,00.';
    else if (status === 'done' && !cents) errs.investment = 'Informe o valor para lançar em Transações.';
    if (status === 'done' && !doneAt) errs.doneAt = 'Escolha a data.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    // Efetivado vira uma despesa em Transações, ligada ao projeto: no máximo uma por projeto.
    const id = project?.id ?? uid();
    const linked = data.transactions.filter((t) => t.projectId === id || t.id === project?.transactionId
      // Despesas criadas antes do vínculo por projectId existir.
      || (!t.projectId && !!project && t.categoryId === PROJECT_CATEGORY.id && t.note === PROJECT_NOTE && t.description === project.name));
    let transactionId: string | undefined;
    if (status === 'done' && cents) {
      if (!data.categories.some((c) => c.id === PROJECT_CATEGORY.id && !c.archived)) dispatch({ type: 'upsertCategory', category: PROJECT_CATEGORY });
      transactionId = (linked.find((t) => t.id === project?.transactionId && !t.deletedAt) ?? linked.find((t) => !t.deletedAt))?.id ?? uid();
      linked.filter((t) => t.id !== transactionId).forEach((t) => dispatch({ type: 'purgeTransaction', id: t.id }));
      dispatch({
        type: 'updateTransaction',
        tx: {
          id: transactionId, kind: 'expense', amount: cents, categoryId: PROJECT_CATEGORY.id, date: doneAt,
          description: name.trim(), method: 'pix', recurring: false, note: PROJECT_NOTE, projectId: id,
        },
      });
    } else {
      // Deixou de ser efetivado: a despesa é excluída de vez (sem lixeira), para não duplicar se voltar a efetivar.
      linked.forEach((t) => dispatch({ type: 'purgeTransaction', id: t.id }));
    }

    dispatch({
      type: 'upsertProject',
      project: {
        id, name: name.trim(), emoji, description: description.trim(),
        investment: cents ?? undefined, status, createdAt: project?.createdAt ?? todayISO(),
        doneAt: status === 'done' ? doneAt : undefined, transactionId,
      },
    });
    onDone();
  }

  async function remove() {
    if (!project || !(await ask({ title: `Apagar “${project.name}”?`, message: 'Essa ação não pode ser desfeita.', confirmLabel: 'Apagar', danger: true }))) return;
    dispatch({ type: 'deleteProject', id: project.id });
    onDone();
  }

  return (
    <div className="form">
      <div className="name-with-icon">
        <div className="field"><span className="field-label">Ícone</span><EmojiPicker value={emoji} onChange={setEmoji} label="Ícone do projeto" /></div>
        <Field label="Nome do projeto" error={errors.name}>
          <input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Cafeteria no centro" aria-invalid={!!errors.name} />
        </Field>
      </div>
      <Field label="Descrição (opcional)">
        <textarea rows={4} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Como funcionaria, público, diferenciais, próximos passos…" />
      </Field>
      <div className="row-2">
        <Field label="Investimento estimado (opcional)" error={errors.investment}>
          <input inputMode="decimal" value={investment} onChange={(e) => setInvestment(e.target.value)} placeholder="0,00" aria-invalid={!!errors.investment} />
        </Field>
        <Field label="Situação">
          <Select value={status} onChange={setStatus} options={STATUS.map((s) => ({ value: s.id, label: `${s.icon} ${s.label}` }))} />
        </Field>
      </div>
      {status === 'done' && (
        <div className="callout project-done-note">
          <Field label="Data da efetivação" error={errors.doneAt}>
            <DatePicker value={doneAt} onChange={setDoneAt} invalid={!!errors.doneAt} />
          </Field>
          <p className="small muted">Ao salvar, o investimento é lançado como despesa em <strong>Transações</strong> nesta data. Se a situação mudar depois, a despesa é excluída.</p>
        </div>
      )}
      <div className="form-actions">
        {project && <button className="btn danger" onClick={remove}>Apagar</button>}
        <span className="grow" />
        <button className="btn primary" onClick={save}>Salvar</button>
      </div>
    </div>
  );
}
