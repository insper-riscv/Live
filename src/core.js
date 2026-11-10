"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function expandHome(value, home = os.homedir()) {
  if (!value) return "";
  if (value === "~") return home;
  if (value.startsWith(`~${path.sep}`)) return path.join(home, value.slice(2));
  return path.resolve(value);
}

function isSdkDirectory(candidate, exists = fs.existsSync) {
  return Boolean(candidate) && exists(path.join(candidate, "scripts", "rv32-project"));
}

function resolveLocalSdkPath(options = {}) {
  const home = options.home || os.homedir();
  const exists = options.exists || fs.existsSync;
  const candidates = [
    expandHome(options.configured || "", home),
    expandHome(options.environment || "", home),
    path.join(home, ".local", "share", "rv32-sdk")
  ].filter(Boolean);

  return candidates.find((candidate) => isSdkDirectory(candidate, exists));
}

function directoryIsEmpty(directory) {
  return !fs.existsSync(directory) || fs.readdirSync(directory).length === 0;
}

function copyTree(source, destination, options = {}) {
  const overwrite = Boolean(options.overwrite);
  const copied = [];
  const skipped = [];

  function copy(currentSource, currentDestination) {
    const stat = fs.statSync(currentSource);
    if (stat.isDirectory()) {
      fs.mkdirSync(currentDestination, { recursive: true });
      for (const entry of fs.readdirSync(currentSource)) {
        copy(path.join(currentSource, entry), path.join(currentDestination, entry));
      }
      return;
    }

    if (!overwrite && fs.existsSync(currentDestination)) {
      skipped.push(currentDestination);
      return;
    }
    fs.mkdirSync(path.dirname(currentDestination), { recursive: true });
    fs.copyFileSync(currentSource, currentDestination);
    copied.push(currentDestination);
  }

  copy(source, destination);
  return { copied, skipped };
}

function validProjectName(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value || "");
}

module.exports = {
  copyTree,
  directoryIsEmpty,
  expandHome,
  isSdkDirectory,
  resolveLocalSdkPath,
  validProjectName
};
