import { useState, type ReactElement } from 'react'
import { Button } from '@/components/ui/button.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx'
import { useGithubConnected } from '@/hooks/use-github-connected.ts'
import { cn } from '@/lib/utils.ts'

/** Where a repository can be: GitHub, through the account, or any other git host, by address. */
export type RepositoryHost = 'github' | 'other'

interface ConnectRepositoryDialogProps {
  /** The host the user chose; the caller opens that host's own flow. */
  onChoose: (host: RepositoryHost) => void
  onClose: () => void
}

/**
 * The one door to a repository: a two-way choice, then the flow of the chosen
 * host. GitHub gets the connect wizard; any other host gets the address form.
 */
export function ConnectRepositoryDialog({
  onChoose,
  onClose,
}: ConnectRepositoryDialogProps): ReactElement {
  const githubConnected = useGithubConnected()
  const [host, setHost] = useState<RepositoryHost>('github')
  const options: { value: RepositoryHost; label: string; detail: string }[] = [
    {
      value: 'github',
      label: 'GitHub',
      detail: githubConnected
        ? 'Create a repository or pick one of yours.'
        : 'Sign in, then create a repository or pick one of yours.',
    },
    {
      value: 'other',
      label: 'Other host',
      detail:
        'Any git host that speaks https. You enter the address, a username and an access token or password.',
    },
  ]

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Connect a repository</DialogTitle>
          <DialogDescription>Where is the repository?</DialogDescription>
        </DialogHeader>
        <div
          role="radiogroup"
          aria-label="Where is the repository?"
          className="flex flex-col gap-2"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={host === option.value}
              onClick={() => setHost(option.value)}
              className={cn(
                'rounded-md border px-3 py-2 text-left transition-colors',
                host === option.value
                  ? 'border-accent ring-1 ring-accent'
                  : 'border-border hover:bg-surface-hover',
              )}
            >
              <span className="block text-sm font-medium text-text">{option.label}</span>
              <span className="block text-xs text-text-muted">{option.detail}</span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <DialogClose
            render={
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            }
          />
          <Button size="sm" onClick={() => onChoose(host)}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
