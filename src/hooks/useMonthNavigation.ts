import { useState, useCallback } from 'react';
import { getMonthStart, formatDateInput } from '@/lib/format';

export function useMonthNavigation() {
  const [currentMonth, setCurrentMonth] = useState<Date>(getMonthStart());

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  }, []);

  const goToCurrentMonth = useCallback(() => {
    setCurrentMonth(getMonthStart());
  }, []);

  const isCurrentMonth = getMonthStart().getTime() === currentMonth.getTime();

  const monthRef = formatDateInput(currentMonth);

  return {
    currentMonth,
    monthRef,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    isCurrentMonth,
  };
}
