import type { Workbook, Worksheet } from 'exceljs';
import type { AppData, Kind, Method, Transaction } from '../types';
import { monthLabel, monthOf, todayISO } from './format';

const BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const DATE = 'dd/mm/yyyy';
const NAVY = 'FF1C2748';
const COIN = 'FFF2C14E';
const ZEBRA = 'FFF4F2EA';
const KIND: Record<Kind, string> = { expense: 'Despesa', income: 'Receita' };
const METHOD: Record<Method, string> = { pix: 'Pix', debito: 'Débito', credito: 'Crédito', dinheiro: 'Dinheiro', boleto: 'Boleto' };

// Datas em UTC para o Excel não deslocar o dia pelo fuso.
const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d || 1));
};
const reais = (cents: number) => cents / 100;

interface Col { header: string; key: string; width: number; fmt?: string }

// Tabela com cabeçalho navy, filtro, linha congelada e listras para leitura.
function table(ws: Worksheet, cols: Col[], rows: Record<string, unknown>[], totals?: Record<string, unknown>) {
  ws.columns = cols.map(({ header, key, width }) => ({ header, key, width }));
  cols.forEach((c) => { if (c.fmt) ws.getColumn(c.key).numFmt = c.fmt; });
  ws.addRows(rows);

  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: COIN } } };
  });
  for (let r = 2; r <= rows.length + 1; r += 2) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
    });
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: cols.length } };

  if (totals && rows.length) {
    const row = ws.addRow(totals);
    row.font = { bold: true };
    row.eachCell((cell) => { cell.border = { top: { style: 'thin', color: { argb: NAVY } } }; });
  }
}

function summary(wb: Workbook, data: AppData, active: Transaction[]) {
  const ws = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: COIN } } });
  ws.columns = [{ width: 28 }, { width: 20 }, { width: 20 }, { width: 20 }];

  const title = ws.addRow(['Julius+ · Seus dados']);
  title.font = { bold: true, size: 18, color: { argb: NAVY } };
  ws.addRow(['Exportado em', toDate(todayISO())]).getCell(2).numFmt = DATE;
  ws.addRow([]);

  const section = (label: string) => {
    const row = ws.addRow([label]);
    row.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    for (let c = 1; c <= 4; c++) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  };

  if (data.profile) {
    section('Conta');
    ws.addRow(['Nome', data.profile.name]);
    ws.addRow(['E-mail', data.profile.email]);
    ws.addRow(['Telefone', data.profile.phone]);
    ws.addRow(['Cadastro em', toDate(data.profile.createdAt.slice(0, 10))]).getCell(2).numFmt = DATE;
    ws.addRow([]);
  }

  const income = active.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = active.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
  section('Totais');
  [['Transações', active.length], ['Receitas', reais(income)], ['Despesas', reais(expense)], ['Saldo', reais(income - expense)],
    ['Orçamento mensal', reais(data.budget.total)], ['Contas a pagar', data.bills.length], ['Metas', data.goals.length]]
    .forEach(([label, value], i) => { ws.addRow([label, value]).getCell(2).numFmt = i >= 1 && i <= 4 ? BRL : '0'; });
  ws.addRow([]);

  section('Por mês');
  const head = ws.addRow(['Mês', 'Receitas', 'Despesas', 'Saldo']);
  head.font = { bold: true };
  head.eachCell((cell) => { cell.border = { bottom: { style: 'medium', color: { argb: COIN } } }; });
  const months = new Map<string, { income: number; expense: number }>();
  active.forEach((t) => {
    const m = months.get(monthOf(t.date)) ?? { income: 0, expense: 0 };
    m[t.kind] += t.amount;
    months.set(monthOf(t.date), m);
  });
  [...months.entries()].sort(([a], [b]) => b.localeCompare(a)).forEach(([m, v]) => {
    const row = ws.addRow([monthLabel(m), reais(v.income), reais(v.expense), reais(v.income - v.expense)]);
    [2, 3, 4].forEach((c) => { row.getCell(c).numFmt = BRL; });
  });
}

function transactionRows(list: Transaction[], data: AppData) {
  const cat = new Map(data.categories.map((c) => [c.id, c]));
  return [...list].sort((a, b) => b.date.localeCompare(a.date)).map((t) => ({
    date: toDate(t.date),
    kind: KIND[t.kind],
    description: t.description,
    category: cat.get(t.categoryId)?.name ?? '',
    group: cat.get(t.categoryId)?.group ?? '',
    method: METHOD[t.method],
    amount: reais(t.kind === 'income' ? t.amount : -t.amount),
    recurring: t.recurring ? 'Sim' : 'Não',
    installment: t.installment ? `${t.installment.number}/${t.installment.total}` : '',
    note: t.note ?? '',
    deleted: t.deletedAt ? toDate(t.deletedAt.slice(0, 10)) : '',
  }));
}

const TX_COLS: Col[] = [
  { header: 'Data', key: 'date', width: 12, fmt: DATE },
  { header: 'Tipo', key: 'kind', width: 10 },
  { header: 'Descrição', key: 'description', width: 32 },
  { header: 'Categoria', key: 'category', width: 20 },
  { header: 'Grupo', key: 'group', width: 16 },
  { header: 'Forma de pagamento', key: 'method', width: 20 },
  { header: 'Valor', key: 'amount', width: 15, fmt: BRL },
  { header: 'Recorrente', key: 'recurring', width: 12 },
  { header: 'Parcela', key: 'installment', width: 10 },
  { header: 'Observação', key: 'note', width: 36 },
];

// Planilha com uma aba por área do app; a biblioteca só é baixada quando o usuário exporta.
export async function downloadExcel(data: AppData) {
  const { Workbook } = await import('exceljs');
  const wb = new Workbook();
  wb.creator = 'Julius+';
  wb.created = new Date();

  const active = data.transactions.filter((t) => !t.deletedAt);
  const trash = data.transactions.filter((t) => t.deletedAt);
  const sumOf = (list: Transaction[]) => reais(list.reduce((s, t) => s + (t.kind === 'income' ? t.amount : -t.amount), 0));

  summary(wb, data, active);

  table(wb.addWorksheet('Transações'), TX_COLS, transactionRows(active, data), { description: 'Saldo', amount: sumOf(active) });

  const cat = new Map(data.categories.map((c) => [c.id, c]));
  const limits = Object.entries(data.budget.limits).filter(([, v]) => v > 0);
  table(wb.addWorksheet('Orçamento'), [
    { header: 'Categoria', key: 'category', width: 24 },
    { header: 'Grupo', key: 'group', width: 18 },
    { header: 'Limite mensal', key: 'limit', width: 16, fmt: BRL },
  ], limits.map(([id, v]) => ({ category: cat.get(id)?.name ?? id, group: cat.get(id)?.group ?? '', limit: reais(v) })),
  { category: 'Limite total do mês', limit: reais(data.budget.total) });

  const thisMonth = monthOf(todayISO());
  table(wb.addWorksheet('Contas a pagar'), [
    { header: 'Conta', key: 'title', width: 28 },
    { header: 'Valor', key: 'amount', width: 15, fmt: BRL },
    { header: 'Dia do vencimento', key: 'due', width: 18 },
    { header: 'Paga este mês', key: 'paid', width: 15 },
    { header: 'Meses pagos', key: 'months', width: 40 },
  ], data.bills.map((b) => ({
    title: b.title, amount: reais(b.amount), due: b.dueDay,
    paid: b.paidMonths.includes(thisMonth) ? 'Sim' : 'Não',
    months: [...b.paidMonths].sort().map(monthLabel).join(', '),
  })), { title: 'Total mensal', amount: reais(data.bills.reduce((s, b) => s + b.amount, 0)) });

  table(wb.addWorksheet('Metas'), [
    { header: 'Meta', key: 'name', width: 28 },
    { header: 'Objetivo', key: 'target', width: 15, fmt: BRL },
    { header: 'Guardado', key: 'saved', width: 15, fmt: BRL },
    { header: 'Falta', key: 'left', width: 15, fmt: BRL },
    { header: 'Progresso', key: 'progress', width: 12, fmt: '0%' },
    { header: 'Prazo', key: 'deadline', width: 18 },
  ], data.goals.map((g) => ({
    name: g.name, target: reais(g.target), saved: reais(g.saved), left: reais(Math.max(0, g.target - g.saved)),
    progress: g.target > 0 ? Math.min(1, g.saved / g.target) : 0, deadline: g.deadline ? monthLabel(g.deadline) : 'Sem prazo',
  })));

  const PROJECT_STATUS = { idea: 'Ideia', analysis: 'Em análise', done: 'Efetivado', dropped: 'Descartado' };
  table(wb.addWorksheet('Projetos Futuros'), [
    { header: 'Projeto', key: 'name', width: 28 },
    { header: 'Situação', key: 'status', width: 14 },
    { header: 'Investimento estimado', key: 'investment', width: 22, fmt: BRL },
    { header: 'Criado em', key: 'created', width: 12, fmt: DATE },
    { header: 'Efetivado em', key: 'done', width: 14, fmt: DATE },
    { header: 'Descrição', key: 'description', width: 60 },
  ], [...(data.projects ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => ({
    name: p.name, status: PROJECT_STATUS[p.status], investment: p.investment != null ? reais(p.investment) : '',
    created: toDate(p.createdAt), done: p.doneAt ? toDate(p.doneAt) : '', description: p.description,
  })));

  table(wb.addWorksheet('Categorias'), [
    { header: 'Categoria', key: 'name', width: 24 },
    { header: 'Grupo', key: 'group', width: 18 },
    { header: 'Tipo', key: 'kind', width: 10 },
    { header: 'Personalizada', key: 'custom', width: 14 },
  ], data.categories.map((c) => ({ name: c.name, group: c.group, kind: KIND[c.kind], custom: c.custom ? 'Sim' : 'Não' })));

  if (trash.length) {
    table(wb.addWorksheet('Lixeira'), [...TX_COLS, { header: 'Excluída em', key: 'deleted', width: 14, fmt: DATE }], transactionRows(trash, data));
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `julius-dados-${todayISO()}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
