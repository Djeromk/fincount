import { Category } from "@/shared/types/category";

export const DEFAULT_CATEGORIES: Omit<Category, "id" | "userId">[] = [
  // Income
  { name: "Зарплата", color: "#10b981", type: "income", isDefault: true },
  { name: "Фриланс", color: "#3b82f6", type: "income", isDefault: true },
  { name: "Инвестиции", color: "#8b5cf6", type: "income", isDefault: true },
  { name: "Другое", color: "#9ca3af", type: "income", isDefault: true },

  // Expense
  { name: "Еда", color: "#ef4444", type: "expense", isDefault: true },
  { name: "Транспорт", color: "#f59e0b", type: "expense", isDefault: true },
  { name: "Покупки", color: "#ec4899", type: "expense", isDefault: true },
  { name: "Развлечения", color: "#6366f1", type: "expense", isDefault: true },
  { name: "Здоровье", color: "#14b8a6", type: "expense", isDefault: true },
  { name: "Счета и ЖКХ", color: "#64748b", type: "expense", isDefault: true },
  { name: "Другое", color: "#9ca3af", type: "expense", isDefault: true },
];
