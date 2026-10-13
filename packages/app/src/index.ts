/**
 * `@reflect/app`: the app layer over `@reflect/core`. It knows windows, routes,
 * commands and menus, and nothing about React or Tauri. The desktop app builds
 * it once per webview with `createAppServices(core, host)`.
 */
export { createAppServices, type AppHost, type AppServices } from './create-app-services.ts'
export {
  countSelectedCalendars,
  groupCalendarsBySource,
  showsDayEvents,
  type CalendarEventsService,
} from './calendar/calendar-events-service.ts'
export { dailyArrivalIntent } from './daily/daily-arrivals.ts'
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
} from './daily/day-window.ts'
export {
  addMonths,
  buildMonthGrid,
  monthLabel,
  monthOf,
  monthShortLabel,
  weekdayLabels,
  type MonthGrid,
  type MonthGridCell,
} from './daily/month-grid.ts'
export {
  createWeekWindow,
  monthPickTarget,
  WEEK_WINDOW_RADIUS,
  weekAtIndex,
  weekIndexOf,
  weekOf,
  weekStartOf,
  type WeekWindow,
} from './daily/week-window.ts'
