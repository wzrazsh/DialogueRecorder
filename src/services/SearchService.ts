import { DialogueRecord, SearchCriteria, SearchResult } from '../models/DialogueRecord';
import { DatabaseService } from './DatabaseService';

export class SearchService {
    private databaseService: DatabaseService;

    constructor(databaseService: DatabaseService) {
        this.databaseService = databaseService;
    }

    async search(criteria: SearchCriteria): Promise<SearchResult[]> {
        try {
            // 使用DatabaseService进行真实搜索
            const records = await this.databaseService.searchRecords(
                criteria.keyword || '',
                criteria.startTime,
                criteria.endTime
            );

            // 根据其他条件过滤结果
            const filteredRecords = records.filter(record => {
                if (criteria.speaker && record.speaker !== criteria.speaker) {
                    return false;
                }
                if (criteria.recordType && record.recordType !== criteria.recordType) {
                    return false;
                }
                if (criteria.fileExtension && record.filePath && 
                    !record.filePath.endsWith(criteria.fileExtension)) {
                    return false;
                }
                return true;
            });

            // 转换为SearchResult格式
            const searchResults: SearchResult[] = filteredRecords.map(record => ({
                record,
                relevance: this.calculateRelevance(record, criteria.keyword || ''),
                highlights: this.extractHighlights(record.content, criteria.keyword || '')
            }));

            // 按相关性排序
            return searchResults.sort((a, b) => b.relevance - a.relevance);
        } catch (error) {
            console.error('SearchService: 搜索失败:', error);
            throw error;
        }
    }

    private calculateRelevance(record: DialogueRecord, keyword: string): number {
        if (!keyword) return 0.5; // 无关键词时默认相关性
        
        const content = record.content.toLowerCase();
        const keywordLower = keyword.toLowerCase();
        
        if (content.includes(keywordLower)) {
            // 关键词出现在内容中，计算相关性
            const keywordCount = (content.match(new RegExp(keywordLower, 'g')) || []).length;
            const position = content.indexOf(keywordLower);
            const positionScore = Math.max(0, 1 - position / content.length);
            
            return Math.min(1, 0.3 + (keywordCount * 0.2) + (positionScore * 0.5));
        }
        
        return 0; // 关键词未找到
    }

    private extractHighlights(content: string, keyword: string): string[] {
        if (!keyword) return [];
        
        const highlights: string[] = [];
        const keywordLower = keyword.toLowerCase();
        const contentLower = content.toLowerCase();
        
        let index = contentLower.indexOf(keywordLower);
        while (index !== -1) {
            // 提取关键词周围的上下文
            const start = Math.max(0, index - 20);
            const end = Math.min(content.length, index + keyword.length + 20);
            const highlight = content.substring(start, end);
            highlights.push(highlight);
            
            index = contentLower.indexOf(keywordLower, index + 1);
        }
        
        return highlights;
    }

    async searchByKeyword(keyword: string): Promise<SearchResult[]> {
        return this.search({ keyword });
    }

    async searchByTimeRange(startTime: Date, endTime: Date): Promise<SearchResult[]> {
        return this.search({ startTime, endTime });
    }

    async searchBySpeaker(speaker: 'USER' | 'BUILDER' | 'CHAT'): Promise<SearchResult[]> {
        return this.search({ speaker });
    }

    async searchByFileExtension(extension: string): Promise<SearchResult[]> {
        return this.search({ fileExtension: extension });
    }

    async advancedSearch(criteria: SearchCriteria): Promise<SearchResult[]> {
        // 实现高级搜索逻辑
        return this.search(criteria);
    }

    // 搜索建议功能
    async getSearchSuggestions(partialKeyword: string): Promise<string[]> {
        // 模拟搜索建议
        const suggestions = [
            '对话',
            '文件修改',
            '撤销操作',
            '重做操作',
            'Builder',
            'Chat'
        ];

        return suggestions.filter(suggestion => 
            suggestion.toLowerCase().includes(partialKeyword.toLowerCase())
        );
    }

    // 搜索历史功能
    async getSearchHistory(): Promise<string[]> {
        // 模拟搜索历史
        return ['对话记录', '文件修改', '撤销操作'];
    }

    // 热门搜索功能
    async getPopularSearches(): Promise<string[]> {
        // 模拟热门搜索
        return ['对话', '文件', '操作历史'];
    }
}