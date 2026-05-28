import React from "react";
import { Box, Text } from "ink";
import type { Request } from "../../domain.js";
import type {
  RequestCompletedEvent,
  RequestStartedEvent,
} from "../../runner/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryPrettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

// ---------------------------------------------------------------------------
// Line builder — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Build the list of display lines for the detail pane.
 *
 * Returns a flat string array; callers slice it with scrollTop + height.
 * Exported for unit testing.
 */
export function buildDetailLines(
  completedEvent: RequestCompletedEvent | null,
  requestDef: Request | null,
  startedEvent?: RequestStartedEvent | null,
): string[] {
  if (completedEvent === null && requestDef === null && !startedEvent) {
    return ["(no request selected)"];
  }

  const lines: string[] = [];

  // ── request ──────────────────────────────────────────────────────────────
  lines.push(
    "── request ──────────────────────────────────────────────────────",
  );
  lines.push(
    `method:  ${completedEvent?.method ?? startedEvent?.method ?? requestDef?.method ?? ""}`,
  );
  lines.push(
    `url:     ${completedEvent?.url ?? startedEvent?.url ?? requestDef?.url ?? ""}`,
  );

  // Prefer resolved headers/body from the completed event, then the started
  // event (variables substituted, pre-request script mutations applied), and
  // fall back to the raw flow definition only when nothing resolved is
  // available yet (i.e., request hasn't even started).
  const resolvedHeaders =
    completedEvent?.requestHeaders ?? startedEvent?.requestHeaders;
  const headerEntries =
    resolvedHeaders != null
      ? Object.entries(resolvedHeaders)
      : requestDef != null
        ? Object.entries(requestDef.headers)
        : [];
  if (headerEntries.length > 0) {
    lines.push("");
    lines.push("headers:");
    for (const [k, v] of headerEntries) {
      lines.push(`  ${k}: ${v}`);
    }
  }

  const resolvedBody =
    completedEvent?.requestBody ?? startedEvent?.requestBody;
  if (resolvedBody != null) {
    lines.push("");
    lines.push(`body (${resolvedBody.mode}):`);
    const bodyContent =
      resolvedBody.mode === "raw"
        ? tryPrettyJson(resolvedBody.content)
        : resolvedBody.content;
    for (const line of bodyContent.split("\n")) {
      lines.push(`  ${line}`);
    }
  } else if (
    completedEvent == null &&
    startedEvent == null &&
    requestDef?.body != null
  ) {
    lines.push("");
    lines.push(`body (${requestDef.body.type}):`);
    const bodyContent =
      requestDef.body.type === "json"
        ? tryPrettyJson(requestDef.body.content)
        : requestDef.body.content;
    for (const line of bodyContent.split("\n")) {
      lines.push(`  ${line}`);
    }
  }

  if (completedEvent === null) {
    lines.push("");
    lines.push(
      "── response ─────────────────────────────────────────────────────",
    );
    lines.push("  (pending)");
    return lines;
  }

  // ── response ─────────────────────────────────────────────────────────────
  lines.push("");
  lines.push(
    "── response ─────────────────────────────────────────────────────",
  );
  lines.push(
    `status:    ${completedEvent.status} ${completedEvent.statusText}`,
  );
  lines.push(`duration:  ${completedEvent.responseTimeMs}ms`);

  const respHeaders = Object.entries(completedEvent.headers);
  if (respHeaders.length > 0) {
    lines.push("");
    lines.push("headers:");
    for (const [k, v] of respHeaders) {
      lines.push(`  ${k}: ${v}`);
    }
  }

  lines.push("");
  lines.push("body:");
  if (completedEvent.body.length === 0) {
    lines.push("  (empty)");
  } else {
    const bodyText = tryPrettyJson(completedEvent.body);
    for (const line of bodyText.split("\n")) {
      lines.push(`  ${line}`);
    }
  }

  // Console output
  if (completedEvent.consoleOutput.length > 0) {
    lines.push("");
    lines.push(
      "── console ──────────────────────────────────────────────────────",
    );
    for (const line of completedEvent.consoleOutput) {
      lines.push(`  ${line}`);
    }
  }

  // Variables set by scripts
  const varEntries = Object.entries(completedEvent.variablesSet);
  if (varEntries.length > 0) {
    lines.push("");
    lines.push(
      "── variables set ────────────────────────────────────────────────",
    );
    for (const [k, v] of varEntries) {
      lines.push(`  ${k} = ${v}`);
    }
  }

  // Failure summary
  if (completedEvent.failed) {
    lines.push("");
    lines.push(
      "── failure ──────────────────────────────────────────────────────",
    );
    if (completedEvent.failureMessage) {
      lines.push(`  ${completedEvent.failureMessage}`);
    }
    if (completedEvent.parsedResponseError != null) {
      const pe = completedEvent.parsedResponseError;
      if (pe.error !== undefined) lines.push(`  error: ${pe.error}`);
      if (pe.message !== undefined) lines.push(`  message: ${pe.message}`);
      if (pe.details !== undefined)
        lines.push(`  details: ${JSON.stringify(pe.details)}`);
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DetailPaneProps {
  /** Completed event for the selected request. null if not yet completed. */
  completedEvent: RequestCompletedEvent | null;
  /** Started event for the selected request (resolved request data while pending). */
  startedEvent?: RequestStartedEvent | null;
  /** Original request definition from the flow (for req headers/body). */
  requestDef: Request | null;
  /** Available height in terminal rows. */
  height: number;
  /** Scroll offset (lines from top). */
  scrollTop: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DetailPane({
  completedEvent,
  startedEvent,
  requestDef,
  height,
  scrollTop,
}: DetailPaneProps) {
  const lines = buildDetailLines(completedEvent, requestDef, startedEvent);
  const clamped = Math.max(
    0,
    Math.min(scrollTop, Math.max(0, lines.length - height)),
  );
  const visible = lines.slice(clamped, clamped + height);

  return (
    <Box flexDirection="column">
      {visible.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  );
}
