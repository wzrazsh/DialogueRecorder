import * as vscode from 'vscode';
import { DatabaseService } from './DatabaseService';
import { DialogueRecord } from '../models/DialogueRecord';

export class DialogueListenerService {
    private databaseService: DatabaseService;
    private currentSessionId: string;
    private isListening: boolean = false;

    constructor(databaseService: DatabaseService) {
        this.databaseService = databaseService;
        this.currentSessionId = this.generateSessionId();
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    startListening(): void {
        if (this.isListening) {
            return;
        }

        this.isListening = true;
        console.log('对话监听服务已启动');

        // 监听VS Code输出面板的对话
        this.setupOutputPanelListener();

        // 监听终端输出
        this.setupTerminalListener();

        // 监听调试控制台
        this.setupDebugConsoleListener();
    }

    stopListening(): void {
        this.isListening = false;
        console.log('对话监听服务已停止');
    }

    private setupOutputPanelListener(): void {
        // 监听所有输出通道的变化
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && editor.document.languageId === 'output') {
                this.monitorOutputChannel(editor.document);
            }
        });

        // 监听所有输出面板的文档变化
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.languageId === 'output') {
                this.processOutputContent(event.document);
            }
        });

        // 检查当前活动的输出面板
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.languageId === 'output') {
            this.monitorOutputChannel(activeEditor.document);
        }
    }

    private monitorOutputChannel(document: vscode.TextDocument): void {
        // 获取输出面板的内容并处理
        const content = document.getText();
        this.processOutputContent(document);
    }

    private processOutputContent(document: vscode.TextDocument): void {
        const content = document.getText();
        const lines = content.split('\n');
        
        // 分析输出内容，识别Builder和Chat的对话
        for (const line of lines) {
            if (line.trim()) {
                this.analyzeOutputLine(line.trim());
            }
        }
    }

    private analyzeOutputLine(line: string): void {
        // 识别Builder输出模式
        if (line.includes('[Builder]') || line.includes('Builder:')) {
            const content = this.extractContent(line, ['[Builder]', 'Builder:']);
            if (content) {
                this.recordDialogue('BUILDER', content);
            }
        }
        // 识别Chat输出模式
        else if (line.includes('[Chat]') || line.includes('Chat:') || line.includes('Assistant:')) {
            const content = this.extractContent(line, ['[Chat]', 'Chat:', 'Assistant:']);
            if (content) {
                this.recordDialogue('CHAT', content);
            }
        }
        // 识别用户输入模式
        else if (line.includes('[User]') || line.includes('User:') || line.includes('USER:')) {
            const content = this.extractContent(line, ['[User]', 'User:', 'USER:']);
            if (content) {
                this.recordDialogue('USER', content);
            }
        }
        // 识别工具调用模式
        else if (line.includes('tool_call') || line.includes('Tool:')) {
            const content = this.extractContent(line, ['tool_call', 'Tool:']);
            if (content) {
                this.recordDialogue('BUILDER', `工具调用: ${content}`);
            }
        }
    }

    private extractContent(line: string, markers: string[]): string | null {
        for (const marker of markers) {
            const index = line.indexOf(marker);
            if (index !== -1) {
                return line.substring(index + marker.length).trim();
            }
        }
        return null;
    }

    private setupTerminalListener(): void {
        // 监听终端创建
        vscode.window.onDidOpenTerminal((terminal) => {
            this.setupTerminalDataListener(terminal);
        });

        // 监听现有终端
        vscode.window.terminals.forEach(terminal => {
            this.setupTerminalDataListener(terminal);
        });

        // 监听终端状态变化
        vscode.window.onDidChangeTerminalState((terminal) => {
            if (terminal.state.isInteractedWith) {
                this.recordDialogue('USER', `终端交互: ${terminal.name}`);
            }
        });
    }

    private setupTerminalDataListener(terminal: vscode.Terminal): void {
        // 由于VS Code API限制，无法直接监听终端输出内容
        // 但我们可以记录终端的创建和重要事件
        this.recordDialogue('BUILDER', `终端已创建: ${terminal.name}`);
        
        // 监听终端关闭
        const disposable = vscode.window.onDidCloseTerminal((closedTerminal) => {
            if (closedTerminal === terminal) {
                this.recordDialogue('BUILDER', `终端已关闭: ${terminal.name}`);
                disposable.dispose();
            }
        });
    }

    private setupDebugConsoleListener(): void {
        // 监听调试会话开始
        vscode.debug.onDidStartDebugSession((session) => {
            this.recordDialogue('BUILDER', `调试会话开始: ${session.name}`);
        });

        // 监听调试会话结束
        vscode.debug.onDidTerminateDebugSession((session) => {
            this.recordDialogue('BUILDER', `调试会话结束: ${session.name}`);
        });

        // 监听调试输出事件
        vscode.debug.onDidReceiveDebugSessionCustomEvent((event) => {
            if (event.event === 'output') {
                const body = event.body;
                if (body && body.output) {
                    this.recordDialogue('BUILDER', `调试输出: ${body.output}`);
                }
            }
        });

        // 监听断点变化
        vscode.debug.onDidChangeBreakpoints((event) => {
            if (event.added && event.added.length > 0) {
                event.added.forEach(breakpoint => {
                    // 检查断点类型并获取位置信息
                    if ('location' in breakpoint) {
                        const location = (breakpoint as vscode.SourceBreakpoint).location;
                        if (location) {
                            this.recordDialogue('USER', `设置断点: ${location.uri.fsPath}:${location.range.start.line + 1}`);
                        }
                    } else if ('functionName' in breakpoint) {
                        const functionBreakpoint = breakpoint as vscode.FunctionBreakpoint;
                        this.recordDialogue('USER', `设置函数断点: ${functionBreakpoint.functionName}`);
                    }
                });
            }
            if (event.removed && event.removed.length > 0) {
                event.removed.forEach(breakpoint => {
                    // 检查断点类型并获取位置信息
                    if ('location' in breakpoint) {
                        const location = (breakpoint as vscode.SourceBreakpoint).location;
                        if (location) {
                            this.recordDialogue('USER', `移除断点: ${location.uri.fsPath}:${location.range.start.line + 1}`);
                        }
                    } else if ('functionName' in breakpoint) {
                        const functionBreakpoint = breakpoint as vscode.FunctionBreakpoint;
                        this.recordDialogue('USER', `移除函数断点: ${functionBreakpoint.functionName}`);
                    }
                });
            }
        });
    }

    async recordDialogue(speaker: 'USER' | 'BUILDER' | 'CHAT', content: string): Promise<void> {
        const record: DialogueRecord = {
            id: this.generateRecordId(),
            sessionId: this.currentSessionId,
            timestamp: new Date(),
            speaker: speaker,
            content: content,
            recordType: 'DIALOGUE'
        };

        try {
            await this.databaseService.saveRecord(record);
            console.log(`记录对话: ${speaker} - ${content.substring(0, 50)}...`);
        } catch (error) {
            console.error('记录对话失败:', error);
        }
    }

    async recordFileModification(filePath: string, modificationType: 'CREATE' | 'MODIFY' | 'DELETE' | 'RENAME'): Promise<void> {
        const record: DialogueRecord = {
            id: this.generateRecordId(),
            sessionId: this.currentSessionId,
            timestamp: new Date(),
            speaker: 'BUILDER',
            content: `文件${modificationType}: ${filePath}`,
            recordType: 'FILE_MODIFICATION',
            filePath: filePath,
            modificationType: modificationType
        };

        try {
            await this.databaseService.saveRecord(record);
            console.log(`记录文件修改: ${modificationType} - ${filePath}`);
        } catch (error) {
            console.error('记录文件修改失败:', error);
        }
    }

    async recordFileContentModification(filePath: string, content: string): Promise<void> {
        const record: DialogueRecord = {
            id: this.generateRecordId(),
            sessionId: this.currentSessionId,
            timestamp: new Date(),
            speaker: 'BUILDER',
            content: `文件内容修改: ${filePath}`,
            recordType: 'FILE_MODIFICATION',
            filePath: filePath,
            modificationType: 'MODIFY',
            newContent: content
        };

        try {
            await this.databaseService.saveRecord(record);
            console.log(`记录文件内容修改: ${filePath}`);
        } catch (error) {
            console.error('记录文件内容修改失败:', error);
        }
    }

    async recordUndoOperation(filePath: string, operationDetails: string): Promise<void> {
        const record: DialogueRecord = {
            id: this.generateRecordId(),
            sessionId: this.currentSessionId,
            timestamp: new Date(),
            speaker: 'USER',
            content: `撤销操作: ${operationDetails}`,
            recordType: 'UNDO',
            filePath: filePath,
            operationDetails: operationDetails
        };

        try {
            await this.databaseService.saveRecord(record);
            console.log(`记录撤销操作: ${operationDetails}`);
        } catch (error) {
            console.error('记录撤销操作失败:', error);
        }
    }

    async recordRedoOperation(filePath: string, operationDetails: string): Promise<void> {
        const record: DialogueRecord = {
            id: this.generateRecordId(),
            sessionId: this.currentSessionId,
            timestamp: new Date(),
            speaker: 'USER',
            content: `重做操作: ${operationDetails}`,
            recordType: 'REDO',
            filePath: filePath,
            operationDetails: operationDetails
        };

        try {
            await this.databaseService.saveRecord(record);
            console.log(`记录重做操作: ${operationDetails}`);
        } catch (error) {
            console.error('记录重做操作失败:', error);
        }
    }

    private generateRecordId(): string {
        return `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    dispose(): void {
        this.stopListening();
    }
}