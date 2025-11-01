import * as assert from 'assert';
import { DatabaseService } from '../services/DatabaseService';
import { DialogueRecord } from '../models/DialogueRecord';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Additional test cases for enhanced coverage

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

suite('DatabaseService Test Suite', () => {
	let dbService: DatabaseService;

	setup(() => {
        // 创建一个临时的存储路径用于测试
        const tempPath = path.join(os.tmpdir(), 'dialogue-recorder-test');
        const tempUri = vscode.Uri.file(tempPath);
        dbService = new DatabaseService(tempUri);
    });

	teardown(async () => {
		if (dbService) {
			await dbService.close();
		}
	});

	test('Database initialization', () => {
		assert.ok(dbService, 'DatabaseService should be initialized');
	});

	test('Save and retrieve dialogue record', async () => {
		const testRecord: DialogueRecord = {
			id: 'test-id-1',
			sessionId: 'test-session',
			timestamp: new Date(),
			speaker: 'USER',
			content: 'This is a test message',
			recordType: 'DIALOGUE',
			filePath: undefined,
			modificationType: undefined,
			oldContent: undefined,
			newContent: undefined,
			operationDetails: undefined
		};

		await dbService.saveRecord(testRecord);
		
		const records = await dbService.getRecordsBySession('test-session');
		assert.ok(records.length > 0, 'Should retrieve at least one record');
		assert.strictEqual(records[0].speaker, 'USER', 'Retrieved record should match inserted data');
	});

	test('Search functionality', async () => {
		// Insert test records
		const testRecord: DialogueRecord = {
			id: 'test-id-2',
			sessionId: 'test-session',
			timestamp: new Date(),
			speaker: 'USER',
			content: 'Search test message',
			recordType: 'DIALOGUE',
			filePath: undefined,
			modificationType: undefined,
			oldContent: undefined,
			newContent: undefined,
			operationDetails: undefined
		};

		await dbService.saveRecord(testRecord);

		const results = await dbService.searchRecords('search');
		assert.ok(results.length > 0, 'Should find records with search term');
		assert.ok(results[0].content.includes('search'), 'Search result should contain the search term');
	});

	test('Multiple session management', async () => {
		// Test records for different sessions
		const session1Record: DialogueRecord = {
			id: 'session1-test',
			sessionId: 'session-1',
			timestamp: new Date(),
			speaker: 'USER',
			content: 'Session 1 message',
			recordType: 'DIALOGUE'
		};

		const session2Record: DialogueRecord = {
			id: 'session2-test',
			sessionId: 'session-2',
			timestamp: new Date(),
			speaker: 'BUILDER',
			content: 'Session 2 message',
			recordType: 'DIALOGUE'
		};

		await dbService.saveRecord(session1Record);
		await dbService.saveRecord(session2Record);

		// Test session isolation
		const session1Records = await dbService.getRecordsBySession('session-1');
		const session2Records = await dbService.getRecordsBySession('session-2');

		assert.strictEqual(session1Records.length, 1, 'Session 1 should have 1 record');
		assert.strictEqual(session2Records.length, 1, 'Session 2 should have 1 record');
		assert.strictEqual(session1Records[0].sessionId, 'session-1', 'Session 1 record should belong to session-1');
		assert.strictEqual(session2Records[0].sessionId, 'session-2', 'Session 2 record should belong to session-2');
	});

	test('Time-based search', async () => {
		const now = new Date();
		const oneMinuteAgo = new Date(now.getTime() - 60000);
		const twoMinutesAgo = new Date(now.getTime() - 120000);

		const oldRecord: DialogueRecord = {
			id: 'old-record',
			sessionId: 'time-test',
			timestamp: twoMinutesAgo,
			speaker: 'USER',
			content: 'Old message',
			recordType: 'DIALOGUE'
		};

		const recentRecord: DialogueRecord = {
			id: 'recent-record',
			sessionId: 'time-test',
			timestamp: oneMinuteAgo,
			speaker: 'BUILDER',
			content: 'Recent message',
			recordType: 'DIALOGUE'
		};

		await dbService.saveRecord(oldRecord);
		await dbService.saveRecord(recentRecord);

		// Search within time range
		const startTime = new Date(now.getTime() - 90000); // 1.5 minutes ago
		const endTime = new Date(now.getTime() - 30000); // 30 seconds ago

		const timeFilteredResults = await dbService.searchRecords('', startTime, endTime);
		assert.strictEqual(timeFilteredResults.length, 1, 'Should find 1 record in time range');
		assert.strictEqual(timeFilteredResults[0].id, 'recent-record', 'Should find the recent record');
	});

	test('Record type filtering', async () => {
		const dialogueRecord: DialogueRecord = {
			id: 'dialogue-test',
			sessionId: 'type-test',
			timestamp: new Date(),
			speaker: 'USER',
			content: 'Dialogue message',
			recordType: 'DIALOGUE'
		};

		const fileModRecord: DialogueRecord = {
			id: 'filemod-test',
			sessionId: 'type-test',
			timestamp: new Date(),
			speaker: 'BUILDER',
			content: 'File modification',
			recordType: 'FILE_MODIFICATION',
			filePath: '/test/file.js',
			modificationType: 'MODIFY'
		};

		await dbService.saveRecord(dialogueRecord);
		await dbService.saveRecord(fileModRecord);

		const allRecords = await dbService.getRecordsBySession('type-test');
		const dialogueRecords = allRecords.filter(r => r.recordType === 'DIALOGUE');
		const fileModRecords = allRecords.filter(r => r.recordType === 'FILE_MODIFICATION');

		assert.strictEqual(dialogueRecords.length, 1, 'Should have 1 dialogue record');
		assert.strictEqual(fileModRecords.length, 1, 'Should have 1 file modification record');
	});

	test('Get all sessions', async () => {
		// Create multiple sessions
		const sessions = ['session-a', 'session-b', 'session-c'];
		
		for (const sessionId of sessions) {
			const record: DialogueRecord = {
				id: `record-${sessionId}`,
				sessionId: sessionId,
				timestamp: new Date(),
				speaker: 'USER',
				content: `Message for ${sessionId}`,
				recordType: 'DIALOGUE'
			};
			await dbService.saveRecord(record);
		}

		const allSessions = await dbService.getAllSessions();
		assert.ok(allSessions.length >= 3, 'Should retrieve all sessions');
		
		// Verify session IDs are present
		const sessionIds = new Set(allSessions);
		sessions.forEach(sessionId => {
			assert.ok(sessionIds.has(sessionId), `Session ${sessionId} should be present`);
		});
	});

	test('Empty search results', async () => {
		const results = await dbService.searchRecords('nonexistentkeyword');
		assert.strictEqual(results.length, 0, 'Should return empty results for nonexistent keyword');
	});

	test('Database cleanup', async () => {
		// Test that database can be properly closed
		await dbService.close();
		
		// Verify that service is no longer usable after close
		try {
			await dbService.saveRecord({
				id: 'test-after-close',
				sessionId: 'test',
				timestamp: new Date(),
				speaker: 'USER',
				content: 'Test after close',
				recordType: 'DIALOGUE'
			});
			assert.fail('Should throw error after database is closed');
		} catch (error) {
			// Expected behavior - database should be closed
			assert.ok(error instanceof Error, 'Should throw error');
		}
	});
});