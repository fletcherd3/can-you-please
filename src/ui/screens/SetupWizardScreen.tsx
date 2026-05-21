import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname, basename, sep } from "node:path";
import { loadWorkspace, isValidWorkspace } from "../../workspace/index.js";
import { writeConfig } from "../../config.js";
import { scaffoldWorkspace } from "../../workspace/scaffold.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORANGE = "#ff8700"; // ANSI 256:208
const DEFAULT_WORKSPACE_NAME = "can-you-please-collection";
const MAX_SUGGESTIONS = 8;

const MODES = [
  "point me at an existing collection repo",
  "scaffold a new one",
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SetupWizardScreenProps {
  /** Called with the resolved workspace root path on success. */
  onDone: (workspacePath: string) => void;
  /**
   * When the app boots with a configured path that fails `isValidWorkspace`,
   * the broken path is forwarded here so the wizard pre-fills it.
   */
  brokenPath?: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "mode-select" | "existing-path" | "scaffold-config";
type ScaffoldField = "parent" | "name";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function expandTilde(p: string): string {
  if (p === "~" || p.startsWith("~" + sep) || p.startsWith("~/")) {
    return homedir() + p.slice(1);
  }
  return p;
}

async function listSubdirs(input: string): Promise<string[]> {
  if (!input) return [];
  const expanded = expandTilde(input);

  let dir: string;
  let prefix: string;

  if (expanded.endsWith(sep) || expanded.endsWith("/")) {
    dir = expanded;
    prefix = "";
  } else {
    dir = dirname(expanded);
    prefix = basename(expanded);
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const showHidden = prefix.startsWith(".");
    return entries
      .filter(
        (e) =>
          e.isDirectory() &&
          e.name.startsWith(prefix) &&
          (showHidden || !e.name.startsWith(".")),
      )
      .map((e) => join(dir, e.name) + sep)
      .slice(0, MAX_SUGGESTIONS);
  } catch {
    return [];
  }
}

function longestCommonPrefix(strs: string[]): string {
  if (strs.length === 0) return "";
  let prefix = strs[0]!;
  for (const s of strs) {
    while (!s.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (!prefix) return "";
    }
  }
  return prefix;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetupWizardScreen({
  onDone,
  brokenPath,
}: SetupWizardScreenProps) {
  // If a broken path was given, jump straight to the existing-path step.
  const [step, setStep] = useState<Step>(
    brokenPath != null ? "existing-path" : "mode-select",
  );

  // --- mode-select ---
  const [modeIndex, setModeIndex] = useState(0);

  // --- existing-path ---
  const [pathInput, setPathInput] = useState(brokenPath ?? "");
  const [pathError, setPathError] = useState<string | null>(
    brokenPath != null ? "no valid workspace found at that path" : null,
  );
  const [pathSuggestions, setPathSuggestions] = useState<string[]>([]);
  const [pathSugIndex, setPathSugIndex] = useState(-1);

  // --- scaffold-config ---
  const [scaffoldParent, setScaffoldParent] = useState("");
  const [scaffoldName, setScaffoldName] = useState(DEFAULT_WORKSPACE_NAME);
  const [scaffoldField, setScaffoldField] = useState<ScaffoldField>("parent");
  const [scaffoldParentSuggestions, setScaffoldParentSuggestions] = useState<
    string[]
  >([]);
  const [scaffoldError, setScaffoldError] = useState<string | null>(null);

  // --- submission guard ---
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Suggestion side-effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (step !== "existing-path") return;
    let cancelled = false;
    void listSubdirs(pathInput).then((s) => {
      if (!cancelled) {
        setPathSuggestions(s);
        setPathSugIndex(-1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pathInput, step]);

  useEffect(() => {
    if (step !== "scaffold-config" || scaffoldField !== "parent") return;
    let cancelled = false;
    void listSubdirs(scaffoldParent).then((s) => {
      if (!cancelled) setScaffoldParentSuggestions(s);
    });
    return () => {
      cancelled = true;
    };
  }, [scaffoldParent, step, scaffoldField]);

  // ---------------------------------------------------------------------------
  // Async submission handlers
  // ---------------------------------------------------------------------------

  function handleExistingPathSubmit() {
    if (isSubmitting) return;
    const resolved = expandTilde(pathInput.trim());
    if (!resolved) {
      setPathError("path is required");
      return;
    }
    setIsSubmitting(true);
    setPathError(null);
    void (async () => {
      try {
        const ws = await loadWorkspace(resolved);
        if (!isValidWorkspace(ws)) {
          setPathError("no valid workspace found at that path");
          setIsSubmitting(false);
          return;
        }
        await writeConfig({ workspacePath: resolved });
        onDone(resolved);
      } catch {
        setPathError("no valid workspace found at that path");
        setIsSubmitting(false);
      }
    })();
  }

  function handleScaffoldSubmit() {
    if (isSubmitting) return;
    const expandedParent = expandTilde(scaffoldParent.trim());
    const name = scaffoldName.trim() || DEFAULT_WORKSPACE_NAME;
    if (!expandedParent) {
      setScaffoldError("parent directory is required");
      return;
    }
    setIsSubmitting(true);
    setScaffoldError(null);
    void (async () => {
      try {
        const workspacePath = await scaffoldWorkspace(expandedParent, name);
        await writeConfig({ workspacePath });
        onDone(workspacePath);
      } catch (err) {
        setScaffoldError(
          err instanceof Error ? err.message : "failed to create workspace",
        );
        setIsSubmitting(false);
      }
    })();
  }

  // ---------------------------------------------------------------------------
  // Keyboard handling
  // ---------------------------------------------------------------------------

  useInput(
    (input, key) => {
      // --- mode-select ---
      if (step === "mode-select") {
        if (key.upArrow || input === "k") {
          setModeIndex((i) => Math.max(0, i - 1));
        } else if (key.downArrow || input === "j") {
          setModeIndex((i) => Math.min(MODES.length - 1, i + 1));
        } else if (key.return) {
          if (modeIndex === 0) {
            setStep("existing-path");
          } else {
            setStep("scaffold-config");
          }
        }
        return;
      }

      // --- existing-path ---
      if (step === "existing-path") {
        if (key.escape) {
          setStep("mode-select");
          setPathError(null);
          return;
        }
        if (key.tab) {
          const lcp = longestCommonPrefix(pathSuggestions);
          if (lcp.length > pathInput.length) {
            setPathInput(lcp);
          }
          return;
        }
        if (key.upArrow) {
          setPathSugIndex((i) => Math.max(-1, i - 1));
          return;
        }
        if (key.downArrow) {
          setPathSugIndex((i) => Math.min(pathSuggestions.length - 1, i + 1));
          return;
        }
        if (key.return) {
          // If a suggestion is highlighted, adopt it first.
          if (pathSugIndex >= 0 && pathSuggestions[pathSugIndex] != null) {
            setPathInput(pathSuggestions[pathSugIndex]!);
            setPathSugIndex(-1);
          } else {
            handleExistingPathSubmit();
          }
          return;
        }
        if (key.backspace || key.delete) {
          setPathInput((v) => v.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          setPathInput((v) => v + input);
        }
        return;
      }

      // --- scaffold-config ---
      if (step === "scaffold-config") {
        if (key.escape) {
          setStep("mode-select");
          setScaffoldError(null);
          return;
        }
        if (key.tab) {
          if (scaffoldField === "parent") {
            // Tab-complete if LCP is longer than current input.
            const lcp = longestCommonPrefix(scaffoldParentSuggestions);
            if (lcp.length > scaffoldParent.length) {
              setScaffoldParent(lcp);
            } else {
              setScaffoldField("name");
            }
          } else {
            setScaffoldField("parent");
          }
          return;
        }
        if (key.downArrow || (key.return && scaffoldField === "parent")) {
          setScaffoldField("name");
          return;
        }
        if (key.upArrow && scaffoldField === "name") {
          setScaffoldField("parent");
          return;
        }
        if (key.return && scaffoldField === "name") {
          handleScaffoldSubmit();
          return;
        }
        if (key.backspace || key.delete) {
          if (scaffoldField === "parent") {
            setScaffoldParent((v) => v.slice(0, -1));
          } else {
            setScaffoldName((v) => v.slice(0, -1));
          }
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          if (scaffoldField === "parent") {
            setScaffoldParent((v) => v + input);
          } else {
            setScaffoldName((v) => v + input);
          }
        }
        return;
      }
    },
    { isActive: !isSubmitting },
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color={ORANGE}>
        setup wizard
      </Text>
      <Text> </Text>

      {/* ---- mode-select ---- */}
      {step === "mode-select" && (
        <Box flexDirection="column">
          <Text>how would you like to set up your workspace?</Text>
          <Text> </Text>
          {MODES.map((mode, i) => (
            <Box key={mode}>
              <Text
                color={i === modeIndex ? ORANGE : undefined}
                bold={i === modeIndex}
              >
                {i === modeIndex ? "> " : "  "}
                {mode}
              </Text>
            </Box>
          ))}
          <Text> </Text>
          <Text dimColor>↑↓ navigate · enter select</Text>
        </Box>
      )}

      {/* ---- existing-path ---- */}
      {step === "existing-path" && (
        <Box flexDirection="column">
          <Box>
            <Text>workspace path: </Text>
            <Text color={ORANGE}>{pathInput}</Text>
            <Text>█</Text>
          </Box>
          {pathSuggestions.length > 0 && (
            <Box flexDirection="column" marginLeft={2}>
              {pathSuggestions.map((s, i) => (
                <Text
                  key={s}
                  color={i === pathSugIndex ? ORANGE : undefined}
                  dimColor={i !== pathSugIndex}
                >
                  {s}
                </Text>
              ))}
            </Box>
          )}
          {pathError != null && <Text color="red">{pathError}</Text>}
          <Text> </Text>
          <Text dimColor>tab complete · esc back · enter confirm</Text>
        </Box>
      )}

      {/* ---- scaffold-config ---- */}
      {step === "scaffold-config" && (
        <Box flexDirection="column">
          <Box>
            <Text>parent directory: </Text>
            <Text color={scaffoldField === "parent" ? ORANGE : undefined}>
              {scaffoldParent}
            </Text>
            {scaffoldField === "parent" && <Text>█</Text>}
          </Box>
          {scaffoldField === "parent" &&
            scaffoldParentSuggestions.length > 0 && (
              <Box flexDirection="column" marginLeft={2}>
                {scaffoldParentSuggestions.map((s) => (
                  <Text key={s} dimColor>
                    {s}
                  </Text>
                ))}
              </Box>
            )}
          <Text> </Text>
          <Box>
            <Text>workspace name: </Text>
            <Text color={scaffoldField === "name" ? ORANGE : undefined}>
              {scaffoldName}
            </Text>
            {scaffoldField === "name" && <Text>█</Text>}
          </Box>
          {scaffoldError != null && <Text color="red">{scaffoldError}</Text>}
          <Text> </Text>
          <Text dimColor>tab complete · esc back · enter create</Text>
        </Box>
      )}
    </Box>
  );
}
