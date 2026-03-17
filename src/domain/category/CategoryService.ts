import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/shared/config/firebase';
import { DEFAULT_CATEGORIES } from './defaults';

export class CategoryService {
  /**
   * Создаёт дефолтные категории для нового пользователя
   */
  static async createDefaults(userId: string): Promise<void> {
    // Проверяем, есть ли уже категории
    const categoriesRef = collection(db, 'categories');
    const q = query(categoriesRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // Категории уже созданы
      return;
    }

    // Создаём дефолтные категории
    const promises = DEFAULT_CATEGORIES.map((category) =>
      addDoc(categoriesRef, {
        ...category,
        userId,
        createdAt: serverTimestamp(),
      })
    );

    await Promise.all(promises);
  }
}
