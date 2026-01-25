import fs from "node:fs";
import path from "node:path";

const DEFAULT_WINDOWS_PATHEXT = ".COM;.EXE;.BAT;.CMD";

function stripQuotes(value) {
  if (!value) {
    return value;
  }

  if (value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1);
  }

  return value;
}

function splitPathList(pathValue, platform) {
  const delimiter = platform === "win32" ? ";" : ":";
  return (pathValue || "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(stripQuotes);
}

function getPathExtList(env) {
  const pathExtValue = env.PATHEXT || DEFAULT_WINDOWS_PATHEXT;
  return pathExtValue
    .split(";")
    .map((ext) => ext.trim())
    .filter(Boolean)
    .map((ext) => ext.toLowerCase());
}

function fileExists(fsModule, filePath) {
  try {
    if (typeof fsModule.statSync === "function") {
      return fsModule.statSync(filePath).isFile();
    }
    if (typeof fsModule.existsSync === "function") {
      return fsModule.existsSync(filePath);
    }
  } catch {
    return false;
  }

  return false;
}

function buildCandidateFileNames(name, platform, env, pathModule) {
  if (platform !== "win32") {
    return [name];
  }

  if (pathModule.extname(name)) {
    return [name];
  }

  const extensions = getPathExtList(env);
  return extensions.map((ext) => `${name}${ext.toLowerCase()}`);
}

function findExecutableOnPath(names, options) {
  const { env, platform, fs: fsModule, path: pathModule } = options;
  const pathEntries = splitPathList(env.PATH, platform);

  for (const directory of pathEntries) {
    for (const name of names) {
      const candidates = buildCandidateFileNames(
        name,
        platform,
        env,
        pathModule
      );
      for (const candidate of candidates) {
        const candidatePath = pathModule.join(directory, candidate);
        if (fileExists(fsModule, candidatePath)) {
          return { path: candidatePath, name, source: "PATH" };
        }
      }
    }
  }

  return null;
}

function getDefaultWindowsPowerShellPaths(env, pathModule) {
  const programFiles = env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = env["ProgramFiles(x86)"];
  const systemRoot = env.SystemRoot || "C:\\Windows";
  const defaults = [
    pathModule.join(programFiles, "PowerShell", "7", "pwsh.exe"),
    pathModule.join(programFiles, "PowerShell", "7-preview", "pwsh.exe"),
  ];

  if (programFilesX86) {
    defaults.push(
      pathModule.join(programFilesX86, "PowerShell", "7", "pwsh.exe"),
      pathModule.join(programFilesX86, "PowerShell", "7-preview", "pwsh.exe")
    );
  }

  defaults.push(
    pathModule.join(
      systemRoot,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe"
    )
  );

  return defaults;
}

export function resolvePowerShellExecutable(options = {}) {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const fsModule = options.fs || fs;
  const pathModule = options.path || path;

  const fromPath = findExecutableOnPath(["pwsh", "powershell"], {
    env,
    platform,
    fs: fsModule,
    path: pathModule,
  });

  if (fromPath) {
    return fromPath;
  }

  if (platform === "win32") {
    const defaults = getDefaultWindowsPowerShellPaths(env, pathModule);
    for (const candidate of defaults) {
      if (fileExists(fsModule, candidate)) {
        return {
          path: candidate,
          name: pathModule.basename(candidate, pathModule.extname(candidate)),
          source: "default-path",
        };
      }
    }
  }

  return null;
}

export function resolveShell(options = {}) {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const fsModule = options.fs || fs;
  const pathModule = options.path || path;

  const powershell = resolvePowerShellExecutable({
    env,
    platform,
    fs: fsModule,
    path: pathModule,
  });

  if (powershell) {
    return {
      ...powershell,
      kind: "powershell",
    };
  }

  if (platform === "win32") {
    if (env.ComSpec && fileExists(fsModule, env.ComSpec)) {
      return {
        path: env.ComSpec,
        name: pathModule.basename(env.ComSpec),
        source: "ComSpec",
        kind: "cmd",
      };
    }

    const cmdFromPath = findExecutableOnPath(["cmd"], {
      env,
      platform,
      fs: fsModule,
      path: pathModule,
    });

    if (cmdFromPath) {
      return {
        ...cmdFromPath,
        kind: "cmd",
      };
    }

    return null;
  }

  if (env.SHELL && fileExists(fsModule, env.SHELL)) {
    return {
      path: env.SHELL,
      name: pathModule.basename(env.SHELL),
      source: "SHELL",
      kind: "posix",
    };
  }

  const posixFallback = findExecutableOnPath(["bash", "sh"], {
    env,
    platform,
    fs: fsModule,
    path: pathModule,
  });

  if (posixFallback) {
    return {
      ...posixFallback,
      kind: "posix",
    };
  }

  const defaultShell = "/bin/sh";
  if (fileExists(fsModule, defaultShell)) {
    return {
      path: defaultShell,
      name: "sh",
      source: "default",
      kind: "posix",
    };
  }

  return null;
}

export function formatMissingPowerShellMessage(options = {}) {
  const platform = options.platform || process.platform;
  const lines = [
    "Neither 'pwsh' (PowerShell Core) nor 'powershell' (Windows PowerShell) was found in PATH.",
  ];

  if (platform === "win32") {
    lines.push(
      "",
      "Install PowerShell and ensure it is on PATH:",
      "  winget install Microsoft.PowerShell",
      "",
      "If PowerShell is already installed, add one of these to PATH:",
      "  C:\\Program Files\\PowerShell\\7",
      "  C:\\Windows\\System32\\WindowsPowerShell\\v1.0"
    );
  } else {
    lines.push(
      "",
      "Install PowerShell and ensure it is on PATH:",
      "  https://learn.microsoft.com/powershell/scripting/install/installing-powershell"
    );
  }

  return lines.join("\n");
}
