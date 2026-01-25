# PowerShell Path Resolver

When a tool assumes `pwsh` or `powershell` is on PATH, Windows machines
without PowerShell in PATH fail fast. This small helper resolves PowerShell
from PATH or common Windows install locations and provides a clearer message
when it cannot be found.

## Usage

### CLI

```bash
node bin/check-powershell.js
```

If PowerShell is found, the script prints the resolved path and exits with code
0. If not, it prints a helpful install message and exits with code 1.

### Programmatic

```js
import { resolvePowerShellExecutable, resolveShell } from "./src/shell-resolver.js";

const powershell = resolvePowerShellExecutable();
if (!powershell) {
  // Fall back to another shell or surface a friendly error.
  const fallback = resolveShell();
  console.log(fallback);
}
```

## Tests

```bash
npm test
```

## Node version

This project targets Node.js 18 or newer.
