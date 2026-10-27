import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

// Sem as variáveis de ambiente o app funciona só com o armazenamento local.
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

export type SignupResult = { ok: true; synced: boolean } | { ok: false; message: string };

export async function registerSignup(input: { name: string; email: string; phone: string }): Promise<SignupResult> {
  if (!supabase) return { ok: true, synced: false };
  const { error } = await supabase.from('cadastros').insert({ nome: input.name, email: input.email, celular: input.phone });
  if (!error) return { ok: true, synced: true };
  // E-mail já cadastrado (violação de unicidade): segue em frente neste aparelho.
  if (error.code === '23505') return { ok: true, synced: true };
  return { ok: false, message: 'Não foi possível concluir o cadastro agora. Verifique sua conexão e tente de novo.' };
}
