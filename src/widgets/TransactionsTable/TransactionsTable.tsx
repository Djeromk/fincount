'use client';

import type { Transaction } from '@/shared/types/transaction';
import type { Category } from '@/shared/types/category';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface TransactionsTableProps {
  transactions: Transaction[];
  categories: Category[];
}

export function TransactionsTable({ transactions, categories }: TransactionsTableProps) {
  // Берем последние 10 транзакций
  const recentTransactions = transactions.slice(0, 10);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border p-6">
        <h3 className="text-lg font-semibold text-foreground">Последние транзакции</h3>
        <p className="text-sm text-muted-foreground">История ваших операций</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Описание
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Категория
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Дата
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Сумма
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recentTransactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <p className="text-sm text-muted-foreground">Нет транзакций для отображения</p>
                </td>
              </tr>
            ) : (
              recentTransactions.map((transaction) => {
                const category = categories.find((c) => c.id === transaction.categoryId);
                const isIncome = transaction.type === 'income';

                return (
                  <tr
                    key={transaction.id}
                    className="transition-colors hover:bg-muted/50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                            isIncome
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          }`}
                        >
                          {isIncome ? (
                            <ArrowUpRight className="h-5 w-5" />
                          ) : (
                            <ArrowDownLeft className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {transaction.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isIncome ? 'Доход' : 'Расход'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {category ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="text-sm text-foreground">{category.name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Без категории</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <time className="text-sm text-muted-foreground" dateTime={transaction.date.toISOString()}>
                        {transaction.date.toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </time>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          isIncome
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {isIncome ? '+' : '−'}
                        {transaction.amount.toLocaleString('ru-RU')} ₽
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {recentTransactions.length > 0 && (
        <div className="border-t border-border p-4">
          <button
            disabled
            className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Показать все транзакции →
          </button>
        </div>
      )}
    </div>
  );
}
