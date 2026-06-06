import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService, DEFAULT_SETTINGS } from '../../../services/db/indexedDB';
import { vectorService } from '../../../services/ai/vectorService';
import { GraphRAGService } from '../../../services/ai/graph/GraphRAGService';
import { worldAiService } from '../../../services/ai/world-creation/service';
import { AppSettings, GameState, NavigationProps } from '../../../types';
import { ChevronLeft, FileText, Upload, Play, Trash2, StopCircle, CheckCircle2, AlertTriangle, HelpCircle, BookOpen, BrainCircuit } from 'lucide-react';
import Button from '../../ui/Button';

// Smart sentence-boundary chunker
const chunkTextSmart = (text: string, wordsPerChunk: number, overlapWords: number) => {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks: string[] = [];
  let i = 0;
  
  while (i < words.length) {
    let limit = Math.min(i + wordsPerChunk, words.length);
    
    // Attempt to locate a sentence breaker near the limit to avoid mid-phrase fragmentation
    if (limit < words.length) {
      let boundaryIndex = -1;
      const lookbackWindow = Math.max(10, Math.floor(wordsPerChunk * 0.2)); // up to 20% lookback
      
      const boundaryPunctuation = ['.', '?', '!', ';'];
      for (let j = limit; j > limit - lookbackWindow && j > i; j--) {
        const lastChar = words[j - 1]?.slice(-1);
        if (boundaryPunctuation.includes(lastChar) || words[j - 1]?.includes('\n')) {
          boundaryIndex = j;
          break;
        }
      }
      
      if (boundaryIndex !== -1) {
        limit = boundaryIndex;
      }
    }
    
    const chunkWords = words.slice(i, limit);
    if (chunkWords.length > 0) {
      chunks.push(chunkWords.join(' '));
    }
    
    // Advance next start offset with safety boundary
    const stepSize = wordsPerChunk - overlapWords;
    if (stepSize <= 0) {
      i = limit;
    } else {
      const nextI = limit - overlapWords;
      if (nextI <= i) {
        i = limit; // Force advance to the chunk's end to avoid infinite loop
      } else {
        i = nextI;
      }
    }
  }
  return chunks;
};

// Simple text chunker (Fallback legacy)
const chunkTextLegacy = (text: string, wordsPerChunk: number, overlapWords: number) => {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunkWords = words.slice(i, i + wordsPerChunk);
    if (chunkWords.length > 0) {
      chunks.push(chunkWords.join(' '));
    }
    i += (wordsPerChunk - overlapWords);
    if (wordsPerChunk - overlapWords <= 0) break;
  }
  return chunks;
};

// Text cleaning/denoising logic
const cleanTextData = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n') // Unify line endings
    .replace(/\n{3,}/g, '\n\n') // Flatten extensive spacing
    .replace(/[ \t]+/g, ' ') // Collapse horizontal double-spaces
    .trim();
};

export default function KnowledgeTrainScreen({ onNavigate }: NavigationProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [files, setFiles] = useState<File[]>([]);
  const [storyName, setStoryName] = useState('');
  const [wordsPerChunk, setWordsPerChunk] = useState(1000); // Default to 1000
  const [overlapWords, setOverlapWords] = useState(100); // Default to 100
  const [chunkingStrategy, setChunkingStrategy] = useState<'standard' | 'parent-child'>('standard');
  const [autoCleanup, setAutoCleanup] = useState(true); // Default to true
  const [embeddingSource, setEmbeddingSource] = useState<'local' | 'cloud'>('local'); // Default to local for zero cost
  const [smartSentenceSplit, setSmartSentenceSplit] = useState(true);
  const [denoiseText, setDenoiseText] = useState(true);
  const [runLangGraphMetadata, setRunLangGraphMetadata] = useState(false);

  const [totalWords, setTotalWords] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [actualChunksCreated, setActualChunksCreated] = useState<number | null>(null);
  const [trainedData, setTrainedData] = useState<any[] | null>(null);

  const [activeTrainTab, setActiveTrainTab] = useState<'knowledge' | 'rules'>('knowledge');
  const [extractedRules, setExtractedRules] = useState<string[]>([]);
  const [isExtractingRules, setIsExtractingRules] = useState(false);
  const [aiModelForRules, setAiModelForRules] = useState<string>('gemini-3.5-flash');
  const [rulesCount, setRulesCount] = useState<number>(100);
  const [wordsPerRule, setWordsPerRule] = useState<number>(100);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isCancelledRef = useRef<boolean>(false);

  const [bgImage, setBgImage] = useState<string | null>(null);
  const bgBlur = dbService.getKeyValueSync('ark_v2_bg_blur') !== false && dbService.getKeyValueSync('ark_v2_bg_blur') !== 'false';

  useEffect(() => {
    dbService.getSettings().then(s => {
      if (s) setSettings(s);
    });

    dbService.getAsset('ark_v2_custom_bg').then(savedBg => {
      if (savedBg) {
        setBgImage(savedBg);
      } else {
        dbService.getAsset('ark_v1_custom_bg').then(legacyBg => {
          if (legacyBg) {
            setBgImage(legacyBg);
          } else {
            setBgImage(null);
          }
        });
      }
    });
  }, []);

  // Calculate total words asynchronously when files selection changes
  useEffect(() => {
    let active = true;
    const calculateTotalWords = async () => {
      let words = 0;
      for (const file of files) {
        try {
          const text = await file.text();
          words += text.split(/\s+/).filter(w => w.trim().length > 0).length;
        } catch (e) {
          console.error(e);
        }
      }
      if (active) {
        setTotalWords(words);
      }
    };
    calculateTotalWords();
    return () => {
      active = false;
    };
  }, [files]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
      if (selectedFiles.length > 0 && !storyName) {
        setStoryName(selectedFiles[0].name.replace('.txt', ''));
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addLog = (msg: string) => {
    setLogs(prev => {
      const newLogs = [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`];
      return newLogs.length > 100 ? newLogs.slice(newLogs.length - 100) : newLogs;
    });
  };

  const startTraining = async () => {
    if (files.length === 0) {
      addLog("Lỗi: Vui lòng chọn ít nhất 1 file TXT.");
      return;
    }
    if (!storyName.trim()) {
      addLog("Lỗi: Vui lòng nhập Tên Knowledge.");
      return;
    }
    if (wordsPerChunk <= 0 || overlapWords < 0 || overlapWords >= wordsPerChunk) {
      addLog("Lỗi: Cài đặt Chunk không hợp lệ.");
      return;
    }

    setIsTraining(true);
    isCancelledRef.current = false;
    setLogs([]);
    setActualChunksCreated(0);
    setProgress({ current: 0, total: 0 });
    setTrainedData(null);

    addLog(`🚀 Khởi động tiến trình trích lọc Tri thức: ${storyName}`);
    addLog(`📁 Đang xử lý ${files.length} tệp tin văn bản nguồn.`);
    addLog(`⚙️ Chế độ Embedding: ${embeddingSource === 'local' ? "CỤC BỘ (100% Miễn phí & On-Device)" : "ĐÁM MÂY (Sử dụng API Key)"}`);
    if (embeddingSource === 'local') {
      addLog("🤖 Đang tải mô hình NLP cục bộ tại trình duyệt (Không tốn token)...");
    }

    try {
      let combinedText = '';
      for (const file of files) {
        addLog(`📖 Đọc hoàn toàn: ${file.name}...`);
        const text = await file.text();
        combinedText += text + '\n\n';
      }

      if (denoiseText) {
        addLog("✨ Đang khử nhiễu văn bản (Chuẩn hóa dải ký tự xuống dòng và khoảng trắng thừa)...");
        combinedText = cleanTextData(combinedText);
      } else {
        addLog("📝 Không khử nhiễu văn bản. Giữ nguyên định dạng gốc.");
        combinedText = combinedText.trim();
      }

      const words = combinedText.split(/\s+/).filter(w => w.length > 0);
      const totalWordsCount = words.length;
      addLog(`📊 Đã nạp thành công: ${totalWordsCount.toLocaleString()} từ văn bản.`);

      // Generate Chunks
      const chunks = smartSentenceSplit
        ? chunkTextSmart(combinedText, wordsPerChunk, overlapWords)
        : chunkTextLegacy(combinedText, wordsPerChunk, overlapWords);

      addLog(`📦 Chia thành công thành: ${chunks.length} phân đoạn.`);
      setProgress({ current: 0, total: chunks.length });

      const embeddedData: any[] = [];
      let successCount = 0;
      let failCount = 0;
      const targetDocId = storyName.trim().replace(/\s+/g, '_');

      // Clear any prior temporary embeddings under same storyName inside DB to write fresh
      addLog(`🧹 Đồng bộ IndexedDB cho Knowledge ID: ${targetDocId}...`);
      try {
        await dbService.deleteVectorsByDocId(targetDocId);
      } catch (e: any) {
        addLog(`⚠️ Cảnh báo chuẩn bị DB: ${e.message}`);
      }

      // Loop over chunks to query model embeddings
      for (let idx = 0; idx < chunks.length; idx++) {
        await new Promise(resolve => setTimeout(resolve, 50)); // UI friendly delay

        if (isCancelledRef.current) {
          addLog("🛑 Tiến trình huấn luyện đã bị dừng bởi người dùng.");
          break;
        }

        const chunkText = chunks[idx];
        const chunkId = `${targetDocId}_chunk_${idx}`;
        addLog(`⚡ Đang tạo embedding phân đoạn [${idx + 1}/${chunks.length}]...`);

        try {
          const embedding = await vectorService.getEmbedding(chunkText, settings, embeddingSource === 'local');
          if (!embedding) {
            throw new Error("API Embedding trả về giá trị rỗng/null.");
          }

          const embeddedItem = {
            id: chunkId,
            text: chunkText,
            embedding,
            meta: {
              story: storyName,
              chunkIndex: idx
            }
          };
          embeddedData.push(embeddedItem);
          successCount++;
          setActualChunksCreated(successCount);

          // Temporarily store in local DB
          await dbService.saveVector({
            id: chunkId,
            text: chunkText,
            embedding,
            timestamp: Date.now(),
            role: 'novel_source',
            docId: targetDocId,
            category: 'lore'
          });

          // Run LangGraph AI Metadata Flow if checked
          if (runLangGraphMetadata) {
            addLog(`🧠 Đang kích hoạt luồng đồ thị LangGraph AI Metadata cho phân đoạn [${idx + 1}/${chunks.length}]...`);
            try {
              const graphResult = await GraphRAGService.runLangGraphMetadataFlow(
                chunkText,
                targetDocId,
                settings,
                (node, status, data) => {
                  if (status === 'running') {
                    addLog(`  ↳ [LangGraph] Node <${node}> đang chạy...`);
                  } else if (status === 'completed') {
                    if (node === 'extract_meta') {
                      addLog(`  ↳ [LangGraph] Node <${node}> hoàn tất: Trích chọn ${data?.entitiesCount || 0} thực thể.`);
                    } else if (node === 'link_relations') {
                      addLog(`  ↳ [LangGraph] Node <${node}> hoàn tất: Đã lập quan hệ và tích hợp dữ liệu.`);
                    }
                  }
                }
              );
              if (graphResult.entities.length > 0) {
                addLog(`  ✓ Đồ thị liên kết thành công: ${graphResult.entities.length} nút mạng và ${graphResult.edges.length} quan hệ.`);
              }
            } catch (err: any) {
              addLog(`  ⚠️ LangGraph Flow cảnh báo: ${err.message}`);
            }
          }
        } catch (err: any) {
          failCount++;
          addLog(`❌ THẤT BẠI EMBEDDING TẠI PHÂN ĐOẠN ${idx + 1}: ${err.message}`);
          addLog(`🛑 Tiến trình huấn luyện bách phân thất bại và TỰ ĐỘNG DỪNG LẠI LẬP TỨC để tránh lãng phí token.`);
          
          // Clean up partial vectors already saved
          try {
            await dbService.deleteVectorsByDocId(targetDocId);
            addLog(`🧹 Đã dọn dẹp thành công ${successCount} phân đoạn tri thức tạm thời vừa nạp.`);
          } catch (e: any) {
            addLog(`⚠️ Lỗi dọn dẹp DB: ${e.message}`);
          }
          
          isCancelledRef.current = true;
          break;
        }

        setProgress(prev => ({ ...prev, current: idx + 1 }));
      }

      if (!isCancelledRef.current) {
        addLog(`\n🎉 Trích xuất hoàn thành! Thành công: ${successCount} chunks, Thất bại: ${failCount}.`);
        
        // Save trained data for explicit manual download
        setTrainedData(embeddedData);
        addLog(`📂 Đã nén tri thức thành dữ liệu cấu trúc sẵn sàng (${embeddedData.length} phân đoạn).`);
        addLog(`💡 Vui lòng nhấp vào nút "TẢI XUỐNG TỆP TRI THỨC (.JSON)" xuất hiện bên phải dưới màn hình để tải file về máy.`);

        // Check if auto cleanup is active
        if (autoCleanup) {
          addLog(`🧹 Đang dọn dẹp hệ thống vectors huấn luyện tạm thời...`);
          try {
            await dbService.deleteVectorsByDocId(targetDocId);
            addLog(`✅ Đã giải phóng bộ nhớ IndexedDB thành công.`);
          } catch (err: any) {
            addLog(`⚠️ Thất bại khi giải phóng DB: ${err.message}`);
          }
        } else {
          addLog(`💾 Giữ lại bộ lưu trữ vectors trực tiếp trong database game.`);
        }

        addLog("✨ Khởi chạy hoàn tất mĩ mẫn!");
      }

    } catch (err: any) {
      addLog(`❌ Gặp sự cố không mong muốn: ${err.message}`);
    } finally {
      setIsTraining(false);
    }
  };

  const exportData = (data: any[]) => {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.href = url;
      downloadAnchorNode.setAttribute("download", `Knowledge_${storyName.trim().replace(/\s+/g, '_')}_${Date.now()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      URL.revokeObjectURL(url);
      addLog("💾 Tải xuống JSON tri thức thành công.");
    } catch (err) {
      addLog("❌ Không thể xuất tệp tải về: " + err);
    }
  };

  const stopTraining = () => {
    isCancelledRef.current = true;
    addLog("⏳ Đang gửi yêu cầu dừng...");
  };

  const startRulesExtraction = async () => {
    if (files.length === 0) {
      addLog("Lỗi: Vui lòng chọn ít nhất 1 file TXT để phân tích quy luật.");
      return;
    }
    if (!storyName.trim()) {
      addLog("Lỗi: Vui lòng nhập Tên bối cảnh thế giới thương thảo.");
      return;
    }

    setIsExtractingRules(true);
    setLogs([]);
    addLog(`🚀 Khởi động tiến trình Biên soạn Quy luật Thế giới: ${storyName}`);
    addLog(`📁 Đọc hoàn toàn ${files.length} tệp tin văn bản nguồn.`);
    
    try {
      let combinedText = '';
      for (const file of files) {
        addLog(`📖 Đang nạp văn bản: ${file.name}...`);
        const text = await file.text();
        combinedText += text + '\n\n';
      }

      if (denoiseText) {
        combinedText = cleanTextData(combinedText);
      }

      addLog(`🧠 Đang kích hoạt Trình thiết kế luật tối cao (Gemini Model: ${aiModelForRules})...`);
      addLog(`⚡ Đang phân tích ranh giới phép thuật, hạn mức công năng, phản phệ và quy ước bối cảnh...`);
      addLog(`⏳ Thao tác phân tích có thể mất 30-60 giây tùy thuộc vào dung lượng tri thức bối cảnh thương lượng...`);
      
      const rules = await worldAiService.extractRulesFromKnowledge(
        combinedText,
        `Thế giới huyền thoại có tên: ${storyName}`,
        aiModelForRules,
        settings,
        rulesCount,
        wordsPerRule
      );

      if (rules && rules.length > 0) {
        setExtractedRules(rules);
        addLog(`\n🎉 Trích chọn Quy luật hoàn tất! Đã đúc rút thành công ${rules.length} quy luật bối cảnh rời rạc.`);
        addLog(`📂 Quy luật bối cảnh sẵn sàng tải về làm tệp định hình AI riêng biệt.`);
      } else {
        addLog("⚠️ Cảnh báo: AI phản hồi rỗng hoặc cấu hình không khớp. Vui lòng kiểm tra lại API Key hoặc nội dung văn bản.");
      }
    } catch (err: any) {
      addLog(`❌ Tiến trình trích luật thất bại: ${err.message}`);
    } finally {
      setIsExtractingRules(false);
    }
  };

  const exportRulesJson = (rulesList: string[]) => {
    try {
      const exportObj = {
        type: "world_rules_preset",
        worldName: storyName.trim(),
        rules: rulesList,
        timestamp: Date.now(),
        description: "Bản quy luật cấu hình thế giới riêng biệt tách rời với tri thức RAG"
      };
      const jsonStr = JSON.stringify(exportObj, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.href = url;
      downloadAnchorNode.setAttribute("download", `WorldRules_${storyName.trim().replace(/\s+/g, '_')}_${Date.now()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      URL.revokeObjectURL(url);
      addLog("💾 Xuất tệp quy luật riêng (.json) thành công.");
    } catch (err: any) {
      addLog("❌ Không thể tải tệp quy luật: " + err.message);
    }
  };

  // Validation Check
  const isValid = wordsPerChunk > 0 && overlapWords >= 0 && overlapWords < wordsPerChunk && files.length > 0 && storyName.trim().length > 0;

  // Estimates Chunks
  const divisor = wordsPerChunk - overlapWords;
  const estimatedChunks = totalWords > 0 && divisor > 0 ? Math.ceil(totalWords / divisor) : 0;

  const displayChunksCount = isTraining || actualChunksCreated !== null
    ? `${actualChunksCreated ?? 0} / ${estimatedChunks}`
    : `${estimatedChunks}`;

  const estChunkTokens = Math.round(wordsPerChunk * 1.4);
  const estTotalTokens = Math.round(totalWords * 1.4);

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden">
      {/* Background Layer */}
      {bgImage && (
        <>
          <div 
            className="absolute inset-0 z-0 transition-all duration-700"
            style={{ 
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `brightness(0.3) ${bgBlur ? 'blur(8px)' : 'blur(0px)'}`
            }}
          />
          <div className="absolute inset-0 z-0 bg-stone-100/30 dark:bg-black/50 backdrop-blur-[4px]" />
        </>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 relative z-10 w-full overflow-hidden mt-safe">
        {/* Header */}
        <div className="w-full max-w-5xl flex items-center justify-between mb-4 mt-2">
          <div className="w-32 flex justify-start">
            <button 
              onClick={() => onNavigate(GameState.MENU)} 
              disabled={isTraining || isExtractingRules} 
              className="text-slate-600 dark:text-slate-300 hover:text-mystic-accent transition-colors flex items-center gap-2 bg-[#e6ebf4] dark:bg-[#0b1329] p-2.5 rounded-xl border border-[#cbd2df]/20 dark:border-[#142042]/10 shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df] dark:active:shadow-[inset_2px_2px_4px_#030610] disabled:opacity-50"
              id="back_to_menu_btn"
            >
              <ChevronLeft size={18} /> 
              <span className="hidden sm:inline font-bold uppercase tracking-wider text-xs">Menu</span>
            </button>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white drop-shadow-md tracking-[0.2em] uppercase font-serif text-center flex-1">
            Train & Craft Space
          </h2>
          <div className="w-32 flex justify-end" />
        </div>

        {/* Tabs Switcher: Knowledge Vectors vs World Rules */}
        <div className="w-full max-w-5xl mb-4 flex flex-col sm:flex-row gap-3 relative z-10 w-full">
          <button
            onClick={() => setActiveTrainTab('knowledge')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-black uppercase text-xs tracking-wider border transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
              activeTrainTab === 'knowledge'
                ? 'bg-[#e0e6f0] dark:bg-[#0d152a] border-mystic-accent text-mystic-accent shadow-[inset_2px_2px_5px_#cbd2df] dark:shadow-[inset_2px_2px_5px_#030610]'
                : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-500 dark:text-slate-400 hover:text-mystic-accent shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042]'
            }`}
            id="tab_train_knowledge_btn"
          >
            <BookOpen size={15} />
            <span>1. Train Vectors Tri Thức</span>
          </button>
          
          <button
            onClick={() => setActiveTrainTab('rules')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-black uppercase text-xs tracking-wider border transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
              activeTrainTab === 'rules'
                ? 'bg-[#e0e6f0] dark:bg-[#0d152a] border-purple-500 text-purple-600 dark:text-purple-400 shadow-[inset_2px_2px_5px_#cbd2df] dark:shadow-[inset_2px_2px_5px_#030610]'
                : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-500 dark:text-slate-400 hover:text-purple-500 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042]'
            }`}
            id="tab_train_rules_btn"
          >
            <BrainCircuit size={15} />
            <span>2. Trích Luật Thế Giới ({rulesCount} luật)</span>
          </button>
        </div>

        {/* Simplified Neumorphic Training Panel */}
        <div className="w-full max-w-5xl flex-1 flex flex-col md:grid md:grid-cols-2 md:gap-6 bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/30 dark:border-[#142042]/20 rounded-3xl shadow-[12px_12px_24px_#cbd2df,-12px_-12px_24px_#ffffff] dark:shadow-[12px_12px_24px_#030610,-12px_-12px_24px_#142042] min-h-0 mx-auto p-4 md:p-6 overflow-y-auto custom-scrollbar">
          
          {/* Left Column: Data Import & Settings */}
          <div className="space-y-4 flex flex-col">
            {/* Nhập file txt block */}
            <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-4 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042]">
              <h3 className="font-bold text-mystic-accent uppercase tracking-wider text-xs flex items-center gap-2 mb-3">
                <FileText size={16} /> Nhập file txt bối cảnh
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Chọn File TXT:</span>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".txt"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isTraining || isExtractingRules}
                  />
                  <Button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="bg-mystic-accent text-mystic-950 font-black tracking-wider shadow-[2px_2px_5px_#cbd2df,-2px_-2px_5px_#ffffff] dark:shadow-[2px_2px_5px_#030610,-2px_-2px_5px_#142042] hover:scale-[1.01] active:scale-[0.99] transition-transform text-xs py-1.5 px-3"
                    disabled={isTraining || isExtractingRules}
                    id="choose_txt_file_btn"
                  >
                    <Upload size={14} className="mr-1" /> Duyệt File
                  </Button>
                </div>

                <div className="border-t border-[#cbd2df]/40 dark:border-[#142042]/20 pt-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Files đã chọn:</span>
                  {files.length === 0 ? (
                    <span className="text-xs text-slate-400 italic block pl-1">Chưa chọn file nào</span>
                  ) : (
                    <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1.5">
                      {files.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-[#e0e6f0]/60 dark:bg-[#080d1c]/40 px-2 py-1 relative rounded border border-[#cbd2df]/30 dark:border-[#142042]/10">
                          <span className="truncate pr-2 text-stone-900 dark:text-slate-200 font-medium">{file.name}</span>
                          <button 
                            type="button"
                            onClick={() => removeFile(idx)} 
                            disabled={isTraining || isExtractingRules} 
                            className="text-red-500 hover:text-red-400 shrink-0 p-0.5"
                            title="Xóa"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tên Knowledge Selection */}
            <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-4 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042]">
              <label className="block text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Tên Thế Giới / Bối Cảnh:
              </label>
              <input 
                type="text" 
                value={storyName}
                onChange={(e) => setStoryName(e.target.value)}
                className="w-full bg-[#cbd2df]/20 dark:bg-[#030610]/45 border border-[#cbd2df]/30 dark:border-[#142042]/25 rounded-xl px-4 py-2 text-xs text-stone-900 dark:text-slate-200 focus:outline-none focus:border-mystic-accent transition-all font-semibold shadow-[offset_1px_2px_4px_rgba(0,0,0,0.06)] dark:shadow-[inset_1px_2px_4px_rgba(0,0,0,0.5)]"
                placeholder="Nhập tên thế giới để định danh..."
                disabled={isTraining || isExtractingRules}
                id="story_knowledge_name_input"
              />
            </div>

            {activeTrainTab === 'knowledge' ? (
              <>
                {/* Chiến lược chunk selection */}
                <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-4 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042]">
                  <label className="block text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                    Chiến lược Chunk:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setChunkingStrategy('standard')}
                      className={`py-1.5 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        chunkingStrategy === 'standard'
                          ? 'bg-[#e0e6f0] dark:bg-[#080d1c] border-mystic-accent text-mystic-accent shadow-[inset_2px_2px_4px_#cbd2df] dark:shadow-[inset_2px_2px_4px_#030610]'
                          : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-550 hover:text-slate-800 dark:hover:text-slate-250 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[10px_10px_20px_#030610,-10px_-10px_20px_#142042]'
                      }`}
                      disabled={isTraining}
                      id="strategy_standard_btn"
                    >
                      Standard Chunking
                    </button>
                    <button
                      type="button"
                      onClick={() => setChunkingStrategy('parent-child')}
                      className={`py-1.5 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        chunkingStrategy === 'parent-child'
                          ? 'bg-[#e0e6f0] dark:bg-[#080d1c] border-mystic-accent text-mystic-accent shadow-[inset_2px_2px_4px_#cbd2df] dark:shadow-[inset_2px_2px_4px_#030610]'
                          : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-550 hover:text-slate-800 dark:hover:text-slate-250 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[10px_10px_20px_#030610,-10px_-10px_20px_#142042]'
                      }`}
                      disabled={isTraining}
                      id="strategy_parent_child_btn"
                    >
                      Parent-Child Smart
                    </button>
                  </div>
                </div>

                {/* Nguồn Embedding Selection */}
                <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-4 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042]">
                  <label className="block text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-bold flex items-center justify-between">
                    <span>Nguồn Embedding (Vectơ):</span>
                    <span className="text-[10px] text-green-500 font-extrabold normal-case">100% Free Mode</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEmbeddingSource('local')}
                      className={`py-1.5 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        embeddingSource === 'local'
                          ? 'bg-[#e0e6f0] dark:bg-[#080d1c] border-green-500 text-green-600 dark:text-green-400 shadow-[inset_2px_2px_4px_#cbd2df] dark:shadow-[inset_2px_2px_4px_#030610]'
                          : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-550 hover:text-slate-800 dark:hover:text-slate-250 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[10px_10px_20px_#030610,-10px_-10px_20px_#142042]'
                      }`}
                      disabled={isTraining}
                      id="source_local_btn"
                    >
                      On-Device (Free)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmbeddingSource('cloud')}
                      className={`py-1.5 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        embeddingSource === 'cloud'
                          ? 'bg-[#e0e6f0] dark:bg-[#080d1c] border-mystic-accent text-mystic-accent shadow-[inset_2px_2px_4px_#cbd2df] dark:shadow-[inset_2px_2px_4px_#030610]'
                          : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-550 hover:text-slate-800 dark:hover:text-slate-250 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[10px_10px_20px_#030610,-10px_-10px_20px_#142042]'
                      }`}
                      disabled={isTraining}
                      id="source_cloud_btn"
                    >
                      Gemini API (Cloud)
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-relaxed font-sans">
                    {embeddingSource === 'local' 
                      ? "✓ Sử dụng Web Transformers & nén hash cục bộ tại trình duyệt. Đảm bảo bảo mật toàn diện và hoàn toàn miễn phí."
                      : "⚠ Yêu cầu Gemini API Key hợp lệ và hoạt động có phí / giới hạn lượt gọi tương đương theo thiết lập."
                    }
                  </p>
                </div>

                {/* Advanced Configuration Options */}
                <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-4 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] space-y-3.5">
                  <label className="block text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 font-extrabold pb-1 border-b border-[#cbd2df]/20 dark:border-[#142042]/10 mb-2">
                    Tùy chọn Xử lý dữ liệu RAG:
                  </label>

                  {/* 1. Bật Chém Chữ Đọc Câu Thông Minh (Ưu tiên ngắt câu) */}
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={smartSentenceSplit}
                      onChange={(e) => setSmartSentenceSplit(e.target.checked)}
                      disabled={isTraining}
                      className="rounded border-[#cbd2df]/60 dark:border-slate-800 text-mystic-accent focus:ring-mystic-accent bg-[#e6ebf4] dark:bg-[#0b1329] w-4.5 h-4.5 transition-colors cursor-pointer mt-0.5"
                      id="smart_sentence_split_checkbox"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Bật Chém Chữ Đọc Câu Thông Minh
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5 font-medium">
                        Ưu tiên ngắt tại ranh giới kết thúc câu (. ; ? !) để bảo toàn câu đầy đủ, không xé nát ngữ cảnh văn học.
                      </span>
                    </div>
                  </label>

                  {/* 2. Khử Nhiễu văn bản (Khoảng trắng, dòng trống thừa) */}
                  <label className="flex items-start gap-2.5 cursor-pointer select-none border-t border-[#cbd2df]/15 dark:border-[#142042]/10 pt-2.5">
                    <input 
                      type="checkbox"
                      checked={denoiseText}
                      onChange={(e) => setDenoiseText(e.target.checked)}
                      disabled={isTraining}
                      className="rounded border-[#cbd2df]/60 dark:border-slate-800 text-mystic-accent focus:ring-mystic-accent bg-[#e6ebf4] dark:bg-[#0b1329] w-4.5 h-4.5 transition-colors cursor-pointer mt-0.5"
                      id="denoise_text_checkbox"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Khử Nhiễu văn bản
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5 font-medium">
                        Chuẩn hóa các dòng trống trùng lặp, xóa bớt khoảng trắng dư thừa và đồng bộ hóa ký tự xuống dòng.
                      </span>
                    </div>
                  </label>

                  {/* 3. Chạy luồng đồ thị trạng thái LangGraph AI Metadata */}
                  <label className="flex items-start gap-2.5 cursor-pointer select-none border-t border-[#cbd2df]/15 dark:border-[#142042]/10 pt-2.5">
                    <input 
                      type="checkbox"
                      checked={runLangGraphMetadata}
                      onChange={(e) => setRunLangGraphMetadata(e.target.checked)}
                      disabled={isTraining}
                      className="rounded border-[#cbd2df]/60 dark:border-slate-800 text-mystic-accent focus:ring-mystic-accent bg-[#e6ebf4] dark:bg-[#0b1329] w-4.5 h-4.5 transition-colors cursor-pointer mt-0.5"
                      id="run_langgraph_metadata_checkbox"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        Chạy luồng đồ thị trạng thái LangGraph AI Metadata
                        <span className="text-[9px] bg-sky-500/15 text-sky-400 px-1 rounded font-extrabold uppercase tracking-wide">GraphRAG</span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5 font-medium">
                        Phân tích đồ thị trạng thái AI nối dài qua các nút để tự động tích lỹ Thực thể & mối liên hệ.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Auto cleanup setting */}
                <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-4 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042]">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={autoCleanup}
                      onChange={(e) => setAutoCleanup(e.target.checked)}
                      disabled={isTraining}
                      className="rounded border-[#cbd2df]/60 dark:border-slate-800 text-mystic-accent focus:ring-mystic-accent bg-[#e6ebf4] dark:bg-[#0b1329] w-4.5 h-4.5 transition-colors cursor-pointer mt-0.5"
                      id="auto_cleanup_checkbox"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Tự động dọn dẹp sau khi xuất
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5 font-medium">
                        Tự động xóa vectors, analytics và metrics của quá trình training sau khi xuất thành công
                      </span>
                    </div>
                  </label>
                </div>
              </>
            ) : activeTrainTab === 'rules' ? (
              <>
                {/* Rules Advanced Settings: Select Model */}
                <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-4 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042]">
                  <label className="block text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                    Mô hình AI để phân tích Quy luật:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAiModelForRules('gemini-3.5-flash')}
                      className={`py-1.5 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        aiModelForRules === 'gemini-3.5-flash'
                          ? 'bg-[#e0e6f0] dark:bg-[#080d1c] border-purple-500 text-purple-600 dark:text-purple-400 shadow-[inset_2px_2px_4px_#cbd2df] dark:shadow-[inset_2px_2px_4px_#030610]'
                          : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-550 hover:text-slate-800 dark:hover:text-slate-250 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[10px_10px_20px_#030610,-10px_-10px_20px_#142042]'
                      }`}
                      disabled={isExtractingRules}
                    >
                      Gemini 3.5 Flash
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiModelForRules('gemini-3.1-pro-preview')}
                      className={`py-1.5 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        aiModelForRules === 'gemini-3.1-pro-preview'
                          ? 'bg-[#e0e6f0] dark:bg-[#080d1c] border-purple-500 text-purple-600 dark:text-purple-400 shadow-[inset_2px_2px_4px_#cbd2df] dark:shadow-[inset_2px_2px_4px_#030610]'
                          : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-550 hover:text-slate-800 dark:hover:text-slate-250 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[10px_10px_20px_#030610,-10px_-10px_20px_#142042]'
                      }`}
                      disabled={isExtractingRules}
                    >
                      Gemini 3.1 Pro
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-relaxed font-sans">
                    ✓ <strong>Mô hình Flash</strong> xử lý cực kỳ nhanh chóng tài liệu dài. 
                    <br />✓ <strong>Mô hình Pro</strong> cung cấp suy luận logic siêu sắc nét cho những thế giới phức tạp.
                  </p>
                </div>

                {/* Rules Configurations: Count and Words */}
                <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-4 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] space-y-4">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-widest border-b border-[#cbd2df]/20 dark:border-[#142042]/10 pb-1 flex items-center gap-2">
                    <BrainCircuit size={14} className="text-purple-500" /> Cấu hình Trích Luật & Quy luật
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 font-bold mb-1">
                        Số lượng luật (1-1000):
                      </label>
                      <input 
                        type="number"
                        value={rulesCount}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(1000, parseInt(e.target.value) || 1));
                          setRulesCount(val);
                        }}
                        min={1}
                        max={1000}
                        className="w-full bg-[#cbd2df]/20 dark:bg-[#030610]/45 border border-[#cbd2df]/30 dark:border-[#142042]/25 rounded-xl px-3 py-1.5 text-xs text-stone-900 dark:text-slate-200 outline-none font-semibold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]"
                        disabled={isExtractingRules}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 font-bold mb-1">
                        Từ mỗi luật (min 10):
                      </label>
                      <input 
                        type="number"
                        value={wordsPerRule}
                        onChange={(e) => {
                          const val = Math.max(10, parseInt(e.target.value) || 10);
                          setWordsPerRule(val);
                        }}
                        min={10}
                        className="w-full bg-[#cbd2df]/20 dark:bg-[#030610]/45 border border-[#cbd2df]/30 dark:border-[#142042]/25 rounded-xl px-3 py-1.5 text-xs text-stone-900 dark:text-slate-200 outline-none font-semibold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]"
                        disabled={isExtractingRules}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase shrink-0">
                      <span>Chọn nhanh số lượng luật:</span>
                      <span className="text-purple-600 font-mono">{rulesCount} quy luật</span>
                    </div>
                    <input 
                      type="range"
                      min="1"
                      max="1000"
                      value={rulesCount}
                      onChange={(e) => setRulesCount(parseInt(e.target.value))}
                      className="w-full accent-purple-600 cursor-pointer"
                      disabled={isExtractingRules}
                    />
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed font-sans">
                    💡 Quy luật thế giới càng nhiều và chi tiết thì AI đóng vai dẫn truyện (Narrator) sẽ càng có cơ sở dữ liệu dồi dào, thâm trầm tuân thủ đúng lore nguyên tác.
                  </p>
                </div>

                {/* Rules Denoising checkbox */}
                <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-4 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042]">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={denoiseText}
                      onChange={(e) => setDenoiseText(e.target.checked)}
                      disabled={isExtractingRules}
                      className="rounded border-[#cbd2df]/60 dark:border-slate-800 text-mystic-accent focus:ring-mystic-accent bg-[#e6ebf4] dark:bg-[#0b1329] w-4.5 h-4.5 transition-colors cursor-pointer mt-0.5"
                      id="denoise_rules_text_checkbox"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Khử nhiễu văn bản nguồn trước khi trích luật
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5 font-medium">
                        Bảo toàn dải ký tự tối giản, tránh gây nhầm lẫn cấu trúc cho AI.
                      </span>
                    </div>
                  </label>
                </div>
              </>
            ) : (
              <>
                {/* 3. SETTINGS FOR ENCYCLOPEDIA BATCH GENERATION */}
                <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-4 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042]">
                  <label className="block text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                    Mô Hình AI Biên Soạn Bách Khoa:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAiModelForEntities('gemini-3.5-flash')}
                      className={`py-1.5 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        aiModelForEntities === 'gemini-3.5-flash'
                          ? 'bg-[#e0e6f0] dark:bg-[#080d1c] border-amber-500 text-amber-600 dark:text-amber-400 shadow-[inset_2px_2px_4px_#cbd2df] dark:shadow-[inset_2px_2px_4px_#030610]'
                          : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-550 hover:text-slate-800 dark:hover:text-slate-250 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[10px_10px_20px_#030610,-10px_-10px_20px_#142042]'
                      }`}
                      disabled={isExtractingEntities}
                    >
                      Gemini 3.5 Flash
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiModelForEntities('gemini-3.1-pro-preview')}
                      className={`py-1.5 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        aiModelForEntities === 'gemini-3.1-pro-preview'
                          ? 'bg-[#e0e6f0] dark:bg-[#080d1c] border-amber-500 text-amber-600 dark:text-amber-400 shadow-[inset_2px_2px_4px_#cbd2df] dark:shadow-[inset_2px_2px_4px_#030610]'
                          : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-550 hover:text-slate-800 dark:hover:text-slate-250 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[10px_10px_20px_#030610,-10px_-10px_20px_#142042]'
                      }`}
                      disabled={isExtractingEntities}
                    >
                      Gemini 3.1 Pro
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-relaxed font-sans">
                    ✓ Nên dùng <strong>Model Pro</strong> để trích xuất cấu trúc bách khoa có sự lôi cuốn, đồng bộ logic cao nhất và chi tiết dã sử tuyệt đối.
                  </p>
                </div>

                {/* Denoising checkbox for Encyclopedia */}
                <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-4 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042]">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={denoiseText}
                      onChange={(e) => setDenoiseText(e.target.checked)}
                      disabled={isExtractingEntities}
                      className="rounded border-[#cbd2df]/60 dark:border-slate-800 text-amber-600 focus:ring-amber-500 bg-[#e6ebf4] dark:bg-[#0b1329] w-4.5 h-4.5 transition-colors cursor-pointer mt-0.5"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Khử nhiễu văn bản trước khi biên soạn
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5 font-medium">
                        Giúp bóc tách 20+ thực thể mạch lạc không lẫn mã ký tự thừa.
                      </span>
                    </div>
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Right Column: Chunk Settings or Rules Extractor */}
          <div className="space-y-4 flex flex-col justify-between mt-4 md:mt-0">
            {activeTrainTab === 'knowledge' ? (
              <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-5 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] space-y-4">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-widest text-xs border-b border-[#cbd2df]/40 dark:border-[#142042]/20 pb-2">
                  Cài Đặt Chunk Training
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 font-bold mb-1">
                      Số từ mỗi chunk
                    </label>
                    <input 
                      type="number"
                      value={wordsPerChunk}
                      onChange={(e) => setWordsPerChunk(Math.max(1, parseInt(e.target.value) || 0))}
                      min={1}
                      className="w-full bg-[#cbd2df]/20 dark:bg-[#030610]/45 border border-[#cbd2df]/30 dark:border-[#142042]/25 rounded-xl px-3 py-1.5 text-xs text-stone-900 dark:text-slate-200 outline-none font-semibold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]"
                      disabled={isTraining}
                      id="words_per_chunk_input"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 font-bold mb-1">
                      Số từ overlap
                    </label>
                    <input 
                      type="number"
                      value={overlapWords}
                      onChange={(e) => setOverlapWords(Math.max(0, parseInt(e.target.value) || 0))}
                      min={0}
                      className="w-full bg-[#cbd2df]/20 dark:bg-[#030610]/45 border border-[#cbd2df]/30 dark:border-[#142042]/25 rounded-xl px-3 py-1.5 text-xs text-stone-900 dark:text-slate-200 outline-none font-semibold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]"
                      disabled={isTraining}
                      id="overlap_words_input"
                    />
                  </div>
                </div>

                {/* Estimated tokens display */}
                <div className="flex flex-col space-y-1 bg-[#cbd2df]/20 dark:bg-[#030610]/25 p-3 rounded-xl border border-[#cbd2df]/20 dark:border-[#142042]/10 shadow-inner">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Ước tính Token</span>
                  <span className="text-sm font-mono font-black text-slate-800 dark:text-slate-200">
                    {estChunkTokens.toLocaleString()} / {estTotalTokens.toLocaleString()} tokens
                  </span>
                </div>

                {/* Validity Check Display */}
                <div className="flex items-center gap-2">
                  {isValid ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-1.5 px-3 rounded-lg w-full" id="config_valid_box">
                      <CheckCircle2 size={14} /> <span>✅ Cài đặt hợp lệ</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 py-1.5 px-3 rounded-lg w-full" id="config_invalid_box">
                      <AlertTriangle size={14} /> 
                      <span>
                        {files.length === 0 ? "Vui lòng chọn file" : !storyName.trim() ? "Thiếu tên Knowledge" : divisor <= 0 ? "Overlap phải nhỏ hơn từ mỗi chunk" : "Cài đặt chưa hợp lệ"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Calculated Chunks Count Info */}
                <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400 bg-[#e0e6f0]/40 dark:bg-[#080d1c]/40 py-2 px-3.5 rounded-lg font-mono border border-[#cbd2df]/20 dark:border-[#142042]/10 shadow-sm">
                  <span className="font-bold">Chunks đã tạo:</span>
                  <span className="font-black text-mystic-accent" id="chunks_created_count_label">{displayChunksCount}</span>
                </div>
              </div>
            ) : activeTrainTab === 'rules' ? (
              <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-5 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] space-y-4">
                <h3 className="font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-widest text-xs border-b border-purple-500/20 pb-2 flex items-center gap-2">
                  <BrainCircuit size={15} /> Biên soạn Quy luật Thế giới
                </h3>

                {/* Info Text */}
                <div className="text-[11px] text-slate-550 dark:text-slate-400 leading-relaxed font-semibold">
                  📌 Rút trích các <strong>Luật AI Tối cao (Advanced World Laws)</strong> từ tệp bối cảnh của bạn. AI sẽ căn cứ vào đây để ngăn chặn các cheat ẩn phi thực tế, linh lực vô hạn, tự phục hồi phi logic khi thám hiểm.
                </div>

                {extractedRules.length > 0 && (
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block">Quy luật đã đúc kết ({extractedRules.length} điều):</span>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1 border border-[#cbd2df]/40 dark:border-[#142042]/20 p-2 rounded-xl bg-[#cbd2df]/10 dark:bg-[#030610]/20 shadow-inner">
                      {extractedRules.map((rule, idx) => (
                        <div 
                          key={idx} 
                          className="bg-white dark:bg-[#02050c]/65 p-2 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex items-start gap-2"
                        >
                          <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[9px] font-mono font-black px-1.5 py-0.5 rounded shrink-0">
                            #{idx + 1}
                          </span>
                          <textarea
                            value={rule}
                            onChange={(e) => {
                              const updated = [...extractedRules];
                              updated[idx] = e.target.value;
                              setExtractedRules(updated);
                            }}
                            className="flex-1 bg-transparent border-0 p-0 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-0 resize-none h-12 font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => setExtractedRules(extractedRules.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-400 p-0.5 self-center cursor-pointer shrink-0"
                            title="Xóa"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Manual add inside list */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Thêm dòng quy luật mới..."
                        id="new_extracted_rule_input"
                        className="flex-1 bg-white dark:bg-[#030610]/45 border border-[#cbd2df]/30 dark:border-[#142042]/25 rounded-xl px-3 py-1.5 text-xs text-stone-900 dark:text-slate-200 outline-none font-semibold focus:border-purple-500 transition-all shadow-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = e.currentTarget.value.trim();
                            if (val) {
                              setExtractedRules([...extractedRules, val]);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                      <Button
                        onClick={() => {
                          const input = document.getElementById('new_extracted_rule_input') as HTMLInputElement;
                          if (input && input.value.trim()) {
                            setExtractedRules([...extractedRules, input.value.trim()]);
                            input.value = '';
                          }
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-3 py-1 text-xs rounded-xl cursor-pointer"
                      >
                        Thêm
                      </Button>
                    </div>
                  </div>
                )}

                {/* Validity status bar/alert */}
                <div className="flex items-center gap-2">
                  {files.length > 0 && storyName.trim().length > 0 ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 py-1.5 px-3 rounded-lg w-full">
                      <CheckCircle2 size={14} /> <span>✅ Sẵn sàng trích quy luật</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 py-1.5 px-3 rounded-lg w-full">
                      <AlertTriangle size={14} /> 
                      <span>{files.length === 0 ? "Vui lòng chọn file" : "Thiếu tên thế giới"}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-5 rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] space-y-4">
                <h3 className="font-extrabold text-amber-600 dark:text-amber-500 uppercase tracking-widest text-xs border-b border-amber-500/20 pb-2 flex items-center gap-2">
                  <BookOpen size={15} className="text-amber-500" /> Tiền Biên Soạn Bách Khoa Toàn Thư
                </h3>

                {/* Info Text */}
                <div className="text-[11px] text-slate-550 dark:text-slate-400 leading-relaxed font-semibold">
                  📌 Rút trích hệ thống bối cảnh gồm tối thiểu <strong>20+ thực thể dã sử chi tiết bậc nhất</strong> (nhân vật, cấm địa, thánh khí, phe phái, pháp lý vũ trụ) trực tiếp từ tệp văn bản bối cảnh của bạn. Dữ liệu này sẽ làm giàu cho gameplay một cách toàn diện ngay từ phút bắt đầu!
                </div>

                {extractedEntities.length > 0 && (
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block">Thực thể đã trích lập ({extractedEntities.length} điều):</span>
                    <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1 border border-[#cbd2df]/40 dark:border-[#142042]/20 p-2 rounded-xl bg-[#cbd2df]/10 dark:bg-[#030610]/20 shadow-inner">
                      {extractedEntities.map((ent, idx) => (
                        <div 
                          key={idx} 
                          className="bg-white dark:bg-[#02050c]/65 p-2 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex flex-col gap-1.5"
                        >
                          <div className="flex justify-between items-center bg-slate-100 dark:bg-[#0b1329]/60 px-2 py-1 rounded">
                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{ent.name}</span>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded opacity-80" style={{
                              backgroundColor: ent.type === "NPC" ? "rgba(16,185,129,0.15)" : ent.type === "LOCATION" ? "rgba(59,130,246,0.15)" : "rgba(245,158,11,0.15)",
                              color: ent.type === "NPC" ? "#10b981" : ent.type === "#3b82f6" ? "#3b82f6" : "#d97706"
                            }}>{ent.type}</span>
                          </div>
                          {ent.rarity && (
                            <span className="text-[9px] text-amber-600 font-bold">Quý hiếm: {ent.rarity}</span>
                          )}
                          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-350 line-clamp-3 leading-relaxed">
                            {ent.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Validity status bar/alert */}
                <div className="flex items-center gap-2">
                  {files.length > 0 && storyName.trim().length > 0 ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 py-1.5 px-3 rounded-lg w-full">
                      <CheckCircle2 size={14} className="text-amber-500" /> <span>✅ Sẵn sàng biên soạn Bách Khoa</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 py-1.5 px-3 rounded-lg w-full">
                      <AlertTriangle size={14} /> 
                      <span>{files.length === 0 ? "Vui lòng chọn file" : "Thiếu tên thế giới"}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action and Terminal Progress Logs panel */}
            <div className="flex-1 flex flex-col justify-end mt-4 space-y-4">
              
              {/* Terminal View */}
              <div className="bg-[#080d19] rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/20 shadow-[inset_1px_2px_4px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-[180px] shrink-0">
                <div className="bg-[#111726] px-3.5 py-1.5 border-b border-white/5 flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                     training ~/ log_console
                  </span>
                  {isTraining && progress.total > 0 && (
                    <span className="text-mystic-accent font-bold">
                      {Math.round((progress.current / progress.total) * 100)}%
                    </span>
                  )}
                </div>
                <div 
                  ref={logContainerRef}
                  className="flex-1 p-3 overflow-y-auto font-mono text-[10px] text-slate-350 space-y-1.5 custom-scrollbar leading-relaxed"
                >
                  {logs.length === 0 ? (
                    <div className="text-slate-500 italic">Vui lòng tải tệp văn bản .txt bối cảnh để bắt đầu quá trình xử lý...</div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className="border-l border-[#38bdf8]/30 pl-2 text-slate-300">
                        {log}
                      </div>
                    ))
                  )}
                </div>
                {/* Visual training progress line */}
                {isTraining && (
                  <div className="h-1 bg-slate-900 w-full shrink-0">
                    <div 
                      className="h-full bg-gradient-to-r from-mystic-accent to-emerald-400 transition-all duration-300"
                      style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Manual Download Button on Training finished (For Knowledge Vectors RAG) */}
              {activeTrainTab === 'knowledge' && trainedData && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-amber-500/15 border border-amber-500/40 p-4 rounded-2xl flex flex-col items-center gap-2.5 shadow-[inset_1px_1px_3px_rgba(245,158,11,0.2)] shrink-0"
                  id="trained_data_download_wrapper"
                >
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-extrabold text-xs uppercase tracking-wider">
                    <CheckCircle2 size={16} className="text-emerald-500 animate-bounce" />
                    <span>Huấn luyện hoàn thành 100%!</span>
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-300 text-center leading-normal font-medium font-sans animate-pulse">
                    Dữ liệu bách khoa đã được biên soạn và bảo toàn an toàn trong bộ nhớ cache. Nhấn nút bên dưới để tải trực tiếp về thiết bị mà không bị chặn hay tràn RAM.
                  </p>
                  <Button
                    onClick={() => exportData(trainedData)}
                    className="w-full justify-center bg-amber-500 hover:bg-amber-600 text-amber-950 font-black tracking-widest py-2.5 rounded-xl shadow-[3px_3px_7px_rgba(245,158,11,0.25)] transition-transform uppercase text-xs"
                    id="manual_download_knowledge_btn"
                  >
                    📥 Tải Xuống Tệp Tri Thức (.json)
                  </Button>
                </motion.div>
              )}

              {/* Manual Download Button on World Rules Extracted */}
              {activeTrainTab === 'rules' && extractedRules.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-purple-500/15 border border-purple-500/40 p-4 rounded-2xl flex flex-col items-center gap-2.5 shadow-[inset_1px_1px_3px_rgba(168,85,247,0.2)] shrink-0"
                  id="rules_data_download_wrapper"
                >
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-extrabold text-xs uppercase tracking-wider">
                    <CheckCircle2 size={16} className="text-purple-500 animate-bounce" />
                    <span>Hồ sơ Quy luật biên soạn xong!</span>
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-300 text-center leading-normal font-medium font-sans animate-pulse">
                    Tệp cấu hình quy luật thế giới đã được chuẩn hóa. Bạn có thể nạp tệp .json này trực tiếp vào bảng "Luật AI Tối cao" khi khởi nghiệp thế giới mới!
                  </p>
                  <Button
                    onClick={() => exportRulesJson(extractedRules)}
                    className="w-full justify-center bg-purple-500 hover:bg-purple-600 text-purple-950 font-black tracking-widest py-2.5 rounded-xl shadow-[3px_3px_7px_rgba(168,85,247,0.25)] transition-transform uppercase text-xs cursor-pointer"
                    id="manual_download_rules_btn"
                  >
                    📥 Tải Xuống Tệp Quy Luật (.json)
                  </Button>
                </motion.div>
              )}

              {/* Start and Stop Buttons block */}
              <div>
                {activeTrainTab === 'knowledge' ? (
                  !isTraining ? (
                    <Button 
                      onClick={startTraining} 
                      disabled={!isValid}
                      className="w-full justify-center bg-[#10b981] hover:bg-[#059669] disabled:bg-[#cbd2df] dark:disabled:bg-slate-800 text-green-950 font-black tracking-widest py-3 rounded-xl shadow-[3px_3px_6px_rgba(16,185,129,0.3)] dark:shadow-[3px_3px_6px_rgba(0,0,0,0.55)] active:scale-[0.98] transition-transform uppercase text-xs disabled:opacity-50 cursor-pointer text-white disabled:text-slate-400"
                      id="start_training_btn"
                    >
                      <Play size={14} className="mr-1.5" /> Bắt đầu Train Vectors
                    </Button>
                  ) : (
                    <Button 
                      onClick={stopTraining} 
                      className="w-full justify-center bg-red-500 hover:bg-red-600 text-white font-black tracking-widest py-3 rounded-xl shadow-[3px_3px_6px_rgba(239,68,68,0.3)] dark:shadow-[3px_3px_6px_rgba(0,0,0,0.55)] active:scale-[0.98] transition-transform uppercase text-xs animate-pulse cursor-pointer"
                      id="stop_training_btn"
                    >
                      <StopCircle size={14} className="mr-1.5" /> Dừng tiến hành
                    </Button>
                  )
                ) : (
                  !isExtractingRules ? (
                    <Button
                      onClick={startRulesExtraction}
                      disabled={files.length === 0 || !storyName.trim()}
                      className="w-full justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-[#cbd2df] dark:disabled:bg-slate-800 disabled:text-slate-450 text-purple-100 font-black tracking-widest py-3 rounded-xl shadow-[3px_3px_6px_rgba(168,85,247,0.3)] dark:shadow-[3px_3px_6px_rgba(0,0,0,0.55)] active:scale-[0.98] transition-transform uppercase text-xs cursor-pointer"
                      id="start_rules_extraction_btn"
                    >
                      <Play size={14} className="mr-1.5" /> Bắt đầu trích xuất Rules
                    </Button>
                  ) : (
                    <Button
                      disabled={true}
                      className="w-full justify-center bg-purple-550 text-white font-black tracking-widest py-3 rounded-xl shadow-[3px_3px_6px_rgba(168,85,247,0.1)] active:scale-[0.98] transition-all uppercase text-xs animate-pulse"
                    >
                      <StopCircle size={14} className="mr-1.5 text-amber-300 animate-spin" /> Đang thiết chế pháp tắc...
                    </Button>
                  )
                )}
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
