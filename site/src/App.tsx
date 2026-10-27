import { useEffect, useState } from 'react';
import { TransactionForm } from './components/TransactionForm';
import { Modal } from './components/ui';
import { addMonths, currentMonth, monthLabel } from './lib/format';
import { StoreProvider, useStore } from './lib/store';
import { Bills } from './pages/Bills';
import { Budget } from './pages/Budget';
import { Goals } from './pages/Goals';
import { Home } from './pages/Home';
import { Insights } from './pages/Insights';
import { Settings } from './pages/Settings';
import { Signup } from './pages/Signup';
import { Transactions } from './pages/Transactions';

export type Page = 'home' | 'transactions' | 'budget' | 'bills' | 'goals' | 'insights' | 'settings';

const NAV: { id: Page; label: string; icon: string; mobile?: boolean }[] = [
  { id: 'home', label: 'Início', icon: '🏡', mobile: true },
  { id: 'transactions', label: 'Transações', icon: '🧾', mobile: true },
  { id: 'budget', label: 'Orçamento', icon: '🎯', mobile: true },
  { id: 'bills', label: 'Contas a pagar', icon: '📅' },
  { id: 'goals', label: 'Metas', icon: '🏁', mobile: true },
  { id: 'insights', label: 'Insights', icon: '📊' },
  { id: 'settings', label: 'Ajustes', icon: '⚙️' },
];
const MONTHLESS: Page[] = ['goals', 'settings'];

function pageFromHash(): Page {
  const h = window.location.hash.slice(1) as Page;
  return NAV.some((n) => n.id === h) ? h : 'home';
}

function Shell() {
  const { data, dispatch } = useStore();
  const [page, setPage] = useState<Page>(pageFromHash);
  const [month, setMonth] = useState(currentMonth);
  const [adding, setAdding] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const current = NAV.find((n) => n.id === page)!;

  // Navegação por hash: botão voltar do navegador e links diretos funcionam.
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const t = data.settings.theme;
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }, [data.settings.theme]);

  useEffect(() => {
    document.title = `${current.label} · Julius+`;
  }, [current.label]);

  // Atalho "n" para nova transação, exceto quando o foco está em um campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        setAdding(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (p: Page) => {
    window.location.hash = p;
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="app">
      <a href="#main" className="skip">Pular para o conteúdo</a>
      <aside className="sidebar">
        <div className="brand"><img className="brand-mark" src="/julius-icon.svg" alt="" /> <span>Julius<span className="brand-plus">+</span></span></div>
        <nav aria-label="Principal">
          <ul>
            {NAV.map((n) => (
              <li key={n.id}>
                <a href={`#${n.id}`} className={page === n.id ? 'active' : ''} aria-current={page === n.id ? 'page' : undefined}>
                  <span aria-hidden>{n.icon}</span>{n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <button className="btn primary block" onClick={() => setAdding(true)}>+ Nova transação <kbd>N</kbd></button>
        <p className="sidebar-foot">Olá, {data.profile?.name.split(' ')[0]}!<br />Seus lançamentos ficam neste navegador.</p>
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="topbar-title">
            <img className="mobile-brand" src="/julius-icon.svg" alt="Julius+" />
            <h1>{current.label}</h1>
          </div>
          <div className="topbar-actions">
            {!MONTHLESS.includes(page) && (
              <div className="month-picker" role="group" aria-label="Mês">
                <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior">‹</button>
                <button className="month-label" onClick={() => setMonth(currentMonth())} title="Voltar para o mês atual">{monthLabel(month)}</button>
                <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">›</button>
              </div>
            )}
            <button className="icon-btn" aria-pressed={data.settings.hideValues}
              aria-label={data.settings.hideValues ? 'Mostrar valores' : 'Ocultar valores'}
              onClick={() => dispatch({ type: 'setSettings', settings: { hideValues: !data.settings.hideValues } })}>
              {data.settings.hideValues ? '🙈' : '👁️'}
            </button>
          </div>
        </header>

        <main id="main" tabIndex={-1}>
          {page === 'home' && <Home month={month} go={go} />}
          {page === 'transactions' && <Transactions month={month} />}
          {page === 'budget' && <Budget month={month} />}
          {page === 'bills' && <Bills month={month} />}
          {page === 'goals' && <Goals />}
          {page === 'insights' && <Insights month={month} />}
          {page === 'settings' && <Settings />}
        </main>
      </div>

      <nav className="tabbar" aria-label="Principal (celular)">
        {NAV.filter((n) => n.mobile).slice(0, 2).map((n) => (
          <a key={n.id} href={`#${n.id}`} className={page === n.id ? 'active' : ''} aria-current={page === n.id ? 'page' : undefined}><span aria-hidden>{n.icon}</span>{n.label}</a>
        ))}
        <button className="fab" onClick={() => setAdding(true)} aria-label="Nova transação">+</button>
        {NAV.filter((n) => n.mobile).slice(2, 3).map((n) => (
          <a key={n.id} href={`#${n.id}`} className={page === n.id ? 'active' : ''} aria-current={page === n.id ? 'page' : undefined}><span aria-hidden>{n.icon}</span>{n.label}</a>
        ))}
        <button className={!NAV.filter((n) => n.mobile).slice(0, 3).some((n) => n.id === page) ? 'active' : ''} onClick={() => setMoreOpen(true)}><span aria-hidden>☰</span>Mais</button>
      </nav>

      <Modal title="Nova transação" open={adding} onClose={() => setAdding(false)}>
        {adding && <TransactionForm onDone={() => setAdding(false)} />}
      </Modal>
      <Modal title="Mais" open={moreOpen} onClose={() => setMoreOpen(false)}>
        <ul className="more-list">
          {NAV.filter((n) => !['home', 'transactions', 'budget'].includes(n.id)).map((n) => (
            <li key={n.id}><button onClick={() => go(n.id)}><span aria-hidden>{n.icon}</span>{n.label}</button></li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

// Primeiro acesso: sem cadastro, mostra a tela de cadastro no lugar do app.
function Gate() {
  const { data } = useStore();
  return data.profile ? <Shell /> : <Signup />;
}

export default function App() {
  return (
    <StoreProvider>
      <Gate />
    </StoreProvider>
  );
}
