
export interface LorebookEntry {
  uid: number | string;
  key: string[]; // Keywords
  keysecondary?: string[];
  content: string;
  comment?: string;
  
  // Activation flags
  constant: boolean;
  disable: boolean;
  
  // Sorting & Positioning
  order: number;
  position?: number; // 0: before char, 1: after char, 2: before examples, 3: after examples, 4: AN top, 5: AN bottom
  depth?: number; // for @ D
  
  selectiveLogic?: number; // 0: AND ANY, 1: AND ALL, 2: NOT ANY, 3: NOT ALL
  probability?: number; // 0-100
  
  // Inclusion Groups
  group?: string; // Comma separated list
  groupWeight?: number;
  preventRecursion?: boolean;
  delayUntilRecursive?: boolean;
  nonRecursive?: boolean;
  
  // Matching settings
  caseSensitive?: boolean;
  matchWholeWords?: boolean;
  
  // Time effects (measured in messages/turns)
  sticky?: number;
  cooldown?: number;
  delay?: number;
}

export interface Lorebook {
  entries: Record<string, LorebookEntry>;
  name?: string;
  description?: string;
}
