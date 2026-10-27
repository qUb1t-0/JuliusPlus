import { useEffect, useState, type FormEvent } from 'react';
import { Field } from '../components/ui';
import { useStore } from '../lib/store';
import {
  createPassword, loadSessionState, onSignedIn, sendConfirmationLink, signInWithPassword, supabase,
  type SessionState, type SignupInput,
} from '../lib/supabase';

// Máscara brasileira: (11) 98765-4321 para celular, (11) 3456-7890 para fixo.
function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 60;

// Etapa em que o cadastro começa, decidida pelo App após conferir a sessão.
export type SignupStart = { kind: 'details'; linkError?: string } | { kind: 'password'; input: SignupInput } | { kind: 'login' };

type Step = SignupStart | { kind: 'email'; input: SignupInput };

type SignedIn = Exclude<SessionState, { status: 'none' }>;

const STEP_NUMBER: Partial<Record<Step['kind'], number>> = { details: 1, email: 2, password: 3 };

export function Signup({ start, onFinished }: { start: SignupStart; onFinished: () => void }) {
  const { dispatch } = useStore();
  const [step, setStep] = useState<Step>(start);

  const finish = (input: SignupInput, synced: boolean) => {
    dispatch({ type: 'setProfile', profile: { ...input, createdAt: new Date().toISOString(), synced } });
    onFinished();
  };

  const resume = (s: SignedIn) => (s.status === 'ready' ? finish(s.input, true) : setStep({ kind: 'password', input: s.input }));

  const number = STEP_NUMBER[step.kind];

  return (
    <div className="signup">
      <div className="signup-card">
        <div className="signup-hero">
          <img src="/julius-icon.svg" alt="" className="signup-icon" />
          <h1 className="signup-title">Julius<span className="brand-plus">+</span></h1>
          <p className="signup-tagline">Cada centavo conta!</p>
        </div>
        {number && supabase && (
          <ol className="steps" aria-label={`Etapa ${number} de 3`}>
            {['Dados', 'E-mail', 'Senha'].map((label, i) => (
              <li key={label} className={i + 1 < number ? 'done' : i + 1 === number ? 'current' : ''} aria-current={i + 1 === number ? 'step' : undefined}>
                <span>{i + 1 < number ? '✓' : i + 1}</span>{label}
              </li>
            ))}
          </ol>
        )}
        {step.kind === 'details' && (
          <DetailsStep
            linkError={step.linkError}
            onSent={(input) => (supabase ? setStep({ kind: 'email', input }) : finish(input, false))}
            onLogin={() => setStep({ kind: 'login' })}
          />
        )}
        {step.kind === 'email' && (
          <CheckEmailStep input={step.input} onBack={() => setStep({ kind: 'details' })} onConfirmed={resume} />
        )}
        {step.kind === 'password' && <PasswordStep input={step.input} onDone={() => finish(step.input, true)} />}
        {step.kind === 'login' && <LoginStep onBack={() => setStep({ kind: 'details' })} onSignedIn={resume} />}
      </div>
    </div>
  );
}

function DetailsStep({ linkError, onSent, onLogin }: { linkError?: string; onSent: (input: SignupInput) => void; onLogin: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState('');

  const digits = phone.replace(/\D/g, '');
  const errors: Record<string, string> = {};
  if (name.trim().length < 2) errors.name = 'Informe seu nome.';
  if (!EMAIL_RE.test(email.trim())) errors.email = 'Informe um e-mail válido (ex.: voce@email.com).';
  if (digits.length !== 11 || digits[2] !== '9') errors.phone = 'Informe um celular com DDD (ex.: (11) 98765-4321).';
  const shown = submitted ? errors : {};

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setServerError('');
    if (Object.keys(errors).length) return;
    const input = { name: name.trim(), email: email.trim().toLowerCase(), phone: `+55${digits}` };
    setSending(true);
    const res = await sendConfirmationLink(input);
    setSending(false);
    if (!res.ok) return setServerError(res.message);
    onSent(input);
  }

  return (
    <form className="form signup-form" onSubmit={submit} noValidate>
      <div>
        <h2>Crie seu cadastro</h2>
        <p className="muted small">Vamos enviar um link para confirmar seu e-mail.</p>
      </div>
      {linkError && <p className="callout warn" role="alert">{linkError}</p>}
      <Field label="Nome" error={shown.name}>
        <input autoComplete="name" autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!shown.name} placeholder="Como você quer ser chamado" />
      </Field>
      <Field label="E-mail" error={shown.email}>
        <input type="email" autoComplete="email" inputMode="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!shown.email} placeholder="voce@email.com" />
      </Field>
      <Field label="Número de celular" error={shown.phone}>
        <input type="tel" autoComplete="tel-national" inputMode="numeric" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} aria-invalid={!!shown.phone} placeholder="(11) 98765-4321" />
      </Field>
      {serverError && <p className="callout warn" role="alert">{serverError}</p>}
      <button type="submit" className="btn primary block" disabled={sending}>{sending ? 'Enviando…' : 'Enviar link de confirmação'}</button>
      {supabase && <p className="muted small center">Já tem cadastro? <button type="button" className="link" onClick={onLogin}>Entrar</button></p>}
    </form>
  );
}

function CheckEmailStep({ input, onBack, onConfirmed }: { input: SignupInput; onBack: () => void; onConfirmed: (s: SignedIn) => void }) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  // Se o link for aberto em outra aba deste navegador, esta aba também avança para a senha.
  useEffect(() => onSignedIn(() => {
    loadSessionState().then((s) => { if (s.status !== 'none') onConfirmed(s); });
  }), [onConfirmed]);

  async function resend() {
    setError('');
    const res = await sendConfirmationLink(input);
    if (!res.ok) return setError(res.message);
    setNotice('Enviamos um novo link.');
    setCooldown(RESEND_SECONDS);
  }

  return (
    <div className="form signup-form">
      <div className="mail-sent" aria-hidden>📬</div>
      <div>
        <h2>Confira seu e-mail</h2>
        <p className="muted small">
          Enviamos um link de confirmação para <strong>{input.email}</strong>. Clique em <strong>“Confirm your email address”</strong>:
          uma nova aba do Julius+ vai abrir para você criar sua senha.
        </p>
      </div>
      <ul className="hint-list small muted">
        <li>O e-mail vem de <em>Supabase Auth</em> — confira também a caixa de spam.</li>
        <li>Abra o link neste mesmo aparelho.</li>
      </ul>
      {error && <p className="callout warn" role="alert">{error}</p>}
      {notice && <p className="callout" role="status">{notice}</p>}
      <div className="code-actions">
        <button type="button" className="link" onClick={onBack}>← Corrigir dados</button>
        <button type="button" className="link" onClick={resend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Reenviar link em ${cooldown}s` : 'Reenviar link'}
        </button>
      </div>
    </div>
  );
}

function passwordProblems(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < 8) out.push('8 caracteres');
  if (!/[A-Za-z]/.test(pw)) out.push('uma letra');
  if (!/\d/.test(pw)) out.push('um número');
  return out;
}

function PasswordStep({ input, onDone }: { input: SignupInput; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  const problems = passwordProblems(password);
  const errors: Record<string, string> = {};
  if (problems.length) errors.password = `A senha precisa ter pelo menos ${problems.join(', ')}.`;
  if (confirm !== password) errors.confirm = 'As senhas não são iguais.';
  const shown = submitted ? errors : {};

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setServerError('');
    if (Object.keys(errors).length) return;
    setSaving(true);
    const res = await createPassword(password);
    setSaving(false);
    if (!res.ok) return setServerError(res.message);
    onDone();
  }

  return (
    <form className="form signup-form" onSubmit={submit} noValidate>
      <div>
        <h2>E-mail confirmado! Agora crie sua senha</h2>
        <p className="muted small">Você vai usar <strong>{input.email}</strong> e esta senha para entrar no Julius+.</p>
      </div>
      {/* Campo de usuário oculto ajuda o gerenciador de senhas a salvar o par e-mail + senha. */}
      <input type="email" autoComplete="username" value={input.email} readOnly hidden />
      <Field label="Senha" error={shown.password} hint={!submitted ? 'Mínimo de 8 caracteres, com letras e números.' : undefined}>
        <input type={show ? 'text' : 'password'} autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!shown.password} />
      </Field>
      <Field label="Confirme a senha" error={shown.confirm}>
        <input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!shown.confirm} />
      </Field>
      <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />Mostrar senha</label>
      {serverError && <p className="callout warn" role="alert">{serverError}</p>}
      <button type="submit" className="btn primary block" disabled={saving}>{saving ? 'Salvando…' : 'Criar senha e entrar'}</button>
    </form>
  );
}

function LoginStep({ onBack, onSignedIn }: { onBack: () => void; onSignedIn: (s: SignedIn) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email.trim()) || !password) return setError('Informe seu e-mail e sua senha.');
    setBusy(true);
    const res = await signInWithPassword(email.trim().toLowerCase(), password);
    if (!res.ok) { setBusy(false); return setError(res.message); }
    const s = await loadSessionState();
    setBusy(false);
    if (s.status === 'none') return setError('Não encontramos um cadastro confirmado para este e-mail.');
    onSignedIn(s);
  }

  return (
    <form className="form signup-form" onSubmit={submit} noValidate>
      <div>
        <h2>Entrar no Julius+</h2>
        <p className="muted small">Use o e-mail e a senha do seu cadastro.</p>
      </div>
      <Field label="E-mail">
        <input type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Senha">
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p className="callout warn" role="alert">{error}</p>}
      <button type="submit" className="btn primary block" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      <p className="muted small center">Ainda não tem cadastro? <button type="button" className="link" onClick={onBack}>Criar cadastro</button></p>
    </form>
  );
}
