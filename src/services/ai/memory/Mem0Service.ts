import { ChatMessage, AppSettings, WorldData } from "../../../types";
import { dbService } from "../../db/indexedDB";
import { vectorService } from "../vectorService";
import { getAiClient } from "../client";

export interface Mem0Memory {
  id: string;
  text: string;
  category: "user" | "character" | "world" | "event";
  subject: string; // e.g., "player", name of NPC, name of location
  turnNumber: number;
  timestamp: number;
  confidence: number;
  isLocked?: boolean; // If true, the LLM cannot auto-update or delete it
  embedding?: number[]; // Embedded for semantic retrieval
}

export interface MemoryOperation {
  op: "ADD" | "UPDATE" | "DELETE" | "NOOP";
  id?: string;
  text?: string;
  category?: "user" | "character" | "world" | "event";
  subject?: string;
  reason?: string;
}

export const Mem0Service = {
  /**
   * Fetch all Mem0 memories for a given world
   */
  async getMemories(worldId: string): Promise<Mem0Memory[]> {
    const key = `ark-mem0-memories-${worldId}`;
    const value = await dbService.getKeyValueSync(key, []);
    return Array.isArray(value) ? value : [];
  },

  /**
   * Save Mem0 memories directly to IndexedDB keyval with sync cache
   */
  async saveMemories(worldId: string, memories: Mem0Memory[]): Promise<void> {
    const key = `ark-mem0-memories-${worldId}`;
    await dbService.setKeyValue(key, memories);
  },

  /**
   * Insert a manual memory with fallback embedding generation
   */
  async addManualMemory(
    worldId: string,
    text: string,
    category: "user" | "character" | "world" | "event",
    subject: string,
    settings?: AppSettings
  ): Promise<Mem0Memory> {
    const memories = await this.getMemories(worldId);
    
    // Generate embedding for semantic search
    let embedding: number[] | undefined = undefined;
    try {
      const emb = await vectorService.getEmbedding(text, settings || undefined);
      if (emb) embedding = emb;
    } catch (e) {
      console.warn("[Mem0Service] Failed to generate embedding for manual memory:", e);
    }

    const newMemory: Mem0Memory = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text,
      category,
      subject,
      turnNumber: 0,
      timestamp: Date.now(),
      confidence: 1.0,
      isLocked: true, // Manual memories are locked by default so they don't get modified by AI without permission
      embedding,
    };

    memories.unshift(newMemory);
    await this.saveMemories(worldId, memories);
    return newMemory;
  },

  /**
   * Update details of an existing memory
   */
  async updateMemory(
    worldId: string,
    memoryId: string,
    updates: Partial<Mem0Memory>,
    settings?: AppSettings
  ): Promise<void> {
    const memories = await this.getMemories(worldId);
    const index = memories.findIndex((m) => m.id === memoryId);
    if (index === -1) return;

    const existing = memories[index];
    const updatedMemory = { ...existing, ...updates, timestamp: Date.now() };

    // If text was modified, re-generate embedding
    if (updates.text && updates.text !== existing.text) {
      try {
        const emb = await vectorService.getEmbedding(updates.text, settings || undefined);
        if (emb) updatedMemory.embedding = emb;
      } catch (e) {
        console.warn("[Mem0Service] Failed to re-generate embedding on update:", e);
      }
    }

    memories[index] = updatedMemory;
    await this.saveMemories(worldId, memories);
  },

  /**
   * Delete a memory
   */
  async deleteMemory(worldId: string, memoryId: string): Promise<void> {
    const memories = await this.getMemories(worldId);
    const filtered = memories.filter((m) => m.id !== memoryId);
    await this.saveMemories(worldId, filtered);
  },

  /**
   * Semantic and category-based memory retrieval
   */
  async retrieveMem0Context(
    queryText: string,
    worldId: string,
    settings?: AppSettings,
    limit = 8
  ): Promise<string> {
    const memories = await this.getMemories(worldId);
    if (!memories || memories.length === 0) return "";

    // 1. If vector memory is enabled and we can embed, run semantic search
    let scoredMemories = memories.map((m) => ({ ...m, score: 0 }));
    try {
      const queryEmbedding = await vectorService.getEmbedding(queryText, settings || undefined);
      if (queryEmbedding) {
        scoredMemories = memories.map((m) => {
          let score = 0;
          if (m.embedding) {
            score = vectorService.cosineSimilarity(queryEmbedding, m.embedding);
          } else {
            // Lazy text-match fallback for score
            const containsQuery = m.text.toLowerCase().includes(queryText.toLowerCase());
            score = containsQuery ? 0.45 : 0;
          }
          return { ...m, score };
        });
      }
    } catch (e) {
      console.warn("[Mem0Service] Semantic retrieval scoring failed, falling back to string matches:", e);
    }

    // 2. Fallback or boost scoring using direct keyword matches
    const words = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    scoredMemories.forEach((sm) => {
      let wordMatches = 0;
      words.forEach((word) => {
        if (sm.text.toLowerCase().includes(word) || sm.subject.toLowerCase().includes(word)) {
          wordMatches++;
        }
      });
      // Boost score by keyword frequency, ensuring we still surfaced highly relevant memories if RAG missed it
      if (wordMatches > 0) {
        sm.score += wordMatches * 0.1;
      }
    });

    // 3. Filter minimum relevance threshold and sort descending by score
    // System locked/critical memories get a small baseline priority boost
    const activeMemories = scoredMemories
      .map(sm => sm.isLocked ? { ...sm, score: sm.score + 0.05 } : sm)
      .filter((sm) => sm.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (activeMemories.length === 0) {
      // Return top 2 locked/most recent memories by default if no semantic hits are found, to preserve core identity context
      const defaultSticky = memories
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 2);
      if (defaultSticky.length === 0) return "";
      return this.formatMemoriesForLlm(defaultSticky);
    }

    return this.formatMemoriesForLlm(activeMemories);
  },

  /**
   * Convert structured memories into compact, readable markdown context for the prompt
   */
  formatMemoriesForLlm(memories: Mem0Memory[]): string {
    const categories: Record<string, string[]> = {
      user: [],
      character: [],
      world: [],
      event: []
    };

    memories.forEach((m) => {
      let item = `- ${m.text}`;
      if (m.isLocked) item += " *(Độc lập/Cố định)*";
      categories[m.category].push(item);
    });

    let result = "";
    if (categories.user.length > 0) {
      result += `[KÝ ỨC VỀ NGƯỜI CHƠI (Bổ lý thuyết cá nhân, tùy chọn, sở thích)]:\n${categories.user.join("\n")}\n\n`;
    }
    if (categories.character.length > 0) {
      result += `[KÝ ỨC VỀ TRẠNG THÁI & QUAN HỆ CỦA NHÂN VẬT KHÁC (NPC)]:\n${categories.character.join("\n")}\n\n`;
    }
    if (categories.world.length > 0) {
      result += `[KÝ ỨC VỀ BẢN ĐỒ & THẾ GIỚI QUAN (Sự kiện địa điểm thay đổi, dấu vết)]:\n${categories.world.join("\n")}\n\n`;
    }
    if (categories.event.length > 0) {
      result += `[SỰ KIỆN CO SỞ & BẤT NGỜ GẦN ĐÂY QUAN TRỌNG]:\n${categories.event.join("\n")}\n\n`;
    }

    return result.trim();
  },

  /**
   * Background parser: analyzes the turn to extract and consolidate user/character memories (Custom Mem0 Core)
   */
  async updateMemoriesFromTurn(
    userInput: string,
    modelResponse: string,
    worldId: string,
    settings: AppSettings,
    turnNumber: number,
    activeWorld: WorldData
  ): Promise<{ operations: MemoryOperation[]; updatedCount: number }> {
    console.log(`[Mem0] Starting background memory parse and update for turn ${turnNumber}...`);
    
    const resultResponse = { operations: [] as MemoryOperation[], updatedCount: 0 };
    try {
      const aiClient = getAiClient(settings);
      const memories = await this.getMemories(worldId);

      // Serialize memories for the LLM context, marking which ones are locked
      const memoryContext = memories.map((m) => ({
        id: m.id,
        text: m.text,
        category: m.category,
        subject: m.subject,
        isLocked: !!m.isLocked
      }));

      const modelName = settings.aiMode === "hybrid" && settings.backgroundAiModel 
        ? settings.backgroundAiModel 
        : (settings.aiModel || "gemini-3.5-flash");

      const prompt = `Bạn là ARK Mem0 Engine - Bộ lọc và lưu lại bộ nhớ cá nhân hóa sâu sắc của thế giới game RPG dã sử trinh thám.

Hãy đọc và phân tích cuộc trò chuyện của lượt vừa qua cực kỳ cẩn thận:

[HÀNH ĐỘNG/LỜI THOẠI CỦA NGƯỜI CHƠI]:
"${userInput}"

[PHẢN HỒI CỦA HỆ THỐNG / AI / NPC]:
"${modelResponse}"

---
[DANH SÁCH BỘ NHỚ LỎNG HIỆN TẠI (MEM0 MEMORIES)]:
${JSON.stringify(memoryContext, null, 2)}
---

Nhiệm vụ của bạn:
Phân tích xem lượt trò chuyện trên có thay đổi, bổ sung hay phủ nhận bất kỳ CHI TIẾT SỰ THẬT nào về:
1. Thói quen, ý định, nguồn gốc hoặc thông tin cá nhân của người chơi (category: "user", subject: "player")
2. Thái độ, quan hệ, đặc điểm ngoại hình hoặc hành tung của các NPC (category: "character", subject: "<tên NPC>")
3. Thay đổi vĩnh viễn hoặc bước ngoặt của địa điểm, vật dụng, bản đồ (category: "world", subject: "tên địa điểm/đồ vật")
4. Sự kiện then chốt vừa được hé lộ (category: "event", subject: "event")

Lập kế hoạch phản hồi và chỉ ra danh sách các hành động bộ nhớ cần thực hiện:
- "ADD": Khi xuất hiện một chi tiết sự thật hoàn toàn mới, đáng nhớ, quan trọng.
- "UPDATE": Khi một bộ nhớ cũ đã lỗi thời hoặc cần bổ sung chi tiết chính xác hơn.
- "DELETE": Khi bộ nhớ cũ hoàn toàn bị phủ nhận hoặc bị hủy bỏ.
- "NOOP": Không có gì thay đổi đáng kể.

---
⚠️ NGUYÊN TẮC QUAN TRỌNG:
1. KHÔNG thêm các chi tiết vụn vặt, ngắn hạn (Ví dụ: "Người chơi bước chân trái trước" -> KHÔNG thêm). Chỉ thêm các thông tin bền vững có giá trị tham khảo lâu dài.
2. Cực kỳ tôn trọng "isLocked": true. Những bộ nhớ có isLocked = true là do người dùng chỉnh sửa bằng tay. Bạn CẤM TUYỆT ĐỐI không được UPDATE hoặc DELETE chúng. Nếu có mâu thuẫn, hãy xuất phát hành động "NOOP" cho id đó.
3. Độ tự tin (confidence): Tốc độ ghi nhớ nằm trong khoảng 0.7 đến 1.0.
4. Subject viết ngắn gọn: ví dụ "player", "Lý Huyền", "Sông Hương", "Kiếm cổ".
5. Ngôn ngữ: Hãy ghi chép bằng tiếng Việt, ngắn gọn, súc tích, văn phong khách quan lịch sử.

Trả về định dạng JSON chính xác tuyệt đối gồm danh sách các tác vụ có cấu trúc như sau:
{
  "operations": [
    {
      "op": "ADD",
      "text": "<Mô tả sự thật cực kỳ ngắn gọn súc tích, ví dụ: 'Người chơi sở hữu thanh Tiêu Dao cổ kiếm.'>",
      "category": "user",
      "subject": "player",
      "reason": "<Lý do trích xuất>"
    },
    {
      "op": "UPDATE",
      "id": "<id_bộ_nhớ_cần_sửa>",
      "text": "<Mô tả sự thật được nâng cấp mới>",
      "reason": "<Hành động mâu thuẫn hay bổ sung gì>"
    },
    {
      "op": "DELETE",
      "id": "<id_bộ_nhớ_cần_xóa>",
      "reason": "<Lý do sự thật này không còn tồn tại>"
    }
  ]
}`;

      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text ? response.text.trim() : "";
      if (!responseText) return resultResponse;

      const parsed = JSON.parse(responseText);
      if (!parsed || !Array.isArray(parsed.operations)) return resultResponse;

      const ops: MemoryOperation[] = parsed.operations;
      resultResponse.operations = ops;

      let changed = false;
      const updatedMemories = [...memories];

      for (const op of ops) {
        if (op.op === "ADD" && op.text && op.category && op.subject) {
          // Double check if a similar memory exists to prevent duplication
          const isDuplicate = updatedMemories.some(
            (m) =>
              m.text.toLowerCase() === op.text!.toLowerCase() ||
              (m.category === op.category && m.text.toLowerCase().includes(op.text!.toLowerCase()))
          );
          if (!isDuplicate) {
            // Generate embedding for the new memory key
            let embedding: number[] | undefined = undefined;
            try {
              const emb = await vectorService.getEmbedding(op.text, settings);
              if (emb) embedding = emb;
            } catch (_) {}

            updatedMemories.unshift({
              id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              text: op.text,
              category: op.category,
              subject: op.subject,
              turnNumber: turnNumber,
              timestamp: Date.now(),
              confidence: 0.9,
              embedding,
            });
            changed = true;
            resultResponse.updatedCount++;
          }
        } else if (op.op === "UPDATE" && op.id && op.text) {
          const mIndex = updatedMemories.findIndex((m) => m.id === op.id);
          if (mIndex !== -1) {
            const existing = updatedMemories[mIndex];
            if (!existing.isLocked) {
              let embedding: number[] | undefined = existing.embedding;
              try {
                const emb = await vectorService.getEmbedding(op.text, settings);
                if (emb) embedding = emb;
              } catch (_) {}

              updatedMemories[mIndex] = {
                ...existing,
                text: op.text,
                turnNumber: turnNumber,
                timestamp: Date.now(),
                embedding,
              };
              changed = true;
              resultResponse.updatedCount++;
            } else {
              console.log(`[Mem0] Prevented updates to locked memory with id ${op.id} ("${existing.text}")`);
            }
          }
        } else if (op.op === "DELETE" && op.id) {
          const mIndex = updatedMemories.findIndex((m) => m.id === op.id);
          if (mIndex !== -1) {
            const existing = updatedMemories[mIndex];
            if (!existing.isLocked) {
              updatedMemories.splice(mIndex, 1);
              changed = true;
              resultResponse.updatedCount++;
            } else {
              console.log(`[Mem0] Prevented deletion of locked memory with id ${op.id} ("${existing.text}")`);
            }
          }
        }
      }

      if (changed) {
        await this.saveMemories(worldId, updatedMemories);
        console.log(`[Mem0] Dynamic memory update completed. Done ${resultResponse.updatedCount} operations successfully!`);
      }
    } catch (err) {
      console.error("[Mem0] Background process failed:", err);
    }

    return resultResponse;
  },
};
