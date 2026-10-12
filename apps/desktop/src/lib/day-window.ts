/*
 * The daily surfaces' day window lives in `@reflect/core` (`daily/day-window.ts`).
 * This module re-exports it.
 */
export {
  createDayWindow,
  dateAtIndex,
  FUTURE_DAYS,
  indexOfDate,
  indexWithin,
  neighborDate,
  PAST_DAYS,
  type DayWindow,
  type DayWindowRadius,
} from '@reflect/core'
