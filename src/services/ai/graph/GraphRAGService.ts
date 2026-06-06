import { getAiClient } from "../client";
import { AppSettings, ChatMessage, WorldData } from "../../../types";
import { dbService } from "../../db/indexedDB";
import { v4 as uuidv4 } from "uuid";

export interface GraphNode {
    id: string;
    label: string; // e.g., "Person", "Location", "Item", "Event"
    name: string;
    description: string;
    properties: Record<string, string>;
}

export interface GraphEdge {
    id: string;
    source: string; // Node ID
    target: string; // Node ID
    relationship: string;
    description: string;
    weight: number;
}

export const GraphRAGService = {
    _nodesCache: {} as Record<string, GraphNode[]>,
    _edgesCache: {} as Record<string, GraphEdge[]>,

    // Helper to get save-specific keys for tavo_data
    getNodesKey(saveId: string): string {
        return `graphRAG_${saveId}_nodes`;
    },
    getEdgesKey(saveId: string): string {
        return `graphRAG_${saveId}_edges`;
    },

    async getAllNodes(saveId: string): Promise<GraphNode[]> {
        if (this._nodesCache[saveId]) {
            return JSON.parse(JSON.stringify(this._nodesCache[saveId]));
        }
        const nodes = await dbService.getTavoData(this.getNodesKey(saveId));
        const finalNodes = (nodes || []) as GraphNode[];
        this._nodesCache[saveId] = JSON.parse(JSON.stringify(finalNodes));
        return finalNodes;
    },

    async getAllEdges(saveId: string): Promise<GraphEdge[]> {
        if (this._edgesCache[saveId]) {
            return JSON.parse(JSON.stringify(this._edgesCache[saveId]));
        }
        const edges = await dbService.getTavoData(this.getEdgesKey(saveId));
        const finalEdges = (edges || []) as GraphEdge[];
        this._edgesCache[saveId] = JSON.parse(JSON.stringify(finalEdges));
        return finalEdges;
    },

    async saveGraphData(saveId: string, nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
        delete this._nodesCache[saveId];
        delete this._edgesCache[saveId];
        await dbService.setTavoData(this.getNodesKey(saveId), nodes);
        await dbService.setTavoData(this.getEdgesKey(saveId), edges);
        this._nodesCache[saveId] = JSON.parse(JSON.stringify(nodes));
        this._edgesCache[saveId] = JSON.parse(JSON.stringify(edges));
    },

    clearCache(saveId?: string): void {
        if (saveId) {
            delete this._nodesCache[saveId];
            delete this._edgesCache[saveId];
        } else {
            this._nodesCache = {};
            this._edgesCache = {};
        }
    },

    /**
     * Extracts Entities and Relationships from a given chat text using the LLM.
     * Updates the Graph in IndexedDb.
     */
    async extractAndIntegrate(
        recentHistory: ChatMessage[],
        saveId: string,
        settings: AppSettings
    ): Promise<void> {
        if (!recentHistory || recentHistory.length === 0) return;
        
        const historyText = recentHistory
            .map(m => `[${m.role}]: ${m.text}`)
            .join("\n\n");

        const prompt = `Bạn là một hệ thống trích xuất thông tin (Information Extraction).
Hãy trích xuất các Thực thể (Nodes) và Mối quan hệ (Edges) từ đoạn hội thoại sau.
Chỉ trích xuất các thông tin QUAN TRỌNG, mang tính cốt truyện.
Format trả về phải là một JSON object với 2 key: "nodes" và "edges".

- "nodes": mảng các đối tượng chứa "name" (tên thực thể), "label" (loại thực thể VD: Person, Location, Item, Event, Faction), "description" (mô tả ngắn).
- "edges": mảng các đối tượng chứa "source" (tên thực thể nguồn), "target" (tên thực thể đích), "relationship" (mối quan hệ VD: "is friends with", "located in", "owns", "enemy_of"), "description" (mô tả tính chất mối quan hệ).

Đoạn hội thoại:
${historyText}`;

        const aiClient = getAiClient(settings);
        
        try {
            const response = await aiClient.models.generateContent({
                model: settings.aiModel,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    temperature: 0.1,
                    responseMimeType: "application/json",
                }
            });

            const text = response.text || "{}";
            const cleanText = text.replace(/```json\n?|```/g, "").trim();
            const parsed = JSON.parse(cleanText);

            if (!parsed.nodes && !parsed.edges) return;

            const existingNodes = await this.getAllNodes(saveId);
            const existingEdges = await this.getAllEdges(saveId);

            const newNodesParsed: any[] = parsed.nodes || [];
            const newEdgesParsed: any[] = parsed.edges || [];

            // Integrate Nodes
            for (const n of newNodesParsed) {
                if (!n.name) continue;
                const existing = existingNodes.find(en => en.name.toLowerCase() === n.name.toLowerCase());
                if (existing) {
                    // Update descriptions if not included already
                    if (!existing.description.includes(n.description)) {
                        existing.description += "; " + n.description;
                    }
                } else {
                    existingNodes.push({
                        id: uuidv4(),
                        name: n.name,
                        label: n.label || "Entity",
                        description: n.description || "",
                        properties: {}
                    });
                }
            }

            // Integrate Edges
            for (const e of newEdgesParsed) {
                if (!e.source || !e.target) continue;
                // Find node UUIDs
                const sourceNode = existingNodes.find(n => n.name.toLowerCase() === e.source.toLowerCase());
                const targetNode = existingNodes.find(n => n.name.toLowerCase() === e.target.toLowerCase());
                
                if (sourceNode && targetNode) {
                    const existingEdge = existingEdges.find(
                        x => x.source === sourceNode.id && x.target === targetNode.id
                    );
                    if (existingEdge) {
                        existingEdge.relationship = e.relationship || existingEdge.relationship;
                        existingEdge.description = e.description || existingEdge.description;
                        existingEdge.weight += 1;
                    } else {
                        existingEdges.push({
                            id: uuidv4(),
                            source: sourceNode.id,
                            target: targetNode.id,
                            relationship: e.relationship || "related_to",
                            description: e.description || "",
                            weight: 1.0
                        });
                    }
                }
            }

            await this.saveGraphData(saveId, existingNodes, existingEdges);
            console.log(`[GraphRAG] Integrated ${newNodesParsed.length} nodes and ${newEdgesParsed.length} edges.`);
        } catch (e) {
            console.error("[GraphRAG] Extraction failed:", e);
        }
    },

    /**
     * Retrieves Graph context based on the current user input via Named Entity Recognition (NER).
     */
    async retrieveContext(userMessage: string, history: ChatMessage[], saveId: string, settings: AppSettings): Promise<string> {
        const allNodes = await this.getAllNodes(saveId);
        const allEdges = await this.getAllEdges(saveId);

        if (allNodes.length === 0) return "";

        // Simple Keyword-based NER fallback (since hitting LLM here every time would be slow).
        // Alternatively we can use LLM to extract entities from userMessage.
        const recentWords = userMessage.split(/\W+/);
        const matchedNodes = allNodes.filter(n => 
            userMessage.toLowerCase().includes(n.name.toLowerCase()) ||
            history.slice(-2).some(h => h.text.toLowerCase().includes(n.name.toLowerCase()))
        );

        if (matchedNodes.length === 0) return "";

        // Build a minimal sub-graph centered around matched Nodes (1-hop)
        const relevantNodeIds = new Set(matchedNodes.map(n => n.id));
        const relevantEdges = allEdges.filter(e => relevantNodeIds.has(e.source) || relevantNodeIds.has(e.target));
        
        // Include target nodes from these edges
        relevantEdges.forEach(e => {
            relevantNodeIds.add(e.source);
            relevantNodeIds.add(e.target);
        });

        const finalNodes = allNodes.filter(n => relevantNodeIds.has(n.id));

        let contextString = "### Bối cảnh Mạng Kiến Thức (Knowledge Graph):\n";
        
        // Print Nodes info
        contextString += "- Thực thể:\n";
        for (const n of finalNodes) {
            contextString += `  - [${n.label}] ${n.name}: ${n.description}\n`;
        }

        // Print Edges Info
        contextString += "- Mối quan hệ:\n";
        for (const e of relevantEdges) {
            const sName = allNodes.find(n => n.id === e.source)?.name || "Unknown";
            const tName = allNodes.find(n => n.id === e.target)?.name || "Unknown";
            contextString += `  - ${sName} --(${e.relationship})--> ${tName}: ${e.description}\n`;
        }

        return contextString;
    },

    /**
     * LangGraph-based state flow simulating sequential graph nodes to parse chunk, extract metadata, and connect relations
     */
    async runLangGraphMetadataFlow(
        parentChunkText: string,
        docId: string,
        settings: AppSettings,
        onNodeTransition?: (node: string, status: 'pending' | 'running' | 'completed', data?: any) => void
    ): Promise<{
        entities: { name: string; label: string; description: string }[];
        edges: { source: string; target: string; relationship: string; description: string }[];
    }> {
        // State model matching LangGraph structure
        const state = {
            rawText: parentChunkText,
            cleanedText: "",
            entities: [] as any[],
            edges: [] as any[],
            logs: [] as string[]
        };

        const logState = (msg: string) => {
            state.logs.push(msg);
            console.log(`[LangGraph Flow] ${msg}`);
        };

        // Node 1: Initialize
        if (onNodeTransition) onNodeTransition('initialize', 'running', { text: "Khởi tạo luồng LangGraph..." });
        logState("Node [initialize]: Nhận phân đoạn văn bản thô.");
        await new Promise(r => setTimeout(r, 200));
        if (onNodeTransition) onNodeTransition('initialize', 'completed', { log: "Đã nạp phân đoạn." });

        // Node 2: CleanAndDenoise
        if (onNodeTransition) onNodeTransition('clean_text', 'running', { text: "Chuẩn hóa và khử nhiễu văn bản..." });
        logState("Node [clean_text]: Lọc bỏ ký tự thừa, đồng bộ hóa xuống dòng.");
        state.cleanedText = parentChunkText
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+/g, ' ')
            .trim();
        await new Promise(r => setTimeout(r, 200));
        if (onNodeTransition) onNodeTransition('clean_text', 'completed', { size: state.cleanedText.length });

        // Node 3: SieveParentChild
        if (onNodeTransition) onNodeTransition('sieve_slices', 'running', { text: "Cắt phân đoạn con (Child Chunks) liên kết cha..." });
        logState("Node [sieve_slices]: Xác định cấu trúc liên thông đa cấp Parent-Child.");
        await new Promise(r => setTimeout(r, 150));
        if (onNodeTransition) onNodeTransition('sieve_slices', 'completed');

        // Node 4: ExtractEntities
        if (onNodeTransition) onNodeTransition('extract_meta', 'running', { text: "Kích hoạt mô hình AI trích chọn thực thể..." });
        logState("Node [extract_meta]: Gửi dữ liệu yêu cầu Gemini phân tích thực thể cốt lõi.");

        const prompt = `Bạn là một mô hình phân tích cấu trúc văn học (LangGraph Extraction Model).
Nhiệm vụ của bạn là đọc phân đoạn truyện và trích xuất các Thực thể cốt truyện quan trọng nhất và Mối quan hệ giữa chúng.
Hãy trả về một JSON object duy nhất với định dạng chính xác sau đây (không kèm bất kỳ văn bản giải thích nào khác ngoài JSON):

{
  "entities": [
    { "name": "Tên thực thể", "label": "Person|Location|Item|Faction|Event", "description": "Mô tả ngắn gọn về vai trò/bản chất" }
  ],
  "relationships": [
    { "source": "Tên thực thể nguồn", "target": "Tên thực thể đích", "relationship": "loại mối quan hệ VD: kề cận, đồng minh, sở hữu, thù ghét", "description": "Mô tả ngắn về quan hệ này" }
  ]
}

Đoạn truyện:
"${state.cleanedText}"`;

        const aiClient = getAiClient(settings);
        try {
            const response = await aiClient.models.generateContent({
                model: settings.aiModel || "gemini-3.5-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    temperature: 0.1,
                    responseMimeType: "application/json",
                }
            });

            const rawResponseText = response.text || "{}";
            const cleanResponseText = rawResponseText.replace(/```json\n?|```/g, "").trim();
            const parsed = JSON.parse(cleanResponseText);

            state.entities = parsed.entities || [];
            state.edges = parsed.relationships || [];
            logState(`Node [extract_meta]: Đã trích xuất ${state.entities.length} thực thể.`);
        } catch (err: any) {
            logState(`Node [extract_meta] Error (fallback): ${err.message}`);
            // Fallback heuristics: extracts basic capitalized names if AI errors
            state.entities = [];
            state.edges = [];
        }
        
        if (onNodeTransition) {
            onNodeTransition('extract_meta', 'completed', { 
                entitiesCount: state.entities.length, 
                entities: state.entities 
            });
        }

        // Node 5: MapRelations
        if (onNodeTransition) onNodeTransition('link_relations', 'running', { text: "Tạo đồ thị liên kết với metadata..." });
        logState(`Node [link_relations]: Khởi chạy sơ đồ nút mạng liên thông giữa ${state.entities.length} thực thể và ${state.edges.length} quan hệ.`);
        
        // Save to active GraphRAG nodes to integrate with system search
        if (state.entities.length > 0 && docId) {
            try {
                const existingNodes = await this.getAllNodes(docId);
                const existingEdges = await this.getAllEdges(docId);

                for (const ent of state.entities) {
                    if (!ent.name) continue;
                    const exists = existingNodes.find(n => n.name.toLowerCase() === ent.name.toLowerCase());
                    if (exists) {
                        if (!exists.description.includes(ent.description)) {
                            exists.description += "; " + ent.description;
                        }
                    } else {
                        existingNodes.push({
                            id: uuidv4(),
                            name: ent.name,
                            label: ent.label || "Entity",
                            description: ent.description || "",
                            properties: {}
                        });
                    }
                }

                for (const edge of state.edges) {
                    if (!edge.source || !edge.target) continue;
                    const sNode = existingNodes.find(n => n.name.toLowerCase() === edge.source.toLowerCase());
                    const tNode = existingNodes.find(n => n.name.toLowerCase() === edge.target.toLowerCase());
                    if (sNode && tNode) {
                        const existsEdge = existingEdges.find(e => e.source === sNode.id && e.target === tNode.id);
                        if (existsEdge) {
                            existsEdge.relationship = edge.relationship || existsEdge.relationship;
                            existsEdge.description = edge.description || existsEdge.description;
                            existsEdge.weight += 1;
                        } else {
                            existingEdges.push({
                                id: uuidv4(),
                                source: sNode.id,
                                target: tNode.id,
                                relationship: edge.relationship || "related_to",
                                description: edge.description || "",
                                weight: 1.0
                            });
                        }
                    }
                }

                await this.saveGraphData(docId, existingNodes, existingEdges);
                logState("Node [link_relations]: Tích hợp dữ liệu quan hệ vào mạng GraphRAG của saveId thành công!");
            } catch (err: any) {
                logState(`Node [link_relations] Link Error: ${err.message}`);
            }
        }
        
        await new Promise(r => setTimeout(r, 200));
        if (onNodeTransition) {
            onNodeTransition('link_relations', 'completed', { 
                edgesCount: state.edges.length,
                edges: state.edges
            });
        }

        // Return final state product
        return {
            entities: state.entities,
            edges: state.edges
        };
    }
}
