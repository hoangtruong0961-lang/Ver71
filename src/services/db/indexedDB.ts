import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { AppSettings, SaveFile, SystemLog, ImageMetadata, StoredCharacter } from '../../types';
import { DEFAULT_SAFETY_SETTINGS, DIFFICULTY_LEVELS, OUTPUT_LENGTHS } from '../../constants/promptTemplates';
import { CompressionUtils } from '../../utils/compression';

export interface VectorData {
  id: string;
  text: string;
  embedding: number[];
  timestamp: number;
  role: 'user' | 'model' | 'novel_source' | 'story_bible';
  docId?: string;
  saveId?: string;
  keyword?: string;
  category?: string;
  updateHistory?: { timestamp: number; content: string }[];
  triggerMode?: 'always' | 'keyword' | 'semantic' | 'hybrid';
  keywords?: string[];
  tags?: string[];
  summary?: string;
  priority?: number;
  position?: 'before_char' | 'after_char' | 'before_history' | 'after_history' | 'in_chat';
  isSticky?: boolean;
  stickyTurns?: number;
  depth?: number;
  relatedEntries?: string[];
  isEnabled?: boolean;
  parentId?: string;
  isParent?: boolean;
  childIds?: string[];
  metadataRelations?: { targetId: string; relationship: string; description: string }[];
}

interface RPGDatabase extends DBSchema {
  saves: {
    key: string;
    value: SaveFile;
  };
  settings: {
    key: string;
    value: AppSettings;
  };
  logs: {
    key: number;
    value: SystemLog;
    autoIncrement: true;
  };
  vectors: {
    key: string;
    value: VectorData;
  };
  assets: {
    key: string;
    value: { id: string; data: string; timestamp: number };
  };
  images: {
    key: string;
    value: ImageMetadata;
  };
  novel_docs: {
    key: string;
    value: { id: string; name: string; content: string; timestamp: number };
  };
  tavo_data: {
    key: string;
    value: any[];
  };
  characters: {
    key: string;
    value: StoredCharacter;
  };
  keyval: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'ark-v2-db';
const DB_VERSION = 3;

export const DEFAULT_SETTINGS: AppSettings = {
    javaScriptMode: 'auto',
    soundVolume: 50,
    musicVolume: 50,
    theme: 'dark',
    fontSize: 16,
    systemFont: 'Lora',
    realityDifficulty: 'Normal',
    contentBeautify: false,
    visualEffects: true,
    fullScreenMode: false,
    safetySettings: DEFAULT_SAFETY_SETTINGS,
    aiModel: 'gemini-3.5-flash',
    backgroundAiModel: 'gemini-3-flash-preview',
    aiMode: 'single',
    embeddingModel: 'gemini-embedding-001',
    perspective: 'third',
    difficulty: DIFFICULTY_LEVELS[1],
    outputLength: OUTPUT_LENGTHS[2],
    customMinWords: 1000,
    customMaxWords: 3000,
    streamResponse: true,
    geminiApiKey: [],
    proxyUrl: '',
    proxyKey: '',
    proxyModel: '',
    proxyModels: [],
    proxyName: '',
    proxyUrl2: '',
    proxyKey2: '',
    proxyModel2: '',
    proxyModels2: [],
    proxyName2: '',
    useGeminiApi: true,
    proxyEnabled: false,
    enableVectorMemory: true,
    useLocalEmbedding: true,
    enableSearchGrounding: true,
    enableSotaSearch: true,
    enableDeepLogic: true,
    deepLogicMode: 'strict',
    proxies: [],
    activeProxyId: undefined,
    useProxyPool: false,
    proxyPoolStrategy: 'round_robin',
    storyDialogueColor: '#F97316',
    storyThinkingColor: '#A855F7',
    storyHighlightColor: '#FACC15',
    storyOnomatopoeiaColor: '#EF4444',
    layoutZoom: 100,
    customThemes: [],
    activeCustomThemeId: '',
    useCustomTheme: false,
    elevenLabsApiKey: '',
    elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
    elevenLabsVoiceName: 'Rachel',
    elevenLabsModelId: 'eleven_turbo_v2_5',
    elevenLabsEnabled: false,
    elevenLabsStability: 0.5,
    elevenLabsSimilarityBoost: 0.75,
    elevenLabsAutoPlay: false,
    browserTtsEnabled: false,
    browserTtsVoice: '',
    browserTtsRate: 1.0,
    browserTtsPitch: 1.0,
    browserTtsAutoPlay: false
};

class DatabaseService {
  private dbPromise: Promise<IDBPDatabase<RPGDatabase> | null>;
  private isFallbackMode = false;
  private keyValCache: Record<string, any> = {};
  
  // In-Memory Fallback stores in case IndexedDB goes offline
  private fallbackStore: {
    saves: Record<string, SaveFile>;
    logs: SystemLog[];
    vectors: Record<string, VectorData>;
    assets: Record<string, { id: string; data: string; timestamp: number }>;
    images: Record<string, ImageMetadata>;
    novel_docs: Record<string, { id: string; name: string; content: string; timestamp: number }>;
    tavo_data: Record<string, any[]>;
    characters: Record<string, StoredCharacter>;
  } = {
    saves: {},
    logs: [],
    vectors: {},
    assets: {},
    images: {},
    novel_docs: {},
    tavo_data: {},
    characters: {}
  };

  constructor() {
    // 1. Synchronously preheat the in-memory cache from localStorage for backwards compatibility and instant reads
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key);
          if (val !== null) {
            try {
              this.keyValCache[key] = JSON.parse(val);
            } catch {
              this.keyValCache[key] = val;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Could not synchronously read localStorage during DatabaseService construction:", e);
    }

    try {
      this.dbPromise = openDB<RPGDatabase>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('saves')) {
            db.createObjectStore('saves', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings');
          }
          if (!db.objectStoreNames.contains('logs')) {
            db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
          }
          if (!db.objectStoreNames.contains('vectors')) {
            const vectorStore = db.createObjectStore('vectors', { keyPath: 'id' });
            vectorStore.createIndex('timestamp', 'timestamp');
          }
          if (!db.objectStoreNames.contains('assets')) {
            db.createObjectStore('assets', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('images')) {
            const imageStore = db.createObjectStore('images', { keyPath: 'id' });
            imageStore.createIndex('timestamp', 'timestamp');
          }
          if (!db.objectStoreNames.contains('novel_docs')) {
            db.createObjectStore('novel_docs', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('tavo_data')) {
            db.createObjectStore('tavo_data');
          }
          if (!db.objectStoreNames.contains('characters')) {
            const charStore = db.createObjectStore('characters', { keyPath: 'id' });
            charStore.createIndex('importedAt', 'importedAt');
            charStore.createIndex('lastPlayedAt', 'lastPlayedAt');
          }
          if (!db.objectStoreNames.contains('keyval')) {
            db.createObjectStore('keyval');
          }
        },
      }).catch(err => {
        console.warn("IndexedDB fails to open, activating private browsing fallback mode:", err);
        this.isFallbackMode = true;
        return null;
      });
    } catch (e) {
      console.warn("IndexedDB fails to construct, activating fallback mode:", e);
      this.isFallbackMode = true;
      this.dbPromise = Promise.resolve(null);
    }

    // 2. Load/save cache from/to IndexedDB and clear localStorage
    this.initDatabaseAndMigration();
  }

  private async initDatabaseAndMigration() {
    try {
      const db = await this.dbPromise;
      if (db && !this.isFallbackMode) {
        // A. Read existing keys from keyval table and merge them back into the cache
        const tx = db.transaction('keyval', 'readonly');
        const store = tx.objectStore('keyval');
        const keys = await store.getAllKeys();
        for (const key of keys) {
          const val = await store.get(key);
          this.keyValCache[key] = val;
        }

        // B. Populate settings and saves fallbacks if present in keyValCache and write back all cache elements to DB
        const writeTx = db.transaction('keyval', 'readwrite');
        const writeStore = writeTx.objectStore('keyval');
        for (const [key, val] of Object.entries(this.keyValCache)) {
          await writeStore.put(val, key);
        }
        await writeTx.done;

        // C. Clear localStorage as we are completely migrating away
        try {
          localStorage.clear();
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      console.warn("Error running async IndexedDB migration & cache sync:", err);
    }
  }

  // --- Generic Key-Value Store Operations ---

  async setKeyValue(key: string, value: any): Promise<void> {
    this.keyValCache[key] = value;
    try {
      const db = await this.getDB();
      if (db && !this.isFallbackMode) {
        const tx = db.transaction('keyval', 'readwrite');
        await tx.objectStore('keyval').put(value, key);
        await tx.done;
      }
    } catch (e) {
      console.error(`setKeyValue failed for key ${key}:`, e);
    }
  }

  async removeKeyValue(key: string): Promise<void> {
    delete this.keyValCache[key];
    try {
      const db = await this.getDB();
      if (db && !this.isFallbackMode) {
        const tx = db.transaction('keyval', 'readwrite');
        await tx.objectStore('keyval').delete(key);
        await tx.done;
      }
    } catch (e) {
      console.error(`removeKeyValue failed for key ${key}:`, e);
    }
  }

  getKeyValueSync(key: string, defaultValue?: any): any {
    if (key in this.keyValCache) {
      return this.keyValCache[key];
    }
    return defaultValue;
  }

  private async getDB(): Promise<IDBPDatabase<RPGDatabase> | null> {
    try {
      if (this.isFallbackMode) return null;
      const db = await this.dbPromise;
      return db;
    } catch (e) {
      this.isFallbackMode = true;
      console.warn("IndexedDB promise rejected, falling back to in-memory state:", e);
      return null;
    }
  }

  private getFallbackSaves(): Record<string, SaveFile> {
    return this.fallbackStore.saves;
  }

  private saveFallbackSaves(saves: Record<string, SaveFile>) {
    this.fallbackStore.saves = saves;
  }

  async checkConnection(): Promise<boolean> {
    try {
      const db = await this.getDB();
      return !!db && !this.isFallbackMode;
    } catch {
      return false;
    }
  }

  async logEvent(message: string, type: 'info' | 'error' | 'warning' = 'info'): Promise<void> {
    try {
      const db = await this.getDB();
      const logObj: SystemLog = { timestamp: Date.now(), message, type };
      if (!db || this.isFallbackMode) {
        this.fallbackStore.logs.push(logObj);
        return;
      }
      await db.add('logs', logObj);
    } catch (e) {
      console.error("logEvent error:", e);
    }
  }

  async getSettings(): Promise<AppSettings> {
    try {
      const db = await this.getDB();
      let settings: AppSettings | undefined;

      if (!db || this.isFallbackMode) {
        settings = this.keyValCache['user_settings_fallback'];
      } else {
        settings = await db.get('settings', 'user_settings');
      }
      
      if (!settings) {
          return DEFAULT_SETTINGS;
      }

      // Merge defaults with saved settings to ensure new fields exist
      const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
      const targetFontSize = 16;

      // MIGRATION: Auto-disable beautify content and set fontSize based on device
      if (mergedSettings.contentBeautify === true || mergedSettings.fontSize !== targetFontSize) {
        if (!settings._uiMigrated3) {
          mergedSettings.contentBeautify = false;
          mergedSettings.fontSize = targetFontSize;
          mergedSettings._uiMigrated3 = true;
          setTimeout(() => this.saveSettings(mergedSettings), 0);
        }
      }

      // MIGRATION: Move old proxy settings to the new proxies array if empty
      if (mergedSettings.proxies.length === 0) {
        const migratedProxies: any[] = [];
        
        if (mergedSettings.proxyUrl) {
          migratedProxies.push({
            id: 'proxy-1',
            url: mergedSettings.proxyUrl,
            key: mergedSettings.proxyKey || '',
            model: mergedSettings.proxyModel || '',
            models: mergedSettings.proxyModels || [],
            isActive: true,
            type: 'google'
          });
        }
        
        if (mergedSettings.proxyUrl2) {
          migratedProxies.push({
            id: 'proxy-2',
            url: mergedSettings.proxyUrl2,
            key: mergedSettings.proxyKey2 || '',
            model: mergedSettings.proxyModel2 || '',
            models: mergedSettings.proxyModels2 || [],
            isActive: false,
            type: 'google'
          });
        }
        
        if (migratedProxies.length > 0) {
          mergedSettings.proxies = migratedProxies;
          mergedSettings.activeProxyId = migratedProxies[0].id;
          setTimeout(() => this.saveSettings(mergedSettings), 0);
        }
      }

      return mergedSettings;
    } catch (e) {
      console.error("getSettings failed:", e);
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        this.keyValCache['user_settings_fallback'] = settings;
        return;
      }
      await db.put('settings', settings, 'user_settings');
    } catch (e) {
      console.error("saveSettings failed, writing fallback:", e);
      this.keyValCache['user_settings_fallback'] = settings;
    }
  }

  async hasSaves(): Promise<boolean> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        return Object.keys(this.getFallbackSaves()).length > 0;
      }
      const count = await db.count('saves');
      return count > 0;
    } catch {
      return Object.keys(this.getFallbackSaves()).length > 0;
    }
  }

  async saveGameState(saveData: SaveFile): Promise<void> {
    try {
      const originalData = JSON.stringify(saveData.data);
      const compressedData = CompressionUtils.compress(originalData);
      
      const compressedSave: SaveFile = {
        ...saveData,
        data: compressedData,
        _compressed: true
      };
      
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        const fallbackSaves = this.getFallbackSaves();
        fallbackSaves[saveData.id] = compressedSave;
        this.saveFallbackSaves(fallbackSaves);
        return;
      }
      await db.put('saves', compressedSave);
    } catch (e) {
      console.error('saveGameState failed to write to IndexedDB, writing to fallback:', e);
      try {
        const compressedSave: SaveFile = {
          ...saveData,
          data: CompressionUtils.compress(JSON.stringify(saveData.data)),
          _compressed: true
        };
        const fallbackSaves = this.getFallbackSaves();
        fallbackSaves[saveData.id] = compressedSave;
        this.saveFallbackSaves(fallbackSaves);
      } catch (inner) {
        console.error("Saving fallback state completely failed:", inner);
      }
    }
  }

  async saveAutosave(saveData: SaveFile): Promise<void> {
    await this.saveGameState(saveData);
  }

  async getAllSaves(): Promise<SaveFile[]> {
    try {
      const db = await this.getDB();
      let rawSaves: SaveFile[];

      if (!db || this.isFallbackMode) {
        rawSaves = Object.values(this.getFallbackSaves());
      } else {
        rawSaves = await db.getAll('saves');
      }
      
      return rawSaves.map((save: SaveFile) => {
        if (save._compressed && typeof save.data === 'string') {
          try {
            const decompressedData = CompressionUtils.decompress(save.data);
            return {
              ...save,
              data: JSON.parse(decompressedData),
              _compressed: undefined
            };
          } catch (e) {
            console.error('Failed to decompress save data:', e);
            return save;
          }
        }
        return save;
      });
    } catch (e) {
      console.error("getAllSaves failed:", e);
      return Object.values(this.getFallbackSaves());
    }
  }

  async deleteSave(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        const fallbackSaves = this.getFallbackSaves();
        delete fallbackSaves[id];
        this.saveFallbackSaves(fallbackSaves);
        return;
      }
      await db.delete('saves', id);
    } catch (e) {
      console.error("deleteSave failed:", e);
    }
  }

  async clearAllSaves(): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        this.fallbackStore.saves = {};
        delete this.keyValCache['ark_saves_fallback'];
        return;
      }
      await db.clear('saves');
    } catch (e) {
      console.error("clearAllSaves failed:", e);
    }
  }

  // --- Vector Operations ---

  async saveVector(vectorData: VectorData): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        this.fallbackStore.vectors[vectorData.id] = vectorData;
        return;
      }
      await db.put('vectors', vectorData);
    } catch (e) {
      console.error("saveVector failed, writing in-memory:", e);
      this.fallbackStore.vectors[vectorData.id] = vectorData;
    }
  }

  async getVector(id: string): Promise<VectorData | undefined> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        return this.fallbackStore.vectors[id];
      }
      return db.get('vectors', id);
    } catch {
      return this.fallbackStore.vectors[id];
    }
  }

  async getAllVectors(): Promise<VectorData[]> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        return Object.values(this.fallbackStore.vectors);
      }
      return db.getAll('vectors');
    } catch {
      return Object.values(this.fallbackStore.vectors);
    }
  }

  async hasVector(id: string): Promise<boolean> {
     try {
       const db = await this.getDB();
       if (!db || this.isFallbackMode) {
         return !!this.fallbackStore.vectors[id];
       }
       const key = await db.getKey('vectors', id);
       return !!key;
     } catch {
       return !!this.fallbackStore.vectors[id];
     }
  }

  async deleteVectorsByDocId(docId: string): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        for (const vid in this.fallbackStore.vectors) {
          if (this.fallbackStore.vectors[vid].docId === docId) {
            delete this.fallbackStore.vectors[vid];
          }
        }
        return;
      }
      const tx = db.transaction('vectors', 'readwrite');
      const store = tx.objectStore('vectors');
      
      let cursor = await store.openCursor();
      while (cursor) {
        if (cursor.value.docId === docId) {
          await cursor.delete();
        }
        cursor = await cursor.continue();
      }
      await tx.done;
    } catch (e) {
      console.error("deleteVectorsByDocId failed:", e);
    }
  }

  async deleteVector(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        delete this.fallbackStore.vectors[id];
        return;
      }
      await db.delete('vectors', id);
    } catch (e) {
      console.error("deleteVector failed:", e);
    }
  }

  // --- Asset Operations ---

  async saveAsset(id: string, data: string): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        this.fallbackStore.assets[id] = { id, data, timestamp: Date.now() };
        return;
      }
      await db.put('assets', { id, data, timestamp: Date.now() });
    } catch (e) {
      console.error("saveAsset failed:", e);
      this.fallbackStore.assets[id] = { id, data, timestamp: Date.now() };
    }
  }

  async getAsset(id: string): Promise<string | undefined> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        return this.fallbackStore.assets[id]?.data;
      }
      const asset = await db.get('assets', id);
      return asset?.data;
    } catch {
      return this.fallbackStore.assets[id]?.data;
    }
  }

  async deleteAsset(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        delete this.fallbackStore.assets[id];
        return;
      }
      await db.delete('assets', id);
    } catch (e) {
      console.error("deleteAsset failed:", e);
    }
  }

  // --- Image Library Operations ---

  async saveImage(image: ImageMetadata): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        this.fallbackStore.images[image.id] = image;
        return;
      }
      await db.put('images', image);
    } catch (e) {
      console.error("saveImage failed:", e);
      this.fallbackStore.images[image.id] = image;
    }
  }

  async getImage(id: string): Promise<ImageMetadata | undefined> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        return this.fallbackStore.images[id];
      }
      return db.get('images', id);
    } catch {
      return this.fallbackStore.images[id];
    }
  }

  async getAllImages(): Promise<ImageMetadata[]> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        return Object.values(this.fallbackStore.images);
      }
      return db.getAll('images');
    } catch {
      return Object.values(this.fallbackStore.images);
    }
  }

  async deleteImage(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        delete this.fallbackStore.images[id];
        return;
      }
      await db.delete('images', id);
    } catch (e) {
      console.error("deleteImage failed:", e);
    }
  }

  async clearAllImages(): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        this.fallbackStore.images = {};
        return;
      }
      await db.clear('images');
    } catch (e) {
      console.error("clearAllImages failed:", e);
    }
  }

  // --- Novel Document Operations ---

  async saveNovelDoc(doc: { id: string; name: string; content: string; timestamp: number }): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        this.fallbackStore.novel_docs[doc.id] = doc;
        return;
      }
      await db.put('novel_docs', doc);
    } catch (e) {
      console.error("saveNovelDoc failed:", e);
      this.fallbackStore.novel_docs[doc.id] = doc;
    }
  }

  async getNovelDoc(id: string): Promise<{ id: string; name: string; content: string; timestamp: number } | undefined> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        return this.fallbackStore.novel_docs[id];
      }
      return db.get('novel_docs', id);
    } catch {
      return this.fallbackStore.novel_docs[id];
    }
  }

  async getAllNovelDocs(): Promise<{ id: string; name: string; content: string; timestamp: number }[]> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        return Object.values(this.fallbackStore.novel_docs);
      }
      return db.getAll('novel_docs');
    } catch {
      return Object.values(this.fallbackStore.novel_docs);
    }
  }

  async deleteNovelDoc(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        delete this.fallbackStore.novel_docs[id];
        return;
      }
      await db.delete('novel_docs', id);
    } catch (e) {
      console.error("deleteNovelDoc failed:", e);
    }
  }

  // --- Tavo Data Operations ---

  async getTavoData(key: string): Promise<any[]> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        return this.fallbackStore.tavo_data[key] || [];
      }
      const value = await db.get('tavo_data', key);
      return value || [];
    } catch {
      return this.fallbackStore.tavo_data[key] || [];
    }
  }

  async setTavoData(key: string, value: any[]): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        this.fallbackStore.tavo_data[key] = value;
        return;
      }
      await db.put('tavo_data', value, key);
    } catch (e) {
      console.error("setTavoData failed:", e);
      this.fallbackStore.tavo_data[key] = value;
    }
  }

  // --- Character Library Operations ---

  async saveCharacter(char: StoredCharacter): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        this.fallbackStore.characters[char.id] = char;
        return;
      }
      await db.put('characters', char);
    } catch (e) {
      console.error("saveCharacter failed:", e);
      this.fallbackStore.characters[char.id] = char;
    }
  }

  async getCharacter(id: string): Promise<StoredCharacter | undefined> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        return this.fallbackStore.characters[id];
      }
      return db.get('characters', id);
    } catch {
      return this.fallbackStore.characters[id];
    }
  }

  async getAllCharacters(): Promise<StoredCharacter[]> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        return Object.values(this.fallbackStore.characters);
      }
      return db.getAll('characters');
    } catch {
      return Object.values(this.fallbackStore.characters);
    }
  }

  async deleteCharacter(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        delete this.fallbackStore.characters[id];
        return;
      }
      await db.delete('characters', id);
    } catch (e) {
      console.error("deleteCharacter failed:", e);
    }
  }

  async updateCharacterLastPlayed(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db || this.isFallbackMode) {
        const char = this.fallbackStore.characters[id];
        if (char) char.lastPlayedAt = Date.now();
        return;
      }
      const char = await db.get('characters', id);
      if (char) {
        char.lastPlayedAt = Date.now();
        await db.put('characters', char);
      }
    } catch (e) {
      console.error("updateCharacterLastPlayed failed:", e);
    }
  }
}

export const dbService = new DatabaseService();
