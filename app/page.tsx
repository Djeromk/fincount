'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/shared/hooks/useRequireAuth';
import { signOut } from '@/shared/lib/auth';
import { useRouter } from 'next/navigation';
import { AddTransactionForm } from '@/features/add-transaction/ui/AddTransactionForm';
import { TransactionService } from '@/domain/transaction/TransactionService';
import type { Transaction } from '@/shared/types/transaction';
import type { Category } from '@/shared/types/category';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/shared/config/firebase';
import { Sidebar } from '@/widgets/Sidebar/Sidebar';
import { MetricCard } from '@/widgets/MetricCard/MetricCard';
import { TransactionChart } from '@/widgets/TransactionChart/TransactionChart';
import { TransactionsTable } from '@/widgets/TransactionsTable/TransactionsTable';
import { Wallet, TrendingUp, TrendingDown, Activity } from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useRequireAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        const [categoriesData, transactionsData] = await Promise.all([
          loadCategories(user.uid),
          TransactionService.list(user.uid),
        ]);
        setCategories(categoriesData);
        setTransactions(transactionsData);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [user]);

  const loadCategories = async (userId: string) => {
    const categoriesRef = collection(db, 'categories');
    const q = query(categoriesRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Category[];
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleTransactionAdded = async () => {
    if (!user) return;
    const transactionsData = await TransactionService.list(user.uid);
    setTransactions(transactionsData);
  };

  // Calculate metrics
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;
  const transactionCount = transactions.length;

  // Loading state
  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-base font-medium text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar userEmail={user.email} onSignOut={handleSignOut} />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border bg-card px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Обзор</h1>
              <p className="text-sm text-muted-foreground">
                Добро пожаловать в ваш финансовый дашборд
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted px-4 py-2">
                <p className="text-xs font-medium text-muted-foreground">Последнее обновление</p>
                <p className="text-sm font-semibold text-foreground">
                  {new Date().toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-7xl space-y-8">
            {/* Metrics Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Баланс"
                value={`${balance.toLocaleString('ru-RU')} ₽`}
                icon={Wallet}
                iconColor="text-violet-600 dark:text-violet-400"
              />
              <MetricCard
                title="Доходы"
                value={`${totalIncome.toLocaleString('ru-RU')} ₽`}
                change={{ value: '+12.5%', trend: 'up' }}
                icon={TrendingUp}
                iconColor="text-green-600 dark:text-green-400"
              />
              <MetricCard
                title="Расходы"
                value={`${totalExpense.toLocaleString('ru-RU')} ₽`}
                change={{ value: '+8.2%', trend: 'down' }}
                icon={TrendingDown}
                iconColor="text-red-600 dark:text-red-400"
              />
              <MetricCard
                title="Транзакций"
                value={transactionCount.toString()}
                icon={Activity}
                iconColor="text-blue-600 dark:text-blue-400"
              />
            </div>

            {/* Chart & Form Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Chart - 2 columns */}
              <div className="lg:col-span-2">
                <TransactionChart transactions={transactions} />
              </div>

              {/* Add Transaction Form - 1 column */}
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h3 className="mb-6 text-lg font-semibold text-foreground">
                  Новая транзакция
                </h3>
                <AddTransactionForm
                  userId={user.uid}
                  categories={categories}
                  onSuccess={handleTransactionAdded}
                />
              </div>
            </div>

            {/* Transactions Table */}
            <TransactionsTable transactions={transactions} categories={categories} />
          </div>
        </main>
      </div>
    </div>
  );
}
