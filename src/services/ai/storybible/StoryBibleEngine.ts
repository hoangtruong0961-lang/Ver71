import { AppSettings, ChatMessage, WorldData } from "../../../types";
import { getAiClient } from "../client";
import { dbService, VectorData } from "../../db/indexedDB";
import { vectorService } from "../vectorService";
import {
  StoryBibleEntry,
  Category,
  TriggerMode,
  InjectionPosition,
} from "./types";
import { v4 as uuidv4 } from "uuid";

/**
 * StoryBible Engine: Manages Bootstrap, Extract, Consolidate, and Retrieval routines.
 *
 * 5 Components:
 * 1. Bootstrap AI: Generate initials.
 * 2. Extract AI (Scribe): Parse recent messages.
 * 3. Consolidate AI: Clean up, merge.
 * 4. Retrieval Engine: Build context.
 * 5. Roleplay AI (handled in gameplay/service.ts but informed by this).
 */

const ENGINE_CONFIG = {
  retrieval: {
    scanDepth: 5,
    semanticThreshold: 0.35,
  },
  tokenBudget: {
    encyclopedia: 2000,
    conversation: 4000,
  },
  scribe: {
    extractEveryNTurns: 1,
    consolidateEveryNTurns: 10,
    confidenceThreshold: 0.7,
    maxEntries: 200,
  },
  ranking: {
    stickyBoostFactor: 1.5,
    priorityBoostFactor: 1.5,
  },
};

export class StoryBibleEngine {
  // --- 1. BOOTSTRAP AI ---
  static async bootstrap(
    worldData: WorldData,
    settings: AppSettings,
  ): Promise<StoryBibleEntry[]> {
    const entries: StoryBibleEntry[] = [];
    const addedTitles = new Set<string>();

    // 1. Direct synchronization: Populate user's manually defined entities from World Creator (worldData.entities)
    if (worldData.entities && Array.isArray(worldData.entities)) {
      for (const ent of worldData.entities) {
        if (!ent.name) continue;

        let contentStr = ent.description || "";
        if (ent.personality) {
          contentStr += contentStr ? `\nTính cách/Đặc điểm: ${ent.personality}` : `Tính cách/Đặc điểm: ${ent.personality}`;
        }
        if (ent.background) {
          contentStr += contentStr ? `\nBối cảnh/Tiểu sử: ${ent.background}` : `Bối cảnh/Tiểu sử: ${ent.background}`;
        }
        if (ent.rarity) {
          contentStr += contentStr ? `\nĐộ hiếm: ${ent.rarity}` : `Độ hiếm: ${ent.rarity}`;
        }
        if (ent.price) {
          contentStr += contentStr ? `\nGiá trị: ${ent.price}` : `Giá trị: ${ent.price}`;
        }

        let category: Category = "world";
        if (ent.type === "NPC") category = "character";
        else if (ent.type === "LOCATION") category = "location";
        else if (ent.type === "ITEM") category = "item";
        else if (ent.type === "FACTION") category = "faction";
        else if (ent.type === "CUSTOM") {
          const lowType = (ent.customType || "").toLowerCase();
          if (lowType.includes("sự kiện") || lowType.includes("event")) category = "event";
          else if (lowType.includes("luật") || lowType.includes("rule")) category = "rule";
          else if (lowType.includes("phong cách") || lowType.includes("style")) category = "style";
          else if (lowType.includes("quan hệ") || lowType.includes("relation")) category = "relationship";
          else category = "world";
        }

        const keywords = [ent.name];
        if (ent.name.includes(" ")) {
          const parts = ent.name.split(" ");
          parts.forEach(p => {
            if (p.length > 2 && !keywords.includes(p)) keywords.push(p);
          });
        }

        const customEntry = this.createEntry({
          title: ent.name,
          category,
          source: "manual",
          content: contentStr || `Bản ghi bách khoa về ${ent.name}.`,
          keywords,
          triggerMode: "hybrid",
          priority: 80, // high priority for handcrafted creations
          position: ent.type === "NPC" ? "system_after_char" : "before_history",
          confidence: 1.0,
        });

        if (ent.id) {
          customEntry.id = ent.id;
        }

        entries.push(customEntry);
        addedTitles.add(ent.name.toLowerCase().trim());
      }
    }

    const aiClient = getAiClient(settings);
    const prompt = `Analyze the following World Setting and Character Data. Generate 10-15 core encyclopedia entries.
Focus on:
1. "Thế giới có luật gì?" -> world_rule [always]
2. "Ai quan trọng?" -> character [keyword]
3. "Xảy ra ở đâu?" -> location [keyword]
4. "Phe phái nào?" -> faction [keyword]
5. "Giọng văn thế nào?" -> tone [always]

Return valid JSON list of entries:
[
  {
    "title": "Entry Title",
    "category": "character|location|item|faction|relationship|world|event|rule|style",
    "content": "Full description",
    "keywords": ["key1", "key2"],
    "triggerMode": "always|keyword|semantic|hybrid",
    "priority": 80,
    "position": "system_top|system_after_char|system_bottom|before_history"
  }
]

World Data:
Name: ${worldData.world?.worldName || 'Unknown'}
Genre: ${worldData.world?.genre || 'Unknown'}
Context: ${worldData.world?.context || ''}
Entities: ${JSON.stringify(worldData.entities.map((e) => ({ name: e.name, type: e.type, desc: e.description })))}
Player: ${worldData.player.name} - ${worldData.player.background}
`;

    try {
      const response = await aiClient.models.generateContent({
        model: settings.aiMode === 'hybrid' && settings.backgroundAiModel ? settings.backgroundAiModel : (settings.aiModel || "gemini-3.1-pro-preview"),
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "[]";
      const cleanText = text.replace(/```json\n?|```/g, "").trim();
      console.log("[StoryBibleEngine] Raw Bootstrap Res:", cleanText);

      let parsed = JSON.parse(cleanText);
      if (!Array.isArray(parsed)) {
        if (parsed.entries && Array.isArray(parsed.entries)) {
          parsed = parsed.entries;
        } else {
          parsed = [parsed];
        }
      }

      for (const item of parsed) {
        const itemTitleLower = (item.title || "").toLowerCase().trim();
        if (!itemTitleLower || addedTitles.has(itemTitleLower)) continue;

        entries.push(
          this.createEntry({
            title: item.title,
            category: item.category as Category,
            source: "bootstrap",
            content: item.content,
            keywords: item.keywords || [],
            triggerMode: item.triggerMode as TriggerMode,
            priority: item.priority || 50,
            position: item.position as InjectionPosition,
            confidence: 1.0,
          }),
        );
        addedTitles.add(itemTitleLower);
      }
      return entries;
    } catch (e) {
      console.error("Bootstrap AI generation failed (returning manual entries only):", e);
      return entries;
    }
  }

  // --- 2. EXTRACT AI (Scribe) ---
  static async extract(
    recentHistory: ChatMessage[],
    existingEntries: StoryBibleEntry[],
    settings: AppSettings,
  ): Promise<StoryBibleEntry[]> {
    if (recentHistory.length === 0) return [];
    const aiClient = getAiClient(settings);

    const historyText = recentHistory
      .map((m) => {
        let cleanText = m.text;
        // Strip thinking blocks for the extractor
        cleanText = cleanText.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "").trim();
        return `[${m.role}]: ${cleanText}`;
      })
      .join("\n\n");

    const prompt = `Bạn là Trợ lý Scribe Trích xuất Ký ức Siêu chi tiết của hệ thống ARK CORE.
Nhiệm vụ của bạn là đọc kỹ đoạn hội thoại/diễn biến truyện vừa qua và trích xuất từng CHI TIẾT DÙ LÀ NHỎ NHẤT (Micro-details, Episodic & Ambient clues, State parameters) để đưa vào bộ nhớ dài hạn, tránh việc AI bị quên lãng cốt truyện.

Hãy chú trọng ghi nhận:
✓ CHI TIẾT VỀ MỌI VẬT PHẨM: Tên vật phẩm, số lượng, đặc tính, vị trí cất giữ cụ thể, trạng thái (ví dụ: bị mẻ, rỉ sét, mới cáu).
✓ BIỂU CẢM, CỬ CHỈ & LỜI PHÁT NGÔN: Sở thích, trang phục hiện tại, vết sẹo, thói quen nói năng, một câu trích dẫn đặc biệt nổi bật của nhân vật, hoặc một lời hứa, thỏa thuận ngầm nhỏ nhất giữa các thực thể.
✓ CHI TIẾT SỰ KIỆN & MÔI TRƯỜNG: Có đồ vật nào bị dịch chuyển, vết nứt trên tường, mật đạo, thời tiết thay đổi, hoặc một gợi ý nhỏ mà nhân vật nghe thấy trên đường đi.
✓ SỰ KIỆN QUAN TRỌNG & THIẾT LẬP THẾ GIỚI: Vấn đề sinh học, quy tắc địa phương mới được phát hiện, bối cảnh vùng đất láng giềng.

Nếu một chi tiết cập nhật lại thông tin đã tồn tại, hãy sửa và thêm dòng cập nhật mới để tránh mâu thuẫn.
Độ tin cậy (Confidence) từ 0 đến 1.0. Chỉ trả về những chi tiết có độ tin cậy cao (>= 0.6).

Format trả về phải là một chuỗi JSON chuẩn:
[
  {
    "title": "Tên chi tiết/Từ khóa thực thể",
    "category": "character|location|item|faction|relationship|world|event",
    "content": "Mô tả cực kỳ cụ thể, giữ nguyên các thông tin con số, định lượng, tên riêng và tình huống nhỏ nhất.",
    "keywords": ["từ khoá kích hoạt 1", "từ khoá kích hoạt 2"],
    "confidence": 0.95,
    "position": "before_history"
  }
]

Đoạn hội thoại cần phân tích:
${historyText}
`;

    try {
      const response = await aiClient.models.generateContent({
        model: settings.aiMode === 'hybrid' && settings.backgroundAiModel ? settings.backgroundAiModel : (settings.aiModel || "gemini-3.1-pro-preview"),
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "[]";
      const cleanText = text.replace(/```json\n?|```/g, "").trim();
      console.log("[StoryBibleEngine] Raw Extract Res:", cleanText);

      let parsed = JSON.parse(cleanText);
      if (!Array.isArray(parsed)) {
        if (parsed.entries && Array.isArray(parsed.entries)) {
          parsed = parsed.entries;
        } else {
          parsed = [parsed];
        }
      }

      const newEntries: StoryBibleEntry[] = [];
      for (const item of parsed) {
        const conf =
          item.confidence !== undefined ? parseFloat(item.confidence) : 1.0;
        if (conf < ENGINE_CONFIG.scribe.confidenceThreshold) continue;
        if (!item.title || !item.content) continue;

        // If existing title, we might update it in Consolidate or right here
        const existing = existingEntries.find(
          (e) => e.title.toLowerCase() === item.title.toLowerCase(),
        );
        if (existing) {
          existing.content += "\n- " + item.content;
          existing.version += 1;
          existing.updatedAt = Date.now();
          existing.confidence = conf;
          existing.changelog.push(
            `Updated via Extraction at ${new Date().toISOString()}`,
          );
          newEntries.push(existing);
        } else {
          newEntries.push(
            this.createEntry({
              title: item.title,
              category: item.category as Category,
              source: "auto",
              content: "- " + item.content,
              keywords: item.keywords || [item.title],
              triggerMode: "semantic",
              priority: 50,
              position: item.position || "before_history",
              confidence: item.confidence,
            }),
          );
        }
      }
      return newEntries;
    } catch (e) {
      console.error("Extract failed:", e);
      return [];
    }
  }

  // --- 3. CONSOLIDATE AI ---
  static async consolidate(
    entries: StoryBibleEntry[],
    settings: AppSettings,
  ): Promise<StoryBibleEntry[]> {
    // Runs every 10 turns.
    // It prunes entries with timesTriggered = 0 && age > 20 turns
    // It merges duplicates. We can use LLM to merge if needed, but for now we do simple prune.

    const cleaned = entries.filter((e) => {
      if (e.source === "manual" || e.source === "bootstrap") return true;
      // Prune if triggered 0 times and it's old (for now we check timesTriggered)
      // Or if low confidence
      if (
        e.timesTriggered === 0 &&
        Date.now() - e.createdAt > 1000 * 60 * 60 * 24
      )
        return false;
      return true;
    });

    // AI Deduplication & Merge could go here

    return cleaned;
  }

  // --- 4. RETRIEVAL ENGINE ---
  static async retrieve(
    userMessage: string,
    history: ChatMessage[],
    entries: StoryBibleEntry[],
    settings: AppSettings,
  ): Promise<StoryBibleEntry[]> {
    const activeEntries: StoryBibleEntry[] = [];
    const scanText = [
      ...history.slice(-ENGINE_CONFIG.retrieval.scanDepth).map((h) => h.text),
      userMessage,
    ].join("\n");

    const userQueryEmbedding = await vectorService.getEmbedding(
      scanText,
      settings,
    );

    // Heuristic category detection from query string (Vietnamese & English)
    const activeCategories = new Set<string>();
    const lowerScan = scanText.toLowerCase();

    if (/ai|nhân vật|người|hắn|nó|cô|anh|ông|bà|npc|tên|gặp|nói|hỏi|chào|player|char|character/i.test(lowerScan)) {
      activeCategories.add("character");
    }
    if (/đến|ở|tại|vào|đi|đâu|nơi|địa điểm|vùng|rừng|thành|phố|quán|vương quốc|đại lục|level|location|map|place|area/i.test(lowerScan)) {
      activeCategories.add("location");
    }
    if (/nhặt|mở|hộp|kiếm|vũ khí|vật phẩm|trang bị|sử dụng|thuốc|bình|đồ|item|weapon|equip|gear/i.test(lowerScan)) {
      activeCategories.add("item");
    }
    if (/phe|đối lập|băng|nhóm|gia tộc|thế lực|liên minh|quân|quốc gia|đảng|faction|guild|clan|nation/i.test(lowerScan)) {
      activeCategories.add("faction");
    }
    if (/yêu|ghét|quen|biết|bạn|thù|quan hệ|tình cảm|vợ|chồng|bố|mẹ|con|relationship|friend|enemy/i.test(lowerScan)) {
      activeCategories.add("relationship");
    }
    if (/khi|lúc|sau khi|trận|cuộc chiến|chiến đấu|lễ hội|sự kiện|biến cố|xảy ra|event|incident|happen/i.test(lowerScan)) {
      activeCategories.add("event");
    }
    if (/luật|lệ|quy tắc|hệ thống|chỉ số|sức mạnh|giới hạn|skill|chiêu|damage|hp|mp|law|rule|system|mechanic/i.test(lowerScan)) {
      activeCategories.add("rule");
    }
    if (/thế giới|vũ trụ|lịch sử|truyền thuyết|thần thoại|bối cảnh|world|universe|history|lore/i.test(lowerScan)) {
      activeCategories.add("world");
    }

    for (const entry of entries) {
      let isKeywordMatched = false;
      let matchedKwList: string[] = [];
      let semanticScore = 0;
      let isSemanticMatched = false;
      let baseScore = 0;

      // 1. Keyword check
      if (
        entry.triggerMode === "keyword" ||
        entry.triggerMode === "hybrid" ||
        entry.triggerMode === "always"
      ) {
        const kws = entry.keywords && entry.keywords.length > 0 ? entry.keywords : [entry.title];
        for (const k of kws) {
          if (k && lowerScan.includes(k.toLowerCase())) {
            isKeywordMatched = true;
            matchedKwList.push(k);
          }
        }
      }

      // 2. Semantic vector similarity check
      if (
        userQueryEmbedding &&
        entry.embedding &&
        entry.embedding.length > 0 &&
        (entry.triggerMode === "semantic" || entry.triggerMode === "hybrid")
      ) {
        const similarity = vectorService.cosineSimilarity(userQueryEmbedding, entry.embedding);
        semanticScore = similarity;
        if (similarity > ENGINE_CONFIG.retrieval.semanticThreshold) {
          isSemanticMatched = true;
        }
      }

      // 3. Evaluate criteria based on trigger mode
      let activated = false;
      if (entry.triggerMode === "always") {
        activated = true;
        baseScore = 0.82; // Static value for absolute retrievals
      } else if (entry.triggerMode === "keyword") {
        activated = isKeywordMatched;
        baseScore = isKeywordMatched ? 0.75 : 0;
      } else if (entry.triggerMode === "semantic") {
        activated = isSemanticMatched;
        baseScore = isSemanticMatched ? semanticScore : 0;
      } else if (entry.triggerMode === "hybrid") {
        activated = isKeywordMatched || isSemanticMatched;
        baseScore = isKeywordMatched 
          ? Math.max(0.75, semanticScore) 
          : (isSemanticMatched ? semanticScore : 0);
      }

      // 4. Metadata-Aware Boosting
      let finalScore = baseScore;
      let boostLog = "";
      let categoryMatched = false;

      if (activated) {
        // Boost factor for Category Concordance
        if (activeCategories.has(entry.category)) {
          categoryMatched = true;
          finalScore *= 1.25; // 25% Boost
          boostLog += `+ Thích ứng Lớp (${entry.category}): x1.25 `;
        }

        // Tag matching boost: if classification tags overlap with user query vocabulary
        const matchedTags: string[] = [];
        if (entry.tags && entry.tags.length > 0) {
          for (const tag of entry.tags) {
            if (lowerScan.includes(tag.toLowerCase())) {
              matchedTags.push(tag);
            }
          }
          if (matchedTags.length > 0) {
            finalScore += matchedTags.length * 0.05;
            boostLog += `+ Thẻ khớp (${matchedTags.join(", ")}): +${(matchedTags.length * 0.05).toFixed(2)} `;
          }
        }

        // Stickiness multiplier
        if (entry.sticky && entry.stickyTurns > 0) {
          finalScore *= ENGINE_CONFIG.ranking.stickyBoostFactor;
          boostLog += `+ Cooldown Sticky: x${ENGINE_CONFIG.ranking.stickyBoostFactor} `;
        }

        // Priority scaling
        const priorityBoost = (entry.priority / 100) * 0.15;
        finalScore += priorityBoost;
        boostLog += `+ Hạng Ưu tiên (${entry.priority}): +${priorityBoost.toFixed(2)} `;

        // Confidence modifier from Scribe Auto Engine
        if (entry.confidence !== undefined) {
          finalScore *= entry.confidence;
        }

        // Save metadata diagnostics
        entry.searchScore = Math.round(finalScore * 1000) / 1000;
        entry.metadataScoreBoost = Math.round((finalScore - baseScore) * 1000) / 1000;
        entry.metadataDiagnostic = {
          categoryMatched,
          boostedCategory: categoryMatched ? entry.category : undefined,
          matchedTags,
          matchDetails: `Gốc: ${(baseScore * 100).toFixed(1)}% ${boostLog}-> Tổng: ${(finalScore * 100).toFixed(1)}%`
        };

        entry.timesTriggered++;
        if (entry.sticky && entry.stickyTurns > 0) {
          entry.stickyTurns = Math.max(0, entry.stickyTurns - 1);
        }
        activeEntries.push(entry);
      }
    }

    // Sort by final metadata-aware composite score descending
    return activeEntries.sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0));
  }

  // --- Helpers ---
  private static createEntry(data: Partial<StoryBibleEntry>): StoryBibleEntry {
    return {
      id: uuidv4(),
      title: data.title || "Untitled",
      category: data.category || "world",
      source: data.source || "auto",
      version: 1,
      content: data.content || "",
      summary: data.summary || "",
      keywords: data.keywords || [],
      tags: data.tags || [],
      triggerMode: data.triggerMode || "semantic",
      priority: data.priority ?? 50,
      weight: data.weight ?? 1.0,
      sticky: data.sticky ?? false,
      stickyTurns: data.stickyTurns ?? 0,
      position: data.position || "before_history",
      depth: data.depth ?? 0,
      timesTriggered: 0,
      confidence: data.confidence ?? 1.0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      changelog: ["Created"],
    };
  }
}
