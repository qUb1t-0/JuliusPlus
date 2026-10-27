import type { AppData, Bill, Category, Cents, Transaction } from '../types';
import { addMonths, daysInMonth, monthOf, todayISO } from './format';

export function active(data: AppData): Transaction[] {
  return data.transactions.filter((t) => !t.deletedAt);
}

export function inMonth(data: AppData, month: string): Transaction[] {
  return active(data).filter((t) => monthOf(t.date) === month);
}

export function catMap(data: AppData): Map<string, Category> {
  return new Map(data.categories.map((c) => [c.id, c]));
}

export function sum(list: Transaction[]): Cents {
  return list.reduce((s, t) => s + t.amount, 0);
}

export interface MonthSummary {
  income: Cents;
  expense: Cents;
  balance: Cents;
  count: number;
}

export function monthSummary(data: AppData, month: string): MonthSummary {
  const list = inMonth(data, month);
  const income = sum(list.filter((t) => t.kind === 'income'));
  const expense = sum(list.filter((t) => t.kind === 'expense'));
  return { income, expense, balance: income - expense, count: list.length };
}

export interface CategoryTotal {
  category: Category;
  total: Cents;
  count: number;
}

export function expenseByCategory(data: AppData, month: string): CategoryTotal[] {
  const cats = catMap(data);
  const totals = new Map<string, CategoryTotal>();
  for (const t of inMonth(data, month)) {
    if (t.kind !== 'expense') continue;
    const category = cats.get(t.categoryId) ?? { id: t.categoryId, name: 'Sem categoria', emoji: '❔', group: 'Outros', kind: 'expense' };
    const cur = totals.get(category.id) ?? { category, total: 0, count: 0 };
    cur.total += t.amount;
    cur.count += 1;
    totals.set(category.id, cur);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total);
}

export type BudgetStatus = 'ok' | 'warning' | 'over';

export function statusFor(spent: Cents, limit: Cents): BudgetStatus {
  if (limit <= 0) return 'ok';
  const ratio = spent / limit;
  return ratio > 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'ok';
}

// Ritmo de gasto: compara o consumido com a fração do mês já decorrida.
export function pace(spent: Cents, limit: Cents, month: string): { expectedByToday: Cents; projected: Cents } {
  const today = todayISO();
  const days = daysInMonth(month);
  const elapsed = monthOf(today) === month ? Number(today.slice(8, 10)) : monthOf(today) > month ? days : 0;
  const expectedByToday = Math.round((limit * elapsed) / days);
  const projected = elapsed > 0 ? Math.round((spent / elapsed) * days) : 0;
  return { expectedByToday, projected };
}

export interface Subscription {
  key: string;
  description: string;
  categoryId: string;
  amount: Cents;
  months: number;
  lastDate: string;
}

// Assinaturas = despesas recorrentes, agrupadas por descrição, vistas nos últimos 3 meses.
export function subscriptions(data: AppData, month: string): Subscription[] {
  const from = addMonths(month, -2);
  const groups = new Map<string, Subscription>();
  for (const t of active(data)) {
    const m = monthOf(t.date);
    if (t.kind !== 'expense' || !t.recurring || m < from || m > month) continue;
    const key = t.description.trim().toLowerCase();
    const cur = groups.get(key);
    if (!cur) {
      groups.set(key, { key, description: t.description, categoryId: t.categoryId, amount: t.amount, months: 1, lastDate: t.date });
    } else {
      cur.months += 1;
      if (t.date > cur.lastDate) {
        cur.lastDate = t.date;
        cur.amount = t.amount;
      }
    }
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount);
}

// Recorrentes do mês anterior que ainda não foram lançadas neste mês (mesma descrição e tipo).
export function pendingRecurring(data: AppData, month: string): Transaction[] {
  const prevMonth = addMonths(month, -1);
  const key = (t: Transaction) => `${t.kind}|${t.description.trim().toLowerCase()}`;
  const existing = new Set(inMonth(data, month).map(key));
  const seen = new Set<string>();
  return inMonth(data, prevMonth).filter((t) => {
    const k = key(t);
    if (!t.recurring || t.installment || existing.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function smallExpenses(data: AppData, month: string): Transaction[] {
  return inMonth(data, month)
    .filter((t) => t.kind === 'expense' && t.amount < data.settings.smallExpenseThreshold)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export type BillState = 'paid' | 'overdue' | 'soon' | 'upcoming';

export function billState(bill: Bill, month: string): BillState {
  if (bill.paidMonths.includes(month)) return 'paid';
  const today = todayISO();
  const due = `${month}-${String(Math.min(bill.dueDay, daysInMonth(month))).padStart(2, '0')}`;
  if (due < today) return 'overdue';
  const diff = (Date.parse(due) - Date.parse(today)) / 86_400_000;
  return diff <= 5 ? 'soon' : 'upcoming';
}

export interface Recap {
  summary: MonthSummary;
  previous: MonthSummary;
  topCategory?: CategoryTotal;
  biggest?: Transaction;
  smallest?: Transaction;
  priciestDay?: { date: string; total: Cents };
  ranking: CategoryTotal[];
  small: { total: Cents; count: number };
}

export function monthRecap(data: AppData, month: string): Recap {
  const expenses = inMonth(data, month).filter((t) => t.kind === 'expense');
  const ranking = expenseByCategory(data, month);
  const byDay = new Map<string, Cents>();
  expenses.forEach((t) => byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount));
  const priciest = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
  const sorted = [...expenses].sort((a, b) => b.amount - a.amount);
  const small = smallExpenses(data, month);
  return {
    summary: monthSummary(data, month),
    previous: monthSummary(data, addMonths(month, -1)),
    topCategory: ranking[0],
    biggest: sorted[0],
    smallest: sorted[sorted.length - 1],
    priciestDay: priciest ? { date: priciest[0], total: priciest[1] } : undefined,
    ranking,
    small: { total: sum(small), count: small.length },
  };
}

export function lastMonths(data: AppData, month: string, n: number): { month: string; summary: MonthSummary }[] {
  return Array.from({ length: n }, (_, i) => {
    const m = addMonths(month, i - n + 1);
    return { month: m, summary: monthSummary(data, m) };
  });
}
