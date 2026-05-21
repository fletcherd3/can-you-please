import React from "react";
import { Text, useInput } from "ink";

export interface HelpOverlayProps {
  onClose: () => void;
}

export function HelpOverlay(_props: HelpOverlayProps) {
  useInput((input, key) => {
    if (key.escape || input === "?" || input === "q") {
      _props.onClose();
    }
  });

  return <Text>help overlay — coming soon</Text>;
}
