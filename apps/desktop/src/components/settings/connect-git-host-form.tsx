import type { ReactElement, ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { classifyRemote, type ConnectGitHostInput } from '@reflect/core'
import { InlineAlert } from '@/components/inline-alert.tsx'
import { Input } from '@/components/ui/input.tsx'
import type { UseConnectGitHostSubmitValue } from '@/hooks/use-connect-git-host-submit.ts'

interface ConnectGitHostFormProps {
  /** The remote to prefill: a remote that is already set and needs a sign-in. */
  remoteUrl?: string | undefined
  /** The submit flow of the shell ({@link useConnectGitHostSubmit}). */
  flow: UseConnectGitHostSubmitValue
  /**
   * The submit controls, rendered inside the form so Enter in any field
   * submits. `canSubmit` is false while pending or while the address is one
   * the form cannot take.
   */
  actions: (state: { pending: boolean; canSubmit: boolean }) => ReactNode
}

const FIELD_LABEL_CLASS = 'text-xs font-medium text-text-secondary'

const SSH_NOTE =
  'This is an SSH address; the form takes https. Add it with git and Reflect picks it up.'

/**
 * The "Other host" form, shared by desktop's dialog and mobile's drawer: the
 * repository's https address, the username, and the access token or
 * password the host takes. No help text: each mistake gets its own message
 * when it happens.
 */
export function ConnectGitHostForm({
  remoteUrl,
  flow,
  actions,
}: ConnectGitHostFormProps): ReactElement {
  const { register, handleSubmit, formState } = useForm<ConnectGitHostInput>({
    mode: 'onChange',
    defaultValues: { remoteUrl: remoteUrl ?? '', username: '', token: '' },
  })
  const addressError = formState.errors.remoteUrl?.message
  const submitForm = handleSubmit(flow.submit)

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        void submitForm(event)
      }}
    >
      <fieldset disabled={flow.pending} className="flex min-w-0 flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className={FIELD_LABEL_CLASS}>Repository address</span>
          <Input
            {...register('remoteUrl', {
              validate: (value) => classifyRemote(value.trim()).kind !== 'ssh' || SSH_NOTE,
            })}
            aria-invalid={addressError !== undefined || undefined}
            autoFocus
            placeholder="https://git.example.com/user/repo.git"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {addressError !== undefined ? (
            <span className="text-xs text-red-700 dark:text-red-300">{addressError}</span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1">
          <span className={FIELD_LABEL_CLASS}>Username</span>
          <Input
            {...register('username')}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={FIELD_LABEL_CLASS}>Access token or password</span>
          <Input {...register('token')} type="password" autoComplete="current-password" />
        </label>
      </fieldset>
      {flow.submitError !== null ? (
        <InlineAlert tone="error">{flow.submitError}</InlineAlert>
      ) : null}
      {actions({ pending: flow.pending, canSubmit: !flow.pending && addressError === undefined })}
    </form>
  )
}
