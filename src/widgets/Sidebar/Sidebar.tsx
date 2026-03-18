'use client';

import { Home, Receipt, Settings, TrendingUp, Wallet, LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  userEmail: string | null;
  onSignOut: () => void;
}

export function Sidebar({ userEmail, onSignOut }: SidebarProps) {
  const pathname = usePathname();

  const navigation = [
    { name: 'Обзор', href: '/', icon: Home, current: true },
    { name: 'Транзакции', href: '/transactions', icon: Receipt, current: false },
    { name: 'Аналитика', href: '/analytics', icon: TrendingUp, current: false },
    { name: 'Кошелёк', href: '/wallet', icon: Wallet, current: false },
    { name: 'Настройки', href: '/settings', icon: Settings, current: false },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Finsight</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.name}
              disabled={!item.current}
              className={`
                flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                transition-all duration-150
                ${
                  item.current
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50'
                }
              `}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-4">
        <div className="mb-3 rounded-lg bg-muted p-3">
          <div className="mb-1 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <p className="text-xs font-medium text-foreground">Активен</p>
          </div>
          <p className="truncate text-sm text-muted-foreground">{userEmail}</p>
        </div>
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                   text-muted-foreground transition-all duration-150
                   hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
          <span>Выйти</span>
        </button>
      </div>
    </div>
  );
}
