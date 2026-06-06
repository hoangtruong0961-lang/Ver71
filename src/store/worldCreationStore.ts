import { create } from 'zustand';
import { Entity, GameConfig, PlayerProfile, WorldData, WorldSettingConfig, LsrTableDefinition } from "../types";
import { GameTime, INITIAL_GAME_TIME } from "../utils/timeUtils";
import { Lorebook } from "../services/ai/lorebook/types";
import { DIFFICULTY_LEVELS, OUTPUT_LENGTHS } from '../constants/promptTemplates';

export interface WorldCreationState {
  currentTab: number;
  player: PlayerProfile;
  world: WorldSettingConfig;
  config: GameConfig;
  entities: Entity[];
  gameTime: GameTime;
  lorebook?: Lorebook;
  lsrTableDefinitions?: LsrTableDefinition[];
  isGenerating: boolean;
  generatingField: string | null;

  // Actions
  setTab: (tab: number) => void;
  updatePlayer: (field: keyof PlayerProfile, value: any) => void;
  updateWorld: (field: keyof WorldSettingConfig, value: string) => void;
  updateConfig: (field: keyof GameConfig, value: string[] | number | boolean | any) => void;
  updateCustomWords: (min: number, max: number) => void;
  addRule: (rule: string) => void;
  removeRule: (index: number) => void;
  addEntity: (entity: Omit<Entity, 'id'>) => void;
  updateEntity: (id: string, entity: Partial<Entity>) => void;
  removeEntity: (id: string) => void;
  updateGameTime: (field: keyof GameTime, value: number) => void;
  setGenerating: (isGenerating: boolean, field?: string | null) => void;
  autoFillAll: (payload: Partial<WorldData>, forceOverwrite?: boolean) => void;
  importData: (payload: WorldData) => void;
  updateLorebook: (payload: Lorebook) => void;
  setEntities: (entities: Entity[]) => void;
  setLsrTableDefinitions: (definitions: LsrTableDefinition[]) => void;
  reset: () => void;
}

const simpleId = () => crypto.randomUUID();

const initialState = {
  currentTab: 0,
  player: {
    name: '',
    gender: 'Nam',
    age: '',
    birthDay: 1,
    birthMonth: 1,
    birthYear: 2000,
    personality: '',
    background: '',
    appearance: '',
    voiceAndTone: '',
    narrativeRole: 'Protagonist',
    skills: '',
    goal: '',
    // Additional CharacterSheet fields
    coreValues: '',
    hardLimits: '',
    definingEvents: '',
    currentMood: '',
    relationshipTags: '',
    strengths: '',
    weaknesses: '',
    contradictions: '',
    failureMode: '',
    customSchemaId: 'none',
    customFields: []
  },
  world: {
    worldName: '',
    genre: '',
    context: '',
    startingScenario: '',
    corePremise: '',
    cosmology: '',
    timeline: '',
    geography: '',
    factionsPower: '',
    economyResources: '',
    culturalIdentity: '',
    adventureHooks: '',
    saveName: '',
    mainTone: '',
    setting: '',
    openingTimeline: '',
    worldRules: '',
    pacing: '',
    history: '',
    culture: '',
    economySociety: '',
    religionBeliefs: '',
    worldFeatures: '',
    logicControl: '',
    writingStyle: '',
    narratorPov: ''
  },
  config: {
    rules: [],
    difficulty: DIFFICULTY_LEVELS[1], // default: Normal
    outputLength: OUTPUT_LENGTHS[2], // default: Mặc định
    perspective: 'second' as const
  },
  entities: [],
  gameTime: INITIAL_GAME_TIME,
  lsrTableDefinitions: [],
  isGenerating: false,
  generatingField: null
};

export const useWorldCreationStore = create<WorldCreationState>((set) => ({
  ...initialState,

  setTab: (tab) => set({ currentTab: tab }),
  updatePlayer: (field, value) => set((state) => ({ player: { ...state.player, [field]: value } })),
  updateWorld: (field, value) => set((state) => ({ world: { ...state.world, [field]: value } })),
  updateConfig: (field, value) => set((state) => ({ config: { ...state.config, [field]: value } })),
  updateCustomWords: (min, max) => set((state) => ({ config: { ...state.config, customMinWords: min, customMaxWords: max } })),
  addRule: (rule) => set((state) => ({ config: { ...state.config, rules: [...state.config.rules, rule] } })),
  removeRule: (index) => set((state) => ({ config: { ...state.config, rules: state.config.rules.filter((_, i) => i !== index) } })),
  addEntity: (entity) => set((state) => {
    const current = Array.isArray(state.entities) ? state.entities : [];
    return { entities: [...current, { ...entity, id: simpleId() }] as Entity[] };
  }),
  updateEntity: (id, entityUpdate) => set((state) => {
    const current = Array.isArray(state.entities) ? state.entities : [];
    return { entities: current.map(e => e.id === id ? { ...e, ...entityUpdate } : e) as Entity[] };
  }),
  removeEntity: (id) => set((state) => {
    const current = Array.isArray(state.entities) ? state.entities : [];
    return { entities: current.filter(e => e.id !== id) };
  }),
  updateGameTime: (field, value) => set((state) => ({ gameTime: { ...state.gameTime, [field]: value } })),
  setGenerating: (isGenerating, field) => set({ isGenerating, generatingField: field || null }),
  
  autoFillAll: (payload, forceOverwrite) => set((state) => {
    const mergeIfEmpty = (current: any, incoming: any) => {
      const result = { ...current };
      if (incoming) {
          // If merging world, apply our custom Vietnamese fields mapping and synchronize bidirectionally
          const mappedIncoming = { ...incoming };
          
          if (incoming.worldName && !incoming.saveName) mappedIncoming.saveName = `${incoming.worldName} Save`;
          
          // Bidirectional sync
          if (incoming.corePremise && (!incoming.setting || incoming.setting.trim() === "")) {
            mappedIncoming.setting = incoming.corePremise;
          } else if (incoming.setting && (!incoming.corePremise || incoming.corePremise.trim() === "")) {
            mappedIncoming.corePremise = incoming.setting;
          }
          
          if (incoming.timeline && (!incoming.history || incoming.history.trim() === "")) {
            mappedIncoming.history = incoming.timeline;
          } else if (incoming.history && (!incoming.timeline || incoming.timeline.trim() === "")) {
            mappedIncoming.timeline = incoming.history;
          }
          
          if (incoming.culturalIdentity && (!incoming.culture || incoming.culture.trim() === "")) {
            mappedIncoming.culture = incoming.culturalIdentity;
          } else if (incoming.culture && (!incoming.culturalIdentity || incoming.culturalIdentity.trim() === "")) {
            mappedIncoming.culturalIdentity = incoming.culture;
          }
          
          if (incoming.economyResources && (!incoming.economySociety || incoming.economySociety.trim() === "")) {
            mappedIncoming.economySociety = incoming.economyResources;
          } else if (incoming.economySociety && (!incoming.economyResources || incoming.economyResources.trim() === "")) {
            mappedIncoming.economyResources = incoming.economySociety;
          }
          
          if (incoming.cosmology && (!incoming.worldRules || incoming.worldRules.trim() === "")) {
            mappedIncoming.worldRules = incoming.cosmology;
          } else if (incoming.worldRules && (!incoming.cosmology || incoming.cosmology.trim() === "")) {
            mappedIncoming.cosmology = incoming.worldRules;
          }
          
          if (!incoming.pacing || incoming.pacing.trim() === '') mappedIncoming.pacing = "Trung bình (Bình thường)";
          if (!incoming.mainTone || incoming.mainTone.trim() === '') mappedIncoming.mainTone = "Kỳ ảo cổ điển";
          if (!incoming.openingTimeline || incoming.openingTimeline.trim() === '') mappedIncoming.openingTimeline = "Khởi nguyên chi kỷ - Năm thứ nhất";
          if (!incoming.worldFeatures || incoming.worldFeatures.trim() === '') mappedIncoming.worldFeatures = "Thế giới rộng mở chứa nhiều kỳ ngộ và hung hiểm.";
          if (!incoming.logicControl || incoming.logicControl.trim() === '') mappedIncoming.logicControl = "Phát triển tuyến tính hợp lý. Không dịch chuyển tức thời phi vật lý. Nhân quả rõ ràng.";
          if (!incoming.writingStyle || incoming.writingStyle.trim() === '') mappedIncoming.writingStyle = "Văn phong văn học sâu sắc, giàu hình ảnh, biểu cảm sâu mượt.";
          if (!incoming.narratorPov || incoming.narratorPov.trim() === '') mappedIncoming.narratorPov = "Ngôi thứ ba (Mô tả khách quan, rộng mở)";

          Object.keys(mappedIncoming).forEach(key => {
            const isCurrentEmpty = !current[key] || 
                                   (typeof current[key] === 'string' && current[key].trim() === '') ||
                                   (Array.isArray(current[key]) && current[key].length === 0);
            if (forceOverwrite || isCurrentEmpty) {
              result[key] = mappedIncoming[key];
            }
          });
      }
      return result;
    };

    const currentEntities = Array.isArray(state.entities) ? state.entities : [];
    const incomingEntities = Array.isArray(payload.entities) ? payload.entities : [];

    return {
      player: mergeIfEmpty(state.player, payload.player),
      world: mergeIfEmpty(state.world, payload.world),
      entities: (forceOverwrite || incomingEntities.length >= currentEntities.length) ? incomingEntities : currentEntities,
      gameTime: (payload.gameTime && (forceOverwrite || state.gameTime.year === 2024)) ? payload.gameTime : state.gameTime,
      lsrTableDefinitions: payload.lsrTableDefinitions || state.lsrTableDefinitions,
      config: { ...state.config, rules: payload.config?.rules || (forceOverwrite ? [] : state.config.rules) }
    };
  }),
  
  importData: (payload) => set((state) => ({
    player: payload.player || state.player,
    world: payload.world || state.world,
    config: payload.config || state.config,
    entities: Array.isArray(payload.entities) ? payload.entities : [],
    gameTime: payload.gameTime || state.gameTime,
    lorebook: payload.lorebook || state.lorebook,
    lsrTableDefinitions: payload.lsrTableDefinitions || [],
    isGenerating: false,
    generatingField: null
  })),

  updateLorebook: (payload) => set({ lorebook: payload }),
  setEntities: (entities) => set({ entities: Array.isArray(entities) ? entities : [] }),
  setLsrTableDefinitions: (definitions) => set({ lsrTableDefinitions: definitions }),
  reset: () => set(initialState)
}));
