import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Dices, AlertTriangle, CheckCircle, ShieldAlert, Sparkles, 
  RefreshCw, Send, X, AlertCircle, Skull, Wand2 
} from "lucide-react";
import { FateSettings } from "./FateSettingsModal";
import { WorldData, ChatMessage, AppSettings, GameTime } from "../../../../types";
import { getAiClient } from "../../../../services/ai/client";
import { formatGameTime } from "../../../../utils/timeUtils";
import { toast } from "sonner";
import { dbService } from "../../../../services/db/indexedDB";

interface FateRollOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: FateSettings;
  activeWorld: WorldData | null;
  history: ChatMessage[];
  appSettings: AppSettings;
  gameTime: GameTime;
  actionText: string;
  onAcceptFate: (finalPrompt: string) => void;
}

export const DEFAULT_CRISES = [
  {
    title: "Phục kích ám sát",
    description: "Một gã bịt mặt cầm chủy thủ bất ngờ lao ra từ bóng tối ngách phố rượt theo bén gót, tước đi sự yên bình của bạn dốc sức dồn bạn vào chân tường!",
    location: "Ngõ vắng lân cận"
  },
  {
    title: "Mật lệnh thất lạc",
    description: "Một chú bồ câu đưa tin loạng choạng rơi xuống chân bạn với đôi cánh đẫm máu. Chân nó buộc một mảnh mật thư đầy rẫy ký hiệu biểu trưng cho âm mưu chống lại hoàng quyền.",
    location: "Vị trí hiện tại"
  },
  {
    title: "Trực giác bất thường",
    description: "Một cơn rùng mình lạnh sống lưng chạy dọc tủy não. Bạn ngửi thấy mùi tử khí tẩm mộc hoặc khí độc bay lảng vảng trong sương mù xung quanh, đe dọa trực diện tính mạng.",
    location: "Không gian xung quanh"
  },
  {
    title: "Kẻ thù cũ chạm trán",
    description: "Ai đó lướt qua bạn với ánh mắt rực lửa hận thù. Đó là bộ hạ đắc lực của thế lực đối nghịch đang săn lùng tung tích các hành động của bạn bấy lâu nay.",
    location: "Đoạn phố sầm uất"
  },
  {
    title: "Dị vật rung chấn",
    description: "Vật phẩm hoặc mạt ngọc cổ xưa bạn đeo bên người bất ngờ rung lắc dữ dội rồi nứt vỡ ra làm đôi, dâng trào khí thế hắc ám xui xẻo rợp trời đất.",
    location: "Bản thân người chơi"
  }
];

export const FateRollOverlayModal: React.FC<FateRollOverlayModalProps> = ({
  isOpen,
  onClose,
  settings,
  activeWorld,
  history,
  appSettings,
  gameTime,
  actionText,
  onAcceptFate,
}) => {
  const [rollState, setRollState] = useState<"idle" | "rolling" | "rolled">("idle");
  const [rolledValue, setRolledValue] = useState<number>(1);
  const [tempValue, setTempValue] = useState<number>(1);
  const [isFailed, setIsFailed] = useState<boolean>(false);
  const [crisisEvent, setCrisisEvent] = useState<{ title: string; description: string; location?: string } | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [shakeValue, setShakeValue] = useState<boolean>(false);

  // Initialize roll logic when opened
  useEffect(() => {
    if (isOpen) {
      setRollState("idle");
      setRolledValue(1);
      setCrisisEvent(null);
      setIsGeneratingAi(false);
      
      // Auto-start roll trigger
      const timer = setTimeout(() => {
        handleRoll();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen || !activeWorld) return null;

  // Retrieve hidden events from schedule caches stored in IndexedDB
  const getHiddenEventsFromSchedule = (): { title: string; description: string; location?: string }[] => {
    const eventsList: { title: string; description: string; location?: string }[] = [];
    const worldId = activeWorld.id || "default";
    ["user", "char"].forEach((p) => {
      const cached = dbService.getKeyValueSync(`ark-schedule-v5-${worldId}-${p}`);
      if (cached) {
        try {
          const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
          if (parsed.days && Array.isArray(parsed.days)) {
            parsed.days.forEach((day: any) => {
              if (day.events && Array.isArray(day.events)) {
                day.events.forEach((ev: any) => {
                  if (ev.type === "hidden") {
                    eventsList.push({
                      title: ev.title,
                      description: ev.description,
                      location: ev.location || "Trong vùng lân cận"
                    });
                  }
                });
              }
            });
          }
          if (parsed.future && Array.isArray(parsed.future)) {
            parsed.future.forEach((ev: any) => {
              if (ev.type === "hidden") {
                eventsList.push({
                  title: ev.title,
                  description: ev.description,
                  location: ev.location || "Tương lai dự phóng"
                });
              }
            });
          }
        } catch (e) {
          console.error("Lỗi khi giải nén lịch trình cho xúc sắc định mệnh", e);
        }
      }
    });
    return eventsList;
  };

  const generateProceduralCrisis = async () => {
    setIsGeneratingAi(true);
    try {
      const aiClient = getAiClient(appSettings || undefined);
      const activeModel = appSettings?.aiModel || "gemini-3.1-pro-preview";
      
      const historyText = history.slice(-10)
        .map(m => `${m.role === "user" ? activeWorld.player.name : (activeWorld.entities?.[0]?.name || "AI")}: ${m.text}`)
        .join("\n\n");

      const prompt = `Bạn là Dungeon Master trong trò chơi nhập vai dã sử / kỳ ảo trinh thám. Người chơi vừa thực hiện hành động sau nhưng đã tung xúc xắc định mệnh thất bại (Fate Roll Failure):
"${actionText}"

Bối cảnh thế giới hiện hành:
- Thế giới nhập vai: ${activeWorld.world?.name || "Tự do khám phá"}
- Mô tả bối cảnh: ${activeWorld.world?.description || ""}
- Nhân vật chính: ${activeWorld.player.name} (${activeWorld.player.appearance || "Nhân vật chính"})
- Người đối thoại chủ chốt: ${activeWorld.entities?.[0]?.name || "AI"} (${activeWorld.entities?.[0]?.description || ""})
- Mốc thời gian game: ${formatGameTime(gameTime)} (Năm ${gameTime.year}, Tháng ${gameTime.month}, Ngày ${gameTime.day})

Hãy tạo ra một biến cố Ám tuyến phi thường đột ngột trực tiếp dội thẳng vào thế giới xung quanh họ (phù hợp với thế giới dã sử trinh thám và triệt tiêu tính hòa bình lúc này). Biến cố phải tạo ra thử thách trực diện (nhờ vả bị bẫy, rơi mật thư đầy ký tự lạ ám chỉ sát thủ đang săn đuổi, bóng đen đột kích trong sương mù, sập hầm cơ quan ẩn mật giấu kín...).

Yêu cầu định dạng JSON chính xác tuyệt đối sau:
{
  "title": "<Tiêu đề biến cố giật gân, mười chữ trở lại>",
  "description": "<Dòng miêu tả kịch tính giàu văn phong văn học gợi mở, khoảng 100 chữ bằng tiếng Việt>",
  "location": "<Vị trí chính xác phát sinh biến cố>"
}`;

      const response = await aiClient.models.generateContent({
        model: activeModel,
        contents: prompt,
        config: {
          temperature: 0.85,
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text ? response.text.trim() : "";
      const parsed = JSON.parse(responseText);
      if (parsed.title && parsed.description) {
        setCrisisEvent({
          title: parsed.title,
          description: parsed.description,
          location: parsed.location || "Ngay trước mắt"
        });
      } else {
        throw new Error("Dữ liệu JSON sinh từ AI không đúng cấu trúc.");
      }
    } catch (err) {
      console.error("Gặp lỗi sinh biến cố AI, sử dụng biến cố mặc định để phòng vệ:", err);
      const defaults = getHiddenEventsFromSchedule();
      const customOnes = settings.customCrises || [];
      const list = defaults.length > 0 
        ? defaults 
        : (customOnes.length > 0 ? customOnes : DEFAULT_CRISES);
      const pick = list[Math.floor(Math.random() * list.length)];
      setCrisisEvent(pick);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleRoll = () => {
    setRollState("rolling");
    setCrisisEvent(null);
    setShakeValue(false);

    // Fast-rolling values effect
    let cycles = 0;
    const maxCycles = 12;
    const interval = setInterval(() => {
      const maxVal = settings.diceType === "D20" ? 20 : 100;
      setTempValue(Math.floor(Math.random() * maxVal) + 1);
      cycles++;

      if (cycles >= maxCycles) {
        clearInterval(interval);
        
        // Compute final value
        const finalVal = Math.floor(Math.random() * maxVal) + 1;
        setRolledValue(finalVal);
        setTempValue(finalVal);
        setRollState("rolled");
        
        const failed = finalVal < settings.dc;
        setIsFailed(failed);
        setShakeValue(true);

        if (failed) {
          // Failure flow: Find an event
          const scheduleEvents = getHiddenEventsFromSchedule();
          const customOnes = settings.customCrises || [];
          if (settings.onlyHiddenFromSchedule && scheduleEvents.length > 0) {
            const randomPick = scheduleEvents[Math.floor(Math.random() * scheduleEvents.length)];
            setCrisisEvent(randomPick);
          } else if (settings.onlyHiddenFromSchedule) {
            // Falls back to local custom/defaults because user wanted schedule only but hadn't created any
            const list = customOnes.length > 0 ? customOnes : DEFAULT_CRISES;
            const randomPick = list[Math.floor(Math.random() * list.length)];
            setCrisisEvent(randomPick);
          } else {
            // Free adaptive Gemini generated crisis!
            generateProceduralCrisis();
          }
        }
      }
    }, 90);
  };

  const handleConfirmSubmit = () => {
    const diceName = settings.diceType;
    let finalPrompt = "";
    
    if (isFailed) {
      const title = crisisEvent?.title || "Biến Cố Ám Tuyến Ngẫu Nhiên";
      const desc = crisisEvent?.description || "Bóng tối bao phủ bước chân bạn.";
      const loc = crisisEvent?.location ? ` (Địa điểm: ${crisisEvent.location})` : "";
      
      finalPrompt = `${actionText}\n\n[🎲 BÁO CÁO HỆ THỐNG - XÚC XẮC ĐỊNH MỆNH]: Bạn thực hiện hành động trên nhưng đã tung thất bại xúc xắc ${diceName} = ${rolledValue} (Dưới độ khó DC ${settings.dc}).\n\nBIẾN CỐ ÁM TUYẾN ẬP XUỐNG: "${title}"${loc}\nDiễn biến biến cố bất ngờ: ${desc}\n\n(AI/Dungeon Master ơi hãy lồng ghép bối cảnh kịch tính giật gân của biến cố này trực diện vào câu từ phản hồi và cưỡng chế mâu thuẫn khốc liệt tiếp theo nhé!)`;
    } else {
      finalPrompt = `${actionText}\n\n[🎲 BÁO CÁO HỆ THỐNG - XÚC XẮC ĐỊNH MỆNH]: Bạn tung thành công xúc xắc Số phận ${diceName} = ${rolledValue} (Đạt hoặc vượt độ khó DC ${settings.dc}). Trực giác hoàn hảo mách bảo, bạn nương theo thời thế để lánh mình hoàn toàn khỏi các phục kích lén lút hay vận đen đeo bám.`;
    }

    onAcceptFate(finalPrompt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-stone-900/90 dark:bg-black/90 p-4 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-stone-200 dark:bg-mystic-900 border-2 border-amber-500/50 dark:border-amber-500/40 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.15)] flex flex-col max-h-[90vh]"
      >
        {/* BANNER HEADER */}
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-600/20 via-orange-600/10 to-transparent p-5 text-center flex flex-col items-center border-b border-stone-300 dark:border-slate-800">
          <div className="absolute top-2 right-2">
            <button 
              onClick={onClose}
              className="p-1 rounded bg-stone-300 dark:bg-slate-800 hover:bg-stone-400 dark:hover:bg-slate-705 text-stone-500 hover:text-stone-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <Dices className="text-amber-500 animate-spin-slow mb-1" size={32} />
          <h1 className="text-lg font-black tracking-tight dark:text-amber-400 text-amber-600 uppercase flex items-center gap-1.5">
            Xúc Xắc Định Mệnh
          </h1>
          <p className="text-[11px] text-stone-500 dark:text-slate-400 max-w-sm mt-0.5 leading-tight">
            Vũ trụ đang thẩm định hành động tiếp theo của bạn. Trốn thoát hay Đột kích, vạn sự tùy duyên!
          </p>
        </div>

        {/* MAIN BODY CONTENTS */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-stone-200 dark:bg-mystic-950/20">
          
          {/* User Pending Action */}
          <div className="p-3.5 bg-stone-300/60 dark:bg-slate-900/40 border border-stone-400/40 dark:border-slate-800 rounded-2xl">
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 dark:text-slate-500 mb-1 flex items-center gap-1.5">
              <span>Hành động dự tính của bạn</span>
            </h4>
            <p className="text-xs text-stone-700 dark:text-slate-300 italic font-medium leading-relaxed">
              &ldquo;{actionText}&rdquo;
            </p>
          </div>

          {/* DICE SPINNING GRAPHICS AREA */}
          <div className="flex flex-col items-center justify-center p-4">
            <motion.div
              animate={shakeValue ? { x: [0, -4, 4, -4, 4, 0], y: [0, 4, -4, 4, -4, 0] } : {}}
              transition={{ duration: 0.3 }}
              onClick={rollState === "rolled" ? handleRoll : undefined}
              className={`w-32 h-32 rounded-3xl bg-gradient-to-br from-stone-100 to-white dark:from-slate-800 dark:to-slate-900 border-2 flex flex-col items-center justify-center relative cursor-pointer group shadow-lg ${
                rollState === "rolling" 
                  ? "border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.25)]" 
                  : isFailed && rollState === "rolled"
                    ? "border-rose-500/60 shadow-[0_0_30px_rgba(239,68,68,0.2)]"
                    : !isFailed && rollState === "rolled"
                      ? "border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                      : "border-stone-400/65 dark:border-slate-700 hover:border-amber-500/50"
              }`}
            >
              {/* Glowing Ambient Backlight */}
              <div className="absolute inset-0 rounded-3xl bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Rolling Dice Textures */}
              <span className={`text-4xl font-extrabold font-mono transition-none ${
                rollState === "rolling" 
                  ? "text-amber-500 animate-pulse scale-95" 
                  : isFailed && rollState === "rolled"
                    ? "text-rose-500"
                    : !isFailed && rollState === "rolled"
                      ? "text-emerald-500 scale-105"
                      : "text-stone-500 dark:text-slate-400"
              }`}>
                {tempValue}
              </span>
              
              <span className="text-[8.5px] font-extrabold uppercase tracking-widest text-stone-400 dark:text-slate-500 mt-1.5">
                {settings.diceType}
              </span>

              {/* Dice Type Watermark */}
              <div className="absolute -top-1 -right-1 text-xs px-1.5 py-0.5 rounded-bl-xl bg-amber-500/10 border-l border-b border-amber-500/20 text-amber-500 font-bold scale-90">
                DC {settings.dc}
              </div>
            </motion.div>

            {/* Quick Status Bar */}
            <div className="mt-4 h-6 text-center">
              <AnimatePresence mode="wait">
                {rollState === "rolling" && (
                  <motion.div
                    key="rolling"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-xs font-bold text-amber-500 flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Vòng xoay số mệnh đang diễn biến...</span>
                  </motion.div>
                )}

                {rollState === "rolled" && (
                  <motion.div
                    key="rolled"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className={`text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
                      isFailed ? "text-rose-500" : "text-emerald-500"
                    }`}
                  >
                    {isFailed ? (
                      <>
                        <Skull size={14} className="animate-bounce" />
                        <span>Thất Bại (Trượt thử thách DC {settings.dc})</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} className="animate-pulse" />
                        <span>Thành Công (Hộ thân tránh họa!)</span>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* CRYSIS DISPLAY (FAILED FLOW) OR SUCCESS CONTEXT */}
          <AnimatePresence mode="wait">
            {rollState === "rolled" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="space-y-4"
              >
                {isFailed ? (
                  <div className="border border-rose-500/20 dark:border-rose-500/15 bg-rose-500/5 p-4 rounded-2xl space-y-3 relative overflow-hidden">
                    {/* Glowing side accent */}
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-red-500" />
                    
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-1.5 text-rose-500">
                        <AlertTriangle size={15} />
                        <h3 className="text-xs font-extrabold uppercase tracking-wider">
                          ÁM TUYẾN PHÁT SINH BIẾN CỐ
                        </h3>
                      </div>
                      <span className="text-[9px] font-mono font-bold uppercase py-0.5 px-2 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-500">
                        {crisisEvent?.location || "Khu vực sương mù"}
                      </span>
                    </div>

                    {isGeneratingAi ? (
                      <div className="py-4 flex flex-col items-center justify-center gap-2">
                        <Wand2 size={24} className="text-rose-500 animate-spin" />
                        <span className="text-[11px] font-bold text-rose-500/80 animate-pulse italic">
                          Dungeon Master AI đang dệt bối cảnh biến cố đột kích...
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h4 className="text-sm font-extrabold text-stone-800 dark:text-rose-400">
                          {crisisEvent?.title || "Phát sinh đột ngột"}
                        </h4>
                        <p className="text-xs text-stone-600 dark:text-slate-350 leading-relaxed font-sans font-medium whitespace-pre-wrap">
                          {crisisEvent?.description}
                        </p>
                      </div>
                    )}

                    {!isGeneratingAi && settings.cheatEnabled && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={handleRoll}
                          className="text-[9px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-500 flex items-center gap-1 border border-rose-400/20 bg-rose-500/5 px-2.5 py-1 rounded-md transition-all hover:bg-rose-500/10"
                        >
                          <RefreshCw size={10} /> Tung lại đầu hàng số phận
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-emerald-500/25 dark:border-emerald-500/20 bg-emerald-500/5 p-4 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-500" />
                    <div className="flex items-center gap-1.5 text-emerald-500 mb-1.5">
                      <CheckCircle size={15} />
                      <h3 className="text-xs font-extrabold uppercase tracking-wider">
                        THÂN THỂ BÌNH AN / NÉ TRÁNH NGUY HẠI
                      </h3>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-slate-350 leading-relaxed font-medium font-sans">
                      Mọi ám khí và biến cố bị triệt phá hoàn toàn trước giác quan nhạy bén hoặc may mắn tuyệt đỉnh từ xúc xắc của bạn. Bạn tự do tiến bước mà không chịu áp chế rắc rối nào trong lượt này!
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="px-6 py-4 border-t border-stone-300 dark:border-slate-800/80 bg-stone-250 dark:bg-slate-905 flex justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-stone-300 hover:bg-stone-350 dark:bg-slate-800 dark:hover:bg-slate-705 text-stone-600 dark:text-slate-400 border border-stone-400/40 dark:border-slate-750 transition-colors"
          >
            Hủy Bỏ Gửi
          </button>
          
          <button
            disabled={rollState !== "rolled" || isGeneratingAi}
            onClick={handleConfirmSubmit}
            className={`px-5 py-2.5 text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5 transition-all outline-none ${
              rollState !== "rolled" || isGeneratingAi
                ? "bg-stone-400 dark:bg-slate-800/50 text-stone-500 opacity-40 cursor-not-allowed border border-stone-405"
                : isFailed
                  ? "bg-rose-600 hover:bg-rose-700 text-white hover:shadow-rose-600/10"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-emerald-600/10"
            }`}
          >
            <Send size={14} />
            {isFailed ? "Xác Nhận Nhận Biến Cố" : "Thực Hiện Hành Động Trôi Chảy"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
