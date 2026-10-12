import { defaultIndexStore, type IndexStoreService } from './index-store-service.ts'

export type {
  IndexedNoteTouch,
  ReconcileScan,
  ScanCandidate,
  ScanOrphan,
} from './index-store-service.ts'

/** `defaultIndexStore().apply`. */
export const applyIndexedNote: IndexStoreService['apply'] = (note, generation) =>
  defaultIndexStore().apply(note, generation)

/** `defaultIndexStore().applyBatch`. */
export const applyIndexedNotes: IndexStoreService['applyBatch'] = (notes, generation) =>
  defaultIndexStore().applyBatch(notes, generation)

/** `defaultIndexStore().remove`. */
export const removeFromIndex: IndexStoreService['remove'] = (path, generation) =>
  defaultIndexStore().remove(path, generation)

/** `defaultIndexStore().move`. */
export const moveIndexedRows: IndexStoreService['move'] = (from, to, generation) =>
  defaultIndexStore().move(from, to, generation)

/** `defaultIndexStore().moveIndexed`. */
export const moveNoteIndexed: IndexStoreService['moveIndexed'] = (from, to, fileGeneration) =>
  defaultIndexStore().moveIndexed(from, to, fileGeneration)

/** `defaultIndexStore().reconcileScan`. */
export const reconcileScan: IndexStoreService['reconcileScan'] = (generation) =>
  defaultIndexStore().reconcileScan(generation)

/** `defaultIndexStore().touch`. */
export const touchIndexedNotes: IndexStoreService['touch'] = (entries, generation) =>
  defaultIndexStore().touch(entries, generation)

/** `defaultIndexStore().clear`. */
export const clearIndex: IndexStoreService['clear'] = (generation) =>
  defaultIndexStore().clear(generation)

/** `defaultIndexStore().setMeta`. */
export const setIndexMeta: IndexStoreService['setMeta'] = (key, value, generation) =>
  defaultIndexStore().setMeta(key, value, generation)
