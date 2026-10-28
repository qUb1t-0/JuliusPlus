import { useState } from 'react';
import { Select } from '../components/Select';
import { Empty, Field, Modal, Money } from '../components/ui';
import { centsToInput, daysInMonth, monthLabel, pad, parseMoney, uid } from '../lib/format';
import { billState, type BillState } from '../lib/selectors';
import { useStore } from '../lib/store';
import type { Bill } from '../types';

const STATE: Record<BillState, { label: string; cls: string }> = {
  overdue: { label: 'Atrasada', cls: 'over' },
  soon: { label: 'Vence em breve', cls: 'warning' },
  upcoming: { label: 'Em aberto', cls: 'neutral' },
  paid: { label: 'Paga', cls: 'ok' },
};
const ORDER: BillState[] = ['overdue', 'soon', 'upcoming', 'paid'];

export function Bills({ month }: { month: string }) {
  const { data, dispatch } = useStore();
  const [editing, setEditing] = useState<Bill | 'new' | null>(null);
  const bills = [...data.bills].sort((a, b) => ORDER.indexOf(billState(a, month)) - ORDER.indexOf(billState(b, month)) || a.dueDay - b.dueDay);
  const open = bills.filter((b) => billState(b, month) !== 'paid');
  const totalOpen = open.reduce((s, b) => s + b.amount, 0);
  const totalPaid = bills.filter((b) => billState(b, month) === 'paid').reduce((s, b) => s + b.amount, 0);

  function pay(b: Bill, register: boolean) {
    dispatch({ type: 'toggleBillPaid', id: b.id, month });
    if (register) {
      const date = `${month}-${pad(Math.min(b.dueDay, daysInMonth(month)))}`;
      dispatch({ type: 'addTransaction', tx: { kind: 'expense', amount: b.amount, categoryId: 'contas', date, description: b.title, method: 'boleto', recurring: true, installments: 1 } });
    }
  }

  return (
    <div className="page">
      <div className="grid-3">
        <div className="card stat-card"><small className="muted">A pagar em {monthLabel(month).toLowerCase()}</small><Money cents={totalOpen} className="big expense" /></div>
        <div className="card stat-card"><small className="muted">Já pago</small><Money cents={totalPaid} className="big income" /></div>
        <div className="card stat-card"><small className="muted">Contas cadastradas</small><span className="big">{bills.length}</span></div>
      </div>

      <section className="card">
        <header className="card-head"><h2>Contas do mês</h2><button className="btn primary sm" onClick={() => setEditing('new')}>+ Nova conta</button></header>
        {bills.length === 0 ? <Empty icon="📅" title="Cadastre boletos e contas fixas para não esquecer nenhum vencimento" /> : (
          <ul className="bill-list">
            {bills.map((b) => {
              const st = billState(b, month);
              return (
                <li key={b.id} className={`bill bill-${st}`}>
                  <span className="tx-icon" aria-hidden>{b.emoji}</span>
                  <button className="tx-main link-like" onClick={() => setEditing(b)}>
                    <span className="tx-desc">{b.title}</span>
                    <small className="muted">Vence dia {b.dueDay}</small>
                  </button>
                  <span className={`pill pill-${STATE[st].cls}`}>{STATE[st].label}</span>
                  <Money cents={b.amount} />
                  {st === 'paid'
                    ? <button className="btn ghost sm" onClick={() => dispatch({ type: 'toggleBillPaid', id: b.id, month })}>Desfazer</button>
                    : <button className="btn primary sm" onClick={() => pay(b, confirm(`Lançar “${b.title}” também como despesa em Transações?`))}>Pagar</button>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal title={editing === 'new' ? 'Nova conta' : 'Editar conta'} open={!!editing} onClose={() => setEditing(null)}>
        {editing && <BillForm bill={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

const EMOJIS = ['🏠', '💡', '💧', '🔥', '📶', '📱', '🏢', '💳', '🚗', '🎓', '🩺', '📄'];

function BillForm({ bill, onDone }: { bill?: Bill; onDone: () => void }) {
  const { dispatch } = useStore();
  const [title, setTitle] = useState(bill?.title ?? '');
  const [emoji, setEmoji] = useState(bill?.emoji ?? '📄');
  const [amount, setAmount] = useState(bill ? centsToInput(bill.amount) : '');
  const [dueDay, setDueDay] = useState(bill?.dueDay ?? 10);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function save() {
    const cents = parseMoney(amount);
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Dê um nome para a conta.';
    if (!cents) errs.amount = 'Informe o valor.';
    setErrors(errs);
    if (Object.keys(errs).length || !cents) return;
    dispatch({ type: 'upsertBill', bill: { id: bill?.id ?? uid(), title: title.trim(), emoji, amount: cents, dueDay, paidMonths: bill?.paidMonths ?? [] } });
    onDone();
  }

  return (
    <div className="form">
      <div className="emoji-picker" role="radiogroup" aria-label="Ícone">
        {EMOJIS.map((e) => <button key={e} type="button" role="radio" aria-checked={emoji === e} className={emoji === e ? 'on' : ''} onClick={() => setEmoji(e)}>{e}</button>)}
      </div>
      <Field label="Nome" error={errors.title}><input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Condomínio" /></Field>
      <div className="row-2">
        <Field label="Valor" error={errors.amount}><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></Field>
        <Field label="Dia do vencimento">
          <Select value={dueDay} onChange={setDueDay}
            options={Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({ value: d, label: `Dia ${d}` }))} />
        </Field>
      </div>
      <div className="form-actions">
        {bill && <button className="btn danger" onClick={() => { if (confirm('Remover esta conta?')) { dispatch({ type: 'deleteBill', id: bill.id }); onDone(); } }}>Remover</button>}
        <span className="grow" />
        <button className="btn primary" onClick={save}>Salvar</button>
      </div>
    </div>
  );
}
