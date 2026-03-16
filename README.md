# Finsight — Personal Finance Advisor

> ⚠️ Этот документ является черновым (draft). Архитектура и фичи будут уточняться по мере разработки.

**Одна фраза:** Не просто записывай расходы — понимай свои финансовые паттерны.

---

## Этап 1 — Product Definition [DRAFT]

### MoSCoW

#### Must (MVP)
- Регистрация / вход (Firebase Auth — Email/Password + Google OAuth + GitHub OAuth)
- Добавление / редактирование / удаление транзакций
- Категории (дефолтные + кастомные)
- Dashboard с базовой аналитикой — баланс, доходы vs расходы за месяц
- Разбивка по категориям (pie chart)

#### Should
- Правила автокатегоризации
- Инсайты — аномалии ("на кофе в 3 раза больше обычного")
- Прогноз баланса на конец месяца
- Фильтрация по периоду / категории

#### Could
- Финансовый health score
- Экспорт в CSV
- Тёмная тема

#### Won't
- Мобильное приложение
- Банковские интеграции любого рода — ни один банк не предоставляет API-доступ к счетам физических лиц
- Мультивалютность

---

### User Stories

```
Как пользователь я хочу зарегистрироваться через email/пароль
чтобы не зависеть от сторонних аккаунтов

Как пользователь я хочу войти через Google или GitHub
чтобы не вводить пароль вручную

Как пользователь я хочу добавить транзакцию
чтобы фиксировать свои расходы и доходы

Как пользователь я хочу видеть dashboard с аналитикой
чтобы понимать куда уходят деньги за месяц

Как пользователь я хочу задать правило категоризации
чтобы не тегировать транзакции вручную каждый раз

Как пользователь я хочу получать инсайты
чтобы замечать аномалии в своих тратах которые сам не вижу

Как пользователь я хочу видеть прогноз на конец месяца
чтобы планировать траты заранее
```

---

### MVP Scope — три экрана

| Экран | Назначение |
|---|---|
| Dashboard | Баланс, доходы/расходы, топ категорий, 2-3 инсайта |
| Транзакции | Таблица с фильтрами, добавление через modal/drawer |
| Настройки | Категории, правила автокатегоризации |

---

## Этап 2 — Domain Modeling [DRAFT]

### Сущности (Firestore коллекции)

```
users/{userId}
├── currency, createdAt
└── управляется Firebase Auth

transactions/{transactionId}
├── userId
├── amount, currency
├── type: 'income' | 'expense' | 'transfer'
├── description, date
├── categoryId (null = uncategorized)
└── source: 'manual'

categories/{categoryId}
├── userId, name, icon, color
├── type: 'income' | 'expense'
└── isDefault: boolean

rules/{ruleId}
├── userId, categoryId
├── matcher: { field: 'description', operator: 'contains', value: string }
└── priority: number

Insight — не хранится в Firestore
└── вычисляется на клиенте через useMemo из transactions
```

---

### Бизнес-правила

#### Категоризация
- При создании транзакции — прогоняем через Rules по приоритету, берём первое совпадение
- Если правил нет — `categoryId = null`, транзакция помечается как "uncategorized"
- Ручное изменение категории не перезаписывается повторной автокатегоризацией

#### Инсайты (вычисляются на клиенте)
- **Аномалия** — трата в категории превышает среднее за 3 месяца более чем на 50%
- **Паттерн** — регулярная трата с одинаковым описанием каждые ~30 дней (подписки)
- **Прогноз** — линейная экстраполяция трат текущего месяца на оставшиеся дни

#### Инварианты
- Транзакция не может иметь `amount = 0`
- `transfer` всегда создаёт две транзакции — debit и credit
- Удаление категории не удаляет транзакции — они становятся `categoryId = null`
- Rule не может ссылаться на категорию другого пользователя
- Firestore Security Rules гарантируют что пользователь видит только свои данные

---

### Структура доменного слоя

```
domain/
├── transaction/
│   ├── Transaction.ts           — тип + Zod схема
│   └── TransactionService.ts    — CRUD через Firebase SDK
├── category/
│   ├── CategoryService.ts
│   └── defaults.ts              — дефолтные категории при регистрации
├── rule/
│   └── CategorizationEngine.ts  — чистые функции, применение правил
└── insight/
    └── InsightEngine.ts         — чистые функции, вычисление на клиенте
```

---

## Этап 3 — Architecture Design [DRAFT]

### Принципы

Это **полностью фронтендовый проект** — нет ни одного серверного эндпоинта. Бэкенд = Firebase (Auth + Firestore + Security Rules). Все вычисления на клиенте.

---

### OAuth Flow

Firebase Auth поддерживает OAuth провайдеры из коробки:

```ts
// shared/lib/auth.ts
import {
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'

const googleProvider = new GoogleAuthProvider()
const githubProvider = new GithubAuthProvider()

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider)
export const signInWithGithub = () => signInWithPopup(auth, githubProvider)
export const signUpWithEmail  = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password)
export const signInWithEmail  = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password)
```

При первом входе — автоматически создаётся документ `users/{uid}` и дефолтные категории:

```ts
// features/auth/model/useAuthSync.ts
export function useAuthSync() {
  const [user] = useAuthState(auth)

  useEffect(() => {
    if (!user) return
    UserService.ensureExists(user.uid, {
      currency: 'RUB',
      createdAt: new Date(),
    })
    CategoryService.createDefaults(user.uid)
  }, [user])
}
```

---

### State Management

| Тип состояния | Инструмент | Пример |
|---|---|---|
| Server state | React Query | список транзакций, категории |
| Client UI state | Zustand | открыт ли modal, активный таб |
| URL state | nuqs | выбранный период, фильтр категории |
| Form state | React Hook Form + Zod | форма добавления транзакции |
| Auth state | Firebase Auth | текущий пользователь |
| Computed state | useMemo | инсайты, прогноз, агрегаты |

**Ключевое правило:** server state никогда не дублируется в Zustand. React Query — единственный источник правды для данных с Firebase.

#### QueryKey стратегия

```ts
export const queryKeys = {
  transactions: {
    all: (userId: string) => ['transactions', userId] as const,
    filtered: (userId: string, filters: TransactionFilters) =>
      ['transactions', userId, filters] as const,
  },
  categories: { all: (userId: string) => ['categories', userId] as const },
  rules:       { all: (userId: string) => ['rules', userId] as const },
}
```

#### Optimistic Updates

Применяются для добавления транзакции и смены категории. Паттерн: `onMutate` (optimistic) → `onError` (rollback) → `onSettled` (invalidate).

Инсайты через `useMemo` пересчитываются мгновенно вместе с optimistic update.

---

### Rendering стратегии

| Страница | Стратегия | Почему |
|---|---|---|
| `/dashboard` | SSR | персональные данные |
| `/transactions` | SSR | фильтры в URL, user-specific |
| `/settings` | SSR | user-specific конфиг |
| `/login` | CSR | OAuth popup, нет SEO |

> Нет ни одного API route — проект полностью фронтендовый.

---

### Структура папок

```
src/
├── app/
│   ├── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx               — Dashboard
│   │   ├── transactions/page.tsx
│   │   └── settings/page.tsx
│   └── middleware.ts              — protected routes
│
├── domain/
│   ├── transaction/
│   ├── category/
│   ├── rule/
│   └── insight/
│
├── features/
│   ├── auth/
│   │   ├── ui/LoginForm.tsx       — Email/Password форма
│   │   ├── ui/OAuthButtons.tsx    — Google + GitHub кнопки
│   │   └── model/useAuthSync.ts   — создание user doc при первом входе
│   ├── add-transaction/
│   ├── categorization/
│   └── insights/
│
├── widgets/
│   ├── Dashboard/
│   ├── TransactionTable/
│   └── InsightCard/
│
└── shared/
    ├── ui/
    ├── lib/
    │   ├── firebase.ts
    │   ├── auth.ts
    │   └── queryKeys.ts
    ├── hooks/
    └── types/
```

---

### Технологический стек

| Слой | Технология | Причина |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR, файловый роутинг |
| Auth | Firebase Auth (Email/Password + Google + GitHub OAuth) | все способы входа из коробки |
| Database | Firestore | Security Rules, бесплатный tier |
| Server state | React Query | кеширование, optimistic updates |
| Client state | Zustand | минимальный, без бойлерплейта |
| URL state | nuqs | type-safe searchParams |
| Forms | React Hook Form + Zod | валидация на клиенте |
| Charts | Recharts | lazy import — `ssr: false` |
| Styling | Tailwind + shadcn/ui | скорость разработки |
| Hosting | Vercel | нативная интеграция с Next.js |

---

## Этап 4 — UI/UX Wireframes [DRAFT]

Три экрана MVP зафиксированы в `wireframes.html`.

### Компонентная иерархия

**Login:** `LoginForm` (Email/Password) · `LoginButtons` (Google OAuth · GitHub OAuth) · `ForgotPasswordLink`

**Dashboard:** `StatCards` → `BarChart` → `DonutChart` → `InsightCard[]` → `BudgetProgress[]`

**Транзакции:** `FilterBar (nuqs)` → `SummaryCards` → `TransactionTable` → `Pagination`

**Настройки:** `CategoryList` → `RuleList (drag & drop)`

---

## Этап 5 — Architecture Decision Records

### ADR-001: Firebase вместо кастомного бэкенда

**Статус:** Принято

**Решение:** Firebase (Auth + Firestore + Security Rules) как BaaS. Нет ни одного серверного эндпоинта — проект полностью фронтендовый.

**Trade-offs:**
- ✅ Минимум инфраструктуры, бесплатный tier
- ✅ Security Rules — авторизация на уровне БД
- ✅ OAuth провайдеры из коробки
- ❌ Firestore NoSQL — нужна денормализация вместо JOIN
- ❌ Vendor lock-in

---

### ADR-002: Email/Password + Google + GitHub OAuth

**Статус:** Принято

**Контекст:** Нужно покрыть разные сценарии — пользователи без Google/GitHub аккаунта и те кто хочет войти быстро через OAuth.

**Решение:** Три способа входа через Firebase Auth — Email/Password, Google OAuth и GitHub OAuth через `signInWithPopup`.

**Trade-offs:**
- ✅ Email/Password — универсально, не зависит от сторонних провайдеров
- ✅ Google — самый распространённый OAuth провайдер
- ✅ GitHub — релевантен для dev-аудитории портфолио
- ✅ Firebase берёт на себя хранение хешей паролей и токенов
- ❌ Email/Password требует экрана восстановления пароля — дополнительный UI
- ❌ GitHub OAuth callback URL нужно настраивать отдельно для prod и localhost

---

### ADR-003: React Query для server state, Zustand только для UI

**Статус:** Принято

**Решение:** React Query владеет данными с Firebase, Zustand только UI state.

**Trade-offs:**
- ✅ Кеширование, optimistic updates из коробки
- ✅ Zustand остаётся маленьким и предсказуемым
- ❌ Два инструмента вместо одного

---

### ADR-004: Инсайты вычисляются на клиенте

**Статус:** Принято

**Решение:** `InsightEngine` — чистые функции через `useMemo` из данных React Query.

**Trade-offs:**
- ✅ Нет API запросов, мгновенный пересчёт
- ✅ Легко тестировать — чистые функции
- ❌ При 10k+ транзакций может тормозить — митигация: Web Worker

---

### ADR-005: nuqs для URL state

**Статус:** Принято

**Решение:** Фильтры транзакций (период, категория, тип) живут в URL.

**Trade-offs:**
- ✅ Фильтры сохраняются при перезагрузке и шарятся по ссылке
- ✅ Кнопка "назад" работает ожидаемо
- ✅ Type-safe

---

### ADR-006: FSD-inspired структура папок

**Статус:** Принято

**Решение:** Слои `app / domain / features / widgets / shared`. `domain` — чистый TypeScript без фреймворков.

---

## Этап 6 — Development Plan

**Темп:** 5-10 часов в неделю · **Срок:** 4 недели

---

### Неделя 1 — Foundation

- [ ] Инициализация Next.js 14 + TypeScript + Tailwind + shadcn/ui
- [ ] Настройка Firebase (Auth, Firestore, Security Rules)
- [ ] Структура папок
- [ ] Firebase Auth — Email/Password + Google OAuth + GitHub OAuth
- [ ] Экран логина — форма + OAuth кнопки + восстановление пароля
- [ ] `useAuthSync` — создание user doc и дефолтных категорий при первом входе
- [ ] Protected routes — middleware
- [ ] Firestore схема + Security Rules
- [ ] `TransactionService` — create, list
- [ ] Базовая форма добавления транзакции (React Hook Form + Zod)

**Done criteria:** пользователь входит через email/пароль или Google/GitHub, может добавить транзакцию и увидеть её в списке.

---

### Неделя 2 — Core Features

- [ ] React Query — queryKey стратегия, все базовые хуки
- [ ] Zustand — UIStore
- [ ] nuqs — фильтры в URL
- [ ] Страница транзакций — таблица с пагинацией
- [ ] Optimistic updates — добавление и смена категории
- [ ] `CategorizationEngine` — чистые функции
- [ ] Страница настроек — категории + правила с drag & drop приоритетов

**Done criteria:** таблица с фильтрами, URL сохраняет состояние, правила применяются автоматически.

---

### Неделя 3 — Dashboard & Insights

- [ ] `InsightEngine` — аномалии, паттерны, прогноз
- [ ] Dashboard — stat cards, Recharts bar chart, donut
- [ ] InsightCard компонент (3 типа: anomaly / pattern / forecast)
- [ ] Прогресс бюджета по категориям
- [ ] Recharts через `dynamic(() => import(...), { ssr: false })`

**Done criteria:** Dashboard показывает реальные инсайты из введённых транзакций.

---

### Неделя 4 — Polish & Portfolio

- [ ] Error Boundaries на каждом слое
- [ ] Loading states — skeleton везде
- [ ] Empty states — первый запуск без данных
- [ ] Responsive — мобильная версия
- [ ] Финальный README с ADR и архитектурной диаграммой
- [ ] Деплой на Vercel
- [ ] `docs/decisions/` — ADR файлы в репозитории
- [ ] Тесты — `InsightEngine` + `CategorizationEngine`

**Done criteria:** проект задеплоен, README объясняет архитектуру, есть что показать на интервью.

---

### Технические риски

| Риск | Вероятность | Митигация |
|---|---|---|
| Firestore нет JOIN — нужна денормализация | Средняя | Спроектировать схему заранее, composite indexes |
| nuqs конфликт с App Router | Низкая | Проверить совместимость в начале недели 2 |
| Recharts на SSR | Средняя | `dynamic(() => import(...), { ssr: false })` |
| GitHub OAuth callback URL на локале | Низкая | Добавить `localhost:3000` в GitHub OAuth app settings |

---

## Прогресс

- [x] Этап 1 — Product Definition
- [x] Этап 2 — Domain Modeling
- [x] Этап 3 — Architecture Design
- [x] Этап 4 — UI/UX Wireframes
- [x] Этап 5 — Architecture Decision Records
- [x] Этап 6 — Development Plan
