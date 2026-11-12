"use strict";

const path = require("node:path");
const vscode = require("vscode");
const core = require("./src/core");

const ACTIONS = Object.freeze({
  prepare: { label: "RV32: Prepare Project", args: ["setup"] },
  drivers: { label: "RV32: Refresh Peripheral Drivers", args: ["drivers"] },
  doctor: { label: "RV32: Check Environment", args: ["doctor"] },
  simulate: { label: "RV32: Simulate", args: ["simulate"], matcher: ["$gcc"] },
  "fpga-full": {
    label: "RV32: Program FPGA",
    args: ["fpga", "--mode", "full"],
    matcher: ["$gcc"]
  },
  "fpga-fast": {
    label: "RV32: Fast Update FPGA",
    args: ["fpga", "--mode", "fast"],
    matcher: ["$gcc"]
  },
  "fpga-reuse": {
    label: "RV32: FPGA Reuse Existing SOF",
    args: ["fpga", "--mode", "reprogram"],
    matcher: ["$gcc"]
  },
  stdout: { label: "RV32: Read FPGA stdout", args: ["stdout"] }
});

function firstWorkspaceFolder(uri) {
  const resource = uri || vscode.window.activeTextEditor?.document.uri;
  return (resource && vscode.workspace.getWorkspaceFolder(resource)) || vscode.workspace.workspaceFolders?.[0];
}

function configuredSdkPath() {
  return vscode.workspace.getConfiguration("rv32").get("sdkPath", "");
}

function sdkPathForCurrentEnvironment() {
  if (configuredSdkPath()) return core.resolveLocalSdkPath({ configured: configuredSdkPath() });
  if (vscode.env.remoteName === "dev-container") return "/opt/rv32-sdk";
  return core.resolveLocalSdkPath({
    configured: configuredSdkPath(),
    environment: process.env.RV32_SDK_ROOT
  });
}

async function requireSdkPath() {
  const sdk = sdkPathForCurrentEnvironment();
  if (sdk) return sdk;

  const choice = await vscode.window.showErrorMessage(
    "RV32 SDK not found. Run scripts/install-user.sh once or select the SDK folder.",
    "Select SDK"
  );
  if (choice === "Select SDK") {
    await selectSdk();
    return sdkPathForCurrentEnvironment();
  }
  return undefined;
}

function buildTask(folder, sdk, actionName, projectRoot) {
  const action = ACTIONS[actionName];
  if (!action) return undefined;
  projectRoot ||= core.projectDirectory(vscode.window.activeTextEditor?.document.uri.fsPath, folder.uri.fsPath) || folder.uri.fsPath;
  const debug = vscode.workspace.getConfiguration("rv32", folder.uri).get("debug", false);
  const executable = path.join(sdk, "scripts", "rv32-project");
  const execution = new vscode.ProcessExecution(
    executable,
    [...(debug ? ["--debug"] : []), "--project", projectRoot, ...action.args],
    { cwd: projectRoot }
  );
  const task = new vscode.Task(
    { type: "rv32", action: actionName },
    folder,
    action.label,
    "RV32",
    execution,
    action.matcher || []
  );
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Shared,
    clear: true,
    echo: debug,
    showReuseMessage: debug
  };
  return task;
}

async function runAction(actionName, uri) {
  const folder = firstWorkspaceFolder(uri);
  if (!folder) {
    await vscode.window.showErrorMessage("Open an RV32 project folder first.");
    return;
  }
  const sdk = await requireSdkPath();
  if (!sdk) return;
  if (!await vscode.workspace.saveAll(false)) return;
  const busy = vscode.tasks.taskExecutions.some((execution) => execution.task.definition.type === "rv32");
  if (busy) {
    await vscode.window.showWarningMessage("An RV32 task is already running. Wait for it or stop it first.");
    return;
  }
  const resource = uri || vscode.window.activeTextEditor?.document.uri;
  const projectRoot = core.projectDirectory(resource?.fsPath, folder.uri.fsPath);
  await vscode.tasks.executeTask(buildTask(folder, sdk, actionName, projectRoot));
}

class Rv32TaskProvider {
  async provideTasks() {
    const folder = firstWorkspaceFolder();
    const sdk = sdkPathForCurrentEnvironment();
    if (!folder || !sdk) return [];
    return Object.keys(ACTIONS).map((action) => buildTask(folder, sdk, action));
  }

  async resolveTask(task) {
    const folder = firstWorkspaceFolder();
    const sdk = sdkPathForCurrentEnvironment();
    if (!folder || !sdk) return undefined;
    return buildTask(folder, sdk, task.definition.action);
  }
}

async function selectSdk() {
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    title: "Select the RV32 SDK repository"
  });
  if (!selected?.length) return;
  const candidate = selected[0].fsPath;
  if (!core.isSdkDirectory(candidate)) {
    await vscode.window.showErrorMessage(
      `${candidate} does not contain scripts/rv32-project.`
    );
    return;
  }
  await vscode.workspace
    .getConfiguration("rv32")
    .update("sdkPath", candidate, vscode.ConfigurationTarget.Global);
  await vscode.window.showInformationMessage(`RV32 SDK configured: ${candidate}`);
}

async function createProject(context, language) {
  const parent = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    title: `Choose the parent folder for the new RV32 ${language === "rust" ? "Rust" : "C"} project`
  });
  if (!parent?.length) return;

  const name = await vscode.window.showInputBox({
    prompt: "Project directory name",
    value: `rv32-${language}-app`,
    validateInput: (value) =>
      core.validProjectName(value) ? undefined : "Use letters, numbers, dot, dash, or underscore."
  });
  if (!name) return;

  const destination = path.join(parent[0].fsPath, name);
  if (!core.directoryIsEmpty(destination)) {
    await vscode.window.showErrorMessage(`Destination is not empty: ${destination}`);
    return;
  }
  core.copyTree(path.join(context.extensionPath, "templates", language), destination);

  const openNewWindow = vscode.workspace
    .getConfiguration("rv32")
    .get("openCreatedProjectInNewWindow", true);
  await vscode.commands.executeCommand(
    "vscode.openFolder",
    vscode.Uri.joinPath(parent[0], name),
    openNewWindow
  );
}

async function initializeCurrentWorkspace(context, language) {
  const folder = firstWorkspaceFolder();
  if (!folder) {
    await vscode.window.showErrorMessage("Open the destination folder first.");
    return;
  }
  const result = core.copyTree(
    path.join(context.extensionPath, "templates", language),
    folder.uri.fsPath,
    { overwrite: false }
  );
  await vscode.window.showInformationMessage(
    `RV32 infrastructure added: ${result.copied.length} file(s) created, ${result.skipped.length} existing file(s) preserved.`
  );
}

function registerAction(context, command, action) {
  context.subscriptions.push(
    vscode.commands.registerCommand(command, async (uri) => {
      try { await runAction(action, uri); }
      catch (error) { await vscode.window.showErrorMessage(`RV32: ${error.message}`); }
    })
  );
}

function activate(context) {
  const updateContext = () => {
    const folder = firstWorkspaceFolder();
    return vscode.commands.executeCommand("setContext", "rv32.project",
      Boolean(folder && core.projectDirectory(vscode.window.activeTextEditor?.document.uri.fsPath, folder.uri.fsPath)));
  };
  updateContext();
  const watcher = vscode.workspace.createFileSystemWatcher("**/rv32.toml");
  context.subscriptions.push(watcher, watcher.onDidCreate(updateContext), watcher.onDidDelete(updateContext),
    vscode.window.onDidChangeActiveTextEditor(updateContext),
    vscode.workspace.onDidChangeWorkspaceFolders(updateContext));
  context.subscriptions.push(
    vscode.tasks.registerTaskProvider("rv32", new Rv32TaskProvider()),
    vscode.commands.registerCommand("rv32.selectSdk", selectSdk),
    vscode.commands.registerCommand("rv32.toggleDebugOutput", async () => {
      const folder = firstWorkspaceFolder();
      const config = vscode.workspace.getConfiguration("rv32", folder?.uri);
      const enabled = !config.get("debug", false);
      await config.update("debug", enabled, folder ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage(`RV32 Debug Output: ${enabled ? "On" : "Off"}`);
    }),
    vscode.commands.registerCommand("rv32.createCProject", () => createProject(context, "c")),
    vscode.commands.registerCommand("rv32.createRustProject", () => createProject(context, "rust")),
    vscode.commands.registerCommand("rv32.initializeCWorkspace", () =>
      initializeCurrentWorkspace(context, "c")
    ),
    vscode.commands.registerCommand("rv32.initializeRustWorkspace", () =>
      initializeCurrentWorkspace(context, "rust")
    ),
    vscode.commands.registerCommand("rv32.reopenInContainer", async () => {
      try {
        await vscode.commands.executeCommand("remote-containers.reopenInContainer");
      } catch {
        await vscode.window.showErrorMessage(
          "Install the Microsoft Dev Containers extension first."
        );
      }
    })
  );

  registerAction(context, "rv32.prepare", "prepare");
  registerAction(context, "rv32.doctor", "doctor");
  registerAction(context, "rv32.refreshDrivers", "drivers");
  registerAction(context, "rv32.simulate", "simulate");
  registerAction(context, "rv32.fpgaFull", "fpga-full");
  registerAction(context, "rv32.fpgaFast", "fpga-fast");
  registerAction(context, "rv32.fpgaReuse", "fpga-reuse");
  registerAction(context, "rv32.readStdout", "stdout");
}

function deactivate() {}

module.exports = { activate, deactivate };
