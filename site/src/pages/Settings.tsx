import { useRef, useState } from 'react';
import { Field } from '../components/ui';
import { centsToInput, parseMoney, todayISO } from '../lib/format';
import { demoData, emptyData } from '../lib/seed';
import { isAppData, useStore } from '../lib/store';
import { signOut } from '../lib/supabase';
import type { Kind, Settings as SettingsT } from '../types';

export function Settings() {
  const { data, dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [threshold, setThreshold] = useState(centsToInput(data.settings.smallExpenseThreshold));
  const [newCat, setNewCat] = useState({ name: '', emoji: '🏷️', group: '', kind: 'expense' as Kind });
  const [loggingOut, setLoggingOut] = useState(false);

  function backup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `julius-plus-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function restore(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isAppData(parsed)) throw new Error('formato');
      if (confirm('Substituir todos os dados atuais pelo backup?')) {
        dispatch({ type: 'replaceAll', data: parsed });
        setMsg('Backup restaurado.');
      }
    } catch {
      setMsg('Arquivo inválido: escolha um backup gerado por este app.');
    }
  }

  function addCategory() {
    if (!newCat.name.trim()) return setMsg('Dê um nome para a categoria.');
    const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
    dispatch({ type: 'upsertCategory', category: { id, name: newCat.name.trim(), emoji: newCat.emoji || '🏷️', group: newCat.group.trim() || 'Personalizadas', kind: newCat.kind, custom: true } });
    setNewCat({ ...newCat, name: '' });
    setMsg('Categoria criada.');
  }

  async function logout() {
    if (!confirm('Sair da sua conta neste aparelho? Seus lançamentos continuam salvos neste navegador.')) return;
    setLoggingOut(true);
    const res = await signOut();
    setLoggingOut(false);
    if (!res.ok) return setMsg(res.message);
    // Ao entrar de novo, o app abre no Início e não em Ajustes.
    window.history.replaceState(null, '', window.location.pathname);
    dispatch({ type: 'clearProfile' });
  }

  const set = (s: Partial<SettingsT>) => dispatch({ type: 'setSettings', settings: s });
  const custom = data.categories.filter((c) => c.custom);
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
        <header className="card-head"><h2>Preferências</h2></header>
        <label className="check"><input type="checkbox" checked={data.settings.hideValues} onChange={(e) => set({ hideValues: e.target.checked })} />Ocultar valores na tela (modo discreto)</label>
        <div className="row-2">
          <Field label="Tema">
            <select value={data.settings.theme} onChange={(e) => set({ theme: e.target.value as SettingsT['theme'] })}>
              <option value="system">Automático (sistema)</option><option value="light">Claro</option><option value="dark">Escuro</option>
            </select>
          </Field>
          <Field label="Limite de “pequeno gasto”" hint="Compras abaixo deste valor entram em Pequenos gastos.">
            <input inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)}
              onBlur={() => { const c = parseMoney(threshold); if (c) set({ smallExpenseThreshold: c }); else setThreshold(centsToInput(data.settings.smallExpenseThreshold)); }} />
          </Field>
        </div>
      </section>

      <section className="card">
        <header className="card-head"><h2>Categorias personalizadas</h2></header>
        <div className="cat-form">
          <input aria-label="Emoji" className="emoji-input" maxLength={4} value={newCat.emoji} onChange={(e) => setNewCat({ ...newCat, emoji: e.target.value })} />
          <input aria-label="Nome da categoria" className="grow" placeholder="Nome (ex.: Pets)" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
          <input aria-label="Grupo" placeholder="Grupo (opcional)" value={newCat.group} onChange={(e) => setNewCat({ ...newCat, group: e.target.value })} />
          <select aria-label="Tipo" value={newCat.kind} onChange={(e) => setNewCat({ ...newCat, kind: e.target.value as Kind })}>
            <option value="expense">Despesa</option><option value="income">Receita</option>
          </select>
          <button className="btn primary" onClick={addCategory}>Adicionar</button>
        </div>
        {custom.length > 0 && (
          <ul className="chip-list">
            {custom.map((c) => (
              <li key={c.id} className="chip">
                {c.emoji} {c.name} <small className="muted">{c.group}</small>
                <button className="icon-btn" aria-label={`Excluir categoria ${c.name}`}
                  onClick={() => confirm(`Excluir “${c.name}”? As transações dela irão para ${c.kind === 'income' ? 'Renda extra' : 'Outros'}.`) && dispatch({ type: 'deleteCategory', id: c.id })}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <header className="card-head"><h2>Seus dados</h2></header>
        <p className="muted small">Tudo fica salvo só neste navegador. Faça backups para não perder nada.</p>
        <div className="button-row">
          <button className="btn primary" onClick={backup}>Baixar backup (JSON)</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>Restaurar backup</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />
          <button className="btn ghost" onClick={() => confirm('Recarregar os dados de exemplo? Seus dados atuais serão substituídos.') && dispatch({ type: 'replaceAll', data: demoData() })}>Carregar exemplo</button>
          <button className="btn danger" onClick={() => confirm('Apagar TODOS os dados? Isso não pode ser desfeito.') && dispatch({ type: 'replaceAll', data: emptyData() })}>Começar do zero</button>
        </div>
      </section>
    </div>
  );
}
