# FinCount — Personal Finance Advisor

> ⚠️ Этот документ является черновым (draft). Архитектура и фичи будут уточняться по мере разработки.

**Одна фраза:** Не просто записывай расходы — понимай свои финансовые паттерны.

---

## Этап 1 — Product Definition [DRAFT]

### MoSCoW

#### Must (MVP)
- Регистрация / вход (Firebase Auth)
- Добавление / редактирование / удаление транзакций
- Категории (дефолтные + кастомные)
- Dashboard с базовой аналитикой — баланс, доходы vs расходы за месяц
- Разбивка по категориям (pie chart)

#### Should
- Правила автокатегоризации
- Инсайты — аномалии ("на кофе в 3 раза больше обычного")
- Прогноз баланса на конец месяца
- Фильтрация по периоду / категории
- Mock Bank Integration (Adapter паттерн) — имитация подключения банковских счетов через детерминированный генератор транзакций

#### Could
- Финансовый health score
- Экспорт в CSV
- Тёмная тема

#### Won't
- Мобильное приложение
- Реальные банковские API
- Мультивалютность

---

### User Stories

```
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

Как пользователь я хочу подключить банковский счёт
чтобы транзакции подтягивались автоматически без ручного ввода
```

---

### MVP Scope — три экрана

| Экран | Назначение |
|---|---|
| Dashboard | Баланс, доходы/расходы, топ категорий, 2-3 инсайта |
| Транзакции | Таблица с фильтрами, добавление через modal/drawer |
| Настройки | Категории, правила автокатегоризации, подключённые счета |

---

### Mock Bank Integration

Фейковая интеграция с банками реализуется через паттерн **Adapter**:

- **Bank Provider Registry** — список "поддерживаемых банков" с логотипами (JSON с метаданными)
- **Mock OAuth Flow** — редирект на `/connect/[bank-id]`, имитация авторизации с дисклеймером
- **Transaction Generator** — детерминированный генератор на основе `seed` (userId + bankId). Логика живёт в единственном API route — `/api/bank/sync`
- **BankProvider Interface** — единый контракт для mock и будущих реальных провайдеров

```ts
interface BankProvider {
  fetchTransactions(accountId: string, from: Date, to: Date): Promise<Transaction[]>
  fetchBalance(accountId: string): Promise<Balance>
  disconnect(accountId: string): Promise<void>
}

class MockBankProvider implements BankProvider { ... }
class RealBankProvider implements BankProvider { ... } // в будущем
```

---

## Этап 2 — Domain Modeling [DRAFT]

### Сущности (Firestore коллекции)

```
users/{userId}
├── currency, createdAt
└── управляется Firebase Auth

accounts/{accountId}
├── userId, bankId, name
├── type: 'checking' | 'savings' | 'card'
├── balance, currency
├── provider: 'mock' | 'real'
└── lastSyncedAt

transactions/{transactionId}
├── userId, accountId
├── amount, currency
├── type: 'income' | 'expense' | 'transfer'
├── description, date
├── categoryId (null = uncategorized)
└── source: 'manual' | 'bank_sync'

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
- Ручное изменение категории не перезаписывается при следующем синке

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
├── insight/
│   └── InsightEngine.ts         — чистые функции, вычисление на клиенте
└── bank/
    ├── BankProvider.ts          — интерфейс (Adapter паттерн)
    ├── MockBankProvider.ts      — seeded random реализация
    └── BankProviderFactory.ts   — выбор провайдера по типу
```

---

## Этап 3 — Architecture Design [DRAFT]

### Принципы

Это **фронтенд-проект** с минимальным бэкендом. Бэкенд = Firebase (Auth + Firestore + Security Rules) + один API route для Mock Bank sync. Вычисления на клиенте — инсайты, прогноз и агрегаты считаются через `useMemo` из данных React Query.

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
  accounts:    { all: (userId: string) => ['accounts', userId] as const },
}
```

Иерархия ключей позволяет инвалидировать `['transactions', userId]` и автоматически сбросить все вложенные фильтры.

#### Optimistic Updates

Применяются для добавления транзакции и смены категории. Паттерн: `onMutate` (optimistic update) → `onError` (rollback) → `onSettled` (invalidate).

Поскольку инсайты вычисляются через `useMemo` из данных React Query — они пересчитываются мгновенно вместе с optimistic update, без дополнительных запросов.

---

### Rendering стратегии

| Страница | Стратегия | Почему |
|---|---|---|
| `/dashboard` | SSR | персональные данные |
| `/transactions` | SSR | фильтры в URL, данные user-specific |
| `/settings` | SSR | user-specific конфиг |
| `/connect/[bankId]` | CSR | интерактивный OAuth flow |
| `/api/bank/sync` | API Route | единственный серверный эндпоинт |

---

### Структура папок

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx               — Dashboard
│   │   ├── transactions/page.tsx
│   │   └── settings/page.tsx
│   ├── connect/[bankId]/page.tsx
│   └── api/
│       └── bank/sync/route.ts     — единственный API route
│
├── domain/
│   ├── transaction/
│   ├── category/
│   ├── rule/
│   ├── insight/
│   └── bank/
│
├── features/
│   ├── add-transaction/
│   │   ├── ui/AddTransactionModal.tsx
│   │   ├── model/useAddTransaction.ts
│   │   └── api/mutations.ts
│   ├── categorization/
│   ├── insights/
│   └── bank-connect/
│
├── widgets/
│   ├── Dashboard/
│   ├── TransactionTable/
│   └── InsightCard/
│
└── shared/
    ├── ui/
    ├── lib/
    │   └── queryKeys.ts
    ├── hooks/
    └── types/
```

---

### Технологический стек

| Слой | Технология | Причина |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR, файловый роутинг |
| Auth + DB | Firebase (Auth + Firestore) | BaaS, Security Rules, бесплатный tier |
| Server state | React Query | кеширование, optimistic updates |
| Client state | Zustand | минимальный, без бойлерплейта |
| URL state | nuqs | type-safe searchParams для Next.js |
| Forms | React Hook Form + Zod | валидация на клиенте |
| Charts | Recharts | легковесный (lazy import — SSR fix) |
| Styling | Tailwind + shadcn/ui | скорость разработки |
| Hosting | Vercel | нативная интеграция с Next.js |

---

## Этап 4 — UI/UX Wireframes [DRAFT]

Три экрана MVP — Dashboard, Транзакции, Настройки. Wireframes зафиксированы в `wireframes.html`.

### Компонентная иерархия

**Dashboard:** `StatCards` → `BarChart (Recharts)` → `DonutChart (Recharts)` → `InsightCard[]` → `BudgetProgress[]`

**Транзакции:** `FilterBar (nuqs)` → `SummaryCards` → `TransactionTable` → `Pagination`

**Настройки:** `CategoryList` → `RuleList (drag & drop)` → `BankAccountList`

---

## Этап 5 — Architecture Decision Records

### ADR-001: Firebase вместо кастомного бэкенда

**Статус:** Принято

**Решение:** Firebase (Auth + Firestore + Security Rules) как BaaS.

**Trade-offs:**
- ✅ Минимум инфраструктуры, бесплатный tier
- ✅ Security Rules снимают необходимость писать авторизацию в каждом запросе
- ✅ Firebase SDK с типизацией через `withConverter`
- ❌ Firestore — NoSQL, нет JOIN'ов, нужна денормализация
- ❌ Vendor lock-in

**Альтернативы отклонены:** Supabase (PostgreSQL) — реляционная БД удобнее для финансовых данных, но Firestore компенсирует это денормализацией и лучшей real-time поддержкой.

---

### ADR-002: React Query для server state, Zustand только для UI

**Статус:** Принято

**Решение:** Строгое разделение — React Query владеет данными с Firebase, Zustand только UI state.

**Trade-offs:**
- ✅ Кеширование, дедупликация запросов, stale-while-revalidate
- ✅ Optimistic updates через `onMutate / onError / onSettled`
- ❌ Два инструмента вместо одного

---

### ADR-003: Инсайты вычисляются на клиенте

**Статус:** Принято

**Решение:** `InsightEngine` — чистые функции, вычисляются через `useMemo` из данных React Query.

**Trade-offs:**
- ✅ Нет дополнительных API запросов
- ✅ Мгновенный пересчёт, включая optimistic updates
- ✅ Легко тестировать — чистые функции
- ❌ При 10k+ транзакций может быть заметно — митигация: Web Worker

---

### ADR-004: nuqs для URL state

**Статус:** Принято

**Решение:** Фильтры транзакций живут в URL через nuqs.

**Trade-offs:**
- ✅ Фильтры сохраняются при перезагрузке, шарятся по ссылке
- ✅ Кнопка "назад" работает ожидаемо
- ✅ Type-safe

---

### ADR-005: Adapter паттерн для банков

**Статус:** Принято

**Решение:** `BankProvider` интерфейс + `MockBankProvider` с seeded random. Замена на реальный провайдер — новый класс без изменения существующего кода (Open/Closed принцип).

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
- [ ] Структура папок — `domain / features / widgets / shared`
- [ ] Firebase Auth — Email + Google OAuth
- [ ] Protected routes — middleware
- [ ] Firestore схема + Security Rules
- [ ] `TransactionService` — create, list
- [ ] Базовая форма добавления транзакции
- [ ] Дефолтные категории при регистрации

**Done criteria:** авторизованный пользователь может добавить транзакцию и увидеть её в списке.

---

### Неделя 2 — Core Features

- [ ] React Query — queryKey стратегия, все базовые хуки
- [ ] Zustand — UIStore
- [ ] nuqs — фильтры в URL
- [ ] Страница транзакций — таблица с пагинацией
- [ ] Optimistic updates — добавление и смена категории
- [ ] `CategorizationEngine` — чистые функции
- [ ] Страница настроек — категории + правила с drag & drop

**Done criteria:** таблица транзакций с фильтрами, URL сохраняет состояние, правила применяются.

---

### Неделя 3 — Dashboard & Insights

- [ ] `InsightEngine` — аномалии, паттерны, прогноз
- [ ] Dashboard — stat cards, Recharts bar chart, donut
- [ ] InsightCard компонент (3 типа)
- [ ] Прогресс бюджета по категориям
- [ ] `MockBankProvider` — seeded random
- [ ] `BankProvider` интерфейс + `BankProviderFactory`
- [ ] `/connect/[bankId]` — Mock OAuth flow
- [ ] `/api/bank/sync` — API route
- [ ] Страница настроек — подключённые счета

**Done criteria:** Dashboard с инсайтами, Mock банк подключается и подтягивает транзакции.

---

### Неделя 4 — Polish & Portfolio

- [ ] Error Boundaries на каждом слое
- [ ] Loading states — skeleton везде
- [ ] Empty states — первый запуск
- [ ] Responsive — мобильная версия
- [ ] Финальный README с ADR
- [ ] Деплой на Vercel
- [ ] `docs/decisions/` — ADR файлы
- [ ] Тесты — `InsightEngine` + `CategorizationEngine`

**Done criteria:** проект задеплоен, README объясняет архитектуру, есть что показать на интервью.

---

### Технические риски

| Риск | Вероятность | Митигация |
|---|---|---|
| Firestore нет JOIN — нужна денормализация | Средняя | Спроектировать схему заранее, composite indexes |
| nuqs конфликт с App Router | Низкая | Проверить совместимость в начале недели 2 |
| Recharts на SSR | Средняя | `dynamic(() => import(...), { ssr: false })` |
| Mock Bank данные нереалистичны | Низкая | `rand-seed` библиотека, тестировать отдельно |

---

## Прогресс

- [x] Этап 1 — Product Definition
- [x] Этап 2 — Domain Modeling
- [x] Этап 3 — Architecture Design
- [x] Этап 4 — UI/UX Wireframes
- [x] Этап 5 — Architecture Decision Records
- [x] Этап 6 — Development Plan
