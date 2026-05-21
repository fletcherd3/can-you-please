import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Flow, Request } from "../domain.js";
import type {
  RunEvent,
  RequestCompletedEvent,
  RequestStartedEvent,
} from "../runner/index.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BODY_TRUNCATE_LIMIT = 1024 * 1024; // 1 MB

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RunLogger {
  write(event: RunEvent): void;
  close(outcome: "pass" | "fail"): Promise<void>;
}

// ---------------------------------------------------------------------------
// Filename helpers — exported for unit testing
// ---------------------------------------------------------------------------

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

/**
 * Format a Date as `YYYY-MM-DD_HH-mm-ss` (local time).
 * Exported for unit testing.
 */
export function formatFileTimestamp(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

/**
 * Build the log filename for a completed run.
 *
 * Format: `YYYY-MM-DD_HH-mm-ss_<group>__<flow>_<outcome>.log`
 * Ungrouped flows omit the `<group>__` prefix.
 * Exported for unit testing.
 */
export function buildLogFilename(
  flow: Pick<Flow, "name" | "group">,
  timestamp: string,
  outcome: "pass" | "fail",
): string {
  const flowPart =
    flow.group != null ? `${flow.group}__${flow.name}` : flow.name;
  return `${timestamp}_${flowPart}_${outcome}.log`;
}

// ---------------------------------------------------------------------------
// Body truncation — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Truncate a response body at BODY_TRUNCATE_LIMIT bytes.
 * Appends `[truncated, original size: N bytes]` when truncated.
 * Exported for unit testing.
 */
export function truncateBody(body: string): string {
  const bytes = Buffer.byteLength(body, "utf8");
  if (bytes <= BODY_TRUNCATE_LIMIT) return body;
  const buf = Buffer.from(body, "utf8").subarray(0, BODY_TRUNCATE_LIMIT);
  return `${buf.toString("utf8")}\n[truncated, original size: ${bytes} bytes]`;
}

// ---------------------------------------------------------------------------
// Section formatting helpers
// ---------------------------------------------------------------------------

function formatHeaders(headers: Record<string, string>): string {
  const entries = Object.entries(headers);
  if (entries.length === 0) return "  (none)";
  return entries.map(([k, v]) => `  ${k}: ${v}`).join("\n");
}

function buildSection(
  index: number,
  total: number,
  eventTimestamp: Date,
  started: RequestStartedEvent,
  completed: RequestCompletedEvent,
  requestDef: Request | undefined,
): string {
  const lines: string[] = [];

  // Delimiter / section header
  lines.push(
    `=== request ${index}/${total}: ${completed.name}` +
      ` (${completed.method} ${completed.status}, ${completed.responseTimeMs}ms) ===`,
  );
  lines.push(`timestamp: ${eventTimestamp.toISOString()}`);
  lines.push(`url: ${completed.url || started.url}`);
  lines.push(``);

  // Request detail (headers + body from flow definition)
  if (requestDef != null) {
    lines.push(`request headers:`);
    lines.push(formatHeaders(requestDef.headers));
    if (requestDef.body != null) {
      lines.push(``);
      lines.push(`request body:`);
      lines.push(requestDef.body.content);
    }
    lines.push(``);
  }

  // Response
  lines.push(`response status: ${completed.status} ${completed.statusText}`);
  lines.push(`response headers:`);
  lines.push(formatHeaders(completed.headers));
  lines.push(``);
  lines.push(`response body:`);
  const bodyText = truncateBody(completed.body);
  lines.push(bodyText.length > 0 ? bodyText : "  (empty)");

  // Console output from scripts
  if (completed.consoleOutput.length > 0) {
    lines.push(``);
    lines.push(`console output:`);
    for (const line of completed.consoleOutput) {
      lines.push(`  ${line}`);
    }
  }

  // Variables set by scripts
  const varEntries = Object.entries(completed.variablesSet);
  if (varEntries.length > 0) {
    lines.push(``);
    lines.push(`variables set:`);
    for (const [k, v] of varEntries) {
      lines.push(`  ${k} = ${v}`);
    }
  }

  // Parsed error detail on failure
  if (completed.failed && completed.parsedResponseError != null) {
    const pe = completed.parsedResponseError;
    lines.push(``);
    lines.push(`error detail:`);
    if (pe.error !== undefined) lines.push(`  error: ${pe.error}`);
    if (pe.message !== undefined) lines.push(`  message: ${pe.message}`);
    if (pe.details !== undefined)
      lines.push(`  details: ${JSON.stringify(pe.details)}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a logger for a single flow run.
 *
 * Call `write()` for every `RunEvent` emitted by `runFlow()`.
 * Call `close(outcome)` when the run ends — this creates the log file
 * under `logDir` (creating the directory if necessary).
 *
 * The log filename embeds a timestamp captured at logger creation time,
 * so the name is stable regardless of how long the run takes.
 */
export function createRunLogger(flow: Flow, logDir: string): RunLogger {
  const timestamp = formatFileTimestamp(new Date());
  const total = flow.requests.length;

  // name → Request lookup so we can include request headers/body in the log
  const requestByName = new Map<string, Request>(
    flow.requests.map((r) => [r.name, r]),
  );

  let requestIndex = 0;
  const sections: string[] = [];
  let pendingStarted: RequestStartedEvent | null = null;
  let pendingStartTime: Date | null = null;

  return {
    write(event: RunEvent): void {
      if (event.type === "RequestStarted") {
        pendingStarted = event;
        pendingStartTime = new Date();
      } else if (event.type === "RequestCompleted") {
        if (pendingStarted != null && pendingStartTime != null) {
          requestIndex++;
          sections.push(
            buildSection(
              requestIndex,
              total,
              pendingStartTime,
              pendingStarted,
              event,
              requestByName.get(event.name),
            ),
          );
          pendingStarted = null;
          pendingStartTime = null;
        }
      }
      // RunFinished — no additional content added to the log
    },

    async close(outcome: "pass" | "fail"): Promise<void> {
      await mkdir(logDir, { recursive: true });
      const filename = buildLogFilename(flow, timestamp, outcome);
      const content = sections.join("\n\n") + (sections.length > 0 ? "\n" : "");
      await writeFile(join(logDir, filename), content, "utf8");
    },
  };
}
