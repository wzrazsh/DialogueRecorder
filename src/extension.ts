import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DialogueRecorderPanel } from './panels/DialogueRecorderPanel';
import { DatabaseService } from './services/DatabaseService';
import { DialogueListenerService } from './services/DialogueListenerService';
import { SearchService } from './services/SearchService';

export function activate(context: vscode.ExtensionContext) {
    console.log('对话记录器插件已激活');

    // 初始化服务
    const databaseService = new DatabaseService(context.globalStorageUri);
    const searchService = new SearchService(databaseService);
    const dialogueListenerService = new DialogueListenerService(databaseService);

    // 注册命令：显示对话记录器面板
    const showPanelCommand = vscode.commands.registerCommand('dialogue-recorder.showPanel', () => {
        DialogueRecorderPanel.createOrShow(context.extensionUri, databaseService, searchService);
    });



    // 注册命令：快速搜索
    const quickSearchCommand = vscode.commands.registerCommand('dialogue-recorder.quickSearch', () => {
        vscode.window.showInputBox({
            prompt: '请输入搜索关键词',
            placeHolder: '搜索对话记录...'
        }).then(keyword => {
            if (keyword) {
                searchService.search({ keyword }).then(results => {
                    vscode.window.showInformationMessage(`找到 ${results.length} 条相关记录`);
                    // 这里可以显示搜索结果面板
                });
            }
        });
    });

    // 监听文件修改事件
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
    fileWatcher.onDidChange(uri => {
        dialogueListenerService.recordFileModification(uri.fsPath, 'MODIFY');
    });
    fileWatcher.onDidCreate(uri => {
        dialogueListenerService.recordFileModification(uri.fsPath, 'CREATE');
    });
    fileWatcher.onDidDelete(uri => {
        dialogueListenerService.recordFileModification(uri.fsPath, 'DELETE');
    });

    // 监听文本编辑器变化
    vscode.workspace.onDidChangeTextDocument(event => {
        if (event.contentChanges.length > 0) {
            const filePath = event.document.uri.fsPath;
            const content = event.contentChanges[0].text;
            dialogueListenerService.recordFileContentModification(filePath, content);
        }
    });

    // 监听撤销操作
    vscode.commands.registerCommand('undo', () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const filePath = activeEditor.document.uri.fsPath;
            dialogueListenerService.recordUndoOperation(filePath, '撤销文本编辑操作');
        }
    });

    // 监听重做操作
    vscode.commands.registerCommand('redo', () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const filePath = activeEditor.document.uri.fsPath;
            dialogueListenerService.recordRedoOperation(filePath, '重做文本编辑操作');
        }
    });

    // 将命令和监听器添加到上下文
    context.subscriptions.push(
        showPanelCommand,
        quickSearchCommand,
        fileWatcher,
        dialogueListenerService
    );

    // 启动监听服务
    dialogueListenerService.startListening();
}



export function deactivate() {
    console.log('对话记录器插件已停用');
}