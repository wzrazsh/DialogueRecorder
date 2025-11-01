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
        // 过滤掉终端交互和系统消息
        if (this.isTerminalOrSystemMessage(line)) {
            return;
        }
        
        // 识别Builder输出模式 - 更精确的匹配
        if (line.match(/\[Builder\]|^Builder:/)) {
            const content = this.extractContent(line, ['[Builder]', 'Builder:']);
            if (content && this.isRealChatContent(content)) {
                this.recordDialogue('BUILDER', content);
            }
        }
        // 识别Chat输出模式 - 更精确的匹配
        else if (line.match(/\[Chat\]|^Chat:|^Assistant:/)) {
            const content = this.extractContent(line, ['[Chat]', 'Chat:', 'Assistant:']);
            if (content && this.isRealChatContent(content)) {
                this.recordDialogue('CHAT', content);
            }
        }
        // 识别用户输入模式 - 更精确的匹配
        else if (line.match(/\[User\]|^User:|^USER:/)) {
            const content = this.extractContent(line, ['[User]', 'User:', 'USER:']);
            if (content && this.isRealChatContent(content)) {
                this.recordDialogue('USER', content);
            }
        }
        // 识别真正的对话内容（不包含标记的纯对话）
        else if (this.isPureDialogueContent(line)) {
            // 根据上下文判断发言者
            const speaker = this.determineSpeakerFromContext(line);
            if (speaker && this.isRealChatContent(line)) {
                this.recordDialogue(speaker, line);
            }
        }
    }

    private isTerminalOrSystemMessage(line: string): boolean {
        // 过滤终端相关的消息
        const terminalKeywords = [
            '终端', 'terminal', '命令', 'command', 'npm', 'git', 'cd', 'ls', 'dir',
            '编译', 'compile', '构建', 'build', '运行', 'run', '执行', 'execute',
            '错误', 'error', '警告', 'warning', '信息', 'info', '调试', 'debug',
            '断点', 'breakpoint', '工具调用', 'tool_call', 'Tool:', '工具:',
            '创建', 'create', '关闭', 'close', '开始', 'start', '结束', 'end'
        ];
        
        return terminalKeywords.some(keyword => 
            line.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    private isRealChatContent(content: string): boolean {
        // 检查内容是否是真正的聊天内容
        const minLength = 10; // 最小长度要求
        const maxLength = 5000; // 最大长度限制
        
        if (content.length < minLength || content.length > maxLength) {
            return false;
        }
        
        // 过滤掉系统消息和命令输出
        const systemPatterns = [
            /^\s*\d+\s*$/, // 纯数字
            /^[\s\-\*]+$/, // 只有符号
            /^(OK|成功|失败|错误|完成|开始|结束)$/i, // 简单状态词
            /^执行命令:/, // 命令执行
            /^工具调用:/, // 工具调用
            /^终端已/, // 终端状态
            /^调试会话/ // 调试会话
        ];
        
        return !systemPatterns.some(pattern => pattern.test(content));
    }

    private isPureDialogueContent(line: string): boolean {
        // 检查是否是纯对话内容（不包含任何标记）
        const dialogueIndicators = [
            '你好', '请问', '谢谢', '帮助', '问题', '回答', '解释', '说明',
            '如何', '什么', '为什么', '怎样', '可以', '需要', '想要', '希望',
            '我觉得', '我认为', '建议', '推荐', '示例', '代码', '实现',
            '功能', '特性', '需求', '要求', '任务', '目标', '目的'
        ];
        
        return dialogueIndicators.some(indicator => 
            line.includes(indicator)
        ) && line.length > 20; // 确保有足够的内容
    }

    private determineSpeakerFromContext(line: string): 'USER' | 'BUILDER' | 'CHAT' | null {
        // 根据内容特征判断发言者
        if (line.includes('?') || line.includes('？') || 
            line.includes('请问') || line.includes('如何') || 
            line.includes('什么') || line.includes('为什么')) {
            return 'USER';
        } else if (line.includes('代码') || line.includes('实现') || 
                   line.includes('功能') || line.includes('工具')) {
            return 'BUILDER';
        } else if (line.length > 100) { // 较长的回答通常是Chat
            return 'CHAT';
        }
        
        return null;
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

    private generateRecordId(): string {
        return `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    dispose(): void {
        this.stopListening();
    }
}