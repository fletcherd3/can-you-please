#!/usr/bin/env node

const [major] = process.versions.node.split(".").map(Number);

if (major < 22) {
  process.stderr.write(
    `can-you-please requires node >=22 (you have ${process.versions.node})\n`,
  );
  process.exit(1);
}

// TODO: launch TUI
process.stdout.write("not yet implemented\n");
process.exit(0);
