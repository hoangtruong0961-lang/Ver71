import { getAiClient } from "../client";
import { AppSettings } from "../../../types";
import { Type } from "@google/genai";

export interface DeepLogicAuditResult {
  complianceScore: number; // 0 to 100
  violations: string[]; // List of logic defects or cheats
  status: "APPROVED" | "VIOLATION_DETECTED" | "CRITICAL_VIOLATION";
  correctedText?: string; // Auto-corrected text if mode is strict and violation detected
}

/**
 * DEEP-LOGIC Filter System
 * Extremely strict rule and logic verification for fanfiction elements and RPG rules.
 * Automatically checks, audits, and optionally reconstructs AI responses to prevent
 * power creep, infinite resources magic cheats, or logic inconsistencies.
 */
export async function auditStoryLogicalTurn(
  userInput: string,
  narrativeText: string,
  worldRules: string[],
  lsrStateString: string,
  settings: AppSettings,
  isAutoCorrect: boolean = true
): Promise<DeepLogicAuditResult> {
  const aiClient = getAiClient(settings);
  if (!aiClient) {
    return {
      complianceScore: 100,
      violations: [],
      status: "APPROVED"
    };
  }

  // Filter out comments and disabled rules
  const activeRules = worldRules.filter(
    (r) => r && !r.startsWith("[VÔ HIỆU HÓA]") && !r.startsWith("//")
  );

  if (activeRules.length === 0) {
    return {
      complianceScore: 100,
      violations: [],
      status: "APPROVED"
    };
  }

  const isAdvisory = settings.deepLogicMode === "advisory" || !isAutoCorrect;

  const rulesListFormatted = activeRules
    .map((r, i) => `${i + 1}. ${r}`)
    .join("\n");

  const prompt = `Bạn là một Quan tòa tối cao chuyên kiểm duyệt Logic đồng nhân (World Lore Logic Judge).
Nhiệm vụ của bạn là đọc và phân tích kỹ lưỡng đoạn truyện mới do AI viết so với:
1. Hành động của người chơi.
2. Trạng thái cơ sở dữ liệu thế giới (LSR World State).
3. Các quy luật / Luật AI Tự Nhiên cực kỳ nghiêm khắc của thế giới này.

HÃY PHÁT HIỆN CÁC LỖI LOGIC SAU (VIOLATIONS):
- "Cheat ma thuật" hoặc hồi phục sức mạnh vô lý (ví dụ: cạn linh khí/mana/sức chịu đựng nhưng vẫn đánh chiêu thức mạnh).
- Vượt cấp, bất tuân các quy định tu vi cảnh giới được nêu trong Luật hay Lore.
- Sử dụng các kỹ năng, vật phẩm không có trong túi đồ hoặc chưa được học.
- Đổi trắng thay đen, sửa đổi bối cảnh nguyên tác một cách phi lý để "buff bẩn" cho nhân vật.
- Tự tiện bỏ qua cái giá/chi phí hoặc phản phệ (backlash) của công pháp cấm thuật.

ĐẦU VÀO PHÂN TÍCH:
----
HỒ SƠ LUẬT THẾ GIỚI (VƯỢT LÊN TRÊN TẤT CẢ):
${rulesListFormatted}

TRẠNG THÁI THẾ GIỚI (LSR STATE):
${lsrStateString || "(Không có thông tin)"}

HÀNH ĐỘNG CỦA NGƯỜI CHƠI:
"${userInput}"

TRUYỆN DO AI VIẾT (CẦN KIỂM DUYỆT):
"${narrativeText}"
----

YÊU CẦU ĐẦU RA JSON CHÍNH XÁC:
1. "complianceScore": Điểm số tuân thủ từ 0 đến 100.
   - 90-100: Rất tốt, hợp lý chặt chẽ.
   - 75-89: Vi phạm nhỏ hoặc bỏ qua một vài chế tài.
   - <75: Vi phạm logic/Cheat nghiêm trọng (ví dụ cạn mana vẫn khạc lửa khổng lồ mà không chịu phản phệ, hay tu vi Đấu Giả dùng Đấu Kỹ của Đấu Hoàng).
2. "violations": Mảng các chuỗi liệt kê chi tiết các vi phạm hoặc lỗi cheat logic rõ rệt phát hiện được (bằng tiếng Việt). Nếu không có, ghi ["Không có vi phạm."].
3. "status": "APPROVED" (nếu Điểm >= 85) hoặc "VIOLATION_DETECTED" (nếu Điểm < 85).
${isAdvisory ? '4. KHÔNG ĐƯỢC sinh "correctedText" (tiết kiệm hạn ngạch quota).' : `4. "correctedText": ĐOẠN VĂN BẢN TRUYỆN ĐÃ ĐƯỢC TỰ ĐỘNG ĐIỀU CHỈNH LOGIC (CHỈ CUNG CẤP KHI status = "VIOLATION_DETECTED").
   - Hãy viết lại đoạn văn này sao cho: Vẫn giữ nguyên diễn biến chính của hành động, NHƯNG áp đặt chế tài hình phạt logic kịch tính của các Luật phản phệ vào truyện!
   - Ví dụ: Thay vì nhân vật thi triển thành công phép thuật vĩ đại khi cạn kiệt mana, hãy tả nhân vật gồng mình trong đau đớn, linh lực bị đứt gãy {PHỐC!}, kinh mạch thổ huyết, kỹ năng thất bại, hoặc bị phản phệ nổ tung cực kỳ hoành tráng, khiến truyện có chiều sâu kịch tính và thử thách thực tế thay vì "AI trơn tru hời hợt".
   - CHÚ Ý: Toàn bộ nội dung truyện phải được nằm trong cặp thẻ sinh hồn <content>...</content> giống như cấu trúc nguyên bản của truyện. Không được bỏ thẻ này!`}

Vui lòng trả về kết quả dưới định dạng JSON khớp 100% với Schema yêu cầu. Không thêm bất kỳ văn bản giải thích nào khác ngoài JSON.`;

  try {
    const response = await aiClient.models.generateContent({
      model: settings.backgroundAiModel || "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: isAdvisory ? {
            complianceScore: {
              type: Type.INTEGER,
              description: "Điểm số tuân thủ logic từ 0 đến 100"
            },
            violations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Chi tiết các lỗi logic, cheat hoặc vi phạm phát hiện"
            },
            status: {
              type: Type.STRING,
              description: "Trạng thái phê duyệt logic: APPROVED hoặc VIOLATION_DETECTED"
            }
          } : {
            complianceScore: {
              type: Type.INTEGER,
              description: "Điểm số tuân thủ logic từ 0 đến 100"
            },
            violations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Chi tiết các lỗi logic, cheat hoặc vi phạm phát hiện"
            },
            status: {
              type: Type.STRING,
              description: "Trạng thái phê duyệt logic: APPROVED hoặc VIOLATION_DETECTED"
            },
            correctedText: {
              type: Type.STRING,
              description: "Văn bản đã tự điều chỉnh logic trừng trị kịch tính, bắt buộc bọc trong <content>...</content> nếu phát hiện vi phạm"
            }
          },
          required: ["complianceScore", "violations", "status"]
        }
      }
    });

    const respText = response.text || "{}";
    const result = JSON.parse(respText) as DeepLogicAuditResult;

    console.log("[DEEP-LOGIC Audit Result]:", {
      score: result.complianceScore,
      violations: result.violations,
      status: result.status,
      hasCorrection: !!result.correctedText
    });

    return result;
  } catch (error) {
    console.error("[DEEP-LOGIC Audit system failed]:", error);
    return {
      complianceScore: 100,
      violations: ["Lỗi mạng kiểm duyệt logic. Tự động APPROVED."],
      status: "APPROVED"
    };
  }
}
