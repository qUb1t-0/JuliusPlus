import { useState } from 'react';
import { CHART_COLORS, Empty, Money } from '../components/ui';
import { dayLabel, monthLabel, pct } from '../lib/format';
import { catMap, monthRecap, smallExpenses, subscriptions } from '../lib/selectors';
import { useStore } from '../lib/store';

type Tab = 'recap' | 'small' | 'subs';

export function Insights({ month }: { month: string }) {
  const [tab, setTab] = useState<Tab>('recap');
  return (
    <div className="page">
      <div className="tabs" role="tablist" aria-label="Tipo de análise">
        {([['recap', 'Retrospectiva'], ['small', 'Pequenos gastos'], ['subs', 'Assinaturas']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'recap' && <Recap month={month} />}
        {tab === 'small' && <Small month={month} />}
        {tab === 'subs' && <Subs month={month} />}
      </div>
    </div>
  );
}

function Recap({ month }: { month: string }) {
  const { data } = useStore();
  const r = monthRecap(data, month);
  if (!r.summary.count) return <div className="card"><Empty icon="📭" title={`Sem dados em ${monthLabel(month).toLowerCase()}`} /></div>;
  const max = r.ranking[0]?.total ?? 1;
  const diff = r.summary.expense - r.previous.expense;
  return (
    <>
      <div className="grid-3">
        <div className="card stat-card"><small className="muted">Transações no mês</small><span className="big">{r.summary.count}</span></div>
        <div className="card stat-card"><small className="muted">Maior gasto</small>{r.biggest ? <><Money cents={r.biggest.amount} className="big" /><small>{r.biggest.description}</small></> : '—'}</div>
        <div className="card stat-card"><small className="muted">Dia mais caro</small>{r.priciestDay ? <><Money cents={r.priciestDay.total} className="big" /><small>{dayLabel(r.priciestDay.date)}</small></> : '—'}</div>
      </div>
      <section className="card">
        <header className="card-head"><h2>Corrida das categorias</h2></header>
        <ol className="race">
          {r.ranking.map((c, i) => (
            <li key={c.category.id}>
              <span className="race-label"><span aria-hidden>{c.category.emoji}</span> {c.category.name}</span>
              <span className="race-track"><span className="race-bar" style={{ width: `${(c.total / max) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} /></span>
              <span className="race-value"><Money cents={c.total} /> <small className="muted">{pct(c.total, r.summary.expense)}%</small></span>
            </li>
          ))}
        </ol>
      </section>
      <section className="card">
        <header className="card-head"><h2>Resumo</h2></header>
        <ul className="facts">
          {r.topCategory && <li>Você mais gastou com <strong>{r.topCategory.category.emoji} {r.topCategory.category.name}</strong> ({pct(r.topCategory.total, r.summary.expense)}% das despesas).</li>}
          {r.previous.expense > 0 && <li>Seus gastos {diff > 0 ? 'subiram' : 'caíram'} <strong><Money cents={Math.abs(diff)} /></strong> em relação ao mês anterior.</li>}
          {r.small.count > 0 && <li><strong>{r.small.count}</strong> pequenos gastos somaram <strong><Money cents={r.small.total} /></strong>.</li>}
          <li>{r.summary.balance >= 0 ? <>Sobraram <strong><Money cents={r.summary.balance} /></strong> no mês.</> : <>O mês fechou <strong><Money cents={-r.summary.balance} /></strong> no vermelho.</>}</li>
        </ul>
      </section>
    </>
  );
}

function Small({ month }: { month: string }) {
  const { data } = useStore();
  const list = smallExpenses(data, month);
  const cats = catMap(data);
  const total = list.reduce((s, t) => s + t.amount, 0);
  const byCat = new Map<string, number>();
  list.forEach((t) => byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount));
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  return (
    <section className="card">
      <header className="card-head"><h2>Compras abaixo de <Money cents={data.settings.smallExpenseThreshold} /></h2></header>
      {list.length === 0 ? <Empty icon="🪙" title="Nenhum pequeno gasto neste mês" /> : (
        <>
          <p className="big"><Money cents={total} /> <small>em {list.length} compras</small></p>
          {top && <p className="callout">A categoria com mais pequenos gastos foi <strong>{cats.get(top[0])?.emoji} {cats.get(top[0])?.name}</strong>. Cortar metade deles liberaria <Money cents={Math.round(total / 2)} /> por mês.</p>}
          <ul className="tx-list">
            {list.map((t) => (
              <li key={t.id} className="tx">
                <span className="tx-icon" aria-hidden>{cats.get(t.categoryId)?.emoji ?? '❔'}</span>
                <span className="tx-main"><span className="tx-desc">{t.description}</span><small className="muted">{dayLabel(t.date)}</small></span>
                <Money cents={-t.amount} signed className="expense" />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Subs({ month }: { month: string }) {
  const { data } = useStore();
  const subs = subscriptions(data, month);
  const cats = catMap(data);
  const monthly = subs.reduce((s, x) => s + x.amount, 0);
  return (
    <section className="card">
      <header className="card-head"><h2>Gastos recorrentes</h2></header>
      <p className="muted small">Despesas marcadas como “repete todo mês” nos últimos 3 meses.</p>
      {subs.length === 0 ? <Empty icon="📺" title="Nenhuma despesa recorrente encontrada" /> : (
        <>
          <div className="stats">
            <div><small className="muted">Por mês</small><Money cents={monthly} className="big" /></div>
            <div><small className="muted">Por ano</small><Money cents={monthly * 12} className="big" /></div>
          </div>
          <ul className="tx-list">
            {subs.map((s) => (
              <li key={s.key} className="tx">
                <span className="tx-icon" aria-hidden>{cats.get(s.categoryId)?.emoji ?? '❔'}</span>
                <span className="tx-main"><span className="tx-desc">{s.description}</span><small className="muted">visto em {s.months} de 3 meses · último {dayLabel(s.lastDate)}</small></span>
                <Money cents={s.amount} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
