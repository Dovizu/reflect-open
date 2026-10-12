import { act } from 'react'
import { cleanup, renderHook } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setDefaultAudioRecorder } from '@reflect/core'
import {
  createTestAudioRecorderService,
  type TestAudioRecorderService,
} from '@reflect/core/testing'
import {
  isRecordingSupported,
  useAudioRecorder,
  type RecorderResult,
  type RecorderSegment,
} from './use-audio-recorder.ts'

const FINAL = {
  audio: { kind: 'blob', blob: new Blob(['audio-bytes']) },
  mimeType: 'audio/mp4',
  sessionStartedMs: 0,
  part: 2,
  end: true,
  durationMs: 3000,
} as const

let recorder: TestAudioRecorderService

beforeEach(() => {
  recorder = createTestAudioRecorderService()
  setDefaultAudioRecorder(recorder)
})

afterEach(async () => {
  await cleanup()
  setDefaultAudioRecorder(null)
})

describe('useAudioRecorder', () => {
  it('follows the recorder state and elapsed time', async () => {
    const { result } = await renderHook(() => useAudioRecorder())

    await act(async () => {
      await result.current.start()
    })
    expect(result.current.status).toBe('recording')

    act(() => {
      recorder.emitLevel({ level: 0, elapsedMs: 3000 })
    })
    expect(result.current.elapsedMs).toBe(3000)

    act(() => {
      result.current.cancel()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.elapsedMs).toBe(0)
  })

  it('starts without rotation or reminders unless asked', async () => {
    const { result } = await renderHook(() => useAudioRecorder())
    await act(async () => {
      await result.current.start()
    })

    expect(recorder.calls()[0]).toEqual({
      method: 'start',
      options: { segmentMs: Infinity, reminderMs: Infinity },
    })
  })

  it('hands rotated segments, reminders, and the final segment to the callbacks', async () => {
    const segments: RecorderSegment[] = []
    const reminders: number[] = []
    const { result } = await renderHook(() =>
      useAudioRecorder({
        segmentMs: 1000,
        reminderMs: 2000,
        onSegment: (segment) => {
          segments.push(segment)
        },
        onReminder: (elapsedMs) => {
          reminders.push(elapsedMs)
        },
      }),
    )
    await act(async () => {
      await result.current.start()
    })
    expect(recorder.calls()[0]).toEqual({
      method: 'start',
      options: { segmentMs: 1000, reminderMs: 2000 },
    })

    const rotated = new Blob(['first'])
    act(() => {
      recorder.emitSegment({
        audio: { kind: 'blob', blob: rotated },
        mimeType: 'audio/mp4',
        sessionStartedMs: 0,
        part: 1,
        end: false,
      })
      recorder.emitReminder(2000)
    })
    recorder.setStopResult(FINAL)
    const results: Array<RecorderResult | null> = []
    await act(async () => {
      results.push(await result.current.stop())
    })

    expect(segments).toEqual([
      { blob: rotated, mimeType: 'audio/mp4', part: 1, end: false },
      { blob: FINAL.audio.blob, mimeType: 'audio/mp4', part: 2, end: true },
    ])
    expect(reminders).toEqual([2000])
    expect(results).toEqual([{ mimeType: 'audio/mp4', durationMs: 3000, parts: 2 }])
    expect(result.current.status).toBe('idle')
  })

  it('concurrent stops share one result and hand the final segment over once', async () => {
    const segments: RecorderSegment[] = []
    const { result } = await renderHook(() =>
      useAudioRecorder({
        onSegment: (segment) => {
          segments.push(segment)
        },
      }),
    )
    await act(async () => {
      await result.current.start()
    })
    recorder.setStopResult(FINAL)

    const [first, second] = await act(async () => {
      return await Promise.all([result.current.stop(), result.current.stop()])
    })

    expect(second).toBe(first)
    expect(segments).toHaveLength(1)
  })

  it('a misclick stop resolves null without a segment', async () => {
    const segments: RecorderSegment[] = []
    const { result } = await renderHook(() =>
      useAudioRecorder({
        onSegment: (segment) => {
          segments.push(segment)
        },
      }),
    )
    await act(async () => {
      await result.current.start()
    })

    const stopped = await act(async () => await result.current.stop())

    expect(stopped).toBeNull()
    expect(segments).toEqual([])
  })

  it('unmount releases the microphone', async () => {
    const { result, unmount } = await renderHook(() => useAudioRecorder())
    await act(async () => {
      await result.current.start()
    })

    await unmount()

    expect(recorder.calls().at(-1)).toEqual({ method: 'cancel' })
    expect(recorder.state()).toBe('idle')
  })
})

describe('isRecordingSupported', () => {
  it('asks the process-wide recorder', () => {
    expect(isRecordingSupported()).toBe(true)
    setDefaultAudioRecorder(createTestAudioRecorderService({ supported: false }))
    expect(isRecordingSupported()).toBe(false)
  })
})
