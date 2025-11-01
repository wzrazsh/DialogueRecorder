import * as vscode from 'vscode';
import * as path from 'path';
import { DatabaseService } from '../services/DatabaseService';
import { SearchService } from '../services/SearchService';
import { DialogueRecord, SearchCriteria } from '../models/DialogueRecord';

export class DialogueRecorderPanel {
    public static currentPanel: DialogueRecorderPanel | undefined;
    public static readonly viewType = 'dialogue-recorder';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _databaseService: DatabaseService;
    private readonly _searchService: SearchService;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, databaseService: DatabaseService, searchService: SearchService) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 如果面板已经存在，则显示它
        if (DialogueRecorderPanel.currentPanel) {
            DialogueRecorderPanel.currentPanel._panel.reveal(column);
            return;
        }

        // 否则创建新面板
        const panel = vscode.window.createWebviewPanel(
            DialogueRecorderPanel.viewType,
            '对话记录器',
            column || vscode.ViewColumn.One,
            {
                // 启用JavaScript
                enableScripts: true,
                // 限制webview只能访问特定资源
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'out/compiled')
                ]
            }
        );

        DialogueRecorderPanel.currentPanel = new DialogueRecorderPanel(
            panel,
            extensionUri,
            databaseService,
            searchService
        );
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        databaseService: DatabaseService,
        searchService: SearchService
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._databaseService = databaseService;
        this._searchService = searchService;

        // 设置webview的HTML内容
        this._update();

        // 监听webview被关闭
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // 监听webview消息
        this._panel.webview.onDidReceiveMessage(
            async (data) => {
                console.log('DialogueRecorderPanel: 收到来自Webview的消息:', data.type);
                
                switch (data.type) {
                    case 'loadRecords':
                        console.log('DialogueRecorderPanel: 处理loadRecords命令');
                        await this.loadRecords();
                        break;
                    case 'search':
                        console.log('DialogueRecorderPanel: 处理search命令，查询:', data);
                        await this.performSearch(data);
                        break;
                    case 'exportRecords':
                        console.log('DialogueRecorderPanel: 处理exportRecords命令，记录数量:', data.records ? data.records.length : 0);
                        await this.handleExportRecords(data);
                        break;
                    case 'info':
                        vscode.window.showInformationMessage(data.text);
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(data.text);
                        break;
                    default:
                        console.log('DialogueRecorderPanel: 未知命令:', data.type);
                }
            },
            null,
            this._disposables
        );
    }

    private async loadRecords() {
        console.log('开始加载对话记录...');
        //查看node版本
        console.log('Node版本:', process.version);
        try {
            console.log('正在获取所有会话列表...');
            const sessions = await this._databaseService.getAllSessions();
            console.log(`获取到 ${sessions.length} 个会话`);
            
            let allRecords: DialogueRecord[] = [];

            // 获取每个会话的记录
            for (let i = 0; i < sessions.length; i++) {
                const sessionId = sessions[i];
                console.log(`正在加载会话 ${i + 1}/${sessions.length}: ${sessionId}`);
                
                const records = await this._databaseService.getRecordsBySession(sessionId);
                console.log(`会话 ${sessionId} 包含 ${records.length} 条记录`);
                allRecords = allRecords.concat(records);
            }

            console.log(`总共获取到 ${allRecords.length} 条记录`);

            // 按时间排序
            allRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            console.log('记录排序完成');

            // 发送记录到webview
            this._panel.webview.postMessage({
                type: 'recordsLoaded',
                records: allRecords
            });
            console.log('记录已发送到Webview');
            
        } catch (error) {
            console.error('加载记录失败:', error);
            if (error instanceof Error) {
                console.error('错误详情:', error.message);
                console.error('错误堆栈:', error.stack);
            }
            
            this._panel.webview.postMessage({
                type: 'error',
                text: '加载记录失败'
            });
        }
    }

    private async performSearch(data: any) {
        try {
            const criteria: SearchCriteria = {
                keyword: data.keyword,
                speaker: data.speaker,
                recordType: data.recordType,
                startTime: data.startTime ? new Date(data.startTime) : undefined,
                endTime: data.endTime ? new Date(data.endTime) : undefined,
                fileExtension: data.fileExtension
            };

            // 使用搜索服务进行搜索
            const searchResults = await this._searchService.search(criteria);
            const records = searchResults.map(result => result.record);

            // 发送搜索结果到webview
            this._panel.webview.postMessage({
                type: 'searchResults',
                results: records
            });
        } catch (error) {
            console.error('搜索失败:', error);
            this._panel.webview.postMessage({
                type: 'error',
                text: '搜索失败'
            });
        }
    }

    private async handleExportRecords(data: any) {
        try {
            const records = data.records || [];
            
            if (records.length === 0) {
                vscode.window.showWarningMessage('没有记录可导出');
                return;
            }

            // 让用户选择保存位置
            const uri = await vscode.window.showSaveDialog({
                filters: {
                    'JSON文件': ['json']
                },
                defaultUri: vscode.Uri.file(`对话记录_${new Date().toISOString().split('T')[0]}.json`)
            });

            if (!uri) {
                return; // 用户取消了保存
            }

            // 准备导出的数据
            const exportData = {
                exportTime: new Date().toISOString(),
                totalRecords: records.length,
                records: records.map((record: DialogueRecord) => ({
                    id: record.id,
                    sessionId: record.sessionId,
                    timestamp: record.timestamp,
                    recordType: record.recordType,
                    speaker: record.speaker,
                    content: record.content,
                    filePath: record.filePath,
                    modificationType: record.modificationType,
                    oldContent: record.oldContent,
                    newContent: record.newContent,
                    operationDetails: record.operationDetails
                }))
            };

            // 写入文件
            const fs = require('fs').promises;
            await fs.writeFile(uri.fsPath, JSON.stringify(exportData, null, 2), 'utf8');

            vscode.window.showInformationMessage(`成功导出 ${records.length} 条记录到 ${uri.fsPath}`);

        } catch (error) {
            console.error('导出记录失败:', error);
            vscode.window.showErrorMessage('导出记录失败');
        }
    }

    public addNewRecord(record: DialogueRecord) {
        if (this._panel && this._panel.visible) {
            this._panel.webview.postMessage({
                type: 'newRecord',
                record: record
            });
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // 获取HTML文件的本地路径
        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'dialogue-recorder.html');
        
        // 读取HTML文件内容
        const fs = require('fs');
        let htmlContent = '';
        
        try {
            htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
            
            // 修复Service Worker错误：移除任何可能的Service Worker注册代码
            htmlContent = htmlContent.replace(/navigator\.serviceWorker\.register\s*\([^)]*\)/g, '');
            htmlContent = htmlContent.replace(/serviceWorker\.register\s*\([^)]*\)/g, '');
            
            // 添加CSP策略来增强安全性
            const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data: https:;">`;
            
            // 在head标签中插入CSP
            htmlContent = htmlContent.replace('<head>', `<head>\n${cspMeta}`);
            
        } catch (error) {
            console.error('读取HTML文件失败:', error);
            htmlContent = this._getFallbackHtml();
        }

        return htmlContent;
    }

    private _getFallbackHtml(): string {
        return `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>对话记录器</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        text-align: center;
                        color: var(--vscode-foreground);
                    }
                </style>
            </head>
            <body>
                <h2>对话记录器</h2>
                <p>HTML文件加载失败，请检查插件配置。</p>
            </body>
            </html>
        `;
    }

    public dispose() {
        DialogueRecorderPanel.currentPanel = undefined;

        // 清理资源
        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}