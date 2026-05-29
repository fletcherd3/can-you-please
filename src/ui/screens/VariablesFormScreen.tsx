import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { AnyFlow, Environment, Globals } from "../../domain.js";
import {
  detectVariables,
  resolveDisplayVariables,
  type VariableMeta,
} from "../../variables/index.js";
import { ORANGE } from "../components/FilterableList.js";
import { EnumInput } from "../components/EnumInput.js";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VariablesFormScreenProps {
  flow: AnyFlow;
  env: Environment;
  globals?: Globals | null;
  onSubmit: (
    variables: Record<string, string>,
    continueOnError: boolean,
  ) => void;
  onBack: () => void;
  onHelp: () => void;
}

// ---------------------------------------------------------------------------
// VariablesFormScreen
// ---------------------------------------------------------------------------

export function VariablesFormScreen({
  flow,
  env,
  globals,
  onSubmit,
  onBack,
  onHelp,
}: VariablesFormScreenProps) {
  // -------------------------------------------------------------------------
  // Derived field list — empty for broken flows (should never normally
  // land here, but handled defensively)
  // -------------------------------------------------------------------------

  const meta: VariableMeta[] = useMemo(() => {
    if (flow.kind !== "flow") return [];
    return detectVariables(flow);
  }, [flow]);

  // Initial values from the full five-layer merge (form-input layer is empty)
  const displayVariables = useMemo(() => {
    if (flow.kind !== "flow") return {};
    return resolveDisplayVariables(flow, env, globals ?? null, {});
  }, [flow, env, globals]);

  const initialValues = useMemo((): Record<string, string> => {
    return Object.fromEntries(
      meta.map((m) => [m.name, displayVariables[m.name]?.value ?? ""]),
    );
  }, [displayVariables, meta]);

  const workspaceEnvDisplayValues = useMemo((): Record<string, string> => {
    return Object.fromEntries(
      meta
        .filter((m) => displayVariables[m.name]?.fromWorkspaceEnv)
        .map((m) => [m.name, displayVariables[m.name]!.value])
        .filter(([, value]) => value !== ""),
    );
  }, [displayVariables, meta]);

  const submittedWorkspaceEnvValues = useMemo((): Record<string, string> => {
    return Object.fromEntries(
      meta
        .filter((m) => displayVariables[m.name]?.fromWorkspaceEnv)
        .map((m) => [m.name, displayVariables[m.name]!.submittedValue])
        .filter(([, value]) => value !== ""),
    );
  }, [displayVariables, meta]);

  // -------------------------------------------------------------------------
  // Form state
  // -------------------------------------------------------------------------

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [dropdownOpenAt, setDropdownOpenAt] = useState<number | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [continueOnError, setContinueOnError] = useState(
    flow.kind === "flow" ? flow.continueOnError : false,
  );

  const fieldCount = meta.length;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function setValue(name: string, val: string) {
    setValues((prev) => ({ ...prev, [name]: val }));
  }

  function trySubmit() {
    if (flow.kind !== "flow") return;
    const requiredFields = meta.filter((m) => m.required);
    const firstBlank = requiredFields.find((m) => !(values[m.name] ?? ""));
    if (firstBlank) {
      setShowErrors(true);
      const idx = meta.findIndex((m) => m.name === firstBlank.name);
      if (idx !== -1) setFocusedIndex(idx);
      return;
    }
    const submittedValues = Object.fromEntries(
      Object.entries(values).map(([name, value]) => {
        const submittedWorkspaceEnvValue = submittedWorkspaceEnvValues[name];
        if (
          submittedWorkspaceEnvValue !== undefined &&
          workspaceEnvDisplayValues[name] === value
        ) {
          return [name, submittedWorkspaceEnvValue];
        }
        return [name, value];
      }),
    );
    onSubmit(submittedValues, continueOnError);
  }

  // -------------------------------------------------------------------------
  // Form-level keyboard (disabled while any dropdown is open)
  // -------------------------------------------------------------------------

  useInput(
    (input, key) => {
      if (input === "?") {
        onHelp();
        return;
      }
      if (input === "c") {
        setContinueOnError((v) => !v);
        return;
      }
      if (key.escape) {
        onBack();
        return;
      }
      if (key.tab) {
        if (key.shift) {
          setFocusedIndex((i) => (i > 0 ? i - 1 : fieldCount - 1));
        } else {
          setFocusedIndex((i) => (i < fieldCount - 1 ? i + 1 : 0));
        }
        return;
      }
      if (key.return) {
        trySubmit();
        return;
      }
    },
    { isActive: dropdownOpenAt === null },
  );

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------

  const required = meta.filter((m) => m.required);
  const optional = meta.filter((m) => !m.required);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function renderField(m: VariableMeta, globalIndex: number) {
    const isActive = focusedIndex === globalIndex;
    const hasError = showErrors && m.required && !(values[m.name] ?? "");
    const ddOpen = dropdownOpenAt === globalIndex;
    const workspaceEnvDisplayValue = workspaceEnvDisplayValues[m.name];
    const showWorkspaceEnvHint =
      workspaceEnvDisplayValue !== undefined &&
      values[m.name] === workspaceEnvDisplayValue;

    return (
      <Box key={m.name} flexDirection="row">
        <Box width={22}>
          <Text
            color={isActive ? ORANGE : undefined}
            dimColor={!isActive && !m.required}
          >
            {m.name}
          </Text>
        </Box>
        <Box flexDirection="row">
          <EnumInput
            value={values[m.name] ?? ""}
            onChange={(v) => setValue(m.name, v)}
            enums={m.enums}
            isActive={isActive}
            hasError={hasError}
            dropdownOpen={ddOpen}
            onOpenDropdown={() => setDropdownOpenAt(globalIndex)}
            onCloseDropdown={() => setDropdownOpenAt(null)}
            onSelectDropdownItem={(item) => {
              setValue(m.name, item);
              setDropdownOpenAt(null);
            }}
          />
          {showWorkspaceEnvHint && (
            <Box marginLeft={1}>
              <Text dimColor>(from .env)</Text>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Title */}
      <Text bold color={ORANGE}>
        variables form
      </Text>
      <Text> </Text>

      {/* Required section */}
      {required.length > 0 && (
        <Box flexDirection="column">
          <Text>required</Text>
          {required.map((m) => renderField(m, meta.indexOf(m)))}
          <Text> </Text>
        </Box>
      )}

      {/* Optional section */}
      {optional.length > 0 && (
        <Box flexDirection="column">
          <Text dimColor>optional</Text>
          {optional.map((m) => renderField(m, meta.indexOf(m)))}
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>
          tab next · ↑↓ dropdown · c continue-on-error · enter run · esc back ·
          ? help
        </Text>
      </Box>
      <Box>
        <Text
          color={continueOnError ? ORANGE : undefined}
          dimColor={!continueOnError}
        >
          continue-on-error: {continueOnError ? "on" : "off"}
        </Text>
      </Box>
    </Box>
  );
}
