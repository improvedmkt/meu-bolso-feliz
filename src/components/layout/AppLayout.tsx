import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { useMonthNavigation } from '@/hooks/useMonthNavigation';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const {
    currentMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    isCurrentMonth,
  } = useMonthNavigation();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="pl-64">
        <AppHeader
          title={title}
          currentMonth={currentMonth}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
          onCurrentMonth={goToCurrentMonth}
          isCurrentMonth={isCurrentMonth}
        />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

// Export context hook for accessing month in child components
export { useMonthNavigation } from '@/hooks/useMonthNavigation';
