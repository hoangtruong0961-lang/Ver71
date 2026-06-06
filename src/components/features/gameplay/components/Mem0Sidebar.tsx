import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, 
  Search, 
  Plus, 
  Trash2, 
  X, 
  Lock, 
  Unlock, 
  RefreshCw, 
  User, 
  Users, 
  Globe, 
  Calendar, 
  Check, 
  Edit2, 
  Info,
  Sliders,
  Sparkles
} from "lucide-react";
import { Mem0Service, Mem0Memory } from "../../../../services/ai/memory/Mem0Service";
import { WorldData, AppSettings } from "../../../../types";
import { toast } from "sonner";

interface Mem0SidebarProps {
  activeWorld: WorldData;
  settings: AppSettings | null;
}

const CATEGORY_STYLES: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  user: {
    label: "Người chơi (User)",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800/40",
    icon: User,
  },
  character: {
    label: "Nhân vật (NPC)",
    bg: "bg-pink-50 dark:bg-pink-900/20",
    text: "text-pink-700 dark:text-pink-400",
    border: "border-pink-200 dark:border-pink-800/40",
    icon: Users,
  },
  world: {
    label: "Bối cảnh / Thế giới (World)",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/40",
    icon: Globe,
  },
  event: {
    label: "Sự kiện (Event)",
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800/40",
    icon: Calendar,
  },
};

export const Mem0Sidebar: React.FC<Mem0SidebarProps> = ({ activeWorld, settings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [memories, setMemories] = useState<Mem0Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Manual Memory Input Form
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState<"user" | "character" | "world" | "event">("user");
  const [newSubject, setNewSubject] = useState("");

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingSubject, setEditingSubject] = useState("");

  const worldId = activeWorld.id || "default";

  // Load memories on mount or when worldId changes, or when sidebar opens
  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const data = await Mem0Service.getMemories(worldId);
      setMemories(data);
    } catch (e) {
      console.error("Failed to load Mem0 memories:", e);
      toast.error("Không tải được dữ liệu bộ nhớ Mem0");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (worldId) {
      loadMemories();
    }
  }, [worldId]);

  useEffect(() => {
    if (isOpen) {
      loadMemories();
    }
  }, [isOpen]);

  // Filter memories
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      const matchSearch =
        m.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.subject.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory =
        selectedCategoryFilter === "all" || m.category === selectedCategoryFilter;
      return matchSearch && matchCategory;
    });
  }, [memories, searchTerm, selectedCategoryFilter]);

  // Toggle memory lock
  const handleToggleLock = async (memory: Mem0Memory) => {
    const nextLock = !memory.isLocked;
    try {
      await Mem0Service.updateMemory(worldId, memory.id, { isLocked: nextLock }, settings || undefined);
      setMemories((prev) =>
        prev.map((m) => (m.id === memory.id ? { ...m, isLocked: nextLock } : m))
      );
      toast.success(
        nextLock
          ? `Đã khóa cố định ký ức: "${memory.text.substring(0, 20)}..."`
          : `Đã mở khóa động ký ức: "${memory.text.substring(0, 20)}..."`
      );
    } catch (e) {
      toast.error("Thao tác khóa ký ức thất bại");
    }
  };

  // Delete memory
  const handleDeleteMemory = async (id: string, text: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ký ức này khỏi bộ đệm Mem0?\n"${text}"`)) {
      try {
        await Mem0Service.deleteMemory(worldId, id);
        setMemories((prev) => prev.filter((m) => m.id !== id));
        toast.success("Đã xóa ký ức thành công");
      } catch (e) {
        toast.error("Xóa ký ức thất bại");
      }
    }
  };

  // Trigger edit mode
  const startEditing = (m: Mem0Memory) => {
    setEditingId(m.id);
    setEditingText(m.text);
    setEditingSubject(m.subject);
  };

  // Save edited memory
  const handleSaveEdit = async (m: Mem0Memory) => {
    if (!editingText.trim()) {
      toast.error("Nội dung ký ức không được để trống");
      return;
    }
    try {
      await Mem0Service.updateMemory(
        worldId,
        m.id,
        { text: editingText, subject: editingSubject },
        settings || undefined
      );
      setMemories((prev) =>
        prev.map((item) =>
          item.id === m.id
            ? { ...item, text: editingText, subject: editingSubject, timestamp: Date.now() }
            : item
        )
      );
      setEditingId(null);
      toast.success("Đã cập nhật ký ức");
    } catch (e) {
      toast.error("Cập nhật ký ức thất bại");
    }
  };

  // Save manual memory addition
  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || !newSubject.trim()) {
      toast.error("Vui lòng điền đầy đủ đối tượng chủ thể và nội dung ký ức");
      return;
    }

    setIsLoading(true);
    try {
      const added = await Mem0Service.addManualMemory(
        worldId,
        newText,
        newCategory,
        newSubject,
        settings || undefined
      );
      setMemories((prev) => [added, ...prev]);
      setNewText("");
      setNewSubject("");
      setIsAdding(false);
      toast.success("Đã nạp thủ công một ký ức cố định mới thành công!");
    } catch (e) {
      toast.error("Không thể nạp ký ức mới");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Sidebar Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-stone-400 dark:hover:bg-slate-700/50 transition-colors group rounded-lg border border-stone-400 dark:border-slate-700 bg-stone-300 dark:bg-slate-800/30 mb-3 cursor-pointer shadow-sm relative overflow-hidden"
      >
        <div className="flex items-center gap-2 text-[10px] font-bold text-stone-700 dark:text-slate-300 group-hover:text-mystic-accent transition-colors uppercase">
          <Brain size={14} className="text-mystic-accent group-hover:animate-pulse" />
          Ký ức Sinh tồn (Mem0 Core)
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono font-bold text-white bg-mystic-accent px-2 py-0.5 rounded shadow-inner">
            {memories.length}
          </span>
        </div>
      </button>

      {/* Modal View */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            style={{ zIndex: 1000 }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-stone-200 dark:bg-mystic-900 border border-stone-400 dark:border-slate-800 w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-stone-400 dark:border-slate-850 bg-stone-300 dark:bg-slate-900/90 shrink-0 shadow-sm relative z-10">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-mystic-accent/10 rounded-lg text-mystic-accent">
                      <Brain size={24} className="animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-stone-850 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                        Bộ Đệm Trí Nhớ Cá Nhân Hóa (ARK Mem0 Engine)
                      </h2>
                      <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5">
                        Theo dõi, quản lý, tinh chỉnh bản đồ ký ức động của trí tuệ nhân tạo.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadMemories}
                      disabled={isLoading}
                      className="p-2 text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white rounded-full hover:bg-stone-400 dark:hover:bg-slate-850 transition-colors"
                      title="Làm mới bộ nhớ"
                    >
                      <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white p-2 rounded-full hover:bg-stone-400 dark:hover:bg-slate-850 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm ký ức hoặc tên đối tượng/NPC..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-stone-100 dark:bg-mystic-950 border border-stone-350 dark:border-slate-800 text-stone-800 dark:text-slate-200 font-medium rounded-lg focus:outline-none focus:ring-1 focus:ring-mystic-accent focus:border-mystic-accent transition-colors"
                    />
                  </div>
                  <div className="flex gap-2">
                    {/* Category Filter dropdown */}
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                      className="px-3 py-2 text-xs bg-stone-100 dark:bg-mystic-950 border border-stone-350 dark:border-slate-800 rounded-lg text-stone-700 dark:text-slate-350 font-bold focus:outline-none"
                    >
                      <option value="all">Tất cả phân mục</option>
                      <option value="user">Người chơi (User)</option>
                      <option value="character">Nhân vật (NPC)</option>
                      <option value="world">Bối cảnh / Địa điểm</option>
                      <option value="event">Sự kiện</option>
                    </select>

                    <button
                      onClick={() => setIsAdding(!isAdding)}
                      className="px-3.5 py-2 flex items-center justify-center gap-1.5 bg-mystic-accent text-white hover:bg-opacity-90 rounded-lg text-xs font-bold transition-all group shrink-0"
                    >
                      <Plus size={14} className="group-hover:rotate-90 transition-transform" /> 
                      Nạp bộ nhớ thủ công
                    </button>
                  </div>
                </div>
              </div>

              {/* Memory List Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-stone-100 dark:bg-mystic-950 relative">
                
                {/* Explain banner */}
                <div className="p-3 bg-mystic-accent/5 dark:bg-mystic-accent/5 border-l-4 border-mystic-accent rounded-r-lg flex items-start gap-2.5">
                  <Info size={16} className="text-mystic-accent mt-0.5 shrink-0" />
                  <p className="text-[11px] text-stone-600 dark:text-slate-300 leading-relaxed">
                    <strong>Thông tin thiết yếu về Mem0 CORE:</strong> Lõi bộ nhớ liên kết sâu ARK tích hợp hệ thống 
                    tự động phân giải ý niệm ở mỗi lượt trò chuyện. AI sẽ tự động phân tách thói quen, vật phẩm nắm giữ, và thay đổi bối cảnh để <strong>Thêm</strong>, <strong>Cập nhật</strong> hoặc <strong>Xóa tế bào bộ nhớ</strong> tương ứng.
                    Sử dụng biểu tượng <Lock size={12} className="inline mx-0.5 text-amber-500" /> để <strong>Cố định (Lock)</strong> thông tin tùy ý bạn tự biên soạn, ngăn chặn AI can thiệp tự động.
                  </p>
                </div>

                {/* Add memory form toggle */}
                <AnimatePresence>
                  {isAdding && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleAddMemory}
                      className="p-4 bg-white dark:bg-slate-900 border border-stone-350 dark:border-slate-800 rounded-xl space-y-3 shadow-md overflow-hidden shrink-0"
                    >
                      <h4 className="text-xs font-bold text-stone-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Sparkles size={12} className="text-mystic-accent" /> Nạp một ký ức chuẩn hóa mới
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-500 dark:text-slate-400 mb-1">
                            Phân loại bối cảnh
                          </label>
                          <select
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value as any)}
                            className="w-full p-2 text-xs bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-800 rounded text-stone-800 dark:text-slate-200"
                          >
                            <option value="user">Người chơi (User detail)</option>
                            <option value="character">Nhân vật (NPC - thói quen, ngoại hình)</option>
                            <option value="world">Thế giới / Địa danh / Đồ vật</option>
                            <option value="event">Sự kiện chính vừa diễn ra</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-500 dark:text-slate-400 mb-1">
                            Đối tượng chủ thể (Subject)
                          </label>
                          <input
                            type="text"
                            placeholder="Ví dụ: player, Lý Huyền, thanh Trấn Hồn kiếm..."
                            value={newSubject}
                            onChange={(e) => setNewSubject(e.target.value)}
                            required
                            className="w-full p-2 text-xs bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-800 rounded text-stone-800 dark:text-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 dark:text-slate-400 mb-1">
                          Nội dung ký ức (Sự thật cần nhớ vĩnh viễn)
                        </label>
                        <textarea
                          placeholder="Nhập ghi nhớ cụ thể ngắn gọn, vd: Tướng quân Lý Huyền thực chất là nhị hoàng tử triều cũ cải trang."
                          value={newText}
                          onChange={(e) => setNewText(e.target.value)}
                          required
                          rows={2}
                          className="w-full p-2 text-xs bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-800 rounded text-stone-800 dark:text-slate-200 focus:outline-none resize-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2 text-xs font-bold pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAdding(false)}
                          className="px-3 py-1.5 bg-stone-200 dark:bg-slate-800 hover:bg-stone-300 dark:hover:bg-slate-705 text-stone-700 dark:text-slate-300 rounded"
                        >
                          Hủy bỏ
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-mystic-accent hover:bg-opacity-90 text-white rounded flex items-center gap-1"
                        >
                          <Check size={12} /> Nạp ký ức
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Main list view */}
                {isLoading && memories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2">
                    <RefreshCw className="animate-spin text-mystic-accent" size={32} />
                    <p className="text-xs text-stone-500 dark:text-slate-400">Đang quét phân giải hệ thống ký ức...</p>
                  </div>
                ) : filteredMemories.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900/60 p-12 text-center rounded-xl border border-dashed border-stone-300 dark:border-slate-800 select-none">
                    <Brain size={48} className="mx-auto text-stone-350 dark:text-slate-700 mb-3" />
                    <h4 className="text-sm font-bold text-stone-700 dark:text-slate-455">Không tìm thấy tế bào bộ nhớ nào</h4>
                    <p className="text-[11px] text-stone-400 dark:text-slate-500 mt-1">
                      {searchTerm 
                        ? "Thử tìm từ khóa khác hoặc dọn sạch bộ lọc phân mục bối cảnh" 
                        : "Chưa có ký ức động nào được hình thành. Hãy nói chuyện thêm với nhân vật để AI tự trích xuất hoặc nạp thủ công lý thuyết!"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredMemories.map((m) => {
                      const style = CATEGORY_STYLES[m.category] || CATEGORY_STYLES.world;
                      const CatIcon = style.icon;
                      const isEditing = editingId === m.id;

                      return (
                        <div
                          key={m.id}
                          className={`p-3 bg-white dark:bg-slate-900 border transition-all rounded-xl relative ${
                            m.isLocked 
                              ? "border-amber-400/40 dark:border-amber-500/20 shadow-sm" 
                              : "border-stone-300 dark:border-slate-800 hover:border-stone-400 dark:hover:border-slate-700 shadow-xs"
                          }`}
                        >
                          <div className="flex gap-3">
                            {/* Left part: icon representation */}
                            <div className="shrink-0 flex flex-col items-center gap-1.5">
                              <span
                                className={`p-1.5 rounded-lg border flex items-center justify-center ${style.bg} ${style.text} ${style.border}`}
                                title={style.label}
                              >
                                <CatIcon size={14} />
                              </span>
                              <button
                                onClick={() => handleToggleLock(m)}
                                className={`p-1 rounded transition-colors ${
                                  m.isLocked
                                    ? "text-amber-500 hover:bg-amber-500/10"
                                    : "text-stone-450 hover:bg-stone-100 dark:hover:bg-slate-850 hover:text-stone-700"
                                }`}
                                title={m.isLocked ? "Đã khóa cố định (AI không thể tự sửa)" : "Đang mở khóa động (AI tự do quản lý)"}
                              >
                                {m.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                              </button>
                            </div>

                            {/* Middle part: details */}
                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <span className="text-[9px] font-bold text-stone-400 dark:text-slate-500 mt-2">Chủ thể:</span>
                                    <input
                                      type="text"
                                      value={editingSubject}
                                      onChange={(e) => setEditingSubject(e.target.value)}
                                      className="flex-1 p-1 text-xs bg-stone-100 dark:bg-slate-950 border border-stone-300 dark:border-slate-800 rounded text-stone-800 dark:text-slate-200"
                                    />
                                  </div>
                                  <textarea
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    rows={2}
                                    className="w-full p-2 text-xs bg-stone-100 dark:bg-slate-950 border border-stone-300 dark:border-slate-800 rounded text-stone-800 dark:text-slate-200 resize-none focus:outline-none"
                                  />
                                  <div className="flex justify-end gap-1.5 text-[10px] font-bold">
                                    <button
                                      onClick={() => setEditingId(null)}
                                      className="px-2 py-1 bg-stone-200 dark:bg-slate-800 text-stone-700 dark:text-slate-350 rounded"
                                    >
                                      Hủy
                                    </button>
                                    <button
                                      onClick={() => handleSaveEdit(m)}
                                      className="px-3 py-1 bg-mystic-accent text-white rounded flex items-center gap-0.5"
                                    >
                                      <Check size={10} /> Lưu
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center flex-wrap gap-2">
                                    <span className="text-[10px] font-extrabold text-mystic-accent bg-mystic-accent/10 px-1.5 py-0.5 rounded tracking-wide uppercase">
                                      {m.subject}
                                    </span>
                                    {m.isLocked && (
                                      <span className="text-[8px] font-bold tracking-wider uppercase px-1 pb-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded">
                                        Cố Định (Locked)
                                      </span>
                                    )}
                                    <span className="text-[9px] font-mono text-stone-400 dark:text-slate-500">
                                      Nạp lúc: Lượt {m.turnNumber} • {new Date(m.timestamp).toLocaleTimeString("vi-VN", {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                  </div>
                                  <p className="text-xs text-stone-800 dark:text-slate-200 font-medium leading-relaxed break-words">
                                    {m.text}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Right part: action buttons */}
                            {!isEditing && (
                              <div className="shrink-0 flex items-start gap-1 justify-end opacity-40 hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => startEditing(m)}
                                  className="p-1 rounded text-stone-500 hover:text-mystic-accent hover:bg-stone-550 dark:hover:bg-slate-850 transition-colors"
                                  title="Chỉnh sửa ký ức"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteMemory(m.id, m.text)}
                                  className="p-1 rounded text-stone-500 hover:text-red-500 hover:bg-stone-550 dark:hover:bg-slate-850 transition-colors"
                                  title="Xóa vĩnh viễn"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 bg-stone-300 dark:bg-slate-900 border-t border-stone-400 dark:border-slate-850 flex justify-between items-center text-[10px] text-stone-500 dark:text-slate-400 px-5 shrink-0 select-none">
                <div className="flex gap-4">
                  <span>Tổng số ký ức: <strong>{memories.length}</strong></span>
                  <span>Cố định (Cá nhân): <strong>{memories.filter(m => m.isLocked).length}</strong></span>
                  <span>Phát giải động (AI): <strong>{memories.filter(m => !m.isLocked).length}</strong></span>
                </div>
                <span>ARK Core Mem0 Engine v2.10 • Live Sync Active</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
