import React from "react";
import { Text, useInput } from "ink";
import type { AnyFlow, Environment } from "../../domain.js";

export interface VariablesFormScreenProps {
  flow: AnyFlow;
  env: Environment;
  onSubmit: (
    variables: Record<string, string>,
    continueOnError: boolean,
  ) => void;
  onBack: () => void;
  onHelp: () => void;
}

export function VariablesFormScreen(_props: VariablesFormScreenProps) {
  useInput((input, key) => {
    if (key.escape || input === "q") {
      _props.onBack();
    }

    if (input === "?") {
      _props.onHelp();
    }
  });

  return <Text>variables form — coming soon</Text>;
}
