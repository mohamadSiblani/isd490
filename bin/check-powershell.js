#!/usr/bin/env node
import {
  formatMissingPowerShellMessage,
  resolvePowerShellExecutable,
} from "../src/shell-resolver.js";

const result = resolvePowerShellExecutable();

if (result) {
  process.stdout.write(`${result.path}\n`);
  process.exit(0);
}

console.error(formatMissingPowerShellMessage());
process.exit(1);
