export type TriggerMode = 'always' | 'keyword' | 'semantic' | 'hybrid';
export type InjectionPosition = 'system_top' | 'system_after_char' | 'system_bottom' | 'before_history';
export type Category = 'character' | 'location' | 'item' | 'faction' | 'relationship' | 'world' | 'event' | 'rule' | 'style';

export interface StoryBibleEntry {
    id: string;             // UUID 
    title: string;
    category: Category;
    source: 'bootstrap' | 'auto' | 'manual';
    version: number;

    // Content
    content: string;
    summary?: string;       // Condensed version if needed

    // Retrieval
    keywords: string[];
    tags: string[];
    triggerMode: TriggerMode;
    
    // Ranking
    priority: number;       // 0 - 100
    weight: number;
    sticky: boolean;
    stickyTurns: number;

    // Injection
    position: InjectionPosition;
    depth: number;

    // Tracking
    timesTriggered: number;
    confidence: number;
    createdAt: number;
    updatedAt: number;
    changelog: string[];
    
    // Metadata-Aware Retrieval fields
    embedding?: number[];
    searchScore?: number;
    metadataScoreBoost?: number;
    metadataDiagnostic?: {
        categoryMatched: boolean;
        boostedCategory?: string;
        matchedTags: string[];
        matchDetails: string;
    };
}
