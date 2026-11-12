"use strict";
const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

test('editor buttons support C and Rust RV32 projects', () => {
  const m = require('../package.json');
  const buttons = m.contributes.menus['editor/title'];
  assert.equal(buttons.length, 3);
  assert.ok(m.activationEvents.includes("onLanguage:c"));
  assert.ok(m.activationEvents.includes("onLanguage:rust"));
  for (const button of buttons) {
    assert.equal(button.when, '(resourceLangId == c || resourceLangId == rust) && rv32.project');
    assert.ok(m.contributes.commands.find(c => c.command === button.command).icon);
  }
});

test('activation, active workspace, saving, task arguments and busy guard', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rv32-host-'));
  const sdk = path.join(root, 'sdk'); fs.mkdirSync(path.join(sdk, 'scripts'), {recursive:true});
  fs.writeFileSync(path.join(sdk, 'scripts/rv32-project'), '');
  const folder = {uri:{fsPath:root}};
  fs.writeFileSync(path.join(root, 'rv32.toml'), '[project]');
  const commands = new Map(); const executed = []; let saved = 0; let warned = 0; let debug = false;
  const event = () => ({dispose(){}});
  const mock = {
    env:{remoteName:'ssh-remote'},
    workspace:{workspaceFolders:[{uri:{fsPath:'/wrong'}},folder],
      getWorkspaceFolder:()=>folder,
      getConfiguration:()=>({get:(key, fallback)=>key==='sdkPath'?sdk:(key==='debug'?debug:fallback)}),
      saveAll:async()=>{saved++;return true;},
      createFileSystemWatcher:()=>({dispose(){},onDidCreate:event,onDidDelete:event}),
      onDidChangeWorkspaceFolders:event},
    window:{activeTextEditor:{document:{uri:{fsPath:path.join(root,'main.c')}}},
      onDidChangeActiveTextEditor:event, showWarningMessage:async()=>{warned++;}},
    commands:{registerCommand:(name,fn)=>{commands.set(name,fn);return event();},executeCommand:async()=>{}},
    tasks:{taskExecutions:[],registerTaskProvider:()=>event(),executeTask:async t=>executed.push(t)},
    ProcessExecution:class {constructor(executable,args,options){Object.assign(this,{executable,args,options});}},
    Task:class {constructor(definition,scope,name,source,execution){Object.assign(this,{definition,scope,name,source,execution});}},
    TaskRevealKind:{Always:1},TaskPanelKind:{Shared:1}
  };
  const original = Module._load;
  Module._load = function(name,...args){return name==='vscode'?mock:original.call(this,name,...args);};
  try {
    delete require.cache[require.resolve('../extension')];
    require('../extension').activate({subscriptions:[],extensionPath:path.dirname(__dirname)});
  } finally {Module._load=original;}
  for(const [name,mode] of [['rv32.fpgaFull','full'],['rv32.fpgaFast','fast']]){
    await commands.get(name)();
    const task = executed.at(-1);
    assert.equal(task.scope, folder);
    assert.deepEqual(task.execution.args,['--project',root,'fpga','--mode',mode]);
    assert.equal(task.execution.executable,path.join(sdk,'scripts/rv32-project'));
  }
  mock.window.activeTextEditor.document.uri.fsPath=path.join(root,'main.rs');
  await commands.get('rv32.simulate')();
  assert.deepEqual(executed.at(-1).execution.args,['--project',root,'simulate']);
  assert.equal(saved,3);
  assert.equal(executed[0].presentationOptions.echo, false);
  assert.equal(executed[0].presentationOptions.showReuseMessage, false);
  debug = true;
  await commands.get('rv32.simulate')();
  assert.deepEqual(executed.at(-1).execution.args,['--debug','--project',root,'simulate']);
  assert.equal(executed.at(-1).presentationOptions.echo, true);
  mock.tasks.taskExecutions=[{task:executed[0]}];
  await commands.get('rv32.fpgaFull')();
  assert.equal(warned,1);assert.equal(executed.length,4);
  mock.tasks.taskExecutions=[];
  await commands.get('rv32.refreshDrivers')();
  assert.deepEqual(executed.at(-1).execution.args,['--debug','--project',root,'drivers']);
  const nested = path.join(root, 'vendor', 'GPIO', 'example');
  fs.mkdirSync(path.join(nested, 'src'), {recursive:true});
  fs.writeFileSync(path.join(nested, 'rv32.toml'), '[project]');
  mock.window.activeTextEditor.document.uri.fsPath = path.join(nested, 'src', 'main.c');
  await commands.get('rv32.simulate')();
  assert.deepEqual(executed.at(-1).execution.args, ['--debug', '--project', nested, 'simulate']);
  assert.equal(executed.at(-1).execution.options.cwd, nested);
  assert.equal(executed.at(-1).scope, folder);
  fs.rmSync(root,{recursive:true,force:true});
});
