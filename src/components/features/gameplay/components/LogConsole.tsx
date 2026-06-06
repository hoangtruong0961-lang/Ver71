import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Info, Terminal, Search, Sparkles, Cpu, Check, Copy, FileText, Play } from 'lucide-react';
import { logService, LogEntry, LogLevel } from '../../../../services/log/logService';
import { motion, AnimatePresence } from 'framer-motion';
import { MarkdownRenderer } from '../../../common/MarkdownRenderer';

interface LogConsoleProps {
  onClose: () => void;
}

const LogConsole: React.FC<LogConsoleProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>(() => logService.getLogs());
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'console' | 'ai-debugger'>('console');
  
  // AI Debugger states
  const [debugInput, setDebugInput] = useState('');
  const [debugRule, setDebugRule] = useState<'java-linebreak' | 'stacktrace' | 'logic-syntax'>('java-linebreak');
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = logService.subscribe(newLogs => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesLevel = filter === 'all' || log.level === filter;
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const clearLogs = () => {
    logService.clearLogs();
  };

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'error': return <AlertCircle size={14} className="text-red-500" />;
      case 'warn': return <AlertTriangle size={14} className="text-amber-500" />;
      case 'info': return <Info size={14} className="text-blue-500" />;
      case 'debug': return <Terminal size={14} className="text-stone-500" />;
    }
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'error': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'warn': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'info': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'debug': return 'bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20';
    }
  };

  // Helper helper to generate rule-based prompt
  const promptForRule = (rule: string, input: string) => {
    if (rule === 'java-linebreak') {
      return `
Hãy phân tích và rà soát lỗi nghiêm ngặt phần mã nguồn/dữ liệu nhật ký (log) được cung cấp dưới đây dựa trên quy định chuẩn Code Style và quy tắc xuống dòng (đặc biệt là lỗi xuống dòng không đúng tiêu chuẩn Java, ranh giới dấu ngoặc nhọn, viết liền chuỗi hoặc dấu phân tách dòng không đúng quy cách dòng lệnh).

[DỮ LIỆU ĐẦU VÀO CẦN KIỂM TRÀ & RÀ SOÁT]
\`\`\`
${input}
\`\`\`

Yêu cầu cụ thể của quy trình AI Debugger tự động này:
1. Tìm toàn bộ các vi phạm về cấu trúc xuống dòng (mã Java, C++ hoặc định dạng logs, regex văn bản). Chỉ rõ từng dòng/lỗi bị vi phạm.
2. Sửa đổi lại hoàn chỉnh đoạn phân loại code/logs bị vi phạm theo đúng tiêu chuẩn thụt dòng/xuống dòng sạch sẽ của chuẩn viết code mẫu. Trả về khối code sửa lỗi hoàn thành trong markdown \`\`\` để dễ dàng sao chép.
3. Giải thích ngắn gọn lý do tại sao dòng đó chưa đúng quy định và cách khắc phục chi tiết thiết thực cho lập trình viên.
`;
    } else if (rule === 'stacktrace') {
      return `
Hãy đóng vai trò Hệ thống Chẩn Đoán Lỗi Chuyên Sâu (Stacktrace Exception Auditor). Hãy phân tích chuỗi biệt lệ/nhật ký lỗi sau đây để chỉ ra nguyên nhân gây sập hệ thống hoặc lỗi nghiệp vụ logic:

[DỮ LIỆU ĐẦU VÀO LOGS/STACKTRACE]
\`\`\`
${input}
\`\`\`

Yêu cầu cụ thể:
1. Giải mã biệt lệ (Exception Name, Thread, Cause, Class/Method gây ra lỗi) và phân tích nguyên lý hoạt động dẫn đến lỗi này.
2. Đưa ra các bước khắc phục chi tiết dạng danh sách gạch đầu dòng trực quan.
3. Nếu có mã nguồn tương ứng, hãy cho biết đoạn kiểm soát lỗi chuẩn (Try-catch, validation, null-safety) nên viết như thế nào.
`;
    } else {
      return `
Hãy đóng vai trò Chuyên gia Tối ưu & Sửa lỗi Cú pháp mã nguồn (Syntax & Logic Auditor). Hãy rà soát đoạn mã nguồn sau để phát hiện lỗi cú pháp, lỗ hổng bảo mật hoặc lỗi logic thuật toán:

[MÃ NGUỒN KHẢO SÁT]
\`\`\`
${input}
\`\`\`

Yêu cầu cụ thể:
1. Phát hiện và đánh giá các lỗi lập trình (logic, rò rỉ bộ nhớ, cú pháp chưa đóng ngoặc, sai kiểu dữ liệu).
2. Viết lại mã nguồn đã chỉnh sửa sạch đẹp, tuân thủ Clean Code.
3. Đề xuất cách viết tối ưu hiệu năng và an toàn hơn.
`;
    }
  };

  // Handle triggered automated diagnosis
  const handleStartAuditStr = async () => {
    if (!debugInput.trim()) return;
    setIsAuditing(true);
    setAiAnalysisResult(null);
    setAiError(null);

    try {
      // Proxy logging lists from current environment for dynamic context if empty input
      const preparedLogList = logs.slice(0, 15).map(l => `[${l.level.toUpperCase()}] ${l.message}`);
      
      const response = await fetch('/api/ai/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rawCode: debugInput,
          compiledCode: '',
          logs: preparedLogList,
          prompt: promptForRule(debugRule, debugInput)
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Không thể liên kết với máy chủ AI.');
      }

      setAiAnalysisResult(data.text);
    } catch (err: any) {
      setAiError(err.message || 'Lỗi bất ngờ xảy ra khi chuẩn bị phân tích AI.');
    } finally {
      setIsAuditing(false);
    }
  };

  // Quick load from current warnings/errors
  const handleLoadSystemLogsToInput = () => {
    const errorWarnLogs = logs.filter(l => l.level === 'error' || l.level === 'warn').slice(0, 10);
    if (errorWarnLogs.length === 0) {
      setDebugInput(`[INFO] Logs an toàn, không có lỗi runtime gần đây.\nBạn có thể tự ý dán mã lỗi Java / Cú pháp xuống đây để thử nghiệm AI Debugger!`);
    } else {
      const formatted = errorWarnLogs.map(l => `[${l.level.toUpperCase()}] [${new Date(l.timestamp).toLocaleTimeString()}] ${l.message}\nChi tiết: ${typeof l.details === 'object' ? JSON.stringify(l.details) : l.details || ''}`).join('\n\n');
      setDebugInput(formatted);
    }
  };

  const handleCopyResult = () => {
    if (!aiAnalysisResult) return;
    navigator.clipboard.writeText(aiAnalysisResult).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col h-full bg-stone-150 dark:bg-mystic-950 border border-stone-300 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xl">
      {/* Tab bar header */}
      <div className="flex items-center justify-between p-3 bg-stone-200 dark:bg-[#14151c] border-b border-stone-300 dark:border-slate-800 shadow-sm relative z-10">
        <div className="flex items-center gap-3">
          <Terminal size={18} className="text-mystic-accent shrink-0" />
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('console')}
              className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'console'
                  ? 'bg-slate-800 dark:bg-slate-700 text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              🗒️ Logs Console
            </button>
            <button
              onClick={() => setActiveTab('ai-debugger')}
              className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 ${
                activeTab === 'ai-debugger'
                  ? 'bg-mystic-accent text-white shadow-md border-mystic-accent font-bold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Sparkles size={12} className="text-amber-400 shrink-0" /> Automatic AI Debugger
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {activeTab === 'console' && (
            <button 
              onClick={clearLogs}
              className="p-1.5 text-stone-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
              title="Clear Logs"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-800 dark:hover:text-white hover:bg-stone-300 dark:hover:bg-slate-800 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {activeTab === 'console' ? (
        <>
          {/* Toolbar */}
          <div className="p-2 bg-[#f4f3f0] dark:bg-mystic-900/50 border-b border-stone-300 dark:border-slate-800 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[150px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input 
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#07080c] border border-stone-300 dark:border-slate-700 rounded text-xs text-stone-800 dark:text-slate-200 focus:border-mystic-accent outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              {(['all', 'error', 'warn', 'info'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setFilter(l)}
                  className={`px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    filter === l 
                    ? 'bg-mystic-accent text-white border-mystic-accent shadow-sm' 
                    : 'bg-stone-200 dark:bg-mystic-800 text-stone-500 border-stone-300 dark:border-slate-750 hover:border-stone-450'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Log List */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar font-mono text-[11px]"
          >
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 dark:text-slate-600 opacity-50 space-y-2">
                <Terminal size={32} strokeWidth={1} />
                <p className="text-xs italic">No logs found</p>
              </div>
            ) : (
              filteredLogs.map(log => (
                <div 
                  key={log.id} 
                  className={`border rounded overflow-hidden transition-all ${getLevelColor(log.level)}`}
                >
                  <div 
                    className="flex items-start gap-2 p-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                  >
                    <div className="mt-0.5 shrink-0">{getLevelIcon(log.level)}</div>
                    <div className="flex-1 break-all line-clamp-2 leading-tight">
                      <span className="opacity-50 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      {log.message}
                    </div>
                    <div className="shrink-0 opacity-50">
                      {expandedLogId === log.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {expandedLogId === log.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 p-2 overflow-x-auto custom-scrollbar"
                      >
                        <pre className="whitespace-pre-wrap break-all text-[10px]">
                          {typeof log.details === 'object' 
                            ? JSON.stringify(log.details, null, 2) 
                            : String(log.details || 'No additional details')}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* AUTOMATED AI FORMAT AUDITOR & DEBUGGER WORKSPACE */
        <div className="flex-1 overflow-y-auto p-4 flex flex-col lg:flex-row gap-4 bg-stone-100 dark:bg-[#07080c] custom-scrollbar">
          
          {/* Left Panel: Diagnostic Input */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="p-4 rounded-xl border border-[#2d2f3d] bg-stone-150 dark:bg-[#111218]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <FileText size={14} className="text-indigo-400" /> Mã nguồn / Toàn bộ dò lỗi cần kiểm định
                </h3>
                <button
                  type="button"
                  onClick={handleLoadSystemLogsToInput}
                  className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold px-2 py-1 rounded border border-indigo-500/20 flex items-center gap-1 transition-all"
                >
                  <Cpu size={10} /> Đồng Bộ Từ Logs
                </button>
              </div>

              <textarea
                value={debugInput}
                onChange={e => setDebugInput(e.target.value)}
                placeholder="Dán mã nguồn lỗi (ví dụ file Java có lỗi xuống dòng viết liền, hay các dòng stack trace biệt lệ của server...) vào đây..."
                className="w-full h-[180px] p-3 text-xs bg-white dark:bg-[#1a1b26] border border-stone-300 dark:border-[#3b3d4d] rounded-lg text-slate-200 font-mono outline-none focus:border-mystic-accent shadow-inner resize-y custom-scrollbar"
              />
            </div>

            <div className="p-4 rounded-xl border border-[#2d2f3d] bg-stone-150 dark:bg-[#111218] flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Quy tắc tự động rà soát & chẩn đoán lỗi</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <button
                    onClick={() => setDebugRule('java-linebreak')}
                    className={`p-2.5 rounded-lg border text-left flex flex-col transition-all ${
                      debugRule === 'java-linebreak'
                        ? 'bg-mystic-accent/10 border-mystic-accent text-mystic-accent font-semibold shadow-inner'
                        : 'bg-white dark:bg-[#1a1b26] border-stone-300 dark:border-[#3b3d4d] hover:border-slate-500 text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      ☕ Chuẩn Xuống Dòng (Java style)
                    </span>
                    <span className="text-[10px] opacity-60 mt-1">Dò lỗi xuống dòng, ranh giới câu lệnh và ngoặc nhọn</span>
                  </button>

                  <button
                    onClick={() => setDebugRule('stacktrace')}
                    className={`p-2.5 rounded-lg border text-left flex flex-col transition-all ${
                      debugRule === 'stacktrace'
                        ? 'bg-mystic-accent/10 border-mystic-accent text-mystic-accent font-semibold shadow-inner'
                        : 'bg-white dark:bg-[#1a1b26] border-stone-300 dark:border-[#3b3d4d] hover:border-slate-500 text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      🔍 Stacktrace Auditor
                    </span>
                    <span className="text-[10px] opacity-60 mt-1">Phân tích biệt lệ, Class, Cause và dấu vết sập logs</span>
                  </button>

                  <button
                    onClick={() => setDebugRule('logic-syntax')}
                    className={`p-2.5 rounded-lg border text-left flex flex-col transition-all ${
                      debugRule === 'logic-syntax'
                        ? 'bg-mystic-accent/10 border-mystic-accent text-mystic-accent font-semibold shadow-inner'
                        : 'bg-white dark:bg-[#1a1b26] border-stone-300 dark:border-[#3b3d4d] hover:border-slate-500 text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      🛠️ Logic & Syntax Audit
                    </span>
                    <span className="text-[10px] opacity-60 mt-1">Bắt lỗi cú pháp mã nguồn, bảo mật và logic tuần hoàn</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={isAuditing || !debugInput.trim()}
                onClick={handleStartAuditStr}
                className="w-full flex items-center justify-center gap-2 py-3 bg-mystic-accent text-white font-bold rounded-lg transition-all border border-mystic-accent shadow-md cursor-pointer hover:bg-mystic-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAuditing ? (
                  <>
                    <Cpu size={16} className="animate-spin text-amber-300" />
                    Đang quét & Rà soát Định dạng Lỗi...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Chạy Chẩn Đoán AI Debugger 🚀
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel: Diagnosis Result Output */}
          <div className="flex-1 flex flex-col min-h-[380px] p-4 bg-stone-150 dark:bg-[#111218] border border-stone-300 dark:border-[#2d2f3d] rounded-xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-stone-300 dark:border-[#2d2f3d]">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles size={14} className="text-emerald-400" /> Báo cáo Phân Tích & Sửa Đổi từ AI
              </span>
              
              {aiAnalysisResult && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyResult}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2.5 py-1.5 rounded flex items-center gap-1.5 transition-all outline-none"
                  >
                    {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    {copied ? 'Đã sao chép' : 'Sao chép'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAiAnalysisResult(null); setDebugInput(''); }}
                    className="text-[10px] bg-red-950/20 text-red-400 border border-red-900/30 font-bold px-2.5 py-1.5 rounded transition-all outline-none"
                  >
                    Đặt lại
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
              {aiError && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs break-words font-medium">
                  Lỗi: {aiError}
                </div>
              )}

              {isAuditing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-[#111218]/40 backdrop-blur-xs gap-3">
                  <Cpu size={36} className="text-mystic-accent animate-pulse" />
                  <p className="text-xs italic text-slate-400">AI đang phân tích và tìm kiếm lỗi quy định của code đầu vào...</p>
                  <div className="w-1/2 h-1 bg-slate-800 rounded overflow-hidden">
                    <div className="h-full bg-indigo-500 animate-infinite-loading" />
                  </div>
                </div>
              )}

              {!aiAnalysisResult && !isAuditing && !aiError && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60 text-center p-8 space-y-2">
                  <Cpu size={48} strokeWidth={1} className="text-slate-500" />
                  <h4 className="font-bold text-sm text-slate-400">Chưa có Thang Chẩn Đoán</h4>
                  <p className="text-xs max-w-xs leading-relaxed text-slate-500">Nạp dữ liệu logs hay đoạn mã Java, JS của bạn ở ô bên trái, sau đó chọn loại quy tắc và nhấn "Chạy Chẩn Đoán AI" để AI tự động tìm lỗi thiết sai quy định.</p>
                </div>
              )}

              {aiAnalysisResult && (
                <div className="markdown-body text-xs text-stone-800 dark:text-slate-300 leading-relaxed font-sans prose dark:prose-invert max-w-none">
                  <MarkdownRenderer content={aiAnalysisResult} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogConsole;
