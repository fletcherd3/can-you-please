import React, { useMemo } from "react";
import { Box, Text, useInput } from "ink";
import type { AnyFlow, Environment } from "../../domain.js";
import {
  FilterableList,
  type FilterableListItem,
  ORANGE,
} from "../components/FilterableList.js";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EnvPickerScreenProps {
  flow: AnyFlow;
  environments: Environment[];
  onSelect: (env: Environment) => void;
  onBack: () => void;
  onHelp: () => void;
  /** Pre-position the cursor on this env id (from the flow-picker env filter). */
  initialEnvId?: string | null;
}

// ---------------------------------------------------------------------------
// EnvPickerScreen
// ---------------------------------------------------------------------------

export function EnvPickerScreen({
  flow,
  environments,
  onSelect,
  onBack,
  onHelp,
  initialEnvId,
}: EnvPickerScreenProps) {
  // Decide which envs to display:
  //   - broken flow or flow with no declared environments → all workspace envs
  //   - flow with ≥2 declared environments → only those environments
  const candidateEnvs = useMemo<Environment[]>(() => {
    if (flow.kind === "broken-flow" || flow.environments.length === 0) {
      return environments;
    }
    return environments.filter((e) => flow.environments.includes(e.id));
  }, [flow, environments]);

  // Initial cursor position driven by the flow-picker env-filter.
  const initialIndex = useMemo<number>(() => {
    if (!initialEnvId) return 0;
    const idx = candidateEnvs.findIndex((e) => e.id === initialEnvId);
    return idx >= 0 ? idx : 0;
  }, [candidateEnvs, initialEnvId]);

  const items: FilterableListItem[] = candidateEnvs.map((env) => ({
    key: env.id,
    label: env.name,
    group: null,
    selectable: true,
    renderContent: (isSelected) => (
      <Box>
        <Text color={isSelected ? ORANGE : undefined}>{env.name}</Text>
      </Box>
    ),
  }));

  // Handle '?' globally (FilterableList handles esc via onEsc).
  useInput((input) => {
    if (input === "?") {
      onHelp();
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Title */}
      <Text bold color={ORANGE}>
        select environment
      </Text>
      <Text> </Text>

      {/* Environment list */}
      <FilterableList
        items={items}
        initialIndex={initialIndex}
        onSelect={(key) => {
          const env = candidateEnvs.find((e) => e.id === key);
          if (env) onSelect(env);
        }}
        onEsc={onBack}
      />

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>↑↓ nav · enter select · esc back · ? help</Text>
      </Box>
    </Box>
  );
}
