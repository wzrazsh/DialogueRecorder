export interface DialogueRecord {
    id: string;
    sessionId: string;
    timestamp: Date;
    speaker: 'USER' | 'BUILDER' | 'CHAT';
    content: string;
    recordType: 'DIALOGUE';
}

export interface SearchCriteria {
    keyword?: string;
    startTime?: Date;
    endTime?: Date;
    speaker?: 'USER' | 'BUILDER' | 'CHAT';
    recordType?: 'DIALOGUE';
}

export interface SearchResult {
    record: DialogueRecord;
    relevance: number;
    matchedFields: string[];
}

export interface SessionGroup {
    sessionId: string;
    sessionName: string;
    recordCount: number;
    firstTimestamp: string;
    lastTimestamp: string;
    speakers: string[];
    isExpanded: boolean;
}

export interface SessionDetail {
    sessionId: string;
    sessionName: string;
    records: DialogueRecord[];
    totalRecords: number;
    duration: string;
    speakers: string[];
    startTime: string;
    endTime: string;
}