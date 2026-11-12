"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

test("Rust creation opens a complete project and initialization preserves user code", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rv32-create-"));
  const existing = path.join(root, "existing");
  fs.mkdirSync(path.join(existing, "src"), { recursive: true });
  fs.writeFileSync(path.join(existing, "src/main.rs"), "// user source\n");
  const folder = { uri: { fsPath: existing } };
  const commands = new Map();
  const opened = [];
  const errors = [];
  const event = () => ({ dispose() {} });
  const mock = {
    workspace: {
      workspaceFolders: [folder],
      getWorkspaceFolder: () => folder,
      getConfiguration: () => ({ get: (_key, fallback) => fallback }),
      createFileSystemWatcher: () => ({ dispose() {}, onDidCreate: event, onDidDelete: event }),
      onDidChangeWorkspaceFolders: event
    },
    window: {
      onDidChangeActiveTextEditor: event,
      showOpenDialog: async () => [{ fsPath: root, scheme: "vscode-remote", authority: "ssh-remote+lab" }],
      showInputBox: async () => "new-rust",
      showErrorMessage: async (message) => errors.push(message),
      showInformationMessage: async () => {}
    },
    commands: {
      registerCommand: (name, callback) => { commands.set(name, callback); return event(); },
      executeCommand: async (name, ...args) => {
        if (name === "vscode.openFolder") opened.push(args);
      }
    },
    tasks: { registerTaskProvider: event },
    Uri: { joinPath: (parent, name) => ({ ...parent, fsPath: path.join(parent.fsPath, name) }) }
  };
  const original = Module._load;
  Module._load = function(name, ...args) {
    return name === "vscode" ? mock : original.call(this, name, ...args);
  };
  try {
    delete require.cache[require.resolve("../extension")];
    require("../extension").activate({ subscriptions: [], extensionPath: path.dirname(__dirname) });
  } finally {
    Module._load = original;
  }
  try {
    await commands.get("rv32.createRustProject")();
    const project = path.join(root, "new-rust");
    for (const name of ["Cargo.toml", "rv32.toml", "src/main.rs", ".cargo/config.toml",
      ".devcontainer/devcontainer.json", ".devcontainer/compose.yaml", ".vscode/settings.json", ".vscode/tasks.json"]) {
      assert.ok(fs.existsSync(path.join(project, name)), name);
    }
    assert.match(fs.readFileSync(path.join(project, "rv32.toml"), "utf8"), /language = "rust"/);
    assert.equal(fs.existsSync(path.join(project, "src/main.c")), false);
    assert.equal(opened[0][0].fsPath, project);
    assert.equal(opened[0][0].scheme, "vscode-remote");
    assert.equal(opened[0][0].authority, "ssh-remote+lab");

    await commands.get("rv32.createRustProject")();
    assert.equal(errors.length, 1);
    assert.match(errors[0], /not empty/);

    await commands.get("rv32.initializeRustWorkspace")();
    assert.equal(fs.readFileSync(path.join(existing, "src/main.rs"), "utf8"), "// user source\n");
    assert.ok(fs.existsSync(path.join(existing, ".devcontainer/devcontainer.json")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
