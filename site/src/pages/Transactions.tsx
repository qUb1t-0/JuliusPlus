import { useMemo, useState } from 'react';
import { useConfirm } from '../components/Confirm';
import { Select } from '../components/Select';
import { TransactionForm } from '../components/TransactionForm';
import { Empty, Modal, Money } from '../components/ui';
import { addMonthsToDate, dayLabel, monthLabel } from '../lib/format';
import { inMonth, pendingRecurring, sum } from '../lib/selectors';
import { useStore } from '../lib/store';
import type { Transaction } from '../types';

const METHOD_LABEL: Record<Transaction['method'], string> = { pix: 'Pix', debito: 'Débito', credito: 'Crédito', dinheiro: 'Dinheiro', boleto: 'Boleto' };

function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function Transactions({ month }: { month: string }) {
  const { data, dispatch } = useStore();
  const ask = useConfirm();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | 'income' | 'expense'>('all');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [undo, setUndo] = useState<{ label: string; ids: string[] } | null>(null);
  const catById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);

  const list = inMonth(data, month)
    .filter((t) => kind === 'all' || t.kind === kind)
    .filter((t) => !category || t.categoryId === category)
    .filter((t) => !query || normalize(`${t.description} ${t.note ?? ''} ${catById.get(t.categoryId)?.name ?? ''}`).includes(normalize(query)))
    .sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description));

  const byDay = new Map<string, Transaction[]>();
  list.forEach((t) => byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]));
  const trash = data.transactions.filter((t) => t.deletedAt).sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));
  const income = sum(list.filter((t) => t.kind === 'income'));
  const expense = sum(list.filter((t) => t.kind === 'expense'));

  const recurringToLaunch = pendingRecurring(data, month);

  function launchRecurring() {
    dispatch({
      type: 'addTransactions',
      txs: recurringToLaunch.map((t) => ({
        kind: t.kind, amount: t.amount, categoryId: t.categoryId, description: t.description,
        method: t.method, recurring: true, note: t.note, date: addMonthsToDate(t.date, 1),
      })),
    });
  }

  async function remove(t: Transaction) {
    const group = t.installment
      ? data.transactions.filter((x) => x.installment?.groupId === t.installment!.groupId && !x.deletedAt)
      : [];
    let ids = [t.id];
    if (group.length > 1 && await ask({
      title: 'Remover parcelas',
      message: `“${t.description}” tem ${group.length} parcelas. Quer mover todas para a lixeira ou só a ${t.installment!.number}/${t.installment!.total}?`,
      confirmLabel: 'Todas as parcelas', cancelLabel: `Só a ${t.installment!.number}/${t.installment!.total}`,
    })) {
      dispatch({ type: 'trashInstallmentGroup', groupId: t.installment!.groupId });
      ids = group.map((x) => x.id);
    } else {
      dispatch({ type: 'trashTransaction', id: t.id });
    }
    const entry = { label: ids.length > 1 ? `${ids.length} parcelas de “${t.description}”` : `“${t.description}”`, ids };
    setUndo(entry);
    window.setTimeout(() => setUndo((u) => (u === entry ? null : u)), 6000);
  }

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Forma', 'Valor', 'Parcela', 'Observação']];
    list.forEach((t) => rows.push([
      t.date, t.kind === 'income' ? 'Receita' : 'Despesa', t.description, catById.get(t.categoryId)?.name ?? '',
      METHOD_LABEL[t.method], ((t.kind === 'income' ? 1 : -1) * t.amount / 100).toFixed(2).replace('.', ','),
      t.installment ? `${t.installment.number}/${t.installment.total}` : '', t.note ?? '',
    ]));
    // BOM + ";" para o Excel em pt-BR abrir com acentos e colunas corretas.
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transacoes-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="page">
      <div className="toolbar">
        <input type="search" className="grow" placeholder="Buscar descrição, categoria ou observação" aria-label="Buscar transações"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select aria-label="Filtrar por tipo" value={kind} onChange={setKind}
          options={[{ value: 'all', label: 'Todas' }, { value: 'expense', label: 'Despesas' }, { value: 'income', label: 'Receitas' }]} />
        <Select aria-label="Filtrar por categoria" value={category} onChange={setCategory}
          options={[{ value: '', label: 'Todas as categorias' }, ...data.categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}${c.archived ? ' (excluída)' : ''}` }))]} />
        <button className="btn ghost" onClick={exportCsv} disabled={!list.length}>Exportar CSV</button>
        <button className="btn ghost" onClick={() => setShowTrash(true)}>Lixeira{trash.length ? ` (${trash.length})` : ''}</button>
      </div>

      {recurringToLaunch.length > 0 && (
        <div className="callout recurring-banner">
          <span>↻ {recurringToLaunch.length === 1 ? '1 lançamento mensal do mês passado ainda não está' : `${recurringToLaunch.length} lançamentos mensais do mês passado ainda não estão`} neste mês
            <small className="muted"> ({recurringToLaunch.map((t) => t.description).join(', ')})</small></span>
          <button className="btn primary sm" onClick={launchRecurring}>Lançar agora</button>
        </div>
      )}

      <div className="summary-strip card">
        <span>{list.length} transações em {monthLabel(month).toLowerCase()}</span>
        <span>Entradas <Money cents={income} className="income" /></span>
        <span>Saídas <Money cents={expense} className="expense" /></span>
      </div>

      {list.length === 0 ? (
        <div className="card"><Empty icon="🔎" title={query || category || kind !== 'all' ? 'Nada encontrado com esses filtros' : 'Nenhuma transação neste mês'} /></div>
      ) : (
        [...byDay.entries()].map(([day, items]) => (
          <section key={day} className="card day-group">
            <header className="day-head">
              <h3>{dayLabel(day)}</h3>
              <Money cents={items.reduce((s, t) => s + (t.kind === 'income' ? t.amount : -t.amount), 0)} signed className="muted" />
            </header>
            <ul className="tx-list">
              {items.map((t) => {
                const c = catById.get(t.categoryId);
                return (
                  <li key={t.id} className="tx">
                    <button className="tx-hit" onClick={() => setEditing(t)} aria-label={`Editar ${t.description}`}>
                      <span className="tx-icon" aria-hidden>{c?.emoji ?? '❔'}</span>
                      <span className="tx-main">
                        <span className="tx-desc">{t.description}{t.installment && <span className="tag">{t.installment.number}/{t.installment.total}</span>}{t.recurring && <span className="tag">↻ mensal</span>}</span>
                        <small className="muted">{c?.name ?? 'Sem categoria'} · {METHOD_LABEL[t.method]}{t.note ? ` · ${t.note}` : ''}</small>
                      </span>
                      <Money cents={t.kind === 'income' ? t.amount : -t.amount} signed className={t.kind} />
                    </button>
                    <button className="icon-btn" onClick={() => remove(t)} aria-label={`Mover ${t.description} para a lixeira`}>🗑</button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {undo && (
        <div className="toast" role="status">
          {undo.label} {undo.ids.length > 1 ? 'foram' : 'foi'} para a lixeira.
          <button className="link" onClick={() => { undo.ids.forEach((id) => dispatch({ type: 'restoreTransaction', id })); setUndo(null); }}>Desfazer</button>
        </div>
      )}

      <Modal title="Editar transação" open={!!editing} onClose={() => setEditing(null)}>
        {editing && <TransactionForm key={editing.id} editing={editing} onDone={() => setEditing(null)} />}
      </Modal>

      <Modal title="Lixeira" open={showTrash} onClose={() => setShowTrash(false)}>
        {trash.length === 0 ? <Empty icon="🧹" title="A lixeira está vazia" /> : (
          <>
            <ul className="tx-list">
              {trash.map((t) => (
                <li key={t.id} className="tx">
                  <span className="tx-icon" aria-hidden>{catById.get(t.categoryId)?.emoji ?? '❔'}</span>
                  <span className="tx-main"><span className="tx-desc">{t.description}</span><small className="muted">{dayLabel(t.date)}</small></span>
                  <Money cents={t.amount} />
                  <button className="btn ghost sm" onClick={() => dispatch({ type: 'restoreTransaction', id: t.id })}>Restaurar</button>
                  <button className="icon-btn" aria-label={`Excluir ${t.description} definitivamente`}
                    onClick={async () => {
                      if (await ask({ title: `Excluir “${t.description}”?`, message: 'Excluir definitivamente? Isso não pode ser desfeito.', confirmLabel: 'Excluir', danger: true })) {
                        dispatch({ type: 'purgeTransaction', id: t.id });
                      }
                    }}>✕</button>
                </li>
              ))}
            </ul>
            <div className="form-actions">
              <button className="btn danger" onClick={async () => {
                if (await ask({ title: 'Esvaziar lixeira?', message: `Excluir ${trash.length} itens definitivamente? Isso não pode ser desfeito.`, confirmLabel: 'Esvaziar', danger: true })) {
                  dispatch({ type: 'emptyTrash' });
                }
              }}>Esvaziar lixeira</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
