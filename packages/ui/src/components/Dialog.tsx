import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface DialogProps {
  children: ReactNode;
  closeLabel: string;
  description?: string;
  onOpenChange: (open: boolean) => void;
  /** Where the focus goes on close when the opening button is gone (WCAG 2.4.3). */
  onCloseAutoFocus?: (event: Event) => void;
  open: boolean;
  title: string;
}

export function Dialog({
  children,
  closeLabel,
  description,
  onOpenChange,
  onCloseAutoFocus,
  open,
  title,
}: DialogProps) {
  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink-900/50" />
        <DialogPrimitive.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed left-1/2 top-1/2 z-50 max-h-[min(90vh,48rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-surface p-6 text-text shadow-lg focus:outline-none"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="grid gap-2">
              <DialogPrimitive.Title className="font-display text-h2 font-bold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-body-sm text-text-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              aria-label={closeLabel}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus-ring"
            >
              <X aria-hidden="true" size={20} />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
