import { parseCardAsync } from "@character-foundry/character-foundry";
import { StoredCharacter, WorldData, PlayerProfile, Entity } from "../../types";
import { extractJson } from "../../utils/regex";
import {
  DIFFICULTY_LEVELS,
  OUTPUT_LENGTHS,
} from "../../constants/promptTemplates";

export const CharacterImportService = {
  // Parse PNG or JSON from ArrayBuffer
  async parseBuffer(
    buffer: ArrayBuffer,
    contentType: string,
    fileName?: string,
  ): Promise<{ data: any; avatarUrl?: string }> {
    let data;
    let avatarUrl;

    const uint8Array = new Uint8Array(buffer);

    // If it's an image, let's also read avatarUrl
    const isImage =
      contentType.includes("image/") ||
      fileName?.endsWith(".png") ||
      fileName?.endsWith(".webp") ||
      fileName?.endsWith(".jpg") ||
      fileName?.endsWith(".jpeg");
    if (isImage) {
      const blob = new Blob([buffer], { type: contentType || "image/png" });
      avatarUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    try {
      // Parse using character-foundry library
      const parseResult = await parseCardAsync(uint8Array);
      if (parseResult && parseResult.card) {
        data = parseResult.card;
      }
    } catch (err) {
      console.warn(
        "Lỗi khi parse qua character-foundry, đang thử fallback thủ công...",
        err,
      );
    }

    // Fallback nếu thư viện không parse được hoặc trả về không hợp lệ
    if (!data) {
      if (
        contentType.includes("application/json") ||
        fileName?.endsWith(".json")
      ) {
        const text = new TextDecoder().decode(buffer);
        data = JSON.parse(text);
        if (data.node?.format === "chara_card_v2" && data.node?.data) {
          data = data.node.data;
        }

        // Normalize JSON like PNGs
        if (
          data &&
          (data.spec === "chara_card_v2" || data.spec_version) &&
          data.data
        ) {
          data = {
            ...data.data,
            original_spec: data.spec || data.spec_version,
            character_book: data.character_book || data.data.character_book,
          };
        }
      } else {
        data = await this.analyzeSillyTavernImage(uint8Array);
        if (!data) {
          throw new Error("Không thể trích xuất meta-data từ file ảnh này.");
        }
      }
    }

    return { data, avatarUrl };
  },

  // Parse URL from Chub or similar
  async parseUrl(
    url: string,
  ): Promise<{ data: any; avatarUrl?: string; name: string }> {
    const isJsonEndpoint = url.endsWith(".json") || url.includes("/api/");

    const response = await fetch("/api/ai/proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ark-client": "ark-v2-client",
      },
      body: JSON.stringify({
        url: url,
        method: "GET",
        stream: !isJsonEndpoint,
      }),
    });

    if (!response.ok) throw new Error("Lỗi HTTP " + response.status);

    const contentType = response.headers.get("content-type") || "";
    const buffer = await response.arrayBuffer();

    const { data, avatarUrl } = await this.parseBuffer(
      buffer,
      contentType,
      url.split("/").pop(),
    );

    return { data, avatarUrl, name: url.split("/").pop() || "url_import" };
  },

  async analyzeSillyTavernImage(uint8Array: Uint8Array): Promise<any | null> {
    let extractedData: any = null;

    // Helper to decode UTF-8 Base64 correctly (fixing font/encoding issues), robust version
    const decodeBase64UTF8 = (str: string) => {
      try {
        // Standard atob followed by escape/decodeURIComponent to handle multi-byte characters like Japanese/Chinese
        return decodeURIComponent(escape(atob(str)));
      } catch {
        try {
          // Modern robust fallback
          const binaryString = atob(str);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return new TextDecoder("utf-8").decode(bytes);
        } catch {
          try {
            return atob(str);
          } catch {
            return null;
          }
        }
      }
    };

    const parseData = (str: string) => {
      return JSON.parse(str);
    };

    // Advanced segment-based JSON block extractor for mixed raw/slop/binary streams
    const extractJsonFromMixedText = (text: string): any | null => {
      const markers = [
        '"spec_version"',
        '"chara_card_v2"',
        '"character_book"',
        '"first_mes"',
        '"personality"',
        '"scenario"',
        '"mes_example"',
      ];

      for (const marker of markers) {
        let pos = 0;
        while (true) {
          const index = text.indexOf(marker, pos);
          if (index === -1) break;

          // Found marker! Search backwards for a '{'
          const searchStart = Math.max(0, index - 50000);
          const startSegment = text.substring(searchStart, index);
          const braceIdxInSegment = startSegment.lastIndexOf("{");

          if (braceIdxInSegment !== -1) {
            const actualBraceIdx = searchStart + braceIdxInSegment;
            // Now attempt to find matching closing brace count from 'actualBraceIdx'
            let braceCount = 0;
            let inString = false;
            let escape = false;
            let foundMatch = false;
            let lastBraceIdx = -1;

            for (let i = actualBraceIdx; i < text.length; i++) {
              const char = text[i];
              if (inString) {
                if (escape) {
                  escape = false;
                } else if (char === "\\") {
                  escape = true;
                } else if (char === '"') {
                  inString = false;
                }
              } else {
                if (char === '"') {
                  inString = true;
                } else if (char === "{") {
                  braceCount++;
                } else if (char === "}") {
                  braceCount--;
                  if (braceCount === 0) {
                    lastBraceIdx = i;
                    foundMatch = true;
                    break;
                  }
                }
              }
            }

            if (foundMatch && lastBraceIdx !== -1) {
              const potentialJson = text.substring(
                actualBraceIdx,
                lastBraceIdx + 1,
              );
              try {
                const parsed = JSON.parse(potentialJson);
                if (
                  parsed &&
                  (parsed.name ||
                    parsed.spec ||
                    parsed.spec_version ||
                    parsed.character_book ||
                    parsed.data)
                ) {
                  return parsed;
                }
              } catch {
                // Try trailing comma fix
                try {
                  const cleaned = potentialJson.replace(/,\s*([}\]])/g, "$1");
                  const parsedCleaned = JSON.parse(cleaned);
                  if (
                    parsedCleaned &&
                    (parsedCleaned.name ||
                      parsedCleaned.spec ||
                      parsedCleaned.spec_version ||
                      parsedCleaned.character_book ||
                      parsedCleaned.data)
                  ) {
                    return parsedCleaned;
                  }
                } catch {
                  /* proceed */
                }
              }
            }
          }

          pos = index + 1;
        }
      }
      return null;
    };

    const tryParsePayload = (payloadString: string) => {
      // 1. Try directly parsing as JSON
      try {
        return parseData(payloadString);
      } catch {
        /* proceed */
      }

      // 2. Try extractJson extracting nested block
      try {
        const extracted = extractJson(payloadString);
        if (extracted) return extracted;
      } catch {
        /* proceed */
      }

      // 3. Try mixed marker extractor
      try {
        const mixed = extractJsonFromMixedText(payloadString);
        if (mixed) return mixed;
      } catch {
        /* proceed */
      }

      // 4. Try base64 decoding
      const decodedBase64 = decodeBase64UTF8(payloadString);
      if (decodedBase64) {
        try {
          return parseData(decodedBase64);
        } catch {
          /* proceed */
        }
        try {
          const extractedDec = extractJson(decodedBase64);
          if (extractedDec) return extractedDec;
        } catch {
          /* proceed */
        }
        try {
          const mixedDec = extractJsonFromMixedText(decodedBase64);
          if (mixedDec) return mixedDec;
        } catch {
          /* proceed */
        }
      }
      return null;
    };

    // Robust decompressor supporting deflate and deflate-raw fallback
    const decompressBytes = async (
      compressedData: Uint8Array,
    ): Promise<Uint8Array | null> => {
      if (typeof DecompressionStream === "undefined") return null;

      const tryFormat = async (
        format: "deflate" | "deflate-raw",
      ): Promise<Uint8Array | null> => {
        try {
          const ds = new DecompressionStream(format);
          const writer = ds.writable.getWriter();
          await writer.write(compressedData);
          await writer.close();
          const reader = ds.readable.getReader();
          const chunks: Uint8Array[] = [];
          let totalLength = 0;
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              totalLength += value.length;
            }
          }
          const result = new Uint8Array(totalLength);
          let pos = 0;
          for (const c of chunks) {
            result.set(c, pos);
            pos += c.length;
          }
          return result;
        } catch {
          return null;
        }
      };

      let decompressed = await tryFormat("deflate");
      if (!decompressed) {
        decompressed = await tryFormat("deflate-raw");
      }
      return decompressed;
    };

    // 1. Check if it's a PNG and parse chunks
    const isPng =
      uint8Array[0] === 0x89 &&
      uint8Array[1] === 0x50 &&
      uint8Array[2] === 0x4e &&
      uint8Array[3] === 0x47;
    const isWebp =
      uint8Array[0] === 0x52 &&
      uint8Array[1] === 0x49 &&
      uint8Array[2] === 0x46 &&
      uint8Array[3] === 0x46 && // RIFF
      uint8Array[8] === 0x57 &&
      uint8Array[9] === 0x45 &&
      uint8Array[10] === 0x42 &&
      uint8Array[11] === 0x50; // WEBP

    if (isPng) {
      // First pass: scanning specifically for recognized keywords ('chara', 'sillytavern', etc.)
      // Second pass: scanning any other chunks with string values just in case
      for (const checkAllChunks of [false, true]) {
        if (extractedData) break;

        let offset = 8;
        while (offset < uint8Array.length) {
          if (offset + 8 > uint8Array.length) break;
          const length =
            (uint8Array[offset] << 24) |
            (uint8Array[offset + 1] << 16) |
            (uint8Array[offset + 2] << 8) |
            uint8Array[offset + 3];
          const type = String.fromCharCode(
            uint8Array[offset + 4],
            uint8Array[offset + 5],
            uint8Array[offset + 6],
            uint8Array[offset + 7],
          );

          if (type === "tEXt" || type === "zTXt" || type === "iTXt") {
            const chunkData = uint8Array.slice(offset + 8, offset + 8 + length);

            // Keyword is always first, null-terminated
            let nullIdx = 0;
            for (let i = 0; i < chunkData.length; i++) {
              if (chunkData[i] === 0) {
                nullIdx = i;
                break;
              }
            }

            const keyword = new TextDecoder("latin1").decode(
              chunkData.slice(0, nullIdx),
            );
            const lowerKeyword = keyword.toLowerCase();

            const isTargetKeyword =
              lowerKeyword.includes("chara") ||
              lowerKeyword.includes("sillytavern") ||
              lowerKeyword.includes("character") ||
              lowerKeyword.includes("ccv2");

            if (isTargetKeyword || checkAllChunks) {
              let payloadBytes: Uint8Array | null = null;

              try {
                if (type === "tEXt") {
                  payloadBytes = chunkData.slice(nullIdx + 1);
                } else if (type === "zTXt") {
                  const compressedData = chunkData.slice(nullIdx + 2);
                  payloadBytes = await decompressBytes(compressedData);
                } else if (type === "iTXt") {
                  const compressionFlag = chunkData[nullIdx + 1];
                  let langNullIdx = nullIdx + 3;
                  while (
                    langNullIdx < chunkData.length &&
                    chunkData[langNullIdx] !== 0
                  )
                    langNullIdx++;
                  let transNullIdx = langNullIdx + 1;
                  while (
                    transNullIdx < chunkData.length &&
                    chunkData[transNullIdx] !== 0
                  )
                    transNullIdx++;

                  const rawPayloadData = chunkData.slice(transNullIdx + 1);

                  if (compressionFlag === 0) {
                    payloadBytes = rawPayloadData;
                  } else if (compressionFlag === 1) {
                    payloadBytes = await decompressBytes(rawPayloadData);
                  }
                }
              } catch (e) {
                console.warn(
                  "Lỗi giải mã chunk " + type + " (" + keyword + ")",
                  e,
                );
              }

              if (payloadBytes) {
                const textDecoder = new TextDecoder("utf-8");
                const potentialData = textDecoder.decode(payloadBytes);
                const result = tryParsePayload(potentialData);
                if (result) {
                  extractedData = result;
                  break;
                }
              }
            }
          }

          offset += 12 + length;
          if (type === "IEND") break;
        }
      }
    } else if (isWebp) {
      // Parse WebP chunks
      let offset = 12;
      while (offset < uint8Array.length) {
        if (offset + 8 > uint8Array.length) break;
        const chunkId = String.fromCharCode(
          uint8Array[offset],
          uint8Array[offset + 1],
          uint8Array[offset + 2],
          uint8Array[offset + 3],
        );
        const chunkSize =
          uint8Array[offset + 4] |
          (uint8Array[offset + 5] << 8) |
          (uint8Array[offset + 6] << 16) |
          (uint8Array[offset + 7] << 24);

        // Chunk payloads in WebP are padded with an extra null byte if size is odd
        const paddedSize = chunkSize % 2 !== 0 ? chunkSize + 1 : chunkSize;

        if (offset + 8 + chunkSize > uint8Array.length) break;
        const chunkData = uint8Array.slice(offset + 8, offset + 8 + chunkSize);

        // Check for text content inside
        const chunkText = new TextDecoder("utf-8", { fatal: false }).decode(
          chunkData,
        );
        let result = tryParsePayload(chunkText);
        if (result) {
          extractedData = result;
          break;
        }

        const latin1Text = new TextDecoder("latin1").decode(chunkData);
        result = tryParsePayload(latin1Text);
        if (result) {
          extractedData = result;
          break;
        }

        offset += 8 + paddedSize;
      }
    }

    // 2. Trailing/Mixed Data Fallback (Whole text search with smart landmark resolver)
    if (!extractedData) {
      const textDecoder = new TextDecoder("utf-8");
      const wholeText = textDecoder.decode(uint8Array);

      const result = extractJsonFromMixedText(wholeText);
      if (result) {
        extractedData = result;
      }
    }

    if (extractedData) {
      // Normalize V2/V3 Spec like the old logic
      if (
        extractedData.data &&
        (extractedData.spec === "chara_card_v2" || extractedData.spec_version)
      ) {
        extractedData = {
          ...extractedData.data,
          original_spec: extractedData.spec || extractedData.spec_version,
          character_book:
            extractedData.character_book || extractedData.data.character_book,
        };
      }
    }

    return extractedData;
  },

  toStoredCharacter(data: any, avatarUrl?: string): StoredCharacter {
    // Determine spec and normalize basic info
    let spec = "unknown";
    let name = "Unknown";
    let description = "";
    let tags: string[] = [];

    if (data.spec === "chara_card_v3" && data.data) {
      spec = "chara_card_v3";
      name = data.data.name || "Unknown";
      description = data.data.description || "";
      tags = data.data.tags || [];
    } else if (data.spec === "chara_card_v2" && data.data) {
      // Unnormalized JSON
      spec = "chara_card_v2";
      name = data.data.name || "Unknown";
      description = data.data.description || "";
      tags = data.data.tags || [];
    } else if (data.original_spec) {
      // Normalized flattened JSON
      spec = data.original_spec;
      name = data.name || "Unknown";
      description = data.description || "";
      tags = data.tags || [];
    } else if (data.name) {
      // V1 or fully normalized without spec
      spec = data.spec || data.spec_version || "v1";
      name = data.name;
      description = data.description || "";
      tags = data.tags || [];
    }

    return {
      id: crypto.randomUUID(),
      name,
      avatarUrl,
      description,
      tags,
      spec,
      rawData: data,
      importedAt: Date.now(),
    };
  },

  // Transforms a StoredCharacter and Player Profile into WorldData for the game engine
  toWorldData(char: StoredCharacter, player: PlayerProfile): WorldData {
    // Handle both pre-flattened and raw data forms
    let data;
    if (char.spec === "chara_card_v3" && char.rawData?.data) {
      data = char.rawData.data;
    } else if (char.spec === "chara_card_v2" && char.rawData?.data) {
      data = char.rawData.data;
    } else if (char.rawData && char.rawData.original_spec) {
      data = char.rawData;
    } else {
      data = char.rawData;
    }

    // Default setup for WorldData
    const entities: Entity[] = [];
    let lorebook:
      | import("../../services/ai/lorebook/types").Lorebook
      | undefined;
    let regexScripts: import("../../types").RegexScript[] = [];
    const mainChar: Entity = {
      id: crypto.randomUUID(),
      name: data.name || char.name,
      type: "NPC",
      description: data.description || "",
      personality: data.personality || "",
      exampleMessages: data.mes_example || "",
      extensions: {
        firstMessage: data.first_mes || "",
        system_prompt:
          data.system_prompt || data.extensions?.system_prompt || "",
        scenario: data.scenario || "",
        jailbreak_prompt:
          data.jailbreak_prompt || data.extensions?.jailbreak_prompt || "",
        post_history_instructions:
          data.post_history_instructions ||
          data.extensions?.post_history_instructions ||
          "",
        alternate_greetings: data.alternate_greetings || [],
      },
    };
    entities.push(mainChar);

    // Map Lorebook
    const bookData = char.rawData.character_book || data.character_book;
    if (bookData) {
      const entries: Record<
        string,
        import("../../services/ai/lorebook/types").LorebookEntry
      > = {};

      if (bookData.entries && Array.isArray(bookData.entries)) {
        bookData.entries.forEach((entry: any, idx: number) => {
          const uid =
            entry.uid !== undefined
              ? String(entry.uid)
              : `entry_${idx}_${Date.now()}`;
          // Same mapping as in CardSTAnalyzer
          const order =
            entry.order !== undefined
              ? entry.order
              : entry.insertion_order !== undefined
                ? entry.insertion_order
                : idx;
          const useRegex = entry.use_regex || false;
          let keys = entry.keys || entry.key || [];
          if (typeof keys === "string") {
            keys = (keys as string)
              .split(",")
              .map((k: string) => k.trim())
              .filter((k: string) => k.length > 0);
          }

          // Standard ST "selective" is a boolean enabling/disabling secondary keys
          const selective = entry.selective === true || entry.selective === 1;
          let secondaryKeys = selective
            ? entry.secondary_keys ||
              entry.keysecondary ||
              entry.secondary ||
              []
            : [];
          if (typeof secondaryKeys === "string") {
            secondaryKeys = (secondaryKeys as string)
              .split(",")
              .map((k: string) => k.trim())
              .filter((k: string) => k.length > 0);
          }

          const selectiveLogic =
            entry.selective_logic !== undefined
              ? entry.selective_logic
              : entry.selectiveLogic !== undefined
                ? entry.selectiveLogic
                : entry.logical !== undefined
                  ? entry.logical
                  : 0;

          if (useRegex) {
            keys = keys.map((k: string) => (k.startsWith("/") ? k : `/${k}/`));
            secondaryKeys = secondaryKeys.map((k: string) =>
              k.startsWith("/") ? k : `/${k}/`,
            );
          }

          // Map position robustly to matches target engine constraints
          let position = 0;
          if (entry.position !== undefined) {
            if (typeof entry.position === "number") {
              if (entry.position >= 0 && entry.position <= 6) {
                position = entry.position === 4 ? 6 : entry.position; // Map ST 4 (at_depth) to our depthCase 6
              }
            } else if (typeof entry.position === "string") {
              const posStr = entry.position.toLowerCase();
              if (posStr === "before_char") position = 0;
              else if (posStr === "after_char") position = 1;
              else if (
                posStr === "before_example" ||
                posStr === "before_examples"
              )
                position = 2;
              else if (
                posStr === "after_example" ||
                posStr === "after_examples"
              )
                position = 3;
              else if (posStr === "at_depth" || posStr === "atdepth")
                position = 6;
              else if (posStr === "an_top" || posStr === "top") position = 4;
              else if (posStr === "an_bottom" || posStr === "bottom")
                position = 5;
            }
          }

          // Map depth (standard ST depth defaults to 5 if not assigned)
          const depth = entry.depth !== undefined ? Number(entry.depth) : 4;

          entries[uid] = {
            uid,
            key: keys,
            keysecondary: secondaryKeys,
            selectiveLogic,
            content: entry.content || "",
            comment: entry.comment || entry.name || "",
            constant: entry.constant || false,
            position: position,
            order: order,
            depth: depth,
            enabled: entry.enabled !== false,
            useRegex: useRegex,
          };
        });

        // Map Lorebook entries back to Entity Encyclopedia for seamless display
        Object.entries(entries).forEach(([uid, ent]: [string, any]) => {
          let entityType: import("../../types").EntityType = "CUSTOM";
          let entityName = ent.comment || (Array.isArray(ent.key) ? ent.key[0] : ent.key) || "Chưa rõ";
          
          if (ent.comment && ent.comment.startsWith("[Entity:")) {
            const match = ent.comment.match(/^\[Entity:(NPC|LOCATION|ITEM|FACTION|CUSTOM)\]\s*(.*)$/);
            if (match) {
              entityType = match[1] as import("../../types").EntityType;
              entityName = match[2];
            }
          } else {
            const commentLower = (ent.comment || "").toLowerCase();
            if (commentLower.includes("npc") || commentLower.includes("nhân vật") || commentLower.includes("char")) {
              entityType = "NPC";
            } else if (commentLower.includes("location") || commentLower.includes("địa điểm") || commentLower.includes("nơi") || commentLower.includes("thành")) {
              entityType = "LOCATION";
            } else if (commentLower.includes("item") || commentLower.includes("vật phẩm") || commentLower.includes("đồ") || commentLower.includes("vũ khí")) {
              entityType = "ITEM";
            } else if (commentLower.includes("faction") || commentLower.includes("phe phái") || commentLower.includes("bang") || commentLower.includes("hội")) {
              entityType = "FACTION";
            }
          }

          let personality = "";
          let background = ent.content || "";
          let appearance = "";
          let age = "";
          let gender = "";

          if (entityType === "NPC") {
            const lines = (ent.content || "").split("\n");
            lines.forEach((line: string) => {
              if (line.startsWith("Tuổi:")) age = line.replace("Tuổi:", "").trim();
              else if (line.startsWith("Giới tính:")) gender = line.replace("Giới tính:", "").trim();
              else if (line.startsWith("Tính cách:")) personality = line.replace("Tính cách:", "").trim();
              else if (line.startsWith("Ngoại hình:")) appearance = line.replace("Ngoại hình:", "").trim();
              else if (line.startsWith("Tiểu sử:")) background = line.replace("Tiểu sử:", "").trim();
            });
          }

          // Check if this entity name already exists to prevent duplicate NPC mapping
          const exists = entities.some(e => e.name.toLowerCase() === entityName.toLowerCase());
          if (!exists) {
            entities.push({
              id: uid,
              type: entityType,
              name: entityName,
              description: ent.content || "",
              personality: personality || undefined,
              background: background || ent.content || "",
              appearance: appearance || undefined,
              age: age || undefined,
              gender: gender || undefined
            });
          }
        });
      }
      lorebook = { entries };
    }

    // Map Regex Scripts
    if (
      char.rawData.regex_scripts &&
      Array.isArray(char.rawData.regex_scripts)
    ) {
      regexScripts = char.rawData.regex_scripts;
    } else if (data.extensions && data.extensions.regex_scripts) {
      regexScripts = data.extensions.regex_scripts;
    } else if (bookData?.extensions?.regex_scripts) {
      regexScripts = bookData.extensions.regex_scripts;
    }

    return {
      id: crypto.randomUUID(),
      player: player,
      entities: entities,
      lorebook: lorebook,
      world: {
        worldName: `ST: ${char.name}`,
        genre: "Roleplay",
        context: data.scenario || "",
        firstMessage: data.first_mes || "",
      },
      config: {
        difficulty: DIFFICULTY_LEVELS[1],
        outputLength: OUTPUT_LENGTHS[1],
        rules: [],
        perspective: "third",
      },
      extensions: {
        regex_scripts: regexScripts,
      },
    } as WorldData;
  },
};
