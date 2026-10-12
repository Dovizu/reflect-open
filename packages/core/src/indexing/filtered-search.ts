import { defaultSearch, type SearchService } from './search-service.ts'

export type { FilteredSearchHit, FilteredSearchOptions } from './search-service.ts'

export const searchWithFilters: SearchService['searchWithFilters'] = (...args) =>
  defaultSearch().searchWithFilters(...args)
