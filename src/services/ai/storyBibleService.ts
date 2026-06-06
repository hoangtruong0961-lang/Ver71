import { ChatMessage, AppSettings, WorldData } from "../../types";
import { dbService, VectorData } from "../db/indexedDB";
import { vectorService } from "./vectorService";
import { StoryBibleEngine } from "./storybible/StoryBibleEngine";
import { StoryBibleEntry } from "./storybible/types";

export const storyBibleService = {
  async initialize(
    worldData: WorldData,
    settings: AppSettings,
    saveId: string,
  ): Promise<void> {
    if (!settings.enableVectorMemory || !saveId) return;

    // Check if already populated
    const existing = await this.getAllEntries(saveId);
    if (existing.length > 0) return;

    // Bootstrap
    const initialEntries = await StoryBibleEngine.bootstrap(
      worldData,
      settings,
    );
    for (const entry of initialEntries) {
      await this.saveEntry(entry, saveId, settings);
    }
  },

  async processTurn(
    recentHistory: ChatMessage[],
    saveId: string,
    settings: AppSettings,
    turnNumber: number,
  ): Promise<void> {
    if (!settings.enableVectorMemory || !saveId) return;

    const allEntries = await this.getAllEntries(saveId);

    // 1. Extract new lore every few turns (Extract AI)
    // Only run extraction if there's enough new context. Assuming extracting every 1-3 turns
    const newOrUpdatedEntries = await StoryBibleEngine.extract(
      recentHistory,
      allEntries,
      settings,
    );
    for (const entry of newOrUpdatedEntries) {
      await this.saveEntry(entry, saveId, settings);
    }

    // 2. Consolidate every 10 turns (Consolidate AI)
    if (turnNumber % 10 === 0) {
      const updatedAll = await this.getAllEntries(saveId);
      const cleaned = await StoryBibleEngine.consolidate(updatedAll, settings);

      // Find which ones were removed
      const cleanedIds = new Set(cleaned.map((e) => e.id));
      for (const old of updatedAll) {
        if (!cleanedIds.has(old.id)) {
          await dbService.deleteVectorsByDocId(`sb-${saveId}-${old.id}`);
        }
      }

      for (const valid of cleaned) {
        await this.saveEntry(valid, saveId, settings);
      }
    }
  },

  async queryContext(
    userMessage: string,
    history: ChatMessage[],
    saveId: string,
    settings: AppSettings,
  ): Promise<StoryBibleEntry[]> {
    if (!settings.enableVectorMemory || !saveId) return [];
    const allEntries = await this.getAllEntries(saveId);

    const relevant = await StoryBibleEngine.retrieve(
      userMessage,
      history,
      allEntries,
      settings,
    );

    // Update DB with stickiness/timesTriggered changes
    for (const entry of relevant) {
      await this.saveEntry(entry, saveId, settings, false); // false = don't re-embed if text hasn't changed
    }

    return relevant;
  },

  async getAllEntries(saveId: string): Promise<StoryBibleEntry[]> {
    const allVectors = await dbService.getAllVectors();
    const storyBibleVectors = allVectors.filter(
      (v) => v.role === "story_bible" && v.saveId === saveId,
    );

    return storyBibleVectors.map((v) => {
      // Reconstruct StoryBibleEntry from DB VectorData
      // If it was created by old logic, parse it into the new format
      try {
        // If we store internal metadata as stringified JSON in updateHistory config, we can reconstruct it.
        // However, VectorData lacks fields. Let's serialize the entire Entry into `text` or `updateHistory[0]`
        // Wait, it's better to stash the JSON in vector data `text` or update VectorData interface.
        // Let's assume we store the stringified Entry in updateHistory config.
        const rawData = v.updateHistory
          ?.find((h) => h && h.content && typeof h.content === 'string' && h.content.startsWith("__METADATA__:"))
          ?.content.replace("__METADATA__:", "");
        if (rawData) {
          const entry = JSON.parse(rawData) as StoryBibleEntry;
          entry.embedding = v.embedding; // Attach vector embedding for local Cosine calculations
          return entry;
        }
      } catch (e) {}

      return {
        id: v.id.replace(`sb-${saveId}-`, ""),
        title: v.keyword || "Fact",
        category: (v.category as any) || "world",
        source: "auto",
        version: 1,
        content: v.text,
        keywords: [v.keyword || ""],
        tags: [],
        triggerMode: "semantic",
        priority: 50,
        weight: 1.0,
        sticky: false,
        stickyTurns: 0,
        position: "before_history",
        depth: 0,
        timesTriggered: 0,
        confidence: 1.0,
        createdAt: v.timestamp,
        updatedAt: v.timestamp,
        changelog: [],
        embedding: v.embedding, // Attach vector embedding for local Cosine calculations
      };
    });
  },

  async saveEntry(
    entry: StoryBibleEntry,
    saveId: string,
    settings: AppSettings,
    reEmbed: boolean = true,
  ): Promise<void> {
    console.log(`[StoryBibleService] Saving entry: ${entry.title}`);
    const docId = `sb-${saveId}-${entry.id}`;
    let embedding = undefined;
    const existing = await dbService.getVector(docId);

    if (reEmbed) {
      const embeddingStr = `${entry.title}: ${entry.content}`;
      embedding = await vectorService.getEmbedding(embeddingStr, settings);
      if (!embedding) {
        console.warn(
          `[StoryBibleService] Failed to generate embedding for ${entry.title}. Using dummy vector.`,
        );
        embedding = new Array(768).fill(0);
      }
    } else {
      embedding = existing?.embedding || new Array(768).fill(0);
    }

    if (embedding) {
      const vectorData: VectorData = {
        id: docId,
        text: entry.content,
        embedding,
        timestamp: entry.updatedAt,
        role: "story_bible",
        saveId,
        keyword: entry.title,
        category: entry.category,
        // UI fields
        priority: entry.priority,
        triggerMode: entry.triggerMode,
        keywords: entry.keywords,
        tags: entry.tags,
        isSticky: entry.sticky,
        position: entry.position,
        depth: entry.depth,
        timesTriggered: entry.timesTriggered,
        isEnabled: true,
        updateHistory: [
          {
            timestamp: Date.now(),
            content: `__METADATA__:${JSON.stringify(entry)}`,
          },
          ...(existing?.updateHistory?.filter((h) => h && h.content && typeof h.content === 'string' && !h.content.startsWith("__METADATA__")) || []),
          // Find the latest changelog that isn't already inside the updateHistory (by counting)
          ...(entry.changelog.length > (existing?.updateHistory?.filter((h) => h && h.content && typeof h.content === 'string' && !h.content.startsWith("__METADATA__"))?.length || 0)
            ? [
                {
                  timestamp: Date.now(),
                  content: entry.changelog[entry.changelog.length - 1],
                },
              ]
            : []),
        ],
      };
      await dbService.saveVector(vectorData);
    }
  },
};
