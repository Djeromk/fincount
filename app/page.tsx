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

  // Calculate stats
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;

  // Loading state
  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-base font-medium">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header with glassmorphism */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Finsight
              </h1>
            </div>

            {/* User info & actions */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-slate-300 truncate max-w-[200px]">{user.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] px-4 py-2
                         text-sm font-medium text-white bg-white/10 rounded-lg border border-white/10
                         hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-violet-500
                         transition-all duration-200 active:scale-95"
                aria-label="Выйти из аккаунта"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Balance Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-6">
            <div className="relative z-10">
              <p className="text-violet-200 text-sm font-medium mb-2">Баланс</p>
              <p className="text-4xl font-bold text-white tabular-nums mb-1">
                {balance.toLocaleString('ru-RU')} ₽
              </p>
            </div>
            {/* Decorative gradient orb */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          </div>

          {/* Income Card */}
          <div className="relative overflow-hidden rounded-2xl bg-slate-800/50 backdrop-blur-sm border border-white/10 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-2">Доходы</p>
                <p className="text-3xl font-bold text-green-400 tabular-nums">
                  +{totalIncome.toLocaleString('ru-RU')} ₽
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
            </div>
          </div>

          {/* Expenses Card */}
          <div className="relative overflow-hidden rounded-2xl bg-slate-800/50 backdrop-blur-sm border border-white/10 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-2">Расходы</p>
                <p className="text-3xl font-bold text-red-400 tabular-nums">
                  −{totalExpense.toLocaleString('ru-RU')} ₽
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transactions List - Takes 2 columns */}
          <section className="lg:col-span-2 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Транзакции</h2>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-slate-300 border border-white/10">
                {transactions.length} записей
              </span>
            </div>

            {/* Transactions */}
            <div className="rounded-2xl bg-slate-800/50 backdrop-blur-sm border border-white/10 overflow-hidden">
              {transactions.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Нет транзакций</h3>
                  <p className="text-sm text-slate-400">
                    Добавьте первую транзакцию, чтобы начать отслеживать финансы
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {transactions.map((transaction) => {
                    const category = categories.find((c) => c.id === transaction.categoryId);

                    return (
                      <div
                        key={transaction.id}
                        className="group flex items-center justify-between p-4 hover:bg-white/5 transition-colors duration-150"
                      >
                        {/* Left: Icon + Details */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {/* Category Icon */}
                          <div
                            className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{
                              backgroundColor: category?.color
                                ? `${category.color}20`
                                : 'rgba(148, 163, 184, 0.1)',
                            }}
                          >
                            <div
                              className="w-6 h-6 rounded-lg"
                              style={{
                                backgroundColor: category?.color || '#94a3b8',
                              }}
                            />
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-medium text-white truncate">
                              {transaction.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-slate-400 truncate">
                                {category?.name || 'Без категории'}
                              </span>
                              <span className="text-slate-600">•</span>
                              <time className="text-sm text-slate-500" dateTime={transaction.date.toISOString()}>
                                {transaction.date.toLocaleDateString('ru-RU', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </time>
                            </div>
                          </div>
                        </div>

                        {/* Right: Amount */}
                        <div className="flex-shrink-0 ml-4 text-right">
                          <p
                            className={`text-lg font-bold tabular-nums ${
                              transaction.type === 'income' ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {transaction.type === 'income' ? '+' : '−'}
                            {transaction.amount.toLocaleString('ru-RU')} ₽
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Add Transaction Form - Takes 1 column */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <h2 className="text-xl font-bold text-white">Новая транзакция</h2>
              <div className="rounded-2xl bg-slate-800/50 backdrop-blur-sm border border-white/10 p-6">
                <AddTransactionForm
                  userId={user.uid}
                  categories={categories}
                  onSuccess={handleTransactionAdded}
                />
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
