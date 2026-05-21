import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export const ORANGE = "#ff8700";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterableListItem {
  /** Unique identifier — matches the flow's folderPath or env id. */
  key: string;
  /** Text label used for display. */
  label: string;
  /** Optional group name. null/undefined = ungrouped (no section header). */
  group?: string | null;
  /** Whether the item can be selected via enter. Defaults to true. */
  selectable?: boolean;
  /** Renders the row content. isSelected reflects arrow-key focus. */
  renderContent: (isSelected: boolean) => React.ReactNode;
}

export interface FilterableListProps {
  /** Items to display (pre-filtered and sorted by parent). */
  items: FilterableListItem[];
  /** Called when enter is pressed on a selectable item. */
  onSelect: (key: string) => void;
  /** Called when enter is pressed on a non-selectable item. */
  onSelectNonSelectable?: (key: string) => void;
  /** Called when esc is pressed. */
  onEsc?: () => void;
  /** Whether this component responds to keyboard input. */
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type RenderRow =
  | { type: "header"; group: string }
  | { type: "item"; item: FilterableListItem; index: number };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRows(items: FilterableListItem[]): RenderRow[] {
  const rows: RenderRow[] = [];
  let lastGroup: string | null | undefined = undefined;
  let index = 0;
  for (const item of items) {
    const g = item.group ?? null;
    if (g !== null && g !== lastGroup) {
      rows.push({ type: "header", group: g });
    }
    rows.push({ type: "item", item, index: index++ });
    lastGroup = g;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilterableList({
  items,
  onSelect,
  onSelectNonSelectable,
  onEsc,
  isActive = true,
}: FilterableListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const clampedIndex =
    items.length === 0 ? 0 : Math.min(selectedIndex, items.length - 1);

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        if (items.length > 0) {
          setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
        }
        return;
      }
      if (key.return) {
        if (items.length === 0) return;
        const selected = items[clampedIndex];
        if (!selected) return;
        if (selected.selectable !== false) {
          onSelect(selected.key);
        } else {
          onSelectNonSelectable?.(selected.key);
        }
        return;
      }
      if (key.escape) {
        onEsc?.();
        return;
      }
    },
    { isActive },
  );

  if (items.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>nothing here, sorry!</Text>
        <Text dimColor>clear filters to see more</Text>
      </Box>
    );
  }

  const rows = buildRows(items);

  return (
    <Box flexDirection="column">
      {rows.map((row, i) => {
        if (row.type === "header") {
          return (
            <Box key={`header-${row.group}-${i}`} marginTop={1}>
              <Text bold color={ORANGE}>
                {row.group}
              </Text>
            </Box>
          );
        }
        const isSelected = row.index === clampedIndex;
        return (
          <Box key={row.item.key}>
            <Text color={isSelected ? ORANGE : undefined}>
              {isSelected ? "> " : "  "}
            </Text>
            <Box>{row.item.renderContent(isSelected)}</Box>
          </Box>
        );
      })}
    </Box>
  );
}
