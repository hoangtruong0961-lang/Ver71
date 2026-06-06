import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Calendar, RefreshCw, User, Sparkles, MapPin, Clock, Heart, Eye, 
  HelpCircle, ChevronLeft, ChevronRight, Play, Compass, MessageSquare, 
  Trash2, Plus, Edit2, Check, AlertCircle, Copy, Send, Dices, CloudSun,
  ShieldAlert, CheckSquare, Square, Moon, CalendarRange, Sun, Cloud, CloudRain,
  Save, Activity, Zap
} from "lucide-react";
import { WorldData, ChatMessage, AppSettings, GameTime } from "../../../../types";
import { getAiClient } from "../../../../services/ai/client";
import { formatGameTime } from "../../../../utils/timeUtils";
import { tavoRegistry } from "../../../../services/api/tavoApi";
import { toast } from "sonner";
import { dbService } from "../../../../services/db/indexedDB";

interface EventItem {
  type: "main" | "hidden" | "bond";
  title: string;
  description: string;
  time: string;
  location: string;
  npcDynamic: string;
  status?: "todo" | "done" | "missed"; // CRM Status Tracking
}

interface parsedDays {
  dayNum: string;
  events: EventItem[];
  weather?: string; // Daily atmospheric weather
  omen?: string;    // Daily mystical omen
}

interface SchedulePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWorld: WorldData;
  history: ChatMessage[];
  settings: AppSettings | null;
  gameTime: GameTime;
  isMobile: boolean;
  setGameTime?: (time: GameTime) => void;
  onUpdateWorld?: (updates: Partial<WorldData>) => void;
  handleSend?: (text: string, isBypass?: boolean) => void;
}

// Preset assets for ease of custom editing
const WEATHER_PRESETS = [
  { label: "☀️ Nắng ấm", icon: <Sun size={12} className="text-amber-500" /> },
  { label: "☁️ Mây phủ u ám", icon: <Cloud size={12} className="text-slate-400" /> },
  { label: "🌧️ Mưa rào rả rích", icon: <CloudRain size={12} className="text-sky-400" /> },
  { label: "🌫️ Sương mù giăng lối", icon: <Cloud size={12} className="text-stone-300 animate-pulse" /> },
  { label: "🌩️ Bão giông sương gió", icon: <CloudRain size={12} className="text-purple-400" /> },
  { label: "🌌 Đêm sao tĩnh lặng", icon: <Moon size={12} className="text-yellow-200" /> }
];

const OMEN_PRESETS = [
  { label: "🍀 Cát Tường (Điềm lành đưa đường)", color: "text-emerald-500 bg-emerald-500/10" },
  { label: "🔮 Thiên Cơ (Vận mệnh bí ẩn)", color: "text-cyan-500 bg-cyan-500/10" },
  { label: "⚠️ Sát Khí (Hạn chế tranh đấu)", color: "text-amber-500 bg-amber-500/10" },
  { label: "⚔️ Huyết Nguyệt (Biến cố kịch tính)", color: "text-rose-500 bg-rose-500/10" },
  { label: "🔥 Khởi Sắc (Hành động quyết liệt)", color: "text-orange-500 bg-orange-500/10" },
  { label: "✨ Cơ Duyên (Nhân quả đưa đẩy)", color: "text-purple-500 bg-purple-500/10" }
];

export const SchedulePlannerModal: React.FC<SchedulePlannerModalProps> = ({
  isOpen,
  onClose,
  activeWorld,
  history,
  settings,
  gameTime,
  isMobile,
  setGameTime,
  onUpdateWorld,
  handleSend
}) => {
  const [activePerspective, setActivePerspective] = useState<"user" | "char">("char");
  const [activeTab, setActiveTab] = useState<number>(0); // Index of day tab (0, 1, 2)
  const [filterType, setFilterType] = useState<"all" | "main" | "hidden" | "bond">("all");

  // Chaos Drift and Butterfly Effects state tracking
  const [butterflyEffects, setButterflyEffects] = useState<any[]>([]);
  const [chaosIndex, setChaosIndex] = useState<number>(0);

  // Schedule state loaded from cache or generated
  const [scheduleData, setScheduleData] = useState<{
    days: parsedDays[];
    future: EventItem[];
    startDate: string | null;
    thought: string | null;
    raw: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("Khởi động bộ phân tích...");
  const [showRawOutput, setShowRawOutput] = useState(false);
  
  // Custom manual edit state (Raw DSL)
  const [isEditingRaw, setIsEditingRaw] = useState(false);
  const [rawTextEdit, setRawTextEdit] = useState("");

  // Interactive Form state for adding/editing events
  const [editingEvent, setEditingEvent] = useState<{
    isNew: boolean;
    dayIdx: number;   // -1 indicates Future section
    eventIdx: number; // Index in the list
    type: "main" | "hidden" | "bond";
    title: string;
    description: string;
    time: string;
    location: string;
    npcDynamic: string;
    status: "todo" | "done" | "missed";
  } | null>(null);

  // Weather & Omen editor triggers
  const [editingAtmosphereDayIdx, setEditingAtmosphereDayIdx] = useState<number | null>(null);

  // Fate roll state tracking
  const [rollingEventIdx, setRollingEventIdx] = useState<{ dayIdx: number; eventIdx: number } | null>(null);
  const [fateD20Roll, setFateD20Roll] = useState<number | null>(null);
  const [fateRollOutcome, setFateRollOutcome] = useState<{
    score: number;
    title: string;
    description: string;
    narrative: string;
  } | null>(null);
  const [rollModifier, setRollModifier] = useState<number>(0);
  const [isRollSpinning, setIsRollSpinning] = useState(false);

  const getCacheKey = (perspective: "user" | "char") => {
    const worldId = activeWorld.id || "default";
    return `ark-schedule-v5-${worldId}-${perspective}`;
  };

  // Load schedule from IndexedDB on open or perspective change
  useEffect(() => {
    if (isOpen) {
      const key = getCacheKey(activePerspective);
      const cached = dbService.getKeyValueSync(key);
      if (cached) {
        try {
          const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
          setScheduleData(parsed);
          setRawTextEdit(parsed.raw || "");
        } catch (e) {
          console.error("Failed to parse cached schedule:", e);
          setScheduleData(null);
        }
      } else {
        setScheduleData(null);
      }
      setActiveTab(0);
      setEditingEvent(null);
      setRollingEventIdx(null);
      setFateRollOutcome(null);

      // Load Butterfly Effects & Timeline Chaos
      const worldId = activeWorld.id || "default";
      const cachedEffects = dbService.getKeyValueSync(`ark-butterfly-effects-${worldId}`);
      if (cachedEffects) {
        try {
          const parsed = typeof cachedEffects === "string" ? JSON.parse(cachedEffects) : cachedEffects;
          setButterflyEffects(parsed);
          const baseChaos = parsed.reduce((sum: number, f: any) => sum + (f.chaosAdded || 10), 0);
          setChaosIndex(Math.min(100, Math.max(0, baseChaos)));
        } catch (err) {
          setButterflyEffects([]);
          setChaosIndex(0);
        }
      } else {
        setButterflyEffects([]);
        setChaosIndex(0);
      }
    }
  }, [isOpen, activePerspective, activeWorld.id]);

  if (!isOpen) return null;

  // Parser helper matching the ST-SevenDaysCal DSL & custom tags extension
  const parseCalendarXml = (raw: string) => {
    if (!raw || typeof raw !== "string") {
      return { thought: null, startDate: null, days: [], futureEvents: [], infoMap: {}, comments: [] };
    }
    let thought: string | null = null;
    const commentMatch = raw.match(/<!--([\s\S]*?)-->/);
    if (commentMatch) {
      const cleanedComment = commentMatch[1].trim();
      // Remove any prefix labels in the comment if needed
      thought = cleanedComment.replace(/Phân tích và dự phóng cốt truyện:/gi, "").trim();
    } else {
      const parts = raw.split(/<calendar_widget[^>]*>/i);
      if (parts.length > 1 && parts[0].trim()) {
        thought = parts[0].replace(/```/g, "").trim();
      }
    }

    const widgetMatch = raw.match(/<calendar_widget[^>]*>([\s\S]*?)<\/calendar_widget>/i);
    const widgetContent = widgetMatch ? widgetMatch[1] : raw;

    const lines = widgetContent.split("\n");
    let startDate: string | null = null;
    const days: parsedDays[] = [];
    let curDay: parsedDays | null = null;
    const futureEvents: EventItem[] = [];
    let inFuture = false;

    lines.forEach((line) => {
      const cleanedLine = line.trim();
      if (!cleanedLine) return;

      if (cleanedLine.startsWith("StartDate:")) {
        const val = cleanedLine.replace("StartDate:", "").trim();
        if (val) startDate = val;
        return;
      }

      // Check for Day line with optional extended weather/omen details
      // Day: Num [ | Weather: Text | Omen: Text ]
      const dayMatch = cleanedLine.match(/^Day:\s*(\d+)(.*)/i);
      if (dayMatch) {
        inFuture = false;
        const dayNum = dayMatch[1];
        let weather = "☀️ Nắng ấm";
        let omen = "🍀 Cát Tường";
        
        const extraInfo = dayMatch[2];
        if (extraInfo) {
          const weatherMatch = extraInfo.match(/Weather:\s*([^|]+)/i);
          if (weatherMatch) weather = weatherMatch[1].trim();
          const omenMatch = extraInfo.match(/Omen:\s*([^|]+)/i);
          if (omenMatch) omen = omenMatch[1].trim();
        }

        curDay = { dayNum, events: [], weather, omen };
        days.push(curDay);
        return;
      }

      if (cleanedLine.toLowerCase().startsWith("future:")) {
        inFuture = true;
        curDay = null;
        return;
      }

      if (cleanedLine.startsWith("Event:")) {
        const payload = cleanedLine.replace(/^Event:\s*/i, "").trim();
        const tokens = payload.split("|");
        
        let typeRaw = (tokens[0] || "main").trim().toLowerCase();
        let type: "main" | "hidden" | "bond" = "main";
        if (typeRaw === "hidden" || typeRaw === "bond" || typeRaw === "main") {
          type = typeRaw;
        }

        const eventItem: EventItem = {
          type,
          title: (tokens[1] || "Sự kiện chưa đặt tên").trim(),
          description: (tokens[2] || "Mô tả đang cập nhật.").trim(),
          time: (tokens[3] || "Vô định").trim(),
          location: (tokens[4] || "Không xác định").trim(),
          npcDynamic: (tokens[5] || "").trim(),
          status: ((tokens[6] || "todo").trim().toLowerCase() as any) || "todo"
        };

        if (inFuture) {
          futureEvents.push(eventItem);
        } else if (curDay) {
          curDay.events.push(eventItem);
        } else {
          if (days.length === 0) {
            curDay = { dayNum: "1", events: [eventItem], weather: "☀️ Nắng ấm", omen: "🍀 Cát Tường" };
            days.push(curDay);
          } else {
            days[days.length - 1].events.push(eventItem);
          }
        }
      }
    });

    return { days, future: futureEvents, startDate, thought };
  };

  // Bidirectional serialization of events state back to text DSL
  const serializeScheduleToDsl = (
    days: parsedDays[],
    future: EventItem[],
    startDate: string | null,
    thought: string | null
  ): string => {
    let lines: string[] = [];
    if (thought) {
      lines.push(`<!-- Phân tích và dự phóng cốt truyện: ${thought} -->`);
    }
    lines.push("<calendar_widget>");
    if (startDate) {
      lines.push(`StartDate: ${startDate}`);
    }
    days.forEach((day) => {
      let dayLine = `Day: ${day.dayNum}`;
      if (day.weather) dayLine += ` | Weather: ${day.weather}`;
      if (day.omen) dayLine += ` | Omen: ${day.omen}`;
      lines.push(dayLine);
      
      day.events.forEach((event) => {
        lines.push(`Event: ${event.type}|${event.title}|${event.description}|${event.time}|${event.location}|${event.npcDynamic || "Không"}|${event.status || "todo"}`);
      });
    });

    if (future && future.length > 0) {
      lines.push("Future:");
      future.forEach((event) => {
        lines.push(`Event: ${event.type}|${event.title}|${event.description}|${event.time}|${event.location}|${event.npcDynamic || "Không"}|${event.status || "todo"}`);
      });
    }
    lines.push("</calendar_widget>");
    return lines.join("\n");
  };

  // Helper to sync modified schedule state instantly to cache & editor raw value
  const syncAndSaveSchedule = (updatedDays: parsedDays[], updatedFuture: EventItem[], optThought?: string | null) => {
    const finalThought = optThought !== undefined ? optThought : (scheduleData?.thought || "Bộ óc chiến thuật xây dựng thời gian biểu...");
    const serialText = serializeScheduleToDsl(updatedDays, updatedFuture, scheduleData?.startDate || null, finalThought);
    
    const newSchedule = {
      days: updatedDays,
      future: updatedFuture,
      startDate: scheduleData?.startDate || null,
      thought: finalThought,
      raw: serialText
    };

    setScheduleData(newSchedule);
    setRawTextEdit(serialText);
    dbService.setKeyValue(getCacheKey(activePerspective), newSchedule);
  };

  const handleManualSaveSchedule = () => {
    try {
      const parsed = parseCalendarXml(rawTextEdit);
      const fullData = {
        ...parsed,
        raw: rawTextEdit
      };
      setScheduleData(fullData);
      dbService.setKeyValue(getCacheKey(activePerspective), fullData);
      setIsEditingRaw(false);
      toast.success("Đã lưu chỉnh sửa lịch trình thủ công!");
    } catch (e: any) {
      toast.error(`Lỗi phân tích cú pháp lịch trình: ${e.message}`);
    }
  };

  const handleGenerateSchedule = async () => {
    setIsLoading(true);
    setLoadingStep("Tổng hợp dữ liệu cốt truyện...");
    
    try {
      // Construct detailed context from last 20 messages to prevent context overflow or early anchor bias
      const targetMessages = history.slice(-20);
      const chatHistoryText = targetMessages
        .map(
          (m) =>
            `${m.role === "user" ? activeWorld.player.name : (activeWorld.entities?.[0]?.name || "AI")}: ${m.text}`
        )
        .join("\n\n");

      setLoadingStep("Khởi tạo bộ nhớ & Nhận dạng thiết lập...");
      const aiClient = getAiClient(settings || undefined);
      const activeModel = settings?.aiModel || "gemini-3.1-pro-preview";
      
      const companionName = activeWorld.entities?.[0]?.name || "NPC";
      const subjectName = activePerspective === "char" ? companionName : activeWorld.player.name;
      const companionSubject = activePerspective === "char" ? activeWorld.player.name : companionName;
      
      const currentFormattedTime = formatGameTime(gameTime);

      setLoadingStep("Biên soạn prompt hướng dẫn (Tạo lịch biểu)...");
      const systemPrompt = `Bạn là một nhà biên kịch cốt truyện kỳ cựu và trợ lý phân tích cốt truyện. Hãy đứng ở góc nhìn người quan sát hoàn toàn khách quan (ngôi thứ ba), dựa vào cốt truyện hội thoại đã có để lập thời gian biểu/lịch trình (Agenda) trong 3 ngày tiếp theo của cốt truyện nhập vai, kèm các manh mối gợi mở tương lai cho đối tượng được chọn.
Mọi dữ liệu sinh ra phải bám sát tình hình, thời gian và sự thực đang diễn ra trong chat, tuyệt đối không tự bịa ra mâu thuẫn đối nghịch không tồn tại.

Đối tượng lập lịch trình:
- Tên: ${subjectName}
- Vai trò & Hoàn cảnh hiện tại: ${activePerspective === "char" ? activeWorld.entities?.[0]?.description || "" : activeWorld.player.appearance || "Nhân vật chính"}
- Tâm lý: ${activePerspective === "char" ? activeWorld.entities?.[0]?.personality || "" : activeWorld.player.currentMood || "Bình thường"}
- Mục tiêu cá nhân: ${activePerspective === "char" ? "" : activeWorld.player.goal || "Khám phá thế giới"}

Mối quan hệ chính với: ${companionSubject}

【Quy định đặc thù ba loại sự kiện】:
Mỗi sự kiện bắt buộc ghi nhận đúng loại (type):
1. main (Minh Tuyến / Truyện Chính): Những hoạt động thiết thân, hành động trực diện đang diễn ra, hoặc lịch công tác, mưu sinh của ${subjectName}.
2. hidden (Ám Tuyến / Gợi ý Trinh Thám): Sự việc ngầm diễn ra ở ngoài tầm mắt, những lời tiên tri, âm mưu, bí mật lảng vảng xung quanh cốt truyện chưa được làm sáng tỏ.
3. bond (Hồng Tuyến / Liên kết Nhân duyên): Gặp gỡ, xung đột tình cảm, tương tác lãng mạn, gắn bó mật thiết, thù ghét hay thấu hiểu với ${companionSubject} hoặc NPC thế giới quan khác.

【Quy cách ngày tháng & Thiên Văn】:
- Mỗi ngày (Day 1, Day 2, Day 3) bạn phải tự đề xuất một yếu tố Thời tiết (Weather) và Điềm báo (Omen) hằng ngày dựa trên tinh thần phân khí bối cảnh (Ví dụ: "Weather: Sương mù dày | Omen: Cát Tường", hoặc "Weather: Bão tố dữ dội | Omen: Huyết Nguyệt").
- Day 1 là NGÀY HIỆN TẠI hoặc ngày bắt đầu sự việc kế tiếp ngay sau lượt hội thoại cuối cùng.
- StartDate đề xuất sử dụng định dạng YYYY-MM-DD từ mốc ngày tháng hiện tại của game dưới đây:
Mốc thời gian hiện tại trong Game: ${currentFormattedTime} (Năm ${gameTime.yearPrefix ?? gameTime.year}, Tháng ${gameTime.month}, Ngày ${gameTime.day})

【ĐỊNH DẠNG ĐẦU RA BẮT BUỘC KHÔNG THỂ THAY ĐỔI】:
Nhận xét phân tích ngắn gọn trong thẻ comment (khoảng 100 chữ bằng tiếng Việt):
<!-- Phân tích và dự phóng cốt truyện: <Tóm tắt ngắn gọn động cơ hiện tại của nhân vật, bầu không khí của cốt truyện, và hướng rẽ sắp tới> -->

Sau đó viết khối lịch trình bọc trong thẻ <calendar_widget>:
<calendar_widget>
StartDate: ${gameTime.year}-${gameTime.month.toString().padStart(2, '0')}-${gameTime.day.toString().padStart(2, '0')}
Day: 1 | Weather: Nắng ráo ấm áp | Omen: Cát Tường
Event: type|Tiêu đề thu hút|Mô tả đời thường (Văn phong mượt mà, sâu sắc, góc nhìn đời thường của nhân vật, từ 30 chữ)|Thời gian xảy ra (vd: Sáng, 09:30, Trưa, Đêm muộn)|Địa điểm diễn ra|Lưu ý đồng bộ NPC kỳ này (NPC Dynamic - Các NPC khác đang làm phản ứng gì, nếu không có ghi 'Không', tối thiểu 20 chữ)|todo
Event: type|Tiêu đề thu hút|...|todo
Day: 2 | Weather: Sương mù giăng lối | Omen: Thiên Cơ
Event: type|Tiêu đề thu hút|...|todo
Day: 3 | Weather: Mưa bão u tối | Omen: Huyết Nguyệt
Event: type|Tiêu đề thu hút|...|todo
Future:
Event: type|Tiêu đề viễn vọng tương lai|Mô tả khả năng/lời hứa sẽ hoàn thành|Thời gian giả đoán|Vị trí dự phóng|Diễn biến đồng minh liên quan|todo
</calendar_widget>

LƯU Ý CỰC KỲ QUAN TRỌNG:
- Toàn bộ bằng tiếng Việt tự nhiên và truyền cảm.
- type chỉ viết main / hidden / bond.
- Ngăn cách các trường thông tin của dòng Event bằng gạch đứng "|" và viết trên cùng 1 dòng. Trường thứ 7 mặc định ghi 'todo'.
- Viết khách quan, không dùng đại từ nhân xưng như "Tôi" để tránh nhầm lẫn góc nhìn. Dùng đại từ ngôi thứ ba hoặc tên riêng của ${subjectName}.`;

      setLoadingStep("Gửi yêu cầu tới bộ não AI (Gemini)...");
      const promptPayload = `Dưới đây là lịch sử cuộc trò chuyện nhập vai:\n${chatHistoryText}\n\n[MỆNH LỆNH SYSTEM]: ${systemPrompt}`;
      
      const response = await aiClient.models.generateContent({
        model: activeModel,
        contents: promptPayload,
        config: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      });

      const responseText = response.text || "";
      if (!responseText) {
        throw new Error("AI trả về phản hồi rỗng.");
      }

      setLoadingStep("Giải mã sơ đồ và cập nhật giao diện...");
      const parsed = parseCalendarXml(responseText);
      
      const scheduleObject = {
        ...parsed,
        raw: responseText
      };

      setScheduleData(scheduleObject);
      setRawTextEdit(responseText);
      
      dbService.setKeyValue(getCacheKey(activePerspective), scheduleObject);
      setActiveTab(0);
      
      toast.success(`Đã dựng xong lịch trình 3 ngày tương tác của ${subjectName}!`);
    } catch (e: any) {
      console.error(e);
      toast.error(`Lập lịch thất bại: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInjectToChat = (event: EventItem) => {
    const textToInject = `[Hành động phát sinh: Diễn biến sự kiện "${event.title}" tại ${event.location} (${event.time}) - Chi tiết: ${event.description}]`;
    
    if (tavoRegistry && tavoRegistry.setInputValue) {
      tavoRegistry.setInputValue(textToInject);
      toast.success("Đã nạp diễn biến lịch trình vào ô Chat!");
      onClose();
    } else {
      navigator.clipboard.writeText(textToInject);
      toast.success("Đã sao chép vào Clipboard! Hãy dán vào khung chat.");
    }
  };

  const handlePromptAiAboutEvent = (event: EventItem) => {
    const chatPrompt = `Tiếp tục diễn biến của nhập vai. Hãy lồng ghép một cách tự nhiên buổi định mệnh sau vào câu chuyện:
Sự kiện: ${event.title}
Thời gian: ${event.time} | Địa điểm: ${event.location}
Diễn biến chính: ${event.description}
${event.npcDynamic && event.npcDynamic !== "Không" ? `Biến động NPC liên đới: ${event.npcDynamic}` : ""}`;

    if (tavoRegistry && tavoRegistry.setInputValue) {
      tavoRegistry.setInputValue(chatPrompt);
      toast.success("Đã nạp câu lệnh gợi ý sự kiện vào ô Chat!");
      onClose();
    } else {
      navigator.clipboard.writeText(chatPrompt);
      toast.success("Đã sao chép prompt sự kiện vào Clipboard!");
    }
  };

  const handleClearSchedule = () => {
    if (window.confirm("Bạn có chắc muốn xóa lịch trình hiện tại của góc nhìn này không?")) {
      dbService.removeKeyValue(getCacheKey(activePerspective));
      setScheduleData(null);
      setRawTextEdit("");
      toast.info("Đã dọn sạch lưu trữ lịch trình.");
    }
  };

  // Chronos Time Warp Functionality
  const parseHourMinute = (timeStr: string): { hour: number; minute: number } => {
    if (!timeStr || typeof timeStr !== 'string') return { hour: 9, minute: 0 };
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return { hour: parseInt(match[1]), minute: parseInt(match[2]) };
    }
    const clean = timeStr.toLowerCase();
    if (clean.includes("sáng")) return { hour: 8, minute: 0 };
    if (clean.includes("trưa") || clean.includes("chương")) return { hour: 12, minute: 0 };
    if (clean.includes("chiều")) return { hour: 15, minute: 0 };
    if (clean.includes("tối")) return { hour: 19, minute: 0 };
    if (clean.includes("đêm") || clean.includes("muộn")) return { hour: 22, minute: 0 };
    return { hour: 9, minute: 0 };
  };

  const handleAdvanceTimeToEvent = (dayIdx: number, event: EventItem) => {
    if (!setGameTime) {
      toast.error("Bộ cấu hình cốt truyện chưa sẵn sàng để cấu trúc lại Khung Giờ lúc này.");
      return;
    }

    const labels = getTabLabel(dayIdx);
    const timeCoord = parseHourMinute(event.time);

    const targetTime: GameTime = {
      year: labels.year || gameTime.year,
      month: labels.month || gameTime.month,
      day: labels.day || gameTime.day,
      hour: timeCoord.hour,
      minute: timeCoord.minute
    };

    if (window.confirm(`Bạn muốn dịch chuyển thời gian của game đến mốc [${event.time}] Ngày ${labels.date} (${targetTime.hour.toString().padStart(2, '0')}:${targetTime.minute.toString().padStart(2, '0')}) chứ?`)) {
      setGameTime(targetTime);
      toast.success(`Hệ thống dịch chuyển dòng thời sự đến ${event.time}!`);

      // Trigger automatic narration prompt if handleSend is available
      const promptContext = `[Tua thời gian cốt truyện] dịch chuyển đột phá tới ${event.time} ngày hôm sau (${targetTime.day}/${targetTime.month} tại ${event.location}). Bắt đầu sự kiện: "${event.title}". Diễn biến sự kiện lúc này thế nào?`;
      
      if (handleSend) {
        handleSend(promptContext);
        onClose();
      } else if (tavoRegistry && tavoRegistry.setInputValue) {
        tavoRegistry.setInputValue(promptContext);
        onClose();
      }
    }
  };

  // Interactive D20 Dice RPG Fate Simulator
  const handleTriggerFateRoll = (dayIdx: number, eventIdx: number) => {
    setRollingEventIdx({ dayIdx, eventIdx });
    setFateD20Roll(null);
    setFateRollOutcome(null);
    setIsRollSpinning(true);

    let animationCounter = 0;
    const interval = setInterval(() => {
      setFateD20Roll(Math.floor(Math.random() * 20) + 1);
      animationCounter++;
      if (animationCounter > 10) {
        clearInterval(interval);
        
        // Final roll execution
        const finalScore = Math.floor(Math.random() * 20) + 1;
        const totalScore = finalScore + rollModifier;
        setFateD20Roll(finalScore);
        setIsRollSpinning(false);

        let outcomeTitle = "Thành công tuyệt đối";
        let outcomeDesc = "Mọi việc diễn ra vượt ngoài mong đợi, mang lại lợi thế cực lớn.";
        let outcomePrompt = "";

        if (totalScore <= 1) {
          outcomeTitle = "⭐ HOÀN TOÀN BẠI VONG (Critical Fail)";
          outcomeDesc = "Kế hoạch sụp đổ nghiêm trọng. Một biến cố bất lợi không tưởng ập xuống làm dở dang lịch trình.";
          outcomePrompt = `[Thử thách Vận Mệnh thất bại thảm hại! D20 Roll: ${finalScore} + Mod: ${rollModifier} = ${totalScore}]. Sự kiện "${scheduleData?.days[dayIdx]?.events[eventIdx].title || ""}" tại ${scheduleData?.days[dayIdx]?.events[eventIdx].location || ""} lập tức phát sinh biến số cực kỳ nguy hiểm và thất rỡ tệ hại ngoài mong muốn. Hãy miêu tả bối cảnh tồi tệ này!`;
        } else if (totalScore <= 8) {
          outcomeTitle = "🔴 THẤT BẠI TRẮC TRỞ (Failure)";
          outcomeDesc = "Lịch trình gặp chướng ngại phiền toái. Mọi việc không mượt mà như mong muốn.";
          outcomePrompt = `[Thử thách Vận Mệnh thất bại! D20 Roll: ${finalScore} + Mod: ${rollModifier} = ${totalScore}]. Sự kiện "${scheduleData?.days[dayIdx]?.events[eventIdx].title || ""}" diễn ra trắc trở, gặp cản trở lớn hoặc không đem lại kết quả như tính toán.`;
        } else if (totalScore <= 13) {
          outcomeTitle = "🟡 THÀNH CÔNG GƯỢNG ÉP (Mixed Outcome)";
          outcomeDesc = "Hoàn thành được lịch trình nhưng nhân vật phải trả giá, hy sinh thể lực hoặc làm tổn hại quan hệ cốt truyện.";
          outcomePrompt = `[Thử thách Vận Mệnh đầy thử thách thành công bán phần! D20 Roll: ${finalScore} + Mod: ${rollModifier} = ${totalScore}]. Sự kiện "${scheduleData?.days[dayIdx]?.events[eventIdx].title || ""}" thành công nhưng nhân vật phải thỏa hiệp phức tạp, hao tài tốn lực hoặc có một mối đe dọa đi kèm.`;
        } else if (totalScore <= 18) {
          outcomeTitle = "🟢 THÀNH CÔNG VẺ VANG (Success)";
          outcomeDesc = "Sự việc suôn sẻ, nhân vật đạt chính diện bối cảnh mưu tính gặt hái thông tin dạt dào.";
          outcomePrompt = `[Thử thách vạn sự Đạt Thành! D20 Roll: ${finalScore} + Mod: ${rollModifier} = ${totalScore}]. Sự kiện "${scheduleData?.days[dayIdx]?.events[eventIdx].title || ""}" tại ${scheduleData?.days[dayIdx]?.events[eventIdx].location || ""} gặt hái thành tựu mỹ mãn, thông tin trôi chảy suôn sẻ tuyệt đối.`;
        } else {
          outcomeTitle = "🔥 ĐẠI THÀNH CÔNG PHI THƯỜNG (Critical Success!)";
          outcomeDesc = "Nhiều điều may mắn tột đỉnh, thế giới phản hồi đặc thù làm rực rỡ mốc truyền kỳ.";
          outcomePrompt = `[Thử thách Vạn Sự cực đại thành công tuyệt đỉnh! D20 Roll: ${finalScore} + Mod: ${rollModifier} = ${totalScore}]. Sự kiện "${scheduleData?.days[dayIdx]?.events[eventIdx].title || ""}" rực sáng với vận may hiếm có, nhận thêm duyên phận đặc biệt hoặc giải mã bí ẩn vĩ đại từ thế giới quan ngoài bối cảnh!`;
        }

        setFateRollOutcome({
          score: totalScore,
          title: outcomeTitle,
          description: outcomeDesc,
          narrative: outcomePrompt
        });
      }
    }, 85);
  };

  // CRUD Handler - Update single event status
  const handleToggleEventStatus = (dayIdx: number, eventIdx: number) => {
    if (!scheduleData) return;
    const daysCopy = JSON.parse(JSON.stringify(scheduleData.days)) as parsedDays[];
    const targetEvent = daysCopy[dayIdx].events[eventIdx];
    
    // Cycle status: todo -> done -> missed -> todo
    const cycleMap: Record<string, "todo" | "done" | "missed"> = {
      "todo": "done",
      "done": "missed",
      "missed": "todo"
    };

    targetEvent.status = cycleMap[targetEvent.status || "todo"];
    toast.info(`Cập nhật trạng thái sự kiện: ${targetEvent.title} -> ${targetEvent.status.toUpperCase()}`);
    syncAndSaveSchedule(daysCopy, scheduleData.future);
  };

  // CRUD Handler - Delete visual event
  const handleDeleteVisualEvent = (dayIdx: number, eventIdx: number) => {
    if (!scheduleData) return;
    if (window.confirm("Bạn muốn xóa sự kiện này khỏi lịch biểu?")) {
      const daysCopy = JSON.parse(JSON.stringify(scheduleData.days)) as parsedDays[];
      const futureCopy = [...scheduleData.future];

      if (dayIdx === -1) {
        futureCopy.splice(eventIdx, 1);
      } else {
        daysCopy[dayIdx].events.splice(eventIdx, 1);
      }

      toast.success("Đã xóa sự kiện!");
      syncAndSaveSchedule(daysCopy, futureCopy);
    }
  };

  // CRUD Handler - Trigger Create/Edit Form opening
  const handleOpenEditForm = (dayIdx: number, eventIdx: number, existing?: EventItem) => {
    if (existing) {
      setEditingEvent({
        isNew: false,
        dayIdx,
        eventIdx,
        type: existing.type,
        title: existing.title,
        description: existing.description,
        time: existing.time,
        location: existing.location,
        npcDynamic: existing.npcDynamic || "Không",
        status: existing.status || "todo"
      });
    } else {
      setEditingEvent({
        isNew: true,
        dayIdx,
        eventIdx: -1,
        type: "main",
        title: "",
        description: "",
        time: "10:00",
        location: "Trong phòng ngủ",
        npcDynamic: "Không",
        status: "todo"
      });
    }
  };

  // CRUD Handler - Submit interactive save form
  const handleSaveEventForm = () => {
    if (!editingEvent || !scheduleData) return;
    if (!editingEvent.title.trim()) {
      toast.error("Vui lòng ghi tiêu đề sự kiện!");
      return;
    }

    const daysCopy = JSON.parse(JSON.stringify(scheduleData.days)) as parsedDays[];
    const futureCopy = [...scheduleData.future];

    const updatedEventItem: EventItem = {
      type: editingEvent.type,
      title: editingEvent.title.trim(),
      description: editingEvent.description.trim() || "Diễn biến bối cảnh đời thường đang phát sinh.",
      time: editingEvent.time.trim() || "Vô định",
      location: editingEvent.location.trim() || "Chưa xác định",
      npcDynamic: editingEvent.npcDynamic.trim() || "Không",
      status: editingEvent.status
    };

    if (editingEvent.isNew) {
      if (editingEvent.dayIdx === -1) {
        futureCopy.push(updatedEventItem);
      } else {
        daysCopy[editingEvent.dayIdx].events.push(updatedEventItem);
      }
      toast.success("Đã bổ sung sự kiện mới!");
    } else {
      if (editingEvent.dayIdx === -1) {
        futureCopy[editingEvent.eventIdx] = updatedEventItem;
      } else {
        daysCopy[editingEvent.dayIdx].events[editingEvent.eventIdx] = updatedEventItem;
      }
      toast.success("Thông tin sự kiện đã được lưu!");
    }

    syncAndSaveSchedule(daysCopy, futureCopy);
    setEditingEvent(null);
  };

  // CRUD Handler - Change day atmosphere (Weather/Omen)
  const handleSaveAtmosphere = (dayIdx: number, weather: string, omen: string) => {
    if (!scheduleData) return;
    const daysCopy = JSON.parse(JSON.stringify(scheduleData.days)) as parsedDays[];
    daysCopy[dayIdx].weather = weather;
    daysCopy[dayIdx].omen = omen;
    
    syncAndSaveSchedule(daysCopy, scheduleData.future);
    setEditingAtmosphereDayIdx(null);
    toast.success(`Đã đồng bộ Thiên tượng hằng ngày thành công!`);
  };

  // Build styled tags for event type
  const renderTypeBadge = (type: "main" | "hidden" | "bond") => {
    switch (type) {
      case "main":
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-400/20 rounded-lg">
            <Sparkles size={8} className="animate-pulse" /> Minh Tuyến (Chính)
          </span>
        );
      case "hidden":
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-400/20 rounded-lg">
            <Eye size={8} /> Ám Tuyến (Ẩn)
          </span>
        );
      case "bond":
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-300 border border-pink-400/20 rounded-lg">
            <Heart size={8} /> Nhân Duyên (Liên kết)
          </span>
        );
    }
  };

  // Calculate coordinates for day based on StartDate representation
  const getTabLabel = (idx: number) => {
    if (scheduleData?.startDate) {
      try {
        const baseDate = new Date(scheduleData.startDate);
        if (!isNaN(baseDate.getTime())) {
          baseDate.setDate(baseDate.getDate() + idx);
          const month = baseDate.getMonth() + 1;
          const date = baseDate.getDate();
         
          const weekdays = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
          const wd = weekdays[baseDate.getDay()];
          
          return {
            date: `${date}/${month}`,
            desc: wd,
            day: date,
            month,
            year: baseDate.getFullYear()
          };
        }
      } catch (e) {}
    }
    return {
      date: `Ngày ${idx + 1}`,
      desc: `Lịch trình`,
      day: gameTime.day + idx,
      month: gameTime.month,
      year: gameTime.year
    };
  };

  const companionName = activeWorld.entities?.[0]?.name || "Đối tác";
  const subjectName = activePerspective === "char" ? companionName : activeWorld.player.name;

  // Render weather background colors
  const getWeatherIcon = (weatherText: string) => {
    const clean = weatherText.toLowerCase();
    if (clean.includes("nắng") || clean.includes("ấm")) return <Sun size={14} className="text-amber-500" />;
    if (clean.includes("mưa") || clean.includes("phùn")) return <CloudRain size={14} className="text-sky-400" />;
    if (clean.includes("bão") || clean.includes("sét")) return <Zap size={14} className="text-fuchsia-400" />;
    if (clean.includes("sương") || clean.includes("mù")) return <Cloud size={14} className="text-stone-300 animate-pulse" />;
    if (clean.includes("sao") || clean.includes("tĩnh")) return <Moon size={14} className="text-yellow-200" />;
    return <Sun size={14} className="text-amber-500" />;
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-4" id="agenda_planner_modal_overlay">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-stone-200 dark:bg-mystic-900 border border-stone-400 dark:border-slate-800 w-full max-w-5xl h-[90vh] md:h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        id="agenda_planner_card_wrapper"
      >
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-stone-400 dark:border-slate-800 bg-stone-300 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-400/30 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shadow-inner">
              <CalendarRange size={20} />
            </div>
            <div>
              <h2 className="text-base md:text-xl font-bold text-stone-900 dark:text-slate-100 flex items-center gap-2 leading-none font-sans">
                Lịch Trình Định Mệnh <span className="text-[9px] py-1 px-2.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold font-mono border border-indigo-500/20 shadow-sm">ARK AGENDA v6</span>
              </h2>
              <p className="text-[10px] text-stone-500 dark:text-slate-400 mt-1.5 font-bold uppercase tracking-widest leading-none">
                Thiết lập mật biểu, gieo quẻ vận mệnh & nhảy vọt dòng chảy Chronos
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowRawOutput(!showRawOutput)}
              disabled={!scheduleData?.raw}
              className={`p-1.5 px-3 rounded-xl border text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                showRawOutput 
                  ? "bg-mystic-accent text-white border-mystic-accent shadow-md" 
                  : "bg-stone-300/65 border-stone-400/40 text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200 hover:bg-stone-300"
              }`}
            >
              Cú Pháp DSL thô
            </button>
            <button
              onClick={onClose}
              className="p-1 px-2 rounded-xl bg-stone-300/40 hover:bg-rose-500 dark:hover:bg-rose-500 text-stone-600 hover:text-white dark:text-slate-400 dark:hover:text-white transition-all border-none shadow-sm cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PERSPECTIVE SELECTOR & ACTIONS SUB-BAR */}
        <div className="px-6 py-3.5 border-b border-stone-400 dark:border-slate-800/55 bg-stone-300/40 dark:bg-mystic-850/30 flex flex-col md:flex-row justify-between items-center shrink-0 gap-3">
          <div className="flex items-center gap-1.5 bg-stone-300/80 dark:bg-slate-950/50 p-1.5 rounded-2xl border border-stone-400/30 dark:border-slate-800/90 shadow-inner w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setActivePerspective("char")}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all select-none border-none cursor-pointer whitespace-nowrap ${
                activePerspective === "char"
                  ? "bg-indigo-500 text-white shadow-md scale-[1.03]"
                  : "text-stone-600 dark:text-slate-500 hover:text-stone-900 dark:hover:text-slate-300"
              }`}
            >
              <User size={12} />
              <span>Sổ của {companionName}</span>
            </button>
            <button
              onClick={() => setActivePerspective("user")}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all select-none border-none cursor-pointer whitespace-nowrap ${
                activePerspective === "user"
                  ? "bg-indigo-500 text-white shadow-md scale-[1.03]"
                  : "text-stone-600 dark:text-slate-500 hover:text-stone-900 dark:hover:text-slate-300"
              }`}
            >
              <User size={12} />
              <span>Sổ của {activeWorld.player.name} (Bạn)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {scheduleData && !isEditingRaw && (
              <button
                onClick={() => setIsEditingRaw(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-300/80 dark:bg-slate-800/50 hover:bg-stone-300 dark:hover:bg-slate-800 hover:text-indigo-500 rounded-xl text-xs font-bold border border-stone-400/60 dark:border-slate-700 text-stone-600 dark:text-slate-350 transition-all cursor-pointer"
              >
                <Edit2 size={12} /> Soạn DSL
              </button>
            )}
            
            {scheduleData && (
              <button
                onClick={handleClearSchedule}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold border border-rose-500/30 text-rose-500 dark:text-rose-400 transition-all cursor-pointer"
                title="Xóa kế hoạch của góc nhìn này"
              >
                <Trash2 size={12} /> Xóa lịch biểu
              </button>
            )}

            <button
              onClick={handleGenerateSchedule}
              disabled={isLoading}
              className="h-8.5 flex items-center gap-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold uppercase shadow-md active:scale-95 disabled:opacity-40 select-none border-none cursor-pointer transition-all"
            >
              <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
              {scheduleData ? "AI Dựng lại lịch" : "Dựng lịch trình AI"}
            </button>
          </div>
        </div>

        {/* MAIN BODY AREA */}
        <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col md:flex-row bg-stone-200 dark:bg-mystic-900/40">
          
          {isLoading ? (
            /* LOADING PROCESS OVERLAY */
            <div className="absolute inset-0 z-40 bg-stone-200/98 dark:bg-mystic-950/98 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
              <div className="relative w-20 h-20 flex items-center justify-center mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <Calendar size={32} className="text-indigo-500 animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-slate-100 uppercase tracking-widest mb-1.5">
                Đang kiến lập lịch trình...
              </h3>
              <p className="text-xs font-bold text-indigo-500 dark:text-indigo-300 font-mono bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20">
                {loadingStep}
              </p>
              
              <div className="mt-8 max-w-sm space-y-1 block max-h-32 overflow-y-auto opacity-75">
                <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-relaxed italic">
                  "Hệ thống định hình tuyến thời gian dựa trên các lorebooks, lịch sử chat và thói quen hoạt động thực tế..."
                </p>
              </div>
            </div>
          ) : null}

          {showRawOutput ? (
            /* RAW OUTPUT DSL VIEW */
            <div className="flex-1 h-full p-6 flex flex-col bg-stone-250 dark:bg-slate-950 overflow-hidden font-mono text-xs">
              <div className="flex justify-between items-center mb-2 shrink-0">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-stone-500 dark:text-slate-400">DSL cấu trúc hệ thống (ST Calendar Custom Format)</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(rawTextEdit);
                    toast.success("Đã sao chép nội dung cấu trúc!");
                  }}
                  className="p-1 px-3.5 rounded-lg hover:bg-stone-300 dark:hover:bg-slate-800 text-[10px] uppercase font-bold border border-stone-400 dark:border-slate-700 text-stone-600 dark:text-slate-300 transition-all flex items-center gap-1 font-sans"
                >
                  <Copy size={12} /> Copy DSL
                </button>
              </div>
              <textarea
                value={rawTextEdit}
                onChange={(e) => setRawTextEdit(e.target.value)}
                readOnly={!isEditingRaw}
                className="flex-1 w-full p-4 bg-stone-300/40 dark:bg-slate-900 rounded-2xl border border-stone-400 dark:border-slate-800 text-stone-850 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none font-mono text-xs leading-relaxed custom-scrollbar"
                placeholder="Khấu trúc DSL..."
              />
              {isEditingRaw && (
                <div className="mt-3 flex gap-2 justify-end shrink-0">
                  <button 
                    onClick={handleManualSaveSchedule}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none cursor-pointer shadow flex items-center gap-1.5"
                  >
                    <Check size={12} /> Lưu thay đổi và tái lập
                  </button>
                  <button 
                    onClick={() => {
                      setIsEditingRaw(false);
                      setRawTextEdit(scheduleData?.raw || "");
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-300 dark:bg-slate-800 text-stone-600 dark:text-slate-350 hover:bg-stone-400"
                  >
                    Hủy chỉnh sửa
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* INTERACTIVE VISUAL SCHEDULER */
            <>
              {scheduleData ? (
                <>
                  {/* LEFT TAB NAVIGATION */}
                  <div className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-stone-400 dark:border-slate-800 overflow-x-auto md:overflow-x-visible md:overflow-y-auto flex md:flex-col gap-1.5 p-3 bg-stone-300/25 dark:bg-slate-905/20 custom-scrollbar">
                    
                    <div className="hidden md:block select-none mb-1.5 px-2 text-[9.5px] font-black uppercase tracking-widest text-stone-500 dark:text-slate-500">
                      Cột Ngày Thần Mệnh
                    </div>

                    {scheduleData.days.map((day, dIdx) => {
                      const isActive = activeTab === dIdx;
                      const tabLbl = getTabLabel(dIdx);
                      return (
                        <button
                          key={dIdx}
                          onClick={() => {
                            setActiveTab(dIdx);
                            setRollingEventIdx(null);
                            setFateRollOutcome(null);
                          }}
                          className={`flex-1 md:flex-initial flex md:flex-col items-center md:items-start justify-center md:justify-start gap-1 p-3 rounded-2xl transition-all cursor-pointer select-none text-left border ${
                            isActive
                              ? "bg-white dark:bg-slate-800 border-indigo-400/50 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md md:translate-x-1"
                              : "border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-slate-300 hover:bg-stone-300/40 dark:hover:bg-slate-800/40"
                          }`}
                        >
                          <div className="flex md:flex-row items-center justify-between w-full">
                            <span className={`text-xs font-black uppercase font-mono leading-none ${isActive ? 'text-indigo-500' : 'text-stone-850 dark:text-slate-200'}`}>
                              {tabLbl.date}
                            </span>
                            <span className="hidden md:inline text-[11px] opacity-80 shrink-0">
                              {getWeatherIcon(day.weather || "")}
                            </span>
                          </div>
                          <span className="text-[10px] opacity-75 font-bold block leading-relaxed">
                            {tabLbl.desc}
                          </span>
                          <span className="hidden md:inline text-[8px] mt-1 text-stone-400 font-mono italic">
                            {(day.omen || "🍀 Cát Tường").substring(0, 18)}...
                          </span>
                        </button>
                      );
                    })}

                    <button
                      onClick={() => {
                        setActiveTab(scheduleData.days.length);
                        setRollingEventIdx(null);
                        setFateRollOutcome(null);
                      }}
                      className={`flex-1 md:flex-initial flex md:flex-col items-center md:items-start justify-center md:justify-start gap-1 p-3 rounded-2xl transition-all cursor-pointer select-none text-left border ${
                        activeTab === scheduleData.days.length
                          ? "bg-white dark:bg-slate-800 border-indigo-400/50 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md md:translate-x-1"
                          : "border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-slate-300 hover:bg-stone-300/40 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <span className="text-xs font-black uppercase font-mono leading-none flex items-center gap-1">
                        <Compass size={11} /> Tương Lai
                      </span>
                      <span className="text-[10px] opacity-75 font-semibold block">
                        Dự phóng xa hơn
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab(-2);
                        setRollingEventIdx(null);
                        setFateRollOutcome(null);
                      }}
                      className={`flex-1 md:flex-initial flex md:flex-col items-center md:items-start justify-center md:justify-start gap-1.5 p-3 rounded-2xl transition-all cursor-pointer select-none text-left border ${
                        activeTab === -2
                          ? "bg-rose-500/15 dark:bg-rose-950/25 border-rose-450 dark:border-rose-900 text-rose-700 dark:text-rose-450 shadow-md md:translate-x-1"
                          : "border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-slate-300 hover:bg-stone-300/45 dark:hover:bg-slate-800/40 hover:text-rose-500"
                      }`}
                    >
                      <span className="text-xs font-black uppercase font-mono leading-none flex items-center gap-1.5">
                        <ShieldAlert size={12} className="text-rose-500 animate-pulse" /> Cánh Bướm ({butterflyEffects.length})
                      </span>
                      <span className="text-[10px] opacity-75 font-semibold block">
                        Divergence Log ({chaosIndex}%)
                      </span>
                    </button>
                  </div>

                  {/* RIGHT PANEL - DETAILS AND EVENTS */}
                  <div className="flex-1 h-full overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-4">
                    
                    {activeTab === -2 ? (
                      /* CHAOS DRIFT / BUTTERFLY EFFECTS LOG PANEL */
                      <div className="space-y-6">
                        {/* Summary Header */}
                        <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-500/10 via-red-500/5 to-transparent border-l-4 border-rose-500 bg-stone-300/30 dark:bg-slate-900/50 relative overflow-hidden">
                          <div className="absolute right-0 top-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
                          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-rose-500 mb-1.5 font-mono tracking-widest">
                            <ShieldAlert size={14} className="shrink-0 animate-pulse" /> Bộ giám sát nghịch lý không-thời gian
                          </div>
                          <h3 className="text-base md:text-lg font-black text-rose-700 dark:text-rose-400 uppercase tracking-tight">
                            Hiệu Ứng Cánh Bướm & Vết Rạn Tuyến Tính
                          </h3>
                          <p className="text-xs text-stone-600 dark:text-slate-300 leading-relaxed font-sans mt-2">
                            Mỗi sự kiện trong lịch trình bị lỡ hẹn hoặc thực hiện thất bại sẽ dội lại hệ quả vô hình vào dòng thời gian. Khi gieo rắc quá nhiều hỗn loạn, bối cảnh nhập vai sẽ biến chuyển kỳ dị ngoài tính toán, thử thách định mệnh sẽ trở nên khắc nghiệt gấp bội!
                          </p>
                        </div>

                        {/* Chaos Index Gauge Card */}
                        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-320 dark:border-slate-800/70 shadow-sm space-y-4">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <h4 className="text-sm font-extrabold text-stone-850 dark:text-slate-200 uppercase font-mono tracking-wider">
                                Chỉ số hỗn loạn dòng thời gian: <span className="text-rose-500">{chaosIndex}%</span>
                              </h4>
                              <p className="text-[10px] text-stone-500 dark:text-slate-400 mt-1 max-w-xl leading-normal">
                                {chaosIndex <= 20 
                                  ? "🟢 Dòng thời gian hoàn toàn ỔN ĐỊNH. Bản đồ an bình, NPCs hợp tác thân thiện, may mắn dâng cao."
                                  : chaosIndex <= 50
                                    ? "🟡 Dòng thời gian GỢN SÓNG hỗn loạn nhẹ. NPCs có phản ứng khác thường dạo gần đây, bắt đầu xuất hiện những nghi hoặc."
                                    : chaosIndex <= 80
                                      ? "🟠 Tuyến kịch phân rẽ NGUY HIỂM. Sức nóng cạm bẫy dâng cao, lòng tin sụp đổ đột ngột, có thể gặp xung kích rình rập."
                                      : "🔴 NGHỊCH LÝ CỰC HẠN. Điểm gãy dòng thời gian! Biến cố ác hiểm thảm liệt xuất hiện bất định và dồn dập, NPCs mất kiểm soát!"}
                              </p>
                            </div>
                            
                            <button
                              onClick={() => {
                                if (window.confirm("Bạn muốn thiết lập lại toàn bộ và khép lại các vết rạn nứt không-thời gian chứ?")) {
                                  const worldId = activeWorld.id || "default";
                                  dbService.removeKeyValue(`ark-butterfly-effects-${worldId}`);
                                  setButterflyEffects([]);
                                  setChaosIndex(0);
                                  toast.success("Thời không đã phục hồi trạng thái sơ khai vững vàng!");
                                }
                              }}
                              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white rounded-xl text-[9px] font-black uppercase transition-all tracking-wider text-rose-500 cursor-pointer border-none"
                            >
                              Khôi phục thời không (Reset)
                            </button>
                          </div>

                          {/* Progress bar gauge */}
                          <div className="w-full h-3 bg-stone-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner flex">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${chaosIndex}%` }}
                              className={`h-full rounded-full ${
                                chaosIndex <= 20 
                                  ? "bg-emerald-500" 
                                  : chaosIndex <= 50 
                                    ? "bg-amber-500" 
                                    : chaosIndex <= 80 
                                      ? "bg-orange-500" 
                                      : "bg-gradient-to-r from-red-655 to-fuchsia-600 animate-pulse"
                              }`}
                            />
                          </div>
                        </div>

                        {/* List of Butterfly Ripples */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-stone-850 dark:text-slate-350 uppercase tracking-widest font-mono">
                            Nhật ký di chấn nhân quả ({butterflyEffects.length})
                          </h4>

                          {butterflyEffects.length === 0 ? (
                            <div className="text-center py-16 text-stone-500 dark:text-slate-500 bg-stone-300/10 dark:bg-slate-950/10 rounded-3xl border border-stone-350 dark:border-slate-800/50 border-dashed select-none">
                              <Activity className="mx-auto mb-2 opacity-50 text-emerald-500 animate-pulse" size={28} />
                              <p className="text-xs font-bold font-sans">Thời không ổn định tuyệt đối.</p>
                              <p className="text-[10px] text-stone-400 mt-1 max-w-sm mx-auto leading-relaxed">Hành động và lịch trình của bạn luôn ăn khớp trơn tru, chưa để xảy ra bất kỳ sự lỡ hẹn hay chênh lệch thời gian nào.</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {butterflyEffects.map((rip, idx) => (
                                <div 
                                  key={rip.id || idx}
                                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-320 dark:border-slate-800/70 hover:shadow-md hover:border-rose-450 dark:hover:border-rose-900 transition-all duration-300 relative overflow-hidden flex flex-col gap-3 border-l-4 border-l-rose-500"
                                >
                                  <div className="flex justify-between items-center border-b border-dashed border-stone-300 dark:border-slate-800/60 pb-2 flex-wrap gap-2">
                                    <span className="text-[9.5px] font-mono font-bold tracking-widest text-rose-500 uppercase flex items-center gap-1 leading-none">
                                      Butterfly Effect Link #{idx+1}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-stone-550 dark:text-slate-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                                      Chấn động: +{rip.chaosAdded || 10}% Chaos
                                    </span>
                                  </div>

                                  <div className="space-y-1.5">
                                    <h5 className="text-sm font-black text-stone-900 dark:text-rose-400 flex items-center gap-1.5">
                                      🦋 {rip.title}
                                    </h5>
                                    <p className="text-xs text-stone-550 dark:text-slate-505 font-mono italic">
                                      Nguyên nhân: Không thực hiện sự kiện "{rip.eventTitle}" tại {rip.eventLocation} ({rip.eventTime}).
                                    </p>
                                    <p className="text-xs text-stone-700 dark:text-slate-300 font-sans leading-relaxed text-justify">
                                      {rip.consequence}
                                    </p>
                                  </div>

                                  <div className="pt-2 px-3 py-2 bg-rose-500/5 dark:bg-rose-500/10 rounded-xl text-[11px] leading-relaxed text-rose-600 dark:text-rose-300 font-medium border border-rose-500/10">
                                    <strong>Thời không di chấn (Global Ripple):</strong> {rip.rippleEffect}
                                  </div>

                                  <div className="flex justify-end gap-2 pt-1.5 border-t border-stone-300/30 dark:border-slate-800/30 select-none">
                                    <button
                                      onClick={() => {
                                        const promptToInject = `[Can thiệp Thời Không - Vá lỗ nứt]: Dòng lịch trình bỏ nhỡ "${rip.eventTitle}" dẫn tới hệ quả "${rip.title}" (Biến động: "${rip.rippleEffect}"). Tôi muốn phản ứng lại tình huống này bằng cách:...`;
                                        if (handleSend) {
                                          handleSend(promptToInject);
                                          onClose();
                                        } else if (tavoRegistry && tavoRegistry.setInputValue) {
                                          tavoRegistry.setInputValue(promptToInject);
                                          onClose();
                                        } else {
                                          navigator.clipboard.writeText(promptToInject);
                                          toast.success("Đã sao chép lệnh can thiệp thời gian!");
                                        }
                                      }}
                                      className="inline-flex cursor-pointer items-center justify-center gap-1.5 h-7.5 px-3 text-[10px] font-black uppercase text-white bg-rose-600 hover:bg-rose-700 rounded-lg border-none shadow transition-all animate-pulse"
                                      title="Gửi phản ứng vá lỗi nhân quả vào dòng trò chuyện trò chơi"
                                    >
                                      <Send size={10} /> Vá vết nứt dòng sông (Intervene)
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Atmospheric Dashboard Header Card (Only shows for specific days, not 'Future') */}
                        {activeTab < scheduleData.days.length && (
                          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/5 via-transparent to-stone-350/10 dark:to-slate-900/10 border border-stone-350 dark:border-slate-800/80 bg-white dark:bg-slate-905 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm relative overflow-hidden">
                            
                            {/* Background light glow */}
                            <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

                            {editingAtmosphereDayIdx === activeTab ? (
                              /* Inline Atmosphere Editor */
                              <div className="w-full space-y-3 z-10 p-1">
                                <h4 className="text-xs font-bold text-stone-700 dark:text-slate-300 uppercase">Cấu hình Thiên tượng ngày {activeTab + 1}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-[10px] uppercase font-bold text-stone-500">Thời Tiết</label>
                                    <select 
                                      id={`weather_edit_select_${activeTab}`}
                                      defaultValue={scheduleData.days[activeTab].weather || "☀️ Nắng ấm"}
                                      className="w-full mt-1 p-2 rounded-xl bg-stone-100 dark:bg-slate-850 border border-stone-350 dark:border-slate-700 text-xs text-stone-900 dark:text-slate-100"
                                    >
                                      {WEATHER_PRESETS.map((p, idx) => <option key={idx} value={p.label}>{p.label}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[10px] uppercase font-bold text-stone-500">Cát Hung Khí (Omen)</label>
                                    <select 
                                      id={`omen_edit_select_${activeTab}`}
                                      defaultValue={scheduleData.days[activeTab].omen || "🍀 Cát Tường"}
                                      className="w-full mt-1 p-2 rounded-xl bg-stone-100 dark:bg-slate-850 border border-stone-350 dark:border-slate-700 text-xs text-stone-900 dark:text-slate-100"
                                    >
                                      {OMEN_PRESETS.map((p, idx) => <option key={idx} value={p.label}>{p.label}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div className="flex gap-1.5 justify-end">
                                  <button 
                                    onClick={() => {
                                      const w = (document.getElementById(`weather_edit_select_${activeTab}`) as HTMLSelectElement).value;
                                      const o = (document.getElementById(`omen_edit_select_${activeTab}`) as HTMLSelectElement).value;
                                      handleSaveAtmosphere(activeTab, w, o);
                                    }}
                                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10.5px] uppercase border-none cursor-pointer"
                                  >
                                    Xác nhận
                                  </button>
                                  <button 
                                    onClick={() => setEditingAtmosphereDayIdx(null)}
                                    className="px-3.5 py-1.5 rounded-lg bg-stone-200 dark:bg-slate-800 text-stone-600 dark:text-slate-300 font-bold text-[10.5px] border border-stone-350 dark:border-slate-700 cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Visual display */
                              <>
                                <div className="flex items-center gap-3">
                                  <div className="w-11 h-11 rounded-full bg-indigo-500/10 dark:bg-indigo-400/5 flex items-center justify-center text-xl shrink-0 border border-indigo-400/20">
                                    {getWeatherIcon(scheduleData.days[activeTab].weather || "☀️")}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-extrabold text-stone-850 dark:text-slate-200 font-sans">
                                        Thời tiết: {scheduleData.days[activeTab].weather || "Nắng ấm"}
                                      </span>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-wider bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/10">
                                        {scheduleData.days[activeTab].omen || "🍀 Cát Tường"}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-stone-500 dark:text-slate-500 font-mono mt-1 leading-normal italic">
                                      "Thiên tượng này tác động trực tiếp đến động thái NPC và bối cảnh hành trình..."
                                    </p>
                                  </div>
                                </div>

                                <button
                                  onClick={() => setEditingAtmosphereDayIdx(activeTab)}
                                  className="px-3 py-1.5 rounded-xl border border-stone-350 dark:border-slate-800 hover:border-indigo-500/50 bg-stone-300/30 dark:bg-slate-800/40 text-stone-600 dark:text-slate-300 text-[10px] font-bold uppercase cursor-pointer hover:bg-stone-300/60"
                                >
                                  Sửa thiên tượng
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Character thought box */}
                        {scheduleData.thought && activeTab === 0 && (
                          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-transparent border-l-4 border-indigo-500 bg-stone-300/30 dark:bg-slate-900/50 relative">
                            <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 mb-1 font-mono tracking-widest">
                              <Compass size={12} className="shrink-0" /> Phân tích dòng chảy định mệnh (AI Mind)
                            </div>
                            <p className="text-xs text-stone-700 dark:text-slate-300 leading-relaxed font-sans italic whitespace-pre-line select-text">
                              "{scheduleData.thought}"
                            </p>
                          </div>
                        )}

                        {/* Filter sub bar & quick task creator */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-300/25 dark:bg-slate-905/20 p-3 rounded-2xl border border-stone-320 dark:border-slate-800/40 select-none">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(["all", "main", "hidden", "bond"] as const).map((type) => {
                              const labels: Record<string, string> = {
                                all: "Tất cả",
                                main: "🚀 Minh tuyến",
                                hidden: "👁️ Ám tuyến",
                                bond: "💖 Nhân Duyên"
                              };
                              const selected = filterType === type;
                              return (
                                <button
                                  key={type}
                                  onClick={() => setFilterType(type)}
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer border ${
                                    selected
                                      ? "bg-stone-905 dark:bg-slate-800 text-white border-stone-905 dark:border-slate-800 shadow"
                                      : "bg-white dark:bg-slate-900 text-stone-600 dark:text-slate-400 border-stone-350 dark:border-slate-800 hover:border-stone-400"
                                  }`}
                                >
                                  {labels[type]}
                                </button>
                              );
                            })}
                          </div>

                          <button
                            onClick={() => handleOpenEditForm(activeTab === scheduleData.days.length ? -1 : activeTab, -1)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-extrabold uppercase shadow-sm flex items-center justify-center gap-1 cursor-pointer border-none"
                          >
                            <Plus size={11} /> Thêm sự kiện đột xuất
                          </button>
                        </div>

                        {/* Render matching events */}
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeTab + "_" + filterType}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-4"
                          >
                            {/* Title of Active Tab */}
                            <div className="pb-1 border-b border-stone-350 dark:border-slate-800/60 flex justify-between items-center select-none">
                              <h3 className="text-xs font-black text-stone-900 dark:text-slate-200 uppercase font-mono tracking-wider flex items-center gap-1">
                                <Activity size={12} className="text-indigo-500 animate-pulse" />
                                {activeTab === scheduleData.days.length 
                                  ? "Tầm nhìn Viễn vinh (Future Projections)" 
                                  : `Hành Trình Sự Kiện của ${subjectName} ngày ${activeTab + 1}`}
                              </h3>
                            </div>

                            {/* List Renderer */}
                            {(() => {
                              const currentDayEvents = activeTab === scheduleData.days.length ? scheduleData.future : (scheduleData.days[activeTab]?.events || []);
                              const filteredEvents = currentDayEvents.filter(e => filterType === "all" || e.type === filterType);

                              if (filteredEvents.length === 0) {
                                return (
                                  <div className="text-center py-16 text-stone-500 dark:text-slate-505 select-none bg-stone-300/10 dark:bg-slate-950/10 rounded-3xl border border-stone-350 dark:border-slate-800/50 border-dashed">
                                    <AlertCircle className="mx-auto mb-2 opacity-45" size={28} />
                                    <p className="text-xs font-bold font-sans">Không tìm thấy sự kiện nào thỏa mãn lọc.</p>
                                    <p className="text-[10px] text-stone-400 mt-1">Bấm nút "Thêm sự kiện" ở trên để bổ sung thủ công!</p>
                                  </div>
                                );
                              }

                              return filteredEvents.map((event, filteredIdx) => {
                                // Find real absolute index in standard list to avoid mapping issues during edits/deletes
                                const absoluteIdx = currentDayEvents.indexOf(event);
                                const isBond = event.type === "bond";
                                const isHidden = event.type === "hidden";

                                // Determine status styles
                                const statusStyles = {
                                  todo: { bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", label: "Lên Kế Hoạch ⏳" },
                                  done: { bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", label: "Đã Trải Nghiệm ✅" },
                                  missed: { bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20", label: "Không Thực Hiện ❌" }
                                }[event.status || "todo"];

                                return (
                                  <div
                                    key={absoluteIdx}
                                    className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-320 dark:border-slate-800/70 hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col gap-3 group border-l-4 ${
                                      isBond 
                                        ? "border-l-pink-500 hover:border-pink-500/40" 
                                        : isHidden 
                                          ? "border-l-purple-500 hover:border-purple-500/40" 
                                          : "border-l-sky-500 hover:border-sky-500/40"
                                    }`}
                                  >
                                    {/* Event Title and Type Badges */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-stone-300 dark:border-slate-800/80 pb-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {renderTypeBadge(event.type)}
                                        <button
                                          onClick={() => handleToggleEventStatus(activeTab === scheduleData.days.length ? -1 : activeTab, absoluteIdx)}
                                          className={`inline-flex items-center cursor-pointer px-2.5 py-1 text-[9.5px] font-bold uppercase rounded-lg border transition-all ${statusStyles.bg}`}
                                          title="Bấm để đổi trạng thái"
                                        >
                                          {statusStyles.label}
                                        </button>
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <button 
                                          onClick={() => handleOpenEditForm(activeTab === scheduleData.days.length ? -1 : activeTab, absoluteIdx, event)}
                                          className="p-1 px-2 text-[10px] text-stone-500 hover:text-indigo-600 hover:bg-stone-300/45 dark:hover:bg-slate-800 rounded-lg flex items-center gap-0.5 border-none transition-all cursor-pointer"
                                          title="Chỉnh sửa chi tiết sự kiện"
                                        >
                                          <Edit2 size={11} /> Sửa
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteVisualEvent(activeTab === scheduleData.days.length ? -1 : activeTab, absoluteIdx)}
                                          className="p-1 px-2 text-[10px] text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg flex items-center gap-0.5 border-none transition-all cursor-pointer"
                                          title="Xóa sự kiện"
                                        >
                                          <Trash2 size={11} /> Xóa
                                        </button>
                                      </div>
                                    </div>

                                    {/* Core Title and Contexts */}
                                    <div className="space-y-1.5">
                                      <h4 className="text-base font-black text-stone-900 dark:text-slate-100 tracking-tight leading-snug">
                                        {event.title}
                                      </h4>
                                      <p className="text-xs text-stone-700 dark:text-slate-300 font-sans leading-relaxed text-justify select-text">
                                        {event.description}
                                      </p>
                                    </div>

                                    {/* Time/Location metadata */}
                                    <div className="flex flex-wrap gap-2 text-[10px] text-stone-500 font-bold font-mono">
                                      {event.time && (
                                        <span className="inline-flex items-center gap-1 bg-stone-300/40 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-stone-350/30">
                                          <Clock size={11} className="text-indigo-500" /> {event.time}
                                        </span>
                                      )}
                                      {event.location && (
                                        <span className="inline-flex items-center gap-1 bg-stone-300/40 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-stone-350/30">
                                          <MapPin size={11} className="text-indigo-500" /> {event.location}
                                        </span>
                                      )}
                                    </div>

                                    {/* NPC sync details */}
                                    {event.npcDynamic && event.npcDynamic !== "Không" && (
                                      <div className="pt-2 flex items-start gap-1 rounded-xl bg-stone-300/20 dark:bg-slate-950/20 border border-stone-320 dark:border-slate-800/20 px-3 py-2 text-[11px] leading-relaxed text-stone-600 dark:text-slate-400">
                                        <MessageSquare size={11} className="text-indigo-500 shrink-0 mt-0.5 mr-1" />
                                        <div className="select-text">
                                          <strong className="text-stone-700 dark:text-slate-350">NPC chuyển dịch:</strong> {event.npcDynamic}
                                        </div>
                                      </div>
                                    )}

                                    {/* RPG Fate Roll Area inside card */}
                                    {rollingEventIdx?.dayIdx === (activeTab === scheduleData.days.length ? -1 : activeTab) && rollingEventIdx?.eventIdx === absoluteIdx && (
                                      <div className="p-4 rounded-2xl bg-indigo-500/5 dark:bg-indigo-400/5 border border-indigo-400/30 dark:border-indigo-600/30 space-y-3 shadow-inner">
                                        <div className="flex justify-between items-center bg-indigo-500/10 px-3 py-1 bg-opacity-5 rounded-lg border border-indigo-500/10">
                                          <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1 leading-none font-mono">
                                            <Dices size={12} className="shrink-0" /> Dice Roll Simulator
                                          </span>
                                          <button 
                                            onClick={() => {
                                              setRollingEventIdx(null);
                                              setFateRollOutcome(null);
                                            }}
                                            className="text-[10px] text-stone-500 hover:text-stone-850 cursor-pointer border-none bg-transparent"
                                          >
                                            Đóng quẻ
                                          </button>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                          <div className="flex items-center gap-3">
                                            <div className={`w-14 h-14 rounded-2xl bg-indigo-600 text-white border-2 border-indigo-400 shadow-lg flex items-center justify-center font-black text-2xl font-mono shrink-0 transition-transform ${isRollSpinning ? "animate-spin scale-110" : ""}`}>
                                              {fateD20Roll || "D20"}
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-semibold text-stone-600">Hệ số cộng (Mod):</span>
                                                <input 
                                                  type="number" 
                                                  value={rollModifier}
                                                  onChange={(e) => setRollModifier(parseInt(e.target.value) || 0)}
                                                  className="w-10 p-1 rounded-md bg-stone-100 dark:bg-slate-800 text-xs text-center border font-mono border-stone-300"
                                                />
                                              </div>
                                              <p className="text-[9.5px] text-stone-500 mt-1 leading-normal block">Tăng giảm xác suất dựa tính cách hoặc may mắn.</p>
                                            </div>
                                          </div>

                                          <button
                                            onClick={() => handleTriggerFateRoll(activeTab === scheduleData.days.length ? -1 : activeTab, absoluteIdx)}
                                            disabled={isRollSpinning}
                                            className="px-5 py-2.5 bg-indigo-600 hover:bg-slate-800 text-white font-extrabold text-[10.5px] uppercase rounded-xl shadow cursor-pointer transition-all active:scale-95 border-none"
                                          >
                                            {isRollSpinning ? "Đang Gieo..." : "Bắt Đầu Gieo"}
                                          </button>
                                        </div>

                                        {/* Roll outcome description */}
                                        {fateRollOutcome && (
                                          <div className="p-3 bg-stone-300/30 dark:bg-slate-900 border border-indigo-400/10 rounded-xl space-y-2">
                                            <h5 className="text-[11px] font-extrabold uppercase pr-1 leading-none">
                                              {fateRollOutcome.title} (Tổng: {fateRollOutcome.score})
                                            </h5>
                                            <p className="text-[10.5px] text-stone-600 dark:text-slate-350 italic">"{fateRollOutcome.description}"</p>
                                            <button
                                              onClick={() => {
                                                if (handleSend) {
                                                  handleSend(fateRollOutcome.narrative);
                                                  onClose();
                                                } else if (tavoRegistry && tavoRegistry.setInputValue) {
                                                  tavoRegistry.setInputValue(fateRollOutcome.narrative);
                                                  onClose();
                                                } else {
                                                  navigator.clipboard.writeText(fateRollOutcome.narrative);
                                                  toast.success("Đã copy hành trình định oạt!");
                                                }
                                              }}
                                              className="w-full h-8 flex items-center justify-center gap-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase rounded-lg border-none shadow cursor-pointer transition-all"
                                            >
                                              <Send size={10} /> Đưa Định Đoạt Này Vào Chat
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Action controls line */}
                                    <div className="pt-2 flex flex-wrap gap-2 select-none justify-end border-t border-stone-300/30 dark:border-slate-800/40">
                                      {activeTab < scheduleData.days.length && setGameTime && (
                                        <button 
                                          onClick={() => handleAdvanceTimeToEvent(activeTab, event)}
                                          className="inline-flex cursor-pointer items-center justify-center gap-1.5 h-8 px-3.5 text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500 hover:text-white rounded-lg border border-amber-500/20 transition-all"
                                          title="Dịch chuyển thời gian thực trong game đến sự kiện này và dẫn truyện"
                                        >
                                          <Zap size={11} /> Nhảy Thời gian (Time Warp)
                                        </button>
                                      )}

                                      <button 
                                        onClick={() => handleTriggerFateRoll(activeTab === scheduleData.days.length ? -1 : activeTab, absoluteIdx)}
                                        className="inline-flex cursor-pointer items-center justify-center gap-1.5 h-8 px-3.5 text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white rounded-lg border border-indigo-500/20 transition-all"
                                        title="Tung xúc xắc để phán tài thất bại / thành công kịch tích"
                                      >
                                        <Dices size={11} /> Thử Thách Định Mệnh
                                      </button>

                                      <button 
                                        onClick={() => handleInjectToChat(event)}
                                        className="inline-flex cursor-pointer items-center justify-center gap-1.5 h-8 px-3.5 text-[10px] font-black uppercase text-stone-700 dark:text-slate-300 bg-stone-300/65 hover:bg-stone-300 dark:bg-slate-800 hover:text-indigo-500 dark:hover:bg-slate-755 rounded-lg border border-stone-400/45 dark:border-slate-705 transition-all"
                                      >
                                        <Send size={11} /> Nối cốt truyện
                                      </button>
                                      
                                      <button 
                                        onClick={() => handlePromptAiAboutEvent(event)}
                                        className="inline-flex cursor-pointer items-center justify-center gap-1.5 h-8 px-3.5 text-[10px] font-black uppercase text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg border-none transition-all shadow-sm"
                                      >
                                        <Play size={10} /> Đưa cho AI tiếp quản
                                      </button>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </motion.div>
                        </AnimatePresence>
                      </>
                    )}
                  </div>
                </>
              ) : (
                /* EMPTY PLACEHOLDER SCREEN */
                <div id="agenda_empty_state_screen" className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center select-none bg-stone-200/40 dark:bg-mystic-950/20">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 text-indigo-500 flex items-center justify-center text-2xl mb-4 shadow-inner">
                    🗓️
                  </div>
                  <h3 className="text-base font-extrabold text-stone-850 dark:text-slate-200 font-sans uppercase">
                    Chưa kiến lập Kế hoạch
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-slate-400 max-w-sm mt-2 mb-6 leading-relaxed">
                    Sổ kế hoạch 3 ngày của <strong>{subjectName}</strong> đang trống. Nhấn nút dưới đây để AI phân tích bối cảnh chat hiện thời làm mốc định mệnh ban đầu.
                  </p>
                  
                  <button
                    onClick={handleGenerateSchedule}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase rounded-2xl text-xs shadow-md border-none cursor-pointer transition-all active:scale-95 duration-150 shrink-0"
                  >
                    <Plus size={14} /> Dựng Lịch trình mới (AI)
                  </button>
                </div>
              )}
            </>
          )}

        </div>

        {/* DIALOG POPUP EDITOR (Adding/Editing Event Items Form) */}
        <AnimatePresence>
          {editingEvent && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" id="event_form_editor_dialog">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-stone-200 dark:bg-mystic-900 border border-stone-400 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="p-4 bg-stone-300 dark:bg-slate-900/50 border-b border-stone-400 dark:border-slate-800 flex justify-between items-center shrink-0">
                  <h3 className="font-bold text-stone-900 dark:text-slate-100 flex items-center gap-1.5 text-sm md:text-base">
                    <CalendarRange size={16} />
                    {editingEvent.isNew ? "Thêm Sự Kiện Đột Xuất" : "Hiệu Chỉnh Sự Kiện Lịch"}
                  </h3>
                  <button 
                    onClick={() => setEditingEvent(null)}
                    className="p-1 px-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-white border-none cursor-pointer hover:bg-stone-400 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 max-h-[70vh]">
                  {/* Select Event Type */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-stone-500">Loại Tuyến Cốt Truyện</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["main", "hidden", "bond"] as const).map((t) => {
                        const labels: Record<string, string> = { main: "🚀 Minh tuyến", hidden: "👁️ Ám tuyến", bond: "💖 Nhân duyên" };
                        const isSelected = editingEvent.type === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setEditingEvent({ ...editingEvent, type: t })}
                            className={`p-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex justify-center items-center ${
                              isSelected
                                ? "bg-indigo-600 text-white border-indigo-600 shadow"
                                : "bg-white dark:bg-slate-805 text-stone-600 dark:text-slate-400 border-stone-350 dark:border-slate-705 hover:bg-stone-300/30"
                            }`}
                          >
                            {labels[t]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Event Title */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-stone-500" htmlFor="edit_event_title_input">Tiêu Đề Sự Kiện</label>
                    <input 
                      type="text"
                      id="edit_event_title_input"
                      value={editingEvent.title}
                      onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                      placeholder="vd: Hẹn gặp mật hội, Buổi dạ tiệc..."
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-805 border border-stone-350 dark:border-slate-705 text-xs text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-stone-500" htmlFor="edit_event_desc_textarea">Mô Tả Diễn Biến Sự Kiện</label>
                    <textarea 
                      id="edit_event_desc_textarea"
                      value={editingEvent.description}
                      onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                      rows={3}
                      placeholder="Miêu tả ngắn gọn hoạt động, cảm xúc nhân vật và mong muốn hoàn tất hành trình..."
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-805 border border-stone-350 dark:border-slate-705 text-xs text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                    />
                  </div>

                  {/* Time & Location Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-stone-500" htmlFor="edit_event_time_input">Khung giờ xảy ra</label>
                      <input 
                        type="text"
                        id="edit_event_time_input"
                        value={editingEvent.time}
                        onChange={(e) => setEditingEvent({ ...editingEvent, time: e.target.value })}
                        placeholder="vd: 09:30, Trưa, Đêm muộn..."
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-805 border border-stone-350 dark:border-slate-705 text-xs text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-stone-500" htmlFor="edit_event_location_input">Địa điểm bối cảnh</label>
                      <input 
                        type="text"
                        id="edit_event_location_input"
                        value={editingEvent.location}
                        onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                        placeholder="vd: Phòng khách, Quán Café, Rừng cấm..."
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-805 border border-stone-350 dark:border-slate-705 text-xs text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* NPC Dynamic */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-stone-500" htmlFor="edit_event_npc_input">Hành vi các NPC khác song song</label>
                    <input 
                      type="text"
                      id="edit_event_npc_input"
                      value={editingEvent.npcDynamic}
                      onChange={(e) => setEditingEvent({ ...editingEvent, npcDynamic: e.target.value })}
                      placeholder="Không (hoặc điền hành động của các nhân vật khác)"
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-805 border border-stone-350 dark:border-slate-705 text-xs text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Status Selection */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-stone-500">Trạng Thái Thực Hiện</label>
                    <select
                      value={editingEvent.status}
                      onChange={(e) => setEditingEvent({ ...editingEvent, status: e.target.value as any })}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-805 border border-stone-350 dark:border-slate-705 text-xs text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                    >
                      <option value="todo">Lên kế hoạch (Planned)</option>
                      <option value="done">Thành công / Hoàn tất (Completed)</option>
                      <option value="missed">Bổ lỡ / Thất bại (Missed)</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-stone-300 dark:bg-slate-900/40 border-t border-stone-400 dark:border-slate-800 flex justify-end gap-2 shrink-0">
                  <button 
                    onClick={handleSaveEventForm}
                    className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold border-none cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <Save size={13} fill="currentColor" /> Lưu sự kiện
                  </button>
                  <button 
                    onClick={() => setEditingEvent(null)}
                    className="h-9 px-4 rounded-xl bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300 font-bold text-xs border border-stone-300 dark:border-slate-700 hover:bg-stone-300/20 cursor-pointer"
                  >
                    Hủy sửa
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
};
