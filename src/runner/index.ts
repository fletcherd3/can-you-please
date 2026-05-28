import { run as newmanRun } from "newman";
import type { Flow } from "../domain.js";
import { isValidJsonBody } from "../workspace/json-body.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RequestStartedEvent {
  type: "RequestStarted";
  name: string;
  method: string;
  /** Resolved URL — variables already substituted by Newman */
  url: string;
  /** Resolved request headers as actually sent (variables substituted) */
  requestHeaders: Record<string, string>;
  /** Resolved request body as actually sent (variables substituted) */
  requestBody?: { mode: string; content: string };
}

export interface ParsedResponseError {
  error?: string;
  message?: string;
  details?: unknown;
}

export interface RequestCompletedEvent {
  type: "RequestCompleted";
  name: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  responseTimeMs: number;
  headers: Record<string, string>;
  body: string;
  /** Resolved request headers as actually sent (variables substituted) */
  requestHeaders: Record<string, string>;
  /** Resolved request body as actually sent (variables substituted) */
  requestBody?: { mode: string; content: string };
  /** true for any non-2xx status */
  failed: boolean;
  failureMessage?: string;
  /** console.log / console.error output from pre- and post-request scripts */
  consoleOutput: string[];
  /** variables set via pm.variables.set() during this item's scripts */
  variablesSet: Record<string, string>;
  /** Parsed error/message/details fields when failed and body is JSON */
  parsedResponseError?: ParsedResponseError;
}

export interface RunFinishedEvent {
  type: "RunFinished";
  totalRequests: number;
  failedRequests: number;
  durationMs: number;
  /** Present when the run could not start due to a pre-run validation error */
  preRunError?: string;
}

export type RunEvent =
  | RequestStartedEvent
  | RequestCompletedEvent
  | RunFinishedEvent;

export interface RunOptions {
  /** When true, the run continues past request failures; false bails on first failure */
  continueOnError: boolean;
  /** Variables to pass as Newman globals (accessible via pm.globals.get()) */
  globals?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Postman v2.1 collection builder
// ---------------------------------------------------------------------------

function buildCollection(flow: Flow): Record<string, unknown> {
  const items = [...flow.requests]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((req) => ({
      name: req.name,
      event: req.scripts.map((s) => ({
        listen: s.type === "beforeRequest" ? "prerequest" : "test",
        script: {
          type: s.language || "text/javascript",
          exec: s.code.split("\n"),
        },
      })),
      request: {
        method: req.method,
        url: req.url,
        header: Object.entries(req.headers).map(([key, value]) => ({
          key,
          value,
        })),
        ...(req.body != null
          ? {
              body: {
                mode: "raw",
                raw: req.body.content,
                ...(req.body.type === "json"
                  ? { options: { raw: { language: "json" } } }
                  : {}),
              },
            }
          : {}),
      },
    }));

  return {
    info: {
      name: flow.group != null ? `${flow.group}/${flow.name}` : flow.name,
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: items,
  };
}

function buildEnvironment(
  variables: Record<string, string>,
): Record<string, unknown> {
  return {
    id: "runner-env",
    name: "runner-env",
    values: Object.entries(variables).map(([key, value]) => ({
      key,
      value,
      enabled: true,
    })),
  };
}

function buildGlobals(
  variables: Record<string, string>,
): Record<string, unknown> {
  return {
    id: "runner-globals",
    name: "runner-globals",
    values: Object.entries(variables).map(([key, value]) => ({
      key,
      value,
      enabled: true,
    })),
  };
}

// ---------------------------------------------------------------------------
// Pre-run validation
// ---------------------------------------------------------------------------

function validateJsonBodies(flow: Flow): string[] {
  const errors: string[] = [];
  for (const req of flow.requests) {
    if (req.body?.type === "json" && !isValidJsonBody(req.body.content)) {
      errors.push(`${req.name}: invalid JSON body`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

function headersFromNewman(
  headersRef: Record<string, { key: string; value: string }> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headersRef) return out;
  for (const entry of Object.values(headersRef)) {
    out[entry.key] = entry.value;
  }
  return out;
}

/**
 * Extract resolved headers from a Newman beforeRequest request object.
 * Reads from `headers.members[]` since that's the canonical list (the
 * `reference` map can collide on duplicate keys / be out of sync).
 */
function headersFromRequest(
  request: AnyObj | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  const members = (request?.["headers"]?.["members"] ?? []) as Array<{
    key: string;
    value: string;
    disabled?: boolean;
  }>;
  for (const m of members) {
    if (m.disabled) continue;
    out[m.key] = m.value;
  }
  return out;
}

/**
 * Extract resolved request body from a Newman beforeRequest request object.
 * Returns `undefined` when there's no body. Only `raw` mode is fully captured
 * (the only mode our runner emits); other modes return their stringified form.
 */
function bodyFromRequest(
  request: AnyObj | undefined,
): { mode: string; content: string } | undefined {
  const body = request?.["body"] as AnyObj | undefined;
  if (body == null) return undefined;
  const mode = String(body["mode"] ?? "raw");
  if (mode === "raw") {
    const raw = body["raw"];
    if (raw == null) return undefined;
    return { mode, content: String(raw) };
  }
  // Fallback for non-raw modes — stringify whatever the SDK gives us
  try {
    const str = (body["toString"] as (() => string) | undefined)?.();
    if (typeof str === "string" && str.length > 0) {
      return { mode, content: str };
    }
  } catch {
    // ignore
  }
  return undefined;
}

function parsedErrorFromBody(body: string): ParsedResponseError | undefined {
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body) as AnyObj;
    if (
      parsed["error"] !== undefined ||
      parsed["message"] !== undefined ||
      parsed["details"] !== undefined
    ) {
      return {
        error:
          parsed["error"] !== undefined ? String(parsed["error"]) : undefined,
        message:
          parsed["message"] !== undefined
            ? String(parsed["message"])
            : undefined,
        details: parsed["details"],
      };
    }
  } catch {
    // non-JSON body — nothing to parse
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a Flow through Newman with the supplied resolved variable map.
 *
 * Returns an `AsyncIterable<RunEvent>` that emits events incrementally.
 * Breaking out of the iterator (via `break` or `return`) cancels the
 * underlying Newman run cleanly.
 */
export function runFlow(
  flow: Flow,
  variables: Record<string, string>,
  options: RunOptions,
): AsyncIterable<RunEvent> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<RunEvent> {
      const queue: RunEvent[] = [];
      let isDone = false;
      let waiting: ((r: IteratorResult<RunEvent>) => void) | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let internalRun: any = null;

      // Per-item accumulators (reset on each beforeItem)
      let consoleBuffer: string[] = [];
      let varsSetBuffer: Record<string, string> = {};
      let pendingRequestMeta: Pick<
        RequestStartedEvent,
        "name" | "method" | "url"
      > | null = null;
      let pendingResolvedHeaders: Record<string, string> = {};
      let pendingResolvedBody: { mode: string; content: string } | undefined =
        undefined;
      let pendingResponseMeta: Omit<
        RequestCompletedEvent,
        | "type"
        | "name"
        | "method"
        | "url"
        | "consoleOutput"
        | "variablesSet"
        | "requestHeaders"
        | "requestBody"
      > | null = null;

      function push(event: RunEvent): void {
        if (isDone) return;
        if (waiting) {
          const resolve = waiting;
          waiting = null;
          resolve({ value: event, done: false });
        } else {
          queue.push(event);
        }
      }

      function complete(): void {
        if (isDone) return;
        isDone = true;
        if (waiting) {
          const resolve = waiting;
          waiting = null;
          resolve({ value: undefined as unknown as RunEvent, done: true });
        }
      }

      // Pre-run JSON validation
      const jsonErrors = validateJsonBodies(flow);
      if (jsonErrors.length > 0) {
        // Defer so the caller has a chance to set up the iterator first
        setTimeout(() => {
          push({
            type: "RunFinished",
            totalRequests: 0,
            failedRequests: 0,
            durationMs: 0,
            preRunError: jsonErrors.join("; "),
          });
          complete();
        }, 0);
      } else {
        const collection = buildCollection(flow);
        const environment = buildEnvironment(variables);

        const globals =
          options.globals != null
            ? buildGlobals(options.globals)
            : undefined;

        const emitter = newmanRun({
          collection,
          environment,
          ...(globals != null ? { globals } : {}),
          // bail = stop on failure; continueOnError is the inverse
          bail: !options.continueOnError,
          reporters: [],
        });

        emitter.on("start", (_err: unknown, args: AnyObj) => {
          internalRun = args["run"];
        });

        emitter.on("beforeItem", () => {
          consoleBuffer = [];
          varsSetBuffer = {};
          pendingRequestMeta = null;
          pendingResolvedHeaders = {};
          pendingResolvedBody = undefined;
          pendingResponseMeta = null;
        });

        emitter.on("console", (_err: unknown, args: AnyObj) => {
          const messages = (args["messages"] ?? []) as unknown[];
          const msg = messages.map(String).join(" ");
          consoleBuffer.push(`[${String(args["level"])}] ${msg}`);
        });

        emitter.on("script", (_err: unknown, args: AnyObj) => {
          const members: Array<{ key: string; value: string }> =
            args["execution"]?.["_variables"]?.["values"]?.["members"] ?? [];
          for (const m of members) {
            varsSetBuffer[m.key] = m.value;
          }
        });

        emitter.on("beforeRequest", (_err: unknown, args: AnyObj) => {
          const request = args["request"] as AnyObj | undefined;
          pendingRequestMeta = {
            name: String(args["item"]?.["name"] ?? ""),
            method: String(request?.["method"] ?? ""),
            url: String(request?.["url"] ?? ""),
          };
          // Capture resolved headers / body — these reflect what was actually
          // sent over the wire (variables substituted, pre-request script
          // mutations applied).
          pendingResolvedHeaders = headersFromRequest(request);
          pendingResolvedBody = bodyFromRequest(request);
          push({
            type: "RequestStarted",
            ...pendingRequestMeta,
            requestHeaders: { ...pendingResolvedHeaders },
            requestBody: pendingResolvedBody,
          });
        });

        emitter.on("request", (_err: unknown, args: AnyObj) => {
          const resp = args["response"] as AnyObj | null;
          const code: number = resp?.["code"] ?? 0;
          const failed = code < 200 || code >= 300;

          let bodyText = "";
          try {
            bodyText = (resp?.["text"] as (() => string) | undefined)?.() ?? "";
          } catch {
            // ignore body read errors
          }

          pendingResponseMeta = {
            status: code,
            statusText: String(resp?.["status"] ?? ""),
            responseTimeMs: Number(resp?.["responseTime"] ?? 0),
            headers: headersFromNewman(
              resp?.["headers"]?.["reference"] as
                | Record<string, { key: string; value: string }>
                | undefined,
            ),
            body: bodyText,
            failed,
            failureMessage: failed
              ? `${code} ${String(resp?.["status"] ?? "")}`.trim()
              : undefined,
            parsedResponseError: failed
              ? parsedErrorFromBody(bodyText)
              : undefined,
          };
        });

        emitter.on("item", (_err: unknown, args: AnyObj) => {
          // Emit RequestCompleted with data gathered across the item lifecycle
          const name =
            pendingRequestMeta?.name ?? String(args["item"]?.["name"] ?? "");
          push({
            type: "RequestCompleted",
            name,
            method: pendingRequestMeta?.method ?? "",
            url: pendingRequestMeta?.url ?? "",
            status: pendingResponseMeta?.status ?? 0,
            statusText: pendingResponseMeta?.statusText ?? "",
            responseTimeMs: pendingResponseMeta?.responseTimeMs ?? 0,
            headers: pendingResponseMeta?.headers ?? {},
            body: pendingResponseMeta?.body ?? "",
            requestHeaders: { ...pendingResolvedHeaders },
            requestBody: pendingResolvedBody,
            failed: pendingResponseMeta?.failed ?? false,
            failureMessage: pendingResponseMeta?.failureMessage,
            consoleOutput: [...consoleBuffer],
            variablesSet: { ...varsSetBuffer },
            parsedResponseError: pendingResponseMeta?.parsedResponseError,
          });
        });

        emitter.on("done", (_err: unknown, summary: AnyObj) => {
          const stats = summary?.["run"]?.["stats"] as AnyObj | undefined;
          const timings = summary?.["run"]?.["timings"] as AnyObj | undefined;
          push({
            type: "RunFinished",
            totalRequests: Number(stats?.["requests"]?.["total"] ?? 0),
            failedRequests: Number(stats?.["requests"]?.["failed"] ?? 0),
            durationMs:
              timings?.["completed"] != null && timings?.["started"] != null
                ? Number(timings["completed"]) - Number(timings["started"])
                : 0,
          });
          complete();
        });
      }

      return {
        next(): Promise<IteratorResult<RunEvent>> {
          if (queue.length > 0) {
            return Promise.resolve({ value: queue.shift()!, done: false });
          }
          if (isDone) {
            return Promise.resolve({
              value: undefined as unknown as RunEvent,
              done: true,
            });
          }
          return new Promise((resolve) => {
            waiting = resolve;
          });
        },

        /**
         * Called when the consumer breaks out of `for await` early.
         * Aborts the Newman run so it stops making further requests.
         */
        return(): Promise<IteratorResult<RunEvent>> {
          isDone = true;
          if (internalRun != null) {
            (internalRun as AnyObj)["abort"]?.();
          }
          if (waiting) {
            const resolve = waiting;
            waiting = null;
            resolve({ value: undefined as unknown as RunEvent, done: true });
          }
          return Promise.resolve({
            value: undefined as unknown as RunEvent,
            done: true,
          });
        },
      };
    },
  };
}
