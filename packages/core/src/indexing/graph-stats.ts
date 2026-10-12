import { defaultGraphStats, type GraphStatsService } from './graph-stats-service.ts'

export type { GraphStats, GraphStatsOptions } from './graph-stats-service.ts'

export const loadGraphStats: GraphStatsService['loadGraphStats'] = (...args) =>
  defaultGraphStats().loadGraphStats(...args)
