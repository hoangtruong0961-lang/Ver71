import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldAlert, Dice5, HelpCircle, Check, HelpCircle as InfoIcon } from "lucide-react";

export interface FateSettings {
  enabled: boolean;
  diceType: "D20" | "D100";
  dc: number;
  autoRoll: boolean;
  cheatEnabled: boolean;
  rate: number;
  onlyHiddenFromSchedule: boolean;
}

interface FateSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: FateSettings;
  onSave: (settings: FateSettings) => void;
}

export const FateSettingsModal: React.FC<FateSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [localSettings, setLocalSettings] = React.useState<FateSettings>({ ...settings });
  const [newCrisisTitle, setNewCrisisTitle] = React.useState("");
  const [newCrisisDesc, setNewCrisisDesc] = React.useState("");
  const [newCrisisLoc, setNewCrisisLoc] = React.useState("");

  const handleAddCrisis = () => {
    if (!newCrisisTitle.trim() || !newCrisisDesc.trim()) return;
    const item = {
      title: newCrisisTitle.trim(),
      description: newCrisisDesc.trim(),
      location: newCrisisLoc.trim() || undefined,
    };
    setLocalSettings((prev) => ({
      ...prev,
      customCrises: [...(prev.customCrises || []), item],
    }));
    setNewCrisisTitle("");
    setNewCrisisDesc("");
    setNewCrisisLoc("");
  };

  const handleRemoveCrisis = (index: number) => {
    setLocalSettings((prev) => ({
      ...prev,
      customCrises: (prev.customCrises || []).filter((_, i) => i !== index),
    }));
  };

  React.useEffect(() => {
    if (isOpen) {
      setLocalSettings({ ...settings });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleToggleEnabled = () => {
    setLocalSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleToggleAutoRoll = () => {
    setLocalSettings((prev) => ({ ...prev, autoRoll: !prev.autoRoll }));
  };

  const handleToggleCheat = () => {
    setLocalSettings((prev) => ({ ...prev, cheatEnabled: !prev.cheatEnabled }));
  };

  const handleToggleOnlySchedule = () => {
    setLocalSettings((prev) => ({ ...prev, onlyHiddenFromSchedule: !prev.onlyHiddenFromSchedule }));
  };

  const handleChangeDiceType = (type: "D20" | "D100") => {
    const defaultDc = type === "D20" ? 8 : 40;
    setLocalSettings((prev) => ({ ...prev, diceType: type, dc: defaultDc }));
  };

  const handleChangeDc = (val: number) => {
    const max = localSettings.diceType === "D20" ? 20 : 100;
    const clamped = Math.min(Math.max(1, val), max);
    setLocalSettings((prev) => ({ ...prev, dc: clamped }));
  };

  const handleChangeRate = (val: number) => {
    const clamped = Math.min(Math.max(10, val), 100);
    setLocalSettings((prev) => ({ ...prev, rate: clamped }));
  };

  const handleSaveInternal = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-stone-200 dark:bg-mystic-900 border border-stone-400 dark:border-slate-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-stone-400 dark:border-slate-800 bg-stone-300 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
          <h2 className="text-base font-extrabold text-stone-800 dark:text-slate-200 flex items-center gap-2">
            <Dice5 className="text-amber-500 animate-pulse" size={18} />
            <span>Xúc Xắc Định Mệnh (Fate Roll)</span>
          </h2>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-800 dark:text-slate-400 dark:hover:text-white p-1.5 rounded-lg hover:bg-stone-400/30 dark:hover:bg-slate-800/80 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTAINER */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-stone-200/50 dark:bg-mystic-950/20">
          {/* Main Toggle */}
          <div className="p-4 rounded-xl border border-stone-400/40 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-sm">
            <div>
              <h3 className="text-xs font-bold text-stone-800 dark:text-slate-200 uppercase tracking-wider mb-0.5">
                Kích hoạt Xúc Xắc Số Phận
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-slate-400">
                Tự động tung xúc xắc kịch tính để dệt biến cố bất ngờ từ Ám Tuyến.
              </p>
            </div>
            <button
              onClick={handleToggleEnabled}
              className={`w-12 h-6 rounded-full p-1 transition-colors relative duration-300 ${
                localSettings.enabled ? "bg-amber-500" : "bg-stone-400 dark:bg-slate-700"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-all duration-300 shadow ${
                  localSettings.enabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <AnimatePresence>
            {localSettings.enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                {/* Mode Settings Group */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-stone-400/40 dark:border-slate-800 space-y-4 shadow-sm">
                  {/* Dice Type selection */}
                  <div>
                    <label className="text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
                      Loại xúc xắc định đoạt
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleChangeDiceType("D20")}
                        className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                          localSettings.diceType === "D20"
                            ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400"
                            : "bg-stone-100 dark:bg-slate-800 border-stone-300/60 dark:border-slate-700 text-stone-600 dark:text-slate-400 hover:bg-stone-100/50"
                        }`}
                      >
                        🎲 D20 (D&D Thừa Nhận)
                      </button>
                      <button
                        onClick={() => handleChangeDiceType("D100")}
                        className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                          localSettings.diceType === "D100"
                            ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400"
                            : "bg-stone-100 dark:bg-slate-800 border-stone-300/60 dark:border-slate-700 text-stone-600 dark:text-slate-400 hover:bg-stone-100/50"
                        }`}
                      >
                        🎲 D100 (Tỷ Lệ Bách Phân)
                      </button>
                    </div>
                  </div>

                  {/* DC Threshold & Rate */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-widest block mb-1">
                        Ngưỡng Thử Thách (DC)
                      </label>
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="number"
                          value={localSettings.dc}
                          onChange={(e) => handleChangeDc(parseInt(e.target.value) || 0)}
                          className="w-full bg-stone-150 dark:bg-slate-800/80 border border-stone-300 dark:border-slate-700 rounded-lg py-1.5 px-3 text-center text-xs font-extrabold text-amber-600 dark:text-amber-400"
                        />
                        <span className="text-[10px] text-stone-400 font-mono">
                          /{localSettings.diceType === "D20" ? 20 : 100}
                        </span>
                      </div>
                      <span className="text-[9px] text-stone-400 mt-1 block leading-tight">
                        Tung ở dưới giá trị này sẽ bị kích hoạt Biến Cố.
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-widest block mb-1">
                        Tần suất kiểm tra (%)
                      </label>
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="number"
                          value={localSettings.rate}
                          onChange={(e) => handleChangeRate(parseInt(e.target.value) || 0)}
                          className="w-full bg-stone-150 dark:bg-slate-800/80 border border-stone-300 dark:border-slate-700 rounded-lg py-1.5 px-3 text-center text-xs font-extrabold text-sky-600 dark:text-sky-400"
                        />
                        <span className="text-[10px] text-stone-400 font-mono">%</span>
                      </div>
                      <span className="text-[9px] text-stone-400 mt-1 block leading-tight">
                        Xác suất lượt chat kích hoạt tung xúc xắc.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub Options Details */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-stone-400/40 dark:border-slate-800 space-y-3 shadow-sm">
                  {/* Auto Roll toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-stone-700 dark:text-slate-200">
                        Hậu trường (Silent / Auto Roll)
                      </h4>
                      <p className="text-[10px] text-stone-400 dark:text-slate-400">
                        Tung xúc xắc ẩn dưới hậu đài thay vì hiện bảng đố tương tác.
                      </p>
                    </div>
                    <button
                      onClick={handleToggleAutoRoll}
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors relative duration-300 ${
                        localSettings.autoRoll ? "bg-amber-500/80" : "bg-stone-300 dark:bg-slate-705"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-all duration-300 shadow ${
                          localSettings.autoRoll ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Cheat Allowed toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-stone-200/50 dark:border-slate-800/50">
                    <div>
                      <h4 className="text-xs font-bold text-stone-700 dark:text-slate-200">
                        Xúc xắc gian lận (Cheat / Re-roll)
                      </h4>
                      <p className="text-[10px] text-stone-400 dark:text-slate-400">
                        Cho phép tung lại nếu bạn không bằng lòng với kết quả nghiệt ngã.
                      </p>
                    </div>
                    <button
                      onClick={handleToggleCheat}
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors relative duration-300 ${
                        localSettings.cheatEnabled ? "bg-amber-500/80" : "bg-stone-300 dark:bg-slate-705"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-all duration-300 shadow ${
                          localSettings.cheatEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Limit to schedule only or AI fallback */}
                  <div className="flex items-center justify-between pt-2 border-t border-stone-200/50 dark:border-slate-800/50">
                    <div>
                      <h4 className="text-xs font-bold text-stone-700 dark:text-slate-200">
                        Chỉ rút từ Lịch trình 7 ngày
                      </h4>
                      <p className="text-[10px] text-stone-400 dark:text-slate-400">
                        Nếu bật, hệ thống chỉ dùng biến thế Ám Tuyến có sẵn. Nếu tắt, AI sẽ viết biến cố kịch bản riêng thích ứng kịch tính.
                      </p>
                    </div>
                    <button
                      onClick={handleToggleOnlySchedule}
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors relative duration-300 ${
                        localSettings.onlyHiddenFromSchedule ? "bg-amber-500/80" : "bg-stone-300 dark:bg-slate-705"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-all duration-300 shadow ${
                          localSettings.onlyHiddenFromSchedule ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Custom Crises / Custom Triggers Section */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-stone-400/40 dark:border-slate-800 space-y-3 shadow-sm text-left">
                  <h4 className="text-xs font-bold text-stone-700 dark:text-slate-200 uppercase tracking-wider">
                    Biến Cố Tùy Chỉnh (Custom Crises) ({localSettings.customCrises?.length || 0})
                  </h4>
                  <p className="text-[10px] text-stone-450 dark:text-slate-400">
                    Tùy ý thêm hiểm họa do chính bạn thiết kế để làm phong phú nguồn sự kiện bất ngờ khi tung thất bại xúc xắc.
                  </p>

                  <div className="space-y-2 p-3 bg-stone-105 dark:bg-slate-950/40 rounded-lg border border-stone-300 dark:border-slate-800">
                    <input 
                      type="text"
                      placeholder="Tên biến cố (ví dụ: Cháy kho vũ khí, Thiên thạch rơi...)"
                      value={newCrisisTitle}
                      onChange={(e) => setNewCrisisTitle(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-stone-300 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-stone-850 dark:text-slate-100"
                    />
                    <textarea 
                      placeholder="Mô tả diễn biến cụ thể ép người chơi phản ứng tháo chạy hoặc hộ chiến..."
                      value={newCrisisDesc}
                      onChange={(e) => setNewCrisisDesc(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-stone-300 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-stone-850 dark:text-slate-100 h-16 resize-none"
                    />
                    <input 
                      type="text"
                      placeholder="Địa điểm liên đới (ví dụ: Vùng phụ cận, Bản thân... )"
                      value={newCrisisLoc}
                      onChange={(e) => setNewCrisisLoc(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-stone-300 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-stone-850 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleAddCrisis}
                      disabled={!newCrisisTitle.trim() || !newCrisisDesc.trim()}
                      className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs rounded transition-colors text-center uppercase"
                    >
                      + Thêm Biến Cố Vào Bộ Tuyến
                    </button>
                  </div>

                  {(localSettings.customCrises || []).length > 0 && (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1 mt-2">
                      {(localSettings.customCrises || []).map((ev, idx) => (
                        <div key={idx} className="flex justify-between items-start gap-2 p-2.5 bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-850 rounded text-xs">
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-stone-800 dark:text-slate-200">{ev.title}</span>
                            {ev.location && <span className="text-[9px] font-bold text-stone-400 dark:text-slate-550 font-mono ml-1">@{ev.location}</span>}
                            <p className="text-[10px] text-stone-550 dark:text-slate-400 leading-normal line-clamp-2 mt-0.5">{ev.description}</p>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleRemoveCrisis(idx)}
                            className="text-stone-400 hover:text-red-500 p-1 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-850 transition-colors shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Info Note box */}
                <div className="p-3 bg-amber-500/5 border border-amber-500/25 rounded-xl text-[10.5px] text-amber-700 dark:text-amber-300/90 leading-relaxed flex items-start gap-2">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    Khi rơi vào <strong className="text-amber-600 dark:text-amber-400">Biến Cố Ám Tuyến</strong>, cốt truyện sẽ bị cưỡng chế dâng trào căng thẳng lý tưởng. Các biến cố thúc đẩy tính rượt đuổi kịch tính, phá án trinh thám vô cùng hấp dẫn!
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="px-5 py-3 border-t border-stone-300 dark:border-slate-800/80 bg-stone-250 dark:bg-slate-905 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-stone-350 dark:bg-slate-800 hover:bg-stone-400 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-300 border border-stone-400/50 dark:border-slate-750 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSaveInternal}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 dark:bg-amber-550 dark:hover:bg-amber-650 text-white shadow flex items-center gap-1 transition-all"
          >
            <Check size={14} />
            Đồng Ý Thiết Lập
          </button>
        </div>
      </motion.div>
    </div>
  );
};
