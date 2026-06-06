import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Library,
  Search,
  X,
  Trash2,
  RefreshCw,
  Edit3,
  Plus,
  Save,
  Type,
  BrainCircuit,
  Download,
  Upload,
  AlertOctagon,
  User,
  MapPin,
  Flag,
  Package,
  Heart,
  Calendar,
  Globe,
  Filter,
  BookOpen,
  Star,
  BarChart3,
  TrendingUp,
  Tags,
  ChevronRight,
  Scale,
  Link,
  Activity,
  PanelRight,
  Maximize2,
  Minimize2
} from "lucide-react";
import { dbService, VectorData } from "../../../../services/db/indexedDB";
import { vectorService } from "../../../../services/ai/vectorService";
import { storyBibleService } from "../../../../services/ai/storyBibleService";
import { WorldData, AppSettings } from "../../../../types";
import { useTheme } from "../../../../context/ThemeContext";
import MarkdownRenderer from "../../../common/MarkdownRenderer";
import { ScribeMonitor } from "./encyclopedia/ScribeMonitor";
import { TokenBudgetMonitor } from "./encyclopedia/TokenBudgetMonitor";
import { TriggerDebugger } from "./encyclopedia/TriggerDebugger";
import { EntryEditor } from "./encyclopedia/EntryEditor";
import { EntryListView } from "./encyclopedia/EntryListView";
import { MetadataRetrievalDebugger } from "./encyclopedia/MetadataRetrievalDebugger";
import { EncyclopediaDashboard } from "./encyclopedia/EncyclopediaDashboard";

const CATEGORY_MAP: Record<
  string,
  { label: string; color: string; icon: any }
> = {
  character: {
    label: "Nhân vật",
    color:
      "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50",
    icon: User,
  },
  location: {
    label: "Địa điểm",
    color:
      "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50",
    icon: MapPin,
  },
  faction: {
    label: "Thế lực",
    color:
      "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800/50",
    icon: Flag,
  },
  item: {
    label: "Vật phẩm",
    color:
      "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50",
    icon: Package,
  },
  relationship: {
    label: "Mối quan hệ",
    color:
      "text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800/50",
    icon: Heart,
  },
  event: {
    label: "Sự kiện",
    color:
      "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30 border-red-200 dark:border-red-800/50",
    icon: Calendar,
  },
  law: {
    label: "Luật lệ",
    color:
      "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800/50",
    icon: Scale,
  },
  world: {
    label: "Thế giới",
    color:
      "text-stone-600 bg-stone-100 dark:text-stone-400 dark:bg-stone-800/50 border-stone-300 dark:border-stone-700/50",
    icon: Globe,
  },
};

interface StoryBibleSidebarProps {
  worldData: WorldData;
}

const StoryBibleSidebar: React.FC<StoryBibleSidebarProps> = ({ worldData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [entries, setEntries] = useState<VectorData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [viewMode, setViewMode] = useState<'keyword' | 'semantic' | 'trigger_editor' | 'token_budget'>('keyword');
  const [activeMainTab, setActiveMainTab] = useState<'encyclopedia' | 'triggers' | 'budget' | 'logs'>('encyclopedia');
  const isAiSearch = viewMode === 'semantic';
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);
  const [semanticResults, setSemanticResults] = useState<VectorData[] | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  const [activeMonitorTab, setActiveMonitorTab] = useState<'scribe' | 'semantic' | 'trigger_editor' | 'token_budget'>('trigger_editor');
  const [showDiagnosticPanel, setShowDiagnosticPanel] = useState(false);

  // Edit & Add State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<VectorData>>({});

  const [isAdding, setIsAdding] = useState(false);
  const [addData, setAddData] = useState<Partial<VectorData>>({ 
      category: 'world', 
      triggerMode: 'hybrid', 
      priority: 50, 
      isEnabled: true, 
      position: 'before_char' 
  });

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const campaignId =
    worldData.id ||
    `campaign-${worldData.world?.worldName?.replace(/\s+/g, "")}-${worldData.player?.name?.replace(/\s+/g, "")}`;

  const loadEntries = async (isSilent = false) => {
    if (!isSilent) {
      setIsLoading(true);
    }
    try {
      const allVectors = await dbService.getAllVectors();
      const storyBibleVectors = allVectors.filter(
        (v) => v.role === "story_bible" && v.saveId === campaignId,
      );
      storyBibleVectors.sort((a, b) => b.timestamp - a.timestamp);
      setEntries(storyBibleVectors);

      const loadedSettings = (await dbService.getSettings()) as AppSettings;
      setSettings(loadedSettings);
    } catch (e) {
      console.error("Failed to load StoryBible entries", e);
    } finally {
      if (!isSilent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isOpen) {
      loadEntries(false);
      // Thêm auto-refresh mỗi 5s để cập nhật ngay nếu background service đang trích xuất
      intervalId = setInterval(() => {
        loadEntries(true);
      }, 5000);
    }
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, campaignId]);

  const filteredEntries = useMemo(() => {
    let currentList = entries;

    if (isAiSearch && semanticResults !== null) {
      currentList = semanticResults;
    }

    if (activeCategoryFilter) {
      currentList = currentList.filter(
        (e) => (e.category || "world") === activeCategoryFilter,
      );
    }

    if (!searchTerm) return currentList;

    const lowerSearch = searchTerm.toLowerCase();
    return currentList.filter(
      (entry) =>
        (entry.keyword && entry.keyword.toLowerCase().includes(lowerSearch)) ||
        (entry.text && entry.text.toLowerCase().includes(lowerSearch)),
    );
  }, [entries, searchTerm, isAiSearch, semanticResults, activeCategoryFilter]);

  useEffect(() => {
    // Reset semantic results when switching mode or clearing term
    if (!isAiSearch || !searchTerm) {
      setSemanticResults(null);
    }
  }, [isAiSearch, searchTerm]);

  const handleSemanticSearch = async () => {
    if (!searchTerm.trim() || !settings) return;
    setIsSearchingSemantic(true);
    try {
      const tempSettings = { ...settings, enableVectorMemory: true };
      // Map StoryBibleEntry to VectorData shape for the UI
      const entriesData = await storyBibleService.queryContext(
        searchTerm,
        [],
        campaignId,
        tempSettings,
      );
      const results = entriesData.map(
        (e) =>
          ({
            id: e.id,
            keyword: e.title,
            text: e.content,
            category: e.category,
            timestamp: e.updatedAt,
            role: "story_bible",
            saveId: campaignId,
            score: e.confidence, // approximated
          }) as VectorData,
      );
      setSemanticResults(results);
    } catch (e: any) {
      console.error("Semantic search error", e);
      const errDetail = e instanceof Error ? e.message : String(e);
      toast.error(`Lỗi khi tìm kiếm ngữ nghĩa. Chi tiết: ${errDetail}`);
    } finally {
      setIsSearchingSemantic(false);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(entries, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", `StoryBible_${campaignId}.json`);
    linkElement.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content) as VectorData[];
        if (!Array.isArray(parsed)) throw new Error("Invalid format");

        if (
          window.confirm(
            `Bạn có muốn nạp ${parsed.length} dữ kiện? Dữ liệu cũ có cùng ID sẽ bị ghi đè.`,
          )
        ) {
          setIsLoading(true);
          for (const entry of parsed) {
            if (entry.id && entry.text && entry.embedding) {
              entry.role = "story_bible";
              entry.saveId = campaignId;
              await dbService.saveVector(entry);
            }
          }
          await loadEntries();
          toast.success(`Nạp thành công ${parsed.length} dữ kiện!`);
        }
      } catch (err: any) {
        const errDetail = err instanceof Error ? err.message : String(err);
        toast.error(`Lỗi nạp file JSON. Chi tiết: ${errDetail}`);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset
  };

  const handleDeleteAll = async () => {
    if (
      window.confirm(
        "CẢNH BÁO: Encyclopedia hiện tại sẽ bị xóa sạch hoàn toàn. AI sẽ quên mọi dữ kiện. Bạn có chắc chắn?",
      )
    ) {
      setIsLoading(true);
      try {
        for (const e of entries) {
          await dbService.deleteVector(e.id);
        }
        setEntries([]);
        toast.success("Đã xóa sạch dữ kiện Encyclopedia!");
      } catch (err: any) {
        const errDetail = err instanceof Error ? err.message : String(err);
        toast.error(`Có lỗi khi xóa. Chi tiết: ${errDetail}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (
      window.confirm(
        "Bạn có chắc chắn muốn xóa mục này khỏi Encyclopedia? AI sẽ quên dữ kiện này.",
      )
    ) {
      await dbService.deleteVector(id);
      setEntries(entries.filter((e) => e.id !== id));
    }
  };

  const handleToggleStatus = async (id: string, enabled: boolean) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const updatedEntry = { ...entry, isEnabled: enabled };
    await dbService.saveVector(updatedEntry);
    setEntries(entries.map((e) => (e.id === id ? updatedEntry : e)));
    toast.success(`Đã ${enabled ? "bật" : "tắt"} dữ kiện "${entry.keyword}"!`);
  };

  const startEdit = (entry: VectorData) => {
    setEditingId(entry.id);
    setEditData({ ...entry });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async (entry: VectorData) => {
    if (!editData.keyword?.trim() || !editData.text?.trim()) return;
    setIsLoading(true);
    try {
      // Only recalculate embedding if text or keyword changed
      let newEmbedding = entry.embedding;
      if (entry.keyword !== editData.keyword || entry.text !== editData.text) {
        const embeddingStr = `${editData.keyword}: ${editData.text}`;
        const calcEmbedding = await vectorService.getEmbedding(embeddingStr); // Uses default settings if none passsed
        if (calcEmbedding) newEmbedding = calcEmbedding;
      }

      const currentTimestamp = Date.now();
      let newHistory = entry.updateHistory || [];
      if (entry.text !== editData.text) {
        newHistory = [{ timestamp: currentTimestamp, content: editData.text || '' }];
      }

      const updatedEntry: VectorData = {
        ...entry,
        ...editData, // applies all changes
        embedding: newEmbedding,
        updateHistory: newHistory,
        timestamp: currentTimestamp, // update timestamp to bubble up
      };

      await dbService.saveVector(updatedEntry);

      setEntries((prev) =>
        prev
          .map((e) => (e.id === entry.id ? updatedEntry : e))
          .sort((a, b) => b.timestamp - a.timestamp),
      );
      setEditingId(null);
      toast.success("Đã lưu dữ kiện cập nhật!");
    } catch (e: any) {
      console.error("Error saving edit", e);
      const errDetail = e instanceof Error ? e.message : String(e);
      toast.error(`Lỗi khi lưu dữ kiện. Chi tiết: ${errDetail}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddManual = async () => {
    if (!addData.keyword?.trim() || !addData.text?.trim()) {
      toast.warning("Vui lòng nhập cả Từ khóa và Nội dung.");
      return;
    }
    setIsLoading(true);
    try {
      const docId = `sb-${campaignId}-manual-${Date.now()}`;
      const embeddingStr = `${addData.keyword}: ${addData.text}`;
      const embedding = await vectorService.getEmbedding(embeddingStr);

      if (!embedding) throw new Error("Could not generate embedding");

      const newEntry: VectorData = {
        ...addData,
        id: docId,
        text: addData.text || '',
        embedding,
        timestamp: Date.now(),
        role: "story_bible",
        saveId: campaignId,
        keyword: addData.keyword || '',
        updateHistory: [
          { timestamp: Date.now(), content: `[Thêm thủ công]:\n${addData.text}` },
        ],
      } as VectorData;

      await dbService.saveVector(newEntry);
      setEntries((prev) => [newEntry, ...prev]);
      setIsAdding(false);
      setAddData({ 
        category: 'world', 
        triggerMode: 'hybrid', 
        priority: 50, 
        isEnabled: true, 
        position: 'before_char' 
      });
      toast.success("Đã thêm dữ kiện Encyclopedia mới!");
    } catch (e: any) {
      console.error("Error adding manual entry", e);
      const errDetail = e instanceof Error ? e.message : String(e);
      toast.error(`Lỗi khi thêm dữ kiện mới. Chi tiết: ${errDetail}`);
    } finally {
      setIsLoading(false);
    }
  };

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const newEntriesCount = entries.filter((e) => e.timestamp > oneDayAgo).length;
  const avgLength =
    entries.length > 0
      ? Math.round(
          entries.reduce((acc, e) => acc + (e.text?.length || 0), 0) /
            entries.length,
        )
      : 0;

  const tagCounts = entries.reduce(
    (acc, e) => {
      const cat = e.category || "world";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const popularTagId =
    Object.keys(tagCounts).length > 0
      ? Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  const selectedEntry = entries.find((e) => e.id === selectedEntryId);

  // --- PREMIUM CUSTOM RENDERERS FOR PREVIEW SIGHT ---
  const renderCharacterDataInPreview = (text: string) => {
    try {
      const data = JSON.parse(text) as any;
      return (
        <div className="space-y-6">
          {/* Core Profile stats card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/90 p-4 border border-slate-800/60 rounded-xl space-y-1.5 shadow-md">
              <span className="text-[9px] uppercase font-bold text-sky-400 tracking-widest block mb-1">RPG Bio</span>
              <div className="space-y-1 text-xs text-slate-100 font-semibold">
                <p><strong className="text-slate-400">Giới tính:</strong> {data.gender || "Chưa tường"}</p>
                <p><strong className="text-slate-400">Tuổi tác:</strong> {data.age || "Chưa kể"}</p>
                <p><strong className="text-slate-400">Cố sự:</strong> {data.narrativeRole || "Trợ chiến"}</p>
                <p><strong className="text-slate-400">Tinh thần:</strong> {data.currentMood || "An định"}</p>
              </div>
            </div>
            <div className="bg-slate-900/90 p-4 border border-slate-800/60 rounded-xl space-y-1.5 shadow-md">
              <span className="text-[9px] uppercase font-bold text-sky-400 tracking-widest block mb-1">Âm Giọng & Điệu điệu</span>
              <p className="text-xs text-slate-100 italic font-medium">"{data.voiceAndTone || "Chưa lập ngôn"}"</p>
            </div>
          </div>

          {/* Detailed text Blocks */}
          {data.appearance && (
            <div className="bg-slate-950/30 p-5 rounded-2xl border border-slate-850/50">
              <h4 className="text-[10px] font-bold uppercase text-sky-400 tracking-widest mb-2 font-sans border-b border-slate-850/30 pb-1">Dáng vẻ hình dung (Appearance)</h4>
              <div className="text-xs text-slate-100/90 leading-relaxed font-semibold">
                {data.appearance}
              </div>
            </div>
          )}

          {data.personality && (
            <div className="bg-slate-950/30 p-5 rounded-2xl border border-slate-850/50">
              <h4 className="text-[10px] font-bold uppercase text-sky-400 tracking-widest mb-2 font-sans border-b border-slate-850/30 pb-1">Nhân cách căn tính (Personality & Values)</h4>
              <div className="text-xs text-slate-100/90 leading-relaxed/95">
                {data.personality}
                {data.coreValues && (
                  <p className="mt-2 pt-2 border-t border-dashed border-slate-800/60">
                    <strong>Gốc trị cốt lõi:</strong> {data.coreValues}
                  </p>
                )}
                {data.hardLimits && (
                  <p className="mt-1">
                    <strong>Tối hậu giới hạn:</strong> <span className="text-red-400 font-extrabold">{data.hardLimits}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {data.background && (
            <div className="bg-slate-950/30 p-5 rounded-2xl border border-slate-850/50">
              <h4 className="text-[10px] font-bold uppercase text-sky-400 tracking-widest mb-2 font-sans border-b border-slate-850/30 pb-1">Truyện ký dã sử (Background & History)</h4>
              <div className="text-xs text-slate-100/90 leading-relaxed/95">
                {data.background}
              </div>
            </div>
          )}

          {/* Strengths & Weaknesses */}
          {(data.strengths || data.weaknesses) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.strengths && (
                <div className="p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-xl">
                  <span className="text-[9px] uppercase font-black text-emerald-450 block mb-1">Thế mạnh (Strengths)</span>
                  <p className="text-xs text-slate-100 font-semibold">{data.strengths}</p>
                </div>
              )}
              {data.weaknesses && (
                <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-xl">
                  <span className="text-[9px] uppercase font-black text-red-450 block mb-1">Gót chân Achilles (Weaknesses)</span>
                  <p className="text-xs text-slate-100 font-semibold">{data.weaknesses}</p>
                </div>
              )}
            </div>
          )}

          {/* Example Messages */}
          {data.exampleMessages && (
            <div className="bg-[#020617] p-5 border border-slate-850/50 rounded-2xl shadow-inner">
              <span className="text-[9px] uppercase font-bold text-sky-400 block mb-1.5 font-mono">Khảo giọng đặc điệu (Dialogue Examples)</span>
              <pre className="text-xs text-slate-200/85 font-mono whitespace-pre-wrap leading-relaxed select-all">
                {data.exampleMessages}
              </pre>
            </div>
          )}
        </div>
      );
    } catch {
      return (
        <div className="text-xs leading-relaxed text-slate-100/95">
          <MarkdownRenderer content={text} />
        </div>
      );
    }
  };

  const renderRpgAttrsInPreview = (entry: VectorData) => {
    const attrs = (entry as any).rpg_attrs;
    if (!attrs || Object.keys(attrs).length === 0) return null;

    return (
      <div className="mt-8 pt-6 border-t border-slate-850/50">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-sky-400 mb-3.5 flex items-center gap-1.5 font-sans">
          <Activity size={12} className="text-sky-400" />
          RPG Database Analytics (Khảo tả chi tiết bối cảnh)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {Object.entries(attrs).map(([key, val]) => {
            if (!val) return null;
            const label = key.toUpperCase().replace(/_/g, " ");
            return (
              <div key={key} className="bg-slate-900/90 p-3 flex flex-col justify-center border border-slate-800/60 rounded-xl shadow-md">
                <span className="block text-[8px] font-bold tracking-widest text-slate-400 uppercase font-mono mb-1">{label}</span>
                <span className="text-xs text-slate-100 font-extrabold capitalize">{val as string}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderIntelConnectionsInPreview = (entry: VectorData) => {
    const currentLinks = entry.relatedEntries || [];
    if (currentLinks.length === 0) return null;

    return (
      <div className="mt-8 pt-6 border-t border-slate-850/50">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-sky-400 mb-3.5 flex items-center gap-1.5 font-sans">
          <Link size={12} className="text-sky-400" />
          Liên can liên kết (Connected Encyclopedia Nodes)
        </h4>
        <div className="flex flex-wrap gap-2">
          {currentLinks.map((linkId) => {
            const target = entries.find((e) => e.id === linkId);
            if (!target) return null;
            return (
              <button
                key={linkId}
                onClick={() => setSelectedEntryId(linkId)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-slate-800/60 rounded-xl font-mono uppercase tracking-wide text-[9px] transition-all hover:scale-[1.01]"
              >
                {target.keyword || target.title}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-stone-400 dark:hover:bg-slate-700/50 transition-colors group rounded-lg border border-stone-400 dark:border-slate-700 bg-stone-300 dark:bg-slate-800/30 mb-3"
      >
        <div className="flex items-center gap-2 text-[10px] font-bold text-stone-700 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors uppercase">
          <Library size={14} />
          Encyclopedia
        </div>
        <div className="text-[10px] text-stone-500 bg-stone-400 dark:bg-slate-800 px-2 py-0.5 rounded border border-stone-400 dark:border-slate-700 font-mono">
          Vector DB
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            style={{ zIndex: 1000 }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`bg-[#020617]/95 backdrop-blur-md border border-slate-800/80 flex flex-col overflow-hidden text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.6)] duration-300 relative ${
                isMaximized 
                  ? "fixed inset-0 w-screen h-screen rounded-none border-0 z-[1001]" 
                  : "w-[96vw] max-w-[1400px] h-[95vh] md:h-[90vh] rounded-2xl"
              }`}
            >
              {/* Interstellar Modern Header */}
              <div className="px-4 py-3 border-b border-slate-800/85 bg-[#090f23]/95 shrink-0 shadow-md flex items-center justify-between z-10 relative select-none">
                {/* Cyber Corner Lines Accent */}
                <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t border-l border-sky-500/30" />
                <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t border-r border-sky-500/30" />

                <div className="flex items-center gap-2">
                  <div className="bg-sky-500/10 p-1.5 rounded-lg border border-sky-500/25 shadow-sm">
                    <BookOpen size={14} className="text-sky-400" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                    <h2 className="text-sm md:text-base font-sans text-sky-450 tracking-wider uppercase font-extrabold flex items-center gap-1">
                      Thư Khố <span className="hidden xs:inline">Vũ Trụ</span>
                    </h2>
                    <span className="text-[9px] font-mono text-slate-450 font-bold bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-850 shrink-0">
                      {entries.length} Dữ Kiện
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsAdding(!isAdding)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all shadow-sm ${
                      isAdding
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.15)] scale-[0.98]"
                        : "bg-slate-950 text-sky-450 border-slate-805 hover:bg-slate-900/60 hover:border-sky-500/30"
                    }`}
                  >
                    {isAdding ? <X size={12} className="text-rose-450" /> : <Plus size={12} className="text-sky-400" />}
                    <span>{isAdding ? "Hủy" : "Thêm"}</span>
                  </button>

                  <div className="h-6 w-px bg-slate-800" />
                  
                  {/* Database Toolsets */}
                  <div className="flex gap-0.5 bg-slate-950 border border-slate-850 p-0.5 rounded-lg">
                    <button
                      onClick={handleExport}
                      className="flex items-center p-1.5 rounded text-slate-450 hover:text-sky-405 hover:bg-slate-900/40 transition-all"
                      title="Sao lưu bản đồ (Xuất JSON)"
                    >
                      <Download size={13} />
                    </button>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full z-10"
                        title="Nạp cổ thư tri thức (Nhập JSON)"
                      />
                      <button className="flex items-center p-1.5 rounded text-slate-450 hover:text-sky-405 hover:bg-slate-900/40 transition-all pointer-events-none">
                        <Upload size={13} />
                      </button>
                    </div>
                    <button
                      onClick={handleDeleteAll}
                      className="flex items-center p-1.5 rounded text-red-505 hover:text-red-400 hover:bg-red-950/20 transition-all"
                      title="Reset Toàn Bộ Thư Tịch"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="h-6 w-px bg-slate-850 hidden xs:block" />

                  <button
                    onClick={() => setShowDiagnosticPanel(!showDiagnosticPanel)}
                    className={`hidden xs:flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all text-xs font-bold uppercase tracking-wider ${
                      showDiagnosticPanel
                        ? "bg-sky-500/15 text-sky-300 border-sky-400/50"
                        : "text-slate-450 border-slate-800 hover:bg-slate-900/40 hover:text-slate-200"
                    }`}
                    title={showDiagnosticPanel ? "Đóng phân tích" : "Mở phân tích AI"}
                  >
                    <PanelRight size={12} className="text-sky-400" />
                    <span className="hidden md:inline">Phân tích</span>
                  </button>

                  <div className="h-6 w-px bg-slate-850" />

                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="text-slate-450 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-900/40 transition-all border border-slate-800"
                    title={isMaximized ? "Thu nhỏ cửa sổ" : "Mở rộng toàn màn hình"}
                  >
                    {isMaximized ? <Minimize2 size={13} className="text-sky-450" /> : <Maximize2 size={13} />}
                  </button>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-slate-450 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-900/40 transition-all border border-slate-800"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Wrapper supporting Left Sidebar + Main Content Viewport */}
              <div className="flex flex-1 flex-col md:flex-row overflow-hidden relative">
                
                {/* Left Sidebar Navigation Menu */}
                <div className="bg-[#050b18] border-b md:border-b-0 md:border-r border-slate-850/80 shrink-0 flex flex-row md:flex-col gap-1 md:gap-1.5 p-1.5 md:p-2 w-full md:w-16 lg:w-52 z-20 select-none justify-center md:justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMainTab("encyclopedia");
                      setViewMode("keyword");
                    }}
                    className={`flex-1 md:flex-none px-2.5 py-1.5 md:py-2.5 rounded-xl transition-all uppercase tracking-wider flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 md:gap-2 whitespace-nowrap text-[10px] md:text-xs font-bold leading-none border ${
                      activeMainTab === "encyclopedia"
                        ? "bg-sky-500/10 text-sky-300 border-sky-500/30 shadow-inner"
                        : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/30"
                    }`}
                    title="Thư viện Lore"
                  >
                    <BookOpen size={14} strokeWidth={2.5} className="text-sky-400" />
                    <span className="md:hidden lg:inline text-[8px] md:text-[10px] lg:text-xs tracking-wide">Thư viện</span>
                    <span className="hidden md:inline lg:hidden text-[9px] tracking-wide mt-1 scale-90">Lore</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMainTab("triggers")}
                    className={`flex-1 md:flex-none px-2.5 py-1.5 md:py-2.5 rounded-xl transition-all uppercase tracking-wider flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 md:gap-2 whitespace-nowrap text-[10px] md:text-xs font-bold leading-none border ${
                      activeMainTab === "triggers"
                        ? "bg-sky-500/10 text-sky-300 border-sky-500/30 shadow-inner"
                        : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/30"
                    }`}
                    title="Kích hoạt (Triggers)"
                  >
                    <Filter size={14} strokeWidth={2.5} className="text-sky-400" />
                    <span className="md:hidden lg:inline text-[8px] md:text-[10px] lg:text-xs tracking-wide">Kích hoạt</span>
                    <span className="hidden md:inline lg:hidden text-[9px] tracking-wide mt-1 scale-90">Có sẵn</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMainTab("budget")}
                    className={`flex-1 md:flex-none px-2.5 py-1.5 md:py-2.5 rounded-xl transition-all uppercase tracking-wider flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 md:gap-2 whitespace-nowrap text-[10px] md:text-xs font-bold leading-none border ${
                      activeMainTab === "budget"
                        ? "bg-sky-500/10 text-sky-350 border-sky-500/30 shadow-inner"
                        : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/30"
                    }`}
                    title="Ngân sách Token"
                  >
                    <Star size={14} strokeWidth={2.5} className="text-amber-400" />
                    <span className="md:hidden lg:inline text-[8px] md:text-[10px] lg:text-xs tracking-wide">Ngân Sách</span>
                    <span className="hidden md:inline lg:hidden text-[9px] tracking-wide mt-1 scale-90">TK</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMainTab("logs")}
                    className={`flex-1 md:flex-none px-2.5 py-1.5 md:py-2.5 rounded-xl transition-all uppercase tracking-wider flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 md:gap-2 whitespace-nowrap text-[10px] md:text-xs font-bold leading-none border ${
                      activeMainTab === "logs"
                        ? "bg-sky-500/10 text-sky-350 border-sky-500/30 shadow-inner"
                        : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/30"
                    }`}
                    title="Nhật ký AI"
                  >
                    <Activity size={14} strokeWidth={2.5} className="text-emerald-400 animate-pulse" />
                    <span className="md:hidden lg:inline text-[8px] md:text-[10px] lg:text-xs tracking-wide">Nhật Ký AI</span>
                    <span className="hidden md:inline lg:hidden text-[9px] tracking-wide mt-1 scale-90">AI</span>
                  </button>

                  <div className="hidden md:block flex-1 border-t border-slate-850/50 mt-2" />

                  {/* Footer Info inside Left Sidebar (visible on screens over md:) */}
                  <div className="hidden lg:flex flex-col gap-1.5 p-2 bg-slate-950/40 rounded-xl border border-slate-850/45 mt-auto text-[9px] text-slate-450 font-mono leading-relaxed">
                    <span className="text-sky-400 font-bold uppercase tracking-wider">Trợ lý Scribe</span>
                    <span>Tự động kết nối &amp; khớp bối cảnh chính xác.</span>
                  </div>
                </div>

                {/* Main Workspace Content Viewport Container */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden h-full relative">
                  {isLoading && (
                    <div className="absolute inset-0 z-50 bg-[#020617]/80 backdrop-blur-[2px] flex justify-center items-center">
                      <div className="bg-slate-900/90 border border-slate-800/80 p-5 rounded-2xl shadow-2xl flex items-center gap-3">
                        <RefreshCw
                          size={20}
                          className="animate-spin text-sky-400"
                        />
                        <span className="text-slate-100 font-mono text-xs font-bold tracking-wider uppercase">
                          Đang đồng bộ thần thức bối cảnh...
                        </span>
                      </div>
                    </div>
                  )}

                  {activeMainTab === 'encyclopedia' && (
                    <>
                      {/* List Sidebar (Shown ONLY in Focus Mode when selecting or adding an entry) */}
                      <div className={`shrink-0 flex-col bg-[#020617] border-r border-slate-850/50 transition-all duration-300 ${
                        (selectedEntryId || isAdding) 
                          ? "hidden lg:flex lg:w-[35%] xl:w-[33%] h-full" 
                          : "hidden"
                      }`}>
                        <EntryListView
                        entries={entries}
                        selectedId={selectedEntryId}
                        onSelect={(id) => {
                          setSelectedEntryId(id);
                          setEditingId(null);
                          setIsAdding(false);
                        }}
                        onAdd={() => setIsAdding(true)}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        viewMode={viewMode === "keyword" || viewMode === "semantic" ? viewMode : "keyword"}
                        onViewModeChange={(val) => {
                          if (val === "keyword" || val === "semantic") {
                            setViewMode(val);
                          }
                        }}
                        onSemanticSearch={handleSemanticSearch}
                        isSearchingSemantic={isSearchingSemantic}
                        activeCategoryFilter={activeCategoryFilter}
                        onCategoryFilterChange={setActiveCategoryFilter}
                        filteredEntries={filteredEntries}
                        CATEGORY_MAP={CATEGORY_MAP}
                      />
                    </div>

                    {/* Center: Detail / Editor View (Renders full-bleed on homepage, dynamic split in Focus Mode) */}
                    <div className="flex-1 min-w-0 bg-[#020617] relative flex flex-col overflow-hidden h-full">
                      <div className="flex-1 overflow-hidden flex flex-col">
                        {isAdding ? (
                          <EntryEditor
                            formData={addData}
                            onChange={(field, value) => setAddData(prev => ({...prev, [field]: value}))}
                            onSave={handleAddManual}
                            onCancel={() => setIsAdding(false)}
                            isSaving={isLoading}
                            isEditing={false}
                            entries={entries}
                          />
                        ) : selectedEntry && editingId === selectedEntry.id ? (
                          <EntryEditor
                            formData={editData}
                            onChange={(field, value) => setEditData(prev => ({...prev, [field]: value}))}
                            onSave={() => saveEdit(selectedEntry)}
                            onCancel={cancelEdit}
                            isSaving={isLoading}
                            isEditing={true}
                            entries={entries}
                          />
                        ) : selectedEntry ? (
                          <div className="flex flex-col h-full bg-[#020617] text-slate-100 font-sans">
                            {/* Preview Header */}
                            <div className="px-4 lg:px-8 py-4 lg:py-6 border-b border-slate-800/60 bg-slate-900/90 shrink-0 flex items-start justify-between gap-4 backdrop-blur relative">
                              <div className="flex-1 max-w-3xl flex flex-col gap-2">
                                 <div className="flex items-center gap-2 lg:hidden mb-2">
                                    <button onClick={() => setSelectedEntryId(null)} className="flex items-center gap-1 text-[11px] font-mono font-bold px-3 py-1.5 bg-slate-950 text-sky-400 rounded-xl border border-slate-850/50 hover:border-sky-500/40/40 transition-colors">
                                      <ChevronRight size={13} className="rotate-180" /> Trở lại danh sách
                                    </button>
                                 </div>
                                <h2 className="text-2xl lg:text-3xl font-sans text-sky-400 tracking-wider uppercase mb-1 lg:mb-2 leading-tight font-extrabold flex items-center gap-2">
                                  <BookOpen size={20} className="text-sky-400/80 inline shrink-0" />
                                  {selectedEntry.keyword || "Không tên"}
                                </h2>
                                <div className="flex flex-wrap items-center gap-3">
                                  {selectedEntry.category &&
                                    CATEGORY_MAP[selectedEntry.category] && (
                                      <div
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest border bg-[#020617] text-slate-100 border-slate-800/60`}
                                      >
                                        {React.createElement(
                                          CATEGORY_MAP[selectedEntry.category].icon,
                                          { size: 12, className: "text-sky-400" },
                                        )}
                                        {CATEGORY_MAP[selectedEntry.category].label}
                                      </div>
                                    )}
                                  {selectedEntry.triggerMode && (
                                    <div className="px-3 py-1.5 bg-slate-950 text-sky-400 rounded-xl text-[10px] uppercase font-mono font-bold border border-slate-850/50 tracking-widest">
                                      Cảm ứng: {selectedEntry.triggerMode}
                                    </div>
                                  )}
                                  {selectedEntry.keywords &&
                                    selectedEntry.keywords.length > 0 && (
                                      <div className="flex gap-2 flex-wrap">
                                        {selectedEntry.keywords.map((kw, idx) => (
                                          <span
                                            key={idx}
                                            className="px-3 py-1.5 bg-[#020617] text-slate-400 rounded-xl text-[10px] font-mono font-bold border border-slate-850/50 tracking-wider"
                                          >
                                            #{kw}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 bg-slate-950 border border-slate-800/60 p-2 rounded-2xl shadow-md">
                                <button
                                  type="button"
                                  onClick={() => startEdit(selectedEntry)}
                                  className="p-2.5 text-slate-400 hover:text-sky-400 hover:bg-[#020617]/80 rounded-xl transition-all"
                                  title="Biên tập Thư tịch"
                                >
                                  <Edit3 size={18} />
                                </button>
                                <div className="w-px h-6 bg-sky-500/15 mx-1"></div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDelete(selectedEntry.id);
                                    setSelectedEntryId(null);
                                  }}
                                  className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-950/20 rounded-xl transition-all"
                                  title="Thiêu hủy Thư tịch"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>

                            {/* Preview Content */}
                            <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar bg-[#020617]">
                              <div className="max-w-4xl space-y-6">
                                <div className="bg-slate-900/90 p-6 lg:p-8 rounded-2xl border border-slate-800/60 shadow-2xl content-block relative text-slate-100">
                                  {/* Ancient Scroll Corner Decors */}
                                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-slate-800/80" />
                                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-slate-800/80" />
                                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-slate-800/80" />
                                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-slate-800/80" />
                                  
                                  {selectedEntry.category === "character" ? (
                                    renderCharacterDataInPreview(selectedEntry.text)
                                  ) : (
                                    <div className="text-sm leading-relaxed text-slate-100/90 markdown-prose">
                                      <MarkdownRenderer content={selectedEntry.text} />
                                    </div>
                                  )}
                                </div>

                                {/* Render Custom attributes & connection specs */}
                                {renderRpgAttrsInPreview(selectedEntry)}
                                {renderIntelConnectionsInPreview(selectedEntry)}

                                {/* Changelog partial view */}
                                {selectedEntry.updateHistory &&
                                  selectedEntry.updateHistory.length > 0 && (
                                    <div className="mt-8">
                                      <h4 className="text-xs font-black text-stone-400 dark:text-slate-505 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <RefreshCw
                                          size={14}
                                          className="text-amber-500/50"
                                        />{" "}
                                        Lịch sử thay đổi
                                      </h4>
                                      <div className="space-y-4">
                                        {selectedEntry.updateHistory
                                          .slice()
                                          .reverse()
                                          .slice(0, 3)
                                          .map((hist, idx) => (
                                            <div
                                              key={idx}
                                              className="text-[11px] text-stone-505 dark:text-slate-450 border-l-[2px] border-stone-300 dark:border-slate-700 pl-3"
                                            >
                                              <span className="font-bold text-amber-600 dark:text-amber-550">
                                                [
                                                {new Date(
                                                  hist.timestamp,
                                                ).toLocaleString()}
                                                ]
                                              </span>
                                              <p className="mt-1 line-clamp-3">
                                                {hist.content}
                                              </p>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <EncyclopediaDashboard
                            entries={entries}
                            onSelect={setSelectedEntryId}
                            onAddManualWithTemplate={(template) => {
                              setAddData({
                                category: "world",
                                triggerMode: "hybrid",
                                priority: 50,
                                isEnabled: true,
                                position: "before_char",
                                ...template,
                              });
                              setIsAdding(true);
                            }}
                            CATEGORY_MAP={CATEGORY_MAP}
                            onCategoryFilterChange={(cat) => {
                              setActiveCategoryFilter(cat);
                            }}
                            campaignId={campaignId}
                            onDelete={handleDelete}
                            onToggleStatus={handleToggleStatus}
                          />
                        )}
                      </div>
                    </div>

                    {/* Collapsible Right Sidebar: Monitors */}
                    {showDiagnosticPanel && (
                      <div className="hidden xl:flex w-[380px] shrink-0 flex-col bg-slate-900/90 border-l border-slate-800/60 animate-fadeIn duration-200 text-slate-100">
                        <div className="flex items-center gap-1 p-2 border-b border-slate-850/50 bg-[#020617] overflow-x-auto shrink-0 custom-scrollbar select-none">
                           <button 
                             type="button"
                             onClick={() => setActiveMonitorTab('scribe')}
                             className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeMonitorTab === 'scribe' ? 'bg-sky-500/20 text-sky-400 border border-slate-800/80 font-sans' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-950'}`}
                           >
                             <Type size={14} /> Scribe
                           </button>
                           <button 
                             type="button"
                             onClick={() => setActiveMonitorTab('semantic')}
                             className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeMonitorTab === 'semantic' ? 'bg-sky-500/20 text-sky-400 border border-slate-800/80 font-sans' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-950'}`}
                           >
                             <BrainCircuit size={14} /> Semantic
                           </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 font-sans bg-[#020617]/35">
                          {activeMonitorTab === 'scribe' && (
                            <div className="h-full flex flex-col">
                              <h3 className="text-xs font-bold uppercase text-sky-400 mb-2 font-sans tracking-wider">Text Triggers & Scribe Logs</h3>
                              <ScribeMonitor entries={entries} />
                            </div>
                          )}
                          {activeMonitorTab === 'semantic' && (
                            <div className="h-full flex flex-col">
                              <MetadataRetrievalDebugger entries={entries} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {activeMainTab === 'triggers' && (
                  <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-[#020617]">
                    <div className="max-w-6xl mx-auto space-y-4 animate-fadeIn">
                      <div>
                        <h3 className="text-xl font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2 font-sans">
                          <Filter className="text-sky-400" size={18} />
                          Điều hợp Quy tắc Tự động (AI Content Triggers)
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed font-mono">
                          Bộ kích hoạt AI quét các từ khóa tương ứng trong cửa sổ đối thoại để "kéo" bối cảnh cụ thể vào hộp nhớ. Bạn có thể cấu hình biểu thức chính quy (Regex) và mức độ ưu tiên nạp tại đây.
                        </p>
                      </div>
                      <div className="bg-slate-900/90 p-6 rounded-2xl border border-slate-800/60 shadow-xl">
                        <TriggerDebugger entries={entries} />
                      </div>
                    </div>
                  </div>
                )}

                {activeMainTab === 'budget' && (
                  <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-[#020617]">
                    <div className="max-w-6xl mx-auto space-y-4 animate-fadeIn">
                      <div>
                        <h3 className="text-xl font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2 font-sans">
                          <Star className="text-sky-400" size={18} />
                          Hạn ngạch Token & Hệ Quản trị Bộ nhớ đệm (AI Context Space)
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed font-mono">
                          Ước lượng băm từ tệp văn bản và theo dõi dung lượng bộ nhớ đệm. Kéo thả hoặc tối ưu hóa thứ tự chèn bối cảnh hòng đạt độ phân tích tối ưu.
                        </p>
                      </div>
                      <div className="bg-slate-900/90 p-6 rounded-2xl border border-slate-800/60 shadow-xl">
                        <TokenBudgetMonitor entries={entries} />
                      </div>
                    </div>
                  </div>
                )}

                {activeMainTab === 'logs' && (
                  <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-[#020617]">
                    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
                      <div>
                        <h3 className="text-xl font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2 font-sans">
                          <Activity className="text-sky-400" size={18} />
                          Trung tâm Phân tích Kỹ thuật AI (AI Recall Lab)
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed font-mono">
                          Rà soát các tiến trình lập lịch, trích ký văn bản từ Scribe Engine rải rác trong phiên chơi, đồng thời kiểm nghiệm mô phỏng độ tương đồng của Vector Database.
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800/60 shadow-xl flex flex-col h-[520px]">
                          <span className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-3 block font-sans">📜 Nhật ký hành vi Scribe (Live Scribe Stream)</span>
                          <div className="flex-1 overflow-hidden">
                            <ScribeMonitor entries={entries} />
                          </div>
                        </div>

                        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800/60 shadow-xl flex flex-col h-[520px]">
                          <span className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-3 block font-sans">🛰️ Phòng thí nghiệm Truy xuất (Vector Similarity recalls)</span>
                          <div className="flex-1 overflow-hidden">
                            <MetadataRetrievalDebugger entries={entries} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
  .markdown-prose p { margin-bottom: 1em; }
  .markdown-prose p:last-child { margin-bottom: 0; }
  .markdown-prose blockquote { border-left: 4px solid #f59e0b; padding-left: 1em; font-style: italic; opacity: 0.8; }
  .markdown-prose ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; }
  .markdown-prose ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1em; }
  .markdown-prose li { margin-bottom: 0.25em; }
  .markdown-prose h1, .markdown-prose h2, .markdown-prose h3 { font-weight: 900; margin-top: 1.5em; margin-bottom: 0.5em; color: inherit; letter-spacing: -0.025em; }
  .markdown-prose strong { font-weight: 900; color: inherit; }
  .markdown-prose em { font-style: italic; opacity: 0.9; }
`}</style>
    </>
  );
};

export default StoryBibleSidebar;
