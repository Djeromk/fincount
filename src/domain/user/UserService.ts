import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/config/firebase';

export class UserService {
  /**
   * Создаёт документ пользователя если его ещё нет
   */
  static async ensureExists(userId: string, data: { currency: string }): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        currency: data.currency,
        createdAt: serverTimestamp(),
      });
    }
  }

  /**
   * Получить данные пользователя
   */
  static async get(userId: string) {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    return {
      uid: userId,
      ...userSnap.data(),
      createdAt: userSnap.data().createdAt?.toDate(),
    };
  }
}
