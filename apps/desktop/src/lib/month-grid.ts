/*
 * The calendar's month grid lives in `@reflect/core` (`daily/month-grid.ts`).
 * This module re-exports it.
 */
export {
  addMonths,
  buildMonthGrid,
  monthLabel,
  monthOf,
  monthShortLabel,
  weekdayLabels,
  type MonthGrid,
  type MonthGridCell,
} from '@reflect/core'
