import React from "react";
import { Text } from "ink";

export interface SetupWizardScreenProps {
  onDone: (workspacePath: string) => void;
}

export function SetupWizardScreen(_props: SetupWizardScreenProps) {
  return <Text>setup wizard — coming soon</Text>;
}
