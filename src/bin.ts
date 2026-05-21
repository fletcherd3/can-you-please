#!/usr/bin/env node

const [major] = process.versions.node.split(".").map(Number);

if (major < 22) {
  process.stderr.write(
    `can-you-please requires node >=22 (you have ${process.versions.node})\n`,
  );
  process.exit(1);
}

// Node version check must fire before Ink renders.
import("react").then(async (React) => {
  const { render } = await import("ink");
  const { App } = await import("./app.js");
  render(React.createElement(App));
});
