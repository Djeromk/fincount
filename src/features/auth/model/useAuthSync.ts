'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/shared/config/firebase';
import { UserService } from '@/domain/user/UserService';
import { CategoryService } from '@/domain/category/CategoryService';

/**
 * Следит за состоянием аутентификации и создаёт
 * профиль пользователя при первом входе
 */
export function useAuthSync() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Создаём документ пользователя если его нет
        await UserService.ensureExists(user.uid, {
          currency: 'RUB', // можно определять по локали или спрашивать
        });

        // Создаём дефолтные категории
        await CategoryService.createDefaults(user.uid);
      }
    });

    return () => unsubscribe();
  }, []);
}
