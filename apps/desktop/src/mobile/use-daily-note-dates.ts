import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createDailyDatesQueryOptions } from '@/lib/query-options.ts'
import { useGraph } from '@/providers/graph-provider.tsx'

/** Indexed daily-note dates in an inclusive range, ready for calendar lookup. */
export function useDailyNoteDates(start: string, end: string): ReadonlySet<string> {
  const { graph } = useGraph()
  const { data } = useQuery({
    ...createDailyDatesQueryOptions(graph?.root, start, end),
    enabled: graph !== null,
    placeholderData: keepPreviousData,
  })

  return useMemo(() => new Set(data ?? []), [data])
}
