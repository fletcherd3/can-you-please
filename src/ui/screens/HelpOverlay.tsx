import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ORANGE } from "../components/FilterableList.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HelpKey {
  key: string;
  description: string;
}

export interface HelpOverlayProps {
  onClose: () => void;
  onChangeWorkspace?: () => void;
  onQuit?: () => void;
  workspacePath?: string;
  logDir?: string;
  keys?: HelpKey[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIONS = [
  "change workspace",
  "show log directory",
  "show workspace path",
  "quit",
] as const;

type Action = (typeof ACTIONS)[number];

// ---------------------------------------------------------------------------
// HelpOverlay
// ---------------------------------------------------------------------------

export function HelpOverlay({
  onClose,
  onChangeWorkspace,
  onQuit,
  workspacePath,
  logDir,
  keys = [],
}: HelpOverlayProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [footerMessage, setFooterMessage] = useState<string | null>(null);

  useInput((input, key) => {
    if (key.escape || input === "?") {
      onClose();
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      setFooterMessage(null);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(ACTIONS.length - 1, i + 1));
      setFooterMessage(null);
      return;
    }
    if (key.return) {
      handleAction(ACTIONS[selectedIndex]);
    }
  });

  function handleAction(action: Action) {
    switch (action) {
      case "change workspace":
        onChangeWorkspace?.();
        break;
      case "show log directory":
        setFooterMessage(
          `log directory: ${logDir ?? "~/.local/share/can-you-please/logs"}`,
        );
        break;
      case "show workspace path":
        setFooterMessage(
          `workspace: ${workspacePath ?? "(no workspace configured)"}`,
        );
        break;
      case "quit":
        onQuit?.();
        break;
    }
  }

  return (
    <Box
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      borderStyle="round"
      borderColor={ORANGE}
    >
      {/* Title */}
      <Text bold color={ORANGE}>
        help
      </Text>
      <Text> </Text>

      {/* Keys section — read-only reference */}
      {keys.length > 0 && (
        <>
          <Text dimColor>keys</Text>
          {keys.map(({ key, description }) => (
            <Box key={key}>
              <Text color={ORANGE}>{key.padEnd(20)}</Text>
              <Text dimColor>{description}</Text>
            </Box>
          ))}
          <Text> </Text>
        </>
      )}

      {/* Actions section — navigable */}
      <Text dimColor>actions</Text>
      {ACTIONS.map((action, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Box key={action}>
            <Text color={isSelected ? ORANGE : undefined}>
              {isSelected ? "> " : "  "}
              {action}
            </Text>
          </Box>
        );
      })}

      {/* Footer */}
      <Box marginTop={1}>
        {footerMessage != null ? (
          <Text color={ORANGE}>{footerMessage}</Text>
        ) : (
          <Text dimColor>↑↓ nav · enter select · esc close</Text>
        )}
      </Box>
    </Box>
  );
}
