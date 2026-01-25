import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  resolvePowerShellExecutable,
  resolveShell,
} from "../src/shell-resolver.js";

function createFs(existingPaths) {
  const files = new Set(existingPaths);
  return {
    statSync(filePath) {
      if (!files.has(filePath)) {
        const error = new Error("ENOENT");
        error.code = "ENOENT";
        throw error;
      }
      return { isFile: () => true };
    },
  };
}

test("resolves pwsh from PATH on posix", () => {
  const env = { PATH: "/usr/bin:/bin" };
  const fs = createFs(["/usr/bin/pwsh"]);
  const result = resolvePowerShellExecutable({
    env,
    platform: "linux",
    fs,
    path: path.posix,
  });

  assert.deepEqual(result, {
    path: "/usr/bin/pwsh",
    name: "pwsh",
    source: "PATH",
  });
});

test("resolves pwsh from PATH with PATHEXT on windows", () => {
  const env = {
    PATH: "C:\\Tools;C:\\Windows\\System32",
    PATHEXT: ".EXE;.CMD",
  };
  const fs = createFs(["C:\\Tools\\pwsh.exe"]);
  const result = resolvePowerShellExecutable({
    env,
    platform: "win32",
    fs,
    path: path.win32,
  });

  assert.deepEqual(result, {
    path: "C:\\Tools\\pwsh.exe",
    name: "pwsh",
    source: "PATH",
  });
});

test("resolves pwsh from default install paths on windows", () => {
  const env = {
    PATH: "",
    ProgramFiles: "C:\\Program Files",
    SystemRoot: "C:\\Windows",
  };
  const fs = createFs(["C:\\Program Files\\PowerShell\\7\\pwsh.exe"]);
  const result = resolvePowerShellExecutable({
    env,
    platform: "win32",
    fs,
    path: path.win32,
  });

  assert.deepEqual(result, {
    path: "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    name: "pwsh",
    source: "default-path",
  });
});

test("falls back to ComSpec when PowerShell is missing on windows", () => {
  const env = {
    PATH: "",
    ComSpec: "C:\\Windows\\System32\\cmd.exe",
  };
  const fs = createFs(["C:\\Windows\\System32\\cmd.exe"]);
  const result = resolveShell({
    env,
    platform: "win32",
    fs,
    path: path.win32,
  });

  assert.deepEqual(result, {
    path: "C:\\Windows\\System32\\cmd.exe",
    name: "cmd.exe",
    source: "ComSpec",
    kind: "cmd",
  });
});

test("uses SHELL when PowerShell is missing on posix", () => {
  const env = {
    PATH: "/usr/bin:/bin",
    SHELL: "/bin/zsh",
  };
  const fs = createFs(["/bin/zsh"]);
  const result = resolveShell({
    env,
    platform: "linux",
    fs,
    path: path.posix,
  });

  assert.deepEqual(result, {
    path: "/bin/zsh",
    name: "zsh",
    source: "SHELL",
    kind: "posix",
  });
});
