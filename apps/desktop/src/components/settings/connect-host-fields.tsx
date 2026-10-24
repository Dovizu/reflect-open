import { useId, type ReactElement } from 'react'
import { Input } from '@/components/ui/input.tsx'
import type { ConnectHostForm } from '@/hooks/use-connect-host.ts'

interface ConnectHostFieldsProps {
  form: ConnectHostForm
  /** Submit on Enter in any field. */
  onSubmit: () => void
}

const FIELD_LABEL_CLASS = 'text-xs font-medium text-text-secondary'

/**
 * The three inputs of the "Other host" form, shared by desktop's dialog and
 * mobile's drawer: the repository's https address, the username, and the
 * access token the host issued. No help text: each mistake gets its own
 * message when it happens.
 */
export function ConnectHostFields({ form, onSubmit }: ConnectHostFieldsProps): ReactElement {
  const urlId = useId()
  const usernameId = useId()
  const tokenId = useId()

  function submitOnEnter(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' && !form.pending) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={urlId} className="flex flex-col gap-1">
        <span className={FIELD_LABEL_CLASS}>Repository address</span>
        <Input
          id={urlId}
          autoFocus
          value={form.remoteUrl}
          placeholder="https://…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => form.setRemoteUrl(event.target.value)}
          onKeyDown={submitOnEnter}
        />
        {form.addressNote !== null ? (
          <span className="text-xs text-red-700 dark:text-red-300">{form.addressNote}</span>
        ) : null}
      </label>
      <label htmlFor={usernameId} className="flex flex-col gap-1">
        <span className={FIELD_LABEL_CLASS}>Username</span>
        <Input
          id={usernameId}
          value={form.username}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => form.setUsername(event.target.value)}
          onKeyDown={submitOnEnter}
        />
      </label>
      <label htmlFor={tokenId} className="flex flex-col gap-1">
        <span className={FIELD_LABEL_CLASS}>Access token</span>
        <Input
          id={tokenId}
          type="password"
          placeholder="A token with write access to the repository"
          value={form.token}
          onChange={(event) => form.setToken(event.target.value)}
          onKeyDown={submitOnEnter}
        />
      </label>
    </div>
  )
}
