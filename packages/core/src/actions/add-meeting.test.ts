import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensurePersonNote } from '../contacts/person.ts'
import { createNoteWithTitle } from '../graph/create-note.ts'
import { setDefaultNoteFile } from '../graph/note-file-service.ts'
import { resolveWikiTarget } from '../indexing/queries.ts'
import { setBridge } from '../ipc/bridge.ts'
import { resolved, unresolved } from '../markdown/resolve.ts'
import { createTestNoteFileService, type TestNoteFileService } from '../testing/index.ts'
import { addMeetingToDaily, meetingLine, type AddMeetingInput } from './add-meeting.ts'
import { resolveMeetingAttendeeTargets, type MeetingAttendee } from './resolve-attendees.ts'

vi.mock('../contacts/person', () => ({
  ensurePersonNote: vi.fn(),
}))
vi.mock('../graph/create-note', () => ({
  createNoteWithTitle: vi.fn(),
}))
vi.mock('../indexing/queries', () => ({
  resolveWikiTarget: vi.fn(),
}))
vi.mock('./resolve-attendees', () => ({
  resolveMeetingAttendeeTargets: vi.fn(),
}))

const ensurePersonMock = vi.mocked(ensurePersonNote)
const createNoteMock = vi.mocked(createNoteWithTitle)
const resolveWikiTargetMock = vi.mocked(resolveWikiTarget)
const resolveAttendeesMock = vi.mocked(resolveMeetingAttendeeTargets)

const DAILY = 'daily/2026-07-01.md'
const GENERATION = 3

let noteFile: TestNoteFileService

function input(overrides: Partial<AddMeetingInput> = {}): AddMeetingInput {
  return {
    date: '2026-07-01',
    title: 'Standup',
    attendees: [],
    backlinkMeeting: true,
    generation: GENERATION,
    ...overrides,
  }
}

function newTargets(attendees: readonly MeetingAttendee[]) {
  return attendees.map((attendee) => ({
    kind: 'new' as const,
    attendee,
    insertText: attendee.name,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  noteFile = createTestNoteFileService()
  setDefaultNoteFile(noteFile)
  createNoteMock.mockImplementation(async (title: string) => `notes/${title.toLowerCase()}.md`)
  resolveWikiTargetMock.mockImplementation(async (target) => unresolved(target))
  resolveAttendeesMock.mockImplementation(async (attendees) => newTargets(attendees))
  ensurePersonMock.mockImplementation(async ({ title }) => ({
    kind: 'created',
    path: `notes/${title.toLowerCase()}.md`,
  }))
})

afterEach(() => {
  setDefaultNoteFile(null)
})

describe('meetingLine', () => {
  // The bullet marker belongs to the list the entry lands in, so it is not
  // part of the rendered text here.
  it('renders linked and plain attendees', () => {
    expect(
      meetingLine({
        title: 'Standup',
        attendees: [
          { kind: 'linked', insertText: 'Ada Lovelace' },
          { kind: 'plain', text: 'Shared inbox' },
        ],
        backlinkMeeting: true,
        startTime: '9:00am',
      }),
    ).toBe('9:00am met with [[Ada Lovelace]], Shared inbox for [[Standup]]')
  })

  it('shortens attendee-less events and supports a plain meeting title', () => {
    expect(
      meetingLine({
        title: 'Standup',
        attendees: [],
        backlinkMeeting: true,
        startTime: '9:00am',
      }),
    ).toBe('9:00am [[Standup]]')
    expect(
      meetingLine({
        title: 'Standup',
        attendees: [{ kind: 'linked', insertText: 'Ada Lovelace' }],
        backlinkMeeting: false,
      }),
    ).toBe('Met with [[Ada Lovelace]] for Standup')
  })
})

describe('addMeetingToDaily', () => {
  it('writes the daily line before creating missing notes', async () => {
    let dailyWritesBeforePerson = 0
    ensurePersonMock.mockImplementation(async () => {
      dailyWritesBeforePerson = noteFile.getWrites(DAILY).length
      return { kind: 'created', path: 'notes/ada.md' }
    })

    const outcome = await addMeetingToDaily(
      input({
        attendees: [
          {
            name: 'Ada Lovelace',
            emails: ['ada@example.com'],
          },
        ],
        backlinkMeeting: false,
        startTime: '9:00am',
      }),
    )

    expect(dailyWritesBeforePerson).toBe(1)
    expect(noteFile.writes()).toEqual([
      {
        path: DAILY,
        contents: '## Meetings\n\n- 9:00am met with [[Ada Lovelace]] for Standup\n',
        generation: GENERATION,
      },
    ])
    expect(ensurePersonMock).toHaveBeenCalledWith({
      title: 'Ada Lovelace',
      emails: ['ada@example.com'],
      body: '- Type: #person\n- Email: ada@example.com',
      generation: GENERATION,
    })
    expect(outcome).toEqual({
      appended: true,
      createdNotes: ['Ada Lovelace'],
    })
  })

  it('appends to an existing Meetings section of a non-empty daily', async () => {
    noteFile.set(DAILY, 'Some notes\n\n## Meetings\n\n- [[Kickoff]]\n\n## Later\n\nx\n')
    await addMeetingToDaily(input())
    const written = noteFile.getWrites(DAILY)[0]
    expect(written).toContain('## Meetings\n\n- [[Kickoff]]\n- [[Standup]]')
    expect(written).toContain('## Later')
  })

  it('extends only the leading Meetings list, before later daily-note prose', async () => {
    noteFile.set(DAILY, '## Meetings\n\n- [[Kickoff]]\n- [[Planning]]\n\nScratchpad for later.\n')

    await addMeetingToDaily(input())

    expect(noteFile.writes()).toEqual([
      {
        path: DAILY,
        contents:
          '## Meetings\n\n- [[Kickoff]]\n- [[Planning]]\n- [[Standup]]\n\nScratchpad for later.\n',
        generation: GENERATION,
      },
    ])
  })

  it('recognizes the day’s meeting under a linked Meetings heading, where insertion files it', async () => {
    noteFile.set(DAILY, '## [[Meetings]]\n\n- 9:00am met with [[Ada Lovelace]] for [[Standup]]\n')

    await expect(addMeetingToDaily(input({ attendees: [{ name: 'Carol' }] }))).resolves.toEqual({
      appended: false,
      createdNotes: [],
    })
    expect(noteFile.writes()).toEqual([])
  })

  it('is a full no-op when the meeting is already linked that day', async () => {
    noteFile.set(DAILY, '## Meetings\n\n- 9:00am met with [[Ada Lovelace]] for [[Standup]]\n')

    await expect(addMeetingToDaily(input({ attendees: [{ name: 'Carol' }] }))).resolves.toEqual({
      appended: false,
      createdNotes: [],
    })
    expect(noteFile.writes()).toEqual([])
    expect(resolveAttendeesMock).not.toHaveBeenCalled()
    expect(ensurePersonMock).not.toHaveBeenCalled()
  })

  it('does not treat a nested Meetings heading as the daily meeting section', async () => {
    noteFile.set(DAILY, '> ## Meetings\n> - [[Standup]]\n')

    const outcome = await addMeetingToDaily(input())

    expect(outcome.appended).toBe(true)
    expect(noteFile.writes()).toEqual([
      {
        path: DAILY,
        contents: '> ## Meetings\n>\n> - [[Standup]]\n\n## Meetings\n\n- [[Standup]]\n',
        generation: GENERATION,
      },
    ])
  })

  it('recognizes an aliased meeting link in the Meetings section', async () => {
    noteFile.set(DAILY, '## Meetings\n\n- [[STANDUP|Daily sync]]\n')

    await expect(addMeetingToDaily(input())).resolves.toEqual({
      appended: false,
      createdNotes: [],
    })
  })

  it('matches a link whose alias (not target) carries the meeting name', async () => {
    noteFile.set(DAILY, '## Meetings\n\n- [[Standup|Daily sync]]\n')
    const outcome = await addMeetingToDaily(input({ title: 'Daily sync' }))
    expect(outcome.appended).toBe(false)
    expect(noteFile.writes()).toEqual([])
  })

  it('still appends when the title is only linked outside the Meetings section', async () => {
    noteFile.set(DAILY, 'Prep notes for [[Standup]] tomorrow.\n')
    const outcome = await addMeetingToDaily(input())
    expect(outcome.appended).toBe(true)
    const written = noteFile.getWrites(DAILY)[0]
    expect(written).toContain('## Meetings\n\n- [[Standup]]')
  })

  it('an un-backlinked meeting always appends, like v1 (plain text has no link to match)', async () => {
    noteFile.set(DAILY, '## Meetings\n\n- [[Standup]]\n')
    const outcome = await addMeetingToDaily(input({ backlinkMeeting: false }))
    expect(outcome.appended).toBe(true)
    const written = noteFile.getWrites(DAILY)[0]
    expect(written).toContain('- [[Standup]]\n- Standup')
  })

  it('creates a missing backlinked meeting note only', async () => {
    await addMeetingToDaily(input({ backlinkMeeting: false }))
    expect(createNoteMock).not.toHaveBeenCalled()

    await addMeetingToDaily(input())
    expect(createNoteMock).toHaveBeenCalledWith('Standup', GENERATION, '- Type: #meeting')

    createNoteMock.mockClear()
    resolveWikiTargetMock.mockResolvedValue(resolved('notes/standup.md'))
    await addMeetingToDaily(input())
    expect(createNoteMock).not.toHaveBeenCalled()
  })

  it('deduplicates attendee display names and removes the meeting itself', async () => {
    await addMeetingToDaily(
      input({
        attendees: [
          { name: 'Ada Lovelace' },
          { name: 'ada lovelace' },
          { name: '' },
          { name: 'Standup' },
        ],
        backlinkMeeting: false,
      }),
    )

    expect(noteFile.writes()).toEqual([
      {
        path: DAILY,
        contents: '## Meetings\n\n- Met with [[Ada Lovelace]] for Standup\n',
        generation: GENERATION,
      },
    ])
    expect(ensurePersonMock).toHaveBeenCalledTimes(1)
  })

  it('rejects an empty meeting name before writing', async () => {
    await expect(addMeetingToDaily(input({ title: '  [|]  ' }))).rejects.toThrow(
      'a meeting needs a name',
    )
    expect(noteFile.writes()).toEqual([])
  })
})

describe('attendee identity outcomes', () => {
  it('reuses an existing owner and does not create', async () => {
    resolveAttendeesMock.mockResolvedValue([
      {
        kind: 'existing',
        attendee: {
          name: 'Jane Doe',
          emails: ['jane@corp.com'],
        },
        insertText: 'Jane Doe',
      },
    ])

    const outcome = await addMeetingToDaily(
      input({
        attendees: [
          {
            name: 'jane@corp.com',
            emails: ['jane@corp.com'],
          },
        ],
        backlinkMeeting: false,
      }),
    )

    expect(noteFile.writes()).toEqual([
      {
        path: DAILY,
        contents: '## Meetings\n\n- Met with [[Jane Doe]] for Standup\n',
        generation: GENERATION,
      },
    ])
    expect(ensurePersonMock).not.toHaveBeenCalled()
    expect(outcome.createdNotes).toEqual([])
  })

  it.each(['identity conflict', 'unaddressable owner'])(
    'writes a %s as plain text without creating',
    async () => {
      resolveAttendeesMock.mockResolvedValue([
        {
          kind: 'plain',
          attendee: {
            name: 'Jane Doe',
            emails: ['jane@corp.com'],
          },
        },
      ])

      await addMeetingToDaily(
        input({
          attendees: [
            {
              name: 'Jane Doe',
              emails: ['jane@corp.com'],
            },
          ],
          backlinkMeeting: false,
        }),
      )

      expect(noteFile.writes()).toEqual([
        {
          path: DAILY,
          contents: '## Meetings\n\n- Met with Jane Doe for Standup\n',
          generation: GENERATION,
        },
      ])
      expect(ensurePersonMock).not.toHaveBeenCalled()
    },
  )

  it('fails before writing when identity resolution fails', async () => {
    resolveAttendeesMock.mockRejectedValue(new Error('index unavailable'))

    await expect(
      addMeetingToDaily(
        input({
          attendees: [
            {
              name: 'Jane',
              emails: ['jane@corp.com'],
            },
          ],
        }),
      ),
    ).rejects.toThrow('index unavailable')
    expect(noteFile.writes()).toEqual([])
  })

  it('accepts a race that blocks creation after the daily write', async () => {
    ensurePersonMock.mockResolvedValue({
      kind: 'blocked',
      emails: ['ada@example.com'],
      reason: 'identity-conflict',
    })

    const outcome = await addMeetingToDaily(
      input({
        attendees: [
          {
            name: 'Ada Lovelace',
            emails: ['ada@example.com'],
          },
        ],
        backlinkMeeting: false,
      }),
    )

    expect(noteFile.writes()).toHaveLength(1)
    expect(outcome.createdNotes).toEqual([])
  })
})

describe('Contact prefill', () => {
  const ADA = {
    name: 'Ada Lovelace',
    emails: ['ada@example.com'],
  }

  function installContactsBridge(contacts: unknown[]): ReturnType<typeof vi.fn> {
    const invoke = vi.fn(async () => contacts)
    setBridge({ invoke, listen: async () => () => {} })
    return invoke
  }

  afterEach(() => {
    setBridge(null)
  })

  it('uses Contact details as the new note body', async () => {
    const invoke = installContactsBridge([
      {
        fullName: 'Ada Lovelace',
        givenName: 'Ada',
        familyName: 'Lovelace',
        emails: ['ada@example.com', 'ada@work.example'],
        phones: ['+1 555-0100'],
      },
    ])

    await addMeetingToDaily(input({ attendees: [ADA], lookupContacts: true }))

    expect(invoke).toHaveBeenCalledWith('contacts_lookup_by_email', { email: 'ada@example.com' })
    expect(ensurePersonMock).toHaveBeenCalledWith({
      title: 'Ada Lovelace',
      emails: ['ada@example.com'],
      body: '- Type: #person\n- Email: ada@example.com\n- Phone: +1 555-0100',
      generation: GENERATION,
    })
  })

  it('persists attendee emails without touching Contacts when the gate is off', async () => {
    const invoke = installContactsBridge([])

    await addMeetingToDaily(input({ attendees: [ADA] }))

    expect(invoke).not.toHaveBeenCalled()
    expect(ensurePersonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        emails: ['ada@example.com'],
        body: '- Type: #person\n- Email: ada@example.com',
      }),
    )
  })
})
