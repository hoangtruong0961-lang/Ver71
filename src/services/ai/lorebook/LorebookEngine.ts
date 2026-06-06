
import { Lorebook, LorebookEntry } from "./types";
import { useAppStore } from "../../../store/appStore";
import MiniSearch from "minisearch";

// Default values for common LSR variables to avoid raw macro leaks
const LSR_DEFAULTS: Record<string, string> = {
    'tableConfigDateFormat': 'YYYY-MM-DD',
    'tableConfigTimeFormat': 'hh:mm',
    'tableConfigExtraTimeFormat': 'Day X',
    'tableConfigRecentLimit': '5',
    'tableConfigCharacterMember': 'Character',
    'tableConfigContentBegin': '<content>',
    'tableConfigContentEnd': '</content>',
    'tableConfigCoTBegin': '<thinking>',
    'tableConfigCoTEnd': '</thinking>',
    'tableConfigUserInput': '<user_input>',
    'tableConfigTagsBeforeTableEdit': '',
    'tableConfigTagsAfterTableEdit': '',
    // Dummy values for logic flags
    'tableConfigSexWrite': '1',
    'tableConfigScheduleWrite': '1',
    'tableConfigAbilityWrite': '1',
    'tableConfigOrganizationWrite': '1',
    'tableConfigLocationWrite': '1',
    'tableConfigHistoryRows': '3',
    'tableConfigHistoryLength': '100 tokens',
    'tableConfigSummaryRows': '5',
    'tableConfigSummaryLength': '200 tokens',
    'tableConfigPresumeMode': '1',
    'tableConfigCharacterReferenceName': 'none',
};

// --- EJS & ST MACRO COMPILER & SANDBOX ---

function isSafeEjsCode(code: string): boolean {
    if (!code) return true;
    const dangerousPatterns = [
        /\bconstructor\b/i,
        /\b__proto__\b/i,
        /\bprototype\b/i,
        /\bprocess\b/i,
        /\brequire\b/i,
        /\bmodule\b/i,
        /\bwindow\b/i,
        /\bdocument\b/i,
        /\beval\b/i,
        /\bglobal\b/i,
        /\bglobalThis\b/i,
        /\bFunction\b/i
    ];
    for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
            return false;
        }
    }
    return true;
}

function compileEjsToFunction(template: string, sandboxKeys: string[]): Function {
    let code = "let _out = [];\n";
    
    // Split template into text fragments and EJS blocks (handles both -%> and _%>)
    const regex = /<%_?(-|=)?([\s\S]*?)[_-]?%>/g;
    let cursor = 0;
    let match;
    
    while ((match = regex.exec(template)) !== null) {
        const textBefore = template.slice(cursor, match.index);
        if (textBefore) {
            code += `_out.push(${JSON.stringify(textBefore)});\n`;
        }
        
        const modifier = match[1]; 
        const bodyContent = match[2];
        
        // Safety sandbox check: Prevent EJS Prototype Poisoning or XSS Escapes
        if (!isSafeEjsCode(bodyContent)) {
            console.warn("[EJS Sandbox Escape Intercepted] Blocked expression:", bodyContent);
            code += `_out.push('[Blocked: Potential Sandbox Escape Attempt]');\n`;
            cursor = regex.lastIndex;
            continue;
        }
        
        if (modifier === '-' || modifier === '=') {
            const cleanExpr = bodyContent.trim();
            code += `try { 
                const val = ${cleanExpr};
                _out.push(val !== undefined && val !== null ? String(val) : '');
            } catch(e) { 
                _out.push(''); 
            }\n`;
        } else {
            code += `${bodyContent}\n`;
        }
        
        cursor = regex.lastIndex;
    }
    
    const remainingText = template.slice(cursor);
    if (remainingText) {
        code += `_out.push(${JSON.stringify(remainingText)});\n`;
    }
    
    code += "return _out.join('');\n";
    
    return new Function(...sandboxKeys, code);
}

function createSandbox(tavoVars: Record<string, any>, dynamicVars: Record<string, string>) {
    const getvar = (key: string, defaultValue: any = "") => {
        const cleanKey = key.trim();
        if (tavoVars[cleanKey] !== undefined) return tavoVars[cleanKey];
        if (dynamicVars[cleanKey] !== undefined) return dynamicVars[cleanKey];
        if (LSR_DEFAULTS[cleanKey] !== undefined) return LSR_DEFAULTS[cleanKey];
        return defaultValue;
    };

    const setvar = (key: string, val: any) => {
        const cleanKey = key.trim();
        tavoVars[cleanKey] = val;
        return "";
    };

    const incvar = (key: string, step: number = 1) => {
        const cleanKey = key.trim();
        const curr = Number(getvar(cleanKey, 0)) || 0;
        const newVal = curr + step;
        tavoVars[cleanKey] = newVal;
        return "";
    };

    const decvar = (key: string, step: number = 1) => {
        return incvar(key, -step);
    };

    const delvar = (key: string) => {
        const cleanKey = key.trim();
        delete tavoVars[cleanKey];
        return "";
    };

    const userVal = dynamicVars["user"] || "User";
    const charVal = dynamicVars["char"] || "Character";

    return {
        getvar,
        getglobalvar: getvar,
        setvar,
        setglobalvar: setvar,
        incvar,
        decvar,
        delvar,
        user: userVal,
        userName: userVal,
        char: charVal,
        charName: charVal,
    };
}

function translateMacrosToEjs(text: string, activeKeys: string[]): string {
    let result = text;

    // {{setvar::KEY::VALUE}} or {{setglobalvar::KEY::VALUE}}
    result = result.replace(/\{\{set(?:global)?var::(.*?)::([\s\S]*?)\}\}/gi, (_match, key, val) => {
        return `<% setvar(${JSON.stringify(key.trim())}, ${JSON.stringify(val)}) %>`;
    });

    // {{addvar::KEY::VALUE}}
    result = result.replace(/\{\{addvar::(.*?)::(.*?)\}\}/gi, (_match, key, val) => {
        const stepNum = Number(val.trim()) || 0;
        return `<% incvar(${JSON.stringify(key.trim())}, ${stepNum}) %>`;
    });

    // {{incvar::KEY}}
    result = result.replace(/\{\{incvar::(.*?)\}\}/gi, (_match, key) => {
        return `<% incvar(${JSON.stringify(key.trim())}) %>`;
    });

    // {{decvar::KEY}}
    result = result.replace(/\{\{decvar::(.*?)\}\}/gi, (_match, key) => {
        return `<% decvar(${JSON.stringify(key.trim())}) %>`;
    });

    // {{getvar::KEY}} or {{getglobalvar::KEY}}
    result = result.replace(/\{\{get(?:global)?var::(.*?)\}\}/gi, (_match, key) => {
        return `<%- getvar(${JSON.stringify(key.trim())}) %>`;
    });

    // {{pick::val1|val2|...}}
    result = result.replace(/\{\{pick::([\s\S]*?)\}\}/gi, (_match, choices) => {
        const list = choices.split('|').map((c: string) => c.trim());
        return `<%- [${list.map((c: string) => JSON.stringify(c)).join(', ')}][Math.floor(Math.random() * ${list.length})] %>`;
    });

    // Translate common standard macros
    const stdReplacements: Record<string, string> = {
        'user': '<%- user %>',
        'user_name': '<%- user %>',
        'username': '<%- user %>',
        'char': '<%- char %>',
        'char_name': '<%- charName %>',
        'charname': '<%- charName %>',
        'trim': '',
    };

    result = result.replace(/\{\{(.*?)\}\}/g, (match, key) => {
        const cleanKey = key.trim();
        const lowerKey = cleanKey.toLowerCase();
        if (stdReplacements[lowerKey] !== undefined) {
            return stdReplacements[lowerKey];
        }
        if (activeKeys.includes(cleanKey)) {
            return `<%- getvar(${JSON.stringify(cleanKey)}) %>`;
        }
        // General fallback to getvar
        return `<%- getvar(${JSON.stringify(cleanKey)}) %>`;
    });

    return result;
}

function fallbackProcessMacros(text: string, dynamicVars: Record<string, string>, tavoVars: Record<string, any>): string {
    let processed = text;
    processed = processed.replace(/<%_?[\s\S]*?_?%>/g, '');
    processed = processed.replace(/\{\{(?:getvar::)?(.*?)\}\}/g, (_match, key) => {
        const cleanKey = key.trim();
        if (tavoVars[cleanKey] !== undefined) return String(tavoVars[cleanKey]);
        if (dynamicVars[cleanKey] !== undefined) return dynamicVars[cleanKey];
        if (LSR_DEFAULTS[cleanKey] !== undefined) return LSR_DEFAULTS[cleanKey];
        return '';
    });
    return processed.replace(/^\s*[\r\n]/gm, '');
}

export class LorebookService {
    private static miniSearchInstance: MiniSearch<any> | null = null;
    private static cachedEntriesKey: string = '';

    private static getMiniSearch(entries: LorebookEntry[]): MiniSearch<any> | null {
        if (!entries || entries.length === 0) return null;
        
        // Quick, stable cache key to check if entries list has changed
        const keyParts: string[] = [];
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            keyParts.push(`${e.uid}:${e.content?.length || 0}:${(e.key ?? []).join(',')}`);
        }
        const currentKey = keyParts.join("|");

        if (this.miniSearchInstance && this.cachedEntriesKey === currentKey) {
            return this.miniSearchInstance;
        }

        try {
            const ms = new MiniSearch({
                fields: ['title', 'content', 'keywordsString'],
                storeFields: ['uid'],
                searchOptions: {
                    boost: { title: 2, keywordsString: 1.5, content: 1 },
                    prefix: true,
                    fuzzy: 0.2
                }
            });

            const docs = entries.map(e => ({
                id: String(e.uid),
                uid: String(e.uid),
                title: e.comment || '',
                content: e.content || '',
                keywordsString: Array.isArray(e.key) ? e.key.join(' ') : ''
            }));

            ms.addAll(docs);
            this.miniSearchInstance = ms;
            this.cachedEntriesKey = currentKey;
            return ms;
        } catch (err) {
            console.error("[LorebookService] Failed to create or update MiniSearch BM25 index:", err);
            return null;
        }
    }

    /**
     * Converts raw JSON structure to Array
     */
    static loadLorebook(jsonData: Lorebook): LorebookEntry[] {
        if (!jsonData || !jsonData.entries) return [];
        return Object.values(jsonData.entries);
    }

    /**
     * Direction 2 Implementation: Evaluates and compiles both custom macros & EJS logic blocks.
     * Keeps variables perfectly synchronized in tavoVars and Zustand game store.
     */
    static processMacros(
        text: string, 
        dynamicVars: Record<string, string> = {}, 
        tavoVars: Record<string, any> = {}
    ): string {
        if (!text) return "";

        try {
            const activeKeys = Object.keys(tavoVars);
            let ejsTemplate = translateMacrosToEjs(text, activeKeys);

            const sandbox = createSandbox(tavoVars, dynamicVars);
            const sandboxKeys = Object.keys(sandbox);
            const sandboxValues = Object.values(sandbox);

            const compiledFn = compileEjsToFunction(ejsTemplate, sandboxKeys);
            let result = compiledFn(...sandboxValues);

            if (text.toLowerCase().includes('{{trim}}')) {
                result = result.trim();
            }

            // Sync tavoVars state changes back to Zustand
            try {
                const store = useAppStore.getState();
                const activeWorld = store.activeWorld;
                if (activeWorld) {
                    store.updateWorld({
                        tavoVars: { ...activeWorld.tavoVars, ...tavoVars }
                    });
                }
            } catch (err) {
                // Silently bypass in unit tests or SSR context
            }

            return result.replace(/^\s*[\r\n]{2,}/gm, '\n\n').replace(/^\s*[\r\n]/gm, '\n');
        } catch (error) {
            console.warn("[LorebookService] EJS compiled evaluation failed. Using fallback processor.", error);
            return fallbackProcessMacros(text, dynamicVars, tavoVars);
        }
    }

    /**
     * Helper to check if a phrase is in text considering case and whole-word rules
     */
    private static isMatch(text: string, keyword: string, caseSensitive: boolean, matchWholeWords: boolean): boolean {
        if (!keyword.trim()) return false;
        
        let flags = 'g';
        if (!caseSensitive) flags += 'i';
        
        let patternStr = keyword.trim();
        // Escape regex special chars if we are treating as literal text (for basic matching, or consider if user uses regex keys)
        // For simplicity, we assume simple text strings, optionally using \b for whole words
        
        // If the keyword itself is a regex (e.g. /pattern/i), parse it. 
        // ST supports regex keys starting and ending with /
        if (patternStr.startsWith('/') && patternStr.lastIndexOf('/') > 0) {
            const lastSlash = patternStr.lastIndexOf('/');
            const regexStr = patternStr.substring(1, lastSlash);
            const regexFlags = patternStr.substring(lastSlash + 1);
            try {
                return new RegExp(regexStr, regexFlags).test(text);
            } catch(e) {
                return false;
            }
        }

        // Escape regex specials
        patternStr = patternStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        if (matchWholeWords) {
            // Check word boundaries. Note: may not work perfectly for non-English.
            patternStr = `\\b${patternStr}\\b`;
        }
        
        try {
            return new RegExp(patternStr, flags).test(text);
        } catch(e) {
            return false; // Safely fail
        }
    }

    /**
     * Checks Primary and Secondary keywords against Selective Logic
     */
    private static evaluateKeys(text: string, entry: LorebookEntry): boolean {
        if (!entry.key || entry.key.length === 0) return false;

        const caseSens = !!entry.caseSensitive;
        const wholeWords = entry.matchWholeWords ?? true;

        // Has primary key?
        const hasPrimary = entry.key.some(k => this.isMatch(text, k, caseSens, wholeWords));
        if (!hasPrimary) return false;

        // Check secondary keys
        const secondary = entry.keysecondary || [];
        if (secondary.length === 0) return true; // No selective logic needed

        const logic = entry.selectiveLogic ?? 0;
        let matchedSecondaryCount = 0;
        
        for (const sk of secondary) {
            if (this.isMatch(text, sk, caseSens, wholeWords)) {
                matchedSecondaryCount++;
            }
        }

        switch (logic) {
            case 0: // AND ANY
                return matchedSecondaryCount > 0;
            case 1: // AND ALL
                return matchedSecondaryCount === secondary.length;
            case 2: // NOT ANY
                return matchedSecondaryCount === 0;
            case 3: // NOT ALL
                return matchedSecondaryCount < secondary.length;
            default:
                return true;
        }
    }

    /**
     * Evaluates time effects (sticky, cooldown, delay) statelessly by simulating past chat turns.
     */
    private static evaluateTimeEffects(
        entry: LorebookEntry,
        messageHistory: string[],
        textToScanCurrent: string
    ): boolean {
        const c = entry.cooldown || 0;
        const d = entry.delay || 0;
        const s = entry.sticky || 0;
        
        const activeQueue: number[] = [];
        let stickyEndTurn = -1000;

        // Only simulate the minimum required history window to avoid lag
        const maxLookback = Math.max(50, d + c + s + 2);
        const startIndex = Math.max(0, messageHistory.length - 1 - maxLookback);
        
        // Loop up to previous turns
        for (let i = startIndex; i < messageHistory.length - 1; i++) {
            const isMatched = this.evaluateKeys(messageHistory[i], entry);
            const inCooldown = i <= stickyEndTurn + c && i > stickyEndTurn;

            if (isMatched && !inCooldown) {
                if (!activeQueue.includes(i + d)) activeQueue.push(i + d);
            }

            if (i <= stickyEndTurn) {
                // still sticky
            } else if (activeQueue.includes(i)) {
                stickyEndTurn = i + s; // if s=1, stays active this turn + next turn
            }
        }
        
        // Now for CURRENT turn
        const i = messageHistory.length > 0 ? messageHistory.length - 1 : 0;
        const isMatched = this.evaluateKeys(textToScanCurrent, entry);
        const inCooldown = i <= stickyEndTurn + c && i > stickyEndTurn;

        if (isMatched && !inCooldown) {
            if (!activeQueue.includes(i + d)) activeQueue.push(i + d);
        }

        if (i <= stickyEndTurn) {
            return true;
        } else if (activeQueue.includes(i)) {
            return true;
        }
        
        return false;
    }

    /**
     * Scans inputs and returns the finalized active entries
     */
    static scanAndGetActiveEntries(
        textToScanOriginal: string, 
        entries: LorebookEntry[], 
        dynamicVars: Record<string, string> = {},
        messageHistory: string[] = [] // History up to current turn
    ): LorebookEntry[] {
        const activeEntriesMap = new Map<string, LorebookEntry>(); // UID -> Entry
        
        // --- PASS 1: Main scanning
        let textToScan = textToScanOriginal;
        
        let newActivations = true;
        let recursionDepth = 0;
        const MAX_RECURSION = 3;

        while (newActivations && recursionDepth <= MAX_RECURSION) {
            newActivations = false;

            // BM25 Hybrid Optimization: Filter dynamic evaluation set to only include highly-relevant entries
            let candidateUids: Set<string> | null = null;
            const ms = this.getMiniSearch(entries);
            if (ms && textToScan.trim().length > 0) {
                try {
                    const results = ms.search(textToScan, {
                        prefix: true,
                        fuzzy: 0.2
                    });
                    candidateUids = new Set(results.map(r => String(r.id)));
                } catch (err) {
                    // Fallback to full evaluation on error
                }
            }

            for (const entry of entries) {
                if (entry.disable) continue;
                if (activeEntriesMap.has(entry.uid.toString())) continue;
                if (recursionDepth > 0 && entry.nonRecursive) continue; // Skip non-recursive on pass > 0
                if (recursionDepth === 0 && entry.delayUntilRecursive) continue; // Skip on first pass

                // Skip scanning if candidate list exists, the entry is not constant and not time-sensitive, and not in the candidate list
                if (candidateUids && !entry.constant) {
                    const hasTimeEffects = (entry.delay !== undefined && entry.delay > 0) || 
                                           (entry.cooldown !== undefined && entry.cooldown > 0) || 
                                           (entry.sticky !== undefined && entry.sticky > 0);
                    if (!hasTimeEffects && !candidateUids.has(entry.uid.toString())) {
                        continue; // Skip evaluating keys to save massive amounts of overhead and token leaks
                    }
                }

                let activated = false;

                if (entry.constant) {
                    activated = true;
                } else {
                    const hasTimeEffects = (entry.delay !== undefined && entry.delay > 0) || 
                                           (entry.cooldown !== undefined && entry.cooldown > 0) || 
                                           (entry.sticky !== undefined && entry.sticky > 0);
                                           
                    if (hasTimeEffects && messageHistory.length > 0) {
                        activated = this.evaluateTimeEffects(entry, messageHistory, textToScan);
                    } else {
                        activated = this.evaluateKeys(textToScan, entry);
                    }
                }

                if (activated) {
                    // Check probability
                    const prob = entry.probability ?? 100;
                    if (prob < 100 && Math.random() * 100 > prob) {
                        continue; // Failed probability check
                    }

                    activeEntriesMap.set(entry.uid.toString(), entry);
                    newActivations = true;
                    
                    // Add content to the scan buffer so it can trigger other entries (unless preventRecursion)
                    if (!entry.preventRecursion) {
                        textToScan += "\n" + entry.content;
                    }
                }
            }
            recursionDepth++;
        }

        const activeList = Array.from(activeEntriesMap.values());

        // --- GROUP RESOLUTION ---
        const groupedEntries = new Map<string, LorebookEntry[]>();
        const finalizedList: LorebookEntry[] = [];

        for (const entry of activeList) {
            if (entry.group && entry.group.trim().length > 0) {
                const groupName = entry.group.trim();
                if (!groupedEntries.has(groupName)) {
                    groupedEntries.set(groupName, []);
                }
                groupedEntries.get(groupName)!.push(entry);
            } else {
                finalizedList.push(entry);
            }
        }
        
        // Resolve groups using weighted random selection (SillyTavern style)
        for (const [groupName, groupList] of groupedEntries.entries()) {
            if (groupList.length === 1) {
                finalizedList.push(groupList[0]);
                continue;
            }
            
            // Calculate total weight
            let totalWeight = 0;
            for (const entry of groupList) {
                totalWeight += Math.max(0, entry.groupWeight ?? 100);
            }
            
            if (totalWeight <= 0) {
                 // Fallback if all weights are 0, pick a random one uniformly
                 finalizedList.push(groupList[Math.floor(Math.random() * groupList.length)]);
                 continue;
            }
            
            // Random value between 0 and totalWeight
            let random = Math.random() * totalWeight;
            let selectedEntry = groupList[groupList.length - 1]; // Fallback to last
            
            for (const entry of groupList) {
                const weight = Math.max(0, entry.groupWeight ?? 100);
                if (random < weight) {
                    selectedEntry = entry;
                    break;
                }
                random -= weight;
            }
            finalizedList.push(selectedEntry);
        }

        // Sorting Logic: Higher order means inserted later
        finalizedList.sort((a, b) => a.order - b.order);
        
        return finalizedList;
    }

    /**
     * Scans inputs and returns the combined text of activated entries
     */
    static scanAndActivate(
        textToScanOriginal: string, 
        entries: LorebookEntry[], 
        dynamicVars: Record<string, string> = {},
        messageHistory: string[] = [],
        tavoVars: Record<string, any> = {}
    ): string {
        const finalizedList = this.scanAndGetActiveEntries(textToScanOriginal, entries, dynamicVars, messageHistory);

        // Process content (Macros cleaning) and join
        const combinedText = finalizedList
            .map(e => this.processMacros(e.content, dynamicVars, tavoVars))
            .filter(text => text.trim().length > 0)
            .join('\n\n');

        return combinedText;
    }
}
