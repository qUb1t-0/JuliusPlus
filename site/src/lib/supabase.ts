import { createClient, type AuthError } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

// Lido antes de criar o cliente: o Supabase limpa da URL os dados que os links de e-mail trazem.
const initialUrlParams = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));

// Sem as variáveis de ambiente o app funciona só com o armazenamento local.
export const supabase = url && key ? createClient(url, key) : null;

export type SignupInput = { name: string; email: string; phone: string };
export type StepResult = { ok: true } | { ok: false; message: string };

function describe(error: AuthError): string {
  const code = error.code ?? '';
  if (error.status === 429 || code.includes('rate_limit')) return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
  if (code === 'invalid_credentials') return 'E-mail ou senha incorretos.';
  if (code === 'email_not_confirmed') return 'Este e-mail ainda não foi confirmado. Faça o cadastro para receber o link.';
  if (code === 'weak_password') return 'Senha fraca. Use pelo menos 8 caracteres com letras e números.';
  if (code === 'same_password') return 'Escolha uma senha diferente da atual.';
  if (code === 'email_address_not_authorized') return 'Este e-mail ainda não pode receber mensagens do Julius+. Fale com o suporte.';
  if (code === 'email_address_invalid') return 'Este e-mail não é aceito. Use outro endereço.';
  return 'Não foi possível concluir agora. Verifique sua conexão e tente de novo.';
}

// Etapa 1: o Supabase envia um link de confirmação para o e-mail informado.
// Nome e celular vão como metadados; o cadastro só é criado no banco quando o link é clicado.
// O link volta para este mesmo site, que abre na etapa de criar senha.
export async function sendConfirmationLink(input: SignupInput): Promise<StepResult> {
  if (!supabase) return { ok: true };
  const { error } = await supabase.auth.signInWithOtp({
    email: input.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: window.location.origin,
      data: { nome: input.name, celular: input.phone },
    },
  });
  return error ? { ok: false, message: describe(error) } : { ok: true };
}

// Erro devolvido pelo Supabase na URL quando o link é inválido ou expirou.
export function linkErrorFromUrl(): string | null {
  const code = initialUrlParams.get('error_code');
  if (!code && !initialUrlParams.get('error')) return null;
  return code === 'otp_expired'
    ? 'Este link expirou ou já foi usado. Peça um novo link abaixo.'
    : 'Não foi possível usar este link. Peça um novo link abaixo.';
}

// O site foi aberto pelo link de "Esqueci senha" do e-mail.
export function isPasswordRecoveryLink(): boolean {
  return initialUrlParams.get('type') === 'recovery';
}

// Envia o link de redefinição de senha; ele volta para este site, na tela de nova senha.
export async function sendPasswordReset(email: string): Promise<StepResult> {
  if (!supabase) return { ok: false, message: 'Recuperação de senha indisponível neste ambiente.' };
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  return error ? { ok: false, message: describe(error) } : { ok: true };
}

// Avisa quando o e-mail é confirmado em outra aba (o link abre uma aba nova).
export function onSignedIn(callback: () => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') callback();
  });
  return () => data.subscription.unsubscribe();
}

// Etapa 3: com o e-mail confirmado pelo link (sessão ativa), o usuário define a senha de acesso.
export async function createPassword(password: string): Promise<StepResult> {
  if (!supabase) return { ok: true };
  const { error } = await supabase.auth.updateUser({ password, data: { senha_definida: true } });
  return error ? { ok: false, message: describe(error) } : { ok: true };
}

// Usuário que já tem cadastro entra com e-mail e senha.
export async function signInWithPassword(email: string, password: string): Promise<StepResult> {
  if (!supabase) return { ok: false, message: 'Login indisponível neste ambiente.' };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { ok: false, message: describe(error) } : { ok: true };
}

// Encerra a sessão neste navegador.
export async function signOut(): Promise<StepResult> {
  if (!supabase) return { ok: true };
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  return error ? { ok: false, message: describe(error) } : { ok: true };
}

export type SessionState =
  | { status: 'none' }
  | { status: 'needs-password'; input: SignupInput }
  | { status: 'ready'; input: SignupInput };

// Descobre em que ponto do cadastro está quem já tem sessão (código confirmado,
// link de e-mail antigo ou login): sem senha ainda, ou pronto para entrar no app.
export async function loadSessionState(): Promise<SessionState> {
  if (!supabase) return { status: 'none' };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { status: 'none' };
  const { data } = await supabase.from('cadastros').select('nome, email, celular').eq('user_id', session.user.id).maybeSingle();
  if (!data) return { status: 'none' };
  const input = { name: data.nome, email: data.email, phone: data.celular };
  return session.user.user_metadata?.senha_definida ? { status: 'ready', input } : { status: 'needs-password', input };
}
