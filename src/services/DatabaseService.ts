import * as vscode from 'vscode';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { DialogueRecord } from '../models/DialogueRecord';

export class DatabaseService {
    private db: sqlite3.Database | null = null;
    private dbPath: string;
    private initializationPromise: Promise<void> | null = null;

    constructor(storageUri: vscode.Uri) {
        // 检查存储路径是否可用，如果不可用则使用备用路径
        this.dbPath = this.getValidDbPath(storageUri);
        this.initializationPromise = this.initializeDatabase();
    }

    private getValidDbPath(storageUri: vscode.Uri): string {
        const primaryPath = path.join(storageUri.fsPath, 'dialogue_records.db');
        
        // 检查主路径是否可写
        try {
            const dir = path.dirname(primaryPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            // 测试写入权限
            fs.writeFileSync(path.join(dir, 'test_write.txt'), 'test');
            fs.unlinkSync(path.join(dir, 'test_write.txt'));
            return primaryPath;
        } catch (error) {
            console.warn('主存储路径不可用，使用备用路径:', error);
            
            // 备用路径：使用用户主目录下的.trae-cn目录
            const homeDir = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
            if (homeDir) {
                const fallbackPath = path.join(homeDir, '.trae-cn', 'dialogue_records.db');
                console.log('使用备用路径:', fallbackPath);
                return fallbackPath;
            }
            
            // 如果备用路径也不可用，使用当前工作目录
            const currentPath = path.join(process.cwd(), 'dialogue_records.db');
            console.log('使用当前工作目录路径:', currentPath);
            return currentPath;
        }
    }

    private async initializeDatabase(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // 确保存储目录存在
                const dir = path.dirname(this.dbPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                // 创建数据库连接
                this.db = new sqlite3.Database(this.dbPath, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // 创建表
                    this.db!.run(`
                        CREATE TABLE IF NOT EXISTS dialogue_records (
                            id TEXT PRIMARY KEY,
                            session_id TEXT NOT NULL,
                            timestamp DATETIME NOT NULL,
                            speaker TEXT NOT NULL,
                            content TEXT NOT NULL,
                            record_type TEXT NOT NULL,
                            file_path TEXT,
                            modification_type TEXT,
                            old_content TEXT,
                            new_content TEXT,
                            operation_details TEXT
                        )
                    `, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async saveRecord(record: DialogueRecord): Promise<void> {
        if (!this.db) {
            // 等待数据库初始化完成
            if (this.initializationPromise) {
                await this.initializationPromise;
            }
            if (!this.db) {
                throw new Error('Database not initialized');
            }
        }

        return new Promise((resolve, reject) => {
            this.db!.run(`
                INSERT INTO dialogue_records 
                (id, session_id, timestamp, speaker, content, record_type, file_path, modification_type, old_content, new_content, operation_details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                record.id,
                record.sessionId,
                record.timestamp.toISOString(),
                record.speaker,
                record.content,
                record.recordType,
                record.filePath || null,
                record.modificationType || null,
                record.oldContent || null,
                record.newContent || null,
                record.operationDetails || null
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async getRecordsBySession(sessionId: string): Promise<DialogueRecord[]> {
        console.log(`DatabaseService: 开始获取会话 ${sessionId} 的记录`);
        
        if (!this.db) {
            // 等待数据库初始化完成
            if (this.initializationPromise) {
                await this.initializationPromise;
            }
            if (!this.db) {
                console.error('DatabaseService: 数据库未初始化');
                throw new Error('Database not initialized');
            }
        }

        return new Promise((resolve, reject) => {
            console.log(`DatabaseService: 执行SQL查询获取会话 ${sessionId} 的记录`);
            this.db!.all(`
                SELECT * FROM dialogue_records 
                WHERE session_id = ? 
                ORDER BY timestamp ASC
            `, [sessionId], (err, rows: any[]) => {
                if (err) {
                    console.error(`DatabaseService: 获取会话 ${sessionId} 记录失败:`, err);
                    reject(err);
                    return;
                }
                
                console.log(`DatabaseService: 会话 ${sessionId} 查询返回 ${rows.length} 条记录`);
                
                const records: DialogueRecord[] = rows.map((row: any) => ({
                    id: row.id,
                    sessionId: row.session_id,
                    timestamp: new Date(row.timestamp),
                    speaker: row.speaker,
                    content: row.content,
                    recordType: row.record_type,
                    filePath: row.file_path,
                    modificationType: row.modification_type,
                    oldContent: row.old_content,
                    newContent: row.new_content,
                    operationDetails: row.operation_details
                }));
                
                console.log(`DatabaseService: 会话 ${sessionId} 记录获取完成`);
                resolve(records);
            });
        });
    }

    async searchRecords(keyword: string, startTime?: Date, endTime?: Date): Promise<DialogueRecord[]> {
        if (!this.db) {
            // 等待数据库初始化完成
            if (this.initializationPromise) {
                await this.initializationPromise;
            }
            if (!this.db) {
                throw new Error('Database not initialized');
            }
        }

        return new Promise((resolve, reject) => {
            let query = `SELECT * FROM dialogue_records WHERE content LIKE ?`;
            const params: any[] = [`%${keyword}%`];

            if (startTime) {
                query += ` AND timestamp >= ?`;
                params.push(startTime.toISOString());
            }

            if (endTime) {
                query += ` AND timestamp <= ?`;
                params.push(endTime.toISOString());
            }

            query += ` ORDER BY timestamp DESC`;

            this.db!.all(query, params, (err, rows: any[]) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const records: DialogueRecord[] = rows.map((row: any) => ({
                    id: row.id,
                    sessionId: row.session_id,
                    timestamp: new Date(row.timestamp),
                    speaker: row.speaker,
                    content: row.content,
                    recordType: row.record_type,
                    filePath: row.file_path,
                    modificationType: row.modification_type,
                    oldContent: row.old_content,
                    newContent: row.new_content,
                    operationDetails: row.operation_details
                }));
                
                resolve(records);
            });
        });
    }

    async getAllSessions(): Promise<string[]> {
        console.log('DatabaseService: 开始获取所有会话列表');
        
        if (!this.db) {
            // 等待数据库初始化完成
            if (this.initializationPromise) {
                await this.initializationPromise;
            }
            if (!this.db) {
                console.error('DatabaseService: 数据库未初始化');
                throw new Error('Database not initialized');
            }
        }

        return new Promise((resolve, reject) => {
            console.log('DatabaseService: 执行SQL查询获取所有会话');
            this.db!.all(`
                SELECT DISTINCT session_id 
                FROM dialogue_records 
                ORDER BY (
                    SELECT MAX(timestamp) 
                    FROM dialogue_records AS dr2 
                    WHERE dr2.session_id = dialogue_records.session_id
                ) DESC
            `, [], (err, rows: any[]) => {
                if (err) {
                    console.error('DatabaseService: 获取所有会话失败:', err);
                    reject(err);
                    return;
                }
                
                const sessions = rows.map((row: any) => row.session_id);
                console.log(`DatabaseService: 获取到 ${sessions.length} 个会话`);
                resolve(sessions);
            });
        });
    }

    async close(): Promise<void> {
        if (this.db) {
            try {
                this.db.close();
                this.db = null;
            } catch (error) {
                throw error;
            }
        }
    }
}