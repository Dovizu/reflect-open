import type { ReactElement, ReactNode } from 'react'
import { useFormContext, useFormState } from 'react-hook-form'
import { classifyRemote, type ConnectGitHostInput } from '@reflect/core'
import { InlineAlert } from '@/components/inline-alert.tsx'
import { Input } from '@/components/ui/input.tsx'

interface ConnectGitHostFieldsProps {
  /** The form's submit handler ({@link useConnectGitHostForm}). */
  onSubmit: (event?: React.BaseSyntheticEvent) => Promise<void>
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
 * The "Other host" fields, shared by desktop's dialog and mobile's drawer,
 * inside the `FormProvider` of {@link useConnectGitHostForm}: the
 * repository's https address, the username, and the access token or
 * password the host takes. No help text: each mistake gets its own message
 * when it happens.
 */
export function ConnectGitHostFields({
  onSubmit,
  actions,
}: ConnectGitHostFieldsProps): ReactElement {
  const { register } = useFormContext<ConnectGitHostInput>()
  // Nested in a `FormProvider`, the form state is subscribed through this hook.
  const { isSubmitting: pending, errors } = useFormState<ConnectGitHostInput>()
  const addressError = errors.remoteUrl?.message
  const refusal = errors.root?.message

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        void onSubmit(event)
      }}
    >
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-3">
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
      {refusal !== undefined ? <InlineAlert tone="error">{refusal}</InlineAlert> : null}
      {actions({ pending, canSubmit: !pending && addressError === undefined })}
    </form>
  )
}
