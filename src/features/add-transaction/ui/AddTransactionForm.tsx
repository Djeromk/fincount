'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { transactionSchema, TransactionFormData } from '../model/schema';
import { TransactionService } from '@/domain/transaction/TransactionService';
import { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react';

interface AddTransactionFormProps {
  userId: string;
  categories: Array<{ id: string; name: string; type: 'income' | 'expense'; color: string }>;
  onSuccess?: () => void;
}

export function AddTransactionForm({
  userId,
  categories,
  onSuccess,
}: AddTransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: 0,
      type: 'expense',
      description: '',
      date: new Date(),
      categoryId: null,
    },
  });

  const selectedType = watch('type');

  const filteredCategories = categories.filter(
    (cat) => cat.type === selectedType
  );

  const onSubmit = async (data: TransactionFormData) => {
    setIsSubmitting(true);

    try {
      await TransactionService.create(userId, {
        ...data,
        currency: 'RUB',
        source: 'manual',
      });

      reset();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create transaction:', error);
      alert('Ошибка при создании транзакции');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Type Toggle */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Тип</label>
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`
              flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-3
              text-sm font-medium transition-all
              ${
                selectedType === 'expense'
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }
            `}
          >
            <input
              type="radio"
              value="expense"
              {...register('type')}
              className="sr-only"
            />
            <ArrowDownLeft className="h-4 w-4" />
            <span>Расход</span>
          </label>
          <label
            className={`
              flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-3
              text-sm font-medium transition-all
              ${
                selectedType === 'income'
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }
            `}
          >
            <input
              type="radio"
              value="income"
              {...register('type')}
              className="sr-only"
            />
            <ArrowUpRight className="h-4 w-4" />
            <span>Доход</span>
          </label>
        </div>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <label htmlFor="amount" className="text-sm font-medium text-foreground">
          Сумма
        </label>
        <div className="relative">
          <input
            id="amount"
            type="number"
            step="0.01"
            {...register('amount', { valueAsNumber: true })}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm
                     text-foreground ring-offset-background file:border-0 file:bg-transparent
                     file:text-sm file:font-medium placeholder:text-muted-foreground
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                     focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="0.00"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            ₽
          </span>
        </div>
        {errors.amount && (
          <p className="text-sm text-destructive">{errors.amount.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium text-foreground">
          Описание
        </label>
        <input
          id="description"
          type="text"
          {...register('description')}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm
                   text-foreground ring-offset-background file:border-0 file:bg-transparent
                   file:text-sm file:font-medium placeholder:text-muted-foreground
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                   focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Например: Покупка продуктов"
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label htmlFor="categoryId" className="text-sm font-medium text-foreground">
          Категория
        </label>
        <select
          id="categoryId"
          {...register('categoryId')}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm
                   text-foreground ring-offset-background focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                   disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Без категории</option>
          {filteredCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div className="space-y-2">
        <label htmlFor="date" className="text-sm font-medium text-foreground">
          Дата
        </label>
        <input
          id="date"
          type="date"
          {...register('date', { valueAsDate: true })}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm
                   text-foreground ring-offset-background focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                   disabled:cursor-not-allowed disabled:opacity-50"
        />
        {errors.date && (
          <p className="text-sm text-destructive">{errors.date.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg
                 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground
                 ring-offset-background transition-colors hover:bg-primary/90
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Создание...
          </>
        ) : (
          'Добавить транзакцию'
        )}
      </button>
    </form>
  );
}
