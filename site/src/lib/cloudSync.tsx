import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppData } from '../types';
import { isAppData, useStore } from './store';
import { fetchUserData, saveUserData, supabase } from './supabase';

// Sincroniza os dados do app com a conta no Supabase (tabela dados_usuario):
// carrega ao entrar e salva automaticamente, com um pequeno atraso, a cada alteração.

export type CloudStatus = 'local' | 'loading' | 'saving' | 'saved' | 'error';

const SAVE_DELAY_MS = 800;
const RETRY_MS = 10_000;

const Ctx = createContext<{ status: CloudStatus; flush: () => Promise<void> }>({ status: 'local', flush: async () => {} });

// O perfil vem da tabela de cadastros; na nuvem vão só os dados do app.
function toCloud(data: AppData): string {
  return JSON.stringify({ ...data, profile: undefined });
}

export function CloudSync({ preloaded, children }: { preloaded: boolean; children: ReactNode }) {
  const { data, dispatch } = useStore();
  const [status, setStatus] = useState<CloudStatus>(!supabase ? 'local' : preloaded ? 'saved' : 'loading');
  const [retryTick, setRetryTick] = useState(0);
  const ready = useRef(preloaded);
  const lastSaved = useRef(preloaded ? toCloud(data) : '');
  const latest = useRef(data);
  latest.current = data;

  // Conta ainda não carregada (ex.: acabou de entrar): usa os dados da nuvem; se a conta
  // estiver vazia, envia os dados que já estão neste navegador.
  useEffect(() => {
    if (!supabase || preloaded) return;
    let alive = true;
    fetchUserData().then(async (remote) => {
      if (!alive) return;
      if (isAppData(remote)) {
        dispatch({ type: 'replaceAll', data: remote });
        lastSaved.current = toCloud({ ...remote, profile: undefined });
        ready.current = true;
        return setStatus('saved');
      }
      if (remote === undefined) return setStatus('error');
      const payload = toCloud(latest.current);
      const ok = await saveUserData(JSON.parse(payload));
      if (!alive) return;
      if (ok) lastSaved.current = payload;
      ready.current = true;
      setStatus(ok ? 'saved' : 'error');
    });
    return () => { alive = false; };
    // Executa uma vez ao entrar no app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salva alterações na nuvem (agrupando edições seguidas).
  useEffect(() => {
    if (!supabase || !ready.current) return;
    const payload = toCloud(data);
    if (payload === lastSaved.current) return;
    setStatus('saving');
    const t = window.setTimeout(async () => {
      const ok = await saveUserData(JSON.parse(payload));
      if (ok) lastSaved.current = payload;
      setStatus(ok ? (toCloud(latest.current) === payload ? 'saved' : 'saving') : 'error');
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [data, retryTick]);

  // Sem conexão: tenta de novo periodicamente e assim que a internet voltar.
  useEffect(() => {
    if (status !== 'error') return;
    const retry = () => setRetryTick((n) => n + 1);
    const t = window.setTimeout(retry, RETRY_MS);
    window.addEventListener('online', retry);
    return () => { window.clearTimeout(t); window.removeEventListener('online', retry); };
  }, [status]);

  // Garante que a última alteração foi salva (usado antes de sair da conta).
  const flush = useCallback(async () => {
    if (!supabase || !ready.current) return;
    const payload = toCloud(latest.current);
    if (payload === lastSaved.current) return;
    if (await saveUserData(JSON.parse(payload))) lastSaved.current = payload;
  }, []);

  return <Ctx.Provider value={{ status, flush }}>{children}</Ctx.Provider>;
}

export function useCloudSync() {
  return useContext(Ctx);
}
