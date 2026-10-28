import { useEffect, useState } from 'react';
import { TransactionForm } from './components/TransactionForm';
import { Modal } from './components/ui';
import { addMonths, currentMonth, monthLabel } from './lib/format';
import { CloudSync } from './lib/cloudSync';
import { isAppData, StoreProvider, useStore } from './lib/store';
import { fetchUserData, isPasswordRecoveryLink, linkErrorFromUrl, loadSessionState, supabase, type SessionState } from './lib/supabase';
import { LoadingScreen } from './components/LoadingScreen';
import { ThemeToggle } from './components/ThemeToggle';
import { Bills } from './pages/Bills';
import { Budget } from './pages/Budget';
import { Goals } from './pages/Goals';
import { Home } from './pages/Home';
import { Insights } from './pages/Insights';
import { Settings } from './pages/Settings';
import { Signup, type SignupStart } from './pages/Signup';
import { Transactions } from './pages/Transactions';

export type Page = 'home' | 'transactions' | 'budget' | 'bills' | 'goals' | 'insights' | 'settings';

const NAV: { id: Page; label: string; icon: string; mobile?: boolean }[] = [
  { id: 'home', label: 'Início', icon: '🏡', mobile: true },
  { id: 'budget', label: 'Orçamento', icon: '🎯', mobile: true },
  { id: 'bills', label: 'Contas a pagar', icon: '📅' },
  { id: 'transactions', label: 'Transações', icon: '🧾', mobile: true },
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
        <div className="brand"><img className="brand-mark" src="/julius-icon.svg" alt="" /> <span className="brand-name"><span className="brand-word">Julius</span><span className="brand-plus">+</span></span></div>
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
        <button className="btn primary block" onClick={() => setAdding(true)}>+ Nova transação</button>
        <ThemeToggle />
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

// `preloaded`: os dados da conta já foram trazidos da nuvem durante a tela de carregamento.
type Boot = { status: 'loading' } | { status: 'app'; preloaded: boolean } | { status: 'signup'; start: SignupStart };

// Ao abrir o site, mostra a tela de carregamento enquanto confere a sessão no Supabase.
// O perfil guardado no navegador não basta para entrar: é preciso sessão confirmada e com senha.
// A tela de carregamento fica por cima até terminar a animação de saída; o login já é montado
// por baixo para o logo saber até onde "voar".
function Gate() {
  const { data, dispatch } = useStore();
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });
  const [loaderVisible, setLoaderVisible] = useState(true);
  const hasLocalProfile = !!data.profile;

  useEffect(() => {
    let alive = true;
    const linkError = linkErrorFromUrl() ?? undefined;
    loadSessionState()
      .catch((): SessionState => ({ status: 'none' }))
      .then(async (s) => {
        if (!alive) return;
        // Remove da URL os tokens ou erros devolvidos pelo link de confirmação do e-mail.
        if (/access_token|error/.test(window.location.hash + window.location.search)) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        if (!supabase) return setBoot(hasLocalProfile ? { status: 'app', preloaded: false } : { status: 'signup', start: { kind: 'details' } });
        // Link de "Esqueci senha": abre direto na tela de nova senha.
        if (s.status !== 'none' && isPasswordRecoveryLink()) {
          return setBoot({ status: 'signup', start: { kind: 'password', input: s.input, reset: true } });
        }
        if (s.status === 'ready') {
          // Traz os dados da conta enquanto a tela de carregamento ainda está visível.
          const remote = await fetchUserData();
          if (!alive) return;
          const preloaded = isAppData(remote);
          if (preloaded) dispatch({ type: 'replaceAll', data: remote });
          dispatch({ type: 'setProfile', profile: { ...s.input, createdAt: new Date().toISOString(), synced: true } });
          return setBoot({ status: 'app', preloaded });
        }
        // Primeiro acesso abre na tela de entrar; link vencido vai para o cadastro, que explica como pedir outro.
        setBoot({
          status: 'signup',
          start: s.status === 'needs-password' ? { kind: 'password', input: s.input } : linkError ? { kind: 'details', linkError } : { kind: 'login' },
        });
      });
    return () => { alive = false; };
    // Executa uma vez, na abertura do site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sem perfil depois de estar no app = saiu da conta: volta para a tela de entrar.
  const start: SignupStart = boot.status === 'signup' ? boot.start : supabase ? { kind: 'login' } : { kind: 'details' };
  const content = boot.status === 'loading' ? null
    : boot.status === 'app' && data.profile ? <CloudSync preloaded={boot.preloaded}><Shell /></CloudSync>
    : <Signup key={start.kind} start={start} intro={loaderVisible} onFinished={() => setBoot({ status: 'app', preloaded: false })} />;

  return (
    <>
      {content}
      {loaderVisible && (
        <LoadingScreen
          done={boot.status !== 'loading'}
          flyTarget={boot.status === 'signup' ? '.signup-hero' : null}
          onExited={() => setLoaderVisible(false)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Gate />
    </StoreProvider>
  );
}
