import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { AppData, Bill, Budget, Category, FutureProject, Goal, Profile, Settings, Transaction } from '../types';
import { addMonthsToDate, splitCents, uid } from './format';
import { demoData } from './seed';

const STORAGE_KEY = 'julius-plus:data:v1';
// Chave usada antes da mudança de nome; lida uma vez para não perder dados já salvos.
const LEGACY_KEY = 'brota:data:v1';

export type NewTransaction = Omit<Transaction, 'id' | 'installment' | 'deletedAt'> & { installments: number };

type Action =
  | { type: 'addTransaction'; tx: NewTransaction }
  | { type: 'updateTransaction'; tx: Transaction }
  | { type: 'addTransactions'; txs: Omit<Transaction, 'id'>[] }
  | { type: 'trashTransaction'; id: string }
  | { type: 'trashInstallmentGroup'; groupId: string }
  | { type: 'restoreTransaction'; id: string }
  | { type: 'purgeTransaction'; id: string }
  | { type: 'emptyTrash' }
  | { type: 'setBudget'; budget: Budget }
  | { type: 'upsertBill'; bill: Bill }
  | { type: 'toggleBillPaid'; id: string; month: string }
  | { type: 'deleteBill'; id: string }
  | { type: 'upsertGoal'; goal: Goal }
  | { type: 'deleteGoal'; id: string }
  | { type: 'upsertProject'; project: FutureProject }
  | { type: 'deleteProject'; id: string }
  | { type: 'upsertCategory'; category: Category }
  | { type: 'deleteCategory'; id: string }
  | { type: 'setSettings'; settings: Partial<Settings> }
  | { type: 'setProfile'; profile: Profile }
  | { type: 'clearProfile' }
  | { type: 'replaceAll'; data: AppData };

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

// Categoria excluída só existe para o histórico; sem nenhuma transação apontando para ela, sai de vez.
function pruneArchived(state: AppData): AppData {
  const used = new Set(state.transactions.map((t) => t.categoryId));
  return { ...state, categories: state.categories.filter((c) => !c.archived || used.has(c.id)) };
}

function reducer(state: AppData, a: Action): AppData {
  switch (a.type) {
    case 'addTransaction': {
      const { installments, ...base } = a.tx;
      if (installments <= 1) return { ...state, transactions: [...state.transactions, { ...base, id: uid() }] };
      // Compra parcelada: gera uma transação por mês com o valor dividido sem perder centavos.
      const groupId = uid();
      const parts = splitCents(base.amount, installments).map((amount, i) => ({
        ...base, id: uid(), amount, date: addMonthsToDate(base.date, i),
        installment: { number: i + 1, total: installments, groupId },
      }));
      return { ...state, transactions: [...state.transactions, ...parts] };
    }
    case 'addTransactions':
      return { ...state, transactions: [...state.transactions, ...a.txs.map((t) => ({ ...t, id: uid() }))] };
    case 'trashInstallmentGroup': {
      const now = new Date().toISOString();
      return { ...state, transactions: state.transactions.map((t) => (t.installment?.groupId === a.groupId && !t.deletedAt ? { ...t, deletedAt: now } : t)) };
    }
    case 'updateTransaction':
      return { ...state, transactions: upsert(state.transactions, a.tx) };
    case 'trashTransaction':
      return { ...state, transactions: state.transactions.map((t) => (t.id === a.id ? { ...t, deletedAt: new Date().toISOString() } : t)) };
    case 'restoreTransaction':
      return { ...state, transactions: state.transactions.map((t) => (t.id === a.id ? { ...t, deletedAt: undefined } : t)) };
    case 'purgeTransaction':
      return pruneArchived({ ...state, transactions: state.transactions.filter((t) => t.id !== a.id) });
    case 'emptyTrash':
      return pruneArchived({ ...state, transactions: state.transactions.filter((t) => !t.deletedAt) });
    case 'setBudget':
      return { ...state, budget: a.budget };
    case 'upsertBill':
      return { ...state, bills: upsert(state.bills, a.bill) };
    case 'toggleBillPaid':
      return {
        ...state,
        bills: state.bills.map((b) => b.id !== a.id ? b : {
          ...b,
          paidMonths: b.paidMonths.includes(a.month) ? b.paidMonths.filter((m) => m !== a.month) : [...b.paidMonths, a.month],
        }),
      };
    case 'deleteBill':
      return { ...state, bills: state.bills.filter((b) => b.id !== a.id) };
    case 'upsertGoal':
      return { ...state, goals: upsert(state.goals, a.goal) };
    case 'deleteGoal':
      return { ...state, goals: state.goals.filter((g) => g.id !== a.id) };
    case 'upsertProject':
      return { ...state, projects: upsert(state.projects ?? [], a.project) };
    case 'deleteProject':
      return { ...state, projects: (state.projects ?? []).filter((p) => p.id !== a.id) };
    case 'upsertCategory':
      return { ...state, categories: upsert(state.categories, a.category) };
    case 'deleteCategory': {
      // Com transações, a categoria é só arquivada: some das listas de escolha, mas o histórico
      // continua mostrando nome e ícone originais. Sem transações, é removida de vez.
      const limits = { ...state.budget.limits };
      delete limits[a.id];
      const used = state.transactions.some((t) => t.categoryId === a.id);
      return {
        ...state,
        categories: used
          ? state.categories.map((c) => (c.id === a.id ? { ...c, archived: true } : c))
          : state.categories.filter((c) => c.id !== a.id),
        budget: { ...state.budget, limits },
      };
    }
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...a.settings } };
    case 'setProfile':
      return { ...state, profile: a.profile };
    case 'clearProfile':
      // Ao sair da conta, só o perfil é removido; os lançamentos ficam neste navegador.
      return { ...state, profile: undefined };
    case 'replaceAll':
      // Restaurar backup ou zerar dados não desfaz o cadastro do usuário.
      return { ...a.data, profile: a.data.profile ?? state.profile };
  }
}

export function isAppData(x: unknown): x is AppData {
  const d = x as AppData;
  return !!d && d.version === 1 && Array.isArray(d.transactions) && Array.isArray(d.categories)
    && !!d.budget && Array.isArray(d.bills) && Array.isArray(d.goals) && !!d.settings;
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isAppData(parsed)) return parsed;
    }
  } catch {
    // Armazenamento indisponível (modo privado) ou corrompido: segue com dados de exemplo.
  }
  return demoData();
}

const Ctx = createContext<{ data: AppData; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Sem persistência neste navegador; o app continua funcionando em memória.
    }
  }, [data]);
  return <Ctx.Provider value={{ data, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore fora do StoreProvider');
  return ctx;
}
