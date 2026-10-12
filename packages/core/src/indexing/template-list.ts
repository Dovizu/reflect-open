import { defaultIndexQuery, type IndexQueryService } from './index-query-service.ts'

export type { TemplateEntry } from './index-query-service.ts'

export const listTemplates: IndexQueryService['listTemplates'] = (...args) =>
  defaultIndexQuery().listTemplates(...args)
