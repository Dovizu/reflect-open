import { defaultIndexQuery, type IndexQueryService } from './index-query-service.ts'

export const resolveNoteTarget: IndexQueryService['resolveNoteTarget'] = (...args) =>
  defaultIndexQuery().resolveNoteTarget(...args)
