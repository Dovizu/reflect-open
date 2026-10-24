import { useCallback, useState } from 'react'
import { errorMessage, type ConnectHostInput } from '@reflect/core'
import { useGitSync } from '@/providers/sync-provider.tsx'

export interface UseConnectHostSubmitValue {
  pending: boolean
  /** The host's refusal, or the connector's own check, shown inline. */
  submitError: string | null
  /** Probe the host with the sign-in, store it, and connect; `onDone` on success. */
  submit: (input: ConnectHostInput) => Promise<void>
}

/**
 * The "Other host" submit flow, shared by the desktop dialog and the mobile
 * sheet (the one-hook-two-shells pattern): the graph's host connector
 * checks the sign-in with the host before it stores anything, so a refusal
 * lands inline with the fields intact and nothing saved.
 */
export function useConnectHostSubmit({
  onDone,
}: {
  onDone: () => void
}): UseConnectHostSubmitValue {
  const { connectHost } = useGitSync()
  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submit = useCallback(
    async (input: ConnectHostInput): Promise<void> => {
      setSubmitError(null)
      setPending(true)
      try {
        await connectHost(input)
        onDone()
      } catch (error: unknown) {
        setSubmitError(errorMessage(error))
      } finally {
        setPending(false)
      }
    },
    [connectHost, onDone],
  )

  return { pending, submitError, submit }
}
