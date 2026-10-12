import { act } from 'react'
import { renderHook } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultAudioRecorder } from '@reflect/core'
import {
  createTestAudioRecorderService,
  type TestAudioRecorderService,
} from '@reflect/core/testing'
import {
  claimStagedPath,
  isStagedPathClaimed,
  releaseStagedPath,
  stopActiveRecording,
  useNativeAudioRecorder,
  type NativeRecordingPart,
} from './use-native-audio-recorder.ts'

/** Every session in these tests starts here; its segments share the stamp. */
const SESSION_STARTED_MS = 1_700_000_000_000
const START_OPTIONS = { segmentMs: 20 * 60_000, reminderMs: 30 * 60_000 }

let recorder: TestAudioRecorderService
let segments: NativeRecordingPart[]
let nativeStops: Array<NativeRecordingPart | null>

async function renderRecorder() {
  return await renderHook(() =>
    useNativeAudioRecorder({
      ...START_OPTIONS,
      onSegment: (part) => {
        segments.push(part)
      },
      onNativeStop: (part) => {
        nativeStops.push(part)
      },
    }),
  )
}

beforeEach(() => {
  recorder = createTestAudioRecorderService({ sessionStartedMs: SESSION_STARTED_MS })
  setDefaultAudioRecorder(recorder)
  segments = []
  nativeStops = []
})

afterEach(() => {
  setDefaultAudioRecorder(null)
})

describe('useNativeAudioRecorder', () => {
  it('start passes the segment and reminder lengths and reports the session start', async () => {
    const { result } = await renderRecorder()
    expect(result.current.status).toBe('idle')

    const started: Array<Date | null> = []
    await act(async () => {
      started.push(await result.current.start())
    })

    expect(recorder.calls()).toEqual([{ method: 'start', options: START_OPTIONS }])
    expect(started).toEqual([new Date(SESSION_STARTED_MS)])
    expect(result.current.status).toBe('recording')
  })

  it('a rotated segment reaches onSegment as a staged part', async () => {
    const path = '/staging/recording-1700000000000.part-001.m4a'
    await renderRecorder()

    act(() => {
      recorder.emitSegment({
        audio: { kind: 'staged', path },
        mimeType: 'audio/mp4',
        sessionStartedMs: SESSION_STARTED_MS,
        part: 1,
        end: false,
      })
    })

    expect(segments).toEqual([
      { stagedPath: path, recordedAt: new Date(SESSION_STARTED_MS), part: 1, end: false },
    ])
  })

  it('stop hands back the final segment and returns to idle', async () => {
    const path = '/staging/stop-normal.m4a'
    recorder.setStopResult({
      audio: { kind: 'staged', path },
      mimeType: 'audio/mp4',
      sessionStartedMs: SESSION_STARTED_MS,
      part: 2,
      end: true,
      durationMs: 4000,
    })
    const { result } = await renderRecorder()
    await act(async () => {
      await result.current.start()
    })

    const stopped: Array<NativeRecordingPart | null> = []
    await act(async () => {
      stopped.push(await result.current.stop())
    })

    // The memo's identity timestamp is the session's start, not wall clock.
    expect(stopped).toEqual([
      { stagedPath: path, recordedAt: new Date(SESSION_STARTED_MS), part: 2, end: true },
    ])
    expect(result.current.status).toBe('idle')
  })

  it('stop while idle resolves null without stopping the recorder', async () => {
    const { result } = await renderRecorder()

    const stopped: Array<NativeRecordingPart | null> = []
    await act(async () => {
      stopped.push(await result.current.stop())
    })

    expect(stopped).toEqual([null])
    expect(recorder.calls()).toEqual([])
  })

  it('level events feed the waveform and reset when the session ends', async () => {
    const { result } = await renderRecorder()
    await act(async () => {
      await result.current.start()
    })

    act(() => {
      recorder.emitLevel({ level: 0.5, elapsedMs: 1200 })
    })
    expect(result.current.level).toBe(0.5)
    expect(result.current.elapsedMs).toBe(1200)

    await act(async () => {
      await result.current.cancel()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.level).toBe(0)
    expect(result.current.elapsedMs).toBe(0)
  })

  it('a native stop hands the final part, or null, to onNativeStop', async () => {
    const path = '/staging/native-stop.m4a'
    const { result } = await renderRecorder()
    await act(async () => {
      await result.current.start()
    })

    act(() => {
      recorder.emitStopped({
        segment: {
          audio: { kind: 'staged', path },
          mimeType: 'audio/mp4',
          sessionStartedMs: SESSION_STARTED_MS,
          part: 3,
          end: true,
          durationMs: 5000,
        },
        reason: 'interruption',
      })
      recorder.emitStopped({ segment: null, reason: 'interruption' })
    })

    expect(result.current.status).toBe('idle')
    expect(nativeStops).toEqual([
      { stagedPath: path, recordedAt: new Date(SESSION_STARTED_MS), part: 3, end: true },
      null,
    ])
  })

  it('the module helpers act on the process-wide recorder', async () => {
    const path = '/staging/claimed.m4a'
    claimStagedPath(path)
    expect(recorder.isStagedClaimed(path)).toBe(true)
    expect(isStagedPathClaimed(path)).toBe(true)
    releaseStagedPath(path)
    expect(isStagedPathClaimed(path)).toBe(false)

    await expect(stopActiveRecording()).resolves.toBeNull()
    expect(recorder.calls()).toEqual([{ method: 'stop' }])
  })

  it('unmount detaches from the recorder', async () => {
    const { unmount } = await renderRecorder()
    await unmount()

    recorder.emitStopped({ segment: null, reason: 'interruption' })

    await vi.waitFor(() => expect(nativeStops).toEqual([]))
  })
})
