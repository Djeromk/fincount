# Finsight — Code Conventions

## Общие принципы

### SOLID, DRY, KISS

- **Простота превыше всего** — код должен быть прямолинеен
- **Нет избыточных абстракций** — если функция используется в одном месте, не выносить её в shared/
- **Нет преждевременной оптимизации** — сначала работающий код, потом оптимизация
- **Нет эмодзи** — нельзя использовать эмодзи в коде и верстке, все иконки должны быть из библиотеки
- **Нет лишних комментариев** — комментарии должны быть необходимыми

---

## TypeScript Rules

### ЗАПРЕЩЕНО

```typescript
// ❌ Type assertion (as)
const user = data as User

// ❌ Non-null assertion (!)
const name = user!.name

// ❌ any
function process(data: any) { ... }

// ❌ never (если только не discriminated union), unknown
type Status = 'active' | 'inactive' | never | unknown

// ❌ Игнорирование ошибок TypeScript
// @ts-ignore
// @ts-expect-error
```

### РАЗРЕШЕНО

```typescript
// ✅ Type guards
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'email' in data
  )
}

// ✅ Zod для валидации
const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
})

const result = UserSchema.safeParse(data)
if (result.success) {
  const user = result.data // TypeScript знает тип
}

// ✅ Optional chaining
const name = user?.profile?.name

// ✅ Nullish coalescing
const displayName = user?.name ?? 'Anonymous'
```

---

## Zod Schemas

### Все формы и API границы валидируются через Zod

```typescript
// domain/transaction/Transaction.ts
import { z } from 'zod'
import { Timestamp } from 'firebase/firestore'

export const TransactionSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.literal('RUB'),
  type: z.enum(['income', 'expense', 'transfer']),
  description: z.string().min(1).max(500),
  date: z.instanceof(Timestamp),
  categoryId: z.string().nullable(),
  source: z.literal('manual'),
})

export type Transaction = z.infer<typeof TransactionSchema>
```

### Использование в формах

```typescript
// features/add-transaction/model/useTransactionForm.ts
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

// Схема для формы (без полей которые генерируются автоматически)
const TransactionFormSchema = TransactionSchema.omit({
  userId: true,
  source: true,
})

export function useTransactionForm(userId: string) {
  const form = useForm({
    resolver: zodResolver(TransactionFormSchema),
    defaultValues: {
      amount: 0,
      currency: 'RUB',
      type: 'expense',
      description: '',
      date: new Date(),
      categoryId: null,
    },
  })

  return form
}
```

---

## React Query Patterns

### QueryKey Factory

```typescript
// shared/lib/queryKeys.ts
export const queryKeys = {
  transactions: {
    all: (userId: string) => ['transactions', userId] as const,
    filtered: (userId: string, filters: TransactionFilters) =>
      ['transactions', userId, filters] as const,
    byId: (userId: string, transactionId: string) =>
      ['transactions', userId, transactionId] as const,
  },
  categories: {
    all: (userId: string) => ['categories', userId] as const,
    byType: (userId: string, type: 'income' | 'expense') =>
      ['categories', userId, type] as const,
  },
  rules: {
    all: (userId: string) => ['rules', userId] as const,
  },
}
```

### Базовый Query Hook

```typescript
// features/transactions/model/useTransactions.ts
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/queryKeys'
import { TransactionService } from '@/domain/transaction'

export function useTransactions(userId: string, filters?: TransactionFilters) {
  return useQuery({
    queryKey: filters
      ? queryKeys.transactions.filtered(userId, filters)
      : queryKeys.transactions.all(userId),
    queryFn: () => TransactionService.list(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60, // 1 минута
  })
}
```

### Mutation Hook с Optimistic Update

```typescript
// features/add-transaction/model/useAddTransaction.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/queryKeys'
import { TransactionService } from '@/domain/transaction'
import type { Transaction } from '@/domain/transaction'

export function useAddTransaction(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<Transaction, 'userId' | 'source'>) =>
      TransactionService.create({
        ...data,
        userId,
        source: 'manual',
      }),

    // Optimistic update
    onMutate: async (newTransaction) => {
      // Отменить текущие запросы
      await queryClient.cancelQueries({
        queryKey: queryKeys.transactions.all(userId),
      })

      // Сохранить предыдущее состояние
      const previousTransactions = queryClient.getQueryData(
        queryKeys.transactions.all(userId)
      )

      // Обновить кеш оптимистично
      queryClient.setQueryData<Transaction[]>(
        queryKeys.transactions.all(userId),
        (old = []) => [
          ...old,
          {
            ...newTransaction,
            userId,
            source: 'manual',
            // Временный ID до получения реального из Firestore
            id: `temp-${Date.now()}`,
          } as Transaction,
        ]
      )

      return { previousTransactions }
    },

    // Rollback при ошибке
    onError: (err, variables, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(
          queryKeys.transactions.all(userId),
          context.previousTransactions
        )
      }
    },

    // Invalidate в любом случае
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(userId),
      })
    },
  })
}
```

### Mutation Hook для Update

```typescript
// features/edit-transaction/model/useUpdateTransaction.ts
export function useUpdateTransaction(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Transaction> }) =>
      TransactionService.update(id, data),

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.transactions.all(userId),
      })

      const previous = queryClient.getQueryData<Transaction[]>(
        queryKeys.transactions.all(userId)
      )

      // Оптимистичный апдейт
      queryClient.setQueryData<Transaction[]>(
        queryKeys.transactions.all(userId),
        (old = []) =>
          old.map((tx) => (tx.id === id ? { ...tx, ...data } : tx))
      )

      return { previous }
    },

    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.transactions.all(userId),
          context.previous
        )
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(userId),
      })
    },
  })
}
```

---

## Error Handling

### Domain Layer (Services)

```typescript
// domain/transaction/TransactionService.ts
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  FirestoreError,
} from 'firebase/firestore'

export class TransactionService {
  static async create(data: Transaction): Promise<Transaction> {
    try {
      const docRef = await addDoc(collection(db, 'transactions'), data)
      return { ...data, id: docRef.id }
    } catch (error) {
      if (error instanceof FirestoreError) {
        throw new Error(`Failed to create transaction: ${error.message}`)
      }
      throw error
    }
  }

  static async list(
    userId: string,
    filters?: TransactionFilters
  ): Promise<Transaction[]> {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', userId)
      )

      const snapshot = await getDocs(q)
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Transaction[]
    } catch (error) {
      if (error instanceof FirestoreError) {
        throw new Error(`Failed to fetch transactions: ${error.message}`)
      }
      throw error
    }
  }
}
```

### UI Layer (Components)

```typescript
// features/add-transaction/ui/TransactionForm.tsx
export function TransactionForm({ userId }: { userId: string }) {
  const { mutate, isPending, error } = useAddTransaction(userId)

  const handleSubmit = (data: TransactionFormData) => {
    mutate(data, {
      onSuccess: () => {
        toast.success('Transaction added')
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Adding...' : 'Add Transaction'}
      </Button>
    </form>
  )
}
```

---

## File Naming

| Тип файла | Naming convention | Пример |
|---|---|---|
| React компоненты | PascalCase.tsx | `TransactionForm.tsx` |
| Hooks | camelCase.ts | `useTransactions.ts` |
| Services | PascalCase.ts | `TransactionService.ts` |
| Utils | camelCase.ts | `formatCurrency.ts` |
| Types | PascalCase.ts | `Transaction.ts` |
| Constants | SCREAMING_SNAKE_CASE.ts | `DEFAULT_CATEGORIES.ts` |

---

## Import Order

```typescript
// 1. External libraries
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

// 2. Absolute imports (@/...)
import { TransactionService } from '@/domain/transaction'
import { Button } from '@/shared/ui/button'
import { queryKeys } from '@/shared/lib/queryKeys'

// 3. Relative imports
import { TransactionFormSchema } from './schema'
import type { TransactionFormProps } from './types'
```

---

## Component Patterns

### Presentational vs Container

```typescript
// ❌ НЕ мешать логику и UI в одном компоненте
export function TransactionList({ userId }: { userId: string }) {
  const { data, isLoading } = useTransactions(userId)
  const { mutate } = useDeleteTransaction(userId)

  if (isLoading) return <Skeleton />

  return (
    <div>
      {data?.map((tx) => (
        <div key={tx.id}>
          <span>{tx.description}</span>
          <button onClick={() => mutate(tx.id)}>Delete</button>
        </div>
      ))}
    </div>
  )
}

// ✅ Разделить на container (логика) и presentation (UI)

// Container
export function TransactionListContainer({ userId }: { userId: string }) {
  const { data, isLoading } = useTransactions(userId)
  const { mutate: deleteTransaction } = useDeleteTransaction(userId)

  if (isLoading) return <Skeleton />

  return (
    <TransactionList
      transactions={data ?? []}
      onDelete={deleteTransaction}
    />
  )
}

// Presentation
interface TransactionListProps {
  transactions: Transaction[]
  onDelete: (id: string) => void
}

export function TransactionList({
  transactions,
  onDelete
}: TransactionListProps) {
  return (
    <div>
      {transactions.map((tx) => (
        <TransactionItem key={tx.id} transaction={tx} onDelete={onDelete} />
      ))}
    </div>
  )
}
```

### Compound Components для сложных UI

```typescript
// widgets/TransactionTable/TransactionTable.tsx
export function TransactionTable({ children }: PropsWithChildren) {
  return <div className="space-y-4">{children}</div>
}

TransactionTable.Header = function Header({ children }: PropsWithChildren) {
  return <div className="flex justify-between">{children}</div>
}

TransactionTable.Filters = function Filters({ children }: PropsWithChildren) {
  return <div className="flex gap-2">{children}</div>
}

TransactionTable.Body = function Body({ children }: PropsWithChildren) {
  return <div className="divide-y">{children}</div>
}

// Использование
<TransactionTable>
  <TransactionTable.Header>
    <h2>Transactions</h2>
    <AddTransactionButton />
  </TransactionTable.Header>

  <TransactionTable.Filters>
    <CategoryFilter />
    <DateRangeFilter />
  </TransactionTable.Filters>

  <TransactionTable.Body>
    {transactions.map(tx => <TransactionRow key={tx.id} transaction={tx} />)}
  </TransactionTable.Body>
</TransactionTable>
```

---

## Hooks Rules

### Custom Hooks должны возвращать объект (не массив)

```typescript
// ❌ Плохо — хрупкий порядок
const [transactions, isLoading, error] = useTransactions(userId)

// ✅ Хорошо — явные имена
const { data: transactions, isLoading, error } = useTransactions(userId)
```

### Композиция хуков

```typescript
// features/insights/model/useInsights.ts
import { useMemo } from 'react'
import { useTransactions } from '@/features/transactions/model/useTransactions'
import { InsightEngine } from '@/domain/insight'

export function useInsights(userId: string) {
  const { data: transactions = [] } = useTransactions(userId)

  const insights = useMemo(() => {
    return InsightEngine.calculateInsights(transactions)
  }, [transactions])

  return insights
}
```

---

## Computed State через useMemo

### Агрегация данных

```typescript
// widgets/Dashboard/hooks/useStats.ts
export function useStats(transactions: Transaction[]) {
  const totalIncome = useMemo(() => {
    return transactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0)
  }, [transactions])

  const totalExpense = useMemo(() => {
    return transactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0)
  }, [transactions])

  const balance = useMemo(() => {
    return totalIncome - totalExpense
  }, [totalIncome, totalExpense])

  return { totalIncome, totalExpense, balance }
}
```

### Группировка данных

```typescript
// widgets/Dashboard/hooks/useTransactionsByCategory.ts
export function useTransactionsByCategory(transactions: Transaction[]) {
  return useMemo(() => {
    return transactions.reduce((acc, tx) => {
      const categoryId = tx.categoryId ?? 'uncategorized'

      if (!acc[categoryId]) {
        acc[categoryId] = []
      }

      acc[categoryId].push(tx)
      return acc
    }, {} as Record<string, Transaction[]>)
  }, [transactions])
}
```

---

## URL State с nuqs

```typescript
// features/transactions/model/useTransactionFilters.ts
import { useQueryStates, parseAsString, parseAsIsoDateTime } from 'nuqs'

export function useTransactionFilters() {
  const [filters, setFilters] = useQueryStates({
    categoryId: parseAsString,
    startDate: parseAsIsoDateTime,
    endDate: parseAsIsoDateTime,
    search: parseAsString,
  })

  const clearFilters = () => {
    setFilters({
      categoryId: null,
      startDate: null,
      endDate: null,
      search: null,
    })
  }

  return { filters, setFilters, clearFilters }
}

// Использование в компоненте
export function TransactionFilters() {
  const { filters, setFilters, clearFilters } = useTransactionFilters()

  return (
    <div className="flex gap-2">
      <Input
        value={filters.search ?? ''}
        onChange={(e) => setFilters({ search: e.target.value })}
        placeholder="Search..."
      />

      <Button variant="outline" onClick={clearFilters}>
        Clear
      </Button>
    </div>
  )
}
```

---

## Barrel Exports (index.ts)

### Правило: Барреллы ТОЛЬКО для публичных API слайсов

```typescript
// ❌ НЕ делать barrel для всех файлов подряд
// shared/ui/index.ts
export * from './button'
export * from './input'
export * from './dialog'
// ...50+ компонентов

// ✅ Делать barrel для публичного API feature
// features/add-transaction/index.ts
export { AddTransaction } from './ui/TransactionForm'
export { useAddTransaction } from './model/useAddTransaction'

// Внутренние детали НЕ экспортируются
// ./ui/FormFields.tsx — приватный компонент
// ./model/schema.ts — приватная схема
```

---

## Чистые функции (domain/)

```typescript
// domain/insight/InsightEngine.ts

/**
 * Вычисляет аномалии в тратах по категориям
 * Аномалия = трата превышает среднее за 3 месяца более чем на 50%
 */
export function detectAnomalies(
  transactions: Transaction[],
  categories: Category[]
): Insight[] {
  // Группируем по категориям
  const byCategory = groupBy(transactions, 'categoryId')

  const insights: Insight[] = []

  for (const [categoryId, txs] of Object.entries(byCategory)) {
    // Вычисляем среднее за последние 3 месяца
    const avgLast3Months = calculateAverage(
      txs.filter(isLast3Months),
      'amount'
    )

    // Вычисляем траты за текущий месяц
    const currentMonth = txs.filter(isCurrentMonth)
    const currentTotal = sum(currentMonth, 'amount')

    // Проверяем аномалию
    if (currentTotal > avgLast3Months * 1.5) {
      const category = categories.find((c) => c.id === categoryId)

      insights.push({
        type: 'anomaly',
        categoryId,
        categoryName: category?.name ?? 'Uncategorized',
        message: `Spending on ${category?.name} is 50% higher than usual`,
        severity: 'warning',
      })
    }
  }

  return insights
}

/**
 * Прогнозирует баланс на конец месяца
 * Линейная экстраполяция текущих трат
 */
export function forecastBalance(
  transactions: Transaction[],
  currentBalance: number
): Insight {
  const currentMonth = transactions.filter(isCurrentMonth)
  const daysElapsed = new Date().getDate()
  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate()

  const totalSpent = sum(
    currentMonth.filter((tx) => tx.type === 'expense'),
    'amount'
  )

  const dailyAverage = totalSpent / daysElapsed
  const projectedSpending = dailyAverage * daysInMonth
  const projectedBalance = currentBalance - projectedSpending

  return {
    type: 'forecast',
    message: `Projected balance by month end: ${formatCurrency(projectedBalance)}`,
    severity: projectedBalance < 0 ? 'error' : 'info',
  }
}

// Helper functions (чистые, без побочных эффектов)
function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const value = String(item[key])
    if (!acc[value]) acc[value] = []
    acc[value].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

function sum<T>(arr: T[], key: keyof T): number {
  return arr.reduce((sum, item) => sum + Number(item[key]), 0)
}

function calculateAverage<T>(arr: T[], key: keyof T): number {
  if (arr.length === 0) return 0
  return sum(arr, key) / arr.length
}

function isLast3Months(tx: Transaction): boolean {
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  return tx.date.toDate() >= threeMonthsAgo
}

function isCurrentMonth(tx: Transaction): boolean {
  const now = new Date()
  const txDate = tx.date.toDate()
  return (
    txDate.getMonth() === now.getMonth() &&
    txDate.getFullYear() === now.getFullYear()
  )
}
```

---

## Testing (для domain/)

```typescript
// domain/insight/__tests__/InsightEngine.test.ts
import { describe, it, expect } from 'vitest'
import { detectAnomalies } from '../InsightEngine'
import { createMockTransaction } from '@/shared/test/factories'

describe('InsightEngine', () => {
  describe('detectAnomalies', () => {
    it('should detect spending anomaly when current month exceeds average by 50%', () => {
      const transactions = [
        // Последние 3 месяца — по 100 рублей в месяц на кофе
        createMockTransaction({ categoryId: 'coffee', amount: 100, date: monthsAgo(3) }),
        createMockTransaction({ categoryId: 'coffee', amount: 100, date: monthsAgo(2) }),
        createMockTransaction({ categoryId: 'coffee', amount: 100, date: monthsAgo(1) }),
        // Текущий месяц — 200 рублей (на 100% больше среднего)
        createMockTransaction({ categoryId: 'coffee', amount: 200, date: new Date() }),
      ]

      const categories = [{ id: 'coffee', name: 'Coffee' }]

      const insights = detectAnomalies(transactions, categories)

      expect(insights).toHaveLength(1)
      expect(insights[0]).toMatchObject({
        type: 'anomaly',
        categoryId: 'coffee',
        severity: 'warning',
      })
    })

    it('should not detect anomaly when spending is normal', () => {
      const transactions = [
        createMockTransaction({ categoryId: 'coffee', amount: 100, date: monthsAgo(3) }),
        createMockTransaction({ categoryId: 'coffee', amount: 100, date: monthsAgo(2) }),
        createMockTransaction({ categoryId: 'coffee', amount: 100, date: monthsAgo(1) }),
        createMockTransaction({ categoryId: 'coffee', amount: 100, date: new Date() }),
      ]

      const categories = [{ id: 'coffee', name: 'Coffee' }]

      const insights = detectAnomalies(transactions, categories)

      expect(insights).toHaveLength(0)
    })
  })
})
```

---

## Comments

### Когда комментировать

```typescript
// ✅ Сложная бизнес-логика
/**
 * Применяет правила категоризации по приоритету
 * Берёт первое совпадение, дальше не проверяет
 */
export function categorize(description: string, rules: Rule[]): string | null {
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority)

  for (const rule of sortedRules) {
    if (matchRule(description, rule)) {
      return rule.categoryId
    }
  }

  return null
}

// ✅ Неочевидное поведение
// Firebase Timestamp.now() возвращает серверное время
// Используем new Date() чтобы избежать clock skew
const createdAt = Timestamp.fromDate(new Date())

// ❌ НЕ комментировать очевидное
// Создаём новую транзакцию
const transaction = { ... }
```

### JSDoc для публичных API

```typescript
/**
 * Создаёт транзакцию в Firestore
 *
 * @param data - Данные транзакции (userId и source добавятся автоматически)
 * @returns Promise с созданной транзакцией
 * @throws {FirestoreError} Если не удалось записать в Firestore
 *
 * @example
 * const transaction = await TransactionService.create({
 *   amount: 500,
 *   currency: 'RUB',
 *   type: 'expense',
 *   description: 'Coffee',
 *   date: new Date(),
 *   categoryId: 'coffee-category-id',
 * })
 */
export async function create(
  data: Omit<Transaction, 'id' | 'userId' | 'source'>
): Promise<Transaction> {
  // ...
}
```

---

## Performance

### Lazy Loading для Charts

```typescript
// widgets/Dashboard/Dashboard.tsx
import dynamic from 'next/dynamic'

// ✅ Recharts загружается только когда нужен
const BarChart = dynamic(() => import('./BarChart'), {
  ssr: false,
  loading: () => <Skeleton className="h-64" />,
})

export function Dashboard() {
  return (
    <div>
      <StatCards />
      <BarChart /> {/* Загрузится асинхронно */}
    </div>
  )
}
```

### React.memo для дорогих компонентов

```typescript
// widgets/TransactionTable/TransactionRow.tsx
import { memo } from 'react'

interface TransactionRowProps {
  transaction: Transaction
  onDelete: (id: string) => void
}

export const TransactionRow = memo(function TransactionRow({
  transaction,
  onDelete
}: TransactionRowProps) {
  return (
    <div className="flex justify-between">
      <span>{transaction.description}</span>
      <span>{formatCurrency(transaction.amount)}</span>
      <button onClick={() => onDelete(transaction.id)}>Delete</button>
    </div>
  )
})
```

### useMemo для тяжёлых вычислений

```typescript
// ✅ Кешируем группировку
const transactionsByCategory = useMemo(() => {
  return groupBy(transactions, 'categoryId')
}, [transactions])

// ❌ НЕ оборачивать тривиальные операции
const userName = useMemo(() => user?.name ?? 'Anonymous', [user]) // Избыточно
```

---

## Итоговый чеклист перед коммитом

- [ ] Нет `as`, `!`, `any`, `never`
- [ ] Все формы валидируются через Zod
- [ ] Server state через React Query, не через useState/Zustand
- [ ] Optimistic updates для create/update/delete
- [ ] Charts через `dynamic(() => import(...), { ssr: false })`
- [ ] Чистые функции в domain/ не зависят от React/Firebase
- [ ] Публичный API feature экспортируется через index.ts
- [ ] Нет barrel exports для internal файлов
- [ ] Компоненты разделены на presentation и container
- [ ] Сложная логика покрыта тестами (domain/)
