// Valores monetários sempre em centavos (inteiros) para evitar erro de ponto flutuante.
export type Cents = number;

export type Kind = 'expense' | 'income';
export type Method = 'pix' | 'debito' | 'credito' | 'dinheiro' | 'boleto';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  group: string;
  kind: Kind;
  custom?: boolean;
}

export interface Transaction {
  id: string;
  kind: Kind;
  amount: Cents;
  categoryId: string;
  date: string; // YYYY-MM-DD (data local)
  description: string;
  method: Method;
  recurring: boolean;
  note?: string;
  installment?: { number: number; total: number; groupId: string };
  projectId?: string; // despesa gerada ao efetivar um Projeto Futuro
  deletedAt?: string;
}

export interface Budget {
  total: Cents;
  limits: Record<string, Cents>;
}

export interface Bill {
  id: string;
  title: string;
  emoji: string;
  amount: Cents;
  dueDay: number;
  paidMonths: string[]; // YYYY-MM
}

export interface Goal {
  id: string;
  name: string;
  emoji: string;
  target: Cents;
  saved: Cents;
  deadline?: string; // YYYY-MM
}

export type ProjectStatus = 'idea' | 'analysis' | 'done' | 'dropped';

// Ideia de negócio registrada em "Projetos Futuros".
export interface FutureProject {
  id: string;
  name: string;
  emoji: string;
  description: string;
  investment?: Cents; // investimento estimado
  status: ProjectStatus;
  createdAt: string; // YYYY-MM-DD
  doneAt?: string; // YYYY-MM-DD, quando foi efetivado
  transactionId?: string; // despesa lançada em Transações ao efetivar
}

export interface Settings {
  hideValues: boolean;
  theme: 'system' | 'light' | 'dark';
  smallExpenseThreshold: Cents;
}

export interface Profile {
  name: string;
  email: string;
  phone: string; // E.164, ex.: +5511987654321
  createdAt: string;
  synced: boolean; // true quando o cadastro foi gravado no Supabase
}

export interface AppData {
  version: 1;
  profile?: Profile;
  categories: Category[];
  transactions: Transaction[];
  budget: Budget;
  bills: Bill[];
  goals: Goal[];
  projects?: FutureProject[]; // opcional: dados salvos antes da aba existir não têm o campo
  settings: Settings;
}
