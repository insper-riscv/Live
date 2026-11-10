"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const core = require("../src/core");

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rv32-vscode-test-"));
}

test("SDK resolution prefers the configured path", () => {
  const home = temporaryDirectory();
  const configured = path.join(home, "configured");
  const environment = path.join(home, "environment");
  fs.mkdirSync(path.join(configured, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(environment, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(configured, "scripts", "rv32-project"), "");
  fs.writeFileSync(path.join(environment, "scripts", "rv32-project"), "");

  assert.equal(
    core.resolveLocalSdkPath({ configured, environment, home }),
    configured
  );
});

test("SDK resolution falls back to the per-user installation", () => {
  const home = temporaryDirectory();
  const installed = path.join(home, ".local", "share", "rv32-sdk");
  fs.mkdirSync(path.join(installed, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(installed, "scripts", "rv32-project"), "");

  assert.equal(core.resolveLocalSdkPath({ home }), installed);
});

test("template merge never overwrites an existing source file", () => {
  const root = temporaryDirectory();
  const source = path.join(root, "template");
  const destination = path.join(root, "project");
  fs.mkdirSync(path.join(source, "src"), { recursive: true });
  fs.mkdirSync(path.join(destination, "src"), { recursive: true });
  fs.writeFileSync(path.join(source, "src", "main.c"), "template\n");
  fs.writeFileSync(path.join(source, "rv32.toml"), "config\n");
  fs.writeFileSync(path.join(destination, "src", "main.c"), "user\n");

  const result = core.copyTree(source, destination, { overwrite: false });

  assert.equal(fs.readFileSync(path.join(destination, "src", "main.c"), "utf8"), "user\n");
  assert.equal(fs.readFileSync(path.join(destination, "rv32.toml"), "utf8"), "config\n");
  assert.equal(result.skipped.length, 1);
});

test("project names reject paths and accept simple directory names", () => {
  assert.equal(core.validProjectName("flight-control_1"), true);
  assert.equal(core.validProjectName("../outside"), false);
  assert.equal(core.validProjectName("two words"), false);
});

test("extension manifest exposes all expected RV32 actions", () => {
  const manifest = require("../package.json");
  const commands = new Set(manifest.contributes.commands.map((entry) => entry.command));
  for (const command of [
    "rv32.createCProject",
    "rv32.initializeCWorkspace",
    "rv32.prepare",
    "rv32.simulate",
    "rv32.fpgaFull",
    "rv32.fpgaFast",
    "rv32.readStdout"
  ]) {
    assert.equal(commands.has(command), true, `missing ${command}`);
  }
});

test("C template does not contain generated artifacts or duplicate SDK code", () => {
  const template = path.join(__dirname, "..", "templates", "c");
  for (const forbidden of ["build", "logs", ".rv32", "Tests", "Tools"] ) {
    assert.equal(fs.existsSync(path.join(template, forbidden)), false);
  }
  assert.equal(fs.existsSync(path.join(template, "src", "main.c")), true);
  assert.equal(fs.existsSync(path.join(template, "rv32.toml")), true);
});


test("container mounts a writable cache parent instead of a nested SOF directory", () => {
  const compose = fs.readFileSync(path.join(__dirname, "../templates/c/.devcontainer/compose.yaml"), "utf8");
  assert.ok(compose.includes("${HOME}/.cache/rv32:/home/ubuntu/.cache"));
  assert.ok(compose.includes("RV32_SOF_CACHE_DIR: /home/ubuntu/.cache/sof"));
  assert.ok(!compose.includes(":/home/ubuntu/.cache/rv32/sof"));
});


test("project template keeps editor toolbar visible despite a hidden user toolbar", () => {
  const settings = require("../templates/c/.vscode/settings.json");
  assert.equal(settings["workbench.editor.editorActionsLocation"], "default");
  assert.equal(settings["workbench.editor.alwaysShowEditorActions"], true);
  assert.equal(settings["terminal.integrated.scrollback"], 100000);
  assert.equal(settings["files.exclude"]["**/.rv32"], true);
  assert.equal(settings["C_Cpp.default.cStandard"], "c23");
  const container = require("../templates/c/.devcontainer/devcontainer.json");
  assert.ok(container.postCreateCommand.includes("bootstrap-external.sh"));
  assert.ok(container.postAttachCommand.includes("install-vscode-extension.sh"));
});
