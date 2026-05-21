import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { ORANGE } from "./FilterableList.js";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EnumInputProps {
  /** Current text value */
  value: string;
  onChange: (value: string) => void;
  /** Suggested values — enum is suggestive, not constraining */
  enums: string[];
  /** Whether this input has keyboard focus */
  isActive: boolean;
  /** Show a required-field error marker */
  hasError?: boolean;
  /** Whether the dropdown is open (controlled by the parent form) */
  dropdownOpen: boolean;
  /** Request the parent to open the dropdown */
  onOpenDropdown: () => void;
  /** Request the parent to close the dropdown */
  onCloseDropdown: () => void;
  /** An enum item was selected */
  onSelectDropdownItem: (item: string) => void;
}

// ---------------------------------------------------------------------------
// EnumInput
// ---------------------------------------------------------------------------

export function EnumInput({
  value,
  onChange,
  enums,
  isActive,
  hasError = false,
  dropdownOpen,
  onOpenDropdown,
  onCloseDropdown,
  onSelectDropdownItem,
}: EnumInputProps) {
  const [dropdownIndex, setDropdownIndex] = useState(0);

  // Suggestions filtered by the current value (substring match, case-insensitive).
  // Falls back to the full list when the current value matches nothing.
  const suggestions = useMemo(() => {
    if (enums.length === 0) return [];
    if (!value) return enums;
    const lower = value.toLowerCase();
    const filtered = enums.filter((e) => e.toLowerCase().includes(lower));
    return filtered.length > 0 ? filtered : enums;
  }, [enums, value]);

  useInput(
    (input, key) => {
      // ---- Dropdown navigation ----
      if (dropdownOpen) {
        if (key.upArrow) {
          setDropdownIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (key.downArrow) {
          setDropdownIndex((i) => Math.min(suggestions.length - 1, i + 1));
          return;
        }
        if (key.return) {
          const item = suggestions[dropdownIndex];
          if (item !== undefined) {
            onSelectDropdownItem(item);
            setDropdownIndex(0);
          }
          return;
        }
        if (key.escape) {
          onCloseDropdown();
          return;
        }
        // Any other key while dropdown open: close dropdown then handle.
        onCloseDropdown();
        // intentional fall-through to regular handling below
      }

      // ---- Regular input ----
      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
        return;
      }
      // Down-arrow opens the dropdown (when there are enum suggestions)
      if (key.downArrow && enums.length > 0) {
        setDropdownIndex(0);
        onOpenDropdown();
        return;
      }
      // These are handled at the form level — don't consume them here.
      if (key.tab || key.return || key.escape || key.upArrow) {
        return;
      }
      // Printable character
      if (input && !key.ctrl && !key.meta) {
        onChange(value + input);
      }
    },
    { isActive },
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isActive ? ORANGE : undefined}>
          {isActive ? "[" : " "}
        </Text>
        <Text> </Text>
        <Text>
          {value}
          {isActive ? "█" : ""}
        </Text>
        <Text> </Text>
        <Text color={isActive ? ORANGE : undefined}>
          {isActive ? "]" : " "}
        </Text>
        {hasError && <Text color="red"> required</Text>}
      </Box>

      {/* Inline dropdown */}
      {dropdownOpen && suggestions.length > 0 && (
        <Box flexDirection="column" marginLeft={4}>
          {suggestions.map((s, i) => (
            <Text key={s} color={i === dropdownIndex ? ORANGE : "gray"}>
              {i === dropdownIndex ? "> " : "  "}
              {s}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
