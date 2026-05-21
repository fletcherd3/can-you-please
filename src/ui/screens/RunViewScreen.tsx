import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import { homedir } from "node:os";
import { join } from "node:path";
import { runFlow } from "../../runner/index.js";
import { createRunLogger } from "../../logger/index.js";
import { loadWorkspace } from "../../workspace/index.js";
import { DetailPane } from "../components/DetailPane.js";
import { ORANGE } from "../components/FilterableList.js";
import type {
  AnyFlow,
  Environment,
  Flow,
  Request,
  Workspace,
} from "../../domain.js";
import type {
  RunEvent,
  RunOptions,
  RequestCompletedEvent,
} from "../../runner/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RequestPhase = "pending" | "running" | "pass" | "fail" | "cancelled";
type RunPhase = "running" | "done-pass" | "done-fail" | "aborted";
type FocusTarget = "list" | "detail";

export type RunFlowFn = (
  flow: Flow,
  variables: Record<string, string>,
  options: RunOptions,
) => AsyncIterable<RunEvent>;

interface RequestRow {
  name: string;
  method: string;
  url: string;
  phase: RequestPhase;
  statusCode?: number;
  statusText?: string;
  durationMs?: number;
  completedEvent?: RequestCompletedEvent;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const LOG_DIR = join(
  homedir(),
  ".local",
  "share",
  "can-you-please",
  "logs",
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RunViewScreenProps {
  workspace: Workspace;
  flow: AnyFlow;
  env: Environment;
  variables: Record<string, string>;
  continueOnError: boolean;
  onBack: () => void;
  onHelp: () => void;
  /** Injected run function — for testing only. Defaults to real runFlow. */
  _runFlowFn?: RunFlowFn;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sort requests the same way Newman does (matching runner/index.ts). */
function sortRequests(requests: Request[]): Request[] {
  return [...requests].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name),
  );
}

function makeInitialRows(flow: AnyFlow): RequestRow[] {
  if (flow.kind !== "flow") return [];
  return sortRequests(flow.requests).map((r) => ({
    name: r.name,
    method: r.method,
    url: r.url,
    phase: "pending" as RequestPhase,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RunViewScreen(props: RunViewScreenProps) {
  const { flow, variables, onBack, onHelp } = props;
  const runFlowFn = props._runFlowFn ?? runFlow;

  // Pre-sorted request definitions for the detail pane lookup
  const sortedDefs = flow.kind === "flow" ? sortRequests(flow.requests) : [];

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------

  const [rows, setRows] = useState<RequestRow[]>(() => makeInitialRows(flow));
  const [runPhase, setRunPhase] = useState<RunPhase>("running");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autoFollow, setAutoFollow] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>("list");
  const [coE, setCoE] = useState(props.continueOnError);
  const [detailScrollTop, setDetailScrollTop] = useState(0);
  const [spinnerFrame, setSpinnerFrame] = useState(0);

  // ------------------------------------------------------------------
  // Refs (values read from async loop or across renders)
  // ------------------------------------------------------------------

  const iteratorRef = useRef<AsyncIterator<RunEvent> | null>(null);
  /** When set to true, the async run loop will break immediately. */
  const abortedRef = useRef(false);
  /** Index of the first failed request during a run. -1 if none yet. */
  const firstFailedRef = useRef(-1);
  /** Tracks which autoFollow value the async loop should use. */
  const autoFollowRef = useRef(true);
  /** Monotonic counter — incremented per run to detect stale state setters. */
  const runIdRef = useRef(0);
  /** Latest coE value (avoids stale closure in re-run handler). */
  const coERef = useRef(props.continueOnError);
  /** Latest flow rows (for cancelRemaining without stale closure). */
  const rowsRef = useRef<RequestRow[]>(makeInitialRows(flow));

  // ------------------------------------------------------------------
  // Spinner animation
  // ------------------------------------------------------------------

  useEffect(() => {
    const id = setInterval(
      () => setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length),
      80,
    );
    return () => clearInterval(id);
  }, []);

  // ------------------------------------------------------------------
  // Run management
  // ------------------------------------------------------------------

  /**
   * Start (or restart) a run.
   * Resets all run-related state, iterates RunEvents, and updates rows.
   */
  async function startRun(
    continueOnError: boolean,
    overrideFlow?: Flow,
  ): Promise<void> {
    const activeFlow = overrideFlow ?? (flow.kind === "flow" ? flow : null);
    if (activeFlow === null) return;

    const thisRunId = ++runIdRef.current;
    abortedRef.current = false;
    firstFailedRef.current = -1;
    autoFollowRef.current = true;

    const newRows = makeInitialRows(activeFlow);
    rowsRef.current = newRows;
    setRows(newRows);
    setRunPhase("running");
    setSelectedIndex(0);
    setAutoFollow(true);
    setShowDetail(false);
    setFocusTarget("list");
    setDetailScrollTop(0);

    const iterable = runFlowFn(activeFlow, variables, { continueOnError });
    const iterator = iterable[Symbol.asyncIterator]();
    iteratorRef.current = iterator;

    const logger = createRunLogger(activeFlow, LOG_DIR);

    try {
      while (true) {
        const result = await iterator.next();
        if (result.done || abortedRef.current) break;
        if (runIdRef.current !== thisRunId) break; // stale run

        const event = result.value;
        logger.write(event);

        if (event.type === "RequestStarted") {
          const idx = newRows.findIndex((r) => r.name === event.name);
          if (idx >= 0 && autoFollowRef.current) {
            setSelectedIndex(idx);
          }
          setRows((prev) => {
            const next = prev.map((r) =>
              r.name === event.name
                ? { ...r, phase: "running" as RequestPhase, url: event.url }
                : r,
            );
            rowsRef.current = next;
            return next;
          });
        } else if (event.type === "RequestCompleted") {
          const idx = newRows.findIndex((r) => r.name === event.name);
          if (idx >= 0 && event.failed && firstFailedRef.current === -1) {
            firstFailedRef.current = idx;
          }
          setRows((prev) => {
            const next = prev.map((r) =>
              r.name === event.name
                ? {
                    ...r,
                    phase: (event.failed ? "fail" : "pass") as RequestPhase,
                    statusCode: event.status,
                    statusText: event.statusText,
                    durationMs: event.responseTimeMs,
                    completedEvent: event,
                  }
                : r,
            );
            rowsRef.current = next;
            return next;
          });
        } else if (event.type === "RunFinished") {
          const failed =
            event.failedRequests > 0 || event.preRunError != null;
          setRunPhase(failed ? "done-fail" : "done-pass");
          await logger.close(failed ? "fail" : "pass");
          if (failed) {
            setShowDetail(true);
            autoFollowRef.current = false;
            setAutoFollow(false);
            if (firstFailedRef.current >= 0) {
              setSelectedIndex(firstFailedRef.current);
            }
          }
        }
      }
    } finally {
      if (runIdRef.current === thisRunId) {
        iteratorRef.current = null;
      }
    }
  }

  // Start the initial run on mount
  const startRunRef = useRef(startRun);
  startRunRef.current = startRun;

  useEffect(() => {
    void startRunRef.current(coERef.current);
    return () => {
      // Abort any in-flight run on unmount
      abortedRef.current = true;
      iteratorRef.current?.return?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Keyboard handling
  // ------------------------------------------------------------------

  const isRunning = runPhase === "running";
  const isDone =
    runPhase === "done-pass" ||
    runPhase === "done-fail" ||
    runPhase === "aborted";

  useInput((input, key) => {
    if (input === "?") {
      onHelp();
      return;
    }

    // ── detail pane has focus ──────────────────────────────────────────
    if (focusTarget === "detail") {
      if (key.escape) {
        setFocusTarget("list");
        return;
      }
      if (key.upArrow) {
        setDetailScrollTop((t) => Math.max(0, t - 1));
        return;
      }
      if (key.downArrow) {
        setDetailScrollTop((t) => t + 1);
        return;
      }
      return;
    }

    // ── list has focus ─────────────────────────────────────────────────

    if (key.escape) {
      if (isRunning) {
        // First esc: abort the run
        const iter = iteratorRef.current;
        iteratorRef.current = null;
        abortedRef.current = true;
        iter?.return?.();
        // Mark pending/running requests as cancelled
        setRows((prev) => {
          const next = prev.map((r) =>
            r.phase === "pending" || r.phase === "running"
              ? { ...r, phase: "cancelled" as RequestPhase }
              : r,
          );
          rowsRef.current = next;
          return next;
        });
        setRunPhase("aborted");
      } else {
        onBack();
      }
      return;
    }

    if (key.upArrow) {
      autoFollowRef.current = false;
      setAutoFollow(false);
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      setDetailScrollTop(0);
      return;
    }
    if (key.downArrow) {
      autoFollowRef.current = false;
      setAutoFollow(false);
      setSelectedIndex((prev) => Math.min(rows.length - 1, prev + 1));
      setDetailScrollTop(0);
      return;
    }

    if (key.tab) {
      setShowDetail((v) => !v);
      setDetailScrollTop(0);
      return;
    }

    if (input === "f") {
      autoFollowRef.current = true;
      setAutoFollow(true);
      return;
    }

    if (input === "d") {
      setShowDetail(true);
      setFocusTarget("detail");
      setDetailScrollTop(0);
      return;
    }

    if (input === "c") {
      const next = !coERef.current;
      coERef.current = next;
      setCoE(next);
      return;
    }

    if (input === "r" && isDone) {
      // Re-run: reload workspace from disk then start a new run
      const useCoE = coERef.current;
      void (async () => {
        try {
          const newWorkspace = await loadWorkspace(props.workspace.rootPath);
          const sameFlow = newWorkspace.flows.find(
            (f) =>
              f.kind === "flow" &&
              f.folderPath === (flow.kind === "flow" ? flow.folderPath : ""),
          ) as Flow | undefined;
          await startRunRef.current(useCoE, sameFlow);
        } catch {
          // Workspace reload failed — re-run with original flow
          await startRunRef.current(useCoE);
        }
      })();
      return;
    }
  });

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  const { columns, rows: termRows } = useWindowSize();

  // Running request index (for auto-follow)
  const runningIdx = rows.findIndex((r) => r.phase === "running");
  const displayedIndex =
    autoFollow && runningIdx >= 0 ? runningIdx : selectedIndex;

  // Selected row for detail pane
  const selectedRow = rows[displayedIndex] ?? null;
  const selectedDef =
    sortedDefs.find((r) => r.name === selectedRow?.name) ?? null;

  // Layout
  const listWidth = showDetail ? Math.floor(columns / 2) - 1 : columns;
  const detailWidth = columns - listWidth - 1; // -1 for separator
  const footerHeight = 1;
  const headerHeight = 1;
  const progressHeight = 1;
  const contentHeight = Math.max(
    1,
    termRows - headerHeight - progressHeight - footerHeight - 2,
  );

  // Progress bar
  const total = rows.length;
  const completed = rows.filter(
    (r) => r.phase === "pass" || r.phase === "fail",
  ).length;
  const barWidth = Math.max(0, listWidth - 18);
  const filledCount =
    total > 0 ? Math.round((completed / total) * barWidth) : 0;
  const emptyCount = Math.max(0, barWidth - filledCount);

  // Title
  const flowLabel =
    flow.kind === "flow"
      ? flow.group != null
        ? `${flow.group}/${flow.name}`
        : flow.name
      : "broken flow";

  // Footer
  const footerRunning =
    "↑↓ nav · tab detail · f follow · c continue · esc cancel";
  const footerDone = "↑↓ nav · tab detail · r re-run · esc back";
  const footer = isRunning ? footerRunning : footerDone;

  // Visible list rows (slice to contentHeight)
  // Always show `displayedIndex` in view
  const listStart = Math.max(0, displayedIndex - contentHeight + 1);
  const visibleRows = rows.slice(listStart, listStart + contentHeight);

  function renderGlyph(phase: RequestPhase, frame: number): React.ReactNode {
    switch (phase) {
      case "pass":
        return <Text color="green">✓</Text>;
      case "fail":
        return <Text color="red">✗</Text>;
      case "pending":
        return <Text dimColor>⋯</Text>;
      case "running":
        return (
          <Text color={ORANGE}>{SPINNER_FRAMES[frame % SPINNER_FRAMES.length]}</Text>
        );
      case "cancelled":
        return <Text dimColor>—</Text>;
    }
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Text bold>run view: </Text>
        <Text bold color={ORANGE}>
          {flowLabel}
        </Text>
        {!isRunning && (
          <Text
            bold
            color={
              runPhase === "done-pass"
                ? "green"
                : runPhase === "done-fail"
                  ? "red"
                  : undefined
            }
          >
            {runPhase === "done-pass"
              ? "  ✓ pass"
              : runPhase === "done-fail"
                ? "  ✗ fail"
                : "  — cancelled"}
          </Text>
        )}
      </Box>

      {/* Progress bar */}
      <Box>
        <Text color={ORANGE}>{"█".repeat(filledCount)}</Text>
        <Text dimColor>{"░".repeat(emptyCount)}</Text>
        <Text dimColor>
          {"  "}
          {completed}/{total} requests
        </Text>
      </Box>

      {/* Content area */}
      <Box flexDirection="row">
        {/* Request list */}
        <Box flexDirection="column" width={listWidth}>
          {visibleRows.map((row, i) => {
            const absIdx = listStart + i;
            const isSelected = absIdx === displayedIndex;
            return (
              <Box key={row.name}>
                <Text color={isSelected ? ORANGE : undefined}>
                  {isSelected ? ">" : " "}
                </Text>
                <Text> </Text>
                {renderGlyph(row.phase, spinnerFrame)}
                <Text> </Text>
                <Text>{row.method.padEnd(6)}</Text>
                {row.statusCode !== undefined ? (
                  <Text color={row.phase === "fail" ? "red" : undefined}>
                    {String(row.statusCode).padEnd(5)}
                  </Text>
                ) : (
                  <Text dimColor>{"—".padEnd(5)}</Text>
                )}
                {row.durationMs !== undefined ? (
                  <Text dimColor>{String(row.durationMs).padStart(6)}ms </Text>
                ) : (
                  <Text dimColor>{"".padStart(9)}</Text>
                )}
                <Text>{row.name}</Text>
                {(row.completedEvent?.consoleOutput?.length ?? 0) > 0 && (
                  <Text> 💬</Text>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Separator + detail pane */}
        {showDetail && (
          <>
            <Box flexDirection="column" width={1}>
              {Array.from({ length: contentHeight }, (_, i) => (
                <Text key={i} dimColor>
                  │
                </Text>
              ))}
            </Box>
            <Box flexDirection="column" width={detailWidth}>
              <DetailPane
                completedEvent={selectedRow?.completedEvent ?? null}
                requestDef={selectedDef}
                height={contentHeight}
                scrollTop={detailScrollTop}
              />
            </Box>
          </>
        )}
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>{footer}</Text>
      </Box>
    </Box>
  );
}
