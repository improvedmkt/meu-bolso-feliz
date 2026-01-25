import { ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMonthYear } from '@/lib/format';
import { useNotifications } from '@/hooks/useNotifications';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  title: string;
  currentMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
  isCurrentMonth: boolean;
}

export function AppHeader({
  title,
  currentMonth,
  onPreviousMonth,
  onNextMonth,
  onCurrentMonth,
  isCurrentMonth,
}: AppHeaderProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        
        {/* Month navigation */}
        <div className="flex items-center gap-2 rounded-lg bg-secondary p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onPreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={onCurrentMonth}
            className={cn(
              'min-w-[140px] rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              isCurrentMonth
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            )}
          >
            {formatMonthYear(currentMonth)}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Notifications */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-expense text-xs font-medium text-expense-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-semibold">Notificações</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-1 text-xs"
                onClick={() => markAllAsRead.mutate()}
              >
                Marcar todas como lidas
              </Button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma notificação
              </p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex cursor-pointer items-start gap-3 border-b py-3 last:border-0 hover:bg-accent/50"
                  onClick={() => markAsRead.mutate(notification.id)}
                >
                  <div
                    className={cn(
                      'mt-1 h-2 w-2 rounded-full',
                      notification.type === 'bill_overdue'
                        ? 'bg-expense'
                        : notification.type === 'bill_due'
                        ? 'bg-warning'
                        : 'bg-muted-foreground'
                    )}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {notification.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </header>
  );
}
