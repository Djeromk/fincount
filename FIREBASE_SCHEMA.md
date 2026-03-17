# Finsight — Firebase Schema

## Firestore Collections

### `users/{userId}`

Метаданные пользователя (кроме auth данных, которые в Firebase Auth).

```typescript
interface User {
  currency: 'RUB'
  createdAt: Timestamp
}
```

**Создание:**
- Автоматически при первом входе через `useAuthSync` hook
- `userId` = Firebase Auth `uid`

**Индексы:** нет (коллекция маленькая, поиск по doc id)

---

### `transactions/{transactionId}`

Основная коллекция — все доходы и расходы пользователя.

```typescript
interface Transaction {
  id: string                    // Firestore document ID
  userId: string                // Firebase Auth uid
  amount: number                // Положительное число
  currency: 'RUB'               // Пока только рубли
  type: 'income' | 'expense' | 'transfer'
  description: string           // 1-500 символов
  date: Timestamp               // Дата транзакции (НЕ createdAt!)
  categoryId: string | null     // null = uncategorized
  source: 'manual'              // В будущем: 'bank', 'import'
}
```

**Composite Indexes:**

```
transactions
  userId (Ascending) + date (Descending)
  userId (Ascending) + categoryId (Ascending) + date (Descending)
  userId (Ascending) + type (Ascending) + date (Descending)
```

**Почему нужны индексы:**
- Сортировка по дате (самые новые сверху)
- Фильтрация по категории + дата
- Фильтрация по типу (income/expense) + дата

**Security Rules:**
```javascript
match /transactions/{transactionId} {
  allow read: if request.auth != null 
    && request.auth.uid == resource.data.userId;
  
  allow create: if request.auth != null
    && request.auth.uid == request.resource.data.userId
    && request.resource.data.amount > 0
    && request.resource.data.currency == 'RUB'
    && request.resource.data.source == 'manual';
  
  allow update: if request.auth != null
    && request.auth.uid == resource.data.userId
    && request.resource.data.userId == resource.data.userId // userId неизменяем
    && request.resource.data.amount > 0;
  
  allow delete: if request.auth != null
    && request.auth.uid == resource.data.userId;
}
```

---

### `categories/{categoryId}`

Категории (дефолтные + кастомные).

```typescript
interface Category {
  id: string                    // Firestore document ID
  userId: string                // Firebase Auth uid
  name: string                  // 'Food', 'Transport', etc.
  icon: string                  // Emoji или название иконки из библиотеки
  color: string                 // HEX цвет для UI
  type: 'income' | 'expense'    // Категория для доходов или расходов
  isDefault: boolean            // true = создана автоматически, false = кастомная
}
```

**Default Categories (создаются при регистрации):**

```typescript
// domain/category/defaults.ts
export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'userId'>[] = [
  // Expenses
  { name: 'Food', icon: '🍔', color: '#FF6B6B', type: 'expense', isDefault: true },
  { name: 'Transport', icon: '🚗', color: '#4ECDC4', type: 'expense', isDefault: true },
  { name: 'Entertainment', icon: '🎬', color: '#95E1D3', type: 'expense', isDefault: true },
  { name: 'Shopping', icon: '🛍️', color: '#F38181', type: 'expense', isDefault: true },
  { name: 'Health', icon: '💊', color: '#AA96DA', type: 'expense', isDefault: true },
  { name: 'Utilities', icon: '💡', color: '#FCBAD3', type: 'expense', isDefault: true },
  { name: 'Other', icon: '📦', color: '#A8D8EA', type: 'expense', isDefault: true },
  
  // Income
  { name: 'Salary', icon: '💰', color: '#52B788', type: 'income', isDefault: true },
  { name: 'Freelance', icon: '💻', color: '#74C69D', type: 'income', isDefault: true },
  { name: 'Investments', icon: '📈', color: '#95D5B2', type: 'income', isDefault: true },
  { name: 'Other Income', icon: '💵', color: '#B7E4C7', type: 'income', isDefault: true },
]
```

**Индексы:**

```
categories
  userId (Ascending) + type (Ascending)
```

**Security Rules:**

```javascript
match /categories/{categoryId} {
  allow read: if request.auth != null 
    && request.auth.uid == resource.data.userId;
  
  allow create: if request.auth != null
    && request.auth.uid == request.resource.data.userId;
  
  allow update: if request.auth != null
    && request.auth.uid == resource.data.userId
    && request.resource.data.userId == resource.data.userId
    && request.resource.data.isDefault == resource.data.isDefault; // isDefault неизменяем
  
  allow delete: if request.auth != null
    && request.auth.uid == resource.data.userId
    && resource.data.isDefault == false; // нельзя удалить дефолтную
}
```

**Важное поведение:**
- Удаление категории НЕ удаляет транзакции
- Транзакции с удалённой категорией → `categoryId = null` (uncategorized)
- Это делается на клиенте через batch update после удаления категории

---

### `rules/{ruleId}`

Правила автоматической категоризации транзакций.

```typescript
interface Rule {
  id: string                    // Firestore document ID
  userId: string                // Firebase Auth uid
  categoryId: string            // Категория для применения
  matcher: RuleMatcher          // Условие совпадения
  priority: number              // Чем выше, тем раньше применяется (0-100)
}

interface RuleMatcher {
  field: 'description'          // Пока только по описанию
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith'
  value: string                 // Значение для поиска (case-insensitive)
}
```

**Примеры:**

```typescript
// Правило: если описание содержит "coffee" → категория "Food"
{
  userId: "user123",
  categoryId: "food-id",
  matcher: {
    field: "description",
    operator: "contains",
    value: "coffee"
  },
  priority: 10
}

// Правило: если описание = "Salary" → категория "Salary"
{
  userId: "user123",
  categoryId: "salary-id",
  matcher: {
    field: "description",
    operator: "equals",
    value: "Salary"
  },
  priority: 100
}
```

**Применение:**
1. При создании транзакции — проходим через все правила отсортированные по `priority DESC`
2. Берём первое совпадение
3. Если совпадений нет → `categoryId = null`

**Индексы:**

```
rules
  userId (Ascending) + priority (Descending)
```

**Security Rules:**

```javascript
match /rules/{ruleId} {
  allow read: if request.auth != null 
    && request.auth.uid == resource.data.userId;
  
  allow create: if request.auth != null
    && request.auth.uid == request.resource.data.userId
    && request.resource.data.priority >= 0
    && request.resource.data.priority <= 100
    && exists(/databases/$(database)/documents/categories/$(request.resource.data.categoryId))
    && get(/databases/$(database)/documents/categories/$(request.resource.data.categoryId)).data.userId == request.auth.uid;
  
  allow update: if request.auth != null
    && request.auth.uid == resource.data.userId
    && request.resource.data.userId == resource.data.userId
    && request.resource.data.priority >= 0
    && request.resource.data.priority <= 100;
  
  allow delete: if request.auth != null
    && request.auth.uid == resource.data.userId;
}
```

**Критически важно:**
- Rule не может ссылаться на чужую категорию
- Проверка через `exists()` и `get()` в Security Rules
- Priority ограничен 0-100

---

## Insights (НЕ хранятся в Firestore)

Инсайты вычисляются на клиенте через `useMemo` из транзакций.

```typescript
interface Insight {
  type: 'anomaly' | 'pattern' | 'forecast'
  message: string               // "Spending on Coffee is 50% higher than usual"
  severity: 'info' | 'warning' | 'error'
  categoryId?: string           // Для anomaly и pattern
  categoryName?: string         // Для отображения
}
```

**Типы инсайтов:**

### 1. Anomaly (Аномалия)

Трата в категории превышает среднее за 3 месяца более чем на 50%.

```typescript
{
  type: 'anomaly',
  categoryId: 'coffee-id',
  categoryName: 'Coffee',
  message: 'Spending on Coffee is 50% higher than usual',
  severity: 'warning'
}
```

### 2. Pattern (Регулярная трата)

Транзакция с одинаковым описанием каждые ~30 дней (подписки).

```typescript
{
  type: 'pattern',
  categoryId: 'entertainment-id',
  categoryName: 'Entertainment',
  message: 'Recurring payment detected: "Netflix" every 30 days',
  severity: 'info'
}
```

### 3. Forecast (Прогноз)

Линейная экстраполяция трат текущего месяца на оставшиеся дни.

```typescript
{
  type: 'forecast',
  message: 'Projected balance by month end: -5,000 ₽',
  severity: 'error'
}
```

**Вычисление:**
```typescript
// domain/insight/InsightEngine.ts
export function calculateInsights(
  transactions: Transaction[],
  categories: Category[]
): Insight[] {
  return [
    ...detectAnomalies(transactions, categories),
    ...detectPatterns(transactions),
    forecastBalance(transactions, currentBalance),
  ]
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ USER ACTION                                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ React Component (features/)                                  │
│   - TransactionForm                                          │
│   - useTransactionForm hook                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ React Query Mutation                                         │
│   - Optimistic Update                                        │
│   - onMutate → update cache                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Domain Service (domain/)                                     │
│   - TransactionService.create()                              │
│   - Zod validation                                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Firestore SDK                                                │
│   - addDoc(collection('transactions'), data)                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Firestore Security Rules                                     │
│   - Проверка auth.uid == data.userId                         │
│   - Валидация amount > 0                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Firestore Database                                           │
│   - Запись документа                                         │
│   - Триггер real-time listener                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ React Query                                                  │
│   - onSettled → invalidateQueries                            │
│   - Refetch с сервера                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ UI Update                                                    │
│   - TransactionTable re-renders                              │
│   - Insights recalculate (useMemo)                           │
│   - Dashboard stats update                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Categorization Flow

```
┌─────────────────────────────────────────────────────────────┐
│ USER: Создаёт транзакцию "Coffee at Starbucks"              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ CategorizationEngine.categorize()                            │
│   - Получить все Rules пользователя                          │
│   - Отсортировать по priority DESC                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Loop через Rules:                                            │
│   Rule 1: description contains "Starbucks" → Food (priority 50)│
│   Rule 2: description contains "Coffee" → Food (priority 10) │
│   ✓ Берём первое совпадение (Rule 1)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ TransactionService.create()                                  │
│   - categoryId = "food-id"                                   │
│   - source = "manual"                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Firestore                                                    │
└─────────────────────────────────────────────────────────────┘
```

**Ручное изменение категории:**
- User меняет категорию вручную → `TransactionService.update({ categoryId: 'new-id' })`
- Повторная автокатегоризация НЕ перезаписывает ручное изменение
- Флаг `isManuallyEdited` НЕ используется (слишком сложно)
- Правило: если user изменил категорию, транзакция больше не проходит через автокатегоризацию

---

## Batch Operations

### Удаление категории + uncategorize транзакций

```typescript
// domain/category/CategoryService.ts
export async function deleteCategory(
  categoryId: string,
  userId: string
): Promise<void> {
  const batch = writeBatch(db)

  // 1. Найти все транзакции с этой категорией
  const txQuery = query(
    collection(db, 'transactions'),
    where('userId', '==', userId),
    where('categoryId', '==', categoryId)
  )
  const txSnapshot = await getDocs(txQuery)

  // 2. Установить categoryId = null
  txSnapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { categoryId: null })
  })

  // 3. Удалить категорию
  batch.delete(doc(db, 'categories', categoryId))

  // 4. Коммит
  await batch.commit()
}
```

### Создание дефолтных категорий

```typescript
// domain/category/CategoryService.ts
import { DEFAULT_CATEGORIES } from './defaults'

export async function createDefaults(userId: string): Promise<void> {
  // Проверить что категории ещё не созданы
  const existingQuery = query(
    collection(db, 'categories'),
    where('userId', '==', userId)
  )
  const existingSnapshot = await getDocs(existingQuery)

  if (!existingSnapshot.empty) {
    return // Категории уже есть
  }

  // Batch create
  const batch = writeBatch(db)

  DEFAULT_CATEGORIES.forEach((category) => {
    const docRef = doc(collection(db, 'categories'))
    batch.set(docRef, {
      ...category,
      userId,
    })
  })

  await batch.commit()
}
```

---

## Migration Strategy

Если схема изменится в будущем:

### Добавление нового поля (backwards compatible)

```typescript
// Было
interface Transaction {
  amount: number
  description: string
}

// Стало (добавили tags)
interface Transaction {
  amount: number
  description: string
  tags?: string[] // Optional — старые документы не сломаются
}
```

**Миграция:** не нужна, поле optional.

### Изменение типа поля (breaking change)

```typescript
// Было
interface Transaction {
  date: Timestamp
}

// Стало (хотим строку ISO)
interface Transaction {
  date: string // ISO string
}
```

**Миграция через Cloud Function:**

```typescript
// firebase/functions/migrateTransactionDates.ts
export const migrateTransactionDates = functions.https.onRequest(async (req, res) => {
  const snapshot = await db.collection('transactions').get()
  const batch = db.batch()

  snapshot.docs.forEach((doc) => {
    const data = doc.data()
    if (data.date instanceof Timestamp) {
      batch.update(doc.ref, {
        date: data.date.toDate().toISOString()
      })
    }
  })

  await batch.commit()
  res.send('Migration complete')
})
```

**Но для MVP:** схема фиксирована, миграции не планируются.

---

## Firebase Config (Environment Variables)

```env
# .env.local
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=finsight-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=finsight-prod
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=finsight-prod.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

**Инициализация:**

```typescript
// shared/lib/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
```

---

## Security Rules (полная версия)

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated() && isOwner(userId);
      allow create: if isAuthenticated() && isOwner(userId);
      allow update: if isAuthenticated() && isOwner(userId);
    }
    
    // Transactions collection
    match /transactions/{transactionId} {
      allow read: if isAuthenticated() 
        && isOwner(resource.data.userId);
      
      allow create: if isAuthenticated()
        && isOwner(request.resource.data.userId)
        && request.resource.data.amount > 0
        && request.resource.data.currency == 'RUB'
        && request.resource.data.source == 'manual'
        && request.resource.data.type in ['income', 'expense', 'transfer'];
      
      allow update: if isAuthenticated()
        && isOwner(resource.data.userId)
        && request.resource.data.userId == resource.data.userId
        && request.resource.data.amount > 0;
      
      allow delete: if isAuthenticated()
        && isOwner(resource.data.userId);
    }
    
    // Categories collection
    match /categories/{categoryId} {
      allow read: if isAuthenticated()
        && isOwner(resource.data.userId);
      
      allow create: if isAuthenticated()
        && isOwner(request.resource.data.userId);
      
      allow update: if isAuthenticated()
        && isOwner(resource.data.userId)
        && request.resource.data.userId == resource.data.userId
        && request.resource.data.isDefault == resource.data.isDefault;
      
      allow delete: if isAuthenticated()
        && isOwner(resource.data.userId)
        && resource.data.isDefault == false;
    }
    
    // Rules collection
    match /rules/{ruleId} {
      allow read: if isAuthenticated()
        && isOwner(resource.data.userId);
      
      allow create: if isAuthenticated()
        && isOwner(request.resource.data.userId)
        && request.resource.data.priority >= 0
        && request.resource.data.priority <= 100
        && exists(/databases/$(database)/documents/categories/$(request.resource.data.categoryId))
        && get(/databases/$(database)/documents/categories/$(request.resource.data.categoryId)).data.userId == request.auth.uid;
      
      allow update: if isAuthenticated()
        && isOwner(resource.data.userId)
        && request.resource.data.userId == resource.data.userId
        && request.resource.data.priority >= 0
        && request.resource.data.priority <= 100;
      
      allow delete: if isAuthenticated()
        && isOwner(resource.data.userId);
    }
  }
}
```

**Тестирование Security Rules:**

```bash
# firebase.json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}

# Запуск эмулятора
firebase emulators:start --only firestore

# Тесты
npm run test:rules
```

---

## Firestore Composite Indexes

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "categoryId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "categories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "rules",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "priority", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Деплой индексов:**

```bash
firebase deploy --only firestore:indexes
```

---

## Limits & Quotas (Firestore Free Tier)

| Ресурс | Лимит |
|---|---|
| Stored data | 1 GB |
| Document reads | 50,000 / day |
| Document writes | 20,000 / day |
| Document deletes | 20,000 / day |
| Network egress | 10 GB / month |

**Для MVP этого достаточно:**
- 1000 транзакций ≈ 500 KB (с учётом metadata)
- Dashboard загружает ~300 транзакций за месяц = 300 reads
- Пользователь открывает dashboard 10 раз в день = 3,000 reads/day
- Запас до 50,000 reads очень большой

**Если превысим лимит:**
- Перейти на Blaze (pay-as-you-go)
- $0.06 / 100,000 reads
- Для 1 пользователя стоимость будет копеечной
