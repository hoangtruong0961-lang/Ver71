import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  BrainCircuit,
  Brain,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  X,
  Database,
  RefreshCw,
  Settings,
  RotateCcw,
  Save,
  Bug,
  Globe,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  ChatMessage,
  AppSettings,
  WorldData,
  Entity,
  RegexScript,
} from "../../../types";
import { elevenLabsService } from "../../../services/audio/elevenlabs";
import { browserTtsService } from "../../../services/audio/browsertts";
import { MarkdownRenderer } from "../../common/MarkdownRenderer";
import { TawaThinkingWidget } from "./components/TawaThinkingWidget";
import {
  TAWA_REGEX,
  extractTagContent,
  cleanRawText,
  getRegexedString,
  LSR_REGEX,
} from "../../../utils/regex";

export interface TawaMessageRendererProps {
  index: number;
  text: string | { text: string };
  onUpdate: (index: number, newText: string) => void;
  isStreaming?: boolean;
  regexScripts?: import("../../../types").RegexScript[];
  entities?: Entity[];
  onEntityClick?: (entityId: string) => void;
  turnNumber?: number;
  userAction?: string;
  playerName?: string;
  playerAvatar?: string;
  messageRole?: "user" | "assistant" | "system";
  contentBeautify?: boolean;
  totalCount?: number;
  isHidden?: boolean;
  onToggleHide?: (index: number) => void;
  metadata?: {
    presetUsed?: string;
    cotUsed?: string;
    worldInfoConfig?: string;
  };
}

const TawaMessageRenderer: React.FC<TawaMessageRendererProps> = React.memo(
  ({
    index,
    text,
    onUpdate,
    isStreaming,
    regexScripts,
    entities,
    onEntityClick,
    turnNumber,
    userAction,
    playerName,
    playerAvatar,
    messageRole,
    contentBeautify = false,
    totalCount = 0,
    isHidden = false,
    onToggleHide,
    metadata,
  }) => {
    // ... (rest of the component remains the same)
    // Safety check: ensure text is a string to prevent React Error #31
    const displayText =
      typeof text === "string"
        ? text
        : text && typeof text === "object" && "text" in text
          ? (text as { text: string }).text
          : JSON.stringify(text);

    const [showThinking, setShowThinking] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(displayText);
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle clicks on entities
    useEffect(() => {
      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        // Use closest to find the element with data-entity-id even if a child was clicked
        const entityEl = target.closest("[data-entity-id]");
        const entityId = entityEl?.getAttribute("data-entity-id");

        if (entityId && onEntityClick) {
          onEntityClick(entityId);
        }
      };

      const el = containerRef.current;
      if (el) {
        el.addEventListener("click", handleClick);
      }
      return () => {
        if (el) {
          el.removeEventListener("click", handleClick);
        }
      };
    }, [onEntityClick]);

    // Sync editedText when prop text changes
    useEffect(() => {
      setEditedText(displayText);
    }, [displayText]);

    // Use processedContent for plain/editing views

    // Extract and process content heavily inside useMemo to avoid lag on re-renders (scrolling/pagination)
    const processedContent = useMemo(() => {
      let thinkingContent =
        extractTagContent(displayText, "thinking") ||
        extractTagContent(displayText, "think") ||
        extractTagContent(displayText, "thinhking") ||
        extractTagContent(displayText, "thought") ||
        extractTagContent(displayText, "thoughts");

      // Apply Reasoning Regex (placement 5) to thinking content
      if (thinkingContent && regexScripts && regexScripts.length > 0) {
        const charName = entities?.[0]?.name || "Character";
        const isDebug =
          typeof window !== "undefined" &&
          (window as any).__TAWA_REGEX_DEBUG__ === true;
        const messageDepth = totalCount > 0 ? totalCount - 1 - index : -1;

        thinkingContent = getRegexedString(thinkingContent, 5, regexScripts, {
          userName: playerName || "User",
          charName: charName,
          isMarkdown: true,
          renderPhaseOnly: true,
          depth: messageDepth,
          isDebug,
        });
      }

      // 1. APPLY ST REGEX SCRIPTS FIRST (Allows matching raw tags like <choices>, <profile> etc.)
      let content = displayText;
      if (regexScripts && regexScripts.length > 0) {
        const charName = entities?.[0]?.name || "Character";
        const isDebug =
          typeof window !== "undefined" &&
          (window as any).__TAWA_REGEX_DEBUG__ === true;
        const messageDepth = totalCount > 0 ? totalCount - 1 - index : -1;
        const isAI = messageRole === "assistant" || messageRole === "system";
        const placementVal = isAI ? 2 : 1;

        content = getRegexedString(content, placementVal, regexScripts, {
          userName: playerName || "User",
          charName: charName,
          isMarkdown: true,
          renderPhaseOnly: true,
          depth: messageDepth,
          isDebug,
        });
      }

      // 2. NOW Extract Clean Main Content (Strip any leftover/unused system tags)
      const mainContent = cleanRawText(content);
      if (!mainContent) {
        return { thinkingContent, mainContent: null };
      }

      content = mainContent;

      // PROTECT STRUCTURAL HTML & CODE BEFORE BLIND FORMATTING
      const protectedCodeBlocks: string[] = [];
      content = content.replace(/```[\s\S]*?```/g, (match) => {
          protectedCodeBlocks.push(match);
          return `__SYS_CODEBLOCK_${protectedCodeBlocks.length - 1}__`;
      });
      const protectedFullDocs: string[] = [];
      content = content.replace(/<!DOCTYPE\s+html>[\s\S]*?(?:<\/html>|$)|<\s*html\b[\s\S]*?(?:<\/html>|$)/gi, (match) => {
          protectedFullDocs.push(match);
          return `__SYS_FULLDOC_${protectedFullDocs.length - 1}__`;
      });
      const protectedSandboxes: string[] = [];
      content = content.replace(/<sandbox>([\s\S]*?)(?:<\/sandbox>|$)/gi, (match) => {
          protectedSandboxes.push(match);
          return `__SYS_SANDBOX_${protectedSandboxes.length - 1}__`;
      });
      const protectedScriptStyles: string[] = [];
      content = content.replace(/<(script|style)\b[\s\S]*?(?:<\/\1>|$)/gi, (match) => {
          protectedScriptStyles.push(match);
          return `__SYS_SCRIPTSTYLE_${protectedScriptStyles.length - 1}__`;
      });

      // 0. Clean Artifacts (System text, status checks)
      if (TAWA_REGEX.ARTIFACTS_REMOVAL) {
        TAWA_REGEX.ARTIFACTS_REMOVAL.forEach((regex) => {
          if (contentBeautify && regex.source.includes("Hệ thống")) {
            return;
          }
          content = content.replace(regex, "");
        });
      }

      // Apply LSR Regex cleaning
      LSR_REGEX.forEach((rule) => {
        content = content.replace(rule.regex, "");
      });

      // 3. Remove Asterisks (*) completely for novel style
      if (TAWA_REGEX.ASTERISK_REMOVAL) {
        content = content.replace(TAWA_REGEX.ASTERISK_REMOVAL, "");
      }

      // 2. Helper to highlight entities in a string
      const highlightEntities = (text: string) => {
        if (!entities || entities.length === 0) return text;

        let tempFormatted = text;

        // Extract tawa-widgets before highlighting entities to avoid corrupting base64
        const tawaWidgets: string[] = [];
        tempFormatted = tempFormatted.replace(
          /<tawa-widget>[\s\S]*?<\/tawa-widget>/g,
          (match) => {
            tawaWidgets.push(match);
            return `__TAWA_WIDGET_${tawaWidgets.length - 1}__`;
          },
        );

        const sortedEntities = [...entities].sort(
          (a, b) => b.name.length - a.name.length,
        );

        sortedEntities.forEach((entity) => {
          if (!entity.name) return;

          if (
            playerName &&
            entity.name.toLowerCase() === playerName.toLowerCase()
          )
            return;
          if (
            playerName &&
            playerName.toLowerCase().includes(entity.name.toLowerCase()) &&
            entity.name.length > 2
          )
            return;

          const escapedName = entity.name.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          );
          const regex = new RegExp(
            "(^|[^a-zA-Z0-9\\u00C0-\\u1EF9])(" +
              escapedName +
              ")(?![a-zA-Z0-9\\u00C0-\\u1EF9])",
            "gi",
          );

          const colorClass =
            entity.type === "NPC"
              ? "text-sky-500"
              : entity.type === "LOCATION"
                ? "text-emerald-500"
                : entity.type === "FACTION"
                  ? "text-rose-500"
                  : entity.type === "ITEM"
                    ? "text-amber-500"
                    : "text-stone-500";

          // We inject raw HTML spans.
          tempFormatted = tempFormatted.replace(
            regex,
            `$1<span class="${colorClass} font-bold cursor-pointer hover:underline decoration-dotted" data-entity-id="${entity.id}">$2</span>`,
          );
        });

        // Restore tawa-widgets
        tawaWidgets.forEach((widget, index) => {
          tempFormatted = tempFormatted.replace(
            `__TAWA_WIDGET_${index}__`,
            widget,
          );
        });

        return tempFormatted;
      };

      // 3. Highlight Entities globally
      content = highlightEntities(content);

      // 4. Process Scene Separators (---)
      // Must be on its own line
      content = content.replace(/(?:^|\n)\s*---\s*(?=\n|$)/g, () => {
        return `\n\n<div class="my-8 flex items-center justify-center gap-4 opacity-30">
                <div class="h-[1px] flex-1 bg-gradient-to-r from-transparent to-stone-400 dark:to-slate-600"></div>
                <div class="flex gap-1">
                    <div class="w-1 h-1 rounded-full bg-stone-400 dark:bg-slate-600"></div>
                    <div class="w-1.5 h-1.5 rounded-full bg-stone-500 dark:bg-slate-500"></div>
                    <div class="w-1 h-1 rounded-full bg-stone-400 dark:bg-slate-600"></div>
                </div>
                <div class="h-[1px] flex-1 bg-gradient-to-l from-transparent to-stone-400 dark:to-slate-600"></div>
            </div>\n\n`;
      });

      // 5. Process Notifications [Hệ thống: ...]
      if (contentBeautify) {
        content = content.replace(
          /(?:^|\n)\s*\[(Hệ thống|Thông báo|System|Notification):?\s*([^\]]+)\]\s*(?=\n|$)/gi,
          (match, prefix, msg) => {
            return `\n\n<div class="my-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-left-2 duration-500">
                    <div class="mt-0.5 text-blue-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    </div>
                    <div class="flex-1">
                        <span class="text-[10px] uppercase font-black tracking-widest text-blue-500/70 block mb-0.5">${prefix}</span>
                        <span class="text-sm font-medium text-blue-700 dark:text-blue-300">${msg}</span>
                    </div>
                </div>\n\n`;
          },
        );
      }

      // 6. Process Dialogue blocks
      if (contentBeautify) {
        content = content.replace(
          /(?:^|\n)\s*(?:([^:<>\n]+?)(?:\s+(?:nói|nghĩ))?:\s*)?(["“「﹁][^"”」﹂]*["”」﹂])\s*(?=\n|$)/gi,
          (match, speakerNameRaw, dialogueText, offset, string) => {
            speakerNameRaw = speakerNameRaw ? speakerNameRaw.trim() : "";
            if (!speakerNameRaw && !dialogueText) return match;

            const isPC =
              playerName &&
              speakerNameRaw.toLowerCase().includes(playerName.toLowerCase());
            const entity = entities?.find((e) =>
              speakerNameRaw.toLowerCase().includes(e.name.toLowerCase()),
            );
            const isNPC = !!entity && !isPC;

            const finalName = isPC
              ? playerName
              : entity
                ? entity.name
                : speakerNameRaw || "Người dẫn chuyện";
            const initial = finalName.charAt(0).toUpperCase();
            const avatarUrl = isPC ? playerAvatar : entity?.avatar;

            const avatarColor = isPC
              ? "bg-sky-500"
              : isNPC
                ? "bg-amber-500"
                : "bg-stone-500";
            const bubbleBg = isPC
              ? "bg-sky-50 dark:bg-sky-900/20 border-sky-200/50 dark:border-sky-800/50"
              : isNPC
                ? "bg-white dark:bg-slate-800/40 border-stone-200 dark:border-slate-700"
                : "bg-stone-100 dark:bg-stone-900/30 border-stone-200 dark:border-stone-800";
            const textColor = isPC
              ? "text-sky-900 dark:text-sky-100"
              : isNPC
                ? "text-stone-900 dark:text-slate-200"
                : "text-stone-800 dark:text-slate-300";
            const nameColor = isPC
              ? "text-sky-600 dark:text-sky-400"
              : isNPC
                ? "text-amber-600 dark:text-amber-400"
                : "text-stone-500 dark:text-slate-500";

            const flexDir = isPC ? "flex-row-reverse" : "";
            const alignItem = isPC ? "items-end" : "items-start";
            const roundedShape = isPC ? "rounded-tr-none" : "rounded-tl-none";

            const tailClass = isPC
              ? `absolute top-0 -right-1.5 w-3 h-3 ${bubbleBg} border-t border-r transform rotate-45 translate-y-3`
              : `absolute top-0 -left-1.5 w-3 h-3 ${bubbleBg} border-t border-l transform -rotate-45 translate-y-3`;

            const avatarContent = avatarUrl
              ? `<img src="${avatarUrl}" alt="${finalName}" class="w-full h-full object-cover" referrerpolicy="no-referrer" />`
              : initial;

            const npcBadge = isNPC
              ? `<span class="w-1 h-1 rounded-full bg-amber-500/50"></span><span class="text-[9px] text-amber-600/70 dark:text-amber-500/50 font-bold uppercase tracking-tighter">NPC</span>`
              : "";

            // We encode the dialogue text in a div that rehypeRaw will pass through
            return `\n\n<div class="flex items-start gap-3 my-6 animate-in fade-in slide-in-from-left-2 duration-300 ${flexDir}">
                    <div class="w-9 h-9 rounded-xl ${avatarColor} text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm border-2 border-white dark:border-slate-800 overflow-hidden">
                        ${avatarContent}
                    </div>
                    <div class="flex flex-col max-w-[80%] ${alignItem}">
                        <div class="flex items-center gap-2 mb-1 px-1">
                            <span class="text-[11px] font-black ${nameColor} uppercase tracking-[0.1em]">${finalName}</span>
                            ${npcBadge}
                        </div>
                        <div class="${bubbleBg} p-4 rounded-2xl ${roundedShape} border shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-none relative group text-base md:text-lg leading-relaxed ${textColor}">
                            <div class="${tailClass}"></div>
                            ${dialogueText}
                        </div>
                    </div>
                </div>\n\n`;
          },
        );
      }

      // 7. Handle internal thoughts (Tiếng lòng) - Thường trong ngoặc đơn (...)
      content = content.replace(
        /(?<!url|rgba?|hsl|var|calc)\(([^)]{10,})\)/g,
        '<span class="text-stone-400 dark:text-slate-500 italic font-serif opacity-90">($1)</span>',
      );

      // 8. Handle Action Highlights [Hành động: ...]
      content = content.replace(
        /\[(Hành động|Action):?\s*([^\]]+)\]/gi,
        '<span class="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mx-1">$2</span>',
      );

      // RESTORE STRUCTURAL HTML & CODE
      protectedSandboxes.forEach((block, index) => {
          content = content.replace(`__SYS_SANDBOX_${index}__`, () => block);
      });
      protectedScriptStyles.forEach((block, index) => {
          content = content.replace(`__SYS_SCRIPTSTYLE_${index}__`, () => block);
      });
      protectedFullDocs.forEach((block, index) => {
          content = content.replace(`__SYS_FULLDOC_${index}__`, () => block);
      });
      protectedCodeBlocks.forEach((block, index) => {
          content = content.replace(`__SYS_CODEBLOCK_${index}__`, () => block);
      });

      return { thinkingContent, mainContent: content };
    }, [
      displayText,
      regexScripts,
      entities,
      playerName,
      playerAvatar,
      messageRole,
      totalCount,
      index,
      contentBeautify,
    ]);

    // Task 2: Simple Render for Streaming to prevent Markdown breakages
    if (isStreaming) {
      const streamText = displayText || "";
      let openIndex = -1;
      let closeIndex = -1;
      let tagLen = 0;
      let closeLen = 0;

      const possibleTags = [
        "thinking",
        "think",
        "thinhking",
        "thought",
        "thoughts",
      ];

      for (const tag of possibleTags) {
        const openTag = `<${tag}>`;
        const testOpenIndex = streamText.indexOf(openTag);
        if (testOpenIndex !== -1) {
          openIndex = testOpenIndex;
          tagLen = openTag.length;
          
          // Balanced nested tag scanner for streaming
          const afterOpen = streamText.substring(openIndex + tagLen);
          const tokenRegex = new RegExp(`<(/?)${tag}\\s*>`, 'gi');
          let match;
          let depth = 1;
          let foundCloseIndex = -1;
          let foundCloseLen = 0;
          
          while ((match = tokenRegex.exec(afterOpen)) !== null) {
            const isClose = match[1] === '/';
            if (isClose) {
              depth--;
              if (depth === 0) {
                foundCloseIndex = match.index;
                foundCloseLen = match[0].length;
                break;
              }
            } else {
              depth++;
            }
          }
          
          if (foundCloseIndex !== -1) {
            closeIndex = openIndex + tagLen + foundCloseIndex;
            closeLen = foundCloseLen;
          } else {
            // Fallback during streaming: if depth doesn't hit 0 but we have closing tags,
            // we use the absolute last closing tag as the end index.
            const closeTag = `</${tag}>`;
            const lastCloseIndex = streamText.lastIndexOf(closeTag);
            if (lastCloseIndex !== -1 && lastCloseIndex > openIndex) {
              closeIndex = lastCloseIndex;
              closeLen = closeTag.length;
            } else {
              closeIndex = -1;
              closeLen = 0;
            }
          }
          break;
        }
      }

      let thinkingStream = "";
      let contentStream = "";

      if (openIndex !== -1) {
        if (closeIndex !== -1) {
          thinkingStream = streamText
            .substring(openIndex + tagLen, closeIndex)
            .trim();
          contentStream = cleanRawText(
            streamText.substring(closeIndex + closeLen),
          );
        } else {
          thinkingStream = streamText.substring(openIndex + tagLen).trim();
          contentStream = "";
        }
      } else {
        contentStream = cleanRawText(streamText);
      }

      return (
        <div className="w-full flex flex-col gap-2">
          {turnNumber !== undefined && (
            <div className="mb-2 pb-2 border-b border-stone-400/30 dark:border-slate-800/50">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-mystic-accent mb-1 opacity-80 flex items-center gap-2">
                {turnNumber === 0 ? "Khởi Đầu (Lượt 0)" : `Lượt ${turnNumber}`}
                <Loader2
                  size={10}
                  className="animate-spin text-mystic-accent"
                />
              </div>
            </div>
          )}

          {!turnNumber && turnNumber !== 0 && (
            <div className="text-xs font-bold text-mystic-accent uppercase mb-1 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Streaming...
            </div>
          )}

          {thinkingStream && (
            <div className="mb-2 text-stone-500/80 dark:text-slate-500/80 text-sm border-l-2 border-stone-300 dark:border-slate-700 pl-3">
              <div className="text-[10px] uppercase font-bold tracking-widest mb-1 opacity-50 flex items-center gap-1">
                <BrainCircuit size={10} className="animate-pulse" /> Đang suy
                nghĩ...
              </div>
              <div className="whitespace-pre-wrap italic animate-pulse">
                {thinkingStream}
              </div>
            </div>
          )}

          {/* Render plain text with whitespace preservation during stream */}
          {contentStream && (
            <div className="whitespace-pre-wrap font-mono text-base text-stone-700 dark:text-slate-300 leading-relaxed opacity-90 animate-pulse">
              {contentStream}
            </div>
          )}
        </div>
      );
    }

    const handleSaveEdit = () => {
      onUpdate(index, editedText);
      setIsEditing(false);
    };

    const handleCancelEdit = () => {
      setEditedText(text);
      setIsEditing(false);
    };

    if (isEditing) {
      return (
        <div className="w-full flex flex-col gap-2 animate-in fade-in duration-200 border border-mystic-accent/30 p-2 rounded bg-stone-200 dark:bg-mystic-900/80">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-mystic-accent uppercase flex items-center gap-1">
              <Edit2 size={12} /> Editing Raw Context
            </span>
            <button
              onClick={handleCancelEdit}
              className="text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full h-96 bg-stone-200 dark:bg-mystic-950 border border-stone-400 dark:border-slate-800 rounded p-3 text-xs font-mono text-stone-800 dark:text-slate-300 focus:border-mystic-accent outline-none resize-y custom-scrollbar leading-relaxed"
            placeholder="Nhập nội dung raw (bao gồm cả thẻ <thinking>, <content>...)"
            spellCheck={false}
          />
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1.5 text-xs text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white bg-stone-300 dark:bg-slate-800 rounded border border-stone-400 dark:border-slate-700 hover:bg-stone-400 dark:hover:bg-slate-700 font-medium"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1.5 text-xs text-mystic-900 bg-mystic-accent hover:bg-sky-400 rounded font-bold shadow-[0_0_10px_rgba(56,189,248,0.3)] flex items-center gap-1"
            >
              <Save size={12} /> Lưu thay đổi
            </button>
          </div>
        </div>
      );
    }

    // Header Row: Thinking Toggle + Edit Button - Only show if needed
    const isUserMessage = turnNumber === undefined;
    const effectiveMetadata = !isUserMessage
      ? metadata || {
          presetUsed: "Mặc định",
          cotUsed: "Không rõ",
          worldInfoConfig: "0 Entities",
        }
      : undefined;
    const hasMetadata = !!effectiveMetadata;

    if (
      processedContent.thinkingContent ||
      isEditing ||
      isUserMessage ||
      !isUserMessage
    ) {
      return (
        <div className="flex flex-col gap-1 w-full group" ref={containerRef}>
          <div className="flex items-center gap-3 w-full min-h-[16px]">
            {processedContent.thinkingContent ? (
              <button
                onClick={() => setShowThinking(!showThinking)}
                className={`flex items-center gap-2 text-[10px] uppercase font-bold text-stone-500 hover:text-mystic-accent transition-all duration-200`}
              >
                <BrainCircuit size={12} />
                {showThinking ? "Ẩn dòng tư duy" : "Hiện dòng tư duy"}
              </button>
            ) : (
              <div className="flex-1"></div>
            )}

            {effectiveMetadata && (
              <div className="flex items-center gap-3 text-[9px] uppercase font-bold text-stone-400 dark:text-slate-500 transition-opacity">
                <span className="flex items-center gap-1" title="Preset">
                  <Settings size={10} />{" "}
                  <span className="truncate max-w-[80px]">
                    {effectiveMetadata.presetUsed}
                  </span>
                </span>
                <span className="flex items-center gap-1" title="CoT">
                  <Brain size={10} />{" "}
                  <span className="truncate max-w-[80px]">
                    {effectiveMetadata.cotUsed}
                  </span>
                </span>
                <span
                  className="flex items-center gap-1"
                  title="World Info Entities"
                >
                  <Database size={10} /> {effectiveMetadata.worldInfoConfig}
                </span>
              </div>
            )}

            {onToggleHide && (
              <button
                onClick={() => onToggleHide(index)}
                className={`flex items-center gap-1 text-[10px] font-bold ${
                  isHidden ? "text-amber-600 dark:text-amber-500 hover:text-amber-500" : "text-stone-600 dark:text-stone-500 hover:text-stone-900 dark:hover:text-stone-300"
                } uppercase transition-all mr-2`}
                title={isHidden ? "Hiện (Bỏ ẩn)" : "Ẩn khỏi AI Context"}
              >
                {isHidden ? "Đã Ẩn" : "Ẩn"}
              </button>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className={`flex items-center gap-1 text-[10px] font-bold text-stone-600 hover:text-sky-400 uppercase transition-all ${processedContent.thinkingContent || effectiveMetadata ? "opacity-100 hover:text-sky-400" : "opacity-100"}`}
              title={
                isUserMessage
                  ? "Chỉnh sửa hành động của bạn"
                  : "Chỉnh sửa Context gốc (Raw)"
              }
            >
              <Edit2 size={10} />{" "}
              {isUserMessage ? "Chỉnh sửa hành động" : "Edit Raw"}
            </button>
          </div>

          {processedContent.thinkingContent && (
            <TawaThinkingWidget
              thinkingContent={processedContent.thinkingContent}
              charName={entities?.[0]?.name || "Tawa"}
              isOpen={showThinking}
              onToggle={() => setShowThinking(!showThinking)}
              contentBeautify={contentBeautify}
            />
          )}

          <div className="font-sans text-base md:text-lg text-stone-800 dark:text-slate-300 [&>p]:mb-3 last:[&>p]:mb-0 leading-[20px] font-normal not-italic">
            {turnNumber !== undefined && (
              <div
                id={`turn-${turnNumber}`}
                className="mb-4 pb-2 border-b border-stone-400/30 dark:border-slate-800/50 scroll-mt-20"
              >
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-mystic-accent mb-1 opacity-80">
                  {turnNumber === 0
                    ? "Khởi Đầu (Lượt 0)"
                    : `Lượt ${turnNumber}`}
                </div>
              </div>
            )}
            {processedContent.mainContent ? (
              <MarkdownRenderer
                className="text-stone-800 dark:text-slate-300 leading-relaxed text-base md:text-lg font-normal opacity-95"
                content={processedContent.mainContent}
                regexScripts={regexScripts || []}
                userName={playerName}
                charName={entities?.[0]?.name}
                messageRole={messageRole}
                depth={totalCount > 0 ? totalCount - 1 - index : -1}
              />
            ) : isStreaming ? null : (
              <div className="p-4 bg-stone-300/50 dark:bg-slate-900/50 border border-dashed border-stone-400 dark:border-slate-700 rounded-xl">
                <div className="flex items-center gap-2 text-red-500 mb-2">
                  <Shield size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Lỗi Hiển Thị Nội Dung
                  </span>
                </div>
                <p className="text-stone-600 dark:text-slate-400 italic text-sm mb-3">
                  [Nội dung truyện trống hoặc đã bị bộ lọc hệ thống loại bỏ hoàn
                  toàn. AI có thể đã gặp lỗi logic, vi phạm chính sách an toàn,
                  hoặc chỉ phản hồi các thẻ kỹ thuật mà không có văn bản
                  truyện.]
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 bg-mystic-accent/10 hover:bg-mystic-accent/20 border border-mystic-accent/30 rounded text-[10px] font-bold text-mystic-accent uppercase transition-colors flex items-center gap-1"
                  >
                    <Edit2 size={10} /> Kiểm tra dữ liệu gốc (Edit Raw)
                  </button>
                  <button
                    onClick={() => {
                      window.location.reload();
                    }}
                    className="px-3 py-1.5 bg-mystic-accent/20 hover:bg-mystic-accent/30 border border-mystic-accent/40 rounded text-[10px] font-bold text-mystic-accent uppercase transition-colors flex items-center gap-1"
                  >
                    <RefreshCw size={10} /> Thử lại (Regenerate)
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1.5 bg-stone-400/20 hover:bg-stone-400/30 border border-stone-400/30 rounded text-[10px] font-bold text-stone-500 uppercase transition-colors flex items-center gap-1"
                  >
                    <RotateCcw size={10} /> Tải lại trang
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Default return to prevent React Error #31
    return (
      <div
        className="font-sans text-base md:text-lg text-stone-800 dark:text-slate-300 [&>p]:mb-3 last:[&>p]:mb-0 leading-[20px] font-normal not-italic"
        ref={containerRef}
      >
        {turnNumber !== undefined && (
          <div
            id={`turn-${turnNumber}`}
            className="mb-4 pb-2 border-b border-stone-400/30 dark:border-slate-800/50 scroll-mt-20"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-mystic-accent mb-1 opacity-80">
              {turnNumber === 0 ? "Khởi Đầu (Lượt 0)" : `Lượt ${turnNumber}`}
            </div>
          </div>
        )}
        {renderContentBlocks(mainContent) ||
          (isStreaming ? null : (
            <div className="text-stone-500 italic text-sm">
              [Nội dung truyện trống - AI có thể đã gặp lỗi hoặc chỉ phản hồi
              các thẻ hệ thống. Bạn có thể thử 'Regenerate' hoặc kiểm tra 'Edit
              Raw' để xem dữ liệu gốc]
            </div>
          ))}
      </div>
    );
  },
);

interface GameplayChatAreaProps {
  scrollViewportRef: React.RefObject<HTMLDivElement>;
  chatEndRef: React.RefObject<HTMLDivElement>;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  displayedMessages: ChatMessage[];
  startIndex: number;
  history: ChatMessage[];
  isLoading: boolean;
  combinedRegexScripts: RegexScript[];
  activeWorld: WorldData;
  settings: AppSettings | null;
  currentPage: number;
  handleMessageUpdate: (index: number, newText: string) => void;
  handleToggleHideMessage: (index: number) => void;
  handleEntityClick: (name: string) => void;
  handleSwipe: (index: number, direction: "prev" | "next") => void;
  totalCount: number;
  isTavernHelperReady?: boolean;
}

export const GameplayChatArea: React.FC<GameplayChatAreaProps> = ({
  scrollViewportRef,
  chatEndRef,
  handleScroll,
  displayedMessages,
  startIndex,
  history,
  isLoading,
  combinedRegexScripts,
  activeWorld,
  settings,
  currentPage,
  handleMessageUpdate,
  handleToggleHideMessage,
  handleEntityClick,
  handleSwipe,
  totalCount,
  isTavernHelperReady = true,
}) => {
  if (!isTavernHelperReady) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-3 bg-stone-300 dark:bg-mystic-900">
        <Loader2 className="w-8 h-8 text-mystic-accent animate-spin" />
        <span className="text-sm font-medium text-stone-500 dark:text-slate-400">
          Đang tải dữ liệu TavernHelper...
        </span>
      </div>
    );
  }

  const [playingTtsId, setPlayingTtsId] = useState<string | null>(null);
  const [ttsErrorId, setTtsErrorId] = useState<string | null>(null);

  const lastPlayedSwipeKeyRef = useRef<string>("");
  const prevIsLoadingRef = useRef(false);

  // Sync ElevenLabs & Browser TTS playback state changes
  useEffect(() => {
    const handleTtsState = (playing: boolean, activeId: string | null) => {
      setPlayingTtsId(playing ? activeId : null);
    };
    elevenLabsService.addListener(handleTtsState);
    browserTtsService.addListener(handleTtsState);
    return () => {
      elevenLabsService.removeListener(handleTtsState);
      browserTtsService.removeListener(handleTtsState);
      // Clean up sound on destroy
      elevenLabsService.stop();
      browserTtsService.stop();
    };
  }, []);

  // ElevenLabs & Browser Autoplay effect of newly received messages & swiped variations (lượt)
  useEffect(() => {
    if (displayedMessages.length === 0) {
      prevIsLoadingRef.current = isLoading;
      return;
    }

    const lastMsg = displayedMessages[displayedMessages.length - 1];
    const isModel = lastMsg.role === "model";
    const swipes = lastMsg.swipes || [lastMsg.text];
    const swipeIndex = lastMsg.swipeIndex || 0;
    const textToPlay = swipes[swipeIndex] || "";
    const turnNum = lastMsg.turnNumber ?? -1;

    // We autoplay in two scenarios if autoPlay is enabled:
    // 1. Transition when streaming ends: isLoading goes from true to false
    const streamFinished = prevIsLoadingRef.current && !isLoading;
    
    // 2. Swiping the last message: the text or swipeIndex of the last message changes while not loading
    const currentSwipeKey = `${turnNum}-${swipeIndex}`;
    const swipeChanged = !isLoading && lastPlayedSwipeKeyRef.current !== currentSwipeKey;

    const shouldPlay = isModel && textToPlay && (streamFinished || swipeChanged);

    if (shouldPlay) {
      lastPlayedSwipeKeyRef.current = currentSwipeKey;
      const msgId = lastMsg.id || `msg-${startIndex + displayedMessages.length - 1}`;
      if (settings?.browserTtsEnabled && settings?.browserTtsAutoPlay) {
        browserTtsService.speak(textToPlay, msgId, settings).catch(() => {});
      } else if (settings?.elevenLabsEnabled && settings?.elevenLabsAutoPlay) {
        elevenLabsService.speak(textToPlay, msgId, settings).catch(() => {});
      }
    }

    // Always keep swipe key in sync while not loading
    if (!isLoading) {
      lastPlayedSwipeKeyRef.current = currentSwipeKey;
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, displayedMessages, settings, startIndex]);

  return (
    <>
      <div
        ref={scrollViewportRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-5 space-y-4 w-full bg-stone-300 dark:bg-mystic-900"
      >
        {displayedMessages.map((msg, idx) => {
          const globalIndex = startIndex + idx;
          const isModel = msg.role === "model";
          const swipes = msg.swipes || [msg.text];
          const swipeIndex = msg.swipeIndex || 0;
          const displayText = swipes[swipeIndex] || "";

          // Check if this message is currently being streamed
          // It is streaming if we are loading AND it is the very last message in the entire history
          const isStreamingMsg =
            isLoading && globalIndex === history.length - 1;

          return (
            <motion.div
              key={`${currentPage}-${idx}`}
              id={
                isModel && msg.turnNumber !== undefined
                  ? `turn-${msg.turnNumber}`
                  : undefined
              }
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex w-full ${!isModel ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`relative rounded-lg p-3 md:p-5 leading-relaxed shadow-md text-base flex flex-col gap-2 transition-all ${
                  !isModel
                    ? "bg-stone-200 dark:bg-slate-800 border border-stone-400 dark:border-slate-700 text-stone-800 dark:text-slate-200 rounded-tr-none max-w-[90%] md:max-w-[85%]"
                    : "bg-transparent text-stone-800 dark:text-slate-300 pl-0 w-full"
                } ${msg.isHidden ? "opacity-50 grayscale" : ""}`}
              >
                <TawaMessageRenderer
                  index={globalIndex}
                  text={displayText}
                  onUpdate={handleMessageUpdate}
                  isStreaming={isStreamingMsg} // Pass prop
                  regexScripts={combinedRegexScripts}
                  entities={activeWorld.entities}
                  onEntityClick={handleEntityClick}
                  turnNumber={isModel ? msg.turnNumber : undefined}
                  userAction={isModel ? msg.userAction : undefined}
                  playerName={activeWorld.player.name}
                  playerAvatar={activeWorld.player.avatar}
                  messageRole={isModel ? "assistant" : "user"}
                  contentBeautify={settings?.contentBeautify}
                  totalCount={history.length}
                  isHidden={msg.isHidden}
                  onToggleHide={handleToggleHideMessage}
                  metadata={msg.metadata}
                />

                {/* Grounding Sources (Search citations) */}
                {isModel && msg.groundingSources && msg.groundingSources.length > 0 && (
                  <div className="mt-2.5 p-3 bg-stone-400/10 dark:bg-slate-800/30 rounded-lg border border-stone-400/20 dark:border-slate-800/60 text-xs w-full">
                    <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold mb-2">
                      <Globe size={13} className="shrink-0" />
                      <span>Thông tin hỗ trợ tìm kiếm (Google Search Grounding)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.groundingSources.map((src, sIdx) => (
                        <a
                          key={sIdx}
                          href={src.uri}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="flex items-center gap-1 px-2.5 py-1 bg-stone-300/40 hover:bg-stone-300 dark:bg-slate-700/35 dark:hover:bg-slate-700/70 rounded border border-stone-400/20 dark:border-slate-600/30 text-stone-600 dark:text-slate-450 hover:text-purple-600 dark:hover:text-purple-300 transition-all max-w-[240px]"
                          title={src.title}
                        >
                          <span className="truncate">{src.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* DEEP-LOGIC Logical Compliance Report */}
                {isModel && msg.deepLogicResult && (
                  <div className="mt-2.5 text-xs border border-teal-500/35 dark:border-teal-400/25 bg-teal-50/10 dark:bg-teal-500/5 rounded-xl p-3 flex flex-col gap-1.5 font-sans leading-relaxed select-none">
                    <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-bold uppercase tracking-wider text-[10px]">
                      <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse inline-block" />
                      <span>Bộ kiểm duyệt DEEP-LOGIC v2.0 (Active)</span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Độ tương thích logic:</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        msg.deepLogicResult.complianceScore >= 85
                          ? "bg-emerald-550/20 text-emerald-600 dark:text-emerald-400"
                          : msg.deepLogicResult.complianceScore >= 70
                            ? "bg-amber-550/20 text-amber-600 dark:text-amber-400"
                            : "bg-rose-550/20 text-rose-600 dark:text-rose-450"
                      }`}>
                        {msg.deepLogicResult.complianceScore}% / 100%
                      </span>
                      <span className={`text-[10px] uppercase font-extrabold tracking-wider ${
                        msg.deepLogicResult.status === "APPROVED"
                          ? "text-emerald-500 font-semibold"
                          : "text-rose-500 font-bold"
                      }`}>
                        ({msg.deepLogicResult.status === "APPROVED" ? "Hợp lệ" : "Đã Tự Sửa Lỗi / Auto-Corrected"})
                      </span>
                    </div>

                    {msg.deepLogicResult.violations && msg.deepLogicResult.violations.length > 0 && (
                      <div className="mt-1 flex flex-col gap-1">
                        <span className="text-slate-500 dark:text-slate-400 font-medium text-[10px]">Phân tích lỗi & Cheat:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-400">
                          {msg.deepLogicResult.violations.map((v: string, vIdx: number) => (
                            <li key={vIdx}>{v}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Swipe Controls for AI Messages */}
                {isModel && !isStreamingMsg && (
                  <div className="flex items-center gap-2 mt-1 select-none w-full border-t border-stone-400 dark:border-slate-800/50 pt-2">
                    <div className="flex items-center bg-stone-300 dark:bg-slate-800/50 rounded-lg p-0.5 border border-stone-400 dark:border-slate-700/50">
                      <button
                        onClick={() => handleSwipe(globalIndex, "prev")}
                        disabled={swipeIndex === 0}
                        className="p-1 hover:bg-stone-400 dark:hover:bg-slate-700 rounded text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Phiên bản cũ hơn"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-[10px] font-mono text-stone-400 dark:text-slate-500 px-2 min-w-[40px] text-center">
                        {swipeIndex + 1}/{swipes.length}
                      </span>
                      <button
                        onClick={() => handleSwipe(globalIndex, "next")}
                        className="p-1 hover:bg-stone-400 dark:hover:bg-slate-700 rounded text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white disabled:opacity-30 transition-colors"
                        title={
                          swipeIndex === swipes.length - 1
                            ? "Tạo lại (Regenerate)"
                            : "Phiên bản mới hơn"
                        }
                      >
                        {swipeIndex === swipes.length - 1 ? (
                          <RefreshCw
                            size={14}
                            className={
                              isLoading ? "animate-spin text-mystic-accent" : ""
                            }
                          />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                    </div>
                    {swipes.length > 1 && (
                      <span className="text-[10px] text-stone-400 dark:text-slate-600 italic">
                        {swipeIndex === swipes.length - 1
                          ? "Lastest"
                          : "History"}
                      </span>
                    )}

                    {(settings?.elevenLabsEnabled || settings?.browserTtsEnabled) && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        {ttsErrorId === (msg.id || `msg-${globalIndex}`) && (
                          <span className="text-[10px] text-red-500 font-medium animate-pulse">
                            Lỗi phát âm
                          </span>
                        )}
                        <button
                          onClick={async () => {
                            const msgId = msg.id || `msg-${globalIndex}`;
                            setTtsErrorId(null);
                            try {
                              if (settings?.browserTtsEnabled) {
                                await browserTtsService.speak(displayText, msgId, settings);
                              } else {
                                await elevenLabsService.speak(displayText, msgId, settings);
                              }
                            } catch (e: any) {
                              setTtsErrorId(msgId);
                              setTimeout(() => setTtsErrorId(null), 4000);
                            }
                          }}
                          className={`p-1.5 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                            playingTtsId === (msg.id || `msg-${globalIndex}`)
                              ? "bg-mystic-accent/10 border border-mystic-accent/30 text-mystic-accent shadow-sm animate-pulse"
                              : "bg-stone-300 hover:bg-stone-400 dark:bg-slate-800/40 dark:hover:bg-slate-700/65 text-stone-550 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white border border-transparent hover:border-stone-400/40"
                          }`}
                          title={
                            playingTtsId === (msg.id || `msg-${globalIndex}`)
                              ? "Dừng giọng đọc"
                              : settings?.browserTtsEnabled
                              ? "Đọc bằng giọng đọc trình duyệt"
                              : "Đọc bằng ElevenLabs TTS"
                          }
                        >
                          <Volume2
                            size={14}
                            className={playingTtsId === (msg.id || `msg-${globalIndex}`) ? "animate-bounce text-mystic-accent" : ""}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        {isLoading && !history[history.length - 1]?.text && (
          /* Only show loader if we are NOT streaming (if streaming, text updates live) */
          <div className="flex flex-col items-center justify-center p-6 space-y-3 animate-fade-in w-full border-t border-stone-400 dark:border-slate-800/30">
            <Loader2 className="w-8 h-8 text-mystic-accent animate-spin" />
            <span className="text-sm font-medium text-stone-500 dark:text-slate-400 animate-pulse">
              Đang kiến tạo diễn biến...
            </span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
    </>
  );
};
