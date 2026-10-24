import type { ReactElement } from 'react'
import { FormProvider } from 'react-hook-form'
import { ConnectGitHostFields } from '@/components/settings/connect-git-host-form.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Drawer, DrawerBody, DrawerContent, DrawerTitle } from '@/components/ui/drawer.tsx'
import { useConnectGitHostForm } from '@/hooks/use-connect-git-host-form.ts'

interface ConnectGitHostDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The remote to prefill: an HTTPS remote that needs a sign-in. */
  remoteUrl?: string | undefined
}

/**
 * The mobile "Other host" bottom sheet: a Drawer shell over
 * {@link useConnectGitHostForm}, the same form as desktop's dialog. The body
 * mounts per open cycle, so a dismissed half-filled form never leaks into
 * the next.
 */
export function ConnectGitHostDrawer({
  open,
  onOpenChange,
  remoteUrl,
}: ConnectGitHostDrawerProps): ReactElement {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-label="Other host">
        {open ? (
          <ConnectGitHostSheet remoteUrl={remoteUrl} onClose={() => onOpenChange(false)} />
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}

function ConnectGitHostSheet({
  remoteUrl,
  onClose,
}: {
  remoteUrl: string | undefined
  onClose: () => void
}): ReactElement {
  const { form, submit } = useConnectGitHostForm({ remoteUrl, onDone: onClose })

  return (
    <>
      <DrawerTitle>{remoteUrl === undefined ? 'Other host' : 'Update sign-in'}</DrawerTitle>
      <DrawerBody>
        <FormProvider {...form}>
          <ConnectGitHostFields
            onSubmit={submit}
            actions={({ pending, canSubmit }) => (
              <Button type="submit" disabled={!canSubmit}>
                {pending ? 'Connecting…' : 'Connect'}
              </Button>
            )}
          />
        </FormProvider>
      </DrawerBody>
    </>
  )
}
