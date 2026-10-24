import { useCallback, useState } from 'react'
import { errorMessage, type ConnectGitHostInput } from '@reflect/core'
import { useGitSync } from '@/providers/sync-provider.tsx'

export interface UseConnectGitHostSubmitValue {
  pending: boolean
  /** The host's refusal, or the connector's own check, shown inline. */
  submitError: string | null
  /** Probe the host with the sign-in, store it, and connect; `onDone` on success. */
  submit: (input: ConnectGitHostInput) => Promise<void>
}

/**
 * The "Other host" submit flow, shared by the desktop dialog and the mobile
 * sheet (the one-hook-two-shells pattern): the graph's host connector
 * checks the sign-in with the host before it stores anything, so a refusal
 * lands inline with the fields intact and nothing saved.
 */
export function useConnectGitHostSubmit({
  onDone,
}: {
  onDone: () => void
}): UseConnectGitHostSubmitValue {
  const { connectGitHost } = useGitSync()
  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submit = useCallback(
    async (input: ConnectGitHostInput): Promise<void> => {
      setSubmitError(null)
      setPending(true)
      try {
        await connectGitHost(input)
        onDone()
      } catch (error: unknown) {
        setSubmitError(errorMessage(error))
      } finally {
        setPending(false)
      }
    },
    [connectGitHost, onDone],
  )

  return { pending, submitError, submit }
}
