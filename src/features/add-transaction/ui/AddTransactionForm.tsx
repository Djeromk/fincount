'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { transactionSchema, TransactionFormData } from '../model/schema';
import { TransactionService } from '@/domain/transaction/TransactionService';
import { useState } from 'react';

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Type Toggle */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Тип</label>
        <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-900/50 border border-white/10">
          <label
            className={`
              flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer
              transition-all duration-200
              ${
                selectedType === 'expense'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-slate-400 hover:text-slate-300'
              }
            `}
          >
            <input
              type="radio"
              value="expense"
              {...register('type')}
              className="sr-only"
            />
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
            Расход
          </label>
          <label
            className={`
              flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer
              transition-all duration-200
              ${
                selectedType === 'income'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'text-slate-400 hover:text-slate-300'
              }
            `}
          >
            <input
              type="radio"
              value="income"
              {...register('type')}
              className="sr-only"
            />
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
            Доход
          </label>
        </div>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <label htmlFor="amount" className="block text-sm font-medium text-slate-300">
          Сумма
        </label>
        <div className="relative">
          <input
            id="amount"
            type="number"
            step="0.01"
            {...register('amount', { valueAsNumber: true })}
            className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-white/10 text-white
                     placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50
                     focus:border-violet-500/50 transition-all duration-200"
            placeholder="0.00"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
            ₽
          </span>
        </div>
        {errors.amount && (
          <p className="text-red-400 text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {errors.amount.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium text-slate-300">
          Описание
        </label>
        <input
          id="description"
          type="text"
          {...register('description')}
          className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-white/10 text-white
                   placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50
                   focus:border-violet-500/50 transition-all duration-200"
          placeholder="Например: Покупка продуктов"
        />
        {errors.description && (
          <p className="text-red-400 text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label htmlFor="categoryId" className="block text-sm font-medium text-slate-300">
          Категория
        </label>
        <div className="relative">
          <select
            id="categoryId"
            {...register('categoryId')}
            className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-white/10 text-white
                     appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/50
                     focus:border-violet-500/50 transition-all duration-200"
          >
            <option value="" className="bg-slate-900">Без категории</option>
            {filteredCategories.map((category) => (
              <option key={category.id} value={category.id} className="bg-slate-900">
                {category.name}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Date */}
      <div className="space-y-2">
        <label htmlFor="date" className="block text-sm font-medium text-slate-300">
          Дата
        </label>
        <input
          id="date"
          type="date"
          {...register('date', { valueAsDate: true })}
          className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-white/10 text-white
                   focus:outline-none focus:ring-2 focus:ring-violet-500/50
                   focus:border-violet-500/50 transition-all duration-200
                   [color-scheme:dark]"
        />
        {errors.date && (
          <p className="text-red-400 text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {errors.date.message}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full min-h-[44px] px-6 py-3 rounded-lg font-medium
                 bg-gradient-to-r from-violet-600 to-fuchsia-600
                 text-white shadow-lg shadow-violet-500/25
                 hover:shadow-xl hover:shadow-violet-500/40
                 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900
                 disabled:opacity-50 disabled:cursor-not-allowed
                 transition-all duration-200 active:scale-[0.98]
                 disabled:hover:shadow-lg"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Создание...
          </span>
        ) : (
          'Добавить транзакцию'
        )}
      </button>
    </form>
  );
}
