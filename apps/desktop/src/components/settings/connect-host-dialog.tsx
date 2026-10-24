import type { ReactElement } from 'react'
import { InlineAlert } from '@/components/inline-alert.tsx'
import { ConnectHostFields } from '@/components/settings/connect-host-fields.tsx'
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
import { useConnectHost } from '@/hooks/use-connect-host.ts'

interface ConnectHostDialogProps {
  /**
   * The remote to prefill: an HTTPS remote that needs a sign-in. Empty for
   * a new connection.
   */
  remoteUrl?: string | undefined
  onClose: () => void
}

/**
 * The desktop "Other host" dialog: connect this graph to a repository on any
 * https git host with a username and an access token. The host answers
 * before anything is stored, so a wrong address or token fails here, inline.
 */
export function ConnectHostDialog({ remoteUrl, onClose }: ConnectHostDialogProps): ReactElement {
  const form = useConnectHost(remoteUrl ?? '')
  const updating = remoteUrl !== undefined

  async function submit(): Promise<void> {
    if (await form.submit()) {
      onClose()
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen && !form.pending) {
          onClose()
        }
      }}
    >
      <DialogContent showCloseButton={!form.pending} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{updating ? 'Update sign-in' : 'Other host'}</DialogTitle>
          <DialogDescription>
            {/*FIXME: just use one single and simple message. do not display different messages for updating and creating */}
            {updating
              ? 'Enter the username and access token for this repository.'
              : 'Reflect checks the sign-in with the host before it stores anything.'}
          </DialogDescription>
        </DialogHeader>
        <ConnectHostFields form={form} onSubmit={() => void submit()} />
        {form.error !== null ? <InlineAlert tone="error">{form.error}</InlineAlert> : null}
        <DialogFooter>
          <DialogClose
            render={
              <Button variant="ghost" size="sm" disabled={form.pending}>
                Cancel
              </Button>
            }
          />
          <Button
            size="sm"
            disabled={form.pending || form.addressNote !== null}
            onClick={() => void submit()}
          >
            {form.pending ? 'Connecting…' : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
