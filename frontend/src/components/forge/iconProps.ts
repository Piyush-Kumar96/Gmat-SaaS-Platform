/**
 * Shared no-op pointer handlers to satisfy AntdIconProps type-check noise.
 * @types/react and @ant-design/icons disagree on whether these are required;
 * spreading this object on every icon silences the type-checker without
 * runtime cost. Mirrors the pattern in AdminPanel.tsx.
 */
export const iconProps = {
  onPointerEnterCapture: () => {},
  onPointerLeaveCapture: () => {}
};
