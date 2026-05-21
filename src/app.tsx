import React, { useEffect, useState } from "react";
import { useApp, useInput } from "ink";
import { readConfig } from "./config.js";
import { loadWorkspace, isValidWorkspace } from "./workspace/index.js";
import { detectVariables } from "./variables/index.js";
import type { AnyFlow, Environment, Workspace } from "./domain.js";
import { SetupWizardScreen } from "./ui/screens/SetupWizardScreen.js";
import { FlowPickerScreen } from "./ui/screens/FlowPickerScreen.js";
import { EnvPickerScreen } from "./ui/screens/EnvPickerScreen.js";
import { VariablesFormScreen } from "./ui/screens/VariablesFormScreen.js";
import { RunViewScreen } from "./ui/screens/RunViewScreen.js";
import { HelpOverlay } from "./ui/screens/HelpOverlay.js";

// ---------------------------------------------------------------------------
// Screen state discriminated union
// ---------------------------------------------------------------------------

export type ScreenState =
  | { screen: "setup-wizard"; brokenPath?: string }
  | { screen: "flow-picker"; workspace: Workspace }
  | {
      screen: "env-picker";
      workspace: Workspace;
      flow: AnyFlow;
      activeEnvId: string | null;
    }
  | {
      screen: "variables-form";
      workspace: Workspace;
      flow: AnyFlow;
      env: Environment;
    }
  | {
      screen: "run-view";
      workspace: Workspace;
      flow: AnyFlow;
      env: Environment;
      variables: Record<string, string>;
      continueOnError: boolean;
    };

// ---------------------------------------------------------------------------
// App root
// ---------------------------------------------------------------------------

export function App() {
  const { exit } = useApp();

  const [screenState, setScreenState] = useState<ScreenState>({
    screen: "setup-wizard",
  });
  const [showHelp, setShowHelp] = useState(false);
  const [loading, setLoading] = useState(true);

  // On mount: read config and route to the appropriate initial screen.
  useEffect(() => {
    (async () => {
      const config = await readConfig();
      if (config == null) {
        setScreenState({ screen: "setup-wizard" });
        setLoading(false);
        return;
      }

      let workspace: Workspace;
      try {
        workspace = await loadWorkspace(config.workspacePath);
      } catch {
        setScreenState({
          screen: "setup-wizard",
          brokenPath: config.workspacePath,
        });
        setLoading(false);
        return;
      }

      if (!isValidWorkspace(workspace)) {
        setScreenState({
          screen: "setup-wizard",
          brokenPath: config.workspacePath,
        });
        setLoading(false);
        return;
      }

      setScreenState({ screen: "flow-picker", workspace });
      setLoading(false);
    })().catch(() => {
      setScreenState({ screen: "setup-wizard" });
      setLoading(false);
    });
  }, []);

  // Global ctrl+c hard-quit (SIGINT).
  useEffect(() => {
    const handler = () => {
      exit();
      process.exit(0);
    };
    process.on("SIGINT", handler);
    return () => {
      process.off("SIGINT", handler);
    };
  }, [exit]);

  // Global '?' hotkey — open help overlay from any screen.
  useInput(
    (input) => {
      if (input === "?") {
        setShowHelp(true);
      }
    },
    { isActive: !showHelp },
  );

  if (loading) return null;

  if (showHelp) {
    return <HelpOverlay onClose={() => setShowHelp(false)} />;
  }

  // ------------------------------------------------------------------
  // Screen routing
  // ------------------------------------------------------------------

  if (screenState.screen === "setup-wizard") {
    return (
      <SetupWizardScreen
        brokenPath={screenState.brokenPath}
        onDone={async (workspacePath) => {
          const workspace = await loadWorkspace(workspacePath);
          setScreenState({ screen: "flow-picker", workspace });
        }}
      />
    );
  }

  if (screenState.screen === "flow-picker") {
    const { workspace } = screenState;
    return (
      <FlowPickerScreen
        workspace={workspace}
        onSelect={(flow, activeEnvId) => {
          // Skip env-picker when flow declares exactly one environment.
          if (flow.kind === "flow" && flow.environments.length === 1) {
            const singleEnv = workspace.environments.find((e) =>
              flow.environments.includes(e.id),
            );
            if (singleEnv != null) {
              const vars = detectVariables(flow);
              if (vars.length === 0) {
                setScreenState({
                  screen: "run-view",
                  workspace,
                  flow,
                  env: singleEnv,
                  variables: {},
                  continueOnError: flow.continueOnError,
                });
              } else {
                setScreenState({
                  screen: "variables-form",
                  workspace,
                  flow,
                  env: singleEnv,
                });
              }
              return;
            }
          }
          setScreenState({
            screen: "env-picker",
            workspace,
            flow,
            activeEnvId,
          });
        }}
        onReload={(newWorkspace) => {
          setScreenState({ screen: "flow-picker", workspace: newWorkspace });
        }}
        onQuit={() => {
          exit();
        }}
        onHelp={() => setShowHelp(true)}
      />
    );
  }

  if (screenState.screen === "env-picker") {
    const { workspace, flow, activeEnvId } = screenState;
    return (
      <EnvPickerScreen
        flow={flow}
        environments={workspace.environments}
        initialEnvId={activeEnvId}
        onSelect={(env) => {
          // Skip variables-form when flow references zero variables.
          if (flow.kind === "flow") {
            const vars = detectVariables(flow);
            if (vars.length === 0) {
              setScreenState({
                screen: "run-view",
                workspace,
                flow,
                env,
                variables: {},
                continueOnError: flow.continueOnError,
              });
              return;
            }
          }
          setScreenState({
            screen: "variables-form",
            workspace,
            flow,
            env,
          });
        }}
        onBack={() => {
          setScreenState({ screen: "flow-picker", workspace });
        }}
        onHelp={() => setShowHelp(true)}
      />
    );
  }

  if (screenState.screen === "variables-form") {
    const { workspace, flow, env } = screenState;
    return (
      <VariablesFormScreen
        flow={flow}
        env={env}
        globals={workspace.globals}
        onSubmit={(variables, continueOnError) => {
          setScreenState({
            screen: "run-view",
            workspace,
            flow,
            env,
            variables,
            continueOnError,
          });
        }}
        onBack={() => {
          setScreenState({
            screen: "env-picker",
            workspace,
            flow,
            activeEnvId: null,
          });
        }}
        onHelp={() => setShowHelp(true)}
      />
    );
  }

  if (screenState.screen === "run-view") {
    const { workspace, flow, env, variables, continueOnError } = screenState;
    return (
      <RunViewScreen
        flow={flow}
        env={env}
        variables={variables}
        continueOnError={continueOnError}
        onBack={() => {
          setScreenState({ screen: "flow-picker", workspace });
        }}
        onHelp={() => setShowHelp(true)}
      />
    );
  }

  // Exhaustive check — TypeScript will catch unhandled states.
  const _exhaustive: never = screenState;
  void _exhaustive;
  return null;
}
