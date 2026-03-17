import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { Transaction, TransactionInput } from "@/shared/types/transaction";

export class TransactionService {
  /**
   * Создать транзакцию
   */
  static async create(userId: string, data: TransactionInput): Promise<string> {
    const transactionsRef = collection(db, "transactions");

    const docRef = await addDoc(transactionsRef, {
      ...data,
      userId,
      date: Timestamp.fromDate(data.date),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Получить все транзакции пользователя
   */
  static async list(userId: string): Promise<Transaction[]> {
    const transactionsRef = collection(db, "transactions");
    const q = query(
      transactionsRef,
      where("userId", "==", userId),
      orderBy("date", "desc"),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        amount: data.amount,
        currency: data.currency,
        type: data.type,
        description: data.description,
        date: data.date?.toDate(),
        categoryId: data.categoryId,
        source: data.source,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      };
    });
  }

  /**
   * Обновить транзакцию
   */
  static async update(
    transactionId: string,
    data: Partial<TransactionInput>,
  ): Promise<void> {
    const transactionRef = doc(db, "transactions", transactionId);

    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    if (data.date) {
      updateData.date = Timestamp.fromDate(data.date);
    }

    await updateDoc(transactionRef, updateData);
  }

  /**
   * Удалить транзакцию
   */
  static async delete(transactionId: string): Promise<void> {
    const transactionRef = doc(db, "transactions", transactionId);
    await deleteDoc(transactionRef);
  }
}
