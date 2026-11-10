const vscode = require('vscode');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
exports.run = async function () {
  try {
    const folder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    await vscode.workspace.getConfiguration('rv32').update('sdkPath',path.join(folder,'fake-sdk'),vscode.ConfigurationTarget.Workspace);
    assert.equal(vscode.workspace.getConfiguration('workbench.editor').get('editorActionsLocation'), 'default');
    assert.equal(vscode.workspace.getConfiguration('workbench.editor').get('alwaysShowEditorActions'), true);
    const extension = vscode.extensions.getExtension('insper-riscv.rv32-development');
    assert.ok(extension);await extension.activate();
    const doc=await vscode.workspace.openTextDocument(path.join(folder,fs.existsSync(path.join(folder,'main.rs'))?'main.rs':'main.c'));
    await vscode.window.showTextDocument(doc);
    for(const command of ['rv32.simulate','rv32.fpgaFast','rv32.fpgaFull']){
      const exit = new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Task timed out: '+command)),15000);
        const subscription=vscode.tasks.onDidEndTaskProcess(e=>{
          clearTimeout(timer);subscription.dispose();resolve(e.exitCode);
        });
      });
      await vscode.commands.executeCommand(command);
      assert.equal(await exit,0);
      // Wait for task disposal before starting the next task.
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    await vscode.commands.executeCommand('rv32.toggleDebugOutput');
    assert.equal(vscode.workspace.getConfiguration('rv32').get('debug'),true);
    const debugExit = new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('debug task timeout')),15000);
      const sub=vscode.tasks.onDidEndTaskProcess(e=>{clearTimeout(timer);sub.dispose();resolve(e.exitCode);});
    });
    await vscode.commands.executeCommand('rv32.simulate');
    assert.equal(await debugExit,0);
    await vscode.commands.executeCommand('rv32.toggleDebugOutput');
    assert.equal(vscode.workspace.getConfiguration('rv32').get('debug'),false);
    const lines=fs.readFileSync(path.join(folder,'invocations.txt'),'utf8');
    for(const expected of ['simulate','fpga --mode fast','fpga --mode full','--debug --project'])assert.ok(lines.includes(expected),lines);
    fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify({passed:true,commands:4,debugToggle:true,language:doc.languageId,extension:extension.packageJSON.version}));
  } catch(error){
    fs.writeFileSync(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath,'result.json'),JSON.stringify({passed:false,error:String(error)}));throw error;
  }
};
