import { useState } from 'react';
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
  const projects = data.projects ?? [];
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const [editing, setEditing] = useState<FutureProject | 'new' | null>(null);

  const count = (id: ProjectStatus) => projects.filter((p) => p.status === id).length;
  const list = [...projects]
    .filter((p) => filter === 'all' || p.status === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function remove(p: FutureProject) {
    if (confirm(`Apagar o projeto “${p.name}”? Essa ação não pode ser desfeita.`)) dispatch({ type: 'deleteProject', id: p.id });
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
          <div className="goal-grid">
            {list.map((p) => {
              const s = statusOf(p.status);
              return (
                <article key={p.id} className={`goal project project-${p.status}`}>
                  <header className="goal-head">
                    <span className="goal-emoji" aria-hidden>{p.emoji}</span>
                    <div className="grow">
                      <h3>{p.name}</h3>
                      <small className="muted">criado em {createdLabel(p.createdAt)}</small>
                    </div>
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
      if (!data.categories.some((c) => c.id === PROJECT_CATEGORY.id)) dispatch({ type: 'upsertCategory', category: PROJECT_CATEGORY });
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

  function remove() {
    if (!project || !confirm(`Apagar o projeto “${project.name}”? Essa ação não pode ser desfeita.`)) return;
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
