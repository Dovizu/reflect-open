import { defaultTemplates, type TemplateService } from '@reflect/core'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/**
 * The `TemplateService` of the nearest `AppServicesProvider`, else the
 * process-wide default.
 */
export function useTemplateService(): TemplateService {
  return useOptionalAppServices()?.templates ?? defaultTemplates()
}
