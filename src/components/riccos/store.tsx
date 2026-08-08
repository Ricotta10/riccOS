import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  budgets as initialBudgets,
  initialTransactions,
  type Transaction,
} from "@/lib/finance-data";

type Store = {
  month: number;
  year: number;
  setMonth: (m: number) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  transactions: Transaction[];
  monthTransactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, "id">) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  removeTransaction: (id: string) => void;
  toggleStatus: (id: string) => void;
  budgets: { category: string; limit: number }[];
  setBudget: (category: string, limit: number) => void;
};

const StoreContext = createContext<Store | null>(null);

export function RiccosProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(7); // Agosto
  const [year, setYear] = useState(2026);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [budgets, setBudgets] = useState(initialBudgets);

  const value = useMemo<Store>(() => {
    const shift = (delta: number) => {
      const total = month + delta;
      const nextYear = year + Math.floor(total / 12);
      const nextMonthIdx = ((total % 12) + 12) % 12;
      setMonth(nextMonthIdx);
      setYear(nextYear);
    };

    const monthTransactions = transactions.filter((tx) => {
      const [y, m] = tx.date.split("-").map(Number);
      return y === year && m === month + 1;
    });

    return {
      month,
      year,
      setMonth,
      nextMonth: () => shift(1),
      prevMonth: () => shift(-1),
      transactions,
      monthTransactions,
      addTransaction: (tx) =>
        setTransactions((prev) => [{ ...tx, id: crypto.randomUUID() }, ...prev]),
      updateTransaction: (id, patch) =>
        setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx))),
      removeTransaction: (id) => setTransactions((prev) => prev.filter((tx) => tx.id !== id)),
      toggleStatus: (id) =>
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === id ? { ...tx, status: tx.status === "pago" ? "pendente" : "pago" } : tx,
          ),
        ),
      budgets,
      setBudget: (category, limit) =>
        setBudgets((prev) => prev.map((b) => (b.category === category ? { ...b, limit } : b))),
    };
  }, [month, year, transactions, budgets]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useRiccos() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useRiccos must be used inside RiccosProvider");
  return ctx;
}
