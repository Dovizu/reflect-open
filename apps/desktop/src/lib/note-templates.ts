import { defaultTemplates, type TemplateService } from '@reflect/core'

/*
 * Note templates live in `@reflect/core` (`TemplateService`). Each function
 * here delegates to the process-wide service.
 */

export const insertTemplate: TemplateService['insertTemplate'] = (...args) =>
  defaultTemplates().insertTemplate(...args)

export const renameTemplate: TemplateService['renameTemplate'] = (...args) =>
  defaultTemplates().renameTemplate(...args)
