export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  type: "income" | "expense" | "transfer";
  description: string;
  date: Date;
  categoryId: string | null;
  source: "manual";
  createdAt: Date;
  updatedAt: Date;
}

export type TransactionInput = Omit<
  Transaction,
  "id" | "userId" | "createdAt" | "updatedAt"
>;
