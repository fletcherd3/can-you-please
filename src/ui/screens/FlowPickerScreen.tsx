import React from "react";
import { Text, useInput, useApp } from "ink";
import type { AnyFlow } from "../../domain.js";

export interface FlowPickerScreenProps {
  flows: AnyFlow[];
  onSelect: (flow: AnyFlow) => void;
  onQuit: () => void;
  onHelp: () => void;
}

export function FlowPickerScreen(_props: FlowPickerScreenProps) {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === "q") {
      _props.onQuit();
      exit();
    }

    if (input === "?") {
      _props.onHelp();
    }

    void key;
  });

  return <Text>flow picker — coming soon</Text>;
}
