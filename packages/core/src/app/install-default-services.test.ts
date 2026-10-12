import { afterEach, describe, expect, it } from 'vitest'
import { defaultIpc, getBridge, hasBridge } from '../ipc/bridge.ts'
import { defaultCalendar } from '../calendar/calendar-service.ts'
import { defaultContacts } from '../contacts/contacts-service.ts'
import { defaultMobileStorage } from '../ipc/mobile-storage-service.ts'
import { defaultSecretStore } from '../secrets/secret-store-service.ts'
import { createTestAppServices } from '../testing/services.ts'
import { defaultAgentSkill } from './agent-skill-service.ts'
import { defaultAppInfo } from './app-info-service.ts'
import { defaultClipboard } from './clipboard-service.ts'
import { defaultClock } from './clock-service.ts'
import { defaultDialog } from './dialog-service.ts'
import { defaultExceptionTelemetry } from './exception-telemetry-service.ts'
import { defaultHashService } from './hash-service.ts'
import { defaultHttp } from './http-service.ts'
import { defaultIdService } from './id-service.ts'
import { defaultImageCodec } from './image-codec-service.ts'
import { installDefaultServices, resetDefaultServices } from './install-default-services.ts'
import { defaultLifecycle } from './lifecycle-service.ts'
import { defaultLogger } from './logger-service.ts'
import { defaultOperations } from './operations-service.ts'
import { defaultOpener } from './opener-service.ts'
import { defaultPath } from './path-service.ts'
import { defaultPlatform } from './platform-service.ts'
import { defaultStorage } from './storage-service.ts'
import { defaultWindow } from './window-service.ts'

afterEach(() => {
  resetDefaultServices()
})

describe('installDefaultServices', () => {
  it('points every default at the composed services', () => {
    const services = createTestAppServices()
    installDefaultServices(services)
    expect(defaultIpc()).toBe(services.ipc)
    expect(getBridge()).toBe(services.ipc.transport)
    expect(defaultLogger()).toBe(services.logger)
    expect(defaultClock()).toBe(services.clock)
    expect(defaultIdService()).toBe(services.id)
    expect(defaultHashService()).toBe(services.hash)
    expect(defaultPlatform()).toBe(services.platform)
    expect(defaultStorage()).toBe(services.storage)
    expect(defaultHttp()).toBe(services.http)
    expect(defaultDialog()).toBe(services.dialog)
    expect(defaultClipboard()).toBe(services.clipboard)
    expect(defaultOpener()).toBe(services.opener)
    expect(defaultPath()).toBe(services.path)
    expect(defaultWindow()).toBe(services.window)
    expect(defaultLifecycle()).toBe(services.lifecycle)
    expect(defaultSecretStore()).toBe(services.secretStore)
    expect(defaultAppInfo()).toBe(services.appInfo)
    expect(defaultCalendar()).toBe(services.calendar)
    expect(defaultContacts()).toBe(services.contacts)
    expect(defaultAgentSkill()).toBe(services.agentSkill)
    expect(defaultMobileStorage()).toBe(services.mobileStorage)
    expect(defaultImageCodec()).toBe(services.imageCodec)
    expect(defaultExceptionTelemetry()).toBe(services.exceptionTelemetry)
    expect(defaultOperations()).toBe(services.operations)
  })
})

describe('resetDefaultServices', () => {
  it('drops every installed service', () => {
    const services = createTestAppServices()
    installDefaultServices(services)
    resetDefaultServices()
    expect(hasBridge()).toBe(false)
    expect(defaultLogger()).not.toBe(services.logger)
    expect(defaultClock()).not.toBe(services.clock)
    expect(defaultPlatform()).not.toBe(services.platform)
    expect(defaultWindow()).not.toBe(services.window)
    expect(defaultCalendar()).not.toBe(services.calendar)
    expect(defaultImageCodec()).not.toBe(services.imageCodec)
    expect(defaultExceptionTelemetry()).not.toBe(services.exceptionTelemetry)
    expect(defaultOperations()).not.toBe(services.operations)
    expect(() => defaultDialog()).toThrow(/No DialogService/)
    expect(() => defaultClipboard()).toThrow(/No ClipboardService/)
    expect(() => defaultOpener()).toThrow(/No OpenerService/)
  })
})
