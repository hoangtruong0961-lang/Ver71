import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { VectorData } from "../../../../../services/db/indexedDB";
import { CharacterSheetEditor } from "../../../world-creation/CharacterSheetEditor";
import { CharacterSheet } from "../../../../../types";
import {
  Sparkles,
  Shrink,
  Maximize2,
  FileCode,
  Tags,
  Link as LinkIcon,
  Plus,
  X,
  User,
  Activity,
  Check,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Filter,
  Sliders,
  Settings,
  Cpu,
  Bookmark,
  Award,
  Pin,
  Eye,
  Globe,
  Compass,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { worldAiService } from "../../../../../services/ai/world-creation/service";
import { useAppStore } from "../../../../../store/appStore";

export interface EntryEditorProps {
  formData: Partial<VectorData>;
  onChange: (field: keyof VectorData, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isEditing: boolean;
  entries: VectorData[]; // Existing entries list for links
}

export const EntryEditor: React.FC<EntryEditorProps> = ({
  formData,
  onChange,
  onSave,
  onCancel,
  isSaving,
  isEditing,
  entries = [],
}) => {
  const [keywordsText, setKeywordsText] = useState("");
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [isGeneratingTarget, setIsGeneratingTarget] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiIdeaPrompt, setAiIdeaPrompt] = useState("");
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [showRpgAttrs, setShowRpgAttrs] = useState(true);
  const [showLinksArea, setShowLinksArea] = useState(true);
  const [relatedSearchTerm, setRelatedSearchTerm] = useState("");
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'content' | 'trigger' | 'stats_network'>('content');

  // Wizard states (for adding new entries)
  const [wizardStep, setWizardStep] = useState(1);

  const { settings } = useAppStore();
  const currentModel = settings?.aiModel || "gemini-3.5-flash";

  // Keyboard Shortcuts Listener for editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave();
      }
      // Escape to cancel edit
      if (e.key === "Escape" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave, onCancel]);

  // Sync formData.keywords to local tag systems
  useEffect(() => {
    setKeywordsText(formData.keywords?.join(", ") || "");
    setSuggestedKeywords([]);
  }, [formData.keywords, formData.id]);

  const handleKeywordsChange = (val: string) => {
    setKeywordsText(val);
    const parsed = val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onChange("keywords", parsed);
  };

  const handleAddKeywordBadge = (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    const currentList = formData.keywords || [];
    if (currentList.some((w) => w.toLowerCase() === trimmed.toLowerCase())) return;

    const newList = [...currentList, trimmed];
    onChange("keywords", newList);
    setKeywordsText(newList.join(", "));
  };

  const handleRemoveKeywordBadge = (idxToRemove: number) => {
    const currentList = formData.keywords || [];
    const newList = currentList.filter((_, idx) => idx !== idxToRemove);
    onChange("keywords", newList);
    setKeywordsText(newList.join(", "));
  };

  const handleAddKeywordFromInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeywordInput.trim()) {
      handleAddKeywordBadge(newKeywordInput.trim());
      setNewKeywordInput("");
    }
  };

  // Character Sheet JSON parse
  const characterData = useMemo(() => {
    if (formData.category !== "character") return null;
    try {
      return JSON.parse(formData.text || "{}") as Partial<CharacterSheet>;
    } catch {
      return { narrativeRole: formData.text } as Partial<CharacterSheet>;
    }
  }, [formData.text, formData.category]);

  const handleCharacterSheetChange = (
    field: keyof CharacterSheet,
    value: string
  ) => {
    const newData = { ...characterData, [field]: value };
    onChange("text", JSON.stringify(newData, null, 2));
  };

  const handleAiGenKnowledge = async () => {
    if (!characterData?.knowledge_train?.trim()) {
      toast.warning("Vui lòng nhập dữ liệu gốc (Knowledge Base) trước.");
      return;
    }

    setIsGeneratingTarget(true);
    try {
      const generatedSheet =
        await worldAiService.generateCharacterSheetFromKnowledge(
          characterData.knowledge_train,
          currentModel,
          settings
        );
      const newData = {
        ...characterData,
        ...generatedSheet,
        knowledge_train: characterData.knowledge_train,
      };
      onChange("text", JSON.stringify(newData, null, 2));
      toast.success("Đã sinh nhân vật từ Knowledge Base thành công!");
    } catch (error: any) {
      console.error(error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Lỗi khi tạo hình nhân vật từ Knowledge. Chi tiết: ${errorMsg}`);
    } finally {
      setIsGeneratingTarget(false);
    }
  };

  // --- CORE SYSTEM REMAKE AI COMMANDS ---

  const handleAiDraftFromIdea = async () => {
    if (!formData.keyword?.trim()) {
      toast.warning("Vui lòng nhập Từ khóa chính làm tiêu đề trước.");
      return;
    }
    if (!aiIdeaPrompt.trim()) {
      toast.warning("Vui lòng nhập một vài phác thảo ý tưởng để AI giúp bạn bồi đắp!");
      return;
    }

    setIsAiProcessing(true);
    try {
      const gLore = await worldAiService.generateEncyclopediaEntry(
        formData.keyword,
        formData.category || "world",
        aiIdeaPrompt,
        currentModel,
        settings
      );
      if (gLore) {
        onChange("text", gLore);
        setAiIdeaPrompt("");
        toast.success("Draft thành công bối cảnh từ ý tưởng!");
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Có lỗi xảy ra khi gọi AI Drafting. Chi tiết: ${errorMsg}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleAiRefinement = async (action: "condense" | "expand" | "format") => {
    const currentText = formData.text || "";
    if (!currentText.trim() || formData.category === "character") {
      toast.warning("Hãy nhập một ít thông tin bối cảnh vào ô bên dưới trước khi yêu cầu tinh luyện.");
      return;
    }

    setIsAiProcessing(true);
    try {
      const refined = await worldAiService.refineEncyclopediaEntry(
        currentText,
        action,
        currentModel,
        settings
      );
      if (refined) {
        onChange("text", refined);
        toast.success("Tinh luyện bối cảnh bằng AI thành công!");
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Không thể tinh luyện bối cảnh bằng AI. Chi tiết: ${errorMsg}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleAiExtractKeywords = async () => {
    const currentText = formData.text || "";
    if (!currentText.trim() || formData.category === "character") {
      toast.warning("Nhập nội dung bối cảnh trước khi phân tích trích xuất từ khóa kích hoạt.");
      return;
    }

    setIsAiProcessing(true);
    try {
      const words = await worldAiService.extractTriggerKeywords(
        currentText,
        currentModel,
        settings
      );
      if (words && words.length > 0) {
        setSuggestedKeywords(words);
        toast.success(`Đã trích xuất xong ${words.length} từ khóa kích thích!`);
      } else {
        toast.warning("AI không tìm thấy từ khóa kích hoạt phù hợp đạt chuẩn.");
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Lỗi trích xuất từ khóa kích hoạt. Chi tiết: ${errorMsg}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleAiAutoExtractStats = async () => {
    const currentText = formData.text || "";
    if (!currentText.trim() || formData.category === "character") {
      toast.warning("Hãy điền nội dung bối cảnh trước để AI phân tích cấu trúc.");
      return;
    }

    setIsAiProcessing(true);
    try {
      const extAttrs = await worldAiService.autoExtractRpgAttributes(
        currentText,
        formData.category || "world",
        currentModel,
        settings
      );
      if (extAttrs && Object.keys(extAttrs).length > 0) {
        onChange("rpg_attrs" as any, extAttrs);
        toast.success("Trích xuất chỉ số thuộc tính thành công!");
      } else {
        toast.warning("Không tìm thấy thông số phù hợp thích ứng loại danh mục này.");
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Lỗi phân tích thông số RPG tự động. Chi tiết: ${errorMsg}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const getRpgAttrs = (): Record<string, string> => {
    return (formData as any).rpg_attrs || {};
  };

  const handleRpgAttrChange = (key: string, val: string) => {
    const current = getRpgAttrs();
    onChange("rpg_attrs" as any, { ...current, [key]: val });
  };

  // Convert priority to Human Readable Tier helper
  const priorityTier = useMemo(() => {
    const pr = formData.priority || 50;
    if (pr >= 90) return { text: "S Class (Sự can thiệp Tối cao)", class: "S" };
    if (pr >= 75) return { text: "A Class (Ưu tiên Cao cường)", class: "A" };
    if (pr >= 50) return { text: "B Class (Ưu tiên Thường thế)", class: "B" };
    if (pr >= 30) return { text: "C Class (Ưu tiên Sơ lưu)", class: "C" };
    return { text: "D Class (Lưu trữ Bị động)", class: "D" };
  }, [formData.priority]);

  // Set designated priority values via Tier select click
  const setPriorityByTier = (tierLetter: "S" | "A" | "B" | "C" | "D") => {
    const defaultVal = tierLetter === "S" ? 95 :
                       tierLetter === "A" ? 82 :
                       tierLetter === "B" ? 60 :
                       tierLetter === "C" ? 40 : 15;
    onChange("priority", defaultVal);
  };

  // Live Context Injection Preview Generator
  const contextInjectionPreviewText = useMemo(() => {
    const delimiter = "=======================";
    const catLabel = formData.category?.toUpperCase() || "WORLD";
    const title = formData.keyword?.trim() || "VÔ DANH THƯ";
    const pr = formData.priority || 50; 
    const mode = formData.triggerMode || "hybrid";
    const pos = formData.position || "before_char";
    
    // Build RPG traits string
    let rpgLines = "";
    if (formData.category !== "character") {
      const attrs = getRpgAttrs();
      const entries = Object.entries(attrs).filter(([_, v]) => v.trim());
      if (entries.length > 0) {
        rpgLines = "\n[RPG TRAITS]\n" + entries.map(([k, v]) => `  • ${k.toUpperCase()}: ${v}`).join("\n");
      }
    }

    // Related entries list
    const linksList = (formData.relatedEntries || []).map(id => {
      const matched = entries.find(e => e.id === id);
      return matched ? matched.keyword : null;
    }).filter(Boolean);
    const relatedLine = linksList.length > 0 ? `\n[RELATED ANCIENT LINES]: ${linksList.join(" <-> ")}` : "";

    // Text content
    let contentSnippet = "";
    if (formData.category === "character" && characterData) {
      contentSnippet = JSON.stringify(characterData, null, 2);
    } else {
      contentSnippet = formData.text || "Chưa điền văn bản ghi chép dã sử.";
    }

    return `${delimiter}
[PROMPT INJECTION BLOCK] - (Vị trí nạp: ${pos.toUpperCase()})
[PRIORITY CLASS: ${priorityTier.class} (Value: ${pr})] • [TRIGGER LOGIC: ${mode.toUpperCase()}]
${delimiter}

[ENCYCLOPEDIA REFERENCE: ${catLabel} - ${title}]${rpgLines}${relatedLine}

${contentSnippet}

${delimiter}`;
  }, [formData, characterData, entries, priorityTier]);

  return (
    <div id="entry-editor-root" className="flex flex-col lg:flex-row h-full bg-[#0d1220] text-slate-100 overflow-hidden select-none font-sans relative p-5 gap-5">
      <div className="absolute inset-0 bg-repeat bg-center opacity-[0.012] pointer-events-none mix-blend-color-burn" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/dark-matter.png')" }} />

      {/* LEFT COLUMN: The Complete Rich Editor Form (58%) */}
      <div className="flex-1 lg:w-[58%] flex flex-col h-full bg-[#0d1220] rounded-[24px] shadow-[4px_4px_12px_rgba(3,4,8,0.7),_-4px_-4px_12px_rgba(25,35,58,0.2)] border border-[#141b2c]/20 relative overflow-hidden">
        
        {/* Header Action Bar - Beautiful tactile bar */}
        <div className="px-6 py-4 border-b border-[#141b2c]/10 flex justify-between items-center bg-[#0d1220] shrink-0">
          <div className="flex items-center gap-2.5">
            <Bookmark size={16} className="text-sky-400 animate-pulse" />
            <h3 className="font-sans font-black text-slate-100 tracking-wider uppercase text-xs">
              {isEditing ? "Hiệu đính Cổ Thư" : "Khai hoang Cốt truyện Mới"}
            </h3>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={onCancel}
              disabled={isSaving || isAiProcessing}
              className="px-4 py-2 bg-[#0d1220] text-slate-450 hover:text-slate-100 rounded-xl font-mono text-[9px] font-bold border border-[#141b2c]/15 shadow-[2px_2px_4px_rgba(3,4,8,0.6),_-2px_-2px_4px_rgba(25,35,58,0.2)] active:shadow-inner transition-all"
            >
              Hủy
            </button>
            <button
              onClick={onSave}
              disabled={isSaving || isAiProcessing}
              className="px-4 / py-2 bg-[#0d1220] text-sky-400 rounded-xl font-bold font-mono text-[9px] uppercase tracking-wider border border-[#141b2c]/15 shadow-[2px_2px_4px_rgba(3,4,8,0.65),_-2px_-2px_4px_rgba(25,35,58,0.2)] active:shadow-inner transition-all"
              title="Lưu hoặc phím tắt Ctrl+S"
            >
              {isSaving ? "Đang găm..." : "Thiết lập tri thức ✓"}
            </button>
          </div>
        </div>

        {/* Inner Forms Scrollable Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 pb-20 text-left relative">
          {isAiProcessing && (
            <div className="absolute inset-0 z-40 bg-slate-950/85 flex justify-center items-center backdrop-blur-sm">
              <div className="bg-[#0d1220] border border-[#141b2c]/20 rounded-2xl p-6 shadow-[5px_5px_15px_rgba(0,0,0,0.8)] flex items-center gap-3">
                <RefreshCw size={20} className="animate-spin text-sky-400" />
                <span className="text-[10px] font-sans font-bold text-slate-205 uppercase tracking-widest">
                  AI Scribe đang đun nấu bối cảnh thần tích...
                </span>
              </div>
            </div>
          )}

          {isEditing ? (
            <>
              {/* Core Tab selection - Sunken Box with Raised Button selectors */}
              <div className="flex bg-[#090d18] rounded-2xl p-1.5 border border-[#141b2c]/10 shadow-[inset_3px_3px_6px_rgba(3,4,8,0.7),_inset_-3px_-3px_6px_rgba(25,35,58,0.15)] gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('content')}
                  className={`flex-1 py-2 px-3 text-[9px] font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'content'
                      ? 'bg-[#0d1220] text-sky-400 shadow-[3px_3px_6px_rgba(3,4,8,0.6),_-1px_-1px_3px_rgba(255,255,255,0.05)] border border-[#141b2c]/15'
                      : 'text-slate-405 hover:text-slate-200'
                  }`}
                >
                  <BookOpen size={10} />
                  1. Văn thư căn nguyên
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('trigger')}
                  className={`flex-1 py-2 px-3 text-[9px] font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'trigger'
                      ? 'bg-[#0d1220] text-sky-400 shadow-[3px_3px_6px_rgba(3,4,8,0.6),_-1px_-1px_3px_rgba(255,255,255,0.05)] border border-[#141b2c]/15'
                      : 'text-slate-405 hover:text-slate-200'
                  }`}
                >
                  <Filter size={10} />
                  2. Quy pháp cảm ứng
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('stats_network')}
                  className={`flex-1 py-2 px-3 text-[9px] font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'stats_network'
                      ? 'bg-[#0d1220] text-sky-400 shadow-[3px_3px_6px_rgba(3,4,8,0.6),_-1px_-1px_3px_rgba(255,255,255,0.05)] border border-[#141b2c]/15'
                      : 'text-slate-405 hover:text-slate-200'
                  }`}
                >
                  <Sliders size={10} />
                  3. Thuộc tính & Cầu nối
                </button>
              </div>

              {/* TAB 1: CONTENT / PROFILE */}
              {activeTab === 'content' && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Title & category - Beautiful Neumorphic Panel */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-[#0d1220] p-5 rounded-2xl border border-[#141b2c]/15 shadow-[3px_3px_8px_rgba(3,4,8,0.6),_-3px_-3px_8px_rgba(25,35,58,0.2)]">
                    <div className="space-y-2">
                      <label className="text-[9px] font-mono font-extrabold uppercase text-slate-400 tracking-widest block">
                        Danh xưng căn nguyên / Title (Từ khóa chính)
                      </label>
                      <div className="bg-[#090d18] rounded-xl shadow-[inset_2.5px_2.5px_5px_rgba(3,4,8,0.7),_inset_-2.5px_-2.5px_5px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2.5">
                        <input
                          type="text"
                          value={formData.keyword || ""}
                          onChange={(e) => onChange("keyword", e.target.value)}
                          className="w-full bg-transparent outline-none border-none text-xs font-sans font-black text-slate-100"
                          placeholder="Vd: Hiệp sĩ Galahad, Eldoria..."
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-mono font-extrabold uppercase text-slate-400 tracking-widest block">
                        Xếp loại Tri thư / Category
                      </label>
                      <div className="bg-[#090d18] rounded-xl shadow-[inset_2.5px_2.5px_5px_rgba(3,4,8,0.7),_inset_-2.5px_-2.5px_5px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 px-2.5 py-1">
                        <select
                          value={formData.category || "world"}
                          onChange={(e) => {
                            onChange("category", e.target.value);
                            onChange("rpg_attrs" as any, {});
                          }}
                          className="w-full bg-transparent outline-none border-none text-xs font-bold text-slate-200 py-1.5 cursor-pointer"
                        >
                          <option value="character" className="bg-[#090d18] text-slate-100">Nhân vật (Character Profile)</option>
                          <option value="location" className="bg-[#090d18] text-slate-100">Địa danh (Location Guide)</option>
                          <option value="faction" className="bg-[#090d18] text-slate-100">Thế lực / Bang phái (Faction Spec)</option>
                          <option value="item" className="bg-[#090d18] text-slate-100">Cổ vật dã thiết (Item Stats)</option>
                          <option value="event" className="bg-[#090d18] text-slate-100">Sự kiện / Lịch ký (Event Chrono)</option>
                          <option value="law" className="bg-[#090d18] text-slate-100">Quy tắc thế giới (World Law)</option>
                          <option value="world" className="bg-[#090d18] text-slate-100">Lore chung (General Lore)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* AI Scribe Assistive Panel - Neumorphic block */}
                  {formData.category !== "character" && (
                    <div className="bg-[#0d1220] p-5 border border-[#141b2c]/15 rounded-2xl shadow-[3px_3px_8px_rgba(3,4,8,0.6),_-3px_-3px_8px_rgba(25,35,58,0.2)] space-y-4">
                      <div className="flex items-center justify-between border-b border-[#141b2c]/10 pb-2.5 flex-wrap gap-2">
                        <span className="text-[9px] font-mono font-black uppercase text-slate-400 flex items-center gap-1.5 tracking-widest">
                          <Sparkles size={11} className="text-[#38bdf8] animate-pulse" />
                          AI Scribe Assistant (Biên niên căn bản)
                        </span>
                        <span className="text-[8px] font-mono py-0.5 px-2 bg-[#090d18] text-sky-400 border border-[#141b2c]/10 rounded uppercase">
                          Gemini Hybrid Core
                        </span>
                      </div>

                      {!(formData.text || "").trim() ? (
                        <div className="space-y-3">
                          <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                            Bạn chưa biên chép bối cảnh nội dung? Cứ gõ phác thảo thô ý thế dưới đây, AI Scribe sẽ dệt nên một dã sử toàn bộ có độ tương hiền cực tốt!
                          </p>
                          <div className="flex gap-2.5">
                            <div className="flex-1 bg-[#090d18] rounded-xl shadow-[inset_2.5px_2.5px_5px_rgba(3,4,8,0.7),_inset_-2.5px_-2.5px_5px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 flex items-center">
                              <input
                                type="text"
                                value={aiIdeaPrompt}
                                onChange={(e) => setAiIdeaPrompt(e.target.value)}
                                placeholder="Gõ ý niệm (Vd: Là ma pháp trận bảo hộ thành, tốn tàn tinh thạch thạch lam)..."
                                className="w-full bg-transparent outline-none border-none text-xs text-slate-100 placeholder-slate-500 font-sans font-medium"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAiDraftFromIdea}
                              disabled={isAiProcessing || !aiIdeaPrompt.trim() || !formData.keyword?.trim()}
                              className="px-4 py-2 bg-[#0d1220] border border-[#141b2c]/15 text-sky-400 hover:text-sky-300 font-bold text-xs rounded-xl shadow-[2px_2px_4px_rgba(3,4,8,0.6),_-2px_-2px_4px_rgba(25,35,58,0.2)] active:shadow-inner transition-all flex items-center gap-1 shrink-0"
                            >
                              <Sparkles size={10} /> Dệt
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3.5 text-left">
                          <span className="text-[9px] font-mono text-slate-400 font-extrabold uppercase block tracking-wider">Tinh mài chính văn cổ pháp thuật:</span>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleAiRefinement("condense")}
                              disabled={isAiProcessing}
                              className="px-3 py-1.5 bg-[#0d1220] border border-[#141b2c]/15 text-slate-350 hover:text-sky-400 text-xs rounded-xl shadow-[2px_2px_4px_rgba(3,4,8,0.6),_-2px_-2px_4px_rgba(25,35,58,0.2)] active:shadow-inner transition-all flex items-center gap-1.5"
                            >
                              <Shrink size={10} /> Chưng cất
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAiRefinement("expand")}
                              disabled={isAiProcessing}
                              className="px-3 py-1.5 bg-[#0d1220] border border-[#141b2c]/15 text-slate-350 hover:text-sky-400 text-xs rounded-xl shadow-[2px_2px_4px_rgba(3,4,8,0.6),_-2px_-2px_4px_rgba(25,35,58,0.2)] active:shadow-inner transition-all flex items-center gap-1.5"
                            >
                              <Maximize2 size={10} /> Thổi bùng văn kể
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAiRefinement("format")}
                              disabled={isAiProcessing}
                              className="px-3 py-1.5 bg-[#0d1220] border border-[#141b2c]/15 text-slate-350 hover:text-sky-400 text-xs rounded-xl shadow-[2px_2px_4px_rgba(3,4,8,0.6),_-2px_-2px_4px_rgba(25,35,58,0.2)] active:shadow-inner transition-all flex items-center gap-1.5"
                            >
                              <FileCode size={10} /> Gọt sấy Markdown
                            </button>
                            <button
                              type="button"
                              onClick={handleAiExtractKeywords}
                              disabled={isAiProcessing}
                              className="px-3 py-1.5 bg-[#0d1220] border border-[#141b2c]/15 text-slate-350 hover:text-sky-400 text-xs rounded-xl shadow-[2px_2px_4px_rgba(3,4,8,0.6),_-2px_-2px_4px_rgba(25,35,58,0.2)] active:shadow-inner transition-all flex items-center gap-1.5"
                            >
                              <Tags size={10} /> Quét mật tự
                            </button>
                          </div>

                          {suggestedKeywords.length > 0 && (
                            <div className="pt-3 border-t border-[#141b2c]/10 mt-1 space-y-2">
                              <span className="text-[9px] font-mono font-bold text-[#38bdf8] uppercase block tracking-wider">Từ khóa AI bóc tách (Nhấp để gán làm cảm biến phụ):</span>
                              <div className="flex flex-wrap gap-1.5">
                                {suggestedKeywords.map((word, idx) => {
                                  const exists = (formData.keywords || []).some((w) => w.toLowerCase() === word.toLowerCase());
                                  return (
                                    <button
                                      type="button"
                                      key={idx}
                                      onClick={() => handleAddKeywordBadge(word)}
                                      disabled={exists}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                                        exists
                                          ? "bg-[#090d18] border-transparent text-slate-550/40 cursor-not-allowed"
                                          : "bg-[#0d1220] border-[#141b2c]/15 text-sky-400 shadow-[1px_1px_3px_rgba(3,4,8,0.6),_-1px_-1px_3px_rgba(25,35,58,0.2)] hover:text-sky-300"
                                      }`}
                                    >
                                      #{word} {!exists && "+"}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main text area or Character Sheet editor block */}
                  <div className="bg-[#0d1220] p-5 rounded-2xl border border-[#141b2c]/15 shadow-[3px_3px_8px_rgba(3,4,8,0.6),_-3px_-3px_8px_rgba(25,35,58,0.2)] space-y-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] font-mono font-black uppercase text-slate-400 tracking-widest">
                        Khố bối chính văn dã sử / Narrative Base
                      </span>
                      <span className="text-[9px] font-mono text-sky-400 font-extrabold bg-[#090d18] px-2 py-0.5 rounded border border-[#141b2c]/10">
                        {Math.round((formData.text?.length || 0) / 3.8)} Tokens
                      </span>
                    </div>

                    {formData.category === "character" && characterData ? (
                      <div className="bg-[#090d18] border border-[#141b2c]/10 rounded-2xl p-4 space-y-4 relative shadow-[inset_3px_3px_6px_rgba(3,4,8,0.7),_inset_-3px_-3px_6px_rgba(25,35,58,0.15)]">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#141b2c]/10 pb-3">
                          <p className="text-[10px] text-slate-400 italic leading-normal max-w-sm font-semibold">
                            Cung cấp phác thảo tự truyện ở mục Học tập quân hệ, dã thuật AI sẽ băm sinh Character Sheet thông minh tự động.
                          </p>
                          <button
                            type="button"
                            onClick={handleAiGenKnowledge}
                            disabled={isGeneratingTarget || !characterData.knowledge_train?.trim()}
                            className="py-1.5 px-3 bg-[#0d1220] border border-[#141b2c]/15 text-sky-400 font-bold font-mono text-[9px] rounded-xl uppercase tracking-wider shadow-[2px_2px_4px_rgba(3,4,8,0.6),_-2px_-2px_4px_rgba(25,35,58,0.2)] active:shadow-inner transition-all inline-flex items-center gap-1 shrink-0 disabled:opacity-40"
                          >
                            AI Structurize
                          </button>
                        </div>
                        <CharacterSheetEditor
                          data={characterData}
                          onChange={handleCharacterSheetChange}
                        />
                      </div>
                    ) : (
                      <div className="bg-[#090d18] rounded-2xl shadow-[inset_3px_3px_7px_rgba(3,4,8,0.75),_inset_-3px_-3px_7px_rgba(25,35,58,0.15)] border border-[#0d1220]/50 p-4">
                        <textarea
                          value={formData.text || ""}
                          onChange={(e) => onChange("text", e.target.value)}
                          className="w-full h-[330px] bg-transparent outline-none border-none text-xs sm:text-sm text-slate-100 font-sans leading-relaxed resize-y font-semibold"
                          placeholder="Mở khố dã sử, biên chép thần tích dã thiết cốt truyện... Đầy đủ hỗ trợ Markdown..."
                        />
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 2: TRIGGER SENSORS LOGIC & DIAGRAM */}
              {activeTab === 'trigger' && (
                <div className="space-y-6 animate-fadeIn text-left">
                  
                  {/* Neumorphic 4-way trigger logic selection grids */}
                  <div className="space-y-3 p-5 bg-[#0d1220] border border-[#141b2c]/15 rounded-2xl shadow-[3px_3px_8px_rgba(3,4,8,0.6),_-3px_-3px_8px_rgba(25,35,58,0.2)]">
                    <span className="text-[9px] font-mono font-black uppercase text-slate-401 tracking-widest block">
                      Hệ Pháp Cảm Ứng (Sensory Trigger Logic Engine)
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { mode: "always", label: "Always-On", desc: "Luôn chèn cứng bất chấp xoay chuyển dã thế.", icon: "🔴" },
                        { mode: "keyword", label: "Keyword Match", desc: "Chỉ rớt nạp khi vấp trúng hạt từ khóa gốc thoại.", icon: "🟡" },
                        { mode: "semantic", label: "Semantic Smart", desc: "Phát hiện đối sóng dã sử ngữ nghĩa gián tiếp.", icon: "🟣" },
                        { mode: "hybrid", label: "Hybrid Unified", desc: "Gộp cả song phương đảm bảo cốt hệ vững như đồng.", icon: "🟢" }
                      ].map((item) => {
                        const isSelected = (formData.triggerMode || "hybrid") === item.mode;
                        return (
                          <button
                            key={item.mode}
                            type="button"
                            onClick={() => onChange("triggerMode", item.mode)}
                            className={`p-4 rounded-2xl border text-left transition-all ${
                              isSelected
                                ? "bg-[#090d18] border-sky-500 shadow-[inset_3px_3px_5px_rgba(3,4,8,0.8),_inset_-3px_-3px_5px_rgba(25,35,58,0.15)]"
                                : "bg-[#0d1220] border-[#141b2c]/15 shadow-[3px_3px_6px_rgba(3,4,8,0.6),_-3px_-3px_6px_rgba(25,35,58,0.2)] hover:border-sky-500/20"
                            }`}
                          >
                            <div className="flex justify-between items-center text-xs font-black text-slate-100 mb-1">
                              <span className={`font-sans ${isSelected ? 'text-sky-400' : 'text-slate-250'}`}>{item.label}</span>
                              <span className="text-[10px]">{item.icon}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">{item.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tag system: Neumorphic chips container */}
                  <div className="bg-[#0d1220] p-5 rounded-2xl border border-[#141b2c]/15 shadow-[3px_3px_8px_rgba(3,4,8,0.6),_-3px_-3px_8px_rgba(25,35,58,0.2)] space-y-3.5">
                    <span className="text-[9px] font-mono font-black uppercase text-slate-401 tracking-widest block">
                      Hạt cảm ứng phụ / Trigger Tags (Phân chia song tấu bằng dấu phẩy)
                    </span>
                    
                    {/* Visual Recessed Chips block */}
                    <div className="flex flex-wrap gap-2 p-3 bg-[#090d18] border border-[#141b2c]/10 rounded-xl min-h-[50px] shadow-[inset_2.5px_2.5px_5px_rgba(3,4,8,0.7),_inset_-2.5px_-2.5px_5px_rgba(25,35,58,0.12)]">
                      {(!formData.keywords || formData.keywords.length === 0) ? (
                        <span className="text-[10px] text-slate-500 italic p-1">Chưa gán mắt xích từ khóa dã hợp kích hoạt.</span>
                      ) : (
                        formData.keywords.map((chip, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#0d1220] text-sky-400 border border-[#141b2c]/15 rounded-lg text-[10px] font-mono font-bold shadow-[2px_2px_4px_rgba(3,4,8,0.55),_-1px_-1px_3px_rgba(255,255,255,0.05)]"
                          >
                            #{chip}
                            <button
                              type="button"
                              onClick={() => handleRemoveKeywordBadge(idx)}
                              className="text-sky-400 hover:text-red-400 font-black ml-1 scale-95"
                              title="Hủy găm"
                            >
                              ✕
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Quick Inline Tag Addition Form */}
                    <form onSubmit={handleAddKeywordFromInput} className="flex gap-2.5">
                      <div className="flex-1 bg-[#090d18] rounded-xl shadow-[inset_2.5px_2.5px_5px_rgba(3,4,8,0.7),_inset_-2.5px_-2.5px_5px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 flex items-center">
                        <input
                          type="text"
                          value={newKeywordInput}
                          onChange={(e) => setNewKeywordInput(e.target.value)}
                          placeholder="Nhập thẻ rồi nhấn Enter..."
                          className="w-full bg-transparent outline-none border-none text-xs text-slate-100 placeholder-slate-500 font-sans font-medium"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#0d1220] border border-[#141b2c]/15 text-sky-450 hover:text-sky-300 font-bold text-xs rounded-xl shadow-[2px_2px_4px_rgba(3,4,8,0.6),_-2px_-2px_4px_rgba(25,35,58,0.2)] active:shadow-inner transition-all flex items-center justify-center shrink-0"
                      >
                        + Găm
                      </button>
                    </form>
                  </div>

                  {/* Clickable Prompt Stack Position Visual Guide Map */}
                  <div className="bg-[#0d1220] p-5 rounded-2xl border border-[#141b2c]/15 shadow-[3px_3px_8px_rgba(3,4,8,0.6),_-3px_-3px_8px_rgba(25,35,58,0.2)] space-y-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono font-black uppercase text-slate-401 tracking-widest block">
                        Khai định Điểm Bơm (Insertion Stack Scheme)
                      </span>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                        Cấu định vị trí dệt chính sác giúp các tầng thần thức AI không bị nhồi rối loạn.
                      </p>
                    </div>

                    {/* Stack Layout map representation */}
                    <div className="flex flex-col gap-1.5 border border-[#141b2c]/10 bg-[#090d18] p-3 rounded-2xl font-mono text-[9px] text-slate-300 uppercase font-black shadow-[inset_3px_3px_6px_rgba(3,4,8,0.7),_inset_-3px_-3px_6px_rgba(25,35,58,0.15)]">
                      <div className="px-3 py-1.5 border border-dashed border-[#141b2c]/20 bg-[#0d1220]/20 rounded-lg text-center text-slate-500 font-bold">
                        Hệ Mệnh Lệnh Gốc / System Instructions
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => onChange("position", "before_char")}
                        className={`p-2.5 border rounded-xl transition-all text-center ${
                          (formData.position || "before_char") === "before_char"
                            ? "border-sky-500 text-sky-400 bg-[#0d1220] shadow-[3px_3px_6px_rgba(3,4,8,0.6),_-2px_-2px_5px_rgba(25,35,58,0.2)]"
                            : "border-transparent text-slate-450 hover:text-slate-200"
                        }`}
                      >
                        ✦ Before Characters (Trước tả cách NPC)
                      </button>

                      <div className="px-3 py-1.5 border border-dashed border-[#141b2c]/20 bg-[#0d1220]/20 rounded-lg text-center text-slate-500 font-bold">
                        Hồ Sơ Nhân Vật / Characters Sheet
                      </div>

                      <button
                        type="button"
                        onClick={() => onChange("position", "after_char")}
                        className={`p-2.5 border rounded-xl transition-all text-center ${
                          (formData.position || "before_char") === "after_char"
                            ? "border-sky-500 text-sky-400 bg-[#0d1220] shadow-[3px_3px_6px_rgba(3,4,8,0.6),_-2px_-2px_5px_rgba(25,35,58,0.2)]"
                            : "border-transparent text-slate-450 hover:text-slate-200"
                        }`}
                      >
                        ✦ After Characters (Xen sau nhân khí)
                      </button>

                      <button
                        type="button"
                        onClick={() => onChange("position", "before_history")}
                        className={`p-2.5 border rounded-xl transition-all text-center ${
                          (formData.position || "before_char") === "before_history"
                            ? "border-sky-500 text-sky-400 bg-[#0d1220] shadow-[3px_3px_6px_rgba(3,4,8,0.6),_-2px_-2px_5px_rgba(25,35,58,0.2)]"
                            : "border-transparent text-slate-450 hover:text-slate-200"
                        }`}
                      >
                        ✦ Before Chat History (Xếp phủ đầu Biên niên thoại)
                      </button>

                      <div className="px-3 py-1.5 border border-dashed border-[#141b2c]/20 bg-[#0d1220]/20 rounded-lg text-center text-slate-500 font-bold">
                        Hộp Thoại Đối Sáp / Conversation Timeline
                      </div>

                      <button
                        type="button"
                        onClick={() => onChange("position", "after_history")}
                        className={`p-2.5 border rounded-xl transition-all text-center ${
                          (formData.position || "before_char") === "after_history"
                            ? "border-sky-500 text-sky-400 bg-[#0d1220] shadow-[3px_3px_6px_rgba(3,4,8,0.6),_-2px_-2px_5px_rgba(25,35,58,0.2)]"
                            : "border-transparent text-slate-450 hover:text-slate-200"
                        }`}
                      >
                        ✦ After Chat History / Author Notes (Cuối gối - Cảm ứng lẫy cực)
                      </button>

                      <button
                        type="button"
                        onClick={() => onChange("position", "in_chat")}
                        className={`p-2.5 border rounded-xl transition-all text-center ${
                          (formData.position || "before_char") === "in_chat"
                            ? "border-sky-500 text-sky-400 bg-[#0d1220] shadow-[3px_3px_6px_rgba(3,4,8,0.6),_-2px_-2px_5px_rgba(25,35,58,0.2)]"
                            : "border-transparent text-slate-450 hover:text-slate-200"
                        }`}
                      >
                        ✦ In-Chat Depth (Nạp lặn hốc tin cũ dã thế)
                      </button>
                    </div>

                    {formData.position === "in_chat" && (
                      <div className="pt-2 animate-fadeIn flex flex-col gap-1.5 text-xs font-mono">
                        <div className="flex justify-between items-center text-slate-450 tracking-widest text-[9px] uppercase font-bold">
                          Độ lặn sâu lùi chèn thoại:
                          <span className="text-sky-450 font-black">{formData.depth || 0} tin cũ trước</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="10"
                            value={formData.depth || 0}
                            onChange={(e) => onChange("depth", parseInt(e.target.value) || 0)}
                            className="flex-1 accent-sky-500 select-none bg-[#090d18] h-1.5 rounded-full outline-none"
                          />
                          <span className="font-sans text-xs font-black text-sky-400 w-6 text-right">{(formData.depth || 0)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Priority Rating / Tier selection panel */}
                  <div className="bg-[#0d1220] p-5 rounded-2xl border border-[#141b2c]/15 shadow-[3px_3px_8px_rgba(3,4,8,0.6),_-3px_-3px_8px_rgba(25,35,58,0.2)] space-y-4">
                    <div className="flex justify-between items-baseline flex-wrap gap-2">
                      <span className="text-[9px] font-mono font-black uppercase text-slate-401 tracking-widest block">
                        Độ Chèn Chèn / Preference Priority
                      </span>
                      <span className="text-[10px] font-mono font-bold text-sky-400 bg-[#090d18] px-2.5 py-0.5 rounded-lg border border-[#141b2c]/10">
                        {priorityTier.text} (Trọng số: {formData.priority || 50}%)
                      </span>
                    </div>

                    <div className="flex bg-[#090d18] p-1.5 border border-[#141b2c]/10 rounded-2xl shadow-[inset_2.5px_2.5px_5px_rgba(3,4,8,0.7),_inset_-2.5px_-2.5px_5px_rgba(25,35,58,0.12)] gap-1">
                      {(["D", "C", "B", "A", "S"] as const).map((tier) => {
                        const isActive = priorityTier.class === tier;
                        return (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => setPriorityByTier(tier)}
                            className={`flex-1 py-1.5 text-[10px] font-mono font-black uppercase rounded-lg transition-all ${
                              isActive
                                ? 'bg-[#0d1220] text-sky-400 shadow-[2px_2px_4px_rgba(3,4,8,0.65),_-1px_-1px_3px_rgba(255,255,255,0.05)] border border-[#141b2c]/15'
                                : 'text-slate-405 hover:text-slate-200'
                            }`}
                          >
                            {tier}-Tier
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-2 pt-1 select-none">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={formData.priority || 50}
                        onChange={(e) => onChange("priority", parseInt(e.target.value))}
                        className="w-full bg-[#090d18] h-1.5 rounded-full outline-none accent-sky-500"
                      />
                      <span className="text-[9px] text-slate-500 italic block leading-relaxed font-semibold">
                        * Trọng lượng bốc ngẫu. Khi kịch dã bối cảnh đạt giới hạn Token dài lâu, các dòng bách khoa Tier cao hơn sẽ được giữ lại, đè nén các mục ưu tiên nhỏ.
                      </span>
                    </div>

                    {/* Sensor switches inside editor */}
                    <div className="grid grid-cols-2 gap-4 pt-3.5 border-t border-[#141b2c]/10 text-xs">
                      <label className="flex items-center gap-2.5 p-3.5 bg-[#0d1220] border border-[#141b2c]/15 rounded-2xl hover:border-sky-500/20 shadow-[2px_2px_5px_rgba(3,4,8,0.6),_-2px_-2px_5px_rgba(25,35,58,0.22)] active:shadow-inner cursor-pointer select-none transition-all">
                        <input
                          type="checkbox"
                          checked={formData.isEnabled ?? true}
                          onChange={(e) => onChange("isEnabled", e.target.checked)}
                          className="accent-sky-500 w-3.5 h-3.5 rounded cursor-pointer"
                        />
                        <div className="text-left font-mono">
                          <span className="text-[10px] block font-black text-slate-205">ENABLED</span>
                          <span className="text-[8px] text-slate-450 block font-bold">mở liên ứng bối cảnh</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-3.5 bg-[#0d1220] border border-[#141b2c]/15 rounded-2xl hover:border-sky-500/20 shadow-[2px_2px_5px_rgba(3,4,8,0.6),_-2px_-2px_5px_rgba(25,35,58,0.22)] active:shadow-inner cursor-pointer select-none transition-all">
                        <input
                          type="checkbox"
                          checked={formData.isSticky ?? false}
                          onChange={(e) => onChange("isSticky", e.target.checked)}
                          className="accent-sky-500 w-3.5 h-3.5 rounded cursor-pointer"
                        />
                        <div className="text-left font-mono">
                          <span className="text-[10px] block font-black text-slate-205">PIN STICKY</span>
                          <span className="text-[8px] text-slate-450 block font-bold">hằng tri găm bối cảnh</span>
                        </div>
                      </label>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 3: RPG TEXTBOOK ATTRIBUTES & LINKS */}
              {activeTab === 'stats_network' && (
                <div className="space-y-6 animate-fadeIn text-left">
                  
                  {/* RPG Technical stats attributes panel */}
                  {formData.category !== "character" && (
                    <div className="bg-[#0d1220] border border-[#141b2c]/15 rounded-2xl overflow-hidden shadow-[3px_3px_8px_rgba(3,4,8,0.6),_-3px_-3px_8px_rgba(25,35,58,0.2)]">
                      <div className="px-5 py-3.5 flex items-center justify-between border-b border-[#141b2c]/10 bg-[#0d1220]">
                        <span className="flex items-center gap-1.5 font-sans font-black text-xs text-sky-400 uppercase tracking-wide">
                          <Activity size={12} className="text-sky-450 animate-pulse animate-bounce" />
                          Thuộc Tính Chỉ Số (RPG Lore Core Attributes)
                        </span>
                        <button
                          type="button"
                          onClick={handleAiAutoExtractStats}
                          disabled={isAiProcessing || !(formData.text || "").trim()}
                          className="py-1.5 px-3 bg-[#0d1220] hover:text-sky-300 disabled:opacity-40 text-[9px] text-[#38bdf8] font-mono font-black rounded-xl border border-[#141b2c]/15 shadow-[2px_2px_4px_rgba(3,4,8,0.6),_-2px_-2px_4px_rgba(25,35,58,0.2)] active:shadow-inner transition-all flex items-center gap-1 shrink-0"
                        >
                          <Sparkles size={10} /> AI Auto-Fill
                        </button>
                      </div>

                      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        {formData.category === "location" && (
                          <>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Khí hậu / Climate</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 text-xs">
                                <input type="text" value={getRpgAttrs().climate || ""} onChange={(e) => handleRpgAttrChange("climate", e.target.value)} placeholder="Mù sương băng giá..." className="w-full bg-transparent outline-none border-none text-slate-100 placeholder-slate-500 font-medium" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Tộc trưởng/Cai quản (Ruler)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 text-xs">
                                <input type="text" value={getRpgAttrs().ruler || ""} onChange={(e) => handleRpgAttrChange("ruler", e.target.value)} placeholder="Magnus Đạo Giáo Vương..." className="w-full bg-transparent outline-none border-none text-slate-100 placeholder-slate-500 font-medium" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Cư dân định cư (Population)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 text-xs">
                                <input type="text" value={getRpgAttrs().population || ""} onChange={(e) => handleRpgAttrChange("population", e.target.value)} placeholder="Tuyết linh nhân tộc..." className="w-full bg-transparent outline-none border-none text-slate-100 placeholder-slate-500 font-medium" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Cấp Độ Nguy Hại (Hazard Rating)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 px-2.5 py-1 text-xs">
                                <select value={getRpgAttrs().danger_level || "B"} onChange={(e) => handleRpgAttrChange("danger_level", e.target.value)} className="w-full bg-transparent outline-none border-none text-slate-200 py-1 cursor-pointer">
                                  <option value="Safe" className="bg-[#090d18]">S (Safe) - Tuyệt đối An toàn</option>
                                  <option value="D" className="bg-[#090d18]">D - Thấp</option>
                                  <option value="C" className="bg-[#090d18]">C - Trung bình</option>
                                  <option value="B" className="bg-[#090d18]">B - Nguy cơ rình dập</option>
                                  <option value="A" className="bg-[#090d18]">A - Nguy cơ khốc quỷ</option>
                                  <option value="S_class" className="bg-[#090d18]">S_Class - Tử địa kịch phong</option>
                                </select>
                              </div>
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Kỳ địa đáng lưu lý (Landmarks)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 text-xs">
                                <input type="text" value={getRpgAttrs().points_of_interest || ""} onChange={(e) => handleRpgAttrChange("points_of_interest", e.target.value)} placeholder="Tháp đá lam, đầm thủy hoàng hoang lãng..." className="w-full bg-transparent outline-none border-none text-slate-100 placeholder-slate-500 font-medium" />
                              </div>
                            </div>
                          </>
                        )}

                        {formData.category === "faction" && (
                          <>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Tộc chủ/Chưởng bôn (Leader)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 text-xs">
                                <input type="text" value={getRpgAttrs().leader || ""} onChange={(e) => handleRpgAttrChange("leader", e.target.value)} placeholder="Raymond Thần Phạt Đao..." className="w-full bg-transparent outline-none border-none text-slate-100 placeholder-slate-500 font-medium" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Bản cung/Tổng phủ (HQ / Base)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 text-xs">
                                <input type="text" value={getRpgAttrs().hq || ""} onChange={(e) => handleRpgAttrChange("hq", e.target.value)} placeholder="Đỉnh núi vách sương..." className="w-full bg-transparent outline-none border-none text-slate-100 placeholder-slate-500 font-medium" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Bản sác lập trường (Alignment)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 text-xs">
                                <input type="text" value={getRpgAttrs().alignment || ""} onChange={(e) => handleRpgAttrChange("alignment", e.target.value)} placeholder="Lawful Evil (Hắc pháp)..." className="w-full bg-transparent outline-none border-none text-slate-100 placeholder-slate-500 font-medium" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Khí chấn chính sỹ (Influence)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 px-2.5 py-1 text-xs">
                                <select value={getRpgAttrs().influence || "Vừa"} onChange={(e) => handleRpgAttrChange("influence", e.target.value)} className="w-full bg-transparent outline-none border-none text-slate-200 py-1 cursor-pointer">
                                  <option value="Nhỏ lẻ" className="bg-[#090d18]">Chi phái nhỏ rêu phách</option>
                                  <option value="Vừa" className="bg-[#090d18]">Xưng cát phong bá bang</option>
                                  <option value="Cao" className="bg-[#090d18]">Uy chân chấn vương triều</option>
                                  <option value="Cực cao" className="bg-[#090d18]">Môn phiệt bá chủ vạn cảnh</option>
                                </select>
                              </div>
                            </div>
                          </>
                        )}

                        {formData.category === "item" && (
                          <>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Pháp loại binh giáp (Item type)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 text-xs">
                                <input type="text" value={getRpgAttrs().item_type || ""} onChange={(e) => handleRpgAttrChange("item_type", e.target.value)} placeholder="Tuyết ảnh thương, phi kiếm..." className="w-full bg-transparent outline-none border-none text-slate-100 placeholder-slate-500 font-medium" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Hồn cổ Phục phẩm (Rarity)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 px-2.5 py-1 text-xs">
                                <select value={getRpgAttrs().rarity || "Hiếm"} onChange={(e) => handleRpgAttrChange("rarity", e.target.value)} className="w-full bg-transparent outline-none border-none text-slate-200 py-1 cursor-pointer">
                                  <option value="Thường" className="bg-[#090d18]">Thường dã (Common)</option>
                                  <option value="Hiếm" className="bg-[#090d18]">Thần dị (Rare)</option>
                                  <option value="Sử thi" className="bg-[#090d18]">Sử thi phong yên</option>
                                  <option value="Truyền thuyết" className="bg-[#090d18]">Cổ dã Truyền Kỳ</option>
                                  <option value="Thần khí" className="bg-[#090d18]">Hồng hoang Thần Linh bảo</option>
                                </select>
                              </div>
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase font-bold text-sky-400">Can hệ pháp kích mây khí (Abilities)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 text-xs">
                                <input type="text" value={getRpgAttrs().abilities || ""} onChange={(e) => handleRpgAttrChange("abilities", e.target.value)} placeholder="Liên chiêu đóng tịnh sông băng khi xuất kiếp..." className="w-full bg-transparent outline-none border-none text-slate-100 placeholder-slate-500 font-medium" />
                              </div>
                            </div>
                          </>
                        )}

                        {formData.category === "event" && (
                          <>
                            <div className="space-y-1.5 sm:col-span-2">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Thời đại kỉ kỉ (Timeline Period)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 text-xs">
                                <input type="text" value={getRpgAttrs().timeline_date || ""} onChange={(e) => handleRpgAttrChange("timeline_date", e.target.value)} placeholder="Năm thứ ba Kỉ Nguyên Đống Băng..." className="w-full bg-transparent outline-none border-none text-slate-100 placeholder-slate-500 font-medium" />
                              </div>
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Lịch tri can dự dã nhân (Actors involved)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 text-xs">
                                <input type="text" value={getRpgAttrs().characters_involved || ""} onChange={(e) => handleRpgAttrChange("characters_involved", e.target.value)} placeholder="A vương Tuyết nữ, kị binh hoang dã..." className="w-full bg-transparent outline-none border-none text-slate-100 placeholder-slate-500 font-medium" />
                              </div>
                            </div>
                          </>
                        )}

                        {formData.category !== "location" && formData.category !== "faction" && formData.category !== "item" && formData.category !== "event" && (
                          <>
                            <div className="space-y-1.5 sm:col-span-2">
                              <label className="text-[9px] font-mono text-slate-400 font-extrabold block uppercase">Căn nguyên nguồn linh (Lore Origin)</label>
                              <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 text-xs">
                                <input type="text" value={getRpgAttrs().origin || ""} onChange={(e) => handleRpgAttrChange("origin", e.target.value)} placeholder="Lập thiết từ dã sử phong lam băng phong..." className="w-full bg-transparent outline-none border-none text-slate-100 placeholder-slate-500 font-medium" />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Related linked entries checklist - Beautifully customized */}
                  {entries.filter(e => e.id !== formData.id).length > 0 && (
                    <div className="bg-[#0d1220] border border-[#141b2c]/15 rounded-2xl overflow-hidden shadow-[3px_3px_8px_rgba(3,4,8,0.6),_-3px_-3px_8px_rgba(25,35,58,0.2)] text-left">
                      <div className="px-5 py-3.5 flex justify-between items-center bg-[#0d1220] border-b border-[#141b2c]/10">
                        <span className="flex items-center gap-1.5 font-sans font-black text-xs text-sky-400 uppercase tracking-wide">
                          <LinkIcon size={12} className="text-sky-400" />
                          Giao Đập Mắt Xích Tri Thức (Encyclopedia Intel Ties)
                        </span>
                        <span className="text-[9px] font-mono font-bold text-sky-400 bg-[#090d18] px-2 py-0.5 rounded border border-[#141b2c]/10">
                          {(formData.relatedEntries || []).length} liên chéo
                        </span>
                      </div>

                      <div className="p-5 space-y-4">
                        <div className="bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2">
                          <input
                            type="text"
                            value={relatedSearchTerm}
                            onChange={(e) => setRelatedSearchTerm(e.target.value)}
                            placeholder="Mõ mẫm dã văn liên kết chéo..."
                            className="w-full bg-transparent outline-none border-none text-xs text-slate-100 placeholder-slate-500 font-sans"
                          />
                        </div>

                        {/* Recessed lists of connections */}
                        <div className="max-h-[160px] overflow-y-auto custom-scrollbar border border-[#141b2c]/10 p-3 bg-[#090d18] rounded-2xl space-y-1.5 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.85)]">
                          {entries
                            .filter(e => e.id !== formData.id)
                            .filter(e => !relatedSearchTerm || (e.keyword || "").toLowerCase().includes(relatedSearchTerm.toLowerCase()))
                            .map((e) => {
                              const isLinked = (formData.relatedEntries || []).includes(e.id);
                              return (
                                <button
                                  key={e.id}
                                  type="button"
                                  onClick={() => {
                                    let nextList = [...(formData.relatedEntries || [])];
                                    if (nextList.includes(e.id)) {
                                      nextList = nextList.filter(id => id !== e.id);
                                    } else {
                                      nextList.push(e.id);
                                    }
                                    onChange("relatedEntries", nextList);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all ${
                                    isLinked
                                      ? "bg-[#0d1220] text-sky-400 shadow-[inset_2px_2px_4px_rgba(3,4,8,0.95)] border border-[#0d1220]"
                                      : "hover:bg-[#0d1220]/30 text-slate-400 border border-transparent"
                                  }`}
                                >
                                  <span className="font-sans text-xs font-semibold capitalize">{e.keyword || "Vô danh văn"}</span>
                                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isLinked ? "bg-[#0d1220] border-sky-400 text-sky-450" : "border-[#141b2c]/30 bg-slate-900"}`}>
                                    {isLinked && <Check size={10} strokeWidth={4} />}
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </>
          ) : (
            /* WIZARD FLOW FOR NEW ENTRY - Deep Neumorphic styled flow */
            <div className="space-y-6 animate-fadeIn">
              
              {/* Wizard Steps bar */}
              <div className="flex justify-between items-center bg-[#090d18] p-3 rounded-2xl border border-[#141b2c]/10 text-[9px] font-mono font-bold tracking-widest shadow-[inset_3px_3px_6px_rgba(3,4,8,0.7),_inset_-3px_-3px_6px_rgba(25,35,58,0.15)] mb-3 select-none">
                {[
                  { step: 1, label: "1. Nhãn phân" },
                  { step: 2, label: "2. Thêu tên" },
                  { step: 3, label: "3. Nhập cốt" },
                  { step: 4, label: "4. Điều dã" },
                  { step: 5, label: "5. Khảo ấn" }
                ].map((s) => {
                  const isActive = wizardStep === s.step;
                  const isDone = wizardStep > s.step;
                  return (
                    <div key={s.step} className="flex items-center gap-2 flex-1 justify-center last:flex-initial">
                      <button
                        type="button"
                        onClick={() => wizardStep > s.step && setWizardStep(s.step)}
                        disabled={wizardStep <= s.step}
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border transition-all ${
                          isActive
                            ? "bg-[#0d1220] text-sky-400 border-sky-550 shadow-[2px_2px_4px_rgba(3,4,8,0.75)]"
                            : isDone
                            ? "bg-[#090d18] text-[#38bdf8] border-none shadow-inner"
                            : "bg-[#0d1220] text-slate-500 border-transparent"
                        }`}
                      >
                        {isDone ? "✓" : s.step}
                      </button>
                      <span className={`hidden sm:inline font-mono text-[8px] font-bold uppercase tracking-widest ${isActive ? "text-[#38bdf8]" : isDone ? "text-sky-500/70" : "text-slate-500"}`}>
                        {s.label.split(". ")[1]}
                      </span>
                      {s.step < 5 && <div className="hidden sm:block flex-1 h-px bg-[#141b2c]/10 mx-2" />}
                    </div>
                  );
                })}
              </div>

              {/* Wizard Step 1 */}
              {wizardStep === 1 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1.5 text-left">
                    <h3 className="font-sans text-base font-black text-sky-400 uppercase tracking-widest">Bước 1: Chủng Loại Thư Tịch / Category</h3>
                    <p className="text-xs text-slate-450 font-semibold leading-relaxed">Xác định phân loại bối cảnh để dòng dã sử của bạn tháp kích hợp lý nhất.</p>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {[
                      { key: "character", icon: User, title: "Nhân Vật", desc: "NPC dã dời, nhân vật trung căn" },
                      { key: "location", icon: Globe, title: "Địa Danh", desc: "Thành trì sương, tiên điện, hiểm địa rừng" },
                      { key: "faction", icon: Award, title: "Thế Lực", desc: "Bang dã, môn phiệt cát cứ tòng quân" },
                      { key: "item", icon: Bookmark, title: "Cổ Vật", desc: "Kiếm khí thần binh, vạn bảo linh" },
                      { key: "event", icon: Bookmark, title: "Sự Biến", desc: "Biên niên trận chiến sử dã hoàng gia" },
                      { key: "law", icon: Sliders, title: "Pháp Luật", desc: "Cấm kị ma giáo dã, vật lí cốt luật" },
                      { key: "world", icon: BookOpen, title: "Nhân Thiết", desc: "Địa sinh văn hóa bối thiết chung cuộc" }
                    ].map((categ) => {
                      const isSelected = (formData.category || "world") === categ.key;
                      return (
                        <button
                          key={categ.key}
                          type="button"
                          onClick={() => {
                            onChange("category", categ.key);
                            onChange("rpg_attrs" as any, {});
                          }}
                          className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between h-[125px] ${
                            isSelected
                              ? "bg-[#090d18] border-sky-500 shadow-[inset_3px_3px_5px_rgba(3,4,8,0.85),_inset_-3px_-3px_5px_rgba(25,35,58,0.15)]"
                              : "bg-[#0d1220] border-[#141b2c]/15 shadow-[3px_3px_6px_rgba(3,4,8,0.6),_-3px_-3px_6px_rgba(25,35,58,0.22)] hover:border-sky-500/20"
                          }`}
                        >
                          <div className={`p-1.5 w-7 h-7 rounded-lg border flex items-center justify-center ${isSelected ? "text-sky-400 border-sky-400 bg-[#090d18]" : "text-slate-450 border-[#141b2c]/10 bg-[#090d18]"}`}>
                            {React.createElement(categ.icon || BookOpen, { size: 12 })}
                          </div>
                          <div className="pt-2">
                            <span className="text-[10px] font-black text-slate-100 uppercase tracking-wider block">{categ.title}</span>
                            <span className="text-[8.5px] text-slate-400 leading-normal block mt-0.5 line-clamp-2">{categ.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-4 flex justify-end border-t border-[#141b2c]/10">
                    <button
                      type="button"
                      onClick={() => setWizardStep(2)}
                      className="px-6 py-2.5 bg-[#0d1220] border border-[#141b2c]/15 text-sky-450 hover:text-sky-305 font-black text-xs uppercase tracking-widest rounded-xl hover:translate-y-[-1px] transition-all flex items-center gap-1.5 shadow-[3px_3px_6px_rgba(3,4,8,0.6),_-3px_-3px_5px_rgba(25,35,58,0.2)]"
                    >
                      Tiếp tục Bước 2 →
                    </button>
                  </div>
                </div>
              )}

              {/* Wizard Step 2 */}
              {wizardStep === 2 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1.5 text-left">
                    <h3 className="font-sans text-base font-black text-sky-400 uppercase tracking-widest">Bước 2: Sắc Lệnh Danh Xưng / Title & Keywords</h3>
                    <p className="text-xs text-slate-450 font-semibold leading-relaxed">Hãy chọn từ khóa chính thích và kích phụ thích ứng để nạp dã sử.</p>
                  </div>

                  <div className="bg-[#000000]/10 p-5 rounded-2xl border border-[#141b2c]/15 shadow-[3px_3px_8px_rgba(3,4,8,0.6),_-3px_-3px_8px_rgba(25,35,58,0.2)] space-y-4">
                    <div className="space-y-2 text-left">
                      <label className="text-[9px] font-mono font-black uppercase text-slate-400 tracking-widest block">Từ khóa chính / Title (Bắt buộc)</label>
                      <div className="bg-[#090d18] rounded-xl shadow-[inset_2.5px_2.5px_5px_rgba(3,4,8,0.7),_inset_-2.5px_-2.5px_5px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-3">
                        <input
                          type="text"
                          value={formData.keyword || ""}
                          onChange={(e) => onChange("keyword", e.target.value)}
                          placeholder="Vd: Hiệp sĩ Galahad, Eldoria..."
                          className="w-full bg-transparent outline-none border-none text-xs font-sans font-black text-slate-100 placeholder-slate-600"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 text-left pt-2">
                      <label className="text-[9px] font-mono font-black uppercase text-slate-400 tracking-widest block">Thẻ từ khóa kích hoạt phụ (Gõ phân tách bằng phẩy)</label>
                      <div className="bg-[#090d18] rounded-xl shadow-[inset_2.5px_2.5px_5px_rgba(3,4,8,0.7),_inset_-2.5px_-2.5px_5px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2.5">
                        <input
                          type="text"
                          value={keywordsText}
                          onChange={(e) => handleKeywordsChange(e.target.value)}
                          placeholder="Vd: galahad, thanh kiếm bão..."
                          className="w-full bg-transparent outline-none border-none text-xs text-slate-100 placeholder-slate-600 font-semibold"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {(formData.keywords || []).map((badge, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#0d1220] text-sky-400 border border-[#141b2c]/15 rounded-lg text-[10px] font-mono font-bold shadow-[2px_2px_4px_rgba(3,4,8,0.55),_-1px_-1px_3px_rgba(255,255,255,0.05)]">
                            #{badge}
                            <button type="button" onClick={() => handleRemoveKeywordBadge(idx)} className="text-sky-400 hover:text-red-500 font-black ml-1">✕</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-between border-t border-[#141b2c]/10">
                    <button
                      type="button"
                      onClick={() => setWizardStep(1)}
                      className="px-5 py-2.5 bg-[#0d1220] border border-[#141b2c]/15 text-xs font-mono text-slate-400 hover:text-slate-105 font-bold uppercase rounded-xl transition-all shadow-[2px_2px_4px_rgba(3,4,8,0.6)]"
                    >
                      ← Trở lại Bước 1
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardStep(3)}
                      disabled={!formData.keyword?.trim()}
                      className="px-6 py-2.5 bg-[#0d1220] border border-transparent disabled:opacity-40 text-sky-405 font-bold font-mono uppercase text-xs tracking-widest rounded-xl shadow-[3px_3px_6px_rgba(3,4,8,0.65),_-3px_-3px_5px_rgba(25,35,58,0.2)] active:shadow-inner transition-all whitespace-nowrap"
                    >
                      Tiếp tục Bước 3 →
                    </button>
                  </div>
                </div>
              )}

              {/* Wizard Step 3 */}
              {wizardStep === 3 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1.5 text-left">
                    <h3 className="font-sans text-base font-black text-sky-400 uppercase tracking-widest">Bước 3: Biên lý văn trạng / Description</h3>
                    <p className="text-xs text-slate-450 font-semibold leading-relaxed">Ghi chép sử hoặc nhồi dã thuật cho AI dựng tức thới.</p>
                  </div>

                  {formData.category === "character" ? (
                    <div className="space-y-4">
                      <div className="bg-[#000000]/10 p-4 rounded-xl border border-[#141b2c]/15 space-y-3">
                        <span className="text-[9px] font-mono uppercase text-slate-400 font-extrabold tracking-widest block">AI Scribe Character Draftsman</span>
                        <div className="space-y-2">
                          <div className="bg-[#090d18] rounded-xl shadow-[inset_2.5px_2.5px_5px_rgba(3,4,8,0.7),_inset_-2.5px_-2.5px_5px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2.5">
                            <textarea
                              value={characterData?.knowledge_train || ""}
                              onChange={(e) => handleCharacterSheetChange("knowledge_train", e.target.value)}
                              placeholder="Gõ nháp sơ sinh nhân hình (Vd: Nhân tộc độc hành đại tòng kiếm hiệp, có can oán môn quy)..."
                              rows={4}
                              className="w-full bg-transparent outline-none border-none text-xs text-slate-100 font-sans"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleAiGenKnowledge}
                            disabled={isGeneratingTarget || !(characterData?.knowledge_train || "").trim()}
                            className="w-full py-2 bg-[#0d1220] border border-[#141b2c]/15 text-[#38bdf8] hover:text-[#7dd3fc] disabled:opacity-40 text-xs font-bold rounded-xl shadow-[2px_2px_4px_rgba(3,4,8,0.6)] active:shadow-inner transition-all flex items-center justify-center gap-1.5"
                          >
                            <Sparkles size={11} /> {isGeneratingTarget ? "Mổ xẻ xây hồ sơ..." : "✓ Trích Xuất Nhân Vật Bằng AI Scribe"}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 text-left">
                        <label className="text-[9px] font-mono text-slate-401 uppercase font-black block">Character Payload (JSON Specs)</label>
                        <div className="bg-[#090d18] rounded-xl shadow-[inset_3px_3px_5px_rgba(3,4,8,0.75)] border border-[#0d1220]/50 p-3">
                          <textarea
                            value={formData.text || ""}
                            onChange={(e) => onChange("text", e.target.value)}
                            placeholder="JSON payload bản sắc..."
                            rows={8}
                            className="w-full bg-transparent outline-none border-none text-xs text-slate-100 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-[#000000]/10 p-4 border border-[#141b2c]/15 rounded-xl space-y-3">
                        <span className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-widest block flex items-center gap-1">
                          <Sparkles size={11} className="text-[#38bdf8] animate-pulse" />
                          AI Scribe Ideology
                        </span>
                        <div className="flex gap-2">
                          <div className="flex-1 bg-[#090d18] rounded-xl shadow-[inset_2px_2px_4px_rgba(3,4,8,0.7),_inset_-2px_-2px_4px_rgba(25,35,58,0.12)] border border-[#0d1220]/50 p-2 text-xs flex items-center">
                            <input
                              type="text"
                              value={aiIdeaPrompt}
                              onChange={(e) => setAiIdeaPrompt(e.target.value)}
                              placeholder="Ý tưởng tóm cổ (Vd: Võ phái lâu đài cát, chuyên tập kiếm khí sương lam)..."
                              className="w-full bg-transparent border-none outline-none text-xs text-slate-200 placeholder-slate-600"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleAiDraftFromIdea}
                            disabled={isAiProcessing || !aiIdeaPrompt.trim() || !formData.keyword?.trim()}
                            className="px-4 py-2 bg-[#0d1220] border border-[#141b2c]/15 text-sky-400 disabled:opacity-40 font-black text-xs rounded-xl flex items-center gap-1 shrink-0 h-9 transition-all"
                          >
                            Dệt
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 text-left">
                        <label className="text-[9px] font-mono text-slate-400 tracking-widest block uppercase font-bold">Văn bản ký sử bách khoa (Markdown)</label>
                        <div className="bg-[#090d18] rounded-xl shadow-[inset_3px_3px_6px_rgba(3,4,8,0.75)] border border-[#0d1220]/50 p-3">
                          <textarea
                            value={formData.text || ""}
                            onChange={(e) => onChange("text", e.target.value)}
                            placeholder="Chép sử bối cảnh..."
                            rows={9}
                            className="w-full bg-transparent border-none outline-none text-xs text-slate-105 font-sans leading-relaxed resize-y"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 flex justify-between border-t border-[#141b2c]/10">
                    <button
                      type="button"
                      onClick={() => setWizardStep(2)}
                      className="px-5 py-2.5 bg-[#0d1220] border border-[#141b2c]/15 text-xs font-mono text-slate-400 hover:text-slate-105 font-bold uppercase rounded-xl transition-all"
                    >
                      ← Trở lại Bước 2
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardStep(4)}
                      disabled={!formData.text?.trim()}
                      className="px-6 py-2.5 bg-[#0d1220] border border-transparent disabled:opacity-40 text-sky-405 font-bold font-mono uppercase tracking-widest rounded-xl hover:translate-y-[-1px] transition-all whitespace-nowrap"
                    >
                      Tiếp tục Bước 4 →
                    </button>
                  </div>
                </div>
              )}

              {/* Wizard Step 4 */}
              {wizardStep === 4 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1.5 text-left">
                    <h3 className="font-sans text-base font-black text-sky-400 uppercase tracking-widest">Bước 4: Điều lệnh cảm kích và Tầng Ưu Tiên</h3>
                    <p className="text-xs text-slate-450 font-semibold leading-relaxed">Chọn phương châm cảm kích bối cảnh thoại.</p>
                  </div>

                  {/* Sensory modes select */}
                  <div className="space-y-2 pt-1 text-left">
                    <span className="text-[9px] font-mono uppercase text-slate-400 font-extrabold tracking-widest block">1. Phương pháp trigger cảm biến</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { key: "always", emoji: "🔴 Always", title: "Always-ON", desc: "Luôn nạp cứng" },
                        { key: "keyword", emoji: "🟡 Keyword", title: "Trùng từ", desc: "Khớp từ khóa bối cảnh" },
                        { key: "semantic", emoji: "🟣 Semantic", title: "Cảm ứng ngữ nghĩa", desc: "Đo dã định định lượng" },
                        { key: "hybrid", emoji: "🟢 Hybrid", title: "Quy pháp hợp", desc: "Đồng bộ hóa nhãn cốt" }
                      ].map((m) => {
                        const isSelected = (formData.triggerMode || "hybrid") === m.key;
                        return (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => onChange("triggerMode", m.key)}
                            className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between h-[115px] ${
                              isSelected
                                ? "bg-[#090d18] border-sky-500 shadow-[inset_2.5px_2.5px_4px_rgba(3,4,8,0.7)]"
                                : "bg-[#0d1220] border-[#141b2c]/15 shadow-[3px_3px_5px_rgba(3,4,8,0.6),_-2px_-2px_4px_rgba(25,35,58,0.22)] hover:border-sky-500/20"
                            }`}
                          >
                            <span className="text-xs">{m.emoji}</span>
                            <div className="pt-2">
                              <span className="text-[9px] font-black text-slate-100 uppercase block tracking-wider leading-none">{m.title}</span>
                              <span className="text-[8px] text-slate-405 block mt-1 leading-tight">{m.desc}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Position Selecting */}
                  <div className="space-y-2.5 pt-2 text-left">
                    <span className="text-[9px] font-mono uppercase text-slate-400 font-extrabold tracking-widest block">2. Điểm dán bối cảnh dã sữ (Insertion Block)</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#090d18] p-3 rounded-2xl border border-[#141b2c]/10 shadow-[inset_2.5px_2.5px_5px_rgba(3,4,8,0.75)]">
                      {[
                        { key: "before_char", title: "Character Profile" },
                        { key: "after_char", title: "Sau Nhân Thiết" },
                        { key: "before_history", title: "Trực Biên Nhật thoại" },
                        { key: "in_chat", title: "Nạp dầm trong Chat" }
                      ].map((pos) => {
                        const isSelected = (formData.position || "before_char") === pos.key;
                        return (
                          <button
                            key={pos.key}
                            type="button"
                            onClick={() => onChange("position", pos.key)}
                            className={`py-2 px-3 text-center rounded-xl text-[9px] font-mono font-black border transition-all ${
                              isSelected
                                ? "bg-[#0d1220] text-sky-400 border-sky-550 shadow-[2px_2px_4px_rgba(3,4,8,0.7)]"
                                : "bg-[#090d18] text-slate-500 border-transparent hover:text-slate-200"
                            }`}
                          >
                            {pos.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-[#0d1220] p-4 rounded-xl border border-[#141b2c]/15 shadow-[2px_2px_5px_rgba(3,4,8,0.6)] space-y-3.5 pt-2 text-left">
                    <div className="flex justify-between items-baseline flex-wrap gap-2">
                      <span className="text-[9px] font-mono text-slate-400 font-extrabold block">3. Hệ tầng ưu tiên chèn găm (Priority Tiers)</span>
                      <span className="text-[10px] font-mono font-bold text-[#38bdf8] bg-[#090d18] px-2 py-0.5 rounded border border-[#141b2c]/10">{priorityTier.text} ({formData.priority || 50}%)</span>
                    </div>
                    <div className="flex bg-[#090d18] p-1 rounded-xl shadow-inner gap-1">
                      {(["D", "C", "B", "A", "S"] as const).map((tier) => {
                        const isActive = priorityTier.class === tier;
                        return (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => setPriorityByTier(tier)}
                            className={`flex-1 py-1 text-[9px] font-mono font-black uppercase rounded ${
                              isActive ? 'bg-[#0d1220] text-sky-400 shadow-[1px_1px_3px_rgba(3,4,8,0.65)]' : 'text-slate-450 hover:text-slate-200'
                            }`}
                          >
                            {tier}-Tier
                          </button>
                        );
                      })}
                    </div>
                    <div className="pt-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={formData.priority || 50}
                        onChange={(e) => onChange("priority", parseInt(e.target.value))}
                        className="w-full bg-[#090d18] h-1 rounded-full outline-none accent-sky-500"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-between border-t border-[#141b2c]/10">
                    <button
                      type="button"
                      onClick={() => setWizardStep(3)}
                      className="px-5 py-2.5 bg-[#0d1220] border border-[#141b2c]/15 text-xs font-mono text-slate-400 hover:text-slate-105 font-bold uppercase rounded-xl transition-all"
                    >
                      ← Trở lại Bước 3
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardStep(5)}
                      className="px-6 py-2.5 bg-[#0d1220] border border-transparent text-[#38bdf8] font-bold font-mono uppercase text-xs tracking-widest rounded-xl shadow-[3px_3px_6px_rgba(3,4,8,0.65),_-3px_-3px_5px_rgba(25,35,58,0.2)] active:shadow-inner"
                    >
                      Tiếp tục Bước 5 →
                    </button>
                  </div>
                </div>
              )}

              {/* Wizard Step 5 */}
              {wizardStep === 5 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1.5 text-left">
                    <h3 className="font-sans text-base font-black text-sky-400 uppercase tracking-widest">Bước 5: Khảo duyệt dã sử & Ấn Kỳ</h3>
                    <p className="text-xs text-slate-450 font-semibold leading-relaxed">Rà soát báo cáo chuẩn đo bãi cổ bối trước khi lưu thư quan.</p>
                  </div>

                  <div className="bg-[#000000]/10 border border-[#141b2c]/15 p-5 rounded-2xl shadow-[3px_3px_8px_rgba(3,4,8,0.6),_-3px_-3px_8px_rgba(25,35,58,0.2)] text-xs space-y-4">
                    <div className="grid grid-cols-2 gap-4 border-b border-[#141b2c]/10 pb-4 text-left">
                      <div>
                        <span className="text-[9px] font-mono text-slate-450 uppercase block font-bold">Từ khóa bối cảnh chính</span>
                        <strong className="text-xs font-sans font-black text-slate-100 uppercase">{formData.keyword || "VÔ DANH THƯ"}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-slate-455 uppercase block font-bold">Thần mục loại</span>
                        <strong className="text-xs font-sans font-black text-[#56bdf8] uppercase">{formData.category?.toUpperCase() || "WORLD"}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-slate-455 uppercase block font-bold">Cảm kích pháp lập</span>
                        <strong className="text-xs font-mono text-slate-200 uppercase">{formData.triggerMode?.toUpperCase() || "HYBRID"}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-slate-455 uppercase block font-bold">Trọng số ưu tiên nạp</span>
                        <strong className="text-xs font-mono text-slate-200 uppercase">{priorityTier.class}-Tier ({(formData.priority || 50)}%)</strong>
                      </div>
                    </div>

                    <div className="space-y-2 text-left">
                      <span className="text-[9px] font-mono uppercase text-slate-400 font-extrabold tracking-wider block">✓ Kết quả phân toán AI Scribe Diagnostic</span>
                      <div className="p-3 bg-[#090d18] border border-[#141b2c]/10 rounded-xl space-y-1.5 font-mono text-[9px] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.8)]">
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                          <span>✓</span>
                          <span>Dung dung tích văn trạng: ~{Math.round((formData.text?.length || 0)/3.8)} Tokens (Tuyệt hảo)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sky-400 font-semibold">
                          <span>✦</span>
                          <span>Cảm cảm ứng liên hợp sẵn sấy trừng phong.</span>
                        </div>
                        <div className="flex items-center gap-2 text-amber-400 font-semibold">
                          <span>▲</span>
                          <span>Bảo thủ bối cảnh chân thực để nạp Tháp đúng sọc.</span>
                        </div>
                      </div>
                    </div>

                    {formData.category !== "character" && (
                      <div className="pt-2 border-t border-[#141b2c]/10 flex flex-col sm:flex-row justify-between sm:items-center bg-[#090d18] p-3 rounded-xl border border-[#141b2c]/10 gap-2 shadow-inner">
                        <div className="text-left select-none">
                          <strong className="text-slate-100 block text-[10px] font-black">Khảo dụng thuộc tính RPG</strong>
                          <span className="text-slate-500 text-[8.5px] block font-semibold">Để AI tự lột tả nội dung dã sử và phân bố thuộc hệ điểm dã sỹ.</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleAiAutoExtractStats}
                          disabled={isAiProcessing || !(formData.text || "").trim()}
                          className="py-1.5 px-3 bg-[#0d1220] hover:text-[#38bdf8] text-[#38bdf8] text-[9px] font-mono font-black rounded-lg border border-[#141b2c]/15 shadow-[2px_2px_4px_rgba(3,4,8,0.6)] whitespace-nowrap self-end shrink-0"
                        >
                          Auto Extract Stats ✨
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex justify-between border-t border-[#141b2c]/10">
                    <button
                      type="button"
                      onClick={() => setWizardStep(4)}
                      className="px-5 py-2.5 bg-[#0d1220] border border-[#141b2c]/15 text-xs font-mono text-slate-400 hover:text-slate-101 font-bold uppercase rounded-xl transition-all"
                    >
                      ← Trở lại Bước 4
                    </button>
                    <button
                      type="button"
                      onClick={onSave}
                      disabled={isSaving || isAiProcessing}
                      className="px-8 py-3 bg-[#0d1220] border border-[#141b2c]/15 hover:border-sky-500/30 text-sky-400 font-mono font-black uppercase text-xs tracking-widest rounded-xl hover:translate-y-[-1px] shadow-[4px_4px_9px_rgba(3,4,8,0.7)] active:shadow-inner transition-all flex items-center gap-2"
                    >
                      Lập thư bối truyền thuyết ✓
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* RIGHT COLUMN: The Immersive Live Preview Panel (42% Width) */}
      <div className="hidden lg:flex w-[42%] bg-[#090d18] rounded-[24px] shadow-[inset_4px_4px_8px_rgba(3,4,8,0.8),_inset_-4px_-4px_8px_rgba(25,35,58,0.15)] border border-[#0d1220]/50 flex-col h-full overflow-hidden shrink-0 font-mono relative p-5">
        <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none opacity-5 bg-gradient-to-t from-sky-500/20 to-transparent" />
        
        {/* Preview Title bar - Recessed look inside container */}
        <div className="flex items-center justify-between text-[9px] text-slate-450 shrink-0 font-black tracking-widest uppercase pb-3.5 border-b border-[#141b2c]/10 select-none">
          <span className="flex items-center gap-1.5">
            <Eye size={12} className="text-[#38bdf8] animate-pulse animate-bounce" />
            Văn Thuyết chèn Quy (Context Inject Live Stream)
          </span>
          <span className="text-[8.5px] bg-[#0d1220] px-2 py-0.5 border border-[#141b2c]/10 rounded-lg text-sky-400 font-bold shadow-[inset_1px_1px_2px_rgba(0,0,0,0.6)]">
            Live Stream
          </span>
        </div>

        {/* Live Payload Stream container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pt-4 text-left relative flex flex-col justify-between">
          <div className="space-y-3.5 flex-1 flex flex-col h-full">
            <span className="text-[8.5px] uppercase tracking-widest text-slate-500 block font-bold leading-relaxed">
              Trấu tấu bách khoa toàn thư sẽ tự động chuyển hóa và dán dập đầu hốc bối cảnh NPC:
            </span>
            
            {/* Sculpted glowing ledger display sheet */}
            <div className="flex-1 bg-[#050810] border border-[#141b2c]/15 rounded-2xl p-4 font-mono text-[10px] text-slate-350 leading-relaxed overflow-y-auto custom-scrollbar whitespace-pre-wrap select-text h-[400px] shadow-[inset_2.5px_2.5px_5px_rgba(0,0,0,0.9)]">
              {contextInjectionPreviewText}
            </div>
          </div>

          <div className="pt-3 border-t border-[#141b2c]/10 text-[8.5px] text-slate-500 leading-relaxed italic select-none">
            * Minh văn dã sử bách khoa Tháp truyền thuyết ghép đầu mảng bối cảnh NPC ở vị trí <strong className="text-sky-400 underline">{(formData.position || "before_char").toUpperCase()}</strong>.
          </div>
        </div>

      </div>
    </div>
  );
};
