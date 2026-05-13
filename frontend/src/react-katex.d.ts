declare module 'react-katex' {
  import * as React from 'react';

  interface KaTeXProps {
    math: string;
    block?: boolean;
    errorColor?: string;
    renderError?: (error: Error) => React.ReactNode;
    settings?: {
      throwOnError?: boolean;
      errorColor?: string;
      macros?: object;
      colorIsTextColor?: boolean;
      strict?: boolean;
      maxSize?: number;
      maxExpand?: number;
      fleqn?: boolean;
    };
  }

  export const InlineMath: React.FC<KaTeXProps>;
  export const BlockMath: React.FC<KaTeXProps>;
} 