import { GameTime } from "../../utils/timeUtils";
import { getAiClient } from "../ai/client";
import { dbService } from "../db/indexedDB";

export interface ButterflyEffect {
  id: string;
  worldId: string;
  perspective: "user" | "char";
  timestamp: number;
  gameTime: GameTime;
  eventTitle: string;
  eventTime: string;
  eventLocation: string;
  chaosAdded: number;
  title: string;
  consequence: string;
  rippleEffect: string;
}

export interface EventItem {
  type: "main" | "hidden" | "bond";
  title: string;
  description: string;
  time: string;
  location: string;
  npcDynamic: string;
  status?: "todo" | "done" | "missed";
}

export interface parsedDays {
  dayNum: string;
  events: EventItem[];
  weather?: string;
  omen?: string;
}

export interface ScheduleData {
  days: parsedDays[];
  future: EventItem[];
  startDate: string | null;
  thought: string | null;
  raw: string;
  lastProcessedDayNum?: number;
}

// 20 rich pre-fabricated templates of consequences for instant fallback when offline or during quick ticks
const fallbackButterflyConsequences = [
  {
    title: "🔒 Tin tức phong tỏa",
    consequence: "Do bỏ lỡ mốc điều nghiên đã định, hành tung mật vụ liên quan đột ngột thắt chặt. Cơ quan chức năng địa phương lập tức ban hành lệnh cấm tuần tra dân sự.",
    rippleEffect: "Độ nghi kỵ tại phủ thành tăng cao thêm 15%, cản trở nghiêm trọng các hoạt động tra vấn về sau.",
    chaos: 8
  },
  {
    title: "🍂 Nhân duyên rạn nứt",
    consequence: "Đối phương chờ đợi mòn mỏi dưới sương đêm lạnh giá nhưng không thấy ai xuất hiện. Sự thất vọng chất chứa đẩy khoảng cách tình cảm rào rạt rẽ lối.",
    rippleEffect: "Mức độ thân thiết sụt giảm trầm trọng, xuất hiện tâm lý đề phòng sâu sắc.",
    chaos: 12
  },
  {
    title: "🕯️ Chiếc bóng trong đêm",
    consequence: "Gợi ý bí ẩn tại di chỉ hoang phế đã bị kẻ thứ ba phát hiện và thủ tiêu toàn bộ vết tích trước khi bạn đến. Manh mối ám tiên tri nát vụn dưới chân bốt canh.",
    rippleEffect: "Mất đi vĩnh viễn quyền tra cứu mật quyển, phe phản địch nắm giữ thế chủ động săn đuổi mật báo.",
    chaos: 10
  },
  {
    title: "🪙 Giao dịch đổ bể",
    consequence: "Thương nhân hắc thị bị lộ hành tung do không nhận được tiếp viện kịp lúc. Ông ta đã vội vã phiêu dạt mang theo chiếc rương đựng mảnh vỡ thiên thạch báu vật.",
    rippleEffect: "Bạn không thể mua các vật phẩm kỳ bí độc quyền trong vòng 3 ngày kế tiếp.",
    chaos: 15
  },
  {
    title: "⚡ Dập tắt hy vọng",
    consequence: "Lời cầu viện của binh đoàn đồn trú biên cương bị trì hoãn vô định. Pháo đài bốc cháy ngùn ngụt giữa tiếng cười man rợ của dã thú dị vực.",
    rippleEffect: "Bản đồ khu vực phía Tây trở nên nguy hiểm tột độ với tần suất quái thú tuần kích gia tăng vượt bậc.",
    chaos: 18
  },
  {
    title: "🎭 Thân phận bại lộ",
    consequence: "Do không có mặt để dập tắt tin đồn kịp thời, thân phận thật sự của bạn bị một kẻ ám toán phát giác và truyền tai tới quân lính vương triều.",
    rippleEffect: "Mức sát khí và độ nghi kỵ toàn phủ thành tăng nhanh đột biến thêm 15%.",
    chaos: 15
  },
  {
    title: "📜 Mật chỉ bị hủy",
    consequence: "Mật thư chỉ điểm phản đồ tại tháp chuông cổ bị kẻ ẩn danh đốt cháy hoàn toàn. Khói đen nghi ngút mang theo toàn bộ những ghi chép vạn vật biến mất.",
    rippleEffect: "Tử huyệt thông tin bị bịt kín, hành trình tra khảo tiếp theo sẽ tốn nhiều tài nguyên hơn.",
    chaos: 12
  },
  {
    title: "🗡️ Ám sát chệch hướng",
    consequence: "Kẻ phòng vệ mật môn không nhận được tiếp ứng, đành phải liều mạng mở một đường máu rút lui, vô tình đánh động toàn bộ vệ binh khu vực trung thành.",
    rippleEffect: "Độ báo động của lính tuần đêm tăng vọt, mọi lối thoát hiểm bị niêm phong nghiêm ngặt.",
    chaos: 14
  },
  {
    title: "🧪 Dịch bệnh bùng phát",
    consequence: "Thảo dược ngăn ngừa tà độc cứu trợ vùng biên cương bị lữ đoàn vận chuyển chậm trễ. Khói chướng từ đầm lầy lan rộng làm biến chất sinh vật xung quanh.",
    rippleEffect: "Thú dữ dị biến xuất hiện nhiều hơn, bản đồ dã ngoại cực Tây chìm trong tử khí hoang tàn.",
    chaos: 16
  },
  {
    title: "🔮 Linh bảo vỡ vụn",
    consequence: "Tinh thạch năng lượng tại di chỉ cổ không được bảo dưỡng định kỳ đúng hạn giờ. Áp lực linh khí dồn nén quá tải khiến nó nứt toác thành hàng vạn mảnh.",
    rippleEffect: "Mất đi quyền điều hướng cổng dịch chuyển không gian, bắt buộc phải di chuyển đường bộ tốn thời gian hơn.",
    chaos: 13
  },
  {
    title: "⚖️ Phán quyết nghịch thiên",
    consequence: "Sự vắng mặt của bạn trong phiên nghị sự tối cao khiến cán cân công lý nghiêng hẳn về phía đại gian thần. Lệnh truy nã mật thám được ban bố khẩn cấp.",
    rippleEffect: "Bạn sẽ bị nhận diện là trọng phạm triều đình nếu lui tới các khu vực công cộng sầm uất.",
    chaos: 18
  },
  {
    title: "🍻 Bữa tiệc tẩm độc",
    consequence: "Bữa tiệc liên hoan hòa giải giữa các bộ tộc bị phá hoại do thiếu người điều đình. Kẻ phản nghịch âm thầm hạ độc khơi dậy mối thâm thù huyết hải phi thường.",
    rippleEffect: "Hòa bình biên cương sụp đổ, xung đột sắc tộc vũ trang bùng phát dữ dội.",
    chaos: 17
  },
  {
    title: "🐦 Thư tín bị tiễn",
    consequence: "Chim đưa tin mật báo bị một chú ưng săn của kẻ địch bắn rơi giữa chừng khi bay qua thung lũng sương mù vì không có người yểm trợ.",
    rippleEffect: "Kẻ địch nắm giữ toàn bộ lộ trình phản công thế trận, chủ động bày bố trận pháp mai phục.",
    chaos: 10
  },
  {
    title: "⚓ Bến cảng phong tỏa",
    consequence: "Thuyền buôn chở trang bị huyền thoại bị hải tặc tấn công do lỡ mất chuyến hộ tống. Toàn bộ bến cảng bị quân đội tiền phương phong tỏa để rà soát.",
    rippleEffect: "Không thể mua bán hay sửa chữa trang bị hạng nặng trong vòng 48 giờ tại vùng duyên hải.",
    chaos: 14
  },
  {
    title: "🏚️ Thành trì thất thủ",
    consequence: "Cửa ngõ quân sự phía Bắc sụp đổ dưới hỏa lực địch nhân khi đội quân tiếp tế bị chặn đường mà không có bất kỳ viện quân nào đến giải cứu hành lang.",
    rippleEffect: "Bản đồ phía Bắc chìm trong khói lửa chiến tranh, dân tị nạn tràn ngập đường phố.",
    chaos: 20
  },
  {
    title: "🌳 Rừng thiêng dậy sóng",
    consequence: "Nghi thức trấn giữ quỷ dữ tại mật lâm cổ xưa bị gián đoạn do tế ty không nhận được thánh vật kịp thời. Thú dữ gầm rú dẫm đạp phá nát kết giới.",
    rippleEffect: "Kết giới rừng thiêng sụp đổ, yêu quái sương mù tràn ra phá phách thôn xóm lân cận.",
    chaos: 15
  },
  {
    title: "📿 Lời nguyền trỗi dậy",
    consequence: "Vết phong ấn oán hồn trên chiếc rương cổ giam cầm oán linh ngàn năm bỗng nhiên lung lay dữ dội rồi nứt vỡ do không có pháp sư đến gia trì vạn pháp.",
    rippleEffect: "Sương mù hắc ám bao phủ toàn bộ phủ ngoại ô, tinh thần nhân vật sa sút liên tục.",
    chaos: 16
  },
  {
    title: "♟️ Quân cờ đi lệch",
    consequence: "Sự hướng dẫn chiến thuật bị bỏ qua khiến tướng tiên phong tự ý hành động liều lĩnh, rơi vào trận pháp phục binh huyền ảo của địch tại hạp cốc.",
    rippleEffect: "Hao hụt nghiêm trọng lực lượng nòng cốt, phe ta bị đẩy vào tình thế phòng thủ bị động.",
    chaos: 14
  },
  {
    title: "🌾 Kho lương kiệt quệ",
    consequence: "Lịch trình tuần tra bảo vệ kho thóc dự trữ bị xao nhãng, tạo cơ hội cho tặc nhân phóng hỏa thiêu rụi toàn bộ lương thực nông dân chuẩn bị cho mùa đông.",
    rippleEffect: "Giá cả thực phẩm tăng vọt 50%, nhân dân hoang mang lo sợ, nội bộ bất ổn.",
    chaos: 15
  },
  {
    title: "🏚️ Đền cổ sụp đổ",
    consequence: "Bão cát hoành hành chôn vùi lối vào chính điện của đền thờ linh thiêng cổ xưa khi bạn chậm trễ phân tích, khiến di tích bị niêm phong vĩnh viễn.",
    rippleEffect: "Linh khí bối cảnh suy giảm nghẹt thở, mất đi cơ hội nhận chúc phúc thần linh tại khu vực.",
    chaos: 13
  }
];

// Helper to check if t1 is after or equal to t2
export const isTimeAfterOrEqual = (t1: GameTime, t2: GameTime): boolean => {
  if (t1.year !== t2.year) return t1.year > t2.year;
  if (t1.month !== t2.month) return t1.month > t2.month;
  if (t1.day !== t2.day) return t1.day > t2.day;
  if (t1.hour !== t2.hour) return t1.hour > t2.hour;
  return t1.minute >= t2.minute;
};

// Compute current day number based on start date and current game time
export const getCurrentDayNum = (startDateStr: string | null, currentGameTime: GameTime): number => {
  if (startDateStr) {
    try {
      const parts = startDateStr.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        
        const baseDate = new Date(year, month - 1, day);
        const currentDate = new Date(currentGameTime.year, currentGameTime.month - 1, currentGameTime.day);
        const diffTime = currentDate.getTime() - baseDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays + 1);
      }
    } catch (e) {
      console.error("Lỗi tính toán dayNum:", e);
    }
  }
  return 1;
};

// Formulate event time
export const getEventGameTime = (startDateStr: string | null, dayNumStr: string, eventTimeStr: string, fallbackTime: GameTime): GameTime => {
  const dayNum = parseInt(dayNumStr, 10) || 1;
  const match = eventTimeStr.match(/(\d{1,2}):(\d{2})/);
  let hour = 9;
  let minute = 0;
  
  if (match) {
    hour = parseInt(match[1], 10);
    minute = parseInt(match[2], 10);
  } else {
    const clean = eventTimeStr.toLowerCase();
    if (clean.includes("sáng")) { hour = 8; minute = 0; }
    else if (clean.includes("trưa")) { hour = 12; minute = 0; }
    else if (clean.includes("chiều")) { hour = 15; minute = 0; }
    else if (clean.includes("tối")) { hour = 19; minute = 0; }
    else if (clean.includes("đêm") || clean.includes("muộn")) { hour = 22; minute = 0; }
  }

  if (startDateStr) {
    try {
      const parts = startDateStr.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        
        const baseDate = new Date(year, month - 1, day);
        if (!isNaN(baseDate.getTime())) {
          baseDate.setDate(baseDate.getDate() + (dayNum - 1));
          return {
            year: baseDate.getFullYear(),
            month: baseDate.getMonth() + 1,
            day: baseDate.getDate(),
            hour,
            minute
          };
        }
      }
    } catch (e) {
      console.error("Lỗi biên dịch StartDate sự kiện:", e);
    }
  }

  return {
    year: fallbackTime.year,
    month: fallbackTime.month,
    day: fallbackTime.day + (dayNum - 1),
    hour,
    minute
  };
};

export const getCacheKey = (worldId: string, perspective: "user" | "char"): string => {
  return `ark-schedule-v5-${worldId}-${perspective}`;
};

export const getButterflyEffectsKey = (worldId: string): string => {
  return `ark-butterfly-effects-${worldId}`;
};

export const getButterflyEffects = (worldId: string): ButterflyEffect[] => {
  const cached = dbService.getKeyValueSync(getButterflyEffectsKey(worldId));
  if (!cached) return [];
  if (typeof cached === "string") {
    try {
      return JSON.parse(cached);
    } catch (e) {
      return [];
    }
  }
  return Array.isArray(cached) ? cached : [];
};

export const saveButterflyEffects = (worldId: string, effects: ButterflyEffect[]): void => {
  dbService.setKeyValue(getButterflyEffectsKey(worldId), effects);
};

export const calculateChaosIndex = (worldId: string): number => {
  const effects = getButterflyEffects(worldId);
  const baseChaos = effects.reduce((sum, f) => sum + f.chaosAdded, 0);
  return Math.min(100, Math.max(0, baseChaos));
};

export const clearButterflyEffects = (worldId: string): void => {
  dbService.removeKeyValue(getButterflyEffectsKey(worldId));
};

// Procedural consequence generation with AI-driven core logic
export const generateButterflyEffect = async (
  worldId: string,
  perspective: "user" | "char",
  gameTime: GameTime,
  event: EventItem,
  worldContext: any,
  settings: any
): Promise<ButterflyEffect> => {
  const effects = getButterflyEffects(worldId);
  const totalChaos = calculateChaosIndex(worldId);
  
  // Use unique ID
  const newId = `eff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const chaosAdded = event.type === "main" ? 15 : event.type === "bond" ? 12 : 10;

  try {
    const aiClient = getAiClient(settings || undefined);
    const activeModel = settings?.aiModel || "gemini-3.1-pro-preview";
    
    const worldName = worldContext?.world?.name || "Thế giới nhập vai";
    const worldDesc = worldContext?.world?.description || "Bối cảnh dã sử kì bí";
    const playerName = worldContext?.player?.name || "Người chơi";
    const companionName = worldContext?.entities?.[0]?.name || "Đồng minh";

    const prompt = `Bạn là một nhà thiết kế trò chơi dã sử nhập vai cốt truyện kịch tính nhiều rẽ nhánh. Người chơi (hoặc NPC đồng hành) vừa bỏ lỡ một mốc lịch trình cực kỳ quan trọng dẫn đến việc kích hoạt HIỆU ỨNG CÁNH BƯỚM (Butterfly Effect - Hệ quả mang tính dây chuyền của thuyết hỗn loạn).

Thông tin bối cảnh thế giới:
- Thế giới: ${worldName}
- Mô tả: ${worldDesc}

Sự kiện bị BỎ LỠ (Nhân vật đã không hoàn thành / không xuất hiện đúng giờ):
- Tiêu đề sự kiện: ${event.title}
- Loại sự kiện: ${event.type === "main" ? "Chính Tuyến" : event.type === "bond" ? "Liên Kết Nhân Duyên" : "Ám Tuyến Tiên Tri"}
- Địa điểm: ${event.location}
- Thời gian: ${event.time}
- Mô tả sự kiện gốc: ${event.description}
- Phản ứng NPC liên đới gốc: ${event.npcDynamic}

Hãy mô tả hệ quả xích móc xô đẩy (Butterfly Effect) diễn ra thầm lặng trong bóng tối khiến dòng thời gian bị lệch hướng (Timeline Divergence).
Văn phong trinh thám, dã sử kì vĩ, truyền cảm sâu lắng tiếng Việt.

Yêu cầu định dạng JSON chính xác sau:
{
  "title": "<Tiêu đề ngắn gọn giật gân, ví dụ: 'Chiếc Bóng Trượt Dốc', 'Lời Hứa Sương Đêm Đổ Vỡ'>",
  "consequence": "<Miêu tả chi tiết hệ quả cốt truyện sâu sắc từ 40 đến 70 từ tiếng Việt, chỉ ra phản ứng dây chuyền thầm lặng vì nhân vật không có mặt>",
  "rippleEffect": "<1 câu trạng thái ảnh hưởng thực tế, ví dụ: 'Mức sát khí phủ thành tăng 15%', 'NPC rạn nứt lòng tin sâu đậm'>"
}

Không viết gì thêm ngoài khối JSON trên.`;

    const response = await aiClient.models.generateContent({
      model: activeModel,
      contents: prompt,
      config: {
        temperature: 0.85,
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    if (parsed.title && parsed.consequence) {
      return {
        id: newId,
        worldId,
        perspective,
        timestamp: Date.now(),
        gameTime,
        eventTitle: event.title,
        eventTime: event.time,
        eventLocation: event.location,
        chaosAdded,
        title: parsed.title,
        consequence: parsed.consequence,
        rippleEffect: parsed.rippleEffect || "Hệ quả chưa rõ ràng ghim sâu."
      };
    }
  } catch (e) {
    console.error("AI butterfly generation failed, falling back to local formulas:", e);
  }

  // Fallback procedural selection
  const randNum = Math.floor(Math.random() * fallbackButterflyConsequences.length);
  const picked = fallbackButterflyConsequences[randNum];

  let specTitle = picked.title;
  let specConseq = picked.consequence;
  let specRipple = picked.rippleEffect;

  if (event.type === "bond") {
    specTitle = "🥀 Nhân duyên dang dở";
    specConseq = `Bỏ lỡ hẹn gặp với nhân vật tại ${event.location} khiến mọi hoài bão lãng mạn lơ lửng sụp đổ. Đối phương cảm nhận sâu sắc sự lạnh nhạt bí ẩn.`;
    specRipple = `Sợi chỉ liên kết duyên kiếp mỏng manh rạn nứt sâu sắc, khó có cơ hội hàn gắn trong ngày kế tiếp.`;
  } else if (event.type === "hidden") {
    specTitle = "👁️ Ám tuyến vuột mất";
    specConseq = `Mối nghi ngờ tại ${event.location} không được soi tỏ kịp thời. Kẻ ám sát ẩn nấp trong sương mù đã trốn thoát thành công, mang đi mật quyển quan trọng.`;
    specRipple = `Thế lực thù địch tăng cường phòng vệ, các manh mối mật thám tương lai khó giải mã hơn.`;
  }

  return {
    id: newId,
    worldId,
    perspective,
    timestamp: Date.now(),
    gameTime,
    eventTitle: event.title,
    eventTime: event.time,
    eventLocation: event.location,
    chaosAdded,
    title: specTitle,
    consequence: specConseq,
    rippleEffect: specRipple
  };
};

/**
 * Sweeps all schedules across 'user' and 'char' perspectives.
 * Transitions overdue todo events to missed and spins up the Butterfly ripple effect!
 */
export const processScheduleAutoprogression = async (
  worldId: string,
  currentGameTime: GameTime,
  worldContext: any,
  settings: any,
  onTriggerEffect?: (effect: ButterflyEffect) => void
): Promise<{
  processed: boolean;
  missedEvents: any[];
  newRipples: ButterflyEffect[];
  weatherChanges: Array<{ dayNum: string; weather: string; omen: string }>;
  npcMovements: Array<{ title: string; npcDynamic: string; location: string }>;
}> => {
  const perspectives: Array<"user" | "char"> = ["user", "char"];
  const missedEvents: any[] = [];
  const newRipples: ButterflyEffect[] = [];
  const weatherChanges: Array<{ dayNum: string; weather: string; omen: string }> = [];
  const npcMovements: Array<{ title: string; npcDynamic: string; location: string }> = [];
  let scheduleUpdated = false;

  for (const perspective of perspectives) {
    const key = getCacheKey(worldId, perspective);
    const cached = dbService.getKeyValueSync(key);
    if (!cached) continue;

    try {
      const schedule: ScheduleData = typeof cached === "string" ? JSON.parse(cached) : cached;
      if (!schedule.days || schedule.days.length === 0) continue;

      let fileModified = false;
      const currentDayNum = getCurrentDayNum(schedule.startDate, currentGameTime);

      // Dynamic Weather System Update
      if (schedule.lastProcessedDayNum !== currentDayNum) {
        schedule.lastProcessedDayNum = currentDayNum;
        fileModified = true;

        const activeDay = schedule.days.find((d) => parseInt(d.dayNum, 10) === currentDayNum);
        if (activeDay) {
          const weatherPresets = ["☀️ Nắng ấm", "☁️ Mây phủ u ám", "🌧️ Mưa rào rả rích", "🌫️ Sương mù giăng lối", "🌩️ Bão giông sương gió", "🌌 Đêm sao tĩnh lặng"];
          const omenPresets = ["🍀 Cát Tường", "🔮 Thiên Cơ", "⚠️ Sát Khí", "⚔️ Huyết Nguyệt", "🔥 Khởi Sắc", "✨ Cơ Duyên"];
          
          if (!activeDay.weather) {
            activeDay.weather = weatherPresets[Math.floor(Math.random() * weatherPresets.length)];
          }
          if (!activeDay.omen) {
            activeDay.omen = omenPresets[Math.floor(Math.random() * omenPresets.length)];
          }

          weatherChanges.push({
            dayNum: String(currentDayNum),
            weather: activeDay.weather,
            omen: activeDay.omen
          });
        }
      }

      const progressDays = schedule.days.map((day) => {
        const progressEvents = day.events.map((event) => {
          // Check if event is todo and we are past its time
          if (!event.status || event.status === "todo") {
            const eventTimeCoord = getEventGameTime(schedule.startDate, day.dayNum, event.time, currentGameTime);
            const isOverdue = isTimeAfterOrEqual(currentGameTime, eventTimeCoord);

            if (isOverdue) {
              // Mark as missed!
              event.status = "missed";
              fileModified = true;
              missedEvents.push({
                perspective,
                event,
                dayNum: day.dayNum
              });

              // NPC Dynamic Scheduler Trigger
              if (event.npcDynamic && event.npcDynamic !== "Không") {
                npcMovements.push({
                  title: event.title,
                  npcDynamic: event.npcDynamic,
                  location: event.location
                });
              }
            }
          }
          return event;
        });

        return {
          ...day,
          events: progressEvents
        };
      });

      if (fileModified) {
        // Re-serialize raw text
        const lines: string[] = [];
        if (schedule.thought) {
          lines.push(`<!-- Phân tích và dự phóng cốt truyện: ${schedule.thought} -->`);
        }
        lines.push("<calendar_widget>");
        if (schedule.startDate) {
          lines.push(`StartDate: ${schedule.startDate}`);
        }
        progressDays.forEach((day) => {
          let dayLine = `Day: ${day.dayNum}`;
          if (day.weather) dayLine += ` | Weather: ${day.weather}`;
          if (day.omen) dayLine += ` | Omen: ${day.omen}`;
          lines.push(dayLine);
          
          day.events.forEach((ev) => {
            lines.push(`Event: ${ev.type}|${ev.title}|${ev.description}|${ev.time}|${ev.location}|${ev.npcDynamic || "Không"}|${ev.status}`);
          });
        });

        if (schedule.future && schedule.future.length > 0) {
          lines.push("Future:");
          schedule.future.forEach((ev) => {
            lines.push(`Event: ${ev.type}|${ev.title}|${ev.description}|${ev.time}|${ev.location}|${ev.npcDynamic || "Không"}|${ev.status || "todo"}`);
          });
        }
        lines.push("</calendar_widget>");

        // Save back
        const updatedSchedule: ScheduleData = {
          ...schedule,
          days: progressDays,
          raw: lines.join("\n"),
          lastProcessedDayNum: schedule.lastProcessedDayNum
        };
        
        dbService.setKeyValue(key, updatedSchedule);
        scheduleUpdated = true;
      }
    } catch (e) {
      console.error(`Progression scan failed for ${perspective}:`, e);
    }
  }

  // Handle missed consequences
  if (missedEvents.length > 0) {
    const activeRipples = getButterflyEffects(worldId);
    
    for (const item of missedEvents) {
      // Generate a brand new Butterfly Effect consequence!
      const effect = await generateButterflyEffect(
        worldId,
        item.perspective,
        currentGameTime,
        item.event,
        worldContext,
        settings
      );
      
      activeRipples.push(effect);
      newRipples.push(effect);

      if (onTriggerEffect) {
        onTriggerEffect(effect);
      }
    }

    saveButterflyEffects(worldId, activeRipples);
  }

  return {
    processed: scheduleUpdated,
    missedEvents,
    newRipples,
    weatherChanges,
    npcMovements
  };
};
