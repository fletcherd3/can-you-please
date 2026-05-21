/**
 * Minimal ambient type declaration for newman (CJS, no bundled types).
 */
declare module "newman" {
  import { EventEmitter } from "node:events";

  export function run(
    options: Record<string, unknown>,
    callback?: (err: Error | null) => void,
  ): EventEmitter;
}
