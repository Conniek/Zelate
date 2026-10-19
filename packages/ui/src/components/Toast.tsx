import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ToastProviderProps {
  children: ReactNode;
  label: string;
}

export interface ToastProps {
  closeLabel: string;
  description?: string;
  duration?: number;
  onOpenChange?: (open: boolean) => void;
  open: boolean;
  title: string;
}

export function ToastProvider({ children, label }: ToastProviderProps) {
  return (
    <ToastPrimitive.Provider duration={4000} swipeDirection="right">
      {children}
      <ToastPrimitive.Viewport
        className="fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none"
        label={label}
      />
    </ToastPrimitive.Provider>
  );
}

export function Toast({
  closeLabel,
  description,
  duration = 4000,
  onOpenChange,
  open,
  title,
}: ToastProps) {
  return (
    <ToastPrimitive.Root
      className="relative grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg border border-border bg-surface p-4 text-text shadow-lg"
      duration={duration}
      onOpenChange={onOpenChange}
      open={open}
    >
      <ToastPrimitive.Title className="font-semibold">
        {title}
      </ToastPrimitive.Title>
      <ToastPrimitive.Close
        aria-label={closeLabel}
        className="col-start-2 row-span-2 inline-flex size-11 items-center justify-center rounded-lg hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus-ring"
      >
        <X aria-hidden="true" size={18} />
      </ToastPrimitive.Close>
      {description ? (
        <ToastPrimitive.Description className="text-body-sm text-text-muted">
          {description}
        </ToastPrimitive.Description>
      ) : null}
    </ToastPrimitive.Root>
  );
}
