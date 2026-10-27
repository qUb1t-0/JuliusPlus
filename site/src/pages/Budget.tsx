import { useState } from 'react';
import { Empty, Field, Modal, Money, Progress } from '../components/ui';
import { centsToInput, money, parseMoney, pct } from '../lib/format';
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
  const limited = expenseCats.filter((c) => limits[c.id]).sort((a, b) => pct(spentByCat.get(b.id) ?? 0, limits[b.id]) - pct(spentByCat.get(a.id) ?? 0, limits[a.id]));
  const unlimited = expenseCats.filter((c) => !limits[c.id] && spentByCat.get(c.id));

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
              <ul className="budget-list">
                {limited.map((c) => {
                  const spent = spentByCat.get(c.id) ?? 0;
                  const st = statusFor(spent, limits[c.id]);
                  return (
                    <li key={c.id}>
                      <div className="budget-row">
                        <span><span aria-hidden>{c.emoji}</span> {c.name}</span>
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
        {editing && <BudgetForm budget={data.budget} suggestion={Math.round(s.income * 0.8)} onSave={(b) => { dispatch({ type: 'setBudget', budget: b }); setEditing(false); }} onCancel={() => setEditing(false)} />}
      </Modal>
    </div>
  );
}

function BudgetForm({ budget, suggestion, onSave, onCancel }: { budget: BudgetT; suggestion: number; onSave: (b: BudgetT) => void; onCancel: () => void }) {
  const { data } = useStore();
  const cats = data.categories.filter((c) => c.kind === 'expense');
  const [total, setTotal] = useState(budget.total ? centsToInput(budget.total) : '');
  const [limits, setLimits] = useState<Record<string, string>>(
    Object.fromEntries(cats.map((c) => [c.id, budget.limits[c.id] ? centsToInput(budget.limits[c.id]) : ''])),
  );
  const [error, setError] = useState('');
  const totalCents = parseMoney(total) ?? 0;
  const allocated = Object.values(limits).reduce((s, v) => s + (parseMoney(v) ?? 0), 0);

  function save() {
    if (totalCents <= 0) return setError('Informe o limite total do mês.');
    const bad = Object.entries(limits).find(([, v]) => v.trim() && parseMoney(v) === null);
    if (bad) return setError(`Valor inválido em ${cats.find((c) => c.id === bad[0])?.name}.`);
    const parsed: Record<string, number> = {};
    Object.entries(limits).forEach(([k, v]) => { const n = parseMoney(v); if (n) parsed[k] = n; });
    onSave({ total: totalCents, limits: parsed });
  }

  return (
    <div className="form">
      <Field label="Limite total do mês" hint={suggestion > 0 ? `Sugestão: ${money(suggestion)} (80% da renda deste mês)` : undefined} error={error}>
        <input inputMode="decimal" placeholder="0,00" value={total} onChange={(e) => { setTotal(e.target.value); setError(''); }} />
      </Field>
      <p className={`small ${allocated > totalCents ? 'expense' : 'muted'}`}>Distribuído: {money(allocated)} de {money(totalCents)}</p>
      <div className="limits-grid">
        {cats.map((c) => (
          <label key={c.id} className="limit-item">
            <span><span aria-hidden>{c.emoji}</span> {c.name}</span>
            <input inputMode="decimal" placeholder="sem limite" value={limits[c.id]} onChange={(e) => setLimits({ ...limits, [c.id]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="form-actions">
        <button className="btn ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn primary" onClick={save}>Salvar orçamento</button>
      </div>
    </div>
  );
}
