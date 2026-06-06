import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Sparkles, Plus, Trash2, Edit2, Play, 
  User, Compass, Users, Upload, Download, Clock,
  Eye, EyeOff, SlidersHorizontal, Globe2, Database,
  BookOpen, Search, X, ChevronDown, ChevronUp, Check
} from 'lucide-react';
import { NavigationProps, GameState, WorldData, AppSettings, PlayerProfile, WorldSettingConfig } from '../../../types';
import { toast } from 'sonner';
import Button from '../../ui/Button';
import MarkdownRenderer from '../../common/MarkdownRenderer';
import { useWorldCreationStore } from '../../../store/worldCreationStore';
import EntityForm from './EntityForm';
import { CharacterSheetEditor } from './CharacterSheetEditor';
import { worldAiService } from '../../../services/ai/world-creation/service';
import { dbService } from '../../../services/db/indexedDB';
import { OUTPUT_LENGTHS, DIFFICULTY_LEVELS } from '../../../constants/promptTemplates';

const TABS = [
  { id: 1, label: "Tạo dựng Thế giới", icon: Compass },
  { id: 0, label: "Nhân vật chính", icon: User },
  { id: 3, label: "Encyclopedia Manager", icon: Users },
  { id: 6, label: "Hồ sơ World Bible", icon: BookOpen },
];

interface WorldCreationProps extends NavigationProps {
  initialData?: WorldData | null;
}

const WorldCreationScreen: React.FC<WorldCreationProps> = ({ onNavigate, onGameStart, initialData }) => {
  const store = useWorldCreationStore();
  
  // Destructure state from store for convenience
  const state = {
    currentTab: store.currentTab,
    player: store.player,
    world: store.world,
    config: store.config,
    entities: Array.isArray(store.entities) ? store.entities : [],
    gameTime: store.gameTime,
    lorebook: store.lorebook,
    isGenerating: store.isGenerating,
    generatingField: store.generatingField
  };

  const [showEntityForm, setShowEntityForm] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [conceptInput, setConceptInput] = useState('');
  const [aiModel, setAiModel] = useState<string>('gemini-3.1-pro-preview');
  
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  const [knowledgeFileName, setKnowledgeFileName] = useState<string | null>(null);
  const [knowledgeFileSize, setKnowledgeFileSize] = useState<string | null>(null);
  const [knowledgeContent, setKnowledgeContent] = useState<string | null>(null);
  const [isGeneratingFromKnowledge, setIsGeneratingFromKnowledge] = useState<boolean>(false);

  // Accordion state for world configuration
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    timeline: false,
    rules: false,
    aiRules: false,
    style: false,
    geography: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // --- Dynamic World Bible Compiler ---
  // Periodically combines all 20 world setup fields into state.world.context
  useEffect(() => {
    const w = state.world;
    const parts: string[] = [];
    
    if (w.worldName) {
        parts.push(`# THẾ GIỚI: ${w.worldName.toUpperCase()}`);
        if (w.genre) {
            parts.push(`- **Thể loại**: ${w.genre}`);
        }
        if (w.mainTone) {
            parts.push(`- **Tông màu & Không khí chính**: ${w.mainTone}`);
        }
    }
    
    if (w.setting) parts.push(`## 📌 BỐI CẢNH CHUNG\n${w.setting}`);
    if (w.openingTimeline) parts.push(`## ⏳ MỐC THỜI GIAN MỞ ĐẦU\n${w.openingTimeline}`);
    if (w.startingScenario) parts.push(`## 🎬 KỊCH BẢN MỞ ĐẦU\n${w.startingScenario}`);
    if (w.worldRules) parts.push(`## ⚖️ QUY LUẬT CỦA THẾ GIỚI\n${w.worldRules}`);
    if (w.pacing) parts.push(`## 🏎️ NHỊP ĐỘ TRUYỆN\n${w.pacing}`);
    if (w.geography) parts.push(`## 🗺️ ĐỊA LÝ & PHONG THỔ\n${w.geography}`);
    if (w.history || w.timeline) parts.push(`## 📖 LỊCH SỬ THẾ GIỚI\n${w.history || w.timeline}`);
    if (w.culture || w.culturalIdentity) parts.push(`## 🎭 VĂN HÓA & PHONG TỤC\n${w.culture || w.culturalIdentity}`);
    if (w.economySociety || w.economyResources) parts.push(`## 🪙 KINH TẾ & XÃ HỘI\n${w.economySociety || w.economyResources}`);
    if (w.religionBeliefs) parts.push(`## ⛪ TÔN GIÁO & TÍN NGƯỠNG\n${w.religionBeliefs}`);
    if (w.factionsPower) parts.push(`## 🛡️ THẾ LỰC & PHE PHÁI\n${w.factionsPower}`);
    if (w.worldFeatures) parts.push(`## 🌟 ĐẶC ĐIỂM THẾ GIỚI\n${w.worldFeatures}`);
    if (w.logicControl) parts.push(`## ⚙️ KIỂM SOÁT LOGIC & KHỬ LOẠI TRỪ\n${w.logicControl}`);
    if (w.writingStyle) parts.push(`## ✒️ VĂN PHONG SÁNG TÁC\n${w.writingStyle}`);
    
    if (w.narratorPov) {
        parts.push(`## 🗣️ NGÔI KỂ\nHãy kể truyện ở: ${w.narratorPov}`);
    }
    
    const compiled = parts.join('\n\n');
    
    if (compiled && compiled !== state.world.context) {
        store.updateWorld('context', compiled);
    }
  }, [
    state.world.worldName,
    state.world.genre,
    state.world.mainTone,
    state.world.setting,
    state.world.openingTimeline,
    state.world.startingScenario,
    state.world.worldRules,
    state.world.pacing,
    state.world.geography,
    state.world.history,
    state.world.timeline,
    state.world.culture,
    state.world.culturalIdentity,
    state.world.economySociety,
    state.world.economyResources,
    state.world.religionBeliefs,
    state.world.factionsPower,
    state.world.worldFeatures,
    state.world.logicControl,
    state.world.writingStyle,
    state.world.narratorPov
  ]);

  // --- Bidirectional Entity & Encyclopedia (Lorebook) Synchronizer ---
  useEffect(() => {
    const currentEntities = state.entities || [];
    const currentLorebook = state.lorebook || { entries: {} };
    const currentEntries = currentLorebook.entries || {};

    let lorebookChanged = false;
    let entitiesChanged = false;

    const nextEntries = { ...currentEntries };
    const nextEntities = [...currentEntities];

    // 1. Sync forward: Entities -> Lorebook Entries
    currentEntities.forEach((entity) => {
      const entryId = entity.id;
      const existingEntry = currentEntries[entryId];

      const content = entity.type === 'NPC'
        ? `Họ Tên: ${entity.name}\nTuổi: ${entity.age || 'Chưa rõ'}\nGiới tính: ${entity.gender || 'Chưa rõ'}\nTính cách: ${entity.personality || 'Chưa rõ'}\nNgoại hình: ${entity.appearance || 'Chưa rõ'}\nTiểu sử: ${entity.description || entity.background || 'Chưa rõ'}`
        : entity.description;

      const expectedComment = `[Entity:${entity.type}] ${entity.name}`;
      const expectedKeys = [entity.name];

      if (!existingEntry) {
        nextEntries[entryId] = {
          uid: entryId,
          key: expectedKeys,
          content: content,
          comment: expectedComment,
          constant: false,
          disable: false,
          order: entity.type === 'NPC' ? 50 : 100,
        };
        lorebookChanged = true;
      } else {
        const hasKeyDiff = JSON.stringify(existingEntry.key) !== JSON.stringify(expectedKeys);
        const hasCommentDiff = existingEntry.comment !== expectedComment;
        const hasContentDiff = existingEntry.content !== content;

        if (hasKeyDiff || hasCommentDiff || hasContentDiff) {
          nextEntries[entryId] = {
            ...existingEntry,
            key: expectedKeys,
            comment: expectedComment,
            content: content,
          };
          lorebookChanged = true;
        }
      }
    });

    // 2. Sync backward: Lorebook Entries -> Entities (Encyclopedia) - ONLY if entities list is currently empty (e.g. initial import of SillyTavern card)
    if (currentEntities.length === 0 && Object.keys(currentEntries).length > 0) {
      Object.entries(currentEntries).forEach(([uid, entry]: [string, any]) => {
        // Check if there is an entity with matching ID or name to prevent duplicates
        const exists = currentEntities.some(e => 
          e.id === uid || 
          e.name.toLowerCase() === (entry.comment || entry.name || "").toLowerCase() ||
          (entry.comment && entry.comment.startsWith("[Entity:") && entry.comment.includes(e.name))
        );

        if (!exists) {
          let entityType: import("../../types").EntityType = "CUSTOM";
          let entityName = entry.comment || entry.name || (Array.isArray(entry.key) ? entry.key[0] : entry.key) || "Chưa rõ";

          if (entry.comment && entry.comment.startsWith("[Entity:")) {
            const match = entry.comment.match(/^\[Entity:(NPC|LOCATION|ITEM|FACTION|CUSTOM)\]\s*(.*)$/);
            if (match) {
              entityType = match[1] as import("../../types").EntityType;
              entityName = match[2];
            }
          } else {
            const commentLower = (entry.comment || entry.name || "").toLowerCase();
            if (commentLower.includes("npc") || commentLower.includes("nhân vật") || commentLower.includes("char")) {
              entityType = "NPC";
            } else if (commentLower.includes("location") || commentLower.includes("địa điểm") || commentLower.includes("nơi") || commentLower.includes("thành")) {
              entityType = "LOCATION";
            } else if (commentLower.includes("item") || commentLower.includes("vật phẩm") || commentLower.includes("đồ") || commentLower.includes("vũ khí")) {
              entityType = "ITEM";
            } else if (commentLower.includes("faction") || commentLower.includes("phe phái") || commentLower.includes("bang") || commentLower.includes("hội")) {
              entityType = "FACTION";
            }
          }

          let personality = "";
          let background = entry.content || "";
          let appearance = "";
          let age = "";
          let gender = "";

          if (entityType === "NPC") {
            const lines = (entry.content || "").split("\n");
            lines.forEach((line: string) => {
              if (line.startsWith("Tuổi:")) age = line.replace("Tuổi:", "").trim();
              else if (line.startsWith("Giới tính:")) gender = line.replace("Giới tính:", "").trim();
              else if (line.startsWith("Tính cách:")) personality = line.replace("Tính cách:", "").trim();
              else if (line.startsWith("Ngoại hình:")) appearance = line.replace("Ngoại hình:", "").trim();
              else if (line.startsWith("Tiểu sử:")) background = line.replace("Tiểu sử:", "").trim();
            });
          }

          nextEntities.push({
            id: uid,
            type: entityType,
            name: entityName,
            description: entry.content || "",
            personality: personality || undefined,
            background: background || entry.content || "",
            appearance: appearance || undefined,
            age: age || undefined,
            gender: gender || undefined
          });
          entitiesChanged = true;
        }
      });
    }

    if (entitiesChanged) {
      store.setEntities(nextEntities);
    }

    if (lorebookChanged) {
      store.updateLorebook({ ...currentLorebook, entries: nextEntries });
    }
  }, [state.entities, state.lorebook]);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Initial Load (Settings, Import Data)
  useEffect(() => {
    if (!initialData && !store.player.name && !store.world.worldName) {
      store.reset(); 
    }
    dbService.getSettings().then(s => {
      setSettings(s);
      if (s.aiModel) setAiModel(s.aiModel);
      
      // Force initial tab load to WorldSetup (Compass tab is id 1)
      store.setTab(1);
    });

    if (initialData) {
       store.importData(initialData);
    }
  }, [initialData]);

  const handleAiGenerate = async (field: string, category: 'world' | 'player') => {
    store.setGenerating(true, field);
    try {
      const contextData = {
        name: state.player.name || "Nhân vật",
        gender: state.player.gender || "Nam",
        age: state.player.age || "21",
        worldName: state.world.worldName || "Thế giới mới",
        genre: state.world.genre || "Huyền huyễn"
      };

      let currentValue = "";
      if (category === 'player') {
          currentValue = (state.player as any)[field] || "";
      } else {
          currentValue = (state.world as any)[field] || "";
      }

      const content = await worldAiService.generateFieldContent(category, field, contextData, aiModel, currentValue, settings || undefined);
      
      if (category === 'player') {
        store.updatePlayer(field as keyof PlayerProfile, content);
      } else {
        store.updateWorld(field as keyof WorldSettingConfig, content);
      }
    } catch (error) {
      console.error("AI Error", error);
    } finally {
      store.setGenerating(false);
    }
  };

  const handleAutoFillAll = async () => {
    if (!conceptInput.trim()) return;
    store.setGenerating(true);
    try {
      let customSchema: any = undefined;
      const schemaId = state.player.customSchemaId;
      if (schemaId && schemaId !== 'none') {
        const saved = dbService.getKeyValueSync('tawa_custom_schemas_v2');
        let templates: any[] = [];
        if (saved) {
          try {
            templates = typeof saved === "string" ? JSON.parse(saved) : saved;
          } catch(e) {}
        }
        if (!templates.length) {
          templates = [
            {
                id: 'rpg-kiem-hiep',
                name: 'RPG Kiếm Hiệp/Tu Tiên',
                fields: [
                    { id: 'tu_vi', label: 'Cấp độ Tu Vi / Cảnh Giới', type: 'select', options: ['Phàm Nhân', 'Luyện Khí Kỳ', 'Trúc Cơ Kỳ', 'Kim Đan Kỳ', 'Nguyên Anh Kỳ', 'Hóa Thần Kỳ', 'Thượng Cảnh'] },
                    { id: 'mon_phai', label: 'Môn Phái / Thế Lực', type: 'text' },
                    { id: 'linh_can', label: 'Linh Căn Nguyên Tố', type: 'text' }
                ]
            },
            {
                id: 'rpg-fantasy-status',
                name: 'RPG Fantasy Bản Thần Thoại',
                fields: [
                    { id: 'job_class', label: 'Lớp Nhân Vật (Class)', type: 'select', options: ['Đấu Sĩ', 'Pháp Sư', 'Sát Thủ', 'Trị Liệu', 'Cung Thủ'] },
                    { id: 'stats_primary', label: 'Chỉ Số Chiến Lực', type: 'text' }
                ]
            }
          ];
        }
        customSchema = templates.find(t => t.id === schemaId);
      }

      const gData = await worldAiService.generateFullWorld(conceptInput, aiModel, settings || undefined, undefined, customSchema);
      store.autoFillAll(gData);
    } finally {
      store.setGenerating(false);
    }
  };

  const handleKnowledgeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setKnowledgeFileName(file.name);
    const sizeInKb = file.size / 1024;
    const formattedSize = sizeInKb > 1024 
      ? `${(sizeInKb / 1024).toFixed(1)} MB` 
      : `${sizeInKb.toFixed(1)} KB`;
    setKnowledgeFileSize(formattedSize);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setKnowledgeContent(text);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleClearKnowledge = () => {
    setKnowledgeFileName(null);
    setKnowledgeFileSize(null);
    setKnowledgeContent(null);
  };

  const handleWorldGenFromKnowledge = async () => {
    if (!knowledgeContent?.trim()) return;
    setIsGeneratingFromKnowledge(true);
    store.setGenerating(true);
    try {
      const promptText = `DỰA TRÊN TÀI LIỆU TRI THỨC SAU:\n\n${knowledgeContent}\n\nHãy tạo ra một thế giới đầy đủ cốt truyện và nhân vật chính hoàn toàn khớp với chi tiết tài liệu trên.`;
      
      let customSchema: any = undefined;
      const schemaId = state.player.customSchemaId;
      if (schemaId && schemaId !== 'none') {
        const saved = dbService.getKeyValueSync('tawa_custom_schemas_v2');
        let templates: any[] = [];
        if (saved) {
          try {
            templates = typeof saved === "string" ? JSON.parse(saved) : saved;
          } catch(e) {}
        }
        if (!templates.length) {
          templates = [
            {
                id: 'rpg-kiem-hiep',
                name: 'RPG Kiếm Hiệp/Tu Tiên',
                fields: [
                    { id: 'tu_vi', label: 'Cấp độ Tu Vi / Cảnh Giới', type: 'select', options: ['Phàm Nhân', 'Luyện Khí Kỳ', 'Trúc Cơ Kỳ', 'Kim Đan Kỳ', 'Nguyên Anh Kỳ', 'Hóa Thần Kỳ', 'Thượng Cảnh'] },
                    { id: 'mon_phai', label: 'Môn Phái / Thế Lực', type: 'text' },
                    { id: 'linh_can', label: 'Linh Căn Nguyên Tố', type: 'text' }
                ]
            },
            {
                id: 'rpg-fantasy-status',
                name: 'RPG Fantasy Bản Thần Thoại',
                fields: [
                    { id: 'job_class', label: 'Lớp Nhân Vật (Class)', type: 'select', options: ['Đấu Sĩ', 'Pháp Sư', 'Sát Thủ', 'Trị Liệu', 'Cung Thủ'] },
                    { id: 'stats_primary', label: 'Chỉ Số Chiến Lực', type: 'text' }
                ]
            }
          ];
        }
        customSchema = templates.find(t => t.id === schemaId);
      }

      const gData = await worldAiService.generateFullWorld(promptText, aiModel, settings || undefined, undefined, customSchema);
      store.autoFillAll(gData);
    } catch (error) {
      console.error("Knowledge world generation failed", error);
    } finally {
      setIsGeneratingFromKnowledge(false);
      store.setGenerating(false);
    }
  };

  // --- Import / Export Logic ---
  const handleExportWorld = () => {
    if (!settings) return;

    const exportData: WorldData = {
        player: state.player,
        world: state.world,
        config: {
            ...state.config,
            difficulty: settings.difficulty,
            outputLength: settings.outputLength,
            perspective: settings.perspective,
            customMinWords: settings.customMinWords,
            customMaxWords: settings.customMaxWords
        },
        entities: state.entities,
        gameTime: state.gameTime,
        lorebook: state.lorebook
    };
    
    const worldNameSuffix = state.world.worldName.replace(/\s+/g, '_') || 'world_save';
    const timestamp = Date.now();
    const fileName = `ARK_${worldNameSuffix}_${timestamp}.json`;
    
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.href = url;
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content) as WorldData;
        
        if (!parsedData.player || !parsedData.world) {
            throw new Error("Cấu trúc file không hợp lệ");
        }

        store.importData(parsedData);
      } catch (error) {
        console.error(error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // --- Start Game Logic ---
  const handleStartGame = async () => {
     if (!settings) return;

     const worldData: WorldData = {
        id: initialData?.id || `campaign-${crypto.randomUUID()}`,
        player: state.player,
        world: state.world,
        config: {
            ...state.config,
            difficulty: settings.difficulty,
            outputLength: settings.outputLength,
            perspective: settings.perspective,
            customMinWords: settings.customMinWords,
            customMaxWords: settings.customMaxWords
        },
        entities: state.entities,
        gameTime: state.gameTime,
        lorebook: state.lorebook,
        lsrTableDefinitions: store.lsrTableDefinitions,
        savedState: { history: [], turnCount: 0 }
     };
     
     if (!worldData.player.name || !worldData.world.worldName) {
          return;
     }

     const saveId = `autosave-${Date.now()}`;
     try {
          await dbService.saveAutosave({
              id: saveId,
              name: `${worldData.world.saveName || worldData.world.worldName} (${settings.difficulty.label})`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              data: worldData
          });
     } catch (err) {
          console.error("Autosave failed", err);
     }

     worldData.activeSaveId = saveId;

     if (onGameStart) {
          onGameStart(worldData);
     }
  };

  // --- RENDER FUNCTIONS FOR TABS ---

  const renderPlayerTab = () => (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-2 mb-2">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <User size={15} className="text-mystic-accent" />
          <span>👤 Thẻ Thiết lập Nhân Vật Chính (Main Character)</span>
        </h3>
      </div>
      <CharacterSheetEditor 
         data={state.player} 
         onChange={(field, value) => store.updatePlayer(field as any, value)} 
      />
    </div>
  );

  const renderWorldSetupTab = () => {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
        <div className="border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-3 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Compass size={15} className="text-mystic-accent" />
            <span>🌍 Tạo lập Thế giới (20 Trường Thuộc tính & Cầm nang)</span>
          </h3>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Lớp Thế giới quan</span>
        </div>

        {/* 1. THÔNG TIN THẾ GIỚI CHUNG */}
        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-5 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-4">
          <button 
            type="button" 
            onClick={() => toggleSection('basic')}
            className="flex items-center justify-between w-full text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide cursor-pointer text-left"
          >
            <span className="flex items-center gap-2">🌟 1. Thông tin thế giới chung</span>
            {expandedSections.basic ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {expandedSections.basic && (
            <div className="space-y-4 pt-2 border-t border-[#cbd2df]/15 dark:border-[#142042]/5 transition-all">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup 
                  label="Tên thế giới" 
                  value={state.world.worldName} 
                  onChange={(v) => store.updateWorld('worldName', v)} 
                  onAi={() => handleAiGenerate('worldName', 'world')}
                  loading={state.isGenerating && state.generatingField === 'worldName'}
                  placeholder="Ví dụ: Đại Việt Cổ Nhạc, Vực Thẳm Vô Tận..."
                />
                <InputGroup 
                  label="Tên Save File" 
                  value={state.world.saveName || ''} 
                  onChange={(v) => store.updateWorld('saveName', v)} 
                  placeholder="Ví dụ: Lần 1 Thám hiểm, Hardcore Thử thách..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup 
                  label="Thể loại (Genre)" 
                  value={state.world.genre} 
                  onChange={(v) => store.updateWorld('genre', v)} 
                  onAi={() => handleAiGenerate('genre', 'world')}
                  loading={state.isGenerating && state.generatingField === 'genre'}
                  placeholder="Ví dụ: Tiên Hiệp Ma pháp, Kỳ Ảo Đông Phương, Đô thị tu chân..."
                />
                <InputGroup 
                  label="Tông màu / Không khí chính" 
                  value={state.world.mainTone || ''} 
                  onChange={(v) => store.updateWorld('mainTone', v)} 
                  placeholder="Ví dụ: U tối, Hùng vĩ, Trinh thám hồi hộp, Kỳ bí..."
                />
              </div>

              {/* ONLY TWO DIFFICULTY OPTIONS */}
              <div className="p-4.5 bg-slate-100/30 dark:bg-slate-900/40 rounded-xl space-y-3.5">
                <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal size={13} className="text-mystic-accent" />
                  <span>Độ Khó Trải Nghiệm (Chỉ gồm 2 tùy chọn)</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      id: 'normal',
                      label: '1. Bình thường (Normal)',
                      desc: 'Xảy ra cân bằng hợp lý, tử vong có cơ hội hồi phục, không mất file save.',
                      color: 'bg-sky-500/10 text-sky-650 hover:bg-sky-500/15 border-sky-500/20'
                    },
                    {
                      id: 'torment',
                      label: '2. Hardcore (Xóa Save bĩnh viễn)',
                      desc: 'Chính xác sinh tử chi mệnh. Nếu nhân vật bị chết, save sẽ bị xóa bỏ lập tức.',
                      color: 'bg-red-500/10 text-red-650 hover:bg-red-500/15 border-red-500/20'
                    }
                  ].map((diffObj) => {
                    const isSelected = settings?.difficulty?.id === diffObj.id;
                    const fullDiffTemplate = DIFFICULTY_LEVELS.find(dl => dl.id === diffObj.id) || DIFFICULTY_LEVELS[1];
                    
                    return (
                      <button
                        key={diffObj.id}
                        type="button"
                        onClick={() => {
                          if (!settings) return;
                          const newSettings = { ...settings, difficulty: fullDiffTemplate };
                          setSettings(newSettings);
                          dbService.saveSettings(newSettings);
                        }}
                        className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-200 h-28 ${
                          isSelected 
                            ? 'bg-transparent border-mystic-accent text-mystic-accent font-extrabold shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042]'
                            : 'bg-transparent border-transparent text-slate-700 dark:text-slate-350 shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-xs">
                          {isSelected ? (
                            <span className="p-0.5 rounded-full bg-mystic-accent/15 text-mystic-accent">
                              <Check size={11} strokeWidth={3} />
                            </span>
                          ) : (
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-350" />
                          )}
                          <span className="font-extrabold uppercase tracking-wide text-[10.5px]">{diffObj.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-1">{diffObj.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. MỐC SỰ KIỆN KHỞI HÀNH */}
        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-5 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-4">
          <button 
            type="button" 
            onClick={() => toggleSection('timeline')}
            className="flex items-center justify-between w-full text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide cursor-pointer text-left"
          >
            <span className="flex items-center gap-2">⏳ 2. Mốc thời gian & Kịch bản khởi hành</span>
            {expandedSections.timeline ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {expandedSections.timeline && (
            <div className="space-y-4 pt-2 border-t border-[#cbd2df]/15 dark:border-[#142042]/5 transition-all">
              <TextAreaGroup 
                label="BỐI CẢNH thế giới" 
                value={state.world.setting || ''} 
                onChange={(v) => store.updateWorld('setting', v)} 
                onAi={() => handleAiGenerate('setting', 'world')}
                loading={state.isGenerating && state.generatingField === 'setting'}
                placeholder="Mô tả bối cảnh thế giới chung, câu chuyện khởi lập..."
              />
              <InputGroup 
                label="MỐC THỜI GIAN MỞ ĐẦU" 
                value={state.world.openingTimeline || ''} 
                onChange={(v) => store.updateWorld('openingTimeline', v)} 
                placeholder="Ví dụ: Niên ký Đại Việt năm thứ sáu mươi mốt..."
              />
              <TextAreaGroup 
                label="K KỊCH BẢN MỞ ĐẦU" 
                value={state.world.startingScenario || ''} 
                onChange={(v) => store.updateWorld('startingScenario', v)} 
                onAi={() => handleAiGenerate('startingScenario', 'world')}
                loading={state.isGenerating && state.generatingField === 'startingScenario'}
                placeholder="Ví dụ: Bạn từ từ hé mắt, chỉ thấy xung quanh rậm rạp tàn tro hoang phế..."
              />
            </div>
          )}
        </div>

        {/* 3. QUY LUẬT & ĐẶC ĐIỂM */}
        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-5 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-4">
          <button 
            type="button" 
            onClick={() => toggleSection('rules')}
            className="flex items-center justify-between w-full text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide cursor-pointer text-left"
          >
            <span className="flex items-center gap-2">🔮 3. Quy luật & Kiểm soát trí lôi (Cosmology)</span>
            {expandedSections.rules ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {expandedSections.rules && (
            <div className="space-y-4 pt-2 border-t border-[#cbd2df]/15 dark:border-[#142042]/5 transition-all">
              <TextAreaGroup 
                label="QUY LUẬT Thế giới" 
                value={state.world.worldRules || ''} 
                onChange={(v) => store.updateWorld('worldRules', v)} 
                onAi={() => handleAiGenerate('worldRules', 'world')}
                loading={state.isGenerating && state.generatingField === 'worldRules'}
                placeholder="Ví dụ: Linh khí có độc, phàm nhân chạm vào lập tức bị dị biến..."
              />
              <TextAreaGroup 
                label="Đặc điểm thế giới" 
                value={state.world.worldFeatures || ''} 
                onChange={(v) => store.updateWorld('worldFeatures', v)} 
                placeholder="Ví dụ: Thế giới không có trọng lực chuẩn, lơ lửng các khối phù đảo di động..."
              />
              <TextAreaGroup 
                label="KIỂM SOÁT LOGIC & CÁC YẾU TỐ LOẠI TRỪ" 
                value={state.world.logicControl || ''} 
                onChange={(v) => store.updateWorld('logicControl', v)} 
                placeholder="Nghiêm cấm phép dịch chuyển tức thời, không hồi sinh người chết..."
              />
            </div>
          )}
        </div>

        {/* 3.5. LUẬT AI TỐI CAO (ADVANCED AI RULES) */}
        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-5 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-4 text-left">
          <button 
            type="button" 
            onClick={() => toggleSection('aiRules')}
            className="flex items-center justify-between w-full text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide cursor-pointer text-left"
          >
            <span className="flex items-center gap-2">🤖 3.5. Thiết Lập Luật AI Tối Cao (World AI Rules)</span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-[9px] font-black uppercase bg-purple-500/15 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/25 shrink-0">
                {(state.config.rules || []).filter((r: string) => r && !r.startsWith("//")).length} hoạt lực
              </span>
              {expandedSections.aiRules ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </span>
          </button>

          {expandedSections.aiRules && (
            <div className="space-y-4 pt-2 border-t border-[#cbd2df]/15 dark:border-[#142042]/5 transition-all">
              <div className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-semibold bg-purple-500/5 p-4 rounded-xl border border-purple-500/10 mb-2">
                📌 <strong>Kịch Bản Luật Lệ Tối Cao (Rule System)</strong>: Ràng buộc trực hệ chỉ thị cưỡng chế vào nền tảng tư duy bối cảnh của LLM. AI bắt buộc phải tuyệt đối tôn trọng các chế tài vận hành được thiết chế tại đây trong quá trình chơi (ví dụ: cạn kiệt linh lực kông dùng phép thuật hack game, hao mòn tài năng thực tế).
              </div>

              {/* Display list of current active rules */}
              {(!state.config.rules || state.config.rules.length === 0) ? (
                <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 font-bold italic bg-slate-100/50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-250 dark:border-slate-800">
                  Chưa thiết lập Luật AI nào cho bối cảnh này. Vui lòng bấm tự động trích xuất hoặc thêm thủ công bên dưới.
                </div>
              ) : (
                <div className="space-y-3">
                  {state.config.rules.map((rule: string, rIdx: number) => (
                    <div 
                      key={rIdx} 
                      className="flex items-start gap-3 bg-white dark:bg-[#02050c]/60 p-3 rounded-xl border border-[#cbd2df]/40 dark:border-[#142042]/30 shadow-sm"
                    >
                      <div className="bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-mono font-bold p-1 px-2 rounded-lg shrink-0 mt-1">
                        #{rIdx + 1}
                      </div>
                      <textarea
                        value={rule}
                        onChange={(e) => {
                          const nextRules = [...state.config.rules];
                          nextRules[rIdx] = e.target.value;
                          store.updateConfig('rules', nextRules);
                        }}
                        className="flex-1 bg-transparent border-0 p-0 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:ring-0 resize-none h-14 focus:outline-none"
                        placeholder="Nội dung điều luật..."
                      />
                      <button
                        type="button"
                        onClick={() => store.removeRule(rIdx)}
                        className="text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-all shrink-0 mt-1 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add manual rule input and auto-extraction controls */}
              <div className="flex flex-col gap-3 pt-3 border-t border-slate-200 dark:border-slate-800/40">
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="new_wc_rule_input"
                    placeholder="Nhập nội dung quy luật cưỡng chế AI mới thủ công..."
                    className="flex-1 bg-slate-50 dark:bg-[#02050c] border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-150 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const target = e.currentTarget;
                        if (target.value.trim()) {
                          store.addRule(target.value.trim());
                          target.value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('new_wc_rule_input') as HTMLInputElement;
                      if (input && input.value.trim()) {
                        store.addRule(input.value.trim());
                        input.value = '';
                      }
                    }}
                    className="text-xs font-bold py-2 px-4 bg-purple-600 hover:bg-purple-700 hover:shadow-md transition-all text-white rounded-xl shrink-0 cursor-pointer"
                  >
                    Thêm luật
                  </Button>
                </div>

                <div className="flex flex-wrap md:flex-nowrap gap-2 justify-between items-center text-xs pt-1">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold text-left">
                    {knowledgeContent ? "💡 Phát hiện tài liệu Tri thức đang nạp, sẵn sàng trích xuất Luật AI gốc." : "💡 Tự động phân tích các trường bối cảnh hiện có để hình thành Luật AI."}
                  </span>
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.json';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              try {
                                const parsed = JSON.parse(event.target?.result as string);
                                if (Array.isArray(parsed)) {
                                  store.updateConfig('rules', parsed);
                                  toast.success(`Đã nạp thành công ${parsed.length} Quy Luật AI từ tệp Preset!`);
                                } else if (parsed && Array.isArray(parsed.rules)) {
                                  store.updateConfig('rules', parsed.rules);
                                  toast.success(`Đã nạp thành công ${parsed.rules.length} Quy Luật AI từ tệp Preset!`);
                                } else {
                                  toast.error("Tệp JSON không định dạng đúng. Phải là mảng hoặc có trường 'rules'.");
                                }
                              } catch (err) {
                                toast.error("Lỗi phân tích tệp JSON quy luật.");
                              }
                            };
                            reader.readAsText(file);
                          }
                        };
                        input.click();
                      }}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-all cursor-pointer shrink-0"
                    >
                      <span>📥 Nạp Quy Luật (.json)</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        store.setGenerating(true, 'aiRulesExtract');
                        try {
                          const compiledCtx = state.world.context || "";
                          const extracted = await worldAiService.extractRulesFromKnowledge(
                            knowledgeContent || "",
                            compiledCtx,
                            aiModel,
                            settings || undefined
                          );
                          if (extracted && extracted.length > 0) {
                            store.updateConfig('rules', extracted);
                            toast.success(`Đã tự động đúc rút ${extracted.length} Luật AI tối cao thành công!`);
                          } else {
                            toast.error("Không trích xuất được điều luật nào hợp lệ. Thử lại sau!");
                          }
                        } catch (err: any) {
                          toast.error("Thất bại khi rút luật AI: " + err.message);
                        } finally {
                          store.setGenerating(false);
                        }
                      }}
                      disabled={state.isGenerating}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                      <span>{state.isGenerating && state.generatingField === 'aiRulesExtract' ? "Đang trích xuất..." : "✨ Trích xuất Luật AI"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. VĂN PHONG SÁNG TÁC */}
        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-5 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-4">
          <button 
            type="button" 
            onClick={() => toggleSection('style')}
            className="flex items-center justify-between w-full text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide cursor-pointer text-left"
          >
            <span className="flex items-center gap-2">✒️ 4. Văn phong & Trình kể diện rộng</span>
            {expandedSections.style ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {expandedSections.style && (
            <div className="space-y-4 pt-2 border-t border-[#cbd2df]/15 dark:border-[#142042]/5 transition-all">
              <InputGroup 
                label="NHỊP ĐỘ (Pacing)" 
                value={state.world.pacing || ''} 
                onChange={(v) => store.updateWorld('pacing', v)} 
                placeholder="Ví dụ: Chậm rãi mô tả chi tiết, Kịch tính dồn dập..."
              />
              <TextAreaGroup 
                label="VĂN PHONG" 
                value={state.world.writingStyle || ''} 
                onChange={(v) => store.updateWorld('writingStyle', v)} 
                placeholder="Ví dụ: Kiểu tiểu thuyết cổ trang, giàu hình ảnh ước lệ tả thực tinh nhã..."
              />
              <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-xl shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-205">NGÔI KỂ (Narrator PoV)</label>
                <select
                  value={state.world.narratorPov || 'Ngôi thứ ba (Mô tả khách quan, rộng mở)'}
                  onChange={(e) => store.updateWorld('narratorPov', e.target.value)}
                  className="w-full bg-transparent border-none text-slate-905 dark:text-slate-100 outline-none text-xs font-bold focus:ring-0"
                >
                  <option value="Ngôi thứ ba (Mô tả khách quan, rộng mở)" className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-800">Ngôi thứ ba (Hắn, Y, Nàng, Tên nhân vật)</option>
                  <option value="Ngôi thứ nhất (Trực diện góc nhìn cá nhân)" className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-800">Ngôi thứ nhất (Tôi, Ta, Bản ma tông)</option>
                  <option value="Ngôi thứ hai (Dẫn dụ độc giả tương tác)" className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-800">Ngôi thứ hai (Bạn, Ngài)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* 5. ĐỊA LÝ & XÃ HỘI */}
        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-5 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-4">
          <button 
            type="button" 
            onClick={() => toggleSection('geography')}
            className="flex items-center justify-between w-full text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide cursor-pointer text-left"
          >
            <span className="flex items-center gap-2">🗺️ 5. Địa lý, Lịch sử, Kinh tế & Văn hóa</span>
            {expandedSections.geography ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {expandedSections.geography && (
            <div className="space-y-4 pt-2 border-t border-[#cbd2df]/15 dark:border-[#142042]/5 transition-all">
              <TextAreaGroup 
                label="ĐỊA LÝ thế giới" 
                value={state.world.geography || ''} 
                onChange={(v) => store.updateWorld('geography', v)} 
                onAi={() => handleAiGenerate('geography', 'world')}
                loading={state.isGenerating && state.generatingField === 'geography'}
                placeholder="Các châu lục, tùng lâm bí hiểm, khí hậu hoang mạc hoang sơ..."
              />
              <TextAreaGroup 
                label="LỊCH SỬ THẾ GIỚI" 
                value={state.world.history || ''} 
                onChange={(v) => store.updateWorld('history', v)} 
                placeholder="Lịch kỳ các thiên niên kỷ trước, sự sụp đổ của các triều đại di sản..."
              />
              <TextAreaGroup 
                label="VĂN HÓA thế giới" 
                value={state.world.culture || ''} 
                onChange={(v) => store.updateWorld('culture', v)} 
                placeholder="Phong tục dân cư tiên bản địa, các lễ hội hoặc lệnh nghiêm cấm cấm kỵ..."
              />
              <TextAreaGroup 
                label="KINH TẾ & XÃ HỘI" 
                value={state.world.economySociety || ''} 
                onChange={(v) => store.updateWorld('economySociety', v)} 
                placeholder="Đồng tiền giao thương, hàng hóa quý hiếm, tài nguyên khoáng quặng thần thông..."
              />
              <TextAreaGroup 
                label="TÔN GIÁO & TÍN NGƯỠNG" 
                value={state.world.religionBeliefs || ''} 
                onChange={(v) => store.updateWorld('religionBeliefs', v)} 
                placeholder="Hệ bản thần, các ma môn phái thờ phụng tôn thần tối cổ..."
              />
              <TextAreaGroup 
                label="THẾ LỰC Phe phái" 
                value={state.world.factionsPower || ''} 
                onChange={(v) => store.updateWorld('factionsPower', v)} 
                onAi={() => handleAiGenerate('factionsPower', 'world')}
                loading={state.isGenerating && state.generatingField === 'factionsPower'}
                placeholder="Sự đối đầu quyền lực của Thần điện quang minh, Ma đạo tán tu tông môn..."
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWorldCompiledTab = () => {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
        <div className="border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-3 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <BookOpen size={15} className="text-mystic-accent" />
            <span>📖 Hồ sơ World Bible (Biên niênCompiled context)</span>
          </h3>
          <span className="text-[10px] text-sky-650 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20 font-black">COMPILED WORLD</span>
        </div>

        <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/25 dark:border-[#142042]/10">
          📍 Hồ sơ này tự động hội tụ tất cả 20 trường thông tin và được biên dịch thành một tài liệu bối cảnh hoàn chỉnh, đây chính là tri thức cốt tử mà mô hình AI sẽ được nạp vào làm kim chỉ nam suốt đợt thám hiểm.
        </div>

        <TextAreaGroup 
          label="Nội dung tri thức đồng bộ (World Bible Text)" 
          value={state.world.context || ''} 
          onChange={(v) => store.updateWorld('context', v)}
          height="h-[52vh]"
          placeholder="Biên dịch đang rỗng. Điền thông tin cơ bản thế giới hoặc tạo nhanh để tích luỹ."
        />
      </div>
    );
  };

  const renderEntitiesTab = () => {
    // Lọc theo tìm kiếm và danh mục bách khoa
    const filteredEntities = state.entities.filter(ent => {
      const matchCat = selectedCategoryFilter === 'ALL' || ent.type === selectedCategoryFilter;
      return matchCat;
    });

    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
        <div className="border-b border-[#cbd2df]/40 dark:border-[#142042]/15 pb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px] after:bg-white dark:after:bg-[#142042]/5">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Users size={15} className="text-mystic-accent" />
              <span>📚 Encyclopedia Manager (Bách Khoa Toàn Thư)</span>
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-0.5 font-medium">Bản ghi độc lập đồng bộ tự động vào bộ nhớ dài hạn của RPG</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const parsed = JSON.parse(event.target?.result as string);
                        let incoming: any[] = [];
                        if (Array.isArray(parsed)) {
                          incoming = parsed;
                        } else if (parsed && Array.isArray(parsed.entities)) {
                          incoming = parsed.entities;
                        } else if (parsed && Array.isArray(parsed.entries)) {
                          incoming = parsed.entries;
                        } else {
                          toast.error("Tệp JSON không chứa mảng thực thể hợp lệ.");
                          return;
                        }

                        if (incoming.length === 0) {
                          toast.error("Không tìm thấy thực thể nào trong tệp.");
                          return;
                        }

                        // Map / sanitize records to fit `Entity` format
                        const mapped = incoming.map((item: any, idx) => {
                          const id = item.id || `ent_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
                          return {
                            id,
                            name: item.name || "Vô danh thực thể",
                            type: (item.type || "CUSTOM").toUpperCase() as import("../../types").EntityType,
                            description: item.description || item.background || item.content || "",
                            age: item.age || "",
                            gender: item.gender || "",
                            personality: item.personality || "",
                            appearance: item.appearance || "",
                            status: item.status || "ACTIVE",
                            rarity: item.rarity || undefined
                          };
                        });

                        // Avoid name duplicates by filtering current ones
                        const current = [...(state.entities || [])];
                        let added = 0;
                        mapped.forEach(ent => {
                          const dupIdx = current.findIndex(e => e.name.toLowerCase() === ent.name.toLowerCase());
                          if (dupIdx !== -1) {
                            current[dupIdx] = { ...current[dupIdx], ...ent };
                          } else {
                            current.push(ent);
                            added++;
                          }
                        });

                        store.updateWorld('entities', current);
                        // Also sync to store entities
                        store.setEntities(current);
                        toast.success(`Đã nạp thành công ${mapped.length} thực thể Bách Khoa (Thêm mới: ${added}, Cập nhật: ${mapped.length - added})`);
                      } catch (err) {
                        toast.error("Lỗi phân tích tệp bách khoa toàn thư.");
                      }
                    };
                    reader.readAsText(file);
                  }
                };
                input.click();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>📥 Nạp Preset (.json)</span>
            </button>
            <Button 
              variant="primary" 
              onClick={() => { setEditingEntityId(null); setShowEntityForm(true); }} 
              icon={<Plus size={14} />}
              className="font-bold whitespace-nowrap text-xs py-2"
            >
              Thêm Thẻ Bách Khoa
            </Button>
          </div>
        </div>

        {/* Bộ lọc nhanh bách khoa (Encyclopedia Quick Categories) */}
        <div className="flex gap-2 overflow-x-auto pb-3 shrink-0 scrollbar-none custom-scrollbar border-b border-[#cbd2df]/40 dark:border-[#142042]/15 relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px] after:bg-white dark:after:bg-[#142042]/5">
          {[
            { id: 'ALL', label: 'Tất cả thẻ', icon: '📖', count: state.entities.length },
            { id: 'NPC', label: 'Nhân vật (NPC)', icon: '👥', count: state.entities.filter(e => e.type === 'NPC').length },
            { id: 'LOCATION', label: 'Địa danh / Địa điểm', icon: '🗺️', count: state.entities.filter(e => e.type === 'LOCATION').length },
            { id: 'ITEM', label: 'Vật phẩm / Bảo khí', icon: '⚔️', count: state.entities.filter(e => e.type === 'ITEM').length },
            { id: 'FACTION', label: 'Phe phái / Bang phái', icon: '🛡️', count: state.entities.filter(e => e.type === 'FACTION').length },
            { id: 'CUSTOM', label: 'Linh lực / Khái niệm', icon: '📜', count: state.entities.filter(e => e.type === 'CUSTOM').length }
          ].map(cat => {
            const isSelected = selectedCategoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#e6ebf4] dark:bg-[#0b1329] border-mystic-accent/55 text-mystic-accent font-extrabold shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042]'
                    : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-500 dark:text-slate-400 hover:text-mystic-accent shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042]'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-mystic-accent/25' : 'bg-slate-200/50 dark:bg-slate-900/50 text-slate-500'}`}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Danh sách các thẻ */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-4 px-2">
            {filteredEntities.map(ent => {
              const catConfig = {
                NPC: { label: 'Nhân vật', color: 'border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10', icon: '👥' },
                LOCATION: { label: 'Địa danh', color: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10', icon: '🗺️' },
                ITEM: { label: 'Vật phẩm', color: 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10', icon: '⚔️' },
                FACTION: { label: 'Tổ chức', color: 'border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10', icon: '🛡️' },
                CUSTOM: { label: 'Tri thức', color: 'border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10', icon: '📜' }
              }[ent.type] || { label: 'Tùy biến', color: 'border-slate-400 bg-slate-100 text-slate-600', icon: '📝' };

              return (
                <div 
                  key={ent.id} 
                  className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/15 dark:border-[#142042]/10 p-5 rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] hover:shadow-[7px_7px_14px_#cbd2df,-7px_-7px_14px_#ffffff] dark:hover:shadow-[7px_7px_14px_#030610,-7px_-7px_14px_#142042] hover:-translate-y-0.5 transition-all duration-300 group relative flex flex-col h-[210px]"
                >
                  <div className="flex justify-between items-center mb-2.5">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-wider flex items-center gap-1 ${catConfig.color}`}>
                      <span>{catConfig.icon}</span>
                      <span>{catConfig.label}</span>
                    </span>
                    <div className="flex gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <button 
                        onClick={() => { setEditingEntityId(ent.id); setShowEntityForm(true); }} 
                        className="w-7 h-7 flex items-center justify-center rounded-xl bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] text-slate-500 hover:text-mystic-accent active:shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:active:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] transition-all cursor-pointer border border-[#cbd2df]/10 dark:border-[#142042]/5"
                        title="Chỉnh sửa mục từ"
                      >
                        <Edit2 size={12}/>
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm(`Bạn có chắc chắn muốn xóa "${ent.name}" khỏi Encyclopedia?`)) {
                            store.removeEntity(ent.id);
                          }
                        }} 
                        className="w-7 h-7 flex items-center justify-center rounded-xl bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] text-slate-500 hover:text-red-500 active:shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:active:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] transition-all cursor-pointer border border-[#cbd2df]/10 dark:border-[#142042]/5"
                        title="Xóa mục từ"
                      >
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </div>

                  <h4 className="font-black text-slate-800 dark:text-slate-100 mb-1 truncate text-xs leading-tight tracking-wide">
                    {ent.name}
                  </h4>

                  <div className="flex-1 min-h-0 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] hover:shadow-[inset_3px_3px_6px_#cbd2df,inset_-3px_-3px_6px_#ffffff] dark:hover:shadow-[inset_3px_3px_6px_#030610,inset_-3px_-3px_6px_#142042] rounded-xl border border-[#cbd2df]/15 dark:border-[#142042]/10 p-3 overflow-y-auto custom-scrollbar transition-all duration-200">
                    {ent.type === 'NPC' ? (
                      <div className="space-y-1.5 text-left h-full">
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold border-b border-slate-300/25 dark:border-slate-800/30 pb-1 shrink-0">
                          <span>👤 {ent.gender || 'Chưa rõ'}</span>
                          <span className="text-slate-300">|</span>
                          <span>🎂 {ent.age || 'Chưa rõ' || 'Chưa rõ'}</span>
                        </div>
                        <p className="text-[10.5px] text-slate-650 dark:text-slate-300 leading-relaxed font-medium">
                          {ent.description || ent.personality || ent.background || 'Chưa có thông tin bách khoa.'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[10.5px] text-slate-650 dark:text-slate-300 leading-relaxed font-medium h-full" style={{ wordBreak: 'break-word' }}>
                        {ent.description || 'Chưa có thông tin bách khoa chi tiết.'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredEntities.length === 0 && (
              <div className="col-span-full border border-dashed border-slate-300 dark:border-slate-800 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] rounded-3xl flex flex-col items-center justify-center p-12 text-slate-450 dark:text-slate-500 text-center">
                <Database size={32} className="mb-3.5 text-slate-400 dark:text-slate-700 animate-pulse" />
                <p className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">Thư viện bách khoa phản khứ không có...</p>
                <p className="text-[10px] mt-1.5 text-slate-500 font-medium max-w-sm leading-relaxed">
                  {state.entities.length === 0 
                    ? 'Thế giới chưa có mục từ nào. Tạo dựng mục đầu tiên bằng nút "Thêm Thẻ Bách Khoa" phía trên.'
                    : 'Hãy chuyển loại bộ lọc bách khoa ở trên để thấy các thẻ.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const currentTabIndex = TABS.findIndex(t => t.id === state.currentTab);
  const nextTab = currentTabIndex < TABS.length - 1 ? TABS[currentTabIndex + 1].id : null;
  const prevTab = currentTabIndex > 0 ? TABS[currentTabIndex - 1].id : null;

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden bg-[#e6ebf4] dark:bg-[#0b1329]">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json" 
        className="hidden" 
      />

      <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-8 relative z-10 w-full overflow-hidden mt-safe">
          {/* Header Controls */}
          <div className="w-full max-w-5xl flex items-center justify-between mb-4 mt-2 gap-2">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onNavigate(GameState.MENU)} 
                className="text-slate-600 dark:text-slate-300 hover:text-mystic-accent transition-all flex items-center gap-1.5 bg-[#e6ebf4] dark:bg-[#0b1329] p-2 rounded-xl shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:inner-shadow border border-[#cbd2df]/10 dark:border-[#142042]/10 cursor-pointer text-xs font-extrabold uppercase font-sans"
              >
                  <ArrowLeft size={14} /> 
                  <span>Thoát</span>
              </button>
            </div>
            
            <h2 className="hidden md:block text-sm lg:text-base font-black text-slate-800 dark:text-white tracking-[0.25em] uppercase font-sans text-center flex-1">
                🏰 Khởi Thiết Thế Giới
            </h2>
            
            {/* Top right control buttons */}
            <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
              <button 
                onClick={handleImportClick} 
                title="Nhập cấu hình" 
                className="text-slate-600 dark:text-slate-300 hover:text-mystic-accent transition-all flex items-center gap-1.5 bg-[#e6ebf4] dark:bg-[#0b1329] p-2 px-3 rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] text-[10px] font-bold uppercase tracking-wider cursor-pointer border border-[#cbd2df]/10"
              >
                  <Upload size={13} /> <span className="hidden sm:inline">Nhập</span>
              </button>
              
              <button 
                onClick={handleExportWorld} 
                title="Xuất cấu hình" 
                className="text-slate-600 dark:text-slate-300 hover:text-mystic-accent transition-all flex items-center gap-1.5 bg-[#e6ebf4] dark:bg-[#0b1329] p-2 px-3 rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] text-[10px] font-bold uppercase tracking-wider cursor-pointer border border-[#cbd2df]/10"
              >
                  <Download size={13} /> <span className="hidden sm:inline">Xuất</span>
              </button>
              
              <button 
                onClick={() => setShowAiModal(true)} 
                className="text-amber-650 dark:text-amber-400 hover:text-amber-500 transition-all flex items-center gap-1.5 bg-[#e6ebf4] dark:bg-[#0b1329] p-2 px-3.5 rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] text-[10px] font-extrabold uppercase tracking-wide cursor-pointer border border-transparent animate-pulse"
              >
                  <Sparkles size={13} className="text-amber-500" /> <span>AI Tạo Nhanh</span>
              </button>
              
              <button 
                 disabled={!state.player.name || !state.world.worldName}
                 onClick={handleStartGame}
                 className="text-white bg-gradient-to-br from-mystic-accent to-blue-600 hover:from-blue-500 hover:to-mystic-accent transition-all flex items-center gap-1.5 p-2 px-4 rounded-2xl shadow-[4px_4px_8px_rgba(56,189,248,0.2)] disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-wider cursor-pointer border-none"
              >
                  <Play size={12} className="fill-white" /> <span>Khởi hành</span>
              </button>
            </div>
          </div>

          {/* Master Neo Bento Wizard Frame */}
          <div className="w-full max-w-5xl h-[max(620px,76vh)] flex flex-row bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/20 dark:border-[#142042]/10 rounded-3xl shadow-[12px_12px_24px_#cbd2df,-12px_-12px_24px_#ffffff] dark:shadow-[12px_12px_24px_#030610,-12px_-12px_24px_#142042] overflow-hidden mx-auto min-h-0">
            
            {/* Steps Navigation Rail */}
            <div className="w-16 md:w-20 bg-[#e6ebf4]/90 dark:bg-[#0b1329]/90 border-r border-[#cbd2df]/30 dark:border-[#142042]/15 flex flex-col items-center py-8 gap-5 shrink-0">
              {TABS.map((tab) => {
                const isActive = state.currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => store.setTab(tab.id)}
                    title={tab.label}
                    className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300 pointer cursor-pointer ${
                      isActive
                        ? 'bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_3px_3px_6px_#cbd2df,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#030610,inset_-3px_-3px_6px_#142042] text-mystic-accent border border-[#cbd2df]/30'
                        : 'bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] text-slate-500 hover:text-mystic-accent'
                    }`}
                  >
                    <tab.icon size={16} />
                  </button>
                );
              })}
            </div>

            {/* Main view panel */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#e6ebf4] dark:bg-[#0b1329] overflow-hidden">
              <div className="flex-grow overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-7 relative">
                 <AnimatePresence mode="wait">
                    {state.currentTab === 1 && <motion.div key="tab1" initial={{opacity:0, y:-8}} animate={{opacity:1, y:0}} exit={{opacity:0, y:8}} transition={{ duration: 0.15 }} className="h-full max-w-4xl mx-auto">{renderWorldSetupTab()}</motion.div>}
                    {state.currentTab === 0 && <motion.div key="tab0" initial={{opacity:0, y:-8}} animate={{opacity:1, y:0}} exit={{opacity:0, y:8}} transition={{ duration: 0.15 }} className="h-full max-w-4xl mx-auto">{renderPlayerTab()}</motion.div>}
                    {state.currentTab === 3 && <motion.div key="tab3" initial={{opacity:0, y:-8}} animate={{opacity:1, y:0}} exit={{opacity:0, y:8}} transition={{ duration: 0.15 }} className="h-full max-w-4xl mx-auto">{renderEntitiesTab()}</motion.div>}
                    {state.currentTab === 6 && <motion.div key="tab6" initial={{opacity:0, y:-8}} animate={{opacity:1, y:0}} exit={{opacity:0, y:8}} transition={{ duration: 0.15 }} className="h-full max-w-4xl mx-auto">{renderWorldCompiledTab()}</motion.div>}
                 </AnimatePresence>
              </div>
              
              {/* Footer bar */}
              <div className="p-4 bg-[#e6ebf4]/95 dark:bg-[#0b1329]/95 border-t border-[#cbd2df]/30 dark:border-[#142042]/15 flex items-center justify-between gap-4 shrink-0">
                 <div className="flex gap-2.5">
                    {prevTab !== null && (
                      <button 
                         className="py-2 px-4 text-xs font-black bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] border border-[#cbd2df]/10 rounded-xl text-slate-600 dark:text-slate-350 hover:text-mystic-accent transition-all cursor-pointer font-sans"
                         onClick={() => store.setTab(prevTab)}
                      >
                         Trở lại
                      </button>
                    )}
                    {nextTab !== null && (
                      <button 
                         className="py-2 px-4 text-xs font-black bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] border border-[#cbd2df]/10 rounded-xl text-mystic-accent hover:text-blue-500 transition-all cursor-pointer font-sans"
                         onClick={() => store.setTab(nextTab)}
                      >
                         Tiếp theo
                      </button>
                    )}
                 </div>

                 <div className="hidden lg:flex items-center gap-3 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] rounded-xl p-2 px-3.5 border border-[#cbd2df]/10">
                     <div className="flex items-center gap-1.5 text-xs text-slate-650 dark:text-slate-350">
                         <User size={12} className="text-mystic-accent shrink-0" />
                         <span className="font-extrabold max-w-[120px] truncate">{state.player.name || <span className="text-slate-400 font-normal italic text-[11px]">Chưa lập tên</span>}</span>
                     </div>
                     <div className="w-[1px] h-2.5 bg-slate-300 dark:bg-slate-800" />
                     <div className="flex items-center gap-1.5 text-xs text-slate-655 dark:text-slate-355">
                         <Compass size={12} className="text-mystic-accent shrink-0" />
                         <span className="font-extrabold max-w-[120px] truncate">{state.world.worldName || <span className="text-slate-400 font-normal italic text-[11px]">Chưa lập thế giới</span>}</span>
                     </div>
                 </div>
              </div>
            </div>
          </div>
      </div>

      {showEntityForm && (
        <EntityForm 
            initialData={editingEntityId ? state.entities.find(e => e.id === editingEntityId) : undefined}
            onCancel={() => setShowEntityForm(false)}
            onSave={(entity) => {
                if (editingEntityId) {
                    store.updateEntity(editingEntityId, entity);
                } else {
                    store.addEntity(entity);
                }
                setShowEntityForm(false);
            }}
            settings={settings}
        />
      )}

      {/* Rapid AI Builder Modal */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-xl bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/30 dark:border-[#142042]/10 rounded-3xl p-6 shadow-[10px_10px_20px_rgba(0,0,0,0.1)]"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={16} className="text-amber-500 animate-pulse" /> Sáng tạo Thế giới bằng AI (Thô triệt)
                </h3>
                <button 
                  onClick={() => setShowAiModal(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] border border-[#cbd2df]/10 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-5">
                <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_3px_3px_6px_#cbd2df,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#030610,inset_-3px_-3px_6px_#142042] border border-[#cbd2df]/10 space-y-2.5">
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">💡 Ý tưởng bối cảnh thô</h4>
                  <p className="text-[10px] text-slate-500">Mô tả bất kỳ ý tưởng bối cảnh thô sơ nào bạn muốn (Ví dụ: Tiên hiệp hồng mông, Đô thị kiếm pháp tương lai...). AI sẽ tự động gieo toàn bộ 20 trường thông tin thế giới và Nhân vật chính.</p>
                  <input 
                    value={conceptInput}
                    onChange={(e) => setConceptInput(e.target.value)}
                    placeholder="Mô tả ý tưởng bối cảnh khái quát..."
                    className="w-full bg-[#cbd2df]/20 dark:bg-slate-900/45 border-none rounded-xl p-2.5 text-xs font-semibold text-slate-850 dark:text-slate-100 outline-none"
                  />
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={async () => {
                        await handleAutoFillAll();
                        setShowAiModal(false);
                      }}
                      disabled={state.isGenerating || !conceptInput.trim()}
                      className="py-2 px-4 text-[10.5px] font-extrabold bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] rounded-xl text-amber-650 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <Sparkles size={12} className="text-amber-500 animate-pulse" />
                      {state.isGenerating ? "Đang gieo luật..." : "Tự động tạo bối cảnh & Nhân vật"}
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_3px_3px_6px_#cbd2df,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#030610,inset_-3px_-3px_6px_#142042] border border-[#cbd2df]/10 space-y-2.5">
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">📂 Đọc từ Tài liệu Tri thức gốc</h4>
                  <p className="text-[10px] text-slate-500">Tải tệp văn bản bối cảnh của riêng bạn (TXT, MD, JSON). AI sẽ phân rã để gieo 20 trường thông tin tương thích hoàn hảo.</p>
                  
                  <div className="flex items-center gap-2 bg-slate-200/30 rounded-xl p-2 border border-dashed border-[#cbd2df]">
                    <input 
                      type="file" 
                      id="pop-knowledge-file" 
                      className="hidden" 
                      accept=".txt,.md,.json"
                      onChange={handleKnowledgeUpload} 
                    />
                    {knowledgeFileName ? (
                      <div className="flex-1 flex items-center justify-between min-w-0 text-slate-800 dark:text-slate-200 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Database size={14} className="text-emerald-500 shrink-0" />
                          <span className="font-bold truncate">{knowledgeFileName} ({knowledgeFileSize})</span>
                        </div>
                        <button onClick={handleClearKnowledge} className="p-1 text-slate-400 hover:text-red-500 cursor-pointer border-none bg-transparent">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <label htmlFor="pop-knowledge-file" className="flex-1 flex items-center gap-2 cursor-pointer text-slate-500 hover:text-mystic-accent justify-center py-1">
                        <Upload size={14} />
                        <span className="text-[10px] font-black uppercase tracking-wide">Chọn tệp văn bản bối cảnh (.txt/.md)</span>
                      </label>
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      disabled={!knowledgeContent || state.isGenerating}
                      onClick={async () => {
                        await handleWorldGenFromKnowledge();
                        setShowAiModal(false);
                      }}
                      className="py-2 px-4 text-[10.5px] font-extrabold bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] rounded-xl text-emerald-650 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <Database size={12} className="text-emerald-550" />
                      Gieo bối cảnh từ Tri thức bóc tách
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InputGroup = ({ label, value, onChange, placeholder, onAi, loading = false }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, onAi?: () => void, loading?: boolean }) => (
    <div className="mb-1 relative flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_4px_4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15">
        <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-black uppercase text-slate-850 dark:text-slate-200 tracking-wide">{label}</label>
            {onAi && (
                <button 
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAi();
                    }} 
                    disabled={loading} 
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] border border-[#cbd2df]/10 text-[9px] text-slate-600 dark:text-slate-350 font-bold hover:text-mystic-accent cursor-pointer"
                >
                    <Sparkles size={10} className={loading ? "animate-spin" : "animate-pulse"} />
                    <span>AI Gợi ý</span>
                </button>
            )}
        </div>
        <input 
            type="text" 
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
            placeholder={placeholder || `Nhập ${label.toLowerCase()}...`}
        />
    </div>
);

const TextAreaGroup = ({ label, value, onChange, onAi, height = 'h-24', loading = false, placeholder }: { label: string, value: string, onChange: (v: string) => void, onAi?: () => void, height?: string, loading?: boolean, placeholder?: string }) => {
    const [isPreview, setIsPreview] = useState(false);
    
    return (
        <div className="relative flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_4px_4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15">
            <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-black uppercase text-slate-850 dark:text-slate-200 tracking-wide">{label}</label>
                    <button 
                        type="button"
                        onClick={() => setIsPreview(!isPreview)}
                        className="text-slate-400 hover:text-mystic-accent cursor-pointer border-none bg-transparent"
                        title={isPreview ? "Chỉnh sửa" : "Xem trước Markdown"}
                    >
                        {isPreview ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                </div>
                {onAi && (
                    <button 
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAi();
                        }} 
                        disabled={loading} 
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] border border-[#cbd2df]/10 text-[9px] text-slate-600 dark:text-slate-350 font-bold hover:text-mystic-accent cursor-pointer"
                    >
                        <Sparkles size={10} className={loading ? "animate-spin" : "animate-pulse"} />
                        <span>AI Điền</span>
                    </button>
                )}
            </div>
            {isPreview ? (
                <div className={`w-full bg-slate-100/35 dark:bg-slate-900/35 rounded-xl p-2 text-slate-900 dark:text-slate-100 overflow-y-auto custom-scrollbar text-xs leading-relaxed ${height}`}>
                    <MarkdownRenderer content={value || "*Chưa có nội dung thiết lập*"} />
                </div>
            ) : (
                <textarea 
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-medium resize-none focus:ring-0 custom-scrollbar ${height}`}
                    placeholder={placeholder || `Mô tả ${label.toLowerCase()}...`}
                />
            )}
        </div>
    );
};

export default WorldCreationScreen;
