import { GameTime } from "./utils/timeUtils";

// --- AI STUDIO API TYPES ---
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export interface RegexScript {
  id: string; // UUID v4
  scriptName: string; // Tên hiển thị
  findRegex: string; // Pattern regex, có thể có flags: /pattern/gi
  replaceString: string; // Chuỗi thay thế
  trimStrings: string[]; // Mỗi phần tử trên 1 dòng
  placement: number[]; // Vị trí áp dụng
  substituteRegex: number; // 0=NONE, 1=RAW, 2=ESCAPED
  markdownOnly: boolean; // Chỉ áp dụng khi render markdown
  promptOnly: boolean; // Chỉ áp dụng khi build prompt
  minDepth: number | null; // 0=last message, null=unlimited
  maxDepth: number | null; // null=unlimited
  disabled: boolean; // Script bị disable
  runOnEdit: boolean; // Chạy khi message được edit
  alterChatDisplay?: boolean;
  alterOutgoingPrompt?: boolean;
  minActivationRegex?: string; // ST compatibility
  forceIframe?: boolean; // Ép buộc bọc kết quả vào iframe widget
  order?: number; // Thứ tự sắp xếp hỗ trợ chạy đồng bộ đúng trình tự
}

export interface SaveFile {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: Record<string, unknown> | string;
  _compressed?: boolean;
}

export interface SafetySetting {
  category: string;
  threshold: string;
}

export type ThinkingBudgetLevel = "auto" | "low" | "medium" | "high" | "custom";
export type ThinkingLevel = "OFF" | "LOW" | "MEDIUM" | "HIGH";

export interface ProxyConfig {
  id: string;
  url: string;
  key: string;
  model: string;
  models: string[];
  isActive: boolean;
  type?: "openai" | "google" | "openrouter" | "custom";
  lastError?: string;
  failCount?: number;
  lastUsed?: number;
  latency?: number;
}

export interface AppSettings {
  _uiMigrated2?: boolean;
  _uiMigrated3?: boolean;
  regex_scripts?: RegexScript[];
  javaScriptMode: "disabled" | "auto" | "script" | "code_block";
  soundVolume: number;
  musicVolume: number;
  theme: "dark" | "light";
  fontSize: number;
  systemFont: string;
  realityDifficulty: string;
  contentBeautify: boolean;
  visualEffects: boolean;
  fullScreenMode: boolean;
  safetySettings?: SafetySetting[];
  aiModel: string;
  backgroundAiModel?: string;
  aiMode?: "single" | "hybrid";
  embeddingModel?: string;
  tavoGlobalVars?: Record<string, any>;
  // Game Configuration (Moved from World Creation)
  perspective: NarrativePerspective;
  difficulty: DifficultyLevel;
  outputLength: OutputLength;
  customMinWords?: number;
  customMaxWords?: number;
  // Advanced AI Params
  contextSize?: number;
  maxOutputTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  thinkingBudgetLevel?: ThinkingBudgetLevel;
  customThinkingBudgetTokens?: number;
  thinkingLevel?: ThinkingLevel;
  thinkingMode?: "budget" | "level";

  // New Settings
  streamResponse: boolean;
  geminiApiKey?: string[];
  enableDeepLogic?: boolean;
  deepLogicMode?: "strict" | "one-pass" | "advisory";

  // Proxy Settings (Legacy - kept for migration)
  proxyUrl?: string;
  proxyKey?: string;
  proxyModel?: string;
  proxyModels?: string[];
  proxyName?: string;
  proxyUrl2?: string;
  proxyKey2?: string;
  proxyModel2?: string;
  proxyModels2?: string[];
  proxyName2?: string;

  // New Proxy System
  proxies: ProxyConfig[];
  activeProxyId?: string; // ID của proxy đang được chọn sử dụng
  useProxyPool?: boolean; // Cho phép luân chuyển gộp bể proxy
  proxyPoolStrategy?: "random" | "round_robin" | "failover"; // Chiến thuật chọn lọc proxy trong bể

  useGeminiApi: boolean;
  proxyEnabled: boolean;
  enableVectorMemory: boolean;
  useLocalEmbedding?: boolean;
  enableSearchGrounding?: boolean;
  enableSotaSearch?: boolean;

  // Story styling
  storyDialogueColor?: string;
  storyThinkingColor?: string;
  storyHighlightColor?: string;
  storyOnomatopoeiaColor?: string;
  layoutZoom?: number;

  // Custom Themes
  customThemes?: CustomTheme[];
  activeCustomThemeId?: string;
  useCustomTheme?: boolean;

  // ElevenLabs TTS Settings
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  elevenLabsVoiceName?: string;
  elevenLabsModelId?: string;
  elevenLabsEnabled?: boolean;
  elevenLabsStability?: number;
  elevenLabsSimilarityBoost?: number;
  elevenLabsAutoPlay?: boolean;

  // Browser TTS Settings
  browserTtsEnabled?: boolean;
  browserTtsVoice?: string;
  browserTtsRate?: number;
  browserTtsPitch?: number;
  browserTtsAutoPlay?: boolean;
}

export interface CustomTheme {
  id: string;
  name: string;
  primaryColor: string; // Nền chính
  secondaryColor: string; // Chữ chính
  accentColor: string; // Màu nhấn
  successColor: string; // Thành công
  warningColor: string; // Cảnh báo
  errorColor: string; // Lỗi
  mutedColor: string; // Mờ
  isDark: boolean;      // Nền tối hay sáng
}

export interface SystemLog {
  id?: number;
  timestamp: number;
  message: string;
  type: "info" | "error" | "warning";
}

export interface NovelDocument {
  id: string;
  name: string;
  type: "txt" | "pdf" | "epub" | "unknown";
  content: string; // The full content text
  timestamp: number;
  metadata?: {
    title?: string;
    author?: string;
    summary?: string;
    characters?: string[];
  };
  processingStatus?: "pending" | "processing" | "completed" | "error";
  processingProgress?: number;
}

export interface NovelDocumentChunk {
  id: string;
  docId: string;
  text: string;
  index: number;
}

export enum GameState {
  MENU = "MENU",
  WORLD_CREATION = "WORLD_CREATION",
  PLAYING = "PLAYING",
  SETTINGS = "SETTINGS",
  FANFIC = "FANFIC",
  KNOWLEDGE_TRAIN = "KNOWLEDGE_TRAIN",
  SCHEMA_DESIGNER = "SCHEMA_DESIGNER"
}

export interface DifficultyLevel {
  id: string;
  label: string;
  prompt: string;
}

export interface OutputLength {
  id: string;
  label: string;
  minWords: number;
  maxWords?: number;
}

// --- NEW WORLD CREATION TYPES ---

export interface CharacterIdentityCore {
  name: string;
  age: string;
  gender: string;
  appearance: string; // Ngoại hình cơ bản
  voiceAndTone: string; // Giọng nói / văn phong (ngắn gọn, thơ, thô lỗ)
  coreValues: string; // 2-3 giá trị cốt lõi KHÔNG thể bẻ gãy
  hardLimits: string; // Hard limits hành vi (vd: không giết trẻ em)
}

// Backstory anchor (Hard)
export interface CharacterBackstoryAnchor {
  definingEvents: string; // 1-2 sự kiện định hình tính cách
}

// Internal State (Soft)
export interface CharacterInternalState {
  currentMood: string; // Trạng thái nội tâm & trigger thay đổi
  relationshipTags: string; // Cách ứng xử với người lạ/đồng minh/kẻ thù
}

// Skills & limits (Soft)
export interface CharacterSkillsLimits {
  strengths: string; // Điểm mạnh
  weaknesses: string; // Điểm yếu / giới hạn thực tế để tránh god-moding
}

// Meta
export interface CharacterMeta {
  narrativeRole: string; // Protagonist / Antagonist / Wildcard / Support
  contradictions: string; // Mâu thuẫn nội tâm hợp lệ (vd: "lạnh lùng nhưng sự thật sợ bỏ rơi")
  failureMode: string; // Phản ứng khi bị dồn vào góc tường, sụp đổ?
}

export interface CharacterSheet extends CharacterIdentityCore, CharacterBackstoryAnchor, CharacterInternalState, CharacterSkillsLimits, CharacterMeta {
  avatar?: string;
  exampleMessages?: string; // Mẫu câu thoại thoại
  knowledge_train?: string; // Nguồn dữ liệu train (Lorebook/Text/Knowledge)
  knowledge_filename?: string;
  knowledge_size?: number;
  birthDay?: number;
  birthMonth?: number;
  birthYear?: number;
  customFields?: { label: string; value: string }[];
  customSchemaId?: string;
}

export type EntityType = "NPC" | "LOCATION" | "FACTION" | "ITEM" | "CUSTOM";

// Entity has custom personality:
export interface Entity extends Partial<CharacterSheet> {
  id: string;
  type: EntityType;
  name: string; // Ensure name is required here
  description: string;
  // Legacy specific fields (keep for fallback)
  personality?: string;
  background?: string;
  rarity?: string; // Only for ITEM
  price?: string; // Only for ITEM
  customType?: string; // Only for CUSTOM
  extensions?: {
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
    [key: string]: any;
  };
}

export interface PlayerProfile extends CharacterSheet {
  // Legacy fields (optional or required for backward compatibility)
  personality: string;
  background: string;
  skills: string;
  goal: string;
  lockedFields?: string[];
}

export interface WorldSettingConfig {
  worldName: string;
  genre: string;
  context: string;
  startingScenario?: string; // New field for custom opening action
  firstMessage?: string; // Bỏ qua AI Mở đầu, dùng cái này thay thế
  // Cấu trúc 3 lớp hiện đại theo tiêu chuẩn Kimi/WorldAnvil
  corePremise?: string;
  cosmology?: string;
  timeline?: string;
  geography?: string;
  factionsPower?: string;
  economyResources?: string;
  culturalIdentity?: string;
  adventureHooks?: string;

  // Remade specific fields
  saveName?: string;
  mainTone?: string;
  setting?: string;
  openingTimeline?: string;
  worldRules?: string;
  pacing?: string;
  history?: string;
  culture?: string;
  economySociety?: string;
  religionBeliefs?: string;
  worldFeatures?: string;
  logicControl?: string;
  writingStyle?: string;
  narratorPov?: string;
}

export type NarrativePerspective = "first" | "second" | "third";

export interface GameConfig {
  difficulty: DifficultyLevel;
  outputLength: OutputLength;
  customMinWords?: number;
  customMaxWords?: number;
  rules: string[];
  perspective: NarrativePerspective; // New field for POV
  contextConfig?: ContextWindowConfig; // New field for Context Window settings
  tawaPreset?: TawaPresetConfig; // New field for Tawa Preset persistence
  tawaPresetId?: string; // ID of the Tawa Preset used
  regexScripts?: RegexScript[]; // Moved from global settings
}

export interface ContextWindowConfig {
  items: {
    playerProfile: boolean;
    worldInfo: boolean;
    longTermMemory: boolean;
    relevantMemories: boolean;
    storyBible?: boolean;
    entities: boolean;
    npcRegistry: boolean;
    timeSystem: boolean;
    reinforcement: boolean;
    graphRag?: boolean;
  };
  maxEntities: number;
  recentHistoryCount: number;
  maxContextTokens?: number;
}

export interface StoredCharacter {
  id: string;                    // crypto.randomUUID()
  name: string;
  avatarUrl?: string;            // base64 PNG thumbnail
  description: string;
  tags?: string[];
  spec?: string;                 // 'chara_card_v2' | 'v1' | ...
  rawData: any;                  // toàn bộ card gốc giữ nguyên
  importedAt: number;            // timestamp
  lastPlayedAt?: number;
}

export interface LsrTableDefinition {
  id: string;
  name: string;
  columns: string[];
}

export interface WorldData {
  id?: string; // Optional ID to link to save/StoryBible
  activeSaveId?: string; // Currently loaded/active SaveFile ID
  sessionId?: string; // Used to track active gameplay session
  player: PlayerProfile;
  world: WorldSettingConfig;
  config: GameConfig;
  entities: Entity[];
  lorebook?: import("./services/ai/lorebook/types").Lorebook;
  gameTime?: GameTime; // Hệ thống thời gian
  summary?: string; // Trí nhớ tóm tắt tích lũy
  lsrData?: Record<string, unknown[]>; // Long-term State Representation (LSR)
  lsrTableDefinitions?: LsrTableDefinition[]; // Custom per-world LSR table configurations
  tavoVars?: Record<string, any>; // Lưu trữ biến cho Tavo JS API
  extensions?: {
    regex_scripts?: RegexScript[];
    character_allowed_regex?: string[];
    preset_allowed_regex?: Record<string, string[]>;
    memory?: {
      enabled: boolean;
      memories: string[];
    };
    fate_settings?: {
      enabled: boolean;
      diceType: "D20" | "D100";
      dc: number;
      autoRoll: boolean;
      cheatEnabled: boolean;
      rate: number;
      onlyHiddenFromSchedule: boolean;
    };
  };
  // Optional state for loading saved games
  savedState?: {
    history: ChatMessage[];
    turnCount: number;
    gameTime?: GameTime;
    aiMonitor?: {
      tokenHistory: { tokens: number; words: number; timestamp: number }[];
      totalTokens: number;
      lastTurnTotalTime: number;
    };
  };
}

export interface ImageMetadata {
  id: string;
  name: string;
  data: string; // Base64 data
  type: string; // mime type
  size: number;
  width?: number;
  height?: number;
  timestamp: number;
}

// Navigation Prop Type
export interface NavigationProps {
  onNavigate: (state: GameState) => void;
  onGameStart?: (data: WorldData) => void;
  onUpdateWorld?: (data: Partial<WorldData>) => void; // NEW: Callback to update world data
  onImportSetup?: (data: WorldData) => void; // New prop for importing setup only
  activeWorld?: WorldData | null;
}

export interface GameSnapshot {
  player: PlayerProfile;
  entities: Entity[];
  gameTime: GameTime;
  summary?: string;
  lsrData?: Record<string, unknown[]>;
  turnCount: number;
  dynamicRules?: string[];
}

export interface ChatMessage {
  role: "user" | "model" | "system";
  text: string;
  timestamp: number;
  gameTime?: GameTime; // Thời gian tại thời điểm tin nhắn
  choices?: string[]; // Added field to persist action choices
  userAction?: string; // Hành động người chơi đã chọn dẫn đến lượt này
  turnNumber?: number; // Số lượt của tin nhắn này
  // New fields for Swipe/Regenerate
  swipes?: string[]; // Array of message variations
  swipeIndex?: number; // Index of the currently shown message
  incrementalSummary?: string; // Tóm tắt tích lũy của cốt truyện tính đến lượt này
  isHidden?: boolean; // Tin nhắn có bị ẩn khỏi AI context không
  metadata?: {
    presetUsed?: string;
    cotUsed?: string;
    worldInfoConfig?: string;
  };
  groundingSources?: { title: string; uri: string }[];
  deepLogicResult?: {
    complianceScore: number;
    violations: string[];
    status: "APPROVED" | "VIOLATION_DETECTED" | "CRITICAL_VIOLATION";
  };
}

// --- NEW TAWA PRESET TYPES (REFACTOR V2) ---

// V2 Architecture
export interface PromptModule {
  identifier: string;
  name: string;
  enabled: boolean;
  injection_position: number;
  injection_depth: number;
  injection_order: number;
  role: "system" | "assistant" | "user";
  content: string;
  system_prompt: boolean;
  marker?: boolean;
  forbid_overrides?: boolean;
  injection_trigger?: string[];
}

export interface TawaVariable {
  id: string;
  name: string;
  value: string;
  description?: string;
}

export interface TawaPresetConfig {
  id?: string;
  name?: string;

  // AI Settings
  temperature?: number;
  top_p?: number;
  top_k?: number;
  top_a?: number;
  min_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  openai_max_context?: number;
  openai_max_tokens?: number;

  // Prompts and Formatting
  impersonation_prompt?: string;
  new_chat_prompt?: string;
  new_group_chat_prompt?: string;
  new_example_chat_prompt?: string;
  continue_nudge_prompt?: string;
  group_nudge_prompt?: string;
  wi_format?: string;
  scenario_format?: string;
  personality_format?: string;
  main_prompt?: string;
  jailbreak_prompt?: string;
  nsfw_prompt?: string;
  post_history_instructions?: string;

  send_if_empty?: string;

  assistant_prefill?: string;

  modules: PromptModule[];
  variables?: TawaVariable[];
  regexScripts?: RegexScript[]; // NEW: Tawa Preset Regex Scripts
  aiConfigOverrides?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    thinkingBudget?: number;
  };
}
