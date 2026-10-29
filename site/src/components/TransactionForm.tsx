import { useState, type FormEvent } from 'react';
import { centsToInput, money, parseMoney, splitCents, todayISO } from '../lib/format';
import { useStore } from '../lib/store';
import type { Kind, Method, Transaction } from '../types';
import { DatePicker } from './DatePicker';
import { Select } from './Select';
import { Field } from './ui';

const METHODS: { id: Method; label: string }[] = [
  { id: 'pix', label: 'Pix' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'boleto', label: 'Boleto' },
];

export function TransactionForm({ editing, defaultKind = 'expense', onDone }: { editing?: Transaction; defaultKind?: Kind; onDone: () => void }) {
  const { data, dispatch } = useStore();
  const [kind, setKind] = useState<Kind>(editing?.kind ?? defaultKind);
  const [amount, setAmount] = useState(editing ? centsToInput(editing.amount) : '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? '');
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [method, setMethod] = useState<Method>(editing?.method ?? (kind === 'income' ? 'pix' : 'debito'));
  const [installments, setInstallments] = useState(1);
  const [recurring, setRecurring] = useState(editing?.recurring ?? false);
  const [note, setNote] = useState(editing?.note ?? '');
  const [submitted, setSubmitted] = useState(false);

  // Excluídas não aparecem para novos lançamentos, mas a da transação em edição continua selecionável.
  const cats = data.categories.filter((c) => c.kind === kind && (!c.archived || c.id === editing?.categoryId));
  const groups = [...new Set(cats.map((c) => c.group))];
  const cents = parseMoney(amount);

  // Validação recalculada a cada render: o erro some assim que o campo é corrigido.
  const allErrors: Record<string, string> = {};
  if (cents === null || cents <= 0) allErrors.amount = 'Informe um valor maior que zero (ex.: 49,90).';
  if (!description.trim()) allErrors.description = 'Dê um nome para identificar a transação.';
  if (!cats.some((c) => c.id === categoryId)) allErrors.category = 'Escolha uma categoria.';
  if (!date) allErrors.date = 'Informe a data.';
  const errors = submitted ? allErrors : {};

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(allErrors).length || cents === null) return;

    const base = { kind, amount: cents, categoryId, date, description: description.trim(), method, recurring, note: note.trim() || undefined };
    if (editing) dispatch({ type: 'updateTransaction', tx: { ...editing, ...base } });
    else dispatch({ type: 'addTransaction', tx: { ...base, installments: method === 'credito' && kind === 'expense' ? installments : 1 } });
    onDone();
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="segmented" role="radiogroup" aria-label="Tipo">
        {(['expense', 'income'] as Kind[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k}
            className={kind === k ? `on ${k}` : ''}
            onClick={() => { setKind(k); setCategoryId(''); }}>
            {k === 'expense' ? 'Despesa' : 'Receita'}
          </button>
        ))}
      </div>

      <Field label="Valor" error={errors.amount}>
        <input inputMode="decimal" autoFocus placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!errors.amount} />
      </Field>
      <Field label="Descrição" error={errors.description}>
        <input placeholder="Ex.: Supermercado" maxLength={80} value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={!!errors.description} />
      </Field>
      <div className="row-2">
        <Field label="Categoria" error={errors.category}>
          <Select value={categoryId} onChange={setCategoryId} invalid={!!errors.category}
            options={groups.flatMap((g) => cats.filter((c) => c.group === g).map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}`, group: g })))} />
        </Field>
        <Field label="Data" error={errors.date}>
          <DatePicker value={date} onChange={setDate} invalid={!!errors.date} />
        </Field>
      </div>
      <div className="row-2">
        <Field label="Forma de pagamento">
          <Select value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m.id, label: m.label }))} />
        </Field>
        {!editing && method === 'credito' && kind === 'expense' && (
          <Field label="Parcelas" hint={installments > 1 && cents ? `${installments}× de ${money(splitCents(cents, installments)[installments - 1])} · um lançamento por mês` : undefined}>
            <Select value={installments} onChange={setInstallments}
              options={Array.from({ length: 24 }, (_, i) => i + 1).map((n) => ({ value: n, label: n === 1 ? 'À vista' : `${n}×` }))} />
          </Field>
        )}
      </div>
      <label className="check">
        <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
        Repete todo mês (assinatura, conta fixa, salário)
      </label>
      <Field label="Observação (opcional)">
        <textarea rows={2} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="form-actions">
        <button type="submit" className="btn primary">{editing ? 'Salvar alterações' : 'Adicionar'}</button>
      </div>
    </form>
  );
}
