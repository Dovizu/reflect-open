import type { AppPlatform } from './platform.ts'

/**
 * The Tauri build targets the app ships for.
 */
export type BuildPlatform = 'darwin' | 'windows' | 'linux' | 'ios' | 'android'

/**
 * How the running surface differs from stock desktop.
 */
export interface PlatformSurface {
  /**
   * Editors apply touch text-input hygiene (the mobile app).
   */
  readonly touchEditor: boolean
  /**
   * Shared components render their mobile variants (the mobile app).
   */
  readonly mobileApp: boolean
}

// FIXME 这个文件叫做 platform-service.ts 但是这个文件里面并没有提供一个 service，我怀疑是 packages/core/src/app/platform-service.ts packages/app/src/app/platform-service.ts 这两个文件的迁移过程中出现了一些问题。请你评估一下这个文件适不适合 叫做 platform-service.ts ，如果不适合的话，请你帮我把它改成一个更合适的名字或者放到其他文件里。发散一下，看看整个代码仓库中有没有类似的问题，一起修复了。

/**
 * What the host is and can do, decided once by the app at startup.
 */
export interface PlatformFacts {
  /**
   * Which UI family the app runs.
   */
  readonly appPlatform: AppPlatform
  /**
   * A real native shell (plugins, OS windows) exists; false in browser dev.
   */
  readonly isNativeShell: boolean
  /**
   * The Tauri build target; null outside a Tauri build.
   */
  readonly buildPlatform: BuildPlatform | null
  /**
   * The macOS desktop shell (not iPadOS, not browser dev).
   */
  readonly isMacosDesktop: boolean
  /**
   * Mod renders as ⌘ rather than Ctrl.
   */
  readonly isApplePlatform: boolean
  /**
   * The window draws content under a transparent macOS title bar.
   */
  readonly hasMacosTitleBarOverlay: boolean
  readonly surface: PlatformSurface
  readonly isDev: boolean
  readonly appVersion: string
}

/**
 * Maps a file path to the webview URL serving it through a custom URI scheme.
 */
export type FileSrcConverter = (filePath: string, protocol: string) => string

/**
 * Where a service turns a file path into the webview URL that serves it.
 */
export interface FileSrcSource {
  /**
   * The webview URL that serves `filePath` through the custom URI scheme
   * `protocol`, such as `reflect-asset`.
   */
  convertFileSrc(filePath: string, protocol: string): string
}

/**
 * The custom-scheme URL shape Tauri uses on macOS and iOS.
 */
export function appleFileSrc(filePath: string, protocol: string): string {
  return `${protocol}://localhost/${encodeURIComponent(filePath)}`
}
