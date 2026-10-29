import { useState } from 'react';
import { DatePicker } from '../components/DatePicker';
import { EmojiPicker } from '../components/EmojiPicker';
import { Empty, Field, Modal, Money, Progress } from '../components/ui';
import { centsToInput, currentMonth, money, monthLabel, parseMoney, pct, uid } from '../lib/format';
import { useStore } from '../lib/store';
import type { Goal } from '../types';

function monthsUntil(target: string): number {
  const [y1, m1] = currentMonth().split('-').map(Number);
  const [y2, m2] = target.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

export function Goals() {
  const { data, dispatch } = useStore();
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [depositFor, setDepositFor] = useState<Goal | null>(null);

  return (
    <div className="page">
      <section className="card">
        <header className="card-head"><h2>Suas metas</h2><button className="btn primary sm" onClick={() => setEditing('new')}>+ Nova meta</button></header>
        {data.goals.length === 0 ? <Empty icon="🏁" title="Crie uma meta e acompanhe quanto falta para chegar lá" /> : (
          <div className="goal-grid">
            {data.goals.map((g) => {
              const left = Math.max(0, g.target - g.saved);
              const months = g.deadline ? monthsUntil(g.deadline) : 0;
              const monthly = months > 0 ? Math.ceil(left / months) : 0;
              const done = g.saved >= g.target;
              return (
                <article key={g.id} className={`goal ${done ? 'done' : ''}`}>
                  <header className="goal-head">
                    <span className="goal-emoji" aria-hidden>{g.emoji}</span>
                    <div className="grow"><h3>{g.name}</h3>{g.deadline && <small className="muted">até {monthLabel(g.deadline).toLowerCase()}</small>}</div>
                    <button className="icon-btn" aria-label={`Editar meta ${g.name}`} onClick={() => setEditing(g)}>✎</button>
                  </header>
                  <p className="big"><Money cents={g.saved} /> <small>de <Money cents={g.target} /></small></p>
                  <Progress value={g.saved} max={g.target} status={done ? 'ok' : 'ok'} label={`Progresso da meta ${g.name}`} />
                  <p className="muted small">
                    {done ? '🎉 Meta alcançada!' : <>{pct(g.saved, g.target)}% · faltam <Money cents={left} />{monthly > 0 && <> · guarde <Money cents={monthly} />/mês</>}{g.deadline && months <= 0 && ' · prazo vencido'}</>}
                  </p>
                  <div className="goal-actions">
                    <button className="btn primary sm" onClick={() => setDepositFor(g)}>Guardar / retirar</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Modal title={editing === 'new' ? 'Nova meta' : 'Editar meta'} open={!!editing} onClose={() => setEditing(null)}>
        {editing && <GoalForm goal={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
      <Modal title={depositFor ? `Movimentar “${depositFor.name}”` : ''} open={!!depositFor} onClose={() => setDepositFor(null)}>
        {depositFor && <DepositForm goal={depositFor} onDone={(saved) => { dispatch({ type: 'upsertGoal', goal: { ...depositFor, saved } }); setDepositFor(null); }} />}
      </Modal>
    </div>
  );
}

function DepositForm({ goal, onDone }: { goal: Goal; onDone: (saved: number) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  function apply(sign: 1 | -1) {
    const c = parseMoney(value);
    if (!c) return setError('Informe um valor.');
    if (sign < 0 && c > goal.saved) return setError(`Você só tem ${money(goal.saved)} guardado nesta meta.`);
    onDone(goal.saved + sign * c);
  }
  return (
    <div className="form">
      <p className="muted">Guardado até agora: {money(goal.saved)}</p>
      <Field label="Valor" error={error}><input autoFocus inputMode="decimal" placeholder="0,00" value={value} onChange={(e) => { setValue(e.target.value); setError(''); }} /></Field>
      <div className="form-actions">
        <button className="btn ghost" onClick={() => apply(-1)}>Retirar</button>
        <button className="btn primary" onClick={() => apply(1)}>Guardar</button>
      </div>
    </div>
  );
}


function GoalForm({ goal, onDone }: { goal?: Goal; onDone: () => void }) {
  const { dispatch } = useStore();
  const [name, setName] = useState(goal?.name ?? '');
  const [emoji, setEmoji] = useState(goal?.emoji ?? '🛟');
  const [target, setTarget] = useState(goal ? centsToInput(goal.target) : '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function save() {
    const cents = parseMoney(target);
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Dê um nome para a meta.';
    if (!cents) errs.target = 'Informe o valor que quer juntar.';
    setErrors(errs);
    if (Object.keys(errs).length || !cents) return;
    dispatch({ type: 'upsertGoal', goal: { id: goal?.id ?? uid(), name: name.trim(), emoji, target: cents, saved: goal?.saved ?? 0, deadline: deadline || undefined } });
    onDone();
  }

  return (
    <div className="form">
      <div className="name-with-icon">
        <div className="field"><span className="field-label">Ícone</span><EmojiPicker value={emoji} onChange={setEmoji} label="Ícone da meta" /></div>
        <Field label="Nome" error={errors.name}><input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Reserva de emergência" /></Field>
      </div>
      <div className="row-2">
        <Field label="Valor da meta" error={errors.target}><input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0,00" /></Field>
        <Field label="Prazo (opcional)"><DatePicker mode="month" value={deadline} min={currentMonth()} onChange={setDeadline} placeholder="Sem prazo" clearable /></Field>
      </div>
      <div className="form-actions">
        {goal && <button className="btn danger" onClick={() => { if (confirm('Excluir esta meta?')) { dispatch({ type: 'deleteGoal', id: goal.id }); onDone(); } }}>Excluir</button>}
        <span className="grow" />
        <button className="btn primary" onClick={save}>Salvar</button>
      </div>
    </div>
  );
}
