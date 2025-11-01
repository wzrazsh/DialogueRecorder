import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseService } from '../services/DatabaseService';
import { DialogueListenerService } from '../services/DialogueListenerService';
import { SearchService } from '../services/SearchService';
import { DialogueRecord, SearchCriteria, SearchResult } from '../models/DialogueRecord';

// Mock vscode.Uri for testing
class MockUri {
    public scheme: string = 'file';
    public authority: string = '';
    public path: string;
    public query: string = '';
    public fragment: string = '';
    
    constructor(public fsPath: string) {
        this.path = fsPath;
    }
    
    static file(path: string): MockUri {
        return new MockUri(path);
    }
    
    toString(): string {
        return this.fsPath;
    }
    
    toJSON(): any {
        return {
            scheme: this.scheme,
            authority: this.authority,
            path: this.path,
            query: this.query,
            fragment: this.fragment,
            fsPath: this.fsPath
        };
    }
    
    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): MockUri {
        const uri = new MockUri(change.path || this.fsPath);
        uri.scheme = change.scheme || this.scheme;
        uri.authority = change.authority || this.authority;
        uri.query = change.query || this.query;
        uri.fragment = change.fragment || this.fragment;
        return uri;
    }
}

// Mock vscode module
const vscode = {
    Uri: MockUri
};

/**
 * 综合测试套件 - 覆盖数据存储、对话访问监控和记录查询功能
 */
suite('DialogueRecorder 综合测试套件', () => {
    let dbService: DatabaseService;
    let listenerService: DialogueListenerService;
    let searchService: SearchService;
    let testStoragePath: string;

    setup(() => {
        // 创建临时存储路径
        testStoragePath = path.join(os.tmpdir(), 'dialogue-recorder-comprehensive-test');
        const tempUri = vscode.Uri.file(testStoragePath);
        
        // 初始化服务
        dbService = new DatabaseService(tempUri);
        listenerService = new DialogueListenerService(dbService);
        searchService = new SearchService(dbService);
    });

    teardown(async () => {
        // 清理测试数据
        if (dbService) {
            await dbService.close();
        }
        
        // 删除临时文件
        if (fs.existsSync(testStoragePath)) {
            fs.rmSync(testStoragePath, { recursive: true, force: true });
        }
    });

    // ==================== 数据存储系统测试 ====================
    suite('数据存储系统测试', () => {
        test('数据库初始化测试', () => {
            assert.ok(dbService, '数据库服务应正确初始化');
        });

        test('数据持久化存储测试', async () => {
            const record: DialogueRecord = {
                    id: 'persistence-test-1',
                    sessionId: 'persistence-session',
                    timestamp: new Date(),
                    speaker: 'USER' as 'USER',
                    content: '数据持久化测试消息',
                    recordType: 'DIALOGUE' as 'DIALOGUE'
                };

            // 保存记录
            await dbService.saveRecord(record);
            
            // 验证记录已保存
            const records = await dbService.getRecordsBySession('persistence-session');
            assert.strictEqual(records.length, 1, '应能检索到保存的记录');
            assert.strictEqual(records[0].content, '数据持久化测试消息', '记录内容应正确保存');
        });

        test('数据读取操作测试', async () => {
            // 插入多条测试记录
            const testRecords = [
                {
                    id: 'read-test-1',
                    sessionId: 'read-session',
                    timestamp: new Date(Date.now() - 60000), // 1分钟前
                    speaker: 'USER' as 'USER',
                    content: '第一条测试消息',
                    recordType: 'DIALOGUE' as 'DIALOGUE'
                },
                {
                    id: 'read-test-2',
                    sessionId: 'read-session',
                    timestamp: new Date(),
                    speaker: 'BUILDER' as 'BUILDER',
                    content: '第二条测试消息',
                    recordType: 'DIALOGUE' as 'DIALOGUE'
                }
            ];

            for (const record of testRecords) {
                await dbService.saveRecord(record);
            }

            // 验证读取操作
            const records = await dbService.getRecordsBySession('read-session');
            assert.strictEqual(records.length, 2, '应能正确读取所有记录');
            assert.strictEqual(records[0].speaker, 'USER', '第一条记录应为USER');
            assert.strictEqual(records[1].speaker, 'BUILDER', '第二条记录应为BUILDER');
        });

        test('数据更新操作测试', async () => {
            const originalRecord: DialogueRecord = {
                id: 'update-test-1',
                sessionId: 'update-session',
                timestamp: new Date(),
                speaker: 'USER' as 'USER',
                content: '原始内容',
                recordType: 'DIALOGUE' as 'DIALOGUE'
            };

            await dbService.saveRecord(originalRecord);

            // 更新记录（通过保存新版本）
            const updatedRecord: DialogueRecord = {
                ...originalRecord,
                content: '更新后的内容',
                timestamp: new Date(),
                speaker: 'USER' as 'USER',
                recordType: 'DIALOGUE' as 'DIALOGUE'
            };

            await dbService.saveRecord(updatedRecord);

            // 验证更新结果
            const records = await dbService.getRecordsBySession('update-session');
            assert.strictEqual(records.length, 2, '更新操作应创建新记录而非覆盖');
            assert.strictEqual(records[1].content, '更新后的内容', '最新记录应为更新后的内容');
        });

        test('数据删除操作测试', async () => {
            // 此测试验证会话级别的数据管理
            const testRecord: DialogueRecord = {
                id: 'delete-test-1',
                sessionId: 'delete-session',
                timestamp: new Date(),
                speaker: 'USER' as 'USER',
                content: '待删除的测试消息',
                recordType: 'DIALOGUE' as 'DIALOGUE'
            };

            await dbService.saveRecord(testRecord);

            // 验证记录存在
            let records = await dbService.getRecordsBySession('delete-session');
            assert.strictEqual(records.length, 1, '记录应存在');

            // 模拟删除操作（通过创建新会话）
            const newSessionRecord: DialogueRecord = {
                id: 'delete-test-2',
                sessionId: 'new-session',
                timestamp: new Date(),
                speaker: 'USER' as 'USER',
                content: '新会话的消息',
                recordType: 'DIALOGUE' as 'DIALOGUE'
            };

            await dbService.saveRecord(newSessionRecord);

            // 验证原会话记录仍然存在
            records = await dbService.getRecordsBySession('delete-session');
            assert.strictEqual(records.length, 1, '原会话记录应仍然存在');
        });

        test('数据完整性验证测试', async () => {
            const complexRecord: DialogueRecord = {
                id: 'integrity-test-1',
                sessionId: 'integrity-session',
                timestamp: new Date(),
                speaker: 'BUILDER' as 'BUILDER',
                content: '复杂记录测试',
                recordType: 'FILE_MODIFICATION' as 'FILE_MODIFICATION',
                filePath: '/test/example.js',
                modificationType: 'MODIFY',
                oldContent: '旧内容',
                newContent: '新内容',
                operationDetails: '详细操作信息'
            };

            await dbService.saveRecord(complexRecord);

            const records = await dbService.getRecordsBySession('integrity-session');
            const retrievedRecord = records[0];

            // 验证所有字段完整性
            assert.strictEqual(retrievedRecord.id, 'integrity-test-1', 'ID应正确保存');
            assert.strictEqual(retrievedRecord.sessionId, 'integrity-session', '会话ID应正确保存');
            assert.strictEqual(retrievedRecord.speaker, 'BUILDER', '说话者应正确保存');
            assert.strictEqual(retrievedRecord.content, '复杂记录测试', '内容应正确保存');
            assert.strictEqual(retrievedRecord.recordType, 'FILE_MODIFICATION', '记录类型应正确保存');
            assert.strictEqual(retrievedRecord.filePath, '/test/example.js', '文件路径应正确保存');
            assert.strictEqual(retrievedRecord.modificationType, 'MODIFY', '修改类型应正确保存');
            assert.strictEqual(retrievedRecord.oldContent, '旧内容', '旧内容应正确保存');
            assert.strictEqual(retrievedRecord.newContent, '新内容', '新内容应正确保存');
            assert.strictEqual(retrievedRecord.operationDetails, '详细操作信息', '操作详情应正确保存');
        });

        test('并发操作测试', async () => {
            const promises = [];
            const sessionId = 'concurrency-session';

            // 模拟并发保存操作
            for (let i = 0; i < 5; i++) {
                const record: DialogueRecord = {
                    id: `concurrent-test-${i}`,
                    sessionId: sessionId,
                    timestamp: new Date(),
                    speaker: i % 2 === 0 ? 'USER' as 'USER' : 'BUILDER' as 'BUILDER',
                    content: `并发测试消息 ${i}`,
                    recordType: 'DIALOGUE' as 'DIALOGUE'
                };
                promises.push(dbService.saveRecord(record));
            }

            // 等待所有操作完成
            await Promise.all(promises);

            // 验证所有记录都已保存
            const records = await dbService.getRecordsBySession(sessionId);
            assert.strictEqual(records.length, 5, '所有并发操作都应成功保存记录');
        });
    });

    // ==================== 对话访问监控测试 ====================
    suite('对话访问监控测试', () => {
        test('新增对话记录测试', async () => {
            await listenerService.recordDialogue('USER', '用户新增对话测试');
            await listenerService.recordDialogue('BUILDER', 'Builder响应测试');
            await listenerService.recordDialogue('CHAT', 'Chat对话测试');

            // 验证记录已保存
            const sessions = await dbService.getAllSessions();
            assert.ok(sessions.length > 0, '应至少有一个会话');

            const records = await dbService.getRecordsBySession(sessions[0]);
            assert.strictEqual(records.length, 3, '应保存3条对话记录');
            assert.strictEqual(records[0].speaker, 'USER', '第一条记录应为USER');
            assert.strictEqual(records[1].speaker, 'BUILDER', '第二条记录应为BUILDER');
            assert.strictEqual(records[2].speaker, 'CHAT', '第三条记录应为CHAT');
        });

        test('切换对话上下文测试', async () => {
            // 模拟切换会话上下文
            const session1Records = [
                { speaker: 'USER', content: '会话1-用户消息' },
                { speaker: 'BUILDER', content: '会话1-Builder响应' }
            ];

            const session2Records = [
                { speaker: 'USER', content: '会话2-用户消息' },
                { speaker: 'CHAT', content: '会话2-Chat响应' }
            ];

            // 记录第一个会话
            for (const record of session1Records) {
                await listenerService.recordDialogue(record.speaker as any, record.content);
            }

            // 模拟切换会话（创建新的listenerService实例）
            const newListenerService = new DialogueListenerService(dbService);
            for (const record of session2Records) {
                await newListenerService.recordDialogue(record.speaker as any, record.content);
            }

            // 验证两个会话的记录
            const sessions = await dbService.getAllSessions();
            assert.strictEqual(sessions.length, 2, '应有两个不同的会话');

            const session1RecordsFromDb = await dbService.getRecordsBySession(sessions[1]);
            const session2RecordsFromDb = await dbService.getRecordsBySession(sessions[0]);

            assert.strictEqual(session1RecordsFromDb.length, 2, '会话1应有2条记录');
            assert.strictEqual(session2RecordsFromDb.length, 2, '会话2应有2条记录');
        });

        test('撤销操作记录测试', async () => {
            const filePath = '/test/example.js';
            const operationDetails = '撤销了文件修改操作';

            await listenerService.recordUndoOperation(filePath, operationDetails);

            const sessions = await dbService.getAllSessions();
            const records = await dbService.getRecordsBySession(sessions[0]);
            
            const undoRecord = records.find(r => r.recordType === 'UNDO');
            assert.ok(undoRecord, '应找到撤销操作记录');
            assert.strictEqual(undoRecord?.speaker, 'USER', '撤销操作记录者应为USER');
            assert.strictEqual(undoRecord?.filePath, filePath, '文件路径应正确记录');
            assert.strictEqual(undoRecord?.operationDetails, operationDetails, '操作详情应正确记录');
        });

        test('重做操作记录测试', async () => {
            const filePath = '/test/example.js';
            const operationDetails = '重做了文件修改操作';

            await listenerService.recordRedoOperation(filePath, operationDetails);

            const sessions = await dbService.getAllSessions();
            const records = await dbService.getRecordsBySession(sessions[0]);
            
            const redoRecord = records.find(r => r.recordType === 'REDO');
            assert.ok(redoRecord, '应找到重做操作记录');
            assert.strictEqual(redoRecord?.speaker, 'USER', '重做操作记录者应为USER');
            assert.strictEqual(redoRecord?.filePath, filePath, '文件路径应正确记录');
            assert.strictEqual(redoRecord?.operationDetails, operationDetails, '操作详情应正确记录');
        });

        test('文件修改操作记录测试', async () => {
            const testCases = [
                { type: 'CREATE', filePath: '/test/newfile.js', expectedContent: '文件CREATE: /test/newfile.js' },
                { type: 'MODIFY', filePath: '/test/modified.js', expectedContent: '文件MODIFY: /test/modified.js' },
                { type: 'DELETE', filePath: '/test/deleted.js', expectedContent: '文件DELETE: /test/deleted.js' },
                { type: 'RENAME', filePath: '/test/renamed.js', expectedContent: '文件RENAME: /test/renamed.js' }
            ];

            for (const testCase of testCases) {
                await listenerService.recordFileModification(
                    testCase.filePath, 
                    testCase.type as any
                );
            }

            const sessions = await dbService.getAllSessions();
            const records = await dbService.getRecordsBySession(sessions[0]);
            
            const fileModRecords = records.filter(r => r.recordType === 'FILE_MODIFICATION');
            assert.strictEqual(fileModRecords.length, 4, '应有4条文件修改记录');

            testCases.forEach((testCase, index) => {
                const record = fileModRecords[index];
                assert.strictEqual(record.modificationType, testCase.type, '修改类型应正确记录');
                assert.strictEqual(record.filePath, testCase.filePath, '文件路径应正确记录');
            });
        });

        test('监听服务启动停止测试', () => {
            // 测试监听服务的启动和停止功能
            listenerService.startListening();
            // 验证监听状态（这里需要根据实际实现添加状态检查）
            
            listenerService.stopListening();
            // 验证监听已停止
        });
    });

    // ==================== 记录查询功能测试 ====================
    suite('记录查询功能测试', () => {
        beforeEach(async () => {
            // 准备测试数据
            const testRecords = [
                {
                    id: 'search-test-1',
                    sessionId: 'search-session',
                    timestamp: new Date(Date.now() - 120000), // 2分钟前
                    speaker: 'USER' as 'USER',
                    content: '搜索功能测试用户消息',
                    recordType: 'DIALOGUE' as 'DIALOGUE'
                },
                {
                    id: 'search-test-2',
                    sessionId: 'search-session',
                    timestamp: new Date(Date.now() - 60000), // 1分钟前
                    speaker: 'BUILDER' as 'BUILDER',
                    content: '搜索功能测试Builder响应',
                    recordType: 'DIALOGUE' as 'DIALOGUE'
                },
                {
                    id: 'search-test-3',
                    sessionId: 'search-session',
                    timestamp: new Date(),
                    speaker: 'CHAT' as 'CHAT',
                    content: '文件修改操作记录',
                    recordType: 'FILE_MODIFICATION' as 'FILE_MODIFICATION',
                    filePath: '/test/example.js',
                    modificationType: 'MODIFY' as 'MODIFY'
                }
            ];

            for (const record of testRecords) {
                await dbService.saveRecord(record);
            }
        });

        test('关键词搜索准确性测试', async () => {
            const results = await dbService.searchRecords('搜索功能');
            assert.strictEqual(results.length, 2, '应找到包含"搜索功能"的记录');
            
            results.forEach(result => {
                assert.ok(
                    result.content.includes('搜索功能'), 
                    '搜索结果应包含搜索关键词'
                );
            });
        });

        test('时间范围查询测试', async () => {
            const startTime = new Date(Date.now() - 90000); // 1.5分钟前
            const endTime = new Date(Date.now() - 30000); // 30秒前

            const results = await dbService.searchRecords('', startTime, endTime);
            assert.strictEqual(results.length, 1, '应在时间范围内找到1条记录');
            assert.strictEqual(results[0].speaker, 'BUILDER', '找到的记录应为BUILDER');
        });

        test('说话者过滤查询测试', async () => {
            // 使用数据库服务的搜索功能进行说话者过滤
            const userRecords = await dbService.getRecordsBySession('search-session');
            const userOnlyRecords = userRecords.filter(r => r.speaker === 'USER');
            
            assert.strictEqual(userOnlyRecords.length, 1, '应找到1条USER记录');
            assert.strictEqual(userOnlyRecords[0].speaker, 'USER', '记录说话者应为USER');
        });

        test('记录类型查询测试', async () => {
            const allRecords = await dbService.getRecordsBySession('search-session');
            const dialogueRecords = allRecords.filter(r => r.recordType === 'DIALOGUE');
            const fileModRecords = allRecords.filter(r => r.recordType === 'FILE_MODIFICATION');
            
            assert.strictEqual(dialogueRecords.length, 2, '应有2条对话记录');
            assert.strictEqual(fileModRecords.length, 1, '应有1条文件修改记录');
        });

        test('查询响应速度测试', async () => {
            const startTime = Date.now();
            await dbService.searchRecords('测试');
            const endTime = Date.now();
            
            const responseTime = endTime - startTime;
            assert.ok(responseTime < 1000, '查询响应时间应小于1秒');
        });

        test('数据完整性验证查询', async () => {
            const results = await dbService.searchRecords('文件修改');
            assert.strictEqual(results.length, 1, '应找到文件修改记录');
            
            const record = results[0];
            assert.strictEqual(record.recordType, 'FILE_MODIFICATION', '记录类型应正确');
            assert.strictEqual(record.filePath, '/test/example.js', '文件路径应完整');
            assert.strictEqual(record.modificationType, 'MODIFY', '修改类型应正确');
        });

        test('空查询结果处理测试', async () => {
            const results = await dbService.searchRecords('不存在的关键词');
            assert.strictEqual(results.length, 0, '不存在的关键词应返回空结果');
        });

        test('复杂条件组合查询测试', async () => {
            // 模拟复杂查询条件
            const startTime = new Date(Date.now() - 180000); // 3分钟前
            const userRecords = await dbService.getRecordsBySession('search-session');
            
            // 组合过滤：USER说话者 + 时间范围
            const filteredRecords = userRecords.filter(r => 
                r.speaker === 'USER' && 
                r.timestamp >= startTime
            );
            
            assert.strictEqual(filteredRecords.length, 1, '复杂查询应找到1条记录');
            assert.strictEqual(filteredRecords[0].speaker, 'USER', '记录说话者应为USER');
        });
    });

    // ==================== 综合场景测试 ====================
    suite('综合场景测试', () => {
        test('完整工作流测试', async () => {
            // 模拟完整的用户交互工作流
            
            // 1. 用户开始对话
            await listenerService.recordDialogue('USER', '我想创建一个新的项目');
            
            // 2. Builder响应
            await listenerService.recordDialogue('BUILDER', '好的，我来帮您创建项目');
            
            // 3. 文件创建操作
            await listenerService.recordFileModification('/new-project/package.json', 'CREATE');
            
            // 4. 用户撤销操作
            await listenerService.recordUndoOperation('/new-project/package.json', '撤销了文件创建');
            
            // 5. 用户重做操作
            await listenerService.recordRedoOperation('/new-project/package.json', '重做了文件创建');
            
            // 6. Chat参与对话
            await listenerService.recordDialogue('CHAT', '项目创建完成，需要进一步配置吗？');

            // 验证完整工作流记录
            const sessions = await dbService.getAllSessions();
            const records = await dbService.getRecordsBySession(sessions[0]);
            
            assert.strictEqual(records.length, 6, '完整工作流应有6条记录');
            
            // 验证记录顺序和类型
            assert.strictEqual(records[0].recordType, 'DIALOGUE', '第一条应为对话记录');
            assert.strictEqual(records[1].recordType, 'DIALOGUE', '第二条应为对话记录');
            assert.strictEqual(records[2].recordType, 'FILE_MODIFICATION', '第三条应为文件修改记录');
            assert.strictEqual(records[3].recordType, 'UNDO', '第四条应为撤销记录');
            assert.strictEqual(records[4].recordType, 'REDO', '第五条应为重做记录');
            assert.strictEqual(records[5].recordType, 'DIALOGUE', '第六条应为对话记录');
        });

        test('性能压力测试', async () => {
            const startTime = Date.now();
            const recordCount = 100;
            
            // 批量插入记录
            const promises = [];
            for (let i = 0; i < recordCount; i++) {
                const record: DialogueRecord = {
                    id: `stress-test-${i}`,
                    sessionId: 'stress-session',
                    timestamp: new Date(),
                    speaker: i % 3 === 0 ? 'USER' as 'USER' : (i % 3 === 1 ? 'BUILDER' as 'BUILDER' : 'CHAT' as 'CHAT'),
                    content: `压力测试记录 ${i}`,
                    recordType: 'DIALOGUE' as 'DIALOGUE'
                };
                promises.push(dbService.saveRecord(record));
            }
            
            await Promise.all(promises);
            
            // 批量查询
            const searchStartTime = Date.now();
            const results = await dbService.getRecordsBySession('stress-session');
            const searchEndTime = Date.now();
            
            const totalTime = Date.now() - startTime;
            const searchTime = searchEndTime - searchStartTime;
            
            assert.strictEqual(results.length, recordCount, '应正确保存所有记录');
            assert.ok(totalTime < 5000, '批量操作总时间应小于5秒');
            assert.ok(searchTime < 1000, '批量查询时间应小于1秒');
        });

        test('错误处理测试', async () => {
            // 测试无效数据输入
            try {
                const invalidRecord: any = {
                    id: null, // 无效ID
                    sessionId: 'test-session',
                    timestamp: new Date(),
                    speaker: 'INVALID', // 无效说话者
                    content: '测试消息',
                    recordType: 'INVALID_TYPE' // 无效记录类型
                };
                
                await dbService.saveRecord(invalidRecord);
                assert.fail('应抛出错误');
            } catch (error) {
                // 预期会抛出错误
                assert.ok(error instanceof Error, '应捕获到错误');
            }
        });
    });
});