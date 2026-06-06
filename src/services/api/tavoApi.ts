import { dbService } from '../db/indexedDB';
import { WorldData, Entity, ChatMessage, AppSettings, StoredCharacter, RegexScript } from '../../types';

export interface SelectOption {
  value: any;
  label?: string;
}

// Registry definitions to allow React to connect to Tavo
export const tavoRegistry: {
  activeWorld: WorldData | null;
  updateWorld: ((data: Partial<WorldData>) => void) | null;
  getHistory: () => ChatMessage[];
  updateHistory: ((history: ChatMessage[]) => void) | null;
  generateText: ((prompt: string, options: any) => Promise<string>) | null;
  getInputValue: (() => string) | null;
  setInputValue: ((text: string) => void) | null;
  appendInputValue: ((text: string) => void) | null;
  clearInputValue: (() => void) | null;
  sendInput: (() => void) | null;
  focusInput: (() => void) | null;
  showSelect: ((options: (SelectOption | string)[], title?: string, defaultValue?: any) => Promise<any>) | null;
} = {
  activeWorld: null,
  updateWorld: null,
  getHistory: () => [],
  updateHistory: null,
  generateText: null,
  getInputValue: null,
  setInputValue: null,
  appendInputValue: null,
  clearInputValue: null,
  sendInput: null,
  focusInput: null,
  showSelect: null,
};

// Internal utilities
function clone<T>(obj: T): T {
  return obj ? JSON.parse(JSON.stringify(obj)) : null;
}

const getPath = (obj: any, path: string): any => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const setPath = (obj: Record<string, any>, path: string, value: any): void => {
  const parts = path.split('.');
  const last = parts.pop();
  if (!last) return;
  const target = parts.reduce((acc, part) => {
    if (!acc[part]) acc[part] = {};
    return acc[part];
  }, obj);
  target[last] = value;
};

const unsetPath = (obj: Record<string, any>, path: string): void => {
  const parts = path.split('.');
  const last = parts.pop();
  if (!last) return;
  const target = parts.reduce((acc, part) => acc && acc[part], obj);
  if (target) delete target[last];
};

const getLocalList = async (key: string): Promise<any[]> => {
  return await dbService.getTavoData(key);
};

const setLocalList = async (key: string, list: any[]): Promise<void> => {
  await dbService.setTavoData(key, list);
};

const genId = (): string => crypto.randomUUID();

const simpleSearch = (list: any[], name: string, options: { match?: 'exact' | 'prefix' | 'suffix' | 'contains' } = { match: 'exact' }): any[] => {
  return list.filter(item => {
    if (!item || !item.name) return false;
    const itemN = String(item.name).toLowerCase();
    const q = name.toLowerCase();
    if (options.match === 'prefix') return itemN.startsWith(q);
    if (options.match === 'suffix') return itemN.endsWith(q);
    if (options.match === 'contains') return itemN.includes(q);
    return itemN === q;
  });
};

export interface TavoMemoryResult {
  enabled: boolean;
  memories: string[];
}

export const tavoApi = {
  memory: {
    current: async (): Promise<{ id: number; enabled: boolean; memories: string[] }> => {
      const active = tavoRegistry.activeWorld;
      if (!active) return { id: Date.now(), enabled: false, memories: [] };
      const mem = active.extensions?.memory || { enabled: false, memories: [] };
      return { id: 1, ...clone(mem) };
    },
    update: async (mem: Partial<TavoMemoryResult>): Promise<{ id: number; enabled: boolean; memories: string[] }> => {
      if (!tavoRegistry.updateWorld || !tavoRegistry.activeWorld) {
        return { id: 1, enabled: !!mem.enabled, memories: mem.memories || [] };
      }
      const extensions = clone(tavoRegistry.activeWorld.extensions || {});
      extensions.memory = {
        enabled: !!mem.enabled,
        memories: mem.memories || []
      };
      tavoRegistry.updateWorld({ extensions });
      return { id: 1, ...extensions.memory };
    }
  },
  get: async (name: string, scope: 'chat' | 'global' = 'chat'): Promise<any> => {
    if (scope === 'global') {
      const settings = await dbService.getSettings();
      return settings?.tavoGlobalVars ? getPath(settings.tavoGlobalVars, name) : undefined;
    } else {
      if (!tavoRegistry.activeWorld) return undefined;
      const tavoVars = tavoRegistry.activeWorld.tavoVars || {};
      return getPath(tavoVars, name);
    }
  },

  set: async (name: string, value: any, scope: 'chat' | 'global' = 'chat'): Promise<void> => {
    if (scope === 'global') {
      const settings = await dbService.getSettings();
      const updatedVars = settings?.tavoGlobalVars ? clone(settings.tavoGlobalVars) : {};
      setPath(updatedVars, name, value);
      await dbService.saveSettings({ ...settings, tavoGlobalVars: updatedVars });
    } else {
      if (!tavoRegistry.activeWorld || !tavoRegistry.updateWorld) return;
      const tavoVars = tavoRegistry.activeWorld.tavoVars ? clone(tavoRegistry.activeWorld.tavoVars) : {};
      setPath(tavoVars, name, value);
      tavoRegistry.updateWorld({ tavoVars });
    }
  },

  unset: async (name: string, scope: 'chat' | 'global' = 'chat'): Promise<void> => {
    if (scope === 'global') {
      const settings = await dbService.getSettings();
      const updatedVars = settings?.tavoGlobalVars ? clone(settings.tavoGlobalVars) : {};
      unsetPath(updatedVars, name);
      await dbService.saveSettings({ ...settings, tavoGlobalVars: updatedVars });
    } else {
      if (!tavoRegistry.activeWorld || !tavoRegistry.updateWorld) return;
      const tavoVars = tavoRegistry.activeWorld.tavoVars ? clone(tavoRegistry.activeWorld.tavoVars) : {};
      unsetPath(tavoVars, name);
      tavoRegistry.updateWorld({ tavoVars });
    }
  },

  message: {
    find: async (
      indexRange: number | [number, number] | [number] | null,
      filter?: { role?: 'user' | 'model' | 'system'; hidden?: boolean; characters?: string[] }
    ): Promise<(ChatMessage & { id: number; content?: string; hidden?: boolean })[]> => {
      const history = tavoRegistry.getHistory();
      let start = 0;
      let end = history.length - 1;

      if (typeof indexRange === 'number') {
        const target = indexRange < 0 ? history.length + indexRange : indexRange;
        start = target;
        end = target;
      } else if (Array.isArray(indexRange)) {
        start = indexRange[0];
        end = indexRange.length > 1 ? indexRange[1] : history.length - 1;
      }

      if (start < 0) start = 0;
      if (end >= history.length) end = history.length - 1;

      const result = [];
      for (let i = start; i <= end; i++) {
        if (!history[i]) continue;
        const msg = clone(history[i]) as ChatMessage & { id: number; content?: string; hidden?: boolean; characterId?: string };
        msg.id = i;
        if (!msg.content && msg.text) msg.content = msg.text;
        
        let pass = true;
        if (filter?.role && msg.role !== filter.role) pass = false;
        if (filter?.hidden !== undefined && !!msg.isHidden !== filter.hidden) pass = false;
        if (filter?.characters && (!msg.characterId || !filter.characters.includes(msg.characterId))) pass = false;
        
        if (pass) result.push(msg);
      }
      return result;
    },
    get: async (messageId: number): Promise<(ChatMessage & { id: number; content?: string }) | null> => {
       const history = tavoRegistry.getHistory();
       const msg = history[messageId] ? clone(history[messageId]) as ChatMessage & { id: number; content?: string } : null;
       if (msg) {
         msg.id = messageId;
         if (!msg.content && msg.text) msg.content = msg.text;
       }
       return msg;
    },
    current: async (): Promise<(ChatMessage & { id: number; content?: string }) | null> => {
       const history = tavoRegistry.getHistory();
       const id = history.length - 1;
       const msg = history[id] ? clone(history[id]) as ChatMessage & { id: number; content?: string } : null;
       if (msg) {
         msg.id = id;
         if (!msg.content && msg.text) msg.content = msg.text;
       }
       return msg;
    },
    count: async (): Promise<number> => {
       return tavoRegistry.getHistory().length;
    },
    append: async (message: { role?: 'user' | 'model' | 'system'; content?: string; hidden?: boolean; characterId?: string }): Promise<number | null> => {
       if (!tavoRegistry.updateHistory) return null;
       const history = clone(tavoRegistry.getHistory());
       history.push({
         role: message.role || 'model',
         text: message.content || '',
         timestamp: Date.now(),
         isHidden: message.hidden || false,
         swipeIndex: 0,
         swipes: [message.content || '']
       } as ChatMessage);
       tavoRegistry.updateHistory(history);
       return history.length - 1;
    },
    update: async (message: { id: number; content?: string; reasoning?: string; hidden?: boolean }): Promise<number | null> => {
       if (!tavoRegistry.updateHistory || message.id === undefined) return null;
       const history = clone(tavoRegistry.getHistory());
       if (!history[message.id]) return null;
       const existingMsg = history[message.id];
       existingMsg.text = message.content !== undefined ? message.content : existingMsg.text;
       if (message.hidden !== undefined) existingMsg.isHidden = message.hidden;
       tavoRegistry.updateHistory(history);
       return message.id;
    },
    delete: async (messageId: number): Promise<number | null> => {
       if (!tavoRegistry.updateHistory) return null;
       const history = clone(tavoRegistry.getHistory());
       if (!history[messageId]) return null;
       history.splice(messageId, 1);
       tavoRegistry.updateHistory(history);
       return messageId;
    }
  },

  chat: {
    current: async (): Promise<{ id: number; name: string; characters: Entity[]; persona: any; lorebooks: { id: number; name: string }[]; regexes: RegexScript[] } | null> => {
      const active = tavoRegistry.activeWorld;
      if (!active) return null;
      return {
        id: 1,
        name: active.world.worldName || 'Active World',
        characters: active.entities.filter(e => e.type === 'NPC'),
        persona: active.player,
        lorebooks: active.lorebook ? [{ id: 1, name: 'Lorebook' }] : [],
        regexes: active.extensions?.regex_scripts || [],
      };
    },
    update: async (chat: any): Promise<void> => {
      if (!tavoRegistry.updateWorld || !tavoRegistry.activeWorld) return;
      const dataToUpdate: Partial<WorldData> = {};
      const world = clone(tavoRegistry.activeWorld.world);
      if (chat.name) world.worldName = chat.name;
      dataToUpdate.world = world;

      if (chat.persona) {
         dataToUpdate.player = chat.persona;
      }
      
      if (chat.lorebooks && chat.lorebooks.length > 0) {
         const lb = chat.lorebooks[0];
         const entriesRecord: Record<string, any> = {};
         if (Array.isArray(lb.entries)) {
             lb.entries.forEach((e: any, i: number) => {
                 entriesRecord[e.identifier || String(i)] = e;
             });
         }
         dataToUpdate.lorebook = {
             name: lb.name || 'Imported',
             entries: entriesRecord
         } as any;
      }
      
      if (chat.regexes) {
         const exts = clone(tavoRegistry.activeWorld.extensions || {});
         exts.regex_scripts = chat.regexes;
         dataToUpdate.extensions = exts;
      }

      tavoRegistry.updateWorld(dataToUpdate);
    }
  },

  character: {
    all: async (): Promise<Entity[]> => {
      const active = tavoRegistry.activeWorld;
      if (!active) return [];
      return active.entities.filter(e => e.type === 'NPC').map((e: Entity) => {
         const cloned = clone(e);
         (cloned as any).firstMes = cloned.description;
         return cloned;
      });
    },
    get: async (characterId: string | number): Promise<Entity | null> => {
      const active = tavoRegistry.activeWorld;
      if (!active) return null;
      const char = active.entities.find((e: Entity) => String(e.id) === String(characterId) || e.name === characterId);
      if (char) {
        const cloned = clone(char);
        (cloned as any).firstMes = cloned.description;
        return cloned;
      }
      return null;
    },
    find: async (name: string, options: { match?: 'exact' | 'prefix' | 'suffix' | 'contains' } = { match: 'exact' }): Promise<Entity[]> => {
      const active = tavoRegistry.activeWorld;
      if (!active) return [];
      return active.entities.filter((e: Entity) => {
         if (e.type !== 'NPC') return false;
         if (options.match === 'prefix') return e.name.startsWith(name);
         if (options.match === 'suffix') return e.name.endsWith(name);
         if (options.match === 'contains') return e.name.includes(name);
         return e.name === name;
      }).map((e: Entity) => {
         const cloned = clone(e);
         (cloned as any).firstMes = cloned.description;
         return cloned;
      });
    },
    create: async (character: any): Promise<string | null> => {
      if (!tavoRegistry.updateWorld || !tavoRegistry.activeWorld) return null;
      const entities = clone(tavoRegistry.activeWorld.entities || []);
      const newId = character.id || genId();
      entities.push({
        id: newId,
        type: 'NPC',
        name: character.name,
        description: character.description || character.firstMes || '',
        avatar: character.avatar,
        firstMes: character.first_mes || character.firstMes,
        personality: character.personality,
      } as any);
      tavoRegistry.updateWorld({ entities });
      return newId;
    },
    update: async (character: any): Promise<string | null> => {
      if (!tavoRegistry.updateWorld || !tavoRegistry.activeWorld) return null;
      const entities = clone(tavoRegistry.activeWorld.entities || []);
      const idx = entities.findIndex((e: Entity) => String(e.id) === String(character.id));
      if (idx !== -1) {
        entities[idx] = { ...entities[idx], ...character };
        tavoRegistry.updateWorld({ entities });
        return character.id;
      }
      return null;
    },
    import: async (card: any): Promise<{ characterId: string | null; lorebookId: string | null; regexId: string | null }> => {
      const charName = card.name || card.char_name || "Nhân vật bí ẩn";
      const newCtx = {
        name: charName,
        description: card.char_persona || card.description || "",
        avatar: card.avatar,
        firstMes: card.first_mes || '',
        personality: card.personality || '',
        exampleMessages: card.mes_example || '',
      };
      
      const charId = await tavoApi.character.create(newCtx);
      let lorebookId = null;
      let regexId = null;

      if (card.character_book) {
        lorebookId = await tavoApi.lorebook.create({
          name: card.character_book.name || `Lorebook: ${charName}`,
          entries: card.character_book.entries || []
        });
      }

      const regexEntries = card.extensions?.regex_scripts || card.character_book?.extensions?.regex_scripts;
      if (regexEntries) {
         regexId = await tavoApi.regex.create({
            name: `Regex: ${charName}`,
            entries: regexEntries
         });
      }
      
      return { characterId: charId, lorebookId, regexId };
    },
    delete: async (characterId: any): Promise<any | null> => {
      if (!tavoRegistry.updateWorld || !tavoRegistry.activeWorld) return null;
      const entities = clone(tavoRegistry.activeWorld.entities || []);
      const idx = entities.findIndex((e: Entity) => String(e.id) === String(characterId));
      if (idx !== -1) {
        entities.splice(idx, 1);
        tavoRegistry.updateWorld({ entities });
        return characterId;
      }
      return null;
    }
  },

  persona: {
    all: async (): Promise<{ id: string; name: string }[]> => (await getLocalList('tavo_personas')).map((p: any) => ({ id: p.id, name: p.name })),
    get: async (id: any): Promise<any | null> => (await getLocalList('tavo_personas')).find((p: any) => String(p.id) === String(id)) || null,
    find: async (name: string, options: any): Promise<any[]> => simpleSearch(await getLocalList('tavo_personas'), name, options),
    create: async (persona: any): Promise<string> => {
      const list = await getLocalList('tavo_personas');
      const newId = persona.id || genId();
      list.push({ ...persona, id: newId });
      await setLocalList('tavo_personas', list);
      return newId;
    },
    update: async (persona: any): Promise<void> => {
      const list = await getLocalList('tavo_personas');
      const idx = list.findIndex((p: any) => String(p.id) === String(persona.id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...persona };
        await setLocalList('tavo_personas', list);
      }
    },
    delete: async (idOrObj: any): Promise<string | null> => {
      const id = typeof idOrObj === 'object' ? idOrObj.id : idOrObj;
      const list = await getLocalList('tavo_personas');
      const idx = list.findIndex((p: any) => String(p.id) === String(id));
      if (idx !== -1) {
        list.splice(idx, 1);
        await setLocalList('tavo_personas', list);
        return id;
      }
      return null;
    }
  },

  preset: {
    all: async (): Promise<{ id: string; name: string }[]> => (await getLocalList('tavo_presets')).map((p: any) => ({ id: p.id, name: p.name })),
    get: async (id: any): Promise<any | null> => (await getLocalList('tavo_presets')).find((p: any) => String(p.id) === String(id)) || null,
    find: async (name: string, options: any): Promise<any[]> => simpleSearch(await getLocalList('tavo_presets'), name, options),
    import: async (preset: any): Promise<string | null> => {
      const c = window.confirm('Import this preset?');
      if (!c) return null;
      const list = await getLocalList('tavo_presets');
      const newId = preset.id || genId();
      list.push({ ...preset, id: newId, name: preset.name || 'Preset' });
      await setLocalList('tavo_presets', list);
      return newId;
    },
    create: async (preset: any): Promise<string> => {
      const list = await getLocalList('tavo_presets');
      const newId = preset.id || genId();
      list.push({ ...preset, id: newId });
      await setLocalList('tavo_presets', list);
      return newId;
    },
    update: async (preset: any): Promise<void> => {
      const list = await getLocalList('tavo_presets');
      const idx = list.findIndex((p: any) => String(p.id) === String(preset.id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...preset };
        await setLocalList('tavo_presets', list);
      }
    },
    delete: async (idOrObj: any): Promise<string | null> => {
      const id = typeof idOrObj === 'object' ? idOrObj.id : idOrObj;
      const list = await getLocalList('tavo_presets');
      const idx = list.findIndex((p: any) => String(p.id) === String(id));
      if (idx !== -1) {
        list.splice(idx, 1);
        await setLocalList('tavo_presets', list);
        return id;
      }
      return null;
    }
  },

  lorebook: {
    all: async (): Promise<{ id: string; name: string; entries: number }[]> => (await getLocalList('tavo_lorebooks')).map((p: any) => ({ id: p.id, name: p.name, entries: p.entries?.length || 0 })),
    get: async (id: any): Promise<any | null> => (await getLocalList('tavo_lorebooks')).find((p: any) => String(p.id) === String(id)) || null,
    find: async (name: string, options: any): Promise<any[]> => simpleSearch(await getLocalList('tavo_lorebooks'), name, options),
    import: async (lorebook: any): Promise<string | null> => {
      const c = window.confirm('Import this lorebook?');
      if (!c) return null;
      const list = await getLocalList('tavo_lorebooks');
      const newId = lorebook.id || genId();
      list.push({ ...lorebook, id: newId });
      await setLocalList('tavo_lorebooks', list);
      return newId;
    },
    create: async (lorebook: any): Promise<string> => {
      const list = await getLocalList('tavo_lorebooks');
      const newId = lorebook.id || genId();
      list.push({ ...lorebook, id: newId });
      await setLocalList('tavo_lorebooks', list);
      return newId;
    },
    update: async (lorebook: any): Promise<void> => {
      const list = await getLocalList('tavo_lorebooks');
      const idx = list.findIndex((p: any) => String(p.id) === String(lorebook.id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...lorebook };
        await setLocalList('tavo_lorebooks', list);
      }
    },
    delete: async (idOrObj: any): Promise<string | null> => {
      const id = typeof idOrObj === 'object' ? idOrObj.id : idOrObj;
      const list = await getLocalList('tavo_lorebooks');
      const idx = list.findIndex((p: any) => String(p.id) === String(id));
      if (idx !== -1) {
        list.splice(idx, 1);
        await setLocalList('tavo_lorebooks', list);
        return id;
      }
      return null;
    }
  },

  regex: {
    all: async (): Promise<{ id: string; name: string; entries: number }[]> => (await getLocalList('tavo_regex')).map((p: any) => ({ id: p.id, name: p.name, entries: p.entries?.length || 0 })),
    get: async (id: any): Promise<any | null> => (await getLocalList('tavo_regex')).find((p: any) => String(p.id) === String(id)) || null,
    find: async (name: string, options: any): Promise<any[]> => simpleSearch(await getLocalList('tavo_regex'), name, options),
    import: async (regex: any): Promise<string | null> => {
      const c = window.confirm('Import this regex group?');
      if (!c) return null;
      const list = await getLocalList('tavo_regex');
      const newId = regex.id || genId();
      list.push({ ...regex, id: newId, name: regex.name || 'Regex' });
      await setLocalList('tavo_regex', list);
      return newId;
    },
    create: async (regex: any): Promise<string> => {
      const list = await getLocalList('tavo_regex');
      const newId = regex.id || genId();
      list.push({ ...regex, id: newId, entries: regex.entries || [] });
      await setLocalList('tavo_regex', list);
      return newId;
    },
    update: async (regex: any): Promise<void> => {
      const list = await getLocalList('tavo_regex');
      const idx = list.findIndex((p: any) => String(p.id) === String(regex.id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...regex };
        await setLocalList('tavo_regex', list);
      }
    },
    delete: async (idOrObj: any): Promise<string | null> => {
      const id = typeof idOrObj === 'object' ? idOrObj.id : idOrObj;
      const list = await getLocalList('tavo_regex');
      const idx = list.findIndex((p: any) => String(p.id) === String(id));
      if (idx !== -1) {
        list.splice(idx, 1);
        await setLocalList('tavo_regex', list);
        return id;
      }
      return null;
    }
  },

  generate: async (prompt: string, options: any = {}): Promise<string> => {
    if (!tavoRegistry.generateText) {
      throw new Error("Generation API is not available in current context.");
    }
    return await tavoRegistry.generateText(prompt, options);
  },

  input: {
    get: async (): Promise<string> => tavoRegistry.getInputValue ? tavoRegistry.getInputValue() : '',
    set: (text: string): void => { if (tavoRegistry.setInputValue) tavoRegistry.setInputValue(text); },
    append: (text: string): void => { if (tavoRegistry.appendInputValue) tavoRegistry.appendInputValue(text); },
    clear: (): void => { if (tavoRegistry.clearInputValue) tavoRegistry.clearInputValue(); },
    send: (): void => { if (tavoRegistry.sendInput) tavoRegistry.sendInput(); },
  },

  utils: {
    toast: (msg: string): void => {
      console.log('TAVO TOAST:', msg);
      const el = document.createElement('div');
      el.textContent = msg;
      Object.assign(el.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.8)',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: '5px',
        zIndex: '9999',
        fontSize: '14px',
      });
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    },
    openUrl: (url: string): void => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    export: (name: string, data: string): void => {
      const content = data;
      let isBase64 = false;
      try {
        if (/^[A-Za-z0-9+/=]+$/.test(data)) {
           atob(data); // check valid base64
           isBase64 = true;
        }
      } catch (e) {
        // Ignored empty catch block
      }

      let url;
      if (isBase64) {
          const byteCharacters = atob(data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], {type: 'application/octet-stream'});
          url = URL.createObjectURL(blob);
      } else {
          const blob = new Blob([content], { type: 'text/plain' });
          url = URL.createObjectURL(blob);
      }
      
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    },
    select: async (options: (SelectOption | string)[], title?: string, defaultValue?: any): Promise<any> => {
      if (tavoRegistry.showSelect) {
        return await tavoRegistry.showSelect(options, title, defaultValue);
      }
      return new Promise((resolve) => {
        const dialog = document.createElement('dialog');
        dialog.className = "bg-slate-900 border border-slate-700 rounded-xl shadow-xl w-[90%] max-w-sm p-4 backdrop:bg-black/80 text-slate-200 outline-none";
        
        const h3 = document.createElement('h3');
        h3.className = "font-bold text-lg mb-4 text-center";
        h3.textContent = title || "Chọn một kết quả";
        dialog.appendChild(h3);

        const list = document.createElement('div');
        list.className = "flex flex-col gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar";
        
        options.forEach(opt => {
           const val = typeof opt === 'object' ? opt.value : opt;
           const lab = typeof opt === 'object' ? opt.label : opt;
           const isSel = val === defaultValue;
           const btn = document.createElement('button');
           btn.className = `w-full text-left px-4 py-3 rounded-lg flex items-center transition-colors ${isSel ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`;
           btn.innerHTML = `<span class="flex-1">${lab || val}</span> ${isSel ? `<span class="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">Default</span>` : ''}`;
           btn.onclick = () => {
              dialog.close();
              dialog.remove();
              resolve(val);
           };
           list.appendChild(btn);
        });
        
        dialog.appendChild(list);

        const closeBtn = document.createElement('button');
        closeBtn.className = "mt-4 w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 text-sm font-medium transition-colors";
        closeBtn.textContent = "Hủy bỏ";
        closeBtn.onclick = () => {
           dialog.close();
           dialog.remove();
           resolve(null);
         };
         dialog.appendChild(closeBtn);

         document.body.appendChild(dialog);
         dialog.showModal();
       });
     }
   }
};

if (typeof window !== 'undefined') {
  (window as any).tavo = tavoApi;
}
