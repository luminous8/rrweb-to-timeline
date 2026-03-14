declare module "term-mouse" {
  interface MouseEvent {
    x: number;
    y: number;
    button: "left" | "middle" | "right" | "none";
    shift: boolean;
    meta: boolean;
    ctrl: boolean;
    down: boolean;
    name: string;
  }

  interface Mouse {
    start(): Mouse;
    stop(): Mouse;
    on(event: "click", handler: (event: MouseEvent) => void): Mouse;
    on(event: "move", handler: (event: MouseEvent) => void): Mouse;
    on(event: "scroll", handler: (event: MouseEvent) => void): Mouse;
    on(event: "down", handler: (event: MouseEvent) => void): Mouse;
    on(event: "up", handler: (event: MouseEvent) => void): Mouse;
    removeListener(event: string, handler: (...args: unknown[]) => void): Mouse;
  }

  interface TermMouseOptions {
    input?: NodeJS.ReadableStream;
    output?: NodeJS.WritableStream;
    utf8?: boolean;
  }

  const createMouse: (options?: TermMouseOptions) => Mouse;
  export default createMouse;
}
