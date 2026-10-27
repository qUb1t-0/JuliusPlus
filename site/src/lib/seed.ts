import type { AppData, Category, Transaction } from '../types';
import { addMonths, currentMonth, daysInMonth, pad, todayISO, uid } from './format';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'mercado', name: 'Mercado', emoji: '🛒', group: 'Essenciais', kind: 'expense' },
  { id: 'moradia', name: 'Moradia', emoji: '🏠', group: 'Essenciais', kind: 'expense' },
  { id: 'contas', name: 'Contas da casa', emoji: '💡', group: 'Essenciais', kind: 'expense' },
  { id: 'saude', name: 'Saúde', emoji: '🩺', group: 'Essenciais', kind: 'expense' },
  { id: 'transporte', name: 'Transporte', emoji: '🚌', group: 'Mobilidade', kind: 'expense' },
  { id: 'apps', name: 'Apps de corrida', emoji: '🚗', group: 'Mobilidade', kind: 'expense' },
  { id: 'restaurantes', name: 'Restaurantes', emoji: '🍽️', group: 'Estilo de vida', kind: 'expense' },
  { id: 'delivery', name: 'Delivery', emoji: '🛵', group: 'Estilo de vida', kind: 'expense' },
  { id: 'lazer', name: 'Lazer', emoji: '🎬', group: 'Estilo de vida', kind: 'expense' },
  { id: 'compras', name: 'Compras', emoji: '🛍️', group: 'Estilo de vida', kind: 'expense' },
  { id: 'assinaturas', name: 'Assinaturas', emoji: '📺', group: 'Estilo de vida', kind: 'expense' },
  { id: 'educacao', name: 'Educação', emoji: '📚', group: 'Crescimento', kind: 'expense' },
  { id: 'outros', name: 'Outros', emoji: '📦', group: 'Outros', kind: 'expense' },
  { id: 'salario', name: 'Salário', emoji: '💼', group: 'Receitas', kind: 'income' },
  { id: 'freela', name: 'Renda extra', emoji: '🧑‍💻', group: 'Receitas', kind: 'income' },
  { id: 'rendimentos', name: 'Rendimentos', emoji: '📈', group: 'Receitas', kind: 'income' },
];

export function emptyData(): AppData {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES,
    transactions: [],
    budget: { total: 0, limits: {} },
    bills: [],
    goals: [],
    settings: { hideValues: false, theme: 'system', smallExpenseThreshold: 5000 },
  };
}

// Dados fictícios relativos ao mês atual, para a demonstração sempre parecer recente.
export function demoData(): AppData {
  const today = todayISO();
  const months = [addMonths(currentMonth(), -2), addMonths(currentMonth(), -1), currentMonth()];
  const todayDay = Number(today.slice(8, 10));
  const tx: Transaction[] = [];
  const add = (month: string, day: number, categoryId: string, description: string, amount: number,
    method: Transaction['method'] = 'debito', kind: Transaction['kind'] = 'expense', recurring = false) => {
    const d = `${month}-${pad(Math.min(day, daysInMonth(month)))}`;
    if (d > today) return;
    tx.push({ id: uid(), kind, amount, categoryId, date: d, description, method, recurring });
  };

  months.forEach((m, i) => {
    const jitter = (base: number) => base + ((i * 731 + base) % 997);
    add(m, 5, 'salario', 'Salário', 520000, 'pix', 'income', true);
    if (i !== 1) add(m, 18, 'freela', 'Projeto freelance', 85000 + i * 10000, 'pix', 'income');
    add(m, 1, 'rendimentos', 'Rendimento poupança', 3120 + i * 140, 'pix', 'income');
    add(m, 6, 'moradia', 'Aluguel', 160000, 'boleto', 'expense', true);
    add(m, 10, 'contas', 'Conta de luz', jitter(17800), 'boleto', 'expense', true);
    add(m, 12, 'contas', 'Internet', 9990, 'credito', 'expense', true);
    add(m, 3, 'mercado', 'Supermercado', jitter(42000));
    add(m, 17, 'mercado', 'Supermercado', jitter(31500));
    add(m, 24, 'mercado', 'Hortifruti', jitter(6800));
    add(m, 2, 'assinaturas', 'Streaming de vídeo', 3990, 'credito', 'expense', true);
    add(m, 2, 'assinaturas', 'Streaming de música', 2190, 'credito', 'expense', true);
    add(m, 15, 'assinaturas', 'Armazenamento na nuvem', 990, 'credito', 'expense', true);
    add(m, 8, 'transporte', 'Recarga transporte', 15000, 'pix');
    add(m, 9, 'apps', 'Corrida por app', jitter(2350), 'credito');
    add(m, 21, 'apps', 'Corrida por app', jitter(3120), 'credito');
    add(m, 7, 'delivery', 'Pedido delivery', jitter(4590), 'credito');
    add(m, 14, 'delivery', 'Pedido delivery', jitter(3870), 'credito');
    add(m, 26, 'delivery', 'Pedido delivery', jitter(5210), 'credito');
    add(m, 11, 'restaurantes', 'Almoço', jitter(3800), 'debito');
    add(m, 19, 'restaurantes', 'Jantar com amigos', jitter(12900), 'credito');
    add(m, 13, 'lazer', 'Cinema', 6400, 'credito');
    add(m, 4, 'outros', 'Café', 890, 'pix');
    add(m, 16, 'outros', 'Padaria', 1450, 'debito');
    add(m, 22, 'saude', 'Farmácia', jitter(5600), 'debito');
    add(m, 20, 'educacao', 'Curso online', 4990, 'credito', 'expense', true);
  });

  const groupId = uid();
  [0, 1, 2].forEach((n) => {
    const d = `${months[n]}-${pad(Math.min(23, daysInMonth(months[n])))}`;
    if (d <= today) {
      tx.push({ id: uid(), kind: 'expense', amount: 33300 + (n === 0 ? 1 : 0), categoryId: 'compras', date: d,
        description: 'Fone de ouvido', method: 'credito', recurring: false,
        installment: { number: n + 1, total: 3, groupId } });
    }
  });

  return {
    ...emptyData(),
    transactions: tx,
    budget: {
      total: 420000,
      limits: { mercado: 90000, delivery: 15000, restaurantes: 20000, lazer: 15000, apps: 8000, compras: 40000 },
    },
    // Uma conta paga, uma atrasada, uma vencendo em breve e uma em aberto, para mostrar todos os estados.
    bills: [
      { id: uid(), title: 'Aluguel', emoji: '🏠', amount: 160000, dueDay: 1, paidMonths: months },
      { id: uid(), title: 'Condomínio', emoji: '🏢', amount: 45000, dueDay: Math.max(1, todayDay - 2), paidMonths: [months[0], months[1]] },
      { id: uid(), title: 'Conta de luz', emoji: '💡', amount: 18500, dueDay: Math.min(28, todayDay + 3), paidMonths: [months[0], months[1]] },
      { id: uid(), title: 'Fatura do cartão', emoji: '💳', amount: 98000, dueDay: 28, paidMonths: [months[0], months[1]] },
    ],
    goals: [
      { id: uid(), name: 'Reserva de emergência', emoji: '🛟', target: 1500000, saved: 620000 },
      { id: uid(), name: 'Viagem de férias', emoji: '✈️', target: 600000, saved: 145000, deadline: addMonths(currentMonth(), 8) },
    ],
  };
}
