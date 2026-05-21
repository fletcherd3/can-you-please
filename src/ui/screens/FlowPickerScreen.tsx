import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { basename } from "node:path";
import type { AnyFlow, Environment, Flow, Workspace } from "../../domain.js";
import { loadWorkspace } from "../../workspace/index.js";
import {
  FilterableList,
  type FilterableListItem,
  ORANGE,
} from "../components/FilterableList.js";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FlowPickerScreenProps {
  workspace: Workspace;
  onSelect: (flow: AnyFlow) => void;
  onReload: (workspace: Workspace) => void;
  onQuit: () => void;
  onHelp: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GLYPH_BROKEN = "!";
const GLYPH_DUPLICATE = "⚠";
const GLYPH_NORMAL = "·";
const DESC_TRUNCATE = 40;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}

function flowSearchLabel(flow: AnyFlow): string {
  if (flow.kind === "broken-flow") {
    return basename(flow.folderPath).toLowerCase();
  }
  return `${flow.name} ${flow.group ?? ""} ${flow.description ?? ""}`.toLowerCase();
}

function makeFlowItem(flow: AnyFlow): FilterableListItem {
  if (flow.kind === "broken-flow") {
    return {
      key: flow.folderPath,
      label: flowSearchLabel(flow),
      group: null,
      selectable: false,
      renderContent: () => (
        <Box>
          <Text color="red">{GLYPH_BROKEN} </Text>
          <Text dimColor>{basename(flow.folderPath)}</Text>
        </Box>
      ),
    };
  }

  const isDuplicate = flow.duplicateWarning != null;
  const glyph = isDuplicate ? GLYPH_DUPLICATE : GLYPH_NORMAL;
  const glyphColor = isDuplicate ? "yellow" : "gray";
  const desc = flow.description
    ? ` — ${truncate(flow.description, DESC_TRUNCATE)}`
    : "";

  return {
    key: flow.folderPath,
    label: flowSearchLabel(flow),
    group: flow.group,
    selectable: true,
    renderContent: (isSelected) => (
      <Box>
        <Text color={glyphColor}>{glyph} </Text>
        <Text color={isSelected ? ORANGE : undefined}>{flow.name}</Text>
        {desc !== "" && <Text dimColor>{desc}</Text>}
      </Box>
    ),
  };
}

// ---------------------------------------------------------------------------
// OverlayPicker — generic filterable list for env / group overlays
// ---------------------------------------------------------------------------

interface OverlayItem {
  key: string;
  label: string;
  isActive?: boolean;
}

interface OverlayPickerProps {
  title: string;
  items: OverlayItem[];
  onSelect: (key: string) => void;
  onEsc: () => void;
}

function OverlayPicker({ title, items, onSelect, onEsc }: OverlayPickerProps) {
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = filter
    ? items.filter((item) =>
        item.label.toLowerCase().includes(filter.toLowerCase()),
      )
    : items;

  const clampedIndex = Math.min(
    selectedIndex,
    Math.max(0, filtered.length - 1),
  );

  useInput(
    (input, key) => {
      if (key.upArrow) {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        if (filtered.length > 0)
          setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1));
        return;
      }
      if (key.return) {
        const sel = filtered[clampedIndex];
        if (sel) onSelect(sel.key);
        return;
      }
      if (key.escape) {
        onEsc();
        return;
      }
      if (key.backspace || key.delete) {
        setFilter((v) => v.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setFilter((v) => v + input);
      }
    },
    { isActive: true },
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={ORANGE}
      paddingX={1}
    >
      <Text bold color={ORANGE}>
        {title}
      </Text>
      {filter.length > 0 && (
        <Box>
          <Text dimColor>/ </Text>
          <Text color={ORANGE}>{filter}</Text>
          <Text>█</Text>
        </Box>
      )}
      {filtered.length === 0 ? (
        <Text dimColor>nothing here, sorry!</Text>
      ) : (
        filtered.map((item, i) => {
          const isSel = i === clampedIndex;
          return (
            <Box key={item.key}>
              <Text color={isSel ? ORANGE : undefined}>
                {isSel ? "> " : "  "}
                {item.label}
                {item.isActive === true ? " ✓" : ""}
              </Text>
            </Box>
          );
        })
      )}
      <Text dimColor>↑↓ nav · enter select · esc close</Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// FlowPickerScreen
// ---------------------------------------------------------------------------

export function FlowPickerScreen({
  workspace,
  onSelect,
  onReload,
  onQuit,
  onHelp,
}: FlowPickerScreenProps) {
  const { exit } = useApp();

  const [textFilter, setTextFilter] = useState("");
  const [envFilter, setEnvFilter] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<"none" | "env" | "group">("none");
  const [brokenFlowError, setBrokenFlowError] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);

  // -----------------------------------------------------------------------
  // Filtering pipeline
  // -----------------------------------------------------------------------

  const allFlows = workspace.flows;
  const validFlows = allFlows.filter((f) => f.kind === "flow") as Flow[];

  // Step 1 — env + group filter
  const envGroupFiltered = allFlows.filter((flow) => {
    if (flow.kind === "broken-flow") {
      // broken flows are excluded when a group filter is active
      return groupFilter == null;
    }
    if (
      envFilter != null &&
      flow.environments.length > 0 &&
      !flow.environments.includes(envFilter)
    ) {
      return false;
    }
    if (groupFilter != null && flow.group !== groupFilter) {
      return false;
    }
    return true;
  });

  // Step 2 — text filter
  const textLower = textFilter.toLowerCase();
  const visibleFlows = textFilter
    ? envGroupFiltered.filter((flow) =>
        flowSearchLabel(flow).includes(textLower),
      )
    : envGroupFiltered;

  const items: FilterableListItem[] = visibleFlows.map(makeFlowItem);

  // counts (valid flows only)
  const M = validFlows.length;
  const N = visibleFlows.filter((f) => f.kind === "flow").length;

  // -----------------------------------------------------------------------
  // Reload
  // -----------------------------------------------------------------------

  function handleReload() {
    if (isReloading) return;
    setIsReloading(true);
    loadWorkspace(workspace.rootPath)
      .then((newWs) => {
        onReload(newWs);
      })
      .catch(() => {
        // ignore reload errors silently — workspace will stay unchanged
      })
      .finally(() => {
        setIsReloading(false);
      });
  }

  // -----------------------------------------------------------------------
  // Keyboard — main handler (active when no overlay is open)
  // -----------------------------------------------------------------------

  useInput(
    (input, key) => {
      if (input === "e") {
        setBrokenFlowError(null);
        setOverlay("env");
        return;
      }
      if (input === "g") {
        setBrokenFlowError(null);
        setOverlay("group");
        return;
      }
      if (input === "R") {
        handleReload();
        return;
      }
      if (input === "?") {
        onHelp();
        return;
      }
      if (key.escape) {
        if (textFilter.length > 0) {
          setTextFilter("");
          setBrokenFlowError(null);
        } else {
          onQuit();
          exit();
        }
        return;
      }
      if (key.backspace || key.delete) {
        setTextFilter((v) => v.slice(0, -1));
        setBrokenFlowError(null);
        return;
      }
      if (input && !key.ctrl && !key.meta && !key.return && !key.tab) {
        setTextFilter((v) => v + input);
        setBrokenFlowError(null);
      }
    },
    { isActive: overlay === "none" && !isReloading },
  );

  // -----------------------------------------------------------------------
  // Overlay data
  // -----------------------------------------------------------------------

  const groups = [
    ...new Set(
      validFlows.filter((f) => f.group != null).map((f) => f.group as string),
    ),
  ].sort();

  const envItems: OverlayItem[] = [
    {
      key: "__all__",
      label: "all environments",
      isActive: envFilter == null,
    },
    ...workspace.environments.map((e) => ({
      key: e.id,
      label: e.name,
      isActive: envFilter === e.id,
    })),
  ];

  const groupItems: OverlayItem[] = [
    { key: "__all__", label: "all groups", isActive: groupFilter == null },
    ...groups.map((g) => ({
      key: g,
      label: g,
      isActive: groupFilter === g,
    })),
  ];

  // -----------------------------------------------------------------------
  // Status row
  // -----------------------------------------------------------------------

  const statusParts: string[] = [];
  if (envFilter != null) {
    const envName =
      workspace.environments.find((e: Environment) => e.id === envFilter)
        ?.name ?? envFilter;
    statusParts.push(`env: ${envName}`);
  }
  if (groupFilter != null) {
    statusParts.push(`group: ${groupFilter}`);
  }
  statusParts.push(`${N} of ${M} flows`);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Title */}
      <Text bold color={ORANGE}>
        flow picker
      </Text>
      <Text> </Text>

      {/* Status row */}
      <Text dimColor>{statusParts.join(" · ")}</Text>

      {/* Text filter indicator */}
      {textFilter.length > 0 && (
        <Box>
          <Text dimColor>/ </Text>
          <Text color={ORANGE}>{textFilter}</Text>
          <Text>█</Text>
        </Box>
      )}

      {/* Broken flow error */}
      {brokenFlowError != null && <Text color="red">{brokenFlowError}</Text>}

      <Text> </Text>

      {/* Main list OR overlay */}
      {overlay === "none" ? (
        <FilterableList
          items={items}
          onSelect={(key) => {
            const flow = workspace.flows.find((f) => f.folderPath === key);
            if (flow) onSelect(flow);
          }}
          onSelectNonSelectable={(key) => {
            const flow = workspace.flows.find((f) => f.folderPath === key);
            if (flow?.kind === "broken-flow") {
              setBrokenFlowError(
                `broken: ${basename(flow.folderPath)}: ${flow.reason}`,
              );
            }
          }}
          isActive={overlay === "none" && !isReloading}
        />
      ) : overlay === "env" ? (
        <OverlayPicker
          title="select environment"
          items={envItems}
          onSelect={(key) => {
            setEnvFilter(key === "__all__" ? null : key);
            setOverlay("none");
          }}
          onEsc={() => setOverlay("none")}
        />
      ) : (
        <OverlayPicker
          title="select group"
          items={groupItems}
          onSelect={(key) => {
            setGroupFilter(key === "__all__" ? null : key);
            setOverlay("none");
          }}
          onEsc={() => setOverlay("none")}
        />
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>
          {isReloading
            ? "reloading..."
            : "↑↓ nav · e env · g group · R reload · ? help"}
        </Text>
      </Box>
    </Box>
  );
}
