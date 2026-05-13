/**
 * Silence the @types/react vs @ant-design/icons mismatch where every icon
 * usage demands `onPointerEnterCapture` / `onPointerLeaveCapture`. This is
 * pure type-checker noise — runtime is fine. See AdminPanel.tsx:539 for the
 * older inline `iconProps` spread workaround; this file removes the need
 * for it across the project.
 *
 * The augmentation is at the React level so the optionality propagates up
 * through HTMLProps → AllHTMLAttributes → HTMLAttributes → DOMAttributes
 * into the AntdIconProps interface (which extends HTMLProps<HTMLSpanElement>).
 */

import 'react';

declare module 'react' {
  interface DOMAttributes<T> {
    onPointerEnterCapture?: PointerEventHandler<T> | undefined;
    onPointerLeaveCapture?: PointerEventHandler<T> | undefined;
  }

  // Also explicitly relax HTMLAttributes for safety with ForwardRefExoticComponent
  // pickers used by @ant-design/icons (Pick<AntdIconProps, …keys>).
  interface HTMLAttributes<T> {
    onPointerEnterCapture?: PointerEventHandler<T> | undefined;
    onPointerLeaveCapture?: PointerEventHandler<T> | undefined;
  }
}

export {};
