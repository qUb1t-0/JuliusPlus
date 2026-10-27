import { CHART_COLORS, Bars, Donut, Empty, Money, Progress } from '../components/ui';
import { addMonths, monthLabel, pct } from '../lib/format';
import { billState, expenseByCategory, inMonth, lastMonths, monthSummary, statusFor } from '../lib/selectors';
import { useStore } from '../lib/store';
import type { Page } from '../App';

export function Home({ month, go }: { month: string; go: (p: Page) => void }) {
  const { data } = useStore();
  const s = monthSummary(data, month);
  const prev = monthSummary(data, addMonths(month, -1));
  const cats = expenseByCategory(data, month);
  const top = cats.slice(0, 5);
  const rest = cats.slice(5).reduce((a, c) => a + c.total, 0);
  const slices = [...top.map((c) => ({ label: c.category.name, value: c.total })), ...(rest ? [{ label: 'Outras', value: rest }] : [])];
  const history = lastMonths(data, month, 6).map((h) => ({
    label: monthLabel(h.month).slice(0, 3), income: h.summary.income, expense: h.summary.expense,
  }));
  const budget = data.budget.total;
  const pendingBills = data.bills.filter((b) => ['overdue', 'soon'].includes(billState(b, month)));
  const goal = data.goals[0];
  const recent = inMonth(data, month).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const catById = new Map(data.categories.map((c) => [c.id, c]));
  const expenseDelta = prev.expense ? pct(s.expense - prev.expense, prev.expense) : 0;
  const savingRate = s.income > 0 ? pct(s.balance, s.income) : 0;

  return (
    <div className="page">
      <section className="hero card">
        <p className="eyebrow">Saldo de {monthLabel(month).toLowerCase()}</p>
        <Money cents={s.balance} className={`hero-value ${s.balance < 0 ? 'neg' : ''}`} />
        <div className="hero-split">
          <div><span className="dot income" />Receitas <Money cents={s.income} /></div>
          <div><span className="dot expense" />Despesas <Money cents={s.expense} /></div>
        </div>
        {s.income > 0 && (
          <p className="hero-note">
            {savingRate >= 0 ? `Você guardou ${savingRate}% da sua renda` : `Você gastou ${-savingRate}% além da renda`}
            {prev.expense > 0 && ` · gastos ${expenseDelta >= 0 ? '+' : ''}${expenseDelta}% vs. mês anterior`}
          </p>
        )}
      </section>

      {pendingBills.length > 0 && (
        <button className="alert card" onClick={() => go('bills')}>
          <span aria-hidden>⏰</span>
          <span>
            <strong>{pendingBills.length} conta{pendingBills.length > 1 ? 's' : ''} pedindo atenção</strong>
            <br /><small>{pendingBills.map((b) => b.title).join(', ')}</small>
          </span>
          <span className="chev" aria-hidden>›</span>
        </button>
      )}

      <div className="grid-2">
        <section className="card">
          <header className="card-head"><h2>Para onde foi o dinheiro</h2><button className="link" onClick={() => go('insights')}>Detalhes</button></header>
          {cats.length === 0 ? <Empty icon="🌱" title="Nenhuma despesa neste mês" /> : (
            <div className="donut-wrap">
              <Donut slices={slices} center={<><small>Total</small><Money cents={s.expense} /></>} />
              <ul className="legend">
                {slices.map((sl, i) => (
                  <li key={sl.label}>
                    <span className="swatch" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="legend-name">{sl.label}</span>
                    <span className="legend-pct">{pct(sl.value, s.expense)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card">
          <header className="card-head"><h2>Orçamento do mês</h2><button className="link" onClick={() => go('budget')}>Ajustar</button></header>
          {budget > 0 ? (
            <>
              <p className="big"><Money cents={s.expense} /> <small>de <Money cents={budget} /></small></p>
              <Progress value={s.expense} max={budget} status={statusFor(s.expense, budget)} label="Uso do orçamento total" />
              <p className="muted">{s.expense <= budget
                ? <>Restam <Money cents={budget - s.expense} /> para o mês.</>
                : <>Você passou <Money cents={s.expense - budget} /> do limite.</>}</p>
            </>
          ) : (
            <Empty icon="🎯" title="Defina um limite de gastos"><button className="btn primary sm" onClick={() => go('budget')}>Criar orçamento</button></Empty>
          )}
          {goal && (
            <div className="goal-mini">
              <p><span aria-hidden>{goal.emoji}</span> {goal.name} <small className="muted">{pct(goal.saved, goal.target)}%</small></p>
              <Progress value={goal.saved} max={goal.target} label={`Progresso da meta ${goal.name}`} />
            </div>
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <header className="card-head"><h2>Últimos 6 meses</h2></header>
          <Bars data={history} hidden={data.settings.hideValues} />
          <div className="bars-legend"><span><span className="dot income" />Receitas</span><span><span className="dot expense" />Despesas</span></div>
        </section>

        <section className="card">
          <header className="card-head"><h2>Movimentações recentes</h2><button className="link" onClick={() => go('transactions')}>Ver todas</button></header>
          {recent.length === 0 ? <Empty icon="🧾" title="Sem movimentações neste mês" /> : (
            <ul className="tx-list compact">
              {recent.map((t) => {
                const c = catById.get(t.categoryId);
                return (
                  <li key={t.id} className="tx">
                    <span className="tx-icon" aria-hidden>{c?.emoji ?? '❔'}</span>
                    <span className="tx-main"><span className="tx-desc">{t.description}</span><small className="muted">{c?.name}</small></span>
                    <Money cents={t.kind === 'income' ? t.amount : -t.amount} signed className={t.kind} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
