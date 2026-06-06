
import { Type } from "@google/genai";
import { getAiClient } from "../client";
import { buildWorldCreationPrompt, getWorldCreationSystemInstruction } from "./prompts";
import { AppSettings, Entity } from "../../../types";
import { extractJson } from '../../../utils/regex';

export const worldAiService = {
  // --- WORLD CREATION ASSISTANT (STRICT LOGIC) ---

  async generateFieldContent(
    category: 'player' | 'world' | 'entity', 
    field: string, 
    contextData: Record<string, unknown>, 
    modelName: string = 'gemini-3.1-pro-preview',
    currentInput?: string, // New Parameter for Enrich Mode
    settings?: AppSettings
  ): Promise<string> {
    try {
      // 1. Get System Instruction based on Mode (Create vs Enrich)
      const systemInstruction = getWorldCreationSystemInstruction(category, field, currentInput);

      // 2. Build User Prompt
      // Note: buildWorldCreationPrompt now handles the switching logic inside
      let userPrompt = "";

      if (currentInput && currentInput.trim().length > 0) {
          // Enrich Mode: Prompt is handled by buildWorldCreationPrompt entirely
          userPrompt = buildWorldCreationPrompt(field, contextData, currentInput);
      } else {
          // Create Mode: Keep existing context construction logic for better randomness
          if (category === 'player') {
             userPrompt = `CHARACTER INFORMATION:
- Name: ${contextData.name}
- Gender: ${contextData.gender}
- Age: ${contextData.age}
- World Genre: ${contextData.genre || "Optional"}

REQUIREMENT: Write content for field: "${field}".`;
          } else if (category === 'world') {
             userPrompt = `WORLD INFORMATION:
- Genre: ${contextData.genre}
- World Name: ${contextData.worldName || "Untitled"}

REQUIREMENT: Write content for field: "${field}".`;
          } else if (category === 'entity') {
             userPrompt = `ENTITY INFORMATION:
- Name: ${contextData.name}
- Type: ${contextData.type} (NPC/LOCATION/CUSTOM)
- World Genre: ${contextData.genre || "Optional"}

REQUIREMENT: Write content for field: "${field}".`;
          }
      }

      // 3. Call AI
      const aiClient = getAiClient(settings);
      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: currentInput ? 0.7 : 0.85, // Lower temp for enrichment to stay closer to source
          topK: 40,
          topP: 0.95,
        }
      });

      return response.text?.trim() || "";
    } catch {
      return "Không thể kết nối với AI. Vui lòng kiểm tra API Key hoặc thử lại sau.";
    }
  },

  async generateFullWorld(concept: string, modelName: string = 'gemini-3.1-pro-preview', settings?: AppSettings, existingData?: Record<string, unknown>, customSchema?: any): Promise<Record<string, unknown>> {
    let existingContext = "";
    if (existingData) {
        existingContext = `
[CURRENT DATA - MUST RESPECT AND NOT CHANGE]
${JSON.stringify(existingData, null, 2)}

IMPORTANT DIRECTIVES:
1. If a field in "CURRENT DATA" already has content, you MUST keep that content in the returned result.
2. You are only allowed to fill in empty fields (empty strings, empty arrays, or default values).
3. Use existing information to create new information that is logical and consistent.
4. If the 'entities' list already has data, keep them and add new entities until the required quantity is reached (total at least 4).
5. If the 'rules' list already has data, keep them and add new rules.
        `.trim();
    }

    let customSchemaPrompt = "";
    if (customSchema && customSchema.fields && customSchema.fields.length > 0) {
        customSchemaPrompt = `
Additionally, you MUST generate values for those custom fields of the main character (player) based on custom schema "${customSchema.name || 'Custom Schema'}" and fill them inside "player.customFields" exactly:
` + customSchema.fields.map((f: any) => `- label: "${f.label}", value: [Generate a highly creative, detailed value suitable for this attribute based on the story theme. Field description: ${f.description || f.placeholder || '(No description)'}]`).join('\n') + `
You must include ALL these labels in the "player.customFields" array. Each item must be {"label": string, "value": string}.
`;
    }

    const prompt = `
        You are an elite World Builder and a deeply meticulous scenario writer.
        Based on the core idea and knowledge text: "${concept}", build a complete RPG world setup.
        
        ${existingContext}
        ${customSchemaPrompt}

        CRITICAL DIRECTIVE FOR RAG / DATA FIDELITY (ANTI-LAZINESS LAW):
        If there is any "CORE KNOWLEDGE RETRIEVED (RAG DATA)" segment in the prompt:
        - You MUST analyze the ENTIRE retrieved lore with hyper-focused precision. Do not skip or gloss over any chapters or details.
        - DO NOT generate generic, lazy, or superficial fantasy names, placeholder texts, or single-sentence definitions.
        - Every single field generated (under World Setting AND Entities) must be exceptionally thick, dense with details, and written in highly evocative literary prose.
        - You MUST strictly extract, adapt, and weave authentic names of institutions, cults, techniques, historical conflicts, unique minerals, currencies, and canon characters directly referenced in the RAG text.
        - Every description for crucial fields (including setting, geography, history, factionsPower, culture, religionBeliefs, startingScenario) MUST have at least 6-10 long, information-packed sentences of detailed worldbuilding.
        - The generated entities (especially the Faction and Item) must directly trace back to real elements of the lore and contain elaborate backstories (at least 5 sentences each).
        
        Output requirements:
        1. Language: Vietnamese.
        2. Return in correct JSON format according to Schema.
        3. Content must be creative, logical, and have literary depth. No superficial high-level descriptions.
        4. World Name (worldName): MUST be unique, evocative, and deeply connected to the core idea and genre. Avoid generic names like "Thế giới huyền bí" or "Đại lục X". Use poetic, symbolic, or culturally relevant naming conventions.
        5. Build a detailed World Setting based on high-standard worldbuilding frameworks with these absolute fields:
           - Tên thế giới (worldName): Poetic/suggestive name from raw lore.
           - Tên Save (saveName): Name of this save file/world adventure.
           - Thể loại (genre): Setting genre.
           - Tông màu chủ đạo (mainTone): Dominated tone and atmosphere.
           - Bối cảnh (setting): General detailed description of starting world scenery and events.
           - Mốc thời gian mở đầu (openingTimeline): Era name / starting timestamp label.
           - Kịch bản mở đầu (startingScenario): Opening sequence narrative or event when they open eyes.
           - Quy luật thế giới (worldRules): Essential natural magic or operational rules.
           - Nhịp độ (pacing): Temporary tempo of the world story.
           - Địa lý thế giới (geography): Extreme terrains, lands, maps details.
           - Lịch sử thế giới (history): Detail timeline of history generations.
           - Văn hóa thế giới (culture): Sacred taboos, custom beliefs, rituals.
           - Kinh tế & Xã hội (economySociety): Trade routing, rarities, coinages, social structure.
           - Tôn giáo & Tín ngưỡng (religionBeliefs): Temple orders, dark or clean gods worshipped.
           - Thế lực phe phái (factionsPower): Empires, guilds, rebel covenants.
           - Đặc điểm thế giới (worldFeatures): Unique isolated features.
           - Kiểm soát logic & Loại trừ (logicControl): Strict physical parameters and narrative constraints.
           - Văn phong (writingStyle): Dominated narrative flavor suggestions.
           - Ngôi kể (narratorPov): Traditional pov tag.
        6. Include:
           - 1 Main Character (Player): Has a biography, personality, goals, appearance, voice and tone, and narrative role (Choose from: Protagonist, Antagonist, Mentor & Ally, Foil) related to the core idea.
           - World Setting (World): Name, genre, detailed background/history description of each layer, and starting scenario (startingScenario).
           - 4 Entities (Entities): Include at least 1 NPC, 1 Location, 1 Item, 1 Faction.
           - 3-5 World Rules (Rules): Special rules, taboos, or operating mechanisms of this world.
           - Initial Game Time (initialGameTime): Choose a starting timestamp (Year, Month, Day, Hour, Minute) reasonable for the world context.
        
        NOTE ON ENTITY STRUCTURE:
        - For NPC: Must fill in Name, Gender, Age, Personality (personalityKeywords + personalityDetail), Biography (background), Appearance, Introduction (intro), Narrative Role (narrativeRole).
        - For Location/Faction/Custom: Gender/age fields can be empty, but background and appearance must be detailed.
        - For Item: Fill in appearance, background, rarity, and price.
      `;

      const aiClient = getAiClient(settings);

      const playerProperties: Record<string, any> = {
        name: { type: Type.STRING, description: "Tên nhân vật chính" },
        gender: { type: Type.STRING, description: "Giới tính (Nam/Nữ/Khác)" },
        age: { type: Type.STRING, description: "Tuổi kham khổ hoặc sinh linh" },
        personality: { type: Type.STRING, description: "Tính cách nổi bật bản nguyên nhân vật" },
        background: { type: Type.STRING, description: "Tiểu sử gia thế và truyền kỳ gốc gác" },
        appearance: { type: Type.STRING, description: "Mô tả diện mạo nhân dạng và khí chất tôn nghiêm" },
        voiceAndTone: { type: Type.STRING, description: "Văn phong thuyết thoại và giọng nói phụ" },
        narrativeRole: { type: Type.STRING, description: "Vai trò trong đại thế cốt truyện", enum: ['Protagonist', 'Antagonist', 'Mentor & Ally', 'Foil'] },
        skills: { type: Type.STRING, description: "Kỹ năng đặc biệt cơ bản hoặc phép thuật sở tài" },
        goal: { type: Type.STRING, description: "Đại chí hướng hoặc mục tiêu vạn dặm" },
        coreValues: { type: Type.STRING, description: "2-3 giá trị cốt lõi bền vững bẩm sinh" },
        hardLimits: { type: Type.STRING, description: "Ranh giới hành vi nghiêm cấm của cá nhân" },
        definingEvents: { type: Type.STRING, description: "Biến cố hoặc bước ngoặt làm đổi thay nhân tính" },
        currentMood: { type: Type.STRING, description: "Trạng thái tâm sinh lý bối cảnh hiện tại" },
        relationshipTags: { type: Type.STRING, description: "Phong độ ứng tiếp với kẻ lạ/quan hệ thâm giao" },
        strengths: { type: Type.STRING, description: "Điểm siêu cường hoặc sở trường đặc thù" },
        weaknesses: { type: Type.STRING, description: "Điểm yếu thực tế chí tử hoặc giới hạn thực tại" },
        contradictions: { type: Type.STRING, description: "Mâu thuẫn tâm lý nội tại đặc trưng" },
        failureMode: { type: Type.STRING, description: "Cách thức nhân vật hành xử khi lâm thế sụp đổ/khốn cùng" }
      };

      const playerRequired = [
        'name', 'gender', 'age', 'personality', 'background', 'appearance', 'voiceAndTone', 'narrativeRole', 'skills', 'goal',
        'coreValues', 'hardLimits', 'definingEvents', 'currentMood', 'relationshipTags', 'strengths', 'weaknesses', 'contradictions', 'failureMode'
      ];

      if (customSchema && customSchema.fields && customSchema.fields.length > 0) {
        playerProperties.customFields = {
          type: Type.ARRAY,
          description: "Danh sách 4-8 thuộc tính sơ đồ mở rộng khớp chính xác với nhãn của Schema thiết lập.",
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              value: { type: Type.STRING }
            },
            required: ['label', 'value']
          }
        };
        playerProperties.customSchemaId = {
          type: Type.STRING,
          description: "ID duy nhất của Custom Schema được chọn, khớp chính xác: " + customSchema.id
        };
        playerRequired.push('customFields');
        playerRequired.push('customSchemaId');
      }

      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              player: {
                type: Type.OBJECT,
                properties: playerProperties,
                required: playerRequired
              },
              world: {
                type: Type.OBJECT,
                properties: {
                  worldName: { type: Type.STRING, description: "Tên thế giới" },
                  saveName: { type: Type.STRING, description: "Tên Save của bối cảnh phát triển" },
                  genre: { type: Type.STRING, description: "Thể loại bối cảnh" },
                  mainTone: { type: Type.STRING, description: "Tông màu/không khí bối cảnh chủ đạo cực kỳ hấp dẫn" },
                  setting: { type: Type.STRING, description: "Mô tả bối cảnh thế giới chi tiết (BỐI CẢNH)" },
                  openingTimeline: { type: Type.STRING, description: "Mốc thời gian mở đầu đầy chất sử thi" },
                  startingScenario: { type: Type.STRING, description: "Kịch bản mở đầu kịch tính, lôi cuốn" },
                  worldRules: { type: Type.STRING, description: "Quy luật vận hành, thiên nhiên kì dị pháp tắc lực lượng ma pháp hoặc cấm kỵ cốt tử" },
                  pacing: { type: Type.STRING, description: "Nhịp độ cốt truyện của bối cảnh (Ví dụ: Chậm rãi thâm nhập, kịch tính dồn dập...)" },
                  geography: { type: Type.STRING, description: "Địa lý sông núi cõi bờ bờ bể lãnh địa" },
                  history: { type: Type.STRING, description: "Lịch sử biên niên lớn sâu sắc" },
                  culture: { type: Type.STRING, description: "Văn hóa thói quen cư dân phong tục" },
                  economySociety: { type: Type.STRING, description: "Kinh tế hàng hóa hiếm, tiền tệ trao đổi" },
                  religionBeliefs: { type: Type.STRING, description: "Tôn giáo, ma giáo sùng bái hoặc thần đình quang minh" },
                  factionsPower: { type: Type.STRING, description: "Thế lực phe phái cự phách vương quốc" },
                  worldFeatures: { type: Type.STRING, description: "Đặc điểm thế giới độc lập, kỳ thuật" },
                  logicControl: { type: Type.STRING, description: "Kiểm soát logic vĩ mô chặt chẽ và loại trừ các yếu tố phi thực thần thông" },
                  writingStyle: { type: Type.STRING, description: "Văn phong dẫn dụ (Sâu mượt, giàu từ ngữ cổ phác...)" },
                  narratorPov: { type: Type.STRING, description: "Ngôi kể chuyện phù hợp của bối cảnh thám hiểm" },
                  initialGameTime: {
                    type: Type.OBJECT,
                    description: "Thời gian khởi đầu của thế giới",
                    properties: {
                      year: { type: Type.INTEGER },
                      month: { type: Type.INTEGER },
                      day: { type: Type.INTEGER },
                      hour: { type: Type.INTEGER },
                      minute: { type: Type.INTEGER }
                    },
                    required: ['year', 'month', 'day', 'hour', 'minute']
                  }
                },
                required: [
                  'worldName', 'saveName', 'genre', 'mainTone', 'setting', 'openingTimeline', 'startingScenario',
                  'worldRules', 'pacing', 'geography', 'history', 'culture', 'economySociety', 'religionBeliefs',
                  'factionsPower', 'worldFeatures', 'logicControl', 'writingStyle', 'narratorPov', 'initialGameTime'
                ]
              },
              rules: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Danh sách các quy tắc thế giới"
              },
              entities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['NPC', 'LOCATION', 'ITEM', 'FACTION', 'CUSTOM'] },
                    name: { type: Type.STRING },
                    // Detailed fields for generation
                    gender: { type: Type.STRING, nullable: true },
                    age: { type: Type.STRING, nullable: true },
                    personalityKeywords: { type: Type.STRING, description: "Từ khóa tính cách (Vui vẻ, Lạnh lùng...)" },
                    personalityDetail: { type: Type.STRING, description: "Diễn giải tính cách chi tiết" },
                    appearance: { type: Type.STRING, description: "Mô tả ngoại hình/diện mạo vật phẩm/địa thế" },
                    background: { type: Type.STRING, description: "Tiểu sử/Lịch sử hình thành/Nguồn gốc" },
                    intro: { type: Type.STRING, description: "Lời chào hoặc mô tả mở đầu" },
                    customType: { type: Type.STRING, nullable: true },
                    rarity: { type: Type.STRING, nullable: true, description: "Độ hiếm cho ITEM (Thường, Hiếm, Cổ vật, Sử thi)" },
                    price: { type: Type.STRING, nullable: true, description: "Giá giao thương cho ITEM" },
                  },
                  required: ['type', 'name', 'background', 'appearance']
                }
              }
            },
            required: ['player', 'world', 'entities']
          },
          temperature: 0.9
        }
      });

      if (response.text) {
        const data = extractJson<any>(response.text);
        if (!data) throw new Error("Cannot parse JSON from model response.");
        
        // Extract and map GameTime
        if (data.world && data.world.initialGameTime) {
            data.gameTime = data.world.initialGameTime;
            delete data.world.initialGameTime;
        }

        // Dynamically compile layered information into a high-standard World Context Markdown
        if (data.world) {
           const w = data.world;
           const parts: string[] = [];
           if (w.worldName) {
               parts.push(`# BỐI CẢNH: ${w.worldName.toUpperCase()}`);
               if (w.genre) {
                   parts.push(`*Thể loại: ${w.genre}*`);
               }
           }
           
           if (w.mainTone) parts.push(`## 🎨 TÔNG MÀU & KHÔNG KHÍ CHỦ ĐẠO\n${w.mainTone}`);
           if (w.setting) parts.push(`## 📌 BỐI CẢNH THẾ GIỚI\n${w.setting}`);
           if (w.openingTimeline) parts.push(`## ⏳ MỐC THỜI GIAN MỞ ĐẦU\n${w.openingTimeline}`);
           if (w.startingScenario) parts.push(`## 🎭 KỊCH BẢN KHỞI HÀNH MỞ ĐẦU\n${w.startingScenario}`);
           if (w.worldRules) parts.push(`## 🔮 QUY LUẬT VÀ PHÁP TẮC CHI PHỐI\n${w.worldRules}`);
           if (w.pacing) parts.push(`## ⚡ NHỊP ĐỘ PHÁT TRIỂN\n${w.pacing}`);
           if (w.geography) parts.push(`## 🗺️ ĐỊA LÝ & THỔ NHƯỠNG CÕI BỜ\n${w.geography}`);
           if (w.history) parts.push(`## 📖 THỜI KỲ BIÊN NIÊN SỬ\n${w.history}`);
           if (w.culture) parts.push(`## 🎭 VĂN HÓA, PHONG TỤC & CẤM KỴ\n${w.culture}`);
           if (w.economySociety) parts.push(`## 🪙 KINH TẾ & GIAO THƯƠNG PHÂN CẤP\n${w.economySociety}`);
           if (w.religionBeliefs) parts.push(`## 📿 TÔN GIÁO, ĐỨC TIN & THỜ CỔ THẦN\n${w.religionBeliefs}`);
           if (w.factionsPower) parts.push(`## 🛡️ THẾ LỰC PHE PHÁI BÁ QUYỀN\n${w.factionsPower}`);
           if (w.worldFeatures) parts.push(`## 🕯️ BIỆT LẬP ĐẶC ĐIỂM\n${w.worldFeatures}`);
           if (w.logicControl) parts.push(`## ⚙️ KIỂM SOÁT LOGIC VÀ LOẠI TRỪ NGHIÊM NGẶT\n${w.logicControl}`);
           if (w.writingStyle) parts.push(`## ✒️ VĂN PHONG PHONG VỊ THỂ HIỆN\n${w.writingStyle}`);
           if (w.narratorPov) parts.push(`## 🗣️ NGÔI KỂ GIẢI THUYẾT\n${w.narratorPov}`);
           
           w.context = parts.join('\n\n');
        }

        // Post-processing entities to match App Interface
        if (data.entities && Array.isArray(data.entities)) {
            data.entities = data.entities.map((ent: Record<string, unknown>, idx: number) => {
                // Merge details into the main 'description' field for the App
                let fullDesc: string;
                
                const entData = ent as Record<string, unknown>;
                const type = entData.type as string;
                const gender = entData.gender as string;
                const age = entData.age as string;
                const appearance = entData.appearance as string;
                const background = entData.background as string;
                const intro = entData.intro as string;
                const personalityKeywords = entData.personalityKeywords as string;
                const personalityDetail = entData.personalityDetail as string;
                const id = entData.id as string;
                const name = entData.name as string;
                const customType = entData.customType as string;
                const rarity = entData.rarity as string;
                const price = entData.price as string;

                if (type === 'NPC') {
                    fullDesc = `[Giới tính: ${gender || '?'}] [Tuổi: ${age || '?'}]\n`;
                    fullDesc += `\n>> NGOẠI HÌNH:\n${appearance}\n`;
                    fullDesc += `\n>> TIỂU SỬ:\n${background}\n`;
                    fullDesc += `\n>> GIỚI THIỆU:\n"${intro || '...'}"`;
                } else if (type === 'ITEM') {
                    fullDesc = `**Độ hiếm:** ${rarity || 'Thường'} | **Giá trị:** ${price || '0 Vàng'}\n\n`;
                    fullDesc += `>> DIỆN MẠO & ĐẶC ĐIỂM:\n${appearance}\n`;
                    fullDesc += `\n>> NGUỒN GỐC & TÁC DỤNG:\n${background}`;
                } else if (type === 'FACTION') {
                    fullDesc = `>> CƠ CẤU & TÔN CHỈ:\n${background}\n`;
                    fullDesc += `\n>> PHẠM VI CAI TRỊ & THẾ LỰC:\n${appearance}`;
                } else {
                    fullDesc = `${background}\n\n(Mô tả: ${appearance})`;
                }

                // Format Personality
                const fullPersonality = personalityKeywords 
                    ? `${personalityKeywords} - ${personalityDetail || ''}` 
                    : personalityDetail || "";

                return {
                    id: id || `ai-ent-${Date.now()}-${idx}`,
                    type: type,
                    name: name,
                    description: fullDesc, // App uses this
                    personality: fullPersonality, // App uses this for NPC
                    customType: customType,
                    rarity: rarity,
                    price: price
                } as Entity;
            });
        }

        // Setup config rules
        if (data.rules) {
            data.config = { rules: data.rules };
        }

        return data;
      }
      throw new Error("AI trả về phản hồi rỗng.");
  },

  async generateInitialTime(genre: string, context: string, modelName: string = 'gemini-3.1-pro-preview', settings?: AppSettings): Promise<Record<string, unknown>> {
    const prompt = `Based on world genre: "${genre}" and context: "${context}", choose a reasonable starting timestamp (Year, Month, Day, Hour, Minute). 
    Return in correct JSON format: {"year": number, "month": number, "day": number, "hour": number, "minute": number}.
    Example: Modern is 2026, Xianxia could be 1 or 9999, etc.`;

    const aiClient = getAiClient(settings);
    const response = await aiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            year: { type: Type.INTEGER },
            month: { type: Type.INTEGER },
            day: { type: Type.INTEGER },
            hour: { type: Type.INTEGER },
            minute: { type: Type.INTEGER }
          },
          required: ['year', 'month', 'day', 'hour', 'minute']
        }
      }
    });

    if (response.text) {
      const parsed = extractJson<Record<string, unknown>>(response.text);
      if (parsed) return parsed;
      throw new Error("Cannot parse JSON from AI response.");
    }
    throw new Error("AI không thể tạo thời gian.");
  },

  async generateCharacterSheetFromKnowledge(
    knowledgeData: string,
    modelName: string = 'gemini-3.1-pro-preview',
    settings?: AppSettings
  ): Promise<Partial<import('../../../types').CharacterSheet>> {
    const prompt = `Bạn là một chuyên gia phân tích nhân vật (Character Analyst) và sáng tác Lore Truyện.
Nhiệm vụ của bạn là đọc Dữ Liệu Gốc (Knowledge/Lore/Wiki) sau đây và trích xuất/tổng hợp thành một bảng Character Sheet tiêu chuẩn.
Nếu thông tin không có sẵn trong dữ liệu gốc, hãy TỰ SUY LUẬN và SÁNG TẠO sao cho phù hợp và logic nhất với bối cảnh và văn phong của dữ liệu đó.

DỮ LIỆU GỐC:
"""
${knowledgeData}
"""

YÊU CẦU:
Trả về phản hồi dưới định dạng JSON theo đúng cấu trúc sau:
- name: Tên nhân vật.
- gender: Giới tính (Nam/Nữ/Vô tính...).
- age: Định lượng tuổi.
- appearance: Ngoại hình rành mạch.
- voiceAndTone: Giọng nói và Văn phong (khi nhân vật nói chuyện).
- personality: Tính cách chung.
- coreValues: Giá trị cốt lõi (điều không thể bẻ gãy).
- hardLimits: Giới hạn chịu đựng / Không bao giờ làm gì.
- definingEvents: Sự kiện định hình quá khứ.
- background: Tiểu sử đầy đủ.
- currentMood: Trạng thái nội tâm / Mood hiện tại.
- relationshipTags: Quan hệ (Bạn bè/Thù địch...).
- strengths: Điểm mạnh.
- weaknesses: Điểm yếu.
- narrativeRole: Vai trò trong câu chuyện.
- contradictions: Mâu thuẫn nội tâm.
- failureMode: Hành vi khi thất bại/hoảng loạn.
- exampleMessages: Ví dụ 3-4 lời thoại tiêu biểu của nhân vật (Mỗi dòng một câu).`;

    const aiClient = getAiClient(settings);
    const response = await aiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            gender: { type: Type.STRING },
            age: { type: Type.STRING },
            appearance: { type: Type.STRING },
            voiceAndTone: { type: Type.STRING },
            personality: { type: Type.STRING },
            coreValues: { type: Type.STRING },
            hardLimits: { type: Type.STRING },
            definingEvents: { type: Type.STRING },
            background: { type: Type.STRING },
            currentMood: { type: Type.STRING },
            relationshipTags: { type: Type.STRING },
            strengths: { type: Type.STRING },
            weaknesses: { type: Type.STRING },
            narrativeRole: { type: Type.STRING },
            contradictions: { type: Type.STRING },
            failureMode: { type: Type.STRING },
            exampleMessages: { type: Type.STRING },
          }
        },
        temperature: 0.7
      }
    });

    if (response.text) {
      const parsed = extractJson<Partial<import('../../../types').CharacterSheet>>(response.text);
      if (parsed) return parsed;
      throw new Error("Không thể parse JSON từ phản hồi AI.");
    }
    throw new Error("AI không phản hồi.");
  },

  // --- ENCYCLOPEDIA REMAKE GENERATION SUITE ---
  async generateEncyclopediaEntry(
    title: string,
    category: string,
    promptSuggestion: string,
    modelName: string = 'gemini-3.5-flash',
    settings?: AppSettings
  ): Promise<string> {
    const prompt = `Bạn là một chuyên gia sáng tạo thế giới (World Builder).
Hãy viết một bài viết bối cảnh (Lore/Encyclopedia Entry) chi tiết về đề tài sau đây:
- Tiêu đề: "${title}"
- Danh mục: "${category}" (vd: character, location, faction, item, event, law, world...)
- Gợi ý ý tưởng: "${promptSuggestion}"

YÊU CẦU:
1. Viết bằng tiếng Việt, mạch lạc, lôi cuốn, có chiều sâu văn học cao.
2. Định dạng bài viết đẹp đẽ, sử dụng Markdown hợp lý (tiêu đề phụ, danh sách cộc, các đoạn trích quote).
3. Đan xen các yếu tố bí ẩn, lịch sử và mô tả chi tiết đặc trưng (ngũ giác, truyền thuyết...).
Không dùng các lời dẫn mở/kết thúc kiểu "Dưới đây là...", hãy đi thẳng vào văn phong bài viết.`;

    const aiClient = getAiClient(settings);
    const response = await aiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.8,
        topP: 0.95
      }
    });
    return response.text?.trim() || "";
  },

  async refineEncyclopediaEntry(
    text: string,
    action: "condense" | "expand" | "format",
    modelName: string = 'gemini-3.5-flash',
    settings?: AppSettings
  ): Promise<string> {
    let modeInstruction = "";
    if (action === "condense") {
      modeInstruction = "Hãy RÚT GỌN bài viết bối cảnh dưới đây để tối ưu hóa dung lượng (token budget). Giữ lại các ý chính quan trọng, thông tin cốt lõi, danh xưng và thuộc tính, nhưng lược bớt các mô tả rườm rà. Đảm bảo súc tích nhưng đầy đủ ý nghĩa bối cảnh.";
    } else if (action === "expand") {
      modeInstruction = "Hãy ĐÀO SÂU và MỞ RỘNG bài viết dưới đây. Thêm chi tiết về nguồn gốc lịch sử, các tác động chính, những bí mật ẩn giấu, mô tả giác quan chân thực hơn, hoặc các mối tương quan chính trị/xã hội liên quan. Làm cho bài viết cực kỳ chi tiết hoành tráng.";
    } else {
      modeInstruction = "Hãy ĐỊNH DẠNG lại văn bản dưới đây để trông chuyên nghiệp hơn bằng Markdown. Sử dụng tiêu đề, khối trích dẫn (blockquote), danh sách gạch đầu dòng (bullet points) và chữ in đậm cho các thuật ngữ quan trọng một cách cân đối, chuẩn mực.";
    }

    const prompt = `${modeInstruction}

NỘI DUNG HIỆN TẠI:
"""
${text}
"""

YÊU CẦU:
Trả về phiên bản văn bản mới đã qua xử lý. Không ghi lời mở đầu hay kết luận kiểu "Dưới đây là...", hãy đi thẳng vào nội dung mới.`;

    const aiClient = getAiClient(settings);
    const response = await aiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.7
      }
    });
    return response.text?.trim() || "";
  },

  async extractTriggerKeywords(
    text: string,
    modelName: string = 'gemini-3.5-flash',
    settings?: AppSettings
  ): Promise<string[]> {
    const prompt = `Hãy phân tích bài viết Lore dưới đây và gợi ý tối đa 5-6 từ khóa kích hoạt (trigger keywords) tốt nhất cho tính năng Lorebook/Encyclopedia.
Từ khóa kích hoạt nên là những tên riêng, thuật ngữ đặc trưng, danh từ quan trọng xuất hiện trực tiếp hoặc thường xuyên được tham chiếu trong bối cảnh này.

VĂN BẢN LORE:
"""
${text}
"""

YÊU CẦU:
Trả về một mảng JSON các từ khóa kích hoạt, ví dụ: ["Aria", "Eldoria", "Pháp thuật tinh tú"]. Trả về đúng định dạng JSON và không dùng khối nhận xét nào khác.`;

    const aiClient = getAiClient(settings);
    const response = await aiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        temperature: 0.3
      }
    });

    if (response.text) {
      const parsed = extractJson<string[]>(response.text);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  },

  async autoExtractRpgAttributes(
    text: string,
    category: string,
    modelName: string = 'gemini-3.5-flash',
    settings?: AppSettings
  ): Promise<Record<string, string>> {
    const prompt = `Phân tích văn bản lore dưới đây và trích xuất/sáng tạo các thuộc tính RPG khảo tả quan trọng nhất thích hợp cho danh mục: "${category}".
Nếu thông tin không có sẵn trong văn bản, hãy tự suy luận một cách sáng tạo cho phù hợp nhất!

DANH MỤC THUỘC TÍNH YÊU CẦU TRẢ VỀ THEO TỪNG LOẠI:
1. Nếu danh mục là "location" (Địa điểm):
   - climate: Khí hậu / Thời tiết đặc trưng
   - ruler: Người trị vì / Chủ quản địa giới
   - population: Dân tộc / Số lượng dân số (mô phỏng)
   - danger_level: Mức độ nguy hiểm (S, A, B, C, D hoặc an toàn)
   - points_of_interest: Các địa danh nổi tiếng bên trong địa điểm này
2. Nếu danh mục là "faction" (Thế lực):
   - alignment: Xu hướng hành vi (vd: Lawful Good, Chaotic Evil...)
   - leader: Thủ lĩnh cao nhất
   - influence: Sức mạnh thế lực (Cực cao, Cao, Vừa, Nhỏ)
   - hq: Đại bản doanh / Căn cứ chính
   - allies_enemies: Đồng minh & Kẻ thù chính
3. Nếu danh mục là "item" (Vật phẩm):
   - rarity: Độ hiếm (Thường, Hiếm, Sử thi, Truyền thuyết)
   - item_type: Phân loại cơ bản (Vũ khí, Thần khí, Độc dược, Sách cổ, v.v.)
   - abilities: Khả năng chủ động hoặc nội tại kỳ dị
   - value_copper: Giá trị quy đổi hoặc tấc năng lượng
4. Nếu danh mục là "event" (Sự kiện):
   - timeline_date: Thời gian / niên đại diễn ra biến cố
   - characters_involved: Các nhân vật then chốt góp mặt
   - consequences: Hậu quả / tác động lịch sử lâu dài
5. Cho bất kỳ danh mục nào khác:
   - summary: Bản tóm tắt súc tích trong 1-2 câu
   - origin: Nguồn gốc khởi sinh

VĂN BẢN LORE:
"""
${text}
"""

YÊU CẦU:
Trả về một đối tượng JSON phẳng dạng { key: value } với các cặp khóa thích hợp trên. Giá trị dưới dạng chuỗi ngắn gọn hữu ích. Chỉ trả về JSON không chứa văn bản khác.`;

    const aiClient = getAiClient(settings);
    const response = await aiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.4
      }
    });

    if (response.text) {
      const parsed = extractJson<Record<string, string>>(response.text);
      if (parsed) return parsed;
    }
    return {};
  },

  async extractCharactersFromKnowledge(
    knowledgeText: string,
    title: string,
    modelName: string = 'gemini-3.5-flash',
    settings?: AppSettings
  ): Promise<any[]> {
    const prompt = `Bạn là một chuyên gia nghiên cứu cốt truyện tối cao có tư duy phân tích hệ thống sâu sắc. Hãy đọc TOÀN BỘ tệp tri thức nguyên tác dưới đây của tác phẩm "${title}".

MỤC TIÊU CỰC KỲ QUAN TRỌNG:
Tránh sự hời hợt và sơ sài của AI thông thường. Bạn phải đọc kỹ mọi chương, phân mảnh tri thức để nhận diện và phục dựng danh sách nhân vật chuẩn xác nhất. 
Hãy trích xuất danh sách gồm từ 8 đến 16 nhân vật chính, phụ, phản diện nổi bật nhất xuất hiện trong bối cảnh này.

YÊU CẦU ĐỘ CHI TIẾT TỐI ĐA (MANDATORY DETAIL):
- name: Tên nhân vật đầy đủ phù hợp nguyên tác, kèm biệt danh hoặc danh xưng khác nếu có.
- gender: Giới tính (Nam/Nữ/Khác).
- age: Tuổi hoặc giai đoạn tuổi (gốc tích niên kỷ rõ ràng, ví dụ "Năm thứ 3, tu vi Đấu Giả", "Khoảng 1500 tuổi").
- personality: Miêu tả tính cách vô cùng sâu sắc, chỉ rõ mâu thuẫn nội tâm, thói quen hành vi, biểu cảm đặc thù. Không viết một vài từ sáo rỗng.
- background: Viết một tiểu sử cực kỳ chi tiết (ít nhất 3-4 câu dài), kể rõ xuất thân, những biến cố lịch sử đã trải qua, các mối quan hệ ân oán tình thù và vị thế hiện tại trong bối cảnh tác phẩm.
- appearance: Mô tả ngoại hình sống động, y phục kỳ vĩ, thần thái, khí chất độc bản, các vết sẹo hoặc vật dụng bất ly thân.
- skills: Kể tên và diễn giải chi tiết tất cả các chiêu thức, hệ thống võ học ma pháp, cấm thuật tối cao, đan dược, vũ khí hoặc bí bảo sở trường. Chỉ rõ đặc trưng của từng tuyệt kỹ này.
- goal: Chí hướng cực đại, tham vọng, động cơ sâu kín thúc đẩy nhân vật hành động.
- role: Chọn chính xác vai trò cốt truyện (Protagonist, Antagonist, Mentor, Ally, Foil) phù hợp với nguyên tác.

VĂN BẢN TRI THỨC LORE:
"""
${knowledgeText.slice(0, 500000)}
"""

YÊU CẦU TRẢ VỀ:
Một mảng JSON gồm các đối tượng có cấu trúc đúng như trên. Trả về JSON hợp lệ chính xác.`;

    const aiClient = getAiClient(settings);
    const response = await aiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Danh sách các nhân vật trích xuất từ tệp tri thức",
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
        },
        temperature: 0.2
      }
    });

    if (response.text) {
      const parsed = extractJson<any[]>(response.text);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  },

  async generateOcCharacterFromKnowledge(
    knowledgeText: string,
    ocIdea: string,
    modelName: string = 'gemini-3.5-flash',
    settings?: AppSettings
  ): Promise<any> {
    const prompt = `Bạn là một nhà thiết kế nhân vật RPG nghệ thuật lỗi lạc.
Nhiệm vụ của bạn là dựa vào ý tưởng sơ bộ về nhân vật OC: "${ocIdea || 'Một nhân vật ẩn dật kỳ tài'}" và thế giới nguyên tác định hình sâu sắc trong Tệp Tri Thức sau:

VĂN BẢN TRI THỨC LORE:
"""
${knowledgeText.slice(0, 300000)}
"""

Hãy SÁNG TẠO và sinh cho nhân vật OC một bộ hồ sơ cực kỳ sắc nét, giàu tính văn học và ăn khớp 100% với các quy luật thế giới, thế lực phe phái, hệ thống sức mạnh trong nguyên tác. Tuyệt đối tránh viết hời hợt hay chung chung!

YÊU CẦU CHI TIẾT:
- name: Tên đầy đủ, hay, giàu ý nghĩa văn hóa xã hội bối cảnh.
- gender: Giới tính (Nam/Nữ/Khác).
- age: Tuổi tác rõ ràng, có sự logic với tu vi/công pháp.
- personality: Miêu tả tâm lý sống động, các nét cá tính khác biệt, cách ứng xử nổi bật.
- background: Tiểu sử sinh động dài (ít nhất 4-5 câu), nêu rõ thời niên thiếu, cơ duyên gặp gỡ, vị trí trong phe phái, sự gắn kết chặt chẽ với những nhân vật chính trong nguyên tác thế giới.
- appearance: Chi tiết diện mạo, y phục mang tính biểu tượng, khí chất đè nén hay linh hoạt, các thần khí đính kèm.
- skills: Bộ kỹ năng chi tiết có tên chiêu thức đỉnh cao, mô tả kỹ thuật thi triển, tác dụng phụ và năng lượng tiêu hao phù hợp thế giới.
- goal: Ước vọng thâm sâu, lý do nhân vật quyết định nhập thế.
- voiceAndTone: Phong cách đối thoại chi tiết, chất giọng, thói quen ngôn từ đặc trưng.

Trả về đúng JSON theo cấu trúc trên. Không kèm giải thích.`;

    const aiClient = getAiClient(settings);
    const response = await aiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
            voiceAndTone: { type: Type.STRING }
          },
          required: ["name", "gender", "age", "personality", "background", "appearance", "skills", "goal", "voiceAndTone"]
        },
        temperature: 0.8
      }
    });

    if (response.text) {
      const parsed = extractJson<any>(response.text);
      if (parsed) return parsed;
    }
    return {};
  },

  async extractTimelineFromKnowledge(
    knowledgeText: string,
    title: string,
    modelName: string = 'gemini-3.5-flash',
    settings?: AppSettings
  ): Promise<Array<{ title: string; period: string; description: string }>> {
    // Prefer higher reasoning models if configured for ultimate deep extraction
    const selectedModel = settings?.backgroundAiModel || modelName;

    const prompt = `Bạn là một nhà chép sử, thủ thư lưu trữ và học giả biên kịch đồng nhân vĩ đại bậc nhất thế giới.
Hãy đọc kỹ tệp tri thức nguyên tác dưới đây của tác phẩm "${title}".

BẢN CHỈ THỊ BIÊN NIÊN SỬ KHỔNG LỒ (EXHAUSTIVE NOVEL CHROMATIC TIMELINE DIRECTIVE):
Sự hời hợt, biếng nhác phác họa qua loa vài mốc sơ sài của AI thông thường là điều CẤM KỴ TUYỆT ĐỐI. Nó sẽ hủy hoại dòng thời gian của trò chơi.
Nhiệm vụ của bạn là đi sâu quét toàn bộ tệp văn bản từ dòng đầu tiên đến dòng cuối cùng của tài liệu để trích xuất một Biên niên sử vạn dặm đầy đủ, đồ sộ và cực kỳ hoàn chỉnh cấu trúc truyện, gồm tối thiểu từ 25 đến 40 mốc sự kiện/timeline tuyến tính liên tiếp.
Các mốc này không được bỏ trống bất kỳ đại chương (arcs), bước ngoặt, trận chiến oanh liệt hay bước phát triển cốt lõi nào của nguyên tác tác phẩm.

Mỗi mốc sự kiện bắt buộc phải có đầy đủ cấu trúc:
- title: Tiêu đề mốc sự kiện oai hùng, lột tả thần khí vũ trụ nguyên tác đồng nhân (Ví dụ: "Hẹn Ước Ba Năm - Hỏa Thiêu Vân Lam Tông", "Cửu U Địa Minh Mãng Tộc - Huyết Tế Đan Hải", "Hồn Điện Truy Sát - Đoạt Hồn Thần Sư Tiêu Chiến").
- period: Mốc thời gian niên hiệu bối cảnh cụ thể, độ tuổi nhân vật chính, hoặc giai đoạn thứ tự tuyến tính rõ ràng (Ví dụ: "Kỷ Nguyên Đấu Đế thứ 12", "Sau đại chiến Tiêu gia năm thứ 3", "Lăng Vân Các Kỳ thi").
- description: Viết một đoạn văn tóm tắt cốt lõi vô cùng đầy đặn và cực kỳ chi tiết lực lượng (ít nhất 5-10 câu dài, tuyệt đối không được viết chung chung). Liệt kê cụ thể:
  + Những nhân vật nào tham chiến/xuất hiện trực tiếp.
  + Diễn biến xung đột thâm trầm, hành động thực tế là gì.
  + Cái giá phải trả, cái kết thắng thua của sự kiện là gì.
  + Sức ảnh hưởng định hình lại trật tự thế giới, tu vi vũ khí của nhân vật chính ra sao.

VĂN BẢN TRI THỨC LORE NGUYÊN TÁC (QUÉT TOÀN DIỆN):
"""
${knowledgeText.slice(0, 800000)}
"""

YÊU CẦU ĐẦU RA SẤM SÉT (MANDATORY OUTPUT FORMAT):
Bắt buộc trả về một MẢNG JSON các đối tượng [{ "title": "...", "period": "...", "description": "..." }]. Không chứa bất kỳ câu giải thích thừa thãi nào ngoài JSON.`;

    const aiClient = getAiClient(settings);
    const response = await aiClient.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Danh sách các mốc timeline trích xuất theo thời gian tuyến tính và cực kỳ chi tiết",
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              period: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["title", "period", "description"]
          }
        },
        temperature: 0.15
      }
    });

    if (response.text) {
      const parsed = extractJson<Array<{ title: string; period: string; description: string }>>(response.text);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  },

  async extractRulesFromKnowledge(
    knowledgeText: string,
    worldContext: string,
    modelName: string = 'gemini-3.5-flash',
    settings?: AppSettings
  ): Promise<string[]> {
    const prompt = `Bạn là một chuyên gia thiết kế cơ chế game và luật pháp thế giới giả lập tối cao (AI Rules Engine Architect).
Nhiệm vụ của bạn là phân tích sâu cấu trúc lý thuyết của tài liệu tri thức (Lore/Knowledge) và bối cảnh thế giới hiện tại dưới đây, sau đó xây dựng từ 8 đến 15 LUẬT AI TỐI CAO (Advanced AI Rules - Pháp luật bắt buộc của trò chơi).

MỤC TIÊU CỦA LUẬT AI:
- Ràng buộc trực hệ chỉ thị cưỡng chế vào nền tảng tư duy bối cảnh của LLM. Tránh sự lấp liếm hời hợt của mô hình AI khi kể chuyện, ép AI phải tuyệt đối tôn trọng các chế tài vận hành của thế giới đồng nhân.
- Ngăn chặn triệt để tình trạng AI tự ý tạo ra các cheat ẩn, ma thuật vô hạn, phục hồi tức thời không trả giá, bỏ qua các giới hạn cấp bậc/cảnh giới, hoặc tự tiện bỏ qua chi phí tài nguyên (Linh khí, Ma lực, Mana, Pháp lực, Đan dược, vũ khí, thể lực).
- Bản chất pháp lý cao nhất: Nếu tài nguyên bị cạn kiệt, nhân vật PHẢI chịu thất bại logic, bị phản phệ độc hại, khốn quẫn mỏi mệt, suy sụp đan điền hoặc gãy đổ bí bảo chứ không được "sáng tạo ma thuật cheat ảo".
- Bảo vệ triệt để tính chân thực và tính thử thách tàn khốc của thế giới nguyên tác.

BỐI CẢNH THẾ GIỚI HIỆN TẠI:
"""
${worldContext}
"""

TÀI LIỆU TRI THỨC BỔ SUNG (NẾU CÓ):
"""
${knowledgeText ? knowledgeText.slice(0, 500000) : "Không có tài liệu bổ sung."}
"""

YÊU CẦU ĐÚC KẾT CHI TIẾT (MANDATORY DETAIL):
- Tạo từ 8 đến 15 quy tắc ràng buộc rõ ràng, đanh thép bằng tiếng Việt dưới dạng chỉ thị nghiêm khắc bắt AI tuân thủ.
- Mỗi quy tắc được viết thành 2-3 câu dài, chặt chẽ, đầy đủ cấu trúc pháp chế và chế tài (Ví dụ: "Hao tổn tài nguyên linh khí chi tiết: Khi nhân vật thi triển tuyệt kỹ, pháp lực hoặc linh khí PHẢI bị sụt giảm tương ứng. Nếu LSR chỉ ra lượng linh khí chạm đáy, tuyệt đối cấm thi triển ma pháp thành công. AI bắt buộc phải mô tả Arthur gồng mình bất lực, kinh mạch đau nhói nứt rách {RẮC!} và chịu thất bại logic hoặc bị kẻ thù phản công tàn nhẫn.").
- Các luật lệ phải liên quan mật thiết đến hệ thống sức mạnh, võ công, tuyệt kỹ, quy luật địa lý, cấm địa hỏa ngục hay quy tắc xã hội được nhắc đến trực tiếp trong tệp tri thức nguyên tác.

YÊU CẦU TRẢ VỀ:
Trả về kết quả dưới dạng một MẢNG JSON các chuỗi ký tự (Array of strings). Không kèm giải thích ngoài lề.`;

    const aiClient = getAiClient(settings);
    const response = await aiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Mảng danh sách các quy tắc Luật AI tối cao",
          items: { type: Type.STRING }
        },
        temperature: 0.3
      }
    });

    if (response.text) {
      const parsed = extractJson<string[]>(response.text);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  }
};
