import { getAiClient } from "./client";
import { dbService, VectorData } from "../db/indexedDB";
import { ChatMessage, AppSettings } from "../../types";

// Local embedding model singletons
let pipelineInstance: any = null;
let isLoadingPipeline = false;

async function getLocalTransformerEmbedding(text: string): Promise<number[] | null> {
    if (typeof window === "undefined") return null;
    try {
        if (!pipelineInstance && !isLoadingPipeline) {
            isLoadingPipeline = true;
            console.log("[LocalEmbedding] Loading Xenova feature-extraction pipeline...");
            const { pipeline } = await import("@xenova/transformers");
            pipelineInstance = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
            console.log("[LocalEmbedding] Xenova pipeline loaded successfully.");
            isLoadingPipeline = false;
        }
        
        if (pipelineInstance) {
            const output = await pipelineInstance(text, { pooling: "mean", normalize: true });
            const values = Array.from(output.data) as number[];
            
            // Pad or truncate to exact 768 dimensions for database alignment
            if (values.length < 768) {
                const padded = new Array(768).fill(0);
                for (let i = 0; i < values.length; i++) {
                    padded[i] = values[i];
                }
                return padded;
            } else if (values.length > 768) {
                return values.slice(0, 768);
            }
            return values;
        }
    } catch (err) {
        console.warn("[LocalEmbedding] Failed to generate Xenova transformer embedding:", err);
        isLoadingPipeline = false;
    }
    return null;
}

function getLocalHashEmbedding(text: string, dimension: number = 768): number[] {
    const vector = new Array(dimension).fill(0);
    const cleanText = text.toLowerCase().replace(/[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, " ");
    const words = cleanText.split(/\s+/).filter(w => w.length > 1);
    
    // Word hashing
    for (const word of words) {
        let hash = 0;
        for (let i = 0; i < word.length; i++) {
            hash = (hash * 31 + word.charCodeAt(i)) | 0;
        }
        const bin = Math.abs(hash) % dimension;
        vector[bin] += 1.0;
    }
    
    // Character 3-grams for spelling overlap robustness
    for (let i = 0; i < text.length - 2; i++) {
        const trigram = text.substring(i, i + 3);
        let hash = 0;
        for (let j = 0; j < trigram.length; j++) {
            hash = (hash * 17 + trigram.charCodeAt(j)) | 0;
        }
        const bin = Math.abs(hash) % dimension;
        vector[bin] += 0.5;
    }

    // L2 Normalization
    let sumSq = 0;
    for (let i = 0; i < dimension; i++) {
        sumSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm > 0) {
        for (let i = 0; i < dimension; i++) {
            vector[i] /= norm;
        }
    } else {
        vector[0] = 1.0;
    }
    return vector;
}

// Task 3.2: Vector Service Implementation

export const vectorService = {
    /**
     * Calculates Cosine Similarity between two vectors
     */
    cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
            return 0; // Prevent NaN or sizing mismatched errors across different runtimes
        }
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    },

    /**
     * Generates embedding for a given text using free models with rotation/fallback
     */
    async getEmbedding(text: string, settings?: AppSettings, forceLocal?: boolean): Promise<number[] | null> {
        if (!text || text.trim().length === 0) return null;

        const hasPersonalKey = settings?.geminiApiKey && settings.geminiApiKey.length > 0 && settings.geminiApiKey.some(k => k && k.trim() !== "" && k !== "YOUR_API_KEY");
        const hasProxy = settings?.proxies && settings.proxies.some(p => p.id === settings.activeProxyId && p.key);
        const hasLegacyProxy = settings?.proxyEnabled && settings.proxyUrl && settings.proxyKey;

        const isLocal = forceLocal || settings?.useLocalEmbedding;

        // Try direct cloud embeddings if a proxy or credential is setup (and isLocal is false)
        if (!isLocal && (hasPersonalKey || hasProxy || hasLegacyProxy)) {
            const userModel = settings?.embeddingModel;
            const fallbackModels = ['gemini-embedding-001', 'text-embedding-005', 'text-multilingual-embedding-002', 'gemini-embedding-2', 'text-embedding-004'];
            
            const models = userModel 
                ? [userModel, ...fallbackModels.filter(m => m !== userModel)] 
                : fallbackModels;
            
            for (const modelName of models) {
                try {
                    const aiClient = getAiClient(settings, false);
                    
                    const result = await aiClient.models.embedContent({
                        model: modelName,
                        contents: [
                            {
                                parts: [{ text: text }]
                            }
                        ]
                    });

                    const embedding = result.embeddings?.[0];
                    if (embedding?.values) {
                        return embedding.values;
                    }
                } catch (error: unknown) {
                    console.error("Embedding generation failed for model", modelName, error);
                    continue; 
                }
            }
        }

        // --- FALLBACK TO LOCAL HYBRID RAG ON-DEVICE COMPUTATION (100% Free, offline, no API required) ---
        try {
            const localTransformerEmbed = await getLocalTransformerEmbedding(text);
            if (localTransformerEmbed) {
                return localTransformerEmbed;
            }
        } catch (err) {
            // Silence and try hash vectorizer
        }

        // Fallback component 2: Instant keyword-gram dense vectorizer math
        return getLocalHashEmbedding(text, 768);
    },

    /**
     * Enforces a maximum limit on stored vectors using First-In-First-Out (FIFO) eviction.
     */
    async enforceVectorLimit(saveId?: string, docId?: string, maxLimit: number = 500): Promise<void> {
        try {
            let allVectors = await dbService.getAllVectors();
            if (saveId) {
                allVectors = allVectors.filter(v => v.saveId === saveId);
            } else if (docId) {
                allVectors = allVectors.filter(v => v.docId === docId);
            }
            
            if (allVectors.length > maxLimit) {
                // Sort by timestamp ascending (oldest first)
                allVectors.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                
                const deleteCount = allVectors.length - maxLimit;
                console.log(`[VectorEviction] Evicting ${deleteCount} oldest vectors to maintain size <= ${maxLimit}`);
                for (let i = 0; i < deleteCount; i++) {
                    await dbService.deleteVector(allVectors[i].id);
                }
            }
        } catch (err) {
            console.error("[VectorEviction] Error during FIFO eviction:", err);
        }
    },

    /**
     * Saves a message (user or model) to Vector DB
     */
    async saveVector(id: string, text: string, role: 'user' | 'model', settings?: AppSettings, saveId?: string): Promise<void> {
        // Avoid re-saving if exists
        const exists = await dbService.hasVector(id);
        if (exists) return;

        const embedding = await this.getEmbedding(text, settings);
        if (embedding) {
            const vectorData: VectorData = {
                id,
                text,
                embedding,
                timestamp: Date.now(),
                role,
                saveId
            };
            await dbService.saveVector(vectorData);
            await this.enforceVectorLimit(saveId, undefined, 500);
        }
    },

    /**
     * Saves a novel chunk to Vector DB
     */
    async saveNovelChunkVector(chunkId: string, docId: string, text: string, settings?: AppSettings): Promise<void> {
        const exists = await dbService.hasVector(chunkId);
        if (exists) return;

        const embedding = await this.getEmbedding(text, settings);
        if (embedding) {
            const vectorData: VectorData = {
                id: chunkId,
                text,
                embedding,
                timestamp: Date.now(),
                role: 'novel_source',
                docId
            };
            await dbService.saveVector(vectorData);
            await this.enforceVectorLimit(undefined, docId, 500);
        }
    },

    /**
     * Searches for semantically similar text from the vector database, optionally filtered by role and saveId
     */
    async searchSimilarVectors(
        queryText: string, 
        settings?: AppSettings, 
        limit: number = 10, 
        roleFilter?: 'user' | 'model' | 'novel_source',
        saveId?: string
    ): Promise<VectorData[]> {
        const queryEmbedding = await this.getEmbedding(queryText, settings);
        if (!queryEmbedding) return [];

        let allVectors = await dbService.getAllVectors();
        if (roleFilter) {
            allVectors = allVectors.filter(v => v.role === roleFilter);
        }
        if (saveId) {
            allVectors = allVectors.filter(v => v.saveId === saveId);
        }
        
        // Calculate similarity for each vector
        const scoredVectors = allVectors.map(vec => ({
            ...vec,
            score: this.cosineSimilarity(queryEmbedding, vec.embedding)
        }));

        // Sort by score descending and take top 'limit'
        const rawResults = scoredVectors
            .filter(v => v.score > 0.35) 
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        // Parent-Child Chunking hydration:
        // If a matched child chunk has parentId, load the wide parent chunk to prevent context fragmentation!
        const hydratedResults: VectorData[] = [];
        for (const vec of rawResults) {
            if (vec.parentId) {
                try {
                    const parentVec = await dbService.getVector(vec.parentId);
                    if (parentVec) {
                        hydratedResults.push({
                            ...vec,
                            text: parentVec.text, // Hydrate text content with full parent context!
                            summary: `[Parent-Child Hydra Match | Original Score: ${(vec.score || 0).toFixed(2)}]`
                        });
                        continue;
                    }
                } catch (err) {
                    console.error("Failed to load parent chunk:", vec.parentId, err);
                }
            }
            hydratedResults.push(vec);
        }

        return hydratedResults;
    },

    /**
     * Task 3.4: Process old history and vectorize missing messages
     */
    async vectorizeAllHistory(history: ChatMessage[], settings?: AppSettings, saveId?: string): Promise<void> {
        for (let i = 0; i < history.length; i++) {
            const msg = history[i];
            const msgId = `msg-${msg.timestamp}-${msg.role}`;
            
            const exists = await dbService.hasVector(msgId);
            if (!exists && msg.text) {
                await new Promise(r => setTimeout(r, 200)); 
                await this.saveVector(msgId, msg.text, msg.role, settings, saveId);
            }
        }
    }
};
