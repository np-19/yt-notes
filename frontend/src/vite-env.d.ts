/// <reference types="vite/client" />

declare module 'katex/dist/contrib/auto-render.mjs' {
  interface AutoRenderOptions {
    delimiters?: Array<{ left: string; right: string; display: boolean }>;
    ignoredTags?: string[];
    ignoredClasses?: string[];
    errorCallback?: (msg: string, err: Error) => void;
    preProcess?: (math: string) => string;
    throwOnError?: boolean;
  }
  function renderMathInElement(elem: HTMLElement, options?: AutoRenderOptions): void;
  export default renderMathInElement;
}