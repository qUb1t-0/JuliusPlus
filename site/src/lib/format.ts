import type { Cents } from '../types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function money(cents: Cents, hidden = false): string {
  return hidden ? 'R$ ••••' : brl.format(cents / 100);
}

// Aceita "1.234,56", "1234.56", "1234,5", "R$ 12" e devolve centavos; null se inválido.
export function parseMoney(input: string): Cents | null {
  let s = input.replace(/[R$\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export function centsToInput(cents: Cents): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

// Datas são tratadas como strings locais para não sofrer deslocamento de fuso.
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function currentMonth(): string {
  return monthOf(todayISO());
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// Soma meses mantendo o dia, limitado ao último dia do mês de destino (31/01 + 1 → 28/02).
export function addMonthsToDate(date: string, delta: number): string {
  const [y, m, day] = date.split('-').map(Number);
  const target = new Date(y, m - 1 + delta, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(Math.min(day, last))}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function uid(): string {
  return crypto.randomUUID();
}

// Divide um valor em N parcelas inteiras; os centavos que sobram vão para as primeiras.
export function splitCents(total: Cents, parts: number): Cents[] {
  const base = Math.floor(total / parts);
  const rest = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rest ? 1 : 0));
}

export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
