
import { Type } from "@google/genai";
import { getAiClient } from "../client";
import { AppSettings } from "../../../types";
import { extractJson } from '../../../utils/regex';

export interface FanficCharacter {
  name: string;
  gender: string;
  age: string;
  personality: string;
  background: string;
  appearance: string;
  skills: string;
  goal: string;
  role: string;
}

export interface FanficAnalysis {
  summary: string;
  characters: FanficCharacter[];
}

export const fanficAiService = {
  async analyzeFanfic(content: string, title?: string, settings?: AppSettings): Promise<FanficAnalysis> {
    const hasContent = content.trim().length > 0;
    const prompt = hasContent ? `
      You are a literary analysis expert. 
      Your task is to analyze the content of the original work provided below.
      
      EXTREMELY IMPORTANT REQUIREMENTS:
      1. ACCURATE EXTRACTION: Only take information present in the text. Absolutely do not fabricate or create any additional details not in the original work.
      2. MAIN CONTENT: Summarize the plot and main content of the work concisely but fully.
      3. CHARACTERS: List at least 10 key characters appearing in the work. For each character, provide the following information:
         - Character name.
         - Gender.
         - Age (if not available, estimate based on context).
         - Personality.
         - Biography/Background.
         - Appearance.
         - Skills/Strengths.
         - Goals/Motivations.
         - Role in the story (e.g., protagonist, antagonist, best friend...).
      4. LANGUAGE: Return in Vietnamese.
      5. FORMAT: Return in correct JSON format.

      ORIGINAL WORK CONTENT:
      """
      ${content}
      """
    ` : `
      You are an expert in literature and popular culture.
      Based on the ORIGINAL WORK TITLE/IP: "${title}", use the Google Search tool to search the internet for wikis, databases, or summaries about this work to accurately extract information.
      
      REQUIREMENTS:
      1. ACCURATE INFORMATION: Provide accurate information about this famous work based on your internet search.
      2. MAIN CONTENT: Summarize the plot and setting of the work.
      3. CHARACTERS: List at least 10 most important characters of this work. For each character, provide the following information:
         - Character name.
         - Gender.
         - Age.
         - Personality.
         - Biography/Background.
         - Appearance.
         - Skills/Strengths.
         - Goals/Motivations.
         - Role in the story.
      4. LANGUAGE: Return in Vietnamese.
      5. FORMAT: Return in correct JSON format.
    `;

    const aiClient = getAiClient(settings);
    const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "Tóm tắt nội dung chính của tác phẩm" },
          characters: {
            type: Type.ARRAY,
            description: "Danh sách ít nhất 10 nhân vật chủ chốt",
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                gender: { type: Type.STRING },
                age: { type: Type.STRING },
                personality: { type: Type.STRING },
                background: { type: Type.STRING },
                appearance: { type: Type.STRING },
                skills: { type: Type.STRING },
                goal: { type: Type.STRING },
                role: { type: Type.STRING }
              },
              required: ["name", "gender", "age", "personality", "background", "appearance", "skills", "goal", "role"]
            },
            minItems: 10
          }
        },
        required: ["summary", "characters"]
      },
      temperature: 0.1
    };

    if (!hasContent) {
      config.tools = [{ googleSearch: {} }];
    }

    const modelToUse = settings?.aiModel || (hasContent ? 'gemini-3.1-pro-preview' : 'gemini-2.5-pro');

    const response = await aiClient.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: config
    });

    if (response.text) {
      try {
        const parsed = extractJson<FanficAnalysis>(response.text);
        if (!parsed) throw new Error("Parsed result is empty.");
        return parsed;
      } catch (e) {
        console.error("Lỗi parse JSON từ AI:", e);
        throw new Error("AI trả về dữ liệu không đúng định dạng.");
      }
    }
    throw new Error("AI không trả về kết quả.");
  },

  async generateSandboxSetup(title: string, additionalContext?: string, settings?: AppSettings): Promise<{
    scenarios: Array<{ id: string; title: string; description: string; startingYear: number; worldContext: string }>;
    characters: FanficCharacter[];
    worldGenre: string;
    worldTheme: string;
  }> {
    const prompt = `
      You are an expert World Builder and fandom database.
      Based on the famous ORIGINAL WORK / IP: "${title}".
      ${additionalContext ? `Additional User Request/Context: "${additionalContext}"` : ""}
      
      Your goal is to use the Google Search tool to search for:
      1. Major arcs, key starting timelines, or major historical eras of this IP. Create 3 to 4 starting scenarios or start points (e.g., in Naruto: "Trận chiến Thung lũng Tận cùng", "Thời niên thiếu", "Đại chiến thế giới Ninja lần thứ 4").
      2. Comprehensive profile of at least 10 major characters.
      3. Identify the logical RPG genre (e.g., Tiên Hiệp, Huyền Huyễn, Kiếm Hiệp, Tây Phương Khoa Học Viễn Tưởng...) and main theme of this world.

      Return in Vietnamese, formatted correctly as JSON matching the schema logic.
    `;

    const aiClient = getAiClient(settings);
    const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          worldGenre: { type: Type.STRING, description: "Thể loại bối cảnh, ví dụ Tiên Hiệp, Khoa Huyễn" },
          worldTheme: { type: Type.STRING, description: "Chủ đề bao quát thiết lập của tác phẩm" },
          scenarios: {
            type: Type.ARRAY,
            description: "Danh sách 3-4 mốc xuất phát / bối cảnh thời gian kịch bản khác nhau của thế giới",
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING, description: "Tiêu đề mốc kịch bản (ví dụ: Hẹn Ước 3 Năm...)" },
                description: { type: Type.STRING, description: "Mô tả hoàn cảnh mốc thời gian này" },
                startingYear: { type: Type.INTEGER, description: "Năm xuất phát logic (ví dụ: 1000)" },
                worldContext: { type: Type.STRING, description: "Bối cảnh vĩ mô tương ứng thời kỳ này để nạp vào kịch bản chơi game" }
              },
              required: ["id", "title", "description", "startingYear", "worldContext"]
            }
          },
          characters: {
            type: Type.ARRAY,
            description: "Danh sách ít nhất 10 nhân vật chính và phụ có sức ảnh hưởng kỳ vĩ trong tác phẩm",
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                gender: { type: Type.STRING },
                age: { type: Type.STRING },
                personality: { type: Type.STRING },
                background: { type: Type.STRING },
                appearance: { type: Type.STRING },
                skills: { type: Type.STRING },
                goal: { type: Type.STRING },
                role: { type: Type.STRING }
              },
              required: ["name", "gender", "age", "personality", "background", "appearance", "skills", "goal", "role"]
            }
          }
        },
        required: ["worldGenre", "worldTheme", "scenarios", "characters"]
      },
      temperature: 0.2,
      tools: [{ googleSearch: {} }]
    };

    const modelToUse = settings?.aiModel || 'gemini-2.5-pro';

    const response = await aiClient.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: config
    });

    if (response.text) {
      try {
        const parsed = extractJson<any>(response.text);
        if (!parsed) throw new Error("Parsed blank response.");
        return parsed;
      } catch (e) {
        console.error("Lỗi parse JSON Sandbox Setup:", e);
        throw new Error("AI trả về dữ liệu Sandbox không đúng định dạng.");
      }
    }
    throw new Error("AI không trả về kết quả Sandbox.");
  }
};
