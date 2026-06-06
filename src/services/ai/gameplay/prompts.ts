import {
  GameConfig,
  TawaPresetConfig,
  Entity,
  AppSettings,
} from "../../../types";
import { LorebookService } from "../lorebook/LorebookEngine";
// removed LSR_PRESET import
import { GameTime, formatGameTime } from "../../../utils/timeUtils";
import { ContextCompressor } from "../../../utils/compression";

// --- V2 ARCHITECTURE CONSTANTS ---

const POSITION_PRIORITY: Record<string, number> = {
  top: 0,
  system: 10,
  persona: 20, // World Info Sandwich layer
  bottom: 30,
  post_history: 35,
  final: 40,
};

interface PromptSegment {
  content: string;
  priority: number;
  order: number;
  source?: string;
}

// --- REINFORCEMENT PROMPTS (Context Drift Fix) ---
const REINFORCEMENT_PROMPTS = [
  "SYSTEM ALERT: Do NOT mimic the length of recent messages unless structurally required.",
  "CHOICE STRATEGY: Ensure <branches> are strategic, detailed, and suggestive of a sequence of actions. Every choice MUST contain at least 2 distinct actions (e.g., 'Action A and Action B'). Avoid generic options.",
  "ACTION SEQUENCE: Every action suggested in <branches> must be meaningful, detailed, and open up new branching possibilities. Each choice MUST be a compound action (2+ actions).",
  "ANTI-LEAKAGE: Close </content> tag BEFORE writing <branches>. NEVER put narrative inside <branches>. DO NOT leak any English system instructions into the Vietnamese response.",
  "STRUCTURE CHECK: <branches> MUST ONLY contain action choices. Any story text found inside <branches> is a CRITICAL FAILURE. Ensure the first choice is a valid action, not a continuation of the story.",
  "TAG INTEGRITY: Ensure all XML tags (<thinking>, <content>, <branches>, <tableEdit>) are correctly opened and closed. Do not nest <content> inside other tags. Every response MUST contain exactly one <content> tag.",
  "ULTIMATE RULE: All narrative story text MUST be inside the <content> tag. Never output narrative text outside of <content>. If you fail to include <content>, the system will reject your response.",
  "KNOWLEDGE LOGIC DISCIPLINE (CRITICAL): Strictly respect setting rules, limits, prerequisite costs, and power laws in the retrieved Tri Thức (RAG/Trained Knowledge). If resources (e.g., spiritual energy/mana/stamina) are depleted, write logical struggle/failure instead of magic cheats or bypasses."
];

const INITIAL_REINFORCEMENT_PROMPTS = [
  "OPENING CEREMONY: This is the very first turn. You MUST set the scene with extreme vividness. Describe the environment, the atmosphere, and the MC's initial state in great detail.",
  "WORLD INITIALIZATION: Focus on establishing the 'Vibe' of the world. Use sensory details to make the player feel the temperature, the smells, and the sounds of this new world.",
  "CHARACTER INTRODUCTION: Introduce the MC's current situation naturally. Do not summarize their background; show it through their current actions and surroundings.",
  "LSR MANDATORY: You MUST initialize the world state in <tableEdit>. This is the foundation for the entire game. Be precise and thorough.",
  "HOOK THE PLAYER: Write an opening that is impossible to ignore. Create immediate intrigue or a sense of wonder.",
];

export const getReinforcementInstruction = (turnCount: number = 0) => {
  if (turnCount === 0) {
    const listStr = INITIAL_REINFORCEMENT_PROMPTS.map((p, idx) => `${idx + 1}. ${p}`).join("\n");
    return `\n\n<SYSTEM_INJECTION>\n⚠️ INITIALIZATION REMINDERS:\n${listStr}\n</SYSTEM_INJECTION>`;
  }
  const listStr = REINFORCEMENT_PROMPTS.map((p, idx) => `${idx + 1}. ${p}`).join("\n");
  return `\n\n<SYSTEM_INJECTION>\n⚠️ CRITICAL SYSTEM REMINDERS (MANDATORY):\n${listStr}\n</SYSTEM_INJECTION>`;
};

// --- HELPER FUNCTIONS ---

const getPerspectivePrompt = (perspective: string, playerName: string) => {
  switch (perspective) {
    case "first":
      return `PERSPECTIVE: FIRST PERSON.
            - Pronoun: "I" (or appropriate for character personality).
            - Focus: Deeply describe inner thoughts, emotions, and subjective perspective of the main character.
            - Limit: Only know what the character sees and hears.`;
    case "second":
      return `PERSPECTIVE: SECOND PERSON.
            - Pronoun: "You".
            - Focus: Create a sense of direct immersion, as if the player is actually acting.
            - Style: Guide the player's actions.`;
    case "third":
    default:
      return `PERSPECTIVE: THIRD PERSON.
            - Pronoun: Call the character by name ("${playerName}"), or friendly pronouns ("He", "She", "Him", "Her").
            - NOTE: Absolutely avoid using derogatory terms when referring to the main character or friendly characters. Prioritize using names or polite, close pronouns.
            - Focus: Objective, cinematic, covering actions and the surrounding environment.`;
  }
};

const evaluateSingleCondition = (
  cond: string,
  turnCount: number,
  gameTime: any,
  lastMsg: string,
  tavoChatVars: Record<string, any> = {}
): boolean => {
  const trimmed = cond.trim();
  if (!trimmed || trimmed.toLowerCase() === 'always' || trimmed === 'luôn luôn' || trimmed === 'luôn áp dụng') {
    return true;
  }

  // Parse operators: >=, <=, ===, ==, =, >, <
  const compRegex = /^([a-zA-Z_0-9.]+)\s*(>=|<=|==|===|=|>|<)\s*([a-zA-Z_0-9.-]+|'[^']*'|"[^"]*")$/;
  const match = trimmed.match(compRegex);

  if (match) {
    let [, left, op, right] = match;
    left = left.trim();
    right = right.trim().replace(/^['"]|['"]$/g, ''); // strip quotes

    let leftVal: any = undefined;
    if (left === 'turn' || left === 'turnCount' || left === 'turn_count') {
      leftVal = turnCount;
    } else if (left === 'hour' || left === 'time_hour') {
      leftVal = gameTime?.hour ?? 8;
    } else if (left === 'day' || left === 'time_day') {
      leftVal = gameTime?.day ?? 1;
    } else if (left === 'month' || left === 'time_month') {
      leftVal = gameTime?.month ?? 1;
    } else if (left === 'year' || left === 'time_year') {
      leftVal = gameTime?.year ?? 2024;
    } else {
      const cleanKey = left.replace(/^(vars\.|var\.|biến\.)/, '');
      if (cleanKey in tavoChatVars) {
        leftVal = tavoChatVars[cleanKey];
      }
    }

    if (leftVal === undefined) return false;

    const rightNum = Number(right);
    const isRightNumeric = !isNaN(rightNum);
    const rightVal = isRightNumeric ? rightNum : right;

    switch (op) {
      case '>': return Number(leftVal) > Number(rightVal);
      case '<': return Number(leftVal) < Number(rightVal);
      case '>=': return Number(leftVal) >= Number(rightVal);
      case '<=': return Number(leftVal) <= Number(rightVal);
      case '==':
      case '===':
      case '=':
        return String(leftVal) === String(rightVal);
      default: return false;
    }
  }

  const keywordRegex = /^(keyword|contains|chứa|player_msg_contains|tin_nhắn_chứa)\s*:\s*(.+)$/i;
  const kwMatch = trimmed.match(keywordRegex);
  if (kwMatch) {
    const searchStr = kwMatch[2].trim().replace(/^['"]|['"]$/g, '').toLowerCase();
    return lastMsg.toLowerCase().includes(searchStr);
  }

  return true;
};

const evaluateRuleCondition = (
  conditionStr: string,
  turnCount: number,
  gameTime: any,
  lastMsg: string,
  tavoChatVars: Record<string, any> = {}
): boolean => {
  const cond = conditionStr.trim();
  if (!cond) return true;

  // Split by OR operators: " OR ", " || ", " HOẶC "
  const orParts = cond.split(/\s+OR\s+|\s*\|\|\s*|\s+HOẶC\s+/i);
  
  // If any OR expression evaluates to true, return true
  return orParts.some(orPart => {
    // Split by AND operators: " AND ", " && ", " VÀ "
    const andParts = orPart.split(/\s+AND\s+|\s*&&\s*|\s+VÀ\s+/i);
    // All AND expressions must evaluate to true
    return andParts.every(andPart => 
      evaluateSingleCondition(andPart, turnCount, gameTime, lastMsg, tavoChatVars)
    );
  });
};

/**
 * Hàm Prompt Gameplay Chính (REFACTORED V2 - TAWA ULTIMATE)
 * Uses Data-Driven Injection & Granular Modules
 * Task 3.3: Updated to accept relevantMemories string
 */
export const buildGameplaySystemPrompt = (
  worldSettings: Record<string, unknown>,
  playerProfile: Record<string, unknown>,
  entities: Entity[], // Detailed entities (limited)
  allEntities: Entity[], // Full list for minimalist NPC list
  relevantMemories: string, // RAG Context
  turnCount: number,
  presetConfig: TawaPresetConfig,
  gameConfig: GameConfig,
  appSettings?: AppSettings, // NEW: Pass global app settings
  gameTime?: GameTime, // Task: Time System
  lastUserMessage: string = "",
  summary?: string, // NEW: Summary Memory
  tableData: string = "", // NEW: LSR Table Data
  lorebook?: import("../lorebook/types").Lorebook, // NEW: WorldInfo Lorebook
  chatHistory: ChatMessage[] = [], // NEW: Recent Chat History for World Info scanning
  tavoChatVars: Record<string, any> = {}, // Tavo Chat Scope vars
  storyBibleEntries: import("../storybible/types").StoryBibleEntry[] = [], // NEW: dynamic RAG Story Bible
  backgroundInsights?: string, // HYBRID: Background Agent Pre-analysis
  trainedKnowledgeEntries: any[] = [], // NEW: trained background knowledge
) => {
  // --- BƯỚC 0: LOREBOOK PROCESSING (LSR) ---
  const lorebookEntries = LorebookService.loadLorebook({ entries: {} });

  const lsrDynamicVars = {
    user: playerProfile.name,
    tableData: tableData || "(Chưa có dữ liệu trạng thái thế giới)",
  };

  // Combine recent history for thorough scanning (up to last 3 messages + current)
  const recentHistoryText =
    chatHistory
      .slice(-3)
      .map((m) => m.text)
      .join("\n") +
    "\n" +
    lastUserMessage;
    
  const chatHistoryArray = chatHistory.map(m => m.text);
  chatHistoryArray.push(lastUserMessage);

  const lsrPromptContent = LorebookService.scanAndActivate(
    recentHistoryText,
    lorebookEntries,
    lsrDynamicVars,
    chatHistoryArray,
    tavoChatVars
  );

  // --- BƯỚC 1: KHỞI TẠO BIẾN (VARIABLE MAP) ---
  // Ưu tiên lấy từ AppSettings (Cài đặt hệ thống) nếu có, nếu không thì dùng GameConfig (Cấu hình thế giới)
  const activePerspective =
    appSettings?.perspective || gameConfig.perspective || "third";
  const activeDifficulty = appSettings?.difficulty || gameConfig.difficulty;
  const activeOutputLength =
    appSettings?.outputLength || gameConfig.outputLength;
  const activeRealityDifficulty = appSettings?.realityDifficulty || "Normal";

  const contextItems = gameConfig.contextConfig?.items || {
    playerProfile: true,
    worldInfo: true,
    longTermMemory: true,
    relevantMemories: true,
    storyBible: true,
    entities: true,
    npcRegistry: true,
    timeSystem: true,
    reinforcement: true,
  };

  let minWords: number;
  let maxWords: number;
  if (activeOutputLength.id === "custom") {
    minWords = appSettings?.customMinWords || gameConfig.customMinWords || 1000;
    maxWords =
      appSettings?.customMaxWords ||
      gameConfig.customMaxWords ||
      minWords + 2000;
  } else {
    minWords = activeOutputLength.minWords;
    maxWords = activeOutputLength.maxWords || minWords + 2000;
  }

  // Build Entity Content (Detailed - Lorebook/World Info)
  let entityContent = contextItems.entities
    ? "<RELEVANT_WORLD_ENTITIES>\n" +
      entities
        .map((e: Entity) => {
          let desc = `[${e.type}] ${e.name}`;
          
          if (e.appearance) desc += `\n- Ngoại hình: ${e.appearance}`;
          if (e.voiceAndTone) desc += `\n- Giọng nói/Văn phong: ${e.voiceAndTone}`;
          if (e.coreValues) desc += `\n- Giá trị cốt lõi: ${e.coreValues}`;
          if (e.hardLimits) desc += `\n- Hard Limits: ${e.hardLimits}`;
          if (e.definingEvents) desc += `\n- Quá khứ quan trọng: ${e.definingEvents}`;
          if (e.currentMood) desc += `\n- Tâm trạng: ${e.currentMood}`;
          if (e.relationshipTags) desc += `\n- Quan hệ: ${e.relationshipTags}`;
          if (e.strengths) desc += `\n- Điểm mạnh: ${e.strengths}`;
          if (e.weaknesses) desc += `\n- Điểm yếu/Giới hạn: ${e.weaknesses}`;
          if (e.narrativeRole) desc += `\n- Vai trò: ${e.narrativeRole}`;
          if (e.contradictions) desc += `\n- Mâu thuẫn: ${e.contradictions}`;
          if (e.failureMode) desc += `\n- Phản ứng thất bại: ${e.failureMode}`;

          if (e.customFields && Array.isArray(e.customFields)) {
            e.customFields.forEach((cf: any) => {
              if (cf.label && cf.value) {
                desc += `\n- ${cf.label}: ${cf.value}`;
              }
            });
          }

          if (e.exampleMessages) {
             const hasStartTag = e.exampleMessages.includes('<START>');
             const exampleBlock = hasStartTag ? e.exampleMessages : '<START>\n' + e.exampleMessages;
             fewShotExamples.push(exampleBlock);
          }

          // Legacy fields mapping
          if (e.description) desc += `\n- Mô tả: ${e.description.replace(/\s+/g, " ").trim()}`;
          if (e.type === "NPC" && e.personality) desc += `\n- Tính cách: ${e.personality.replace(/\s+/g, " ").trim()}`;
          if (e.type === "NPC" && e.background) desc += `\n- Tiểu sử: ${e.background.replace(/\s+/g, " ").trim()}`;
          
          return desc;
        })
        .join("\n\n") +
      "\n</RELEVANT_WORLD_ENTITIES>"
    : "";

  const entityBaseDescription = entities.map(e => {
     let desc = `[${e.type}] ${e.name}`;
     if (e.description) desc += `\n- Mô tả: ${e.description.replace(/\s+/g, " ").trim()}`;
     if (e.type === "NPC" && e.personality) desc += `\n- Tính cách: ${e.personality.replace(/\s+/g, " ").trim()}`;
     if (e.type === "NPC" && e.background) desc += `\n- Tiểu sử: ${e.background.replace(/\s+/g, " ").trim()}`;
     return desc;
  }).join("\n\n");

  const entityPersonality = entities.map(e => {
     let p = `[${e.type}] ${e.name}`;
     if (e.voiceAndTone) p += `\n- Giọng nói: ${e.voiceAndTone}`;
     if (e.coreValues) p += `\n- Giá trị: ${e.coreValues}`;
     if (e.currentMood) p += `\n- Lời: ${e.currentMood}`;
     return p;
  }).join("\n\n");

  // Evaluate Custom Lorebook (WorldInfo)
  let charBeforeInfo = "";
  let charAfterInfo = "";
  let exampleBeforeInfo = "";
  let exampleAfterInfo = "";

  const segments: PromptSegment[] = [];
  const userSegments: PromptSegment[] = [];
  const assistantSegments: PromptSegment[] = [];
  const fewShotExamples: string[] = [];

  // ST Card Extensions Injection
  const mainNpc = allEntities.length > 0 ? allEntities[0] : undefined;
  if (mainNpc?.extensions) {
     if (mainNpc.extensions.system_prompt) {
         segments.push({
           priority: POSITION_PRIORITY["top"],
           order: -100, // Force absolute top
           content: mainNpc.extensions.system_prompt,
           source: "ST_SystemPrompt"
         });
     }
     if (mainNpc.extensions.post_history_instructions) {
         userSegments.push({
           priority: POSITION_PRIORITY["final"],
           order: -100,
           content: mainNpc.extensions.post_history_instructions,
           source: "ST_PostHistory"
         });
     }
  }

  if (
    contextItems.worldInfo &&
    lorebook &&
    Object.keys(lorebook.entries).length > 0
  ) {
    const customLorebookEntries = Object.values(lorebook.entries);
    const activeCustomLorebookEntries = LorebookService.scanAndGetActiveEntries(
      recentHistoryText,
      customLorebookEntries,
      lsrDynamicVars,
      chatHistoryArray
    );

    activeCustomLorebookEntries.forEach((entry) => {
      const content = LorebookService.processMacros(entry.content, lsrDynamicVars, tavoChatVars);
      const position = entry.position || 0;
      switch (position) {
        case 0:
          charBeforeInfo += (charBeforeInfo ? "\n\n" : "") + content;
          break;
        case 1:
          charAfterInfo += (charAfterInfo ? "\n\n" : "") + content;
          break;
        case 2:
          exampleBeforeInfo += (exampleBeforeInfo ? "\n\n" : "") + content;
          break;
        case 3:
          exampleAfterInfo += (exampleAfterInfo ? "\n\n" : "") + content;
          break;
        // 4: AN Top, 5: AN Bottom, 6: @Depth
        case 4:
        case 5:
        case 6: {
          const depth = entry.depth || 0;
          segments.push({
            priority: POSITION_PRIORITY["bottom"],
            order: 100 - depth,
            content: content,
            source: `WorldInfo:${entry.uid}`,
          });
          break;
        }
      }
    });

    // Merge char info with entityContent
    const mergedCharInfo = [charBeforeInfo, entityContent, charAfterInfo]
      .filter((text) => text && text.trim().length > 0)
      .join("\n\n");
    entityContent = mergedCharInfo;
  }

  // Build Minimalist NPC List (Full list)
  // --- COMPRESSION: Ultra-minimalist format ---
  const minimalistNpcList = allEntities
    .filter((e: Entity) => e.type === "NPC")
    .map((e: Entity) => {
      return `${e.name}(${e.gender || "?"},${e.age || "?"})`;
    })
    .join(", ");

  const minimalistSection =
    contextItems.npcRegistry && minimalistNpcList
      ? `
<MINIMALIST_NPC_REGISTRY>
(This is a list of all NPCs existing in this world. Use IDs for accurate reference if needed)
${minimalistNpcList}
</MINIMALIST_NPC_REGISTRY>`.trim()
      : "";

  // Build Player Content
  const p = playerProfile as any;
  const customFieldsStr = (p.customFields && Array.isArray(p.customFields))
    ? p.customFields.map((cf: any) => (cf.label && cf.value) ? `- ${cf.label}: ${cf.value}` : "").filter(Boolean).join('\n')
    : "";

  const playerDetailsList = [
    p.name ? `- Name: ${p.name}` : "",
    p.gender || p.age ? `- Gender: ${p.gender || '?'} | Age: ${p.age || '?'}` : "",
    p.appearance ? `- Ngoại hình: ${p.appearance}` : "",
    p.voiceAndTone ? `- Giọng nói/Văn phong: ${p.voiceAndTone}` : "",
    p.coreValues ? `- Giá trị cốt lõi: ${p.coreValues}` : "",
    p.hardLimits ? `- Hard Limits: ${p.hardLimits}` : "",
    p.definingEvents ? `- Quá khứ quan trọng: ${p.definingEvents}` : "",
    p.currentMood ? `- Tâm trạng hiện tại: ${p.currentMood}` : "",
    p.relationshipTags ? `- Thiết lập nhóm quan hệ: ${p.relationshipTags}` : "",
    p.strengths ? `- Điểm mạnh: ${p.strengths}` : "",
    p.weaknesses ? `- Điểm yếu/Giới hạn: ${p.weaknesses}` : "",
    p.narrativeRole ? `- Vai trò: ${p.narrativeRole}` : "",
    p.contradictions ? `- Mâu thuẫn nội tâm: ${p.contradictions}` : "",
    p.failureMode ? `- Phản ứng thất bại: ${p.failureMode}` : "",
    p.personality ? `- Tính cách: ${p.personality}` : "",
    p.background ? `- Tiểu sử: ${p.background}` : "",
    p.skills ? `- Kỹ năng: ${p.skills}` : "",
    p.goal ? `- Mục tiêu: ${p.goal}` : ""
  ];

  if (customFieldsStr) {
    playerDetailsList.push(customFieldsStr);
  }

  const playerProfileDetails = playerDetailsList.filter(Boolean).join('\n');

  if (p.exampleMessages) {
     const hasStartTag = p.exampleMessages.includes('<START>');
     const exampleBlock = hasStartTag ? p.exampleMessages : '<START>\n' + p.exampleMessages;
     fewShotExamples.push(exampleBlock);
  }

  const playerContent = contextItems.playerProfile
    ? ContextCompressor.cleanText(`
[Main Character Profile <user>]
${playerProfileDetails}
  `)
    : "";

  // Build Scenario Content
  const scenarioContent = contextItems.worldInfo
    ? ContextCompressor.cleanText(`
[World Context & Plot]
- World Name: ${worldSettings.worldName}
- Genre: ${worldSettings.genre}
- Setting Details: ${worldSettings.context}
  `)
    : "";

  // Variable Map with Defaults
  const charName = entities[0]?.name || "Character";

  const variables: Record<string, string> = {
    word_min: String(minWords),
    word_max: String(maxWords),
    output_language: "Vietnamese",
    "42": "",
    "Tiên Đề Thế Giới": "",
    "<Writing_Style>": "",
    POV_rules: "",
    thinking_chain: "",
    anti_rules: "",
    npc_logic: "",
    "Quan hệ nhân vật": "",
    enigma: "",
    seeds: "",
    outside_cot: "",
    meow_FM: "",
    nsfw_thinking_chain: "",

    world_info: entityContent || "(Chưa có thông tin thực thể)",
    persona: playerContent,
    scenario: scenarioContent,

    // Common ST Macros ---
    user: (playerProfile.name as string) || "User",
    User: (playerProfile.name as string) || "User",
    char: charName,
    Char: charName,
    character: charName,
    description: entityContent || "",
    personality: "",
    mesExamples: [exampleBeforeInfo, exampleAfterInfo]
      .filter((text) => text && text.trim().length > 0)
      .join("\n\n"),
    world: scenarioContent || "",

    user_info: playerContent,

    status_1: "",
    status_2: "",
    snow: "",
    branches: "",
    update_variable: "",

    table_Edit: lsrPromptContent,
  };

  if (presetConfig.variables) {
    for (const tVar of presetConfig.variables) {
      variables[tVar.name] = tVar.value;
    }
  }

  const activeModules = [...presetConfig.modules];
  const inChatSegments: Array<{
    content: string;
    role: "system" | "user" | "assistant";
    depth: number;
    order: number;
    identifier: string;
  }> = [];

  // --- BƯỚC 2: QUÉT MODULE & INJECTION (FIXED LOGIC) ---

  const checkTrigger = (trigger: string, text: string) => {
    if (!trigger.trim()) return false;
    try {
        if (trigger.startsWith('/') && trigger.lastIndexOf('/') > 0) {
           const regexStr = trigger.substring(1, trigger.lastIndexOf('/'));
           const flags = trigger.substring(trigger.lastIndexOf('/') + 1);
           return new RegExp(regexStr, flags).test(text);
        }
        return text.toLowerCase().includes(trigger.toLowerCase());
    } catch {
        return text.toLowerCase().includes(trigger.toLowerCase());
    }
  };

  activeModules.forEach((mod) => {
    if (!mod.enabled || (!mod.content && !mod.marker)) return;

    let segmentContent = mod.content || "";

    // Tầng 4 - Role Injection (Markers)
    if (mod.marker) {
      switch(mod.identifier) {
        case "charPersonality":
          segmentContent = entityPersonality;
          break;
        case "charDescription":
        case "character":
          segmentContent = entityBaseDescription;
          if (entityContent && !segmentContent) segmentContent = entityContent;
          break;
        case "personaDescription":
        case "userProfile":
          segmentContent = playerContent;
          break;
        case "worldInfoBefore":
          segmentContent = charBeforeInfo;
          break;
        case "worldInfoAfter":
          segmentContent = charAfterInfo;
          break;
        case "scenario":
          segmentContent = scenarioContent;
          break;
        case "dialogueExamples":
          segmentContent = [exampleBeforeInfo, exampleAfterInfo].filter(t => t.trim().length > 0).join("\n\n");
          break;
        case "chatHistory":
          // API Adapter will inject the real history directly.
          return;
        default:
          if (!segmentContent) return; // If it's a marker without fallback and unknown, ignore
      }
    }

    if (!segmentContent) return;

    // Check injection triggers if they exist
    if (mod.injection_trigger && mod.injection_trigger.length > 0) {
      const isTriggered = mod.injection_trigger.some(trigger => checkTrigger(trigger, recentHistoryText));
      if (!isTriggered) return;
    }

    // Giao thức Tawa: In-chat history injection (position === 2)
    if (mod.injection_position === 2) {
      const resolvedContent = ContextCompressor.cleanText(replaceVariables(segmentContent));
      if (resolvedContent.trim().length > 0) {
        inChatSegments.push({
          content: resolvedContent,
          role: mod.role,
          depth: mod.injection_depth || 0,
          order: mod.injection_order || 100,
          identifier: mod.identifier,
        });
      }
      return; // Skip system-level segments
    }

    const segmentRole = mod.role;
    const priority =
      mod.injection_position === 1
        ? POSITION_PRIORITY["bottom"] + (mod.injection_depth || 0)
        : POSITION_PRIORITY["system"] + (mod.injection_depth || 0);

    const segment = {
      priority: priority,
      order: mod.injection_order || 0,
      content: segmentContent,
      source: `Module:${mod.identifier}`,
    };

    if (segmentRole === "assistant" || segmentRole === "model") {
      assistantSegments.push(segment);
    } else if (segmentRole === "user") {
      userSegments.push(segment);
    } else {
      segments.push(segment);
    }
  });

  // SillyTavern style: assistant_prefill field injected as the absolute last model turn / prefill
  if (presetConfig.assistant_prefill && presetConfig.assistant_prefill.trim().length > 0) {
    assistantSegments.push({
      priority: 999999, // Absolute last priority
      order: 999999, // Absolute last order
      content: presetConfig.assistant_prefill,
      source: "ST_AssistantPrefill",
    });
  }

  // --- BƯỚC 3: XỬ LÝ SEGMENTS CỐ ĐỊNH (SYSTEM OVERRIDES) ---

  if (playerProfile) {
    segments.push({
      priority: POSITION_PRIORITY["system"],
      order: 1,
      content: `
<ROLEPLAY_INSTRUCTION>
User is roleplaying the main character named "${playerProfile.name}".
- When referring to "${playerProfile.name}", it is the User.
- All thoughts and actions of "${playerProfile.name}" are controlled by the User or guided by the AI from the User's perspective.
- Absolutely DO NOT create a separate "User" character.
- Narrative perspective: 3rd person (following "${playerProfile.name}") or 2nd person (You - if config requires).
</ROLEPLAY_INSTRUCTION>`,
      source: "RoleplayInstruction",
    });
  }

  // BIÊN GIỚI THỂ LOẠI & BẮT BUỘC NHẤT QUÁN BỐI CẢNH (CRITICAL ANTI-GENRE DRIFT)
  segments.push({
    priority: POSITION_PRIORITY["system"],
    order: 3,
    content: `
<GENRE_AND_SETTING_GROUNDING>
⚠️ BIÊN GIỚI THỂ LOẠI & CHỐNG HƯ CẤU LỆCH TÔNG (ANTI-GENRE DRIFT & COHERENCE LAWS):
- Thể loại thế giới: "${(worldSettings as any)?.genre || "Đồng nhân / Sandbox"}"
- Tên tác phẩm IP / Bối cảnh: "${(worldSettings as any)?.worldName || "Chưa rõ"}"

QUY TẮC PHÁT TRIỂN TRUYỆN VÀ VẬT PHẨM (MANDATORY):
1. **Không tự ý cho nhặt vật phẩm Tiên Hiệp**: Tuyệt đối KHÔNG ĐƯỢC CHẾ thêm các vật phẩm, kỹ năng, đan dược hoặc cơ chế hoạt động thuộc thể loại Tiên Hiệp, Tu Chân, Huyền Huyễn (như: pháp bảo, linh bảo, đan dược, tiên dược, phi kiếm, ngự kiếm phi thăng, kinh căn, tẩy tủy, bách khoa tu đạo, linh đơn, v.v.) vào bất kỳ thế giới nào không phải thế giới Tu Tiên đích thực. 
   - Ví dụ: Nếu người chơi đang ở thế giới modern, học đường, phép thuật phương tây (Hogwarts), urban fantasy, đô thị thuần túy hoặc nhẫn giả (Naruto)... cấm tuyệt đối xuất hiện thuật ngữ tu tiên hay vật phẩm tiên hiệp. Ma pháp ra ma pháp, võ đạo ra võ đạo, ninja ra ninja, đời thường ra đời thường.
2. **Không tự sáng chế tình tiết xa rời cốt truyện (Anti-Wild Hallucination)**: 
   - Khi viết tiếp nội dung hoặc đề xuất lựa chọn hành động (<branches>), bạn PHẢI bám sát tình huống thực tế của lượt chat trước và thông tin bối cảnh cốt truyện gốc. Không được biến tấu vô lý thêm thắt các sự kiện "khủng bố cứu thế", "cheat ẩn", hay các "hệ thống" kỳ quặc nằm ngoài thiết lập ban đầu.
   - Giữ cho thế giới hoạt động trong sự nghiêm ngặt logic của nguyên tác (nếu đây là Đồng nhân).
3. **Kỷ luật lexicon (từ vựng) Chặt chẽ**: Chỉ sử dụng các thuật ngữ, lối đối thoại, cách xưng xô, cách mô tả phù hợp với IP thế giới gốc. OOC (Out Of Character) và lạc tông bối cảnh là hoàn toàn cấm kỵ.
</GENRE_AND_SETTING_GROUNDING>`,
    source: "GenreAndSettingGrounding",
  });

  // KỶ LUẬT VẠN LÝ THẾ GIỚI & BỘ LỌC LOGIC TRI THỨC (STRICT WORLD LOGIC & KNOWLEDGE PATHS LAWS)
  segments.push({
    priority: POSITION_PRIORITY["system"],
    order: 3.5,
    content: `
<KNOWLEDGE_LOGIC_INTEGRITY_LAWS>
🔥 KỶ LUẬT VẠN LÝ THẾ GIỚI & BỘ LỌC LOGIC TRI THỨC (STRICT WORLD LOGIC & PHYSICAL LAWS - MANDATORY):
Bạn PHẢI tôn trọng tuyệt đối các quy luật thế giới, hệ thống sức mạnh, tài nguyên hiện trạng và ràng buộc logic cốt lõi được thiết lập trong Tri Thức Tập Giả (RAG, LSR, Lorebook, StoryBible, và bối cảnh nguyên tác):

1. **Khấu trừ Tài Nguyên & Ràng Buộc Tiền Đề (Resource & Requirement Checks)**:
   - Nếu một kỹ năng, ma pháp, võ công, hoặc chiêu thức yêu cầu một loại tài nguyên, trạng thái hoặc tiền đề cụ thể (Ví dụ: Linh khí, Ma lực, Mana, Đan dược cụ thể, Vũ khí tương thích, Khoảng cách giới hạn...) để thi triển: Bạn PHẢI đối chiếu nghiêm khắc với trạng thái thực tế của nhân vật trong LSR (ví dụ: linh khí = 0, cạn kiệt ma lực, vũ khí bị gãy, khí độc bao phủ).
   - Tuyệt đối nghiêm cấm việc nhân vật \"cạn linh khí/hết mana\" nhưng vẫn thản nhiên thi triển kỹ năng thành công bừa bãi hoặc có cheat ảo vượt qua quy luật mà không phải trả giá cực đắt.

2. **Kịch Tính Hóa Sự Cản Trở / Thất Bại (Enforce Logical Obstacles/Failure)**:
   - Thay vì phớt lờ giới hạn đề bài để viết suôn sẻ như AI thông thường, bạn PHẢI bám sát các giới hạn này và biến sự thiếu hụt, suy kiệt thành nút thắt nội tâm hoặc hành động kịch tính:
     * Ví dụ (Cạn linh khí): \"Arthur nghiến chặt răng gồng sức vận chuyển 『Xích Diễm Kiếm』, nhưng đan điền trống rỗng khô khốc lập tức dấy lên một cơn đau xé rách kinh mạch {RẮC!}. Luồng lửa ma pháp vừa chớm bùng lên đầu kiếm đã lịm tắt, để lại làn khói xám bốc lên cùng sự bàng hoàng lộ rõ trên gương mặt...\";
     * Ví dụ (Vùng cấm ma pháp): \"Các cổ tự ma pháp lập tức vỡ nát dưới áp lực cấm chế của vùng đất tuyệt lực. Chỉ một làn gió thổi qua cũng đủ cuốn phai tàn tich của ma thuật vô dụng dồn ép Arthur rơi vào tình thế bế tắc kinh hoàng...\".
   - Luôn cho phép các nhân vật gánh chịu hậu quả sòng phẳng, thất bại logic trước các giới hạn của thế giới nguyên tác.

3. **Cơ Chế Phản Phệ & Độc Hại của Thế Giới Thực Tại (Backlash & Power Suppression Laws)**:
   - Cố gắng gượng ép vượt cấp, cố xuất chiêu khi cạn kiệt tài nguyên, hoặc thách thức luật cấm hệ thống PHẢI dẫn đến hậu quả nghiêm trọng: phản phệ đứt gãy kinh mạch, ngất xỉu, hỏng trang bị, sụt giảm chí mệnh các chỉ số lực chiến hoặc rơi vào trạng thái nguy cơ tử vong.

4. **KỶ LUẬT SUY NGHĨ TRONG <thinking> (SILENT LOGIC AUDIT)**:
   - Ở đầu block <thinking> của turn chat này, bạn PHẢI thực hiện rà soát riêng theo cấu trúc:
     \`\`\`
     [KNOWLEDGE LOGIC AUDIT]
     - Giới hạn từ Tri thức gốc / LSR / Lorebook đang áp dụng: ...
     - Ý định hành động của người chơi / NPC: ...
     - Sự tương thích logic (Đạt yêu cầu tài nguyên/bối cảnh không?): ...
     - Kế hoạch biến chuyển (Nếu thiếu hụt/bị cấm, sẽ viết diễn biến Thất bại/Kháng cự bế tắc/Hậu quả như thế nào?): ...
     \`\`\`
</KNOWLEDGE_LOGIC_INTEGRITY_LAWS>`,
    source: "KnowledgeLogicIntegrityLaws",
  });

  // CHỈ THỊ CHẤT LƯỢNG VĂN BẢN VÀ THẨM MỸ VĂN HỌC BẮT BUỘC (LITERARY PROSE ELEVATION LAWS)
  segments.push({
    priority: POSITION_PRIORITY["system"],
    order: 4, // Sau sự nhất quán bối cảnh, trước quy tắc định dạng kỹ thuật khác
    content: `
<LITERARY_PROSE_ELEVATION_LAWS>
🔥 CHỈ THỊ NÂNG CAO VĂN PHONG & CHẤT LƯỢNG VĂN HỌC (MANDATORY):
Để đáp ứng kỳ vọng văn phong tinh tế, sâu sắc và đậm chất nghệ thuật, bạn PHẢI tuân thủ các quy tắc sáng tạo sau:

1. **Trực quan hóa tuyệt đối - "Show, Don't Tell"**:
   - TUYỆT ĐỐI KHÔNG trực tiếp tóm tắt cảm xúc nhân vật bằng các tính từ chung chung (như: "Sophia lo lắng", "Arthur cảm thấy ngạc nhiên", "hắn vô cùng giận dữ").
   - THAY VÀO ĐÓ, hãy mô tả các biểu hiện sinh học, cử chỉ vi tế và ngôn ngữ cơ thể: những cái nhíu nhẹ chân mày, nhịp tim đập dồn dập sau lớp áo sơ mi, bả vai khẽ run lên, khớp ngón tay siết chặt đến trắng bệch, ánh mắt dao động né khỏi hướng đối diện, hoặc cái thở hắt ra đè nén. Cử chỉ nhỏ kể câu chuyện lớn.

2. **Chế tác văn phong mượt mà chất lượng cao (Exquisite Prose & Cultural Fluency)**:
   - Sử dụng ngôn từ giàu sức gợi, mượt mà bám sát phong cách dịch văn học và Light Novel Nhật Bản cao cấp bậc nhất (nhẹ nhàng, ấm áp, đôi lúc bay bổng dịu dàng, châm biếm sắc sảo đầy ẩn ý nhưng sâu sắc).
   - KHÔNG sử dụng văn nói thời thượng thô ráp, ngôn ngữ mạng hiện đại hay giọng văn dịch máy thô cứng.
   - **Kỷ luật cấu trúc câu**: Tránh lặp lại cấu trúc ngữ pháp gần nhau. Không khởi đầu các câu văn liên tiếp bằng đại từ xưng hô ("Hắn...", "Cô...", "Yuki..."). Sử dụng chủ ngữ ẩn hoặc đảo ngữ linh hoạt để câu văn uyển chuyển.

3. **Bồi đắp bối cảnh đa giác quan (Sensory Realism & Atmospheric Depth)**:
   - Trong mỗi cảnh quay, hãy chạm đến ít nhất 3 giác quan: không chỉ phần nhìn (thị giác) mà còn là tiếng rè rè của dàn điều hòa, hương thơm thoang thoảng của trà nhài lạnh, tiếng giọt mưa đập lách tách ngoài bậu cửa, luồng gió lạnh thọc qua kẽ áo, hay ánh sáng mập mờ từ chao đèn cũ hắt những bóng dài tịch mịch trên sàn gỗ.
   - Hãy để môi trường phản chiếu hoặc tương tác với tâm trạng của nhân vật (thẩm mỹ cảnh vật đồng điệu).

4. **Hội thoại giàu ẩn ý và hành bi đi kèm (Subtextual Dialogues with Beats)**:
   - Nhân vật KHÔNG được tự nói ra toàn bộ suy nghĩ hay động cơ một cách thẳng đuột. Hãy đưa ẩn ý (subtext), sự ngập ngừng, lảng tránh vào lời nói.
   - Xen kẽ giữa các câu thoại là "beats" (nhịp hành động vi tế) của nhân vật: họ mân mê chiếc bút, nhấp một ngụm trà để giấu đi sự bối rối, hay liếc nhìn đồng hồ treo tường.
   - Nhất quán xưng hô và khẩu khí độc bản cho từng NPC theo đúng hồ sơ gốc của họ.

5. **Làm chủ nhịp độ truyện dồn dập hay lắng dọng (Dynamic Prose Pacing)**:
   - Với cảnh hành động, căng thẳng: Sử dụng câu ngắn, gọn, dứt khoát, nhịp nhanh, đẩy cao kịch tính.
   - Với cảnh đời thường (slice of life), tâm lý, lãng mạn hoặc hoài niệm: Kéo dài câu chữ với các biện pháp ẩn dụ kỳ lạ đầy sáng tạo, miêu tả sâu dòng suy nghĩ nội tâm phong phú, nhịp điệu êm ả, chậm rãi lắng đọng.
</LITERARY_PROSE_ELEVATION_LAWS>`,
    source: "LiteraryProseElevation",
  });

  // 0. Minimalist NPC Registry
  if (minimalistSection) {
    segments.push({
      priority: POSITION_PRIORITY["system"],
      order: 2, // Right after roleplay instruction
      content: minimalistSection,
      source: "MinimalistRegistry",
    });
  }

  segments.push({
    priority: POSITION_PRIORITY["system"],
    order: 5,
    content: `
<CRITICAL_CHOICE_FORMATTING>
⚠️ ACTION CHOICES (<branches>) MUST ADHERE TO THESE RULES:
1. **NO DIALOGUE**: Absolutely FORBIDDEN to put dialogue (e.g., [Name]: "...") inside <branches>.
2. **NO NARRATIVE**: Absolutely FORBIDDEN to put story descriptions, emotional states, or narrative text inside <branches>.
3. **FORMAT**: Each choice MUST be a concise but detailed compound action, e.g., "[15] Explore the dark corridor and search for hidden levers".
4. **COMPOUND ACTIONS (MANDATORY)**: Every choice MUST contain at least 2 distinct actions linked together. Avoid single, simple actions.
5. **PURITY**: If you have more story to tell, put it in <content> BEFORE closing it. <branches> is ONLY for the final menu of choices.
6. **FIRST CHOICE CHECK**: Ensure the very first line after <branches> is a valid action. Do not start with a sigh, a thought, or a description.
</CRITICAL_CHOICE_FORMATTING>`,
    source: "CharacterVitality",
  });

  // 1. RAG Memories (Task 3.3)
  // Inject relevant memories from Vector Search
  if (
    contextItems.relevantMemories &&
    relevantMemories &&
    relevantMemories.trim().length > 0
  ) {
    segments.push({
      priority: POSITION_PRIORITY["persona"],
      order: 98,
      content: ContextCompressor.cleanText(`
<RELEVANT_PAST_CONTEXT>
(The system has retrieved relevant conversation memories from the past)
${relevantMemories}
</RELEVANT_PAST_CONTEXT>`),
      source: "Memories",
    });
  }

  // 1.2 StoryBible facts (RAG)
  if (
    contextItems.storyBible &&
    Array.isArray(storyBibleEntries) &&
    storyBibleEntries.length > 0
  ) {
    storyBibleEntries.forEach((entry) => {
      let displayContent = entry.content;
      if (entry.category === 'character') {
         try {
             const cData = JSON.parse(entry.content);
             const detailsList = [
                 cData.name ? `Name: ${cData.name}` : "",
                 cData.gender || cData.age ? `Gender: ${cData.gender || '?'} | Age: ${cData.age || '?'}` : "",
                 cData.appearance ? `Ngoại hình: ${cData.appearance}` : "",
                 cData.voiceAndTone ? `Giọng nói/Văn phong: ${cData.voiceAndTone}` : "",
                 cData.coreValues ? `Giá trị cốt lõi: ${cData.coreValues}` : "",
                 cData.hardLimits ? `Hard Limits: ${cData.hardLimits}` : "",
                 cData.definingEvents ? `Quá khứ quan trọng: ${cData.definingEvents}` : "",
                 cData.currentMood ? `Tâm trạng hiện tại: ${cData.currentMood}` : "",
                 cData.relationshipTags ? `Quan hệ: ${cData.relationshipTags}` : "",
                 cData.strengths ? `Điểm mạnh: ${cData.strengths}` : "",
                 cData.weaknesses ? `Điểm yếu/Giới hạn: ${cData.weaknesses}` : "",
                 cData.narrativeRole ? `Vai trò: ${cData.narrativeRole}` : "",
                 cData.contradictions ? `Mâu thuẫn: ${cData.contradictions}` : "",
                 cData.failureMode ? `Phản ứng thất bại: ${cData.failureMode}` : "",
                 cData.personality ? `Tính cách: ${cData.personality}` : "",
                 cData.background ? `Tiểu sử: ${cData.background}` : "",
                 cData.exampleMessages ? `Câu thoại ví dụ:\n${cData.exampleMessages}` : ""
             ];

             if (cData.customFields && Array.isArray(cData.customFields)) {
                 cData.customFields.forEach((cf: any) => {
                     if (cf.label && cf.value) {
                         detailsList.push(`${cf.label}: ${cf.value}`);
                     }
                 });
             }

             const details = detailsList.filter(Boolean).join(' | ');
             if (details) {
                 displayContent = "Character Profile -> " + details;
             }
         } catch {
             // Fallback to raw string
         }
      }

      const content = ContextCompressor.cleanText(
        `- [${entry.title?.toUpperCase()}]: ${displayContent}`,
      );
      let order = 50;
      let priority = POSITION_PRIORITY["bottom"];

      if (entry.position === "system_top") priority = POSITION_PRIORITY["top"];
      if (entry.position === "system_after_char")
        priority = POSITION_PRIORITY["lore"];
      if (entry.position === "before_history") {
        priority = POSITION_PRIORITY["history_top"];
        order = 99;
      }

      segments.push({
        priority,
        order,
        content,
        source: `StoryBible:${entry.title}`,
      });
    });
  }

  // 1.3 Trained Knowledge vectors (RAG)
  if (
    Array.isArray(trainedKnowledgeEntries) &&
    trainedKnowledgeEntries.length > 0
  ) {
    const knowledgeBlocks = trainedKnowledgeEntries
      .map((entry, idx) => `[Phân đoạn tri thức #${idx + 1}]: ${entry.text}`)
      .join("\n\n");

    segments.push({
      priority: POSITION_PRIORITY["lore"],
      order: 40,
      content: ContextCompressor.cleanText(`
<TRAINED_KNOWLEDGE_CONTEXT>
(The following verified background lore from the trained story wiki/book has been retrieved as highly relevant to the current scene. Keep your response 100% faithful to these facts to avoid OOC errors)
${knowledgeBlocks}
</TRAINED_KNOWLEDGE_CONTEXT>`),
      source: "TrainedKnowledge",
    });
  }

  // 1.5. Summary Memory (Long Term)
  if (contextItems.longTermMemory && summary && summary.trim().length > 0) {
    segments.push({
      priority: POSITION_PRIORITY["persona"],
      order: 50, // Before RAG, after World Info
      content: `
<LONG_TERM_MEMORY_SUMMARY>
(This is a summary of all important events that have occurred from the beginning of the story until before the current turn. This is your ONLY long-term memory source of the distant past, as direct conversation history has been shortened to save memory)
${summary}
</LONG_TERM_MEMORY_SUMMARY>

<FANFIC_MODE_INSTRUCTION>
⚠️ FANFIC MODE:
- This story is based on the original work summarized above.
- MISSION: Write developments that adhere to the logic, style, and settings of the original work.
- CHARACTERS: Keep characters true to their personality (OOC is taboo), way of addressing, and abilities.
- WORLD: Do not change the basic rules of the original world unless the player specifically requests.
</FANFIC_MODE_INSTRUCTION>`,
      source: "SummaryMemory",
    });
  }

  // HYBRID AGENT: Background Insights Injection
  if (backgroundInsights && backgroundInsights.trim().length > 0) {
    segments.push({
      priority: POSITION_PRIORITY["system"],
      order: 8, // Very high priority in system block
      content: `
<TACTICAL_CONTEXT_ANALYSIS>
(PHÂN TÍCH TỪ BACKGROUND AGENT - QUAN TRỌNG)
Dưới đây là tóm tắt bối cảnh và ý định của người chơi từ lịch sử gần nhất. Hãy sử dụng thông tin này để hiểu rành mạch ngữ cảnh trước khi viết tiếp:
${backgroundInsights}
</TACTICAL_CONTEXT_ANALYSIS>`,
      source: "HybridBackgroundAgent",
    });
  }

  // 2. Difficulty & Perspective
  const difficultyPrompt = `=== THIẾT LẬP ĐỘ KHÓ (${activeDifficulty.label}) ===\n${activeDifficulty.prompt}\nĐộ khó thực tại (Reality Difficulty): ${activeRealityDifficulty}`;
  segments.push({
    priority: POSITION_PRIORITY["system"],
    order: 5,
    content: difficultyPrompt,
    source: "Difficulty",
  });

  const perspectivePrompt = `=== GÓC NHÌN KỂ CHUYỆN (BẮT BUỘC) ===\n${getPerspectivePrompt(activePerspective, playerProfile.name)}`;
  segments.push({
    priority: POSITION_PRIORITY["system"],
    order: 6,
    content: perspectivePrompt,
    source: "Perspective",
  });

  // 3. Mandatory Rules (UPGRADED TO ULTIMATE AUTHORITY WITH CONDITIONAL TRIGGERS)
  const rulesToEvaluate = gameConfig.rules.filter((r: string) => r && !r.startsWith("[VÔ HIỆU HÓA]") && !r.startsWith("//"));
  
  const criticalRules: string[] = [];
  const normalRules: string[] = [];
  const softRules: string[] = [];

  for (const rule of rulesToEvaluate) {
    let evaluatedRule = rule;
    const condMatch = evaluatedRule.match(/^\[(?:ĐIỀU KIỆN|KÍCH HOẠT KHI|COND|CONDITION|TRIGGER):\s*([^\]]+)\]/i);
    let isMet = true;
    if (condMatch) {
      const conditionStr = condMatch[1];
      isMet = evaluateRuleCondition(conditionStr, turnCount, gameTime, lastUserMessage, tavoChatVars);
      if (isMet) {
        // Strip the condition prefix for cleaner display inside prompt
        evaluatedRule = evaluatedRule.substring(condMatch[0].length).trim();
      }
    }
    
    if (isMet) {
      if (/^\[(?:CRITICAL|KHẨN CẤP|NÀY QUAN TRỌNG|QUAN TRỌNG|ABSOLUTE|INVIOLABLE)\]/i.test(evaluatedRule)) {
        const clean = evaluatedRule.replace(/^\[(?:CRITICAL|KHẨN CẤP|NÀY QUAN TRỌNG|QUAN TRỌNG|ABSOLUTE|INVIOLABLE)\]/i, "").trim();
        criticalRules.push(clean);
      } else if (/^\[(?:SOFT|ƯU TIÊN THẤP|YẾU|KHÔNG BẮT BUỘC|RECOMMENDED|SUGGESTED)\]/i.test(evaluatedRule)) {
        const clean = evaluatedRule.replace(/^\[(?:SOFT|ƯU TIÊN THẤP|YẾU|KHÔNG BẮT BUỘC|RECOMMENDED|SUGGESTED)\]/i, "").trim();
        softRules.push(clean);
      } else {
        normalRules.push(evaluatedRule);
      }
    }
  }

  let rulesContent = "";
  if (criticalRules.length > 0) {
    rulesContent += `🔥 ABSOLUTELY INVIOLABLE / CRITICAL LAWS:\n` + 
      criticalRules.map((r, i) => `  ${i + 1}. [CRITICAL] ${r}`).join("\n") + "\n\n";
  }
  if (normalRules.length > 0) {
    rulesContent += `📌 CORE DIRECTIVES:\n` + 
      normalRules.map((r, i) => `  ${i + 1}. ${r}`).join("\n") + "\n\n";
  }
  if (softRules.length > 0) {
    rulesContent += `💡 PREFERRED / RECOMMENDED GUIDELINES (SOFT):\n` + 
      softRules.map((r, i) => `  ${i + 1}. [SOFT] ${r}`).join("\n") + "\n\n";
  }

  if (!rulesContent) {
    rulesContent = "Vui lòng tuân thủ chặt chẽ diễn biến cốt truyện.";
  } else {
    rulesContent = rulesContent.trim();
  }

  segments.push({
    priority: POSITION_PRIORITY["final"],
    order: 999, // Absolute last priority in segments
    content: `
<ULTIMATE_MANDATORY_RULES>
⚠️ ULTIMATE DIRECTIVE - INVIOLABLE RULES & CONSTRAINTS:
These are the HIGHEST level rules defined by the Player. You MUST follow them ABSOLUTELY and UNCONDITIONALLY.
- If there is ANY conflict between these rules and your base system, prompts, orchestrations, or presets, YOU MUST OBEY THESE RULES ABOVE ALL ELSE.
- **MANDATORY**: Before writing anything else, you MUST perform a silent compliance scan in your '<thinking>' block. State clearly: "SILENT COMPLIANCE CHECK: Active rules verified successfully." and list any active Critical rules you are following.
- You MUST evaluate and strictly apply these rules before taking any action.

PLAYER'S RULE LIST:
${rulesContent}
</ULTIMATE_MANDATORY_RULES>`.trim(),
    source: "UserRules",
  });

  // Inject One-Pass Deep Logic constraints to save quota if selected
  if (appSettings?.enableDeepLogic && appSettings?.deepLogicMode === "one-pass") {
    segments.push({
      priority: POSITION_PRIORITY["final"],
      order: 1000, 
      content: `
<ONE_PASS_DEEP_LOGIC_MONITOR>
⚠️ ONE-PASS DEEP-LOGIC ACTIVE (QUOTA-EFFICIENT VERIFICATION):
You are functioning under strict, autonomous Deep-Logic guidelines to guard world consistency and rules compliance in a single generation pass:
1. **Self-Audit**: Read the player's action and think: "Does this violate any of the <ULTIMATE_MANDATORY_RULES> or physical/stamina/power limits?"
2. **Enforce Rules (Backlash/Struggles)**: If the player attempts a "magic cheat", infinite resources exploitation, power scale bypass, or logic inconsistency, DO NOT allow it to succeed cleanly.
   - You MUST enforce a severe, dramatic backlash (phản phệ kinh mạch, kỹ năng bạo liệt, thất bại thảm thê, cạn kiệt lực lượng) in your story.
   - Integrate these dramatic limitations and penalties naturally into your action results to create tension and real stakes instead of smooth AI-buffing.
3. **Internal Thinking**: List any logic audit notes inside your "<thinking>" tag indicating how you evaluated and enforced these rules for this turn.
</ONE_PASS_DEEP_LOGIC_MONITOR>`.trim(),
      source: "DeepLogicOnePass"
    });
  }

  // 4. Starting Scenario Injection (Task Update)
  if (turnCount === 0) {
    const scenarioText =
      worldSettings.startingScenario ||
      "Hãy bắt đầu câu chuyện một cách tự nhiên dựa trên bối cảnh thế giới và nhân vật.";
    segments.push({
      priority: POSITION_PRIORITY["system"],
      order: 8, // Very high priority in system block
      content: `
<STARTING_SCENARIO_OVERRIDE>
⚠️ IMPORTANT: This is the BEGINNING of the story.
STARTING ACTION/SITUATION: "${scenarioText}"
DIRECTIVE:
- Start immediately from this situation. Do not write a generic introduction.
- Describe in detail the actions, feelings, and immediate surroundings of the main character "${playerProfile.name}".
- Establish the tone, atmosphere, and current stakes.
- INITIALIZE LSR: You don't need to manually output any table tag, but your story content should naturally describe the starting location, time, and immediate context so that the automated state auditor can initialize the LSR database for you.
- TIME SETTING: Use the <set_time> tag to establish the exact starting time if it's currently the default (Jan 01, 2024).
</STARTING_SCENARIO_OVERRIDE>`,
      source: "StartingScenario",
    });
  }

  // 4.2 Lsr Table Data Injection (World State)
  if (tableData && tableData.trim().length > 0) {
    segments.push({
      priority: POSITION_PRIORITY["system"],
      order: 9, // Right before tech rules
      content: `
<CURRENT_WORLD_STATE_LSR>
(BẢNG TRẠNG THÁI THẾ GIỚI HIỆN TẠI - LSR DATA)
Dữ liệu bên dưới là trạng thái hiện tại của thế giới để giúp bạn nắm bắt bối cảnh, túi đồ, chỉ số lực chiến và quan hệ nhân vật một cách nhất quán nhất.
LƯU Ý QUAN TRỌNG: Bạn KHÔNG CẦN PHẢI in các thẻ <tableEdit> hay <table_stored> thủ công nữa. Hệ thống quản trị của chúng tôi sẽ phân tích truyện bạn viết để tự động cập nhật cơ sở dữ liệu LSR thông qua Function Calling (Structured Outputs) chạy ngầm!

${tableData}
</CURRENT_WORLD_STATE_LSR>`,
      source: "LsrWorldState",
    });
  }

  // 4.5 Technical Formatting Rules
  segments.push({
    priority: POSITION_PRIORITY["final"],
    order: 10,
    content: `
<TECHNICAL_FORMATTING_RULES>
You MUST adhere to the following technical formatting rules for the content log:
0. QUY TẮC PHÁP LÝ XML (MANDATORY INNER THOUGHT LAW):
   Trước khi viết bất kỳ nội dung phân tích hay suy nghĩ nào, bạn BẮT BUỘC phải khai báo ngay lập tức cả hai thẻ là <thinking></thinking>. Sau đó, chỉ được viết nội dung suy nghĩ vào giữa hai thẻ này. Tuyệt đối KHÔNG viết nội dung suy nghĩ trước rồi mới tìm thẻ đóng sau (Tag-First Writing Strategy).
   
0.1. XÍCH THỨ TỰ PHẢN HỒI (MANDATORY RESPONSE SEQUENCE LOCK):
   Mọi phản hồi của bạn bắt buộc phải tuân theo cấu trúc tuần tự 100% không đổi:
   - Mở đầu bằng thẻ suy nghĩ <thinking> -> viết phân tích, compliance scan và logic check thầm kín -> Đóng bằng thẻ </thinking>.
   - Tiếp theo luôn luôn tiếp nối bằng thẻ nội dung truyện <content> -> kể truyện và diễn biến văn học sống động -> Đóng bằng thẻ </content>.
   - Tiếp tục kết nối bằng các thẻ bổ trợ khác như <incrementalSummary>...</incrementalSummary>, <time_cost>...</time_cost> nếu có.
   - Kết thúc hoàn toàn bằng thẻ lựa chọn <branches> -> các định dạng lựa chọn -> Đóng bằng thẻ </branches>.
   Nếu bạn thiếu bất kỳ thẻ đóng nào (đặc biệt là </thinking> và </content>), hệ thống biên dịch của chúng tôi sẽ crash và lượt chơi bị hủy bỏ lập tức.

1. **Markdown**: Use Markdown to enhance aesthetics (e.g., **bold** for emphasized words, *italic* for inner thoughts).
2. **No Repetition**: Absolutely DO NOT repeat the player's action at the beginning of the response. Start with the reaction or result of that action.
3. **Paragraph Structure**: Divide content into short paragraphs (3-5 sentences each). Use 2 line breaks between paragraphs to create readable space. Absolutely DO NOT write a long continuous block of text without breaks.
4. **Dialogue & Thought Formatting (CRITICAL)**: 
   - When writing dialogue for ANY character (including the MC), you MUST always use the format: [Character Name]: 「[Dialogue]」 or [Character Name] nói: 「[Dialogue]」.
   - For internal thoughts of any character, use the format: [Character Name] nghĩ: ﹁[Thought]﹂.
   - **MANDATORY**: Each dialogue or thought block MUST be on its own line. Absolutely DO NOT mix narrative text and dialogue/thought on the same line.
   - **MANDATORY**: Use exactly 2 line breaks before and after every dialogue block to ensure clear separation from narrative paragraphs.
   - Example 1: 
     Arthur: 「Chào bạn.」
     
     Sophia nói: 「Bạn là ai?」
   - Example 2 (Thoughts):
     Sophia nghĩ: ﹁Chẳng lẽ anh ta là đồng đội?﹂
   - For the Main Character (MC), use their name: ${playerProfile.name}: 「...」.
   - Absolutely DO NOT write dialogue/thoughts without a preceding character name. This is to ensure the UI can correctly identify the speaker.
   - If the dialogue is from an unknown source or a generic narrator voice, use Người dẫn chuyện: 「...」 or Giọng nói lạ: 「...」.
4.1. **Highlight & Formatting (CRITICAL)**:
   - When mentioning important items, skills, or key elements, you MUST wrap them in 『...』 brackets. Example: nhận được 『Thánh Kiếm』.
   - For sound effects or onomatopoeia, you MUST wrap them in {...} brackets. Example: tiếng nổ lớn {BÙM!}.
5. **Dialogue Expansion (MC/PC)**: You ARE ALLOWED and ENCOURAGED to write dialogue for all characters, including the main character <user>. When the player provides an action containing dialogue, rewrite that dialogue in a detailed, polished, and content-rich way in the log. You can create additional dialogue for the MC if deemed necessary for the plot flow. However, absolutely FORBIDDEN to unilaterally decide actions or change the will/choices of the player.
6. **Response Structure (MANDATORY)**:
   - Wrap the entire story development in <content></content> tags.
   - The <content> tag MUST contain the entire narrative/story response for the current turn.
   - The <table_stored> or <tableEdit> tag MUST be AFTER the </content> tag and BEFORE the <branches> tag.
   - The <time_cost> and <set_time> tags MUST be after the </content> tag, before the <branches> tag.
   - The <branches> tag MUST be the final content of the entire response and MUST ONLY contain action choices.
   - **CRITICAL**: NEVER put story narrative, descriptions, dialogue, or LSR DATA (like #0 Thông tin Hiện tại|0:...) inside the <branches> tag.
   - If you have more story to tell, put it in the <content> tag before the <branches> tag.
   - Format of <branches>:
     <branches>
     [Action 1]
     [Action 2]
     [Action 3]
     </branches>
7. **No Leakage (CRITICAL)**: 
   - Absolutely DO NOT explain system tags.
   - **MANDATORY**: Do NOT leak any English instructions, reinforcement prompts, or system keywords into the final response to the player. These steps MUST be processed internally in "thinking" and NEVER appear in the final response.
   - All progress check notes, word count goals, rule validations, and segments (from word_count module) MUST be placed inside <thinking> tags and ABSOLUTELY MUST NOT appear outside these tags or in <content> tags.
    - **MANDATORY THINKING STEP**: At the very beginning of your <thinking> block, you MUST silently verify compliance with ALL active rules under <ULTIMATE_MANDATORY_RULES>. You must write inside <thinking>: "SILENT COMPLIANCE CHECK: Active rules verified successfully." and list high-level notes.
   - If you use a "Cognitive Orchestration" or "Core Activation" sequence, it MUST be inside <thinking> tags. Any such text found outside <thinking> is a CRITICAL FAILURE.
     - **LSR Automation**: You DO NOT need to output any <tableEdit> tags or formatted table rows. All changes to the world state are updated automatically by our system based on your narrative.
     - **Timeline & State Grounding**: Ensure your story clearly narrates significant occurrences, loot acquisition, health/status shifts, or timeline events so that our system can update the corresponding tables (like Inventory, World Timeline, etc.) perfectly.
    - **Timeline Tracking**: Describe major milestones or events clearly so that our automated state auditor updates your protagonist or world timeline.


8. **End of Response**: After closing the </branches> tag, you MUST stop the response immediately. Absolutely DO NOT write any additional text, notes, or instructions after this tag.
9. **Cumulative Summary (MANDATORY)**:
   - After each response, you MUST update the cumulative summary (Incremental Summary) of the entire story up to the current moment.
   - This summary must include the most important events so far, plus what just happened in this turn.
   - **Length Requirement**: MUST list from 8 to 15 most important events/details.
   - **Style Requirement**: Use BULLET POINTS format to summarize events clearly, concisely but fully. This is extremely important because the main response can be very long (5,000 - 15,000 words).
   - This summary MUST be placed in <incrementalSummary></incrementalSummary> tags.
   - This tag must be after the </content> tag and before the <branches> tag.
10. **Structural Markers (BẮT BUỘC)**:
    - BẮT ĐẦU thẻ <content> bằng dấu mốc [BẮT ĐẦU PHẦN TRUYỆN] trên một dòng riêng biệt.
    - Sử dụng --- (ba dấu gạch ngang) trên một dòng riêng biệt để phân tách các thay đổi cảnh lớn hoặc bước nhảy thời gian trong <content>.
    - Ở CUỐI CÙNG của thẻ <content>, ngay trước thẻ đóng </content>, bạn PHẢI viết dấu mốc [KẾT THÚC PHẦN TRUYỆN] trên một dòng riêng. Đây là ranh giới cứng để ngăn rò rỉ nội dung vào các thẻ sau đó.
    - TUYỆT ĐỐI KHÔNG đặt các dấu mốc cấu trúc này bên trong thẻ <branches>. Thẻ <branches> CHỈ được chứa các lựa chọn hành động thực sự.
</TECHNICAL_FORMATTING_RULES>`,
    source: "TechnicalRules",
  });

  // 5. Status & Time Instruction
  if (contextItems.timeSystem) {
    const timeString = gameTime ? formatGameTime(gameTime) : "Unknown";
    segments.push({
      priority: POSITION_PRIORITY["bottom"],
      order: -10,
      content: `
=== TIME SYSTEM (IMPORTANT) ===
- Current game time: ${timeString}
- Current turn: ${turnCount}

TIME & ACTION DIRECTIVE:
1. You are the ONLY one who decides the time elapsed for each player action.
2. **NARRATIVE CONSISTENCY**: You MUST ensure the story content (atmosphere, lighting, character activities, environment) strictly matches the "Current game time" provided above. 
   - Pay close attention to the day of the week (e.g., "Thứ Hai", "Chủ Nhật") provided in the "Current game time". If the day of the week is important for the story (e.g., a market day, a religious festival), you MUST respect it.
   - If it's night, describe the darkness, stars, or artificial lights. 
   - If it's morning, describe the sunrise or the world waking up.
   - Adjust the mood and sensory details to fit the specific hour and date.
3. SPECIAL NOTE: If the current time is "January 01, 2024", this is a TEMPORARY (placeholder) timestamp. 
   - In the FIRST response, you MUST choose a suitable starting timestamp based on the world context.
   - Use the <set_time>year|month|day|hour|minute</set_time> tag to set this starting point. Example: <set_time>1250|12|25|06|30</set_time>.
4. For subsequent turns, determine the minutes spent based on the action and return the <time_cost>X</time_cost> tag at the end of the response.
5. BRANCHING RULES (<branches>):
   - You MUST provide at least 3-4 next action choices inside the <branches></branches> tags. You can create more action choices if necessary (up to 6-8) to provide more variety and depth.
   - **CHOICE LOGIC (CRITICAL)**: Create actions based on the events that just occurred.
   - **PLAYER-CENTRIC ONLY**: Every choice MUST be an action that the PLAYER (MC) can take. 
   - **NO NARRATIVE**: Absolutely DO NOT include narrative descriptions of NPC actions, environment changes, or character feelings as choices. (e.g., DO NOT use "The villagers are angry..." as a choice).
   - **ACTION FORMAT (CRITICAL)**: Every choice MUST start with a time cost in brackets followed by a detailed compound action (at least 2 actions per choice).
   - **TIME COST REQUIRED**: Each choice MUST be accompanied by an estimated time: "[minutes] Action A and Action B". (e.g., "[10] Search the room for clues and try to unlock the safe", "[5] Talk to the guard and offer him a bribe"). Choices without [minutes] will be filtered out and NOT shown to the player.
   - **DETAIL & PROGRESSION**: Action content MUST be detailed, creative, and suggestive of a sequence of actions (opening up new possibilities and branching paths).
   - Each choice MUST be accompanied by an estimated time: "[minutes] Action A and Action B".
   - **STRICT SEPARATION**: The <branches> tag is ONLY for action choices. NEVER put story narrative, descriptions, dialogue, or LSR DATA (like #0 Thông tin Hiện tại|0:...) inside the <branches> tag. All story content MUST be in the <content> tag.
   - **IMPORTANT WARNING**: Absolutely DO NOT nest any other system tags (such as <set_time>, <time_cost>, <finish>) inside the <branches> tags.
   - You MUST close the </branches> tag immediately after listing the choices.
   - Standard structure example:
     <content>
     (Story content here...)
     </content>
     <time_cost>15</time_cost>
     <branches>
     [15] Persuade the guard...
     [30] Find a way around the alley...
     </branches>
6. Always end the response by providing all necessary system tags in order: </content> -> <time_cost> -> <set_time> (if needed) -> <branches>.
`,
      source: "GameStatus",
    });
  }

  // INJECT REINFORCEMENT INSTRUCTION HERE (CONTEXT DRIFT FIX)
  if (contextItems.reinforcement) {
    const reinforcement = getReinforcementInstruction(turnCount);
    segments.push({
      priority: POSITION_PRIORITY["final"],
      order: 100,
      content: reinforcement,
      source: "Reinforcement",
    });
  }

  // Module injection handled previously!

  const replaceVariables = (text: string, depth = 0): string => {
    if (depth > 5) return text;

    let processed = text;
    let hasMatch = false;

    // Xử lý comment
    const commentRegex = /\{\{\/\/.*?\}\}/g;
    processed = processed.replace(commentRegex, () => {
      hasMatch = true;
      return "";
    });

    // Xử lý setvar
    const setvarRegex = /\{\{(self)?setvar::(.*?)::([\s\S]*?)\}\}/g;
    processed = processed.replace(setvarRegex, (match, prefix, key, val) => {
      hasMatch = true;
      const cleanKey = key.trim();
      variables[cleanKey] = val;
      return "";
    });
    // Xử lý addvar
    const addvarRegex = /\{\{addvar::(.*?)::([\s\S]*?)\}\}/g;
    processed = processed.replace(addvarRegex, (match, key, val) => {
      hasMatch = true;
      const cleanKey = key.trim();
      variables[cleanKey] = (variables[cleanKey] || "") + val;
      return "";
    });

    // Xử lý global var
    const setGlobalvarRegex = /\{\{setglobalvar::(.*?)::([\s\S]*?)\}\}/g;
    processed = processed.replace(setGlobalvarRegex, (match, key, val) => {
      hasMatch = true;
      const cleanKey = key.trim();
      variables[cleanKey] = val;
      return "";
    });

    // Xử lý random
    const randomRegex = /\{\{(self)?random::(.*?)\}\}/g;
    processed = processed.replace(randomRegex, (match, prefix, args) => {
      hasMatch = true;
      const options = args.split('::');
      const randomIndex = Math.floor(Math.random() * options.length);
      return options[randomIndex];
    });

    // Xử lý macro rác
    const trimRegex = /\{\{trim\}\}/g;
    processed = processed.replace(trimRegex, () => {
      hasMatch = true;
      return "";
    });

    const stRegex = /\{\{([^:]*?)\}\}/g;
    processed = processed.replace(stRegex, (match, key) => {
      if (key.includes("::")) return match;

      const cleanKey = key.trim();
      // Nếu đã định nghĩa var thì trả về, nếu không xóa đi để không có code rác trong system prompt
      if (variables[cleanKey] !== undefined) {
        hasMatch = true;
        return variables[cleanKey];
      }
      return match;
    });

    const tawaRegex = /\{\{(getvar|getglobalvar)::(.*?)\}\}/g;
    processed = processed.replace(tawaRegex, (match, type, key) => {
      hasMatch = true;
      const cleanKey = key.trim();

      const resolvePath = (obj: any, path: string) => {
        return path.split(".").reduce((acc, part) => acc && acc[part], obj);
      };

      if (type === "getglobalvar") {
        const gt = appSettings?.tavoGlobalVars
          ? resolvePath(appSettings.tavoGlobalVars, cleanKey)
          : undefined;
        if (gt !== undefined) return String(gt);
      } else {
        const t = resolvePath(tavoChatVars, cleanKey);
        if (t !== undefined) return String(t);
      }

      return variables[cleanKey] !== undefined ? variables[cleanKey] : "";
    });

    if (hasMatch) {
      return replaceVariables(processed, depth + 1);
    }
    return processed;
  };

  // --- BƯỚC 5: SẮP XẾP & KẾT XUẤT ---

  // Sort and assemble each role's segments
  const processSegments = (segs: PromptSegment[]) => {
    segs.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority; // Lower priority comes first
      }
      return (a.order || 0) - (b.order || 0); // Lower order comes first
    });

    // Resolve variables
    segs.forEach((seg) => {
      seg.content = ContextCompressor.cleanText(replaceVariables(seg.content));
    });

    return segs
      .map((s) => s.content)
      .filter((c) => c.trim().length > 0)
      .join("\n\n");
  };

  const systemPrompt = processSegments(segments);
  const postHistoryUser = processSegments(userSegments);
  const prefillAssistant = processSegments(assistantSegments);
  const rawFewShot = fewShotExamples.length > 0 ? fewShotExamples.join("\n\n") : "";
  const fewShotBlock = rawFewShot ? ContextCompressor.cleanText(replaceVariables(rawFewShot)) : "";

  let finalSystemPrompt = systemPrompt;
  let finalPostHistoryUser = postHistoryUser;
  let finalPrefillAssistant = prefillAssistant;
  let finalFewShotBlock = fewShotBlock;

  if (typeof window !== "undefined" && Array.isArray((window as any).promptMiddleware)) {
    const middlewares = (window as any).promptMiddleware;
    for (const middleware of middlewares) {
      if (typeof middleware === "function") {
        try {
          const result = middleware({
            systemPrompt: finalSystemPrompt,
            postHistoryUser: finalPostHistoryUser,
            prefillAssistant: finalPrefillAssistant,
            fewShotBlock: finalFewShotBlock,
            turnCount,
            tavoChatVars,
            worldSettings,
          });
          if (result && typeof result === "object") {
            if (typeof result.systemPrompt === "string") finalSystemPrompt = result.systemPrompt;
            if (typeof result.postHistoryUser === "string") finalPostHistoryUser = result.postHistoryUser;
            if (typeof result.prefillAssistant === "string") finalPrefillAssistant = result.prefillAssistant;
            if (typeof result.fewShotBlock === "string") finalFewShotBlock = result.fewShotBlock;
          }
        } catch (e) {
          console.error("[Prompt Middleware] Error executing prompt middleware:", e);
        }
      }
    }
  }

  return { 
    systemPrompt: finalSystemPrompt, 
    postHistoryUser: finalPostHistoryUser, 
    prefillAssistant: finalPrefillAssistant, 
    fewShotBlock: finalFewShotBlock,
    inChatSegments
  };
};

export function buildPromptFromHistory(
  preset: any,
  history: any[],
  activeWorld: any,
  gameTime: any,
  promptText: string,
  settings: any
): { prompt: string } {
  // Use buildGameplaySystemPrompt to construct the base system prompt
  const systemPromptData = buildGameplaySystemPrompt(
    activeWorld?.world || {},
    activeWorld?.player || {},
    activeWorld?.entities || [],
    activeWorld?.entities || [],
    "", // relevantMemories
    history ? Math.floor(history.length / 2) : 0,
    preset || {},
    activeWorld?.config || {},
    settings,
    gameTime,
    promptText,
    "", // summary
    "", // tableData
    undefined, // lorebook
    history || []
  );

  let formattedHistory = "";
  if (history && history.length > 0) {
    formattedHistory = history
      .filter((msg) => !msg.isHidden && msg.text)
      .map((msg) => {
        const name = msg.role === "user" ? (activeWorld?.player?.name || "User") : (activeWorld?.entities?.[0]?.name || "Character");
        return `${name}: ${msg.text}`;
      })
      .join("\n\n");
  }

  const prompt = `${systemPromptData}

=== Bối cảnh câu chuyện (Lịch sử hội thoại) ===
${formattedHistory}

=== Hành động / Lời thoại mới nhất ===
${activeWorld?.player?.name || "User"}: ${promptText}
`;

  return { prompt };
}

