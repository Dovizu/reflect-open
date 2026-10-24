import type { ReactElement } from 'react'
import { ConnectHostForm } from '@/components/settings/connect-host-form.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Drawer, DrawerBody, DrawerContent, DrawerTitle } from '@/components/ui/drawer.tsx'
import { useConnectHostSubmit } from '@/hooks/use-connect-host-submit.ts'

interface ConnectHostDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The remote to prefill: an HTTPS remote that needs a sign-in. */
  remoteUrl?: string | undefined
}

/**
 * The mobile "Other host" bottom sheet: a Drawer shell over
 * {@link useConnectHostSubmit}, the same form as desktop's dialog. The body
 * mounts per open cycle, so a dismissed half-filled form never leaks into
 * the next.
 */
export function ConnectHostDrawer({
  open,
  onOpenChange,
  remoteUrl,
}: ConnectHostDrawerProps): ReactElement {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-label="Other host">
        {open ? (
          <ConnectHostSheet remoteUrl={remoteUrl} onClose={() => onOpenChange(false)} />
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}

function ConnectHostSheet({
  remoteUrl,
  onClose,
}: {
  remoteUrl: string | undefined
  onClose: () => void
}): ReactElement {
  const flow = useConnectHostSubmit({ onDone: onClose })

  return (
    <>
      <DrawerTitle>{remoteUrl === undefined ? 'Other host' : 'Update sign-in'}</DrawerTitle>
      <DrawerBody>
        <p className="text-xs text-text-muted">
          Reflect checks the sign-in with the host before it stores anything.
        </p>
        <ConnectHostForm
          remoteUrl={remoteUrl}
          flow={flow}
          actions={({ pending, canSubmit }) => (
            <Button type="submit" disabled={!canSubmit}>
              {pending ? 'Connecting…' : 'Connect'}
            </Button>
          )}
        />
      </DrawerBody>
    </>
  )
}
