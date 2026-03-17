import { z } from "zod";

export const transactionSchema = z.object({
  amount: z.number().positive("Сумма должна быть больше нуля"),
  type: z.enum(["income", "expense", "transfer"]),
  description: z.string().min(1, "Описание обязательно"),
  date: z.date(),
  categoryId: z.string().nullable(),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;
