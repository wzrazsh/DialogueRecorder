export interface DialogueRecord {
    id: string;
    sessionId: string;
    timestamp: Date;
    speaker: 'USER' | 'BUILDER' | 'CHAT';
    content: string;
    recordType: 'DIALOGUE' | 'FILE_MODIFICATION' | 'UNDO' | 'REDO';
    filePath?: string;
    modificationType?: 'CREATE' | 'MODIFY' | 'DELETE' | 'RENAME';
    oldContent?: string;
    newContent?: string;
    operationDetails?: string;
}

export interface SearchCriteria {
    keyword?: string;
    startTime?: Date;
    endTime?: Date;
    speaker?: 'USER' | 'BUILDER' | 'CHAT';
    recordType?: 'DIALOGUE' | 'FILE_MODIFICATION' | 'UNDO' | 'REDO';
    fileExtension?: string;
}

export interface SearchResult {
    record: DialogueRecord;
    relevance: number;
    highlights: string[];
}