import type { ReactElement } from 'react'
import { ConnectGitHostForm } from '@/components/settings/connect-git-host-form.tsx'
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
import { useConnectGitHostSubmit } from '@/hooks/use-connect-git-host-submit.ts'

interface ConnectGitHostDialogProps {
  /**
   * The remote to prefill: an HTTPS remote that needs a sign-in. Empty for
   * a new connection.
   */
  remoteUrl?: string | undefined
  onClose: () => void
}

/**
 * The desktop "Other host" dialog: connect this graph to a repository on any
 * https git host with a username and an access token or password. The host
 * answers before anything is stored, so a wrong address or sign-in fails
 * here, inline.
 */
export function ConnectGitHostDialog({
  remoteUrl,
  onClose,
}: ConnectGitHostDialogProps): ReactElement {
  const flow = useConnectGitHostSubmit({ onDone: onClose })

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen && !flow.pending) {
          onClose()
        }
      }}
    >
      <DialogContent showCloseButton={!flow.pending} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{remoteUrl === undefined ? 'Other host' : 'Update sign-in'}</DialogTitle>
          <DialogDescription>
            Reflect checks the sign-in with the host before it stores anything.
          </DialogDescription>
        </DialogHeader>
        <ConnectGitHostForm
          remoteUrl={remoteUrl}
          flow={flow}
          actions={({ pending, canSubmit }) => (
            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="ghost" size="sm" disabled={pending}>
                    Cancel
                  </Button>
                }
              />
              <Button type="submit" size="sm" disabled={!canSubmit}>
                {pending ? 'Connecting…' : 'Connect'}
              </Button>
            </DialogFooter>
          )}
        />
      </DialogContent>
    </Dialog>
  )
}
