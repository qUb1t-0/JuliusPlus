import { useState } from 'react';
import { useConfirm } from '../components/Confirm';
import { Select } from '../components/Select';
import { downloadExcel } from '../lib/exportExcel';
import { emptyData } from '../lib/seed';
import { useStore } from '../lib/store';
import { signOut } from '../lib/supabase';
import { useCloudSync, type CloudStatus } from '../lib/cloudSync';
import type { Kind } from '../types';

const SYNC_TEXT: Record<CloudStatus, string> = {
  local: 'Seus dados ficam salvos só neste navegador.',
  loading: 'Carregando seus dados da conta…',
  saving: 'Salvando na sua conta…',
  saved: 'Tudo salvo na sua conta — seus dados aparecem em qualquer aparelho em que você entrar.',
  error: 'Sem conexão com a nuvem. Suas alterações ficam neste navegador e serão salvas assim que a conexão voltar.',
};

export function Settings() {
  const { data, dispatch } = useStore();
  const ask = useConfirm();
  const { status, flush } = useCloudSync();
  const [msg, setMsg] = useState('');
  const [newCat, setNewCat] = useState({ name: '', emoji: '🏷️', group: '', kind: 'expense' as Kind });
  const [loggingOut, setLoggingOut] = useState(false);
  const [exporting, setExporting] = useState(false);

  function addCategory() {
    if (!newCat.name.trim()) return setMsg('Dê um nome para a categoria.');
    const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
    dispatch({ type: 'upsertCategory', category: { id, name: newCat.name.trim(), emoji: newCat.emoji || '🏷️', group: newCat.group.trim() || 'Personalizadas', kind: newCat.kind, custom: true } });
    setNewCat({ ...newCat, name: '' });
    setMsg('Categoria criada.');
  }

  async function logout() {
    if (!(await ask({ title: 'Sair da conta?', message: 'Você sai neste aparelho. Seus dados continuam salvos na sua conta.', confirmLabel: 'Sair' }))) return;
    setLoggingOut(true);
    await flush();
    const res = await signOut();
    setLoggingOut(false);
    if (!res.ok) return setMsg(res.message);
    // Ao entrar de novo, o app abre no Início e não em Ajustes.
    window.history.replaceState(null, '', window.location.pathname);
    // Os dados ficam na nuvem: o aparelho é limpo para a próxima pessoa não ver os lançamentos.
    dispatch({ type: 'replaceAll', data: emptyData() });
    dispatch({ type: 'clearProfile' });
  }

  async function exportData() {
    setExporting(true);
    try {
      await downloadExcel(data);
      setMsg('Planilha baixada.');
    } catch {
      setMsg('Não foi possível gerar a planilha. Tente de novo.');
    } finally {
      setExporting(false);
    }
  }

  const custom = data.categories.filter((c) => c.custom && !c.archived);
  const profile = data.profile;

  return (
    <div className="page">
      {msg && <p className="toast" role="status" onAnimationEnd={() => setMsg('')}>{msg}</p>}
      {profile && (
        <section className="card account">
          <header className="card-head"><h2>Conta</h2></header>
          <div className="account-row">
            <span className="account-avatar" aria-hidden>{profile.name.trim().charAt(0).toUpperCase()}</span>
            <div className="grow">
              <p className="account-name">{profile.name}</p>
              <p className="muted small">{profile.email}</p>
            </div>
            <button className="btn danger" onClick={logout} disabled={loggingOut}>{loggingOut ? 'Saindo…' : 'Sair da conta'}</button>
          </div>
        </section>
      )}

      <section className="card">
        <header className="card-head"><h2>Categorias personalizadas</h2></header>
        <div className="cat-form">
          <input aria-label="Emoji" className="emoji-input" maxLength={4} value={newCat.emoji} onChange={(e) => setNewCat({ ...newCat, emoji: e.target.value })} />
          <input aria-label="Nome da categoria" className="grow" placeholder="Nome (ex.: Pets)" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
          <input aria-label="Grupo" placeholder="Grupo (opcional)" value={newCat.group} onChange={(e) => setNewCat({ ...newCat, group: e.target.value })} />
          <Select<Kind> aria-label="Tipo" value={newCat.kind} onChange={(kind) => setNewCat({ ...newCat, kind })}
            options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} />
          <button className="btn primary" onClick={addCategory}>Adicionar</button>
        </div>
        {custom.length > 0 && (
          <ul className="chip-list">
            {custom.map((c) => (
              <li key={c.id} className="chip">
                {c.emoji} {c.name} <small className="muted">{c.group}</small>
                <button className="icon-btn" aria-label={`Excluir categoria ${c.name}`}
                  onClick={async () => {
                    if (await ask({ title: `Excluir “${c.name}”?`, message: 'Ela some das opções, mas as transações já registradas continuam no histórico com esta categoria.', confirmLabel: 'Excluir', danger: true })) {
                      dispatch({ type: 'deleteCategory', id: c.id });
                    }
                  }}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Seus dados</h2>
          <button className="btn primary sm" onClick={exportData} disabled={exporting}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v11M7 10l5 5 5-5M5 19h14" />
            </svg>
            {exporting ? 'Gerando planilha…' : 'Baixar Dados'}
          </button>
        </header>
        <p className={`sync-status sync-${status}`} role="status">
          <span className="sync-dot" aria-hidden />
          {SYNC_TEXT[status]}
        </p>
      </section>
    </div>
  );
}
