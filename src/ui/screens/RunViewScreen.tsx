import React from "react";
import { Text, useInput } from "ink";
import type { AnyFlow, Environment } from "../../domain.js";

export interface RunViewScreenProps {
  flow: AnyFlow;
  env: Environment;
  variables: Record<string, string>;
  continueOnError: boolean;
  onBack: () => void;
  onHelp: () => void;
}

export function RunViewScreen(_props: RunViewScreenProps) {
  useInput((input, key) => {
    if (key.escape || input === "q") {
      _props.onBack();
    }

    if (input === "?") {
      _props.onHelp();
    }
  });

  return <Text>run view — coming soon</Text>;
}
