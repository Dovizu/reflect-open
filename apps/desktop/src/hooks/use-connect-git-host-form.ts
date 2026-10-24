import { useForm, type UseFormReturn } from 'react-hook-form'
import { errorMessage, type ConnectGitHostInput } from '@reflect/core'
import { useGitSync } from '@/providers/sync-provider.tsx'

export interface ConnectGitHostForm {
  /** The form, for a `FormProvider` around {@link ConnectGitHostFields}. */
  form: UseFormReturn<ConnectGitHostInput>
  /** The form's submit handler: probe the host, store the sign-in, connect. */
  submit: (event?: React.BaseSyntheticEvent) => Promise<void>
}

/**
 * The "Other host" form, shared by the desktop dialog and the mobile sheet:
 * `react-hook-form` owns the fields, the pending state (`isSubmitting`) and
 * the host's refusal (the `root` error), so each shell only renders. The
 * graph's host connector checks the sign-in with the host before it stores
 * anything, so a refusal lands inline with the fields intact.
 */
export function useConnectGitHostForm({
  remoteUrl,
  onDone,
}: {
  /** The remote to prefill: a remote that is already set and needs a sign-in. */
  remoteUrl: string | undefined
  /** Called once the host accepted the sign-in and the graph is connected. */
  onDone: () => void
}): ConnectGitHostForm {
  const { connectGitHost } = useGitSync()
  const form = useForm<ConnectGitHostInput>({
    mode: 'onChange',
    defaultValues: { remoteUrl: remoteUrl ?? '', username: '', token: '' },
  })
  const submit = form.handleSubmit(async (values) => {
    form.clearErrors('root')
    try {
      await connectGitHost(values)
      onDone()
    } catch (error: unknown) {
      form.setError('root', { message: errorMessage(error) })
    }
  })
  return { form, submit }
}
