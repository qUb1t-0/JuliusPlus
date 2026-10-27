import { useState, type FormEvent } from 'react';
import { Field } from '../components/ui';
import { useStore } from '../lib/store';
import { registerSignup } from '../lib/supabase';

// Máscara brasileira: (11) 98765-4321 para celular, (11) 3456-7890 para fixo.
function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function Signup() {
  const { dispatch } = useStore();
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
    const data = { name: name.trim(), email: email.trim().toLowerCase(), phone: `+55${digits}` };
    setSending(true);
    const res = await registerSignup(data);
    setSending(false);
    if (!res.ok) return setServerError(res.message);
    dispatch({ type: 'setProfile', profile: { ...data, createdAt: new Date().toISOString(), synced: res.synced } });
  }

  return (
    <div className="signup">
      <div className="signup-card">
        <div className="signup-hero">
          <img src="/julius-icon.svg" alt="" className="signup-icon" />
          <h1 className="signup-title">Julius<span className="brand-plus">+</span></h1>
          <p className="signup-tagline">Cada centavo conta!</p>
        </div>
        <form className="form signup-form" onSubmit={submit} noValidate>
          <div>
            <h2>Crie seu cadastro</h2>
            <p className="muted small">Leva menos de um minuto. Depois é só começar a organizar seus gastos.</p>
          </div>
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
          <button type="submit" className="btn primary block" disabled={sending}>{sending ? 'Salvando…' : 'Criar cadastro'}</button>
          <p className="muted small center">Usamos seus dados só para identificar sua conta. Nada de spam.</p>
        </form>
      </div>
    </div>
  );
}
