import React from "react";
import { Text, useInput } from "ink";
import type { AnyFlow, Environment } from "../../domain.js";

export interface EnvPickerScreenProps {
  flow: AnyFlow;
  environments: Environment[];
  onSelect: (env: Environment) => void;
  onBack: () => void;
  onHelp: () => void;
}

export function EnvPickerScreen(_props: EnvPickerScreenProps) {
  useInput((input, key) => {
    if (key.escape || input === "q") {
      _props.onBack();
    }

    if (input === "?") {
      _props.onHelp();
    }
  });

  return <Text>env picker — coming soon</Text>;
}
