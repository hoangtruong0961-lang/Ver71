
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Terminal, Code, RotateCcw, Wrench } from 'lucide-react';
import { RegexScript } from '../../types';
import { getRegexedString, safeUtf8ToBase64 } from '../../utils/regex';
import { dbService } from '../../services/db/indexedDB';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  regexScripts?: RegexScript[];
  userName?: string;
  charName?: string;
  messageRole?: 'user' | 'assistant' | 'system';
  depth?: number;
}

const MemoizedTawaWidget = React.memo(({ children }: any) => {
  const base64Html = children?.toString() || '';
  if (!base64Html) return null;
  let decoded = '';
  try {
    if (typeof atob !== 'undefined') {
        decoded = decodeURIComponent(escape(atob(base64Html)));
    } else {
        decoded = Buffer.from(base64Html, 'base64').toString('utf-8');
    }
    
    // Inject TawaAPI Bridge
    const bridgeScript = `<script>
      window.sendOpeningData = function(text, data) {
        if (window.parent && typeof window.parent.sendOpeningData === 'function') {
          try {
            window.parent.sendOpeningData(text, data);
            return;
          } catch(e) {}
        }
        window.parent.postMessage({ type: 'sendOpeningData', text: text, data: data }, '*');
      };

      window.TawaAPI = {
        sendAction: function(action, payload) {
          window.parent.postMessage({ type: 'TAWA_WIDGET_ACTION', action: action, payload: payload }, '*');
        },
        postMessage: function(action, payload) {
          this.sendAction(action, payload);
        },
        sendOpeningData: function(text, data) {
          window.sendOpeningData(text, data);
        },
        send_opening_data: function(text, data) {
          window.sendOpeningData(text, data);
        }
      };

      window.waitGlobalInitialized = function() {
        if (window.parent && typeof window.parent.waitGlobalInitialized === 'function') {
          return window.parent.waitGlobalInitialized();
        }
        return Promise.resolve(true);
      };

      // SillyTavern global mock proxies
      window.getCharWorldbookNames = function() {
          var names = [];
          if (window.parent && window.parent.TavernHelper) {
              try {
                  names = window.parent.TavernHelper.getWorldbookNames() || [];
              } catch(e) {
                  console.error("[TawaBridge] Error getCharWorldbookNames:", e);
              }
          }
          if (names.indexOf('Kenshi') === -1) {
              names.push('Kenshi');
          }
          return names;
      };

      window.getWorldbooks = function() {
          var result = {};
          if (window.parent && window.parent.TavernHelper) {
              try {
                  var names = window.parent.TavernHelper.getWorldbookNames() || [];
                  var rawBooks = window.parent.TavernHelper.getWorldbooks ? window.parent.TavernHelper.getWorldbooks() : [];
                  
                  for (var i = 0; i < names.length; i++) {
                      var name = names[i];
                      var rawBook = rawBooks.find ? rawBooks.find(function(b) { return b.name === name; }) : null;
                      var entriesObj = {};
                      if (rawBook && rawBook.entries) {
                          if (Array.isArray(rawBook.entries)) {
                              rawBook.entries.forEach(function(entry) {
                                  var uid = entry.uid || Math.random().toString(36).substring(2, 9);
                                  entriesObj[uid] = entry;
                              });
                          } else {
                              entriesObj = rawBook.entries;
                          }
                      }
                      result[name] = {
                          name: name,
                          entries: entriesObj
                      };
                  }
              } catch(e) {
                  console.error("[TawaBridge] Error getWorldbooks:", e);
              }
          }
          if (!result['Kenshi']) {
              result['Kenshi'] = {
                  name: 'Kenshi',
                  entries: {}
              };
          }
          return result;
      };

      window.getWorldbook = function(name) {
          var books = window.getWorldbooks();
          return books[name] || { name: name, entries: {} };
      };

      window.getVariables = function() {
          if (window.parent && window.parent.TavernHelper) {
              try {
                  return window.parent.TavernHelper.getVariables() || {};
              } catch(e) {
                  return {};
              }
          }
          return {};
      };

      window.setVariables = function(vars) {
          if (window.parent && window.parent.TavernHelper) {
              try {
                  return window.parent.TavernHelper.updateVariablesWith(vars);
              } catch(e) {
                  return false;
              }
          }
          return false;
      };

      window.setVariable = function(key, val) {
          var obj = {};
          obj[key] = val;
          return window.setVariables(obj);
      };

      window.getCharacterName = function() {
          var vars = window.getVariables();
          return vars.char_name || 'Character';
      };

      window.getCharName = function() {
          return window.getCharacterName();
      };

      window.getUserName = function() {
          var vars = window.getVariables();
          return vars.user_name || 'User';
      };

      window.getCurrentMessageId = function() {
          if (window.parent) {
              try {
                  if (typeof window.parent.getCurrentMessageId === 'function') {
                      return window.parent.getCurrentMessageId();
                  } else if (window.parent.TavernHelper && typeof window.parent.TavernHelper.getCurrentMessageId === 'function') {
                      return window.parent.TavernHelper.getCurrentMessageId();
                  }
              } catch(e) {
                  return 0;
              }
          }
          return 0;
      };
    </script>`;
    
    if (decoded.includes('<head>')) {
        decoded = decoded.replace('<head>', '<head>' + bridgeScript);
    } else {
        decoded = bridgeScript + decoded;
    }
  } catch (e) {
    console.error("Lỗi decode HTML widget:", e);
    return <div className="p-4 border border-red-500 text-red-500 rounded bg-red-500/10 text-xs">Error decoding widget</div>;
  }
  return (
    <div className="w-full my-6 bg-stone-900 rounded-xl overflow-hidden border-2 border-stone-700 shadow-xl">
      <iframe 
        srcDoc={decoded} 
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
        className="w-full min-h-[600px] resize-y border-0"
        title="Tawa Protocol Custom Widget"
      />
    </div>
  );
});

const extractText = (node: any): string => {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node.props && node.props.children) return extractText(node.props.children);
  return '';
};

const sanitizeProps = (p: any) => {
  if (!p) return {};
  const finalProps: any = {};
  for (const key in p) {
    if (key === 'node') continue;
    // Remove event handlers that are strings (from HTML)
    if (key.startsWith('on') && typeof p[key] === 'string') continue;
    // Remove malformed attributes containing quotes
    if (key.includes('"') || key.includes("'")) continue;
    
    // Security: Block javascript: / data:text/html URLs to prevent XSS
    const val = p[key];
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      if (lower.startsWith('javascript:') || lower.startsWith('data:text/html')) {
        continue;
      }
    }
    
    finalProps[key] = p[key];
  }
  return finalProps;
};

const TagBadge = ({ label, value, bg }: { label: string, value: string, bg: string }) => (
  <div className={`px-2 py-1 rounded inline-flex items-center gap-1.5 ${bg} border border-black/10 dark:border-white/10 text-[10px] font-mono mr-1 mb-1 whitespace-nowrap`}>
    <span className="font-bold opacity-60 uppercase">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

import tawaReYilPresetData from '../../assets/presets/tawa_re_yil.json';
import tawaDeltaPresetData from '../../assets/presets/tawa_delta_combined.json';

const PINYIN_TRANSLATIONS: Record<string, string> = {
  jixie: "Cơ Khí",
  shenghua: "Sinh Hóa",
  shenhua: "Thần Thoại",
  faqing: "Phát Tình",
  chongfu: "Lặp Lại",
  juewang: "Tuyệt Vọng",
  bagu: "Bát Cổ",
  tawa: "Tawa",
  xunhuan: "Luân Hồi",
  suying: "Tốc Doanh",
  putong: "Phổ Thông",
  shili: "Thất Lễ",
  fuzong: "Phục Tòng",
  tonghua: "Đồng Hóa",
  shouhua: "Thú Hóa",
  kongzhi: "Khống Chế",
  mimeng: "Mê Mông",
  yinluan: "Dâm Loạn",
  baonue: "Bạo Ngược",
  chanmian: "Triền Miên",
  cuiru: "Thôi Nhũ",
  gaochao: "Cao Trào",
  shijing: "Thất Kính",
  guangrong: "Vinh Quang",
  zhenshu: "Trấn Thư",
  qimeng: "Khải Mông",
  bengpi: "Băng Phôi",
  mori: "Mạt Nhật",
  zhentong: "Trấn Thống",
  shengzhi: "Sinh Thực",
  gaizhuang: "Cải Tạo",
  xunhua: "Tuần Hóa",
  shuaixiang: "Suy Tưởng",
  tansu: "Đàn Tính",
  shizhi: "Thất Trí",
  shanghai: "Thương Tổn",
  nvesha: "Ngược Sát",
  wanle: "Ngoạn Lạc",
  qifu: "Kỳ Phục",
  zhihuan: "Trí Huyễn",
  yishen: "Di Thần",
  lingyu: "Lĩnh Vực",
  gongming: "Cộng Minh",
  fuhua: "Hủ Hóa",
  jiezhi: "Tiết Chế",
  tiaojiao: "Điều Giáo",
  shouren: "Thú Nhân",
  moxiu: "Ma Tu",
  tianran: "Thiên Nhiên",
  yazhi: "Áp Chế",
  kangan: "Kháng Ám",
};

const THEMES = [
  { // 0: sky
    classes: "text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-850/30",
    icon: "⚙️"
  },
  { // 1: purple
    classes: "text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-850/30",
    icon: "☣️"
  },
  { // 2: pink
    classes: "text-pink-600 dark:text-pink-400 bg-pink-50/50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-850/30",
    icon: "🔮"
  },
  { // 3: rose
    classes: "text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-850/30",
    icon: "💖"
  },
  { // 4: emerald
    classes: "text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-850/30",
    icon: "🔄"
  },
  { // 5: red
    classes: "text-red-650 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-850/30",
    icon: "💀"
  },
  { // 6: amber
    classes: "font-mono text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30",
    icon: "📜"
  },
  { // 7: indigo
    classes: "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-850/30",
    icon: "🗼"
  },
  { // 8: teal
    classes: "text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-850/30",
    icon: "⏳"
  },
  { // 9: orange
    classes: "text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-850/30",
    icon: "🐾"
  },
  { // 10: fuchsia
    classes: "text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 border-fuchsia-200 dark:border-fuchsia-850/30",
    icon: "🔮"
  },
  { // 11: violet
    classes: "text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-850/30",
    icon: "⛓️"
  }
];

const scanPresetsForCustomTagDefinitions = (): Record<string, string> => {
  const definitions: Record<string, string> = {};
  try {
    const activeId = dbService.getKeyValueSync("tawa_active_preset_id_v4") || "default";
    const savedListStr = dbService.getKeyValueSync("tawa_presets_list_v4");
    
    let activePresetConfig: any = null;
    
    // Parse presets
    if (savedListStr) {
      const presets = typeof savedListStr === "string" ? JSON.parse(savedListStr) : savedListStr;
      if (Array.isArray(presets)) {
        const found = presets.find(p => p.id === activeId);
        if (found) {
          activePresetConfig = found.config;
        }
      }
    }
    
    // Fallback to builtin template if active preset wasn't found in savedList
    if (!activePresetConfig && activeId === "builtin_tawa_re_yil") {
      activePresetConfig = tawaReYilPresetData;
    } else if (!activePresetConfig && activeId === "builtin_tawa_delta") {
      activePresetConfig = tawaDeltaPresetData;
    }

    if (activePresetConfig && activePresetConfig.modules) {
      for (const mod of activePresetConfig.modules) {
        if (!mod.content) continue;
        
        const regexes = [
          // Pattern: <tag> - [description] or <tag>: [description] or <tag> [description]
          /<([a-z][a-z0-9_-]*)>\s*[:\-—=]\s*([^.,:;!()\n\r"']{2,50})/gi,
          // Pattern in Vietnamese roleplay: "thẻ <tag> để [description]" or "thẻ <tag> biểu thị [description]"
          /(?:thẻ|tag)\s+<([a-z][a-z0-9_-]*)>\s+(?:để|biểu thị|biểu diễn|mô tả|dùng cho|là|có nghĩa)\s+([^.,:;!()\n\r"']{2,55})/gi,
          // Pattern: "Sử dụng <tag> khi [description]"
          /(?:sử dụng|dùng|áp dụng)\s+<([a-z][a-z0-9_-]*)>\s+(?:khi|để|biểu thị|nhằm)\s+([^.,:;!()\n\r"']{2,55})/gi
        ];
        
        for (const re of regexes) {
          let match;
          while ((match = re.exec(mod.content)) !== null) {
            const tag = match[1].toLowerCase();
            let desc = match[2].trim();
            desc = desc.replace(/\s+/g, " ");
            if (desc.length > 30) {
              desc = desc.substring(0, 27) + "...";
            }
            if (!definitions[tag] && desc.length > 2) {
              definitions[tag] = desc;
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("Error scanning presets for tag definitions:", e);
  }
  return definitions;
};

let cachedTagDefinitions: Record<string, string> | null = null;
let lastScanTime = 0;

const getCustomTagDefinitions = (): Record<string, string> => {
  const now = Date.now();
  if (!cachedTagDefinitions || now - lastScanTime > 3000) {
    cachedTagDefinitions = scanPresetsForCustomTagDefinitions();
    lastScanTime = now;
  }
  return cachedTagDefinitions;
};

const formatTagName = (tagName: string): { label: string; baseName: string; prefix: string } => {
  let label = tagName;
  let baseName = tagName.toLowerCase();
  let prefix = "";

  if (baseName.startsWith("fang")) {
    prefix = "仿"; // Simulated / Phỏng
    baseName = baseName.substring(4);
  } else if (baseName.startsWith("ds_") || baseName.startsWith("ds-") || baseName.startsWith("ds")) {
    prefix = "DS";
    baseName = baseName.replace(/^ds[-_]?/, "");
  }

  // Strip non-alphanumeric chars for lookup
  const cleanBase = baseName.replace(/[^a-z0-9]/g, "");
  
  // Look up clean base in PINYIN_TRANSLATIONS dictionary
  let translated = "";
  for (const k of Object.keys(PINYIN_TRANSLATIONS)) {
    if (cleanBase === k || cleanBase.includes(k) || k.includes(cleanBase)) {
      translated = PINYIN_TRANSLATIONS[k];
      break;
    }
  }

  if (translated) {
    label = prefix ? `${prefix} ${translated}` : translated;
  } else {
    // Return original name formatted nicely
    const friendlyBaseName = baseName.charAt(0).toUpperCase() + baseName.slice(1).replace(/[-_]/g, " ");
    label = prefix ? `${prefix} ${friendlyBaseName}` : friendlyBaseName;
  }

  return { label, baseName, prefix };
};

const getCustomTagRenderer = (tagName: string) => {
  return ({ _node, children, ...restProps }: any) => {
    const sanitized = sanitizeProps(restProps);
    const textContent = extractText(children);
    const isMultiLine = textContent.includes('\n') || textContent.length > 120;

    if (isMultiLine) {
      return (
        <div 
          data-custom-tag={tagName} 
          className="my-2 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800 dark:text-stone-100" 
          {...sanitized}
        >
          {children}
        </div>
      );
    }

    return (
      <span 
        data-custom-tag={tagName} 
        className="inline text-[15px] leading-relaxed text-stone-800 dark:text-stone-100"
        {...sanitized}
      >
        {children}
      </span>
    );
  };
};

const markdownComponentsRaw: import('react-markdown').Components = {
  p: ({ children }) => <div className="mb-4 leading-relaxed">{children}</div>,
  h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6 text-mystic-accent">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-5 text-mystic-accent/90">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-bold mb-2 mt-4 text-mystic-accent/80">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="text-sm">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-mystic-accent/30 pl-4 py-1 my-4 italic bg-stone-200/30 dark:bg-slate-800/30 rounded-r">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="px-1.5 py-0.5 bg-stone-300/50 dark:bg-slate-700/50 rounded font-mono text-xs">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="p-4 bg-stone-900 text-stone-100 rounded-lg overflow-x-auto my-4 text-xs font-mono">
      {children}
    </pre>
  ),
  script: ({ children, src, ...props }: any) => {
    const code = Array.isArray(children) ? children.join('\n') : children;
    
    // Instead of RegexScriptExecutor, we render an iframe with srcDoc
    let decoded = `<script>
${code}
</script>`;
    if (src) {
        decoded = `<script src="${src}"></script>\n` + decoded;
    }

    const fullDoc = `
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; font-family: sans-serif; }
          </style>
          <script>
            window.sendOpeningData = function(text, data) {
              if (window.parent && typeof window.parent.sendOpeningData === 'function') {
                try {
                  window.parent.sendOpeningData(text, data);
                  return;
                } catch(e) {}
              }
              window.parent.postMessage({ type: 'sendOpeningData', text: text, data: data }, '*');
            };
            window.TawaAPI = {
              sendAction: function(action, payload) {
                window.parent.postMessage({ type: 'TAWA_WIDGET_ACTION', action: action, payload: payload }, '*');
              },
              postMessage: function(action, payload) {
                this.sendAction(action, payload);
              },
              sendOpeningData: function(text, data) {
                window.sendOpeningData(text, data);
              },
              send_opening_data: function(text, data) {
                window.sendOpeningData(text, data);
              }
            };
            window.waitGlobalInitialized = function() {
              if (window.parent && typeof window.parent.waitGlobalInitialized === 'function') {
                return window.parent.waitGlobalInitialized();
              }
              return Promise.resolve(true);
            };
          </script>
        </head>
        <body>
          ${decoded}
        </body>
      </html>
    `;

    return (
      <iframe
        title="Regex Script Executor"
        srcDoc={fullDoc}
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
        style={{
          width: '100%',
          minHeight: '200px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          marginTop: '16px',
          marginBottom: '16px'
        }}
        {...props}
      />
    );
  },
  style: ({ children, ...props }: any) => {
    const code = Array.isArray(children) ? children.join('\n') : children;
    
    // Quick regex-based CSS scoping: 
    // This looks for CSS selectors before '{' and prefixes them with our wrapper ID.
    // It ignores @media, @keyframes, and percentage stops.
    let scopedCode = code || '';
    if (props['data-scoper']) {
       scopedCode = scopedCode.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/gi, (match: string) => {
          const trimmed = match.trim();
          if (trimmed.startsWith('@') || trimmed.match(/^[0-9]+%|^from|^to/i)) return match;
          
          return match.split(',').map(s => `#${props['data-scoper']} ${s.trim()}`).join(', ') + (match.endsWith('{') ? ' {' : '');
       });
    }

    return <style {...props} dangerouslySetInnerHTML={{ __html: scopedCode }} />;
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-6">
      <table className="min-w-full border-collapse border border-stone-300 dark:border-slate-700">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-stone-300 dark:border-slate-700 px-4 py-2 bg-stone-200 dark:bg-slate-800 font-bold text-left text-xs uppercase tracking-wider">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-stone-300 dark:border-slate-700 px-4 py-2 text-sm">
      {children}
    </td>
  ),
  hr: () => <hr className="my-8 border-t border-stone-300 dark:border-slate-700" />,
  strong: ({ children }) => <strong className="font-bold text-mystic-accent/80">{children}</strong>,
  em: ({ children }) => <em className="italic opacity-90">{children}</em>,
  a: ({ href, children, ...props }) => (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="text-mystic-accent hover:underline decoration-mystic-accent/30 underline-offset-2"
      {...sanitizeProps(props)}
    >
      {children}
    </a>
  ),
  // === Regex HTML Elements Support ===
  input: ({ node, ...props }: any) => {
    const sanitized = sanitizeProps(props);
    if (props.checked !== undefined && !props.onChange) {
      sanitized.readOnly = true;
    }
    if (props.type === 'checkbox' || props.type === 'radio') {
      return <input className="w-4 h-4 text-mystic-accent bg-stone-100 border-gray-300 rounded focus:ring-mystic-accent dark:bg-slate-700 dark:border-gray-600 cursor-pointer" {...sanitized} />;
    }
    if (props.type === 'hidden') {
      return <input {...sanitized} className="hidden" />;
    }
    return <input className="px-3 py-2 bg-white dark:bg-slate-800 border border-stone-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-mystic-accent focus:border-mystic-accent sm:text-sm text-stone-900 dark:text-stone-100" {...sanitized} />;
  },
  select: ({ node, ...props }: any) => (
    <select className="px-3 py-2 bg-white dark:bg-slate-800 border border-stone-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-mystic-accent focus:border-mystic-accent sm:text-sm text-stone-900 dark:text-stone-100 cursor-pointer" {...sanitizeProps(props)}>
      {props.children}
    </select>
  ),
  option: ({ node, ...props }: any) => <option {...sanitizeProps(props)}>{props.children}</option>,
  textarea: ({ node, ...props }: any) => (
    <textarea className="px-3 py-2 bg-white dark:bg-slate-800 border border-stone-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-mystic-accent focus:border-mystic-accent sm:text-sm w-full min-h-[80px] text-stone-900 dark:text-stone-100 resize-y" {...sanitizeProps(props)} />
  ),
  button: ({ node, ...props }: any) => (
    <button className="px-4 py-2 bg-mystic-accent text-white font-medium rounded shadow hover:bg-mystic-accent/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mystic-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" {...sanitizeProps(props)}>
      {props.children}
    </button>
  ),
  div: ({ node, className, ...props }: any) => (
    <div className={className} {...sanitizeProps(props)}>{props.children}</div>
  ),
  span: ({ node, className, ...props }: any) => (
    <span className={className} {...sanitizeProps(props)}>{props.children}</span>
  ),
  form: ({ node, ...props }: any) => (
    <form className="space-y-4 my-4 p-4 border border-stone-200 dark:border-slate-700 rounded-lg bg-stone-50 dark:bg-slate-800/20" {...sanitizeProps(props)}>
      {props.children}
    </form>
  ),
  label: ({ node, className, ...props }: any) => (
    <label className={`block text-sm font-medium text-stone-700 dark:text-stone-300 ${className || 'mb-1'}`} {...sanitizeProps(props)}>
      {props.children}
    </label>
  ),
  details: ({ node, ...props }: any) => (
    <details className="mb-4 border border-stone-300 dark:border-slate-700 rounded-md p-3 bg-stone-50 dark:bg-slate-800/50 group" {...sanitizeProps(props)}>
      {props.children}
    </details>
  ),
  summary: ({ node, ...props }: any) => (
    <summary className="font-semibold cursor-pointer text-stone-800 dark:text-stone-200 group-open:mb-2 hover:text-mystic-accent transition-colors" {...sanitizeProps(props)}>
      {props.children}
    </summary>
  ),
  // === /Regex HTML Elements Support ===
  think: ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  thinking: ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  ai_guide: ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  ai_guides: ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  'ai-guide': ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  'ai-guides': ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  content: ({ children, ...props }: any) => <div className="mb-4" {...sanitizeProps(props)}>{children}</div>,
  story: ({ children, ...props }: any) => <div className="mb-4" {...sanitizeProps(props)}>{children}</div>,
  branches: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  choices: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  actions: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  meow_FM: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  meow_fm: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  snow: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  ice: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  prologue: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  novel_header: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  novel_state: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  author_note: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  incrementalSummary: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  incrementalsummary: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  table_stored: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  tableEdit: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  tableedit: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  words: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  chapter: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  user_input: ({ children }) => <span className="hidden" aria-hidden="true">{children}</span>,
  hc: ({ children, ...props }: any) => <span className="hidden" aria-hidden="true" {...sanitizeProps(props)}>{children}</span>,
  muttering: ({ children, ...props }: any) => <span className="italic text-[11px] opacity-75" {...sanitizeProps(props)}>{children}</span>,
  quote: ({ children, ...props }: any) => <blockquote className="border-l-4 border-mystic-accent/30 pl-4 py-2 my-4 italic bg-stone-200/30 dark:bg-slate-800/30 rounded-r" {...sanitizeProps(props)}>{children}</blockquote>,
  dice: ({ children, ...props }: any) => <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30" {...sanitizeProps(props)}>🎲 {children}</span>,
  conversation: ({ children, ...props }: any) => <div className="p-3 my-2 border border-stone-200/50 dark:border-stone-800 bg-stone-100/30 dark:bg-stone-900/10 rounded-lg" {...sanitizeProps(props)}>{children}</div>,
  safe: ({ children, ...props }: any) => <div className="p-3 my-2 border border-stone-200/50 dark:border-stone-800 bg-stone-100/30 dark:bg-stone-900/10 rounded-lg" {...sanitizeProps(props)}>{children}</div>,
  
  font: ({ color, children, ...props }: any) => <span style={{ color: color || undefined }} {...sanitizeProps(props)}>{children}</span>,
  
  // Custom tag renderers to prevent standard browser unrecognized tag warnings
  fangshenghua: getCustomTagRenderer('fangshenghua'),
  fangjixie: getCustomTagRenderer('fangjixie'),
  fangshenhua: getCustomTagRenderer('fangshenhua'),
  fangfaqing: getCustomTagRenderer('fangfaqing'),
  fangchongfu: getCustomTagRenderer('fangchongfu'),
  fangjuewang: getCustomTagRenderer('fangjuewang'),
  dsbagu: getCustomTagRenderer('dsbagu'),
  fangbagu: getCustomTagRenderer('fangbagu'),
  qr: getCustomTagRenderer('qr'),
  'qr-btn': getCustomTagRenderer('qr-btn'),
  
  time: ({ children, ...props }: any) => (
    <div className="font-mono text-xs text-center text-stone-500 dark:text-stone-400 py-2 border-y border-stone-200 dark:border-slate-700/50 my-4" {...sanitizeProps(props)}>
      {children}
    </div>
  ),

  equip: ({ children, ...props }: any) => (
    <div className="my-4 border border-blue-500/30 bg-blue-500/10 rounded-lg p-4 shadow-sm" {...sanitizeProps(props)}>
      <div className="flex items-center gap-2 mb-2 font-bold text-blue-500 uppercase text-xs tracking-wider">
        🛡️ Trang Bị / Vật Phẩm
      </div>
      <div className="text-sm font-medium whitespace-pre-wrap text-stone-800 dark:text-stone-200">
        {children}
      </div>
    </div>
  ),
  swordskill: ({ children, ...props }: any) => (
    <div className="my-4 border border-red-500/30 bg-red-500/10 rounded-lg p-4 shadow-sm" {...sanitizeProps(props)}>
      <div className="flex items-center gap-2 mb-2 font-bold text-red-500 uppercase text-xs tracking-wider">
        ⚔️ Kiếm Kỹ / Kỹ Năng
      </div>
      <div className="text-sm font-medium whitespace-pre-wrap text-stone-800 dark:text-stone-200">
        {children}
      </div>
    </div>
  ),
  'user-status': ({ children, ...props }: any) => (
    <div className="my-4 border border-emerald-500/30 bg-emerald-500/5 rounded-lg p-4 shadow-sm" {...sanitizeProps(props)}>
      <div className="flex items-center gap-2 mb-2 font-bold text-emerald-600 dark:text-emerald-400 uppercase text-xs tracking-wider">
        👤 Bảng Trạng Thái
      </div>
      <div className="text-sm whitespace-pre-wrap text-stone-800 dark:text-stone-200">
        {children}
      </div>
    </div>
  ),
  calendar: ({ children, ...props }: any) => {
    const text = extractText(children);
    
    // Parse pseudo-YAML calendar
    let year = '', month = '', day = '';
    const events: {day: string, text: string}[] = [];
    
    const lines = text.split('\n');
    let parsingDays = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      if (trimmed.startsWith('year:')) year = trimmed.split(':')[1].trim();
      else if (trimmed.startsWith('month:')) month = trimmed.split(':')[1].trim();
      else if (trimmed.startsWith('current_day:')) day = trimmed.split(':')[1].trim();
      else if (trimmed.startsWith('days:')) parsingDays = true;
      else if (parsingDays) {
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0 && colonIdx < 10) { // e.g., "6:" or "12:"
           const d = trimmed.substring(0, colonIdx).trim();
           const eventText = trimmed.substring(colonIdx + 1).trim();
           events.push({ day: d, text: eventText });
        } else if (events.length > 0) {
           events[events.length - 1].text += ' ' + trimmed;
        }
      }
    }
    
    if (year || month || day || events.length > 0) {
      return (
        <div className="my-4 border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl p-0 overflow-hidden shadow-sm" {...sanitizeProps(props)}>
          <div className="bg-purple-500/10 px-4 py-3 flex items-center justify-between border-b border-purple-500/20">
            <div className="flex items-center gap-2 font-bold text-purple-600 dark:text-purple-400 uppercase text-xs tracking-wider">
              <i className="fas fa-calendar-alt"></i> Lịch Trình
            </div>
            {(year || month || day) && (
              <div className="text-[10px] font-black uppercase tracking-widest bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded">
                Ngày {day}/{month}/{year}
              </div>
            )}
          </div>
          <div className="p-4 space-y-3">
            {events.map((e, i) => {
              const isCurrent = e.day === day;
              return (
                <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${isCurrent ? 'bg-purple-500/20 border-purple-500/40' : 'bg-stone-500/5 border-stone-500/20 hover:border-purple-500/30'}`}>
                  <div className={`w-8 h-8 shrink-0 flex flex-col items-center justify-center rounded uppercase font-bold text-[10px] ${isCurrent ? 'bg-purple-500 text-white shadow-md' : 'bg-stone-200 dark:bg-slate-700 text-stone-600 dark:text-slate-300'}`}>
                    <span className="text-xs leading-none">{e.day}</span>
                  </div>
                  <div className={`text-sm pt-1 leading-relaxed ${isCurrent ? 'text-purple-900 dark:text-purple-100 font-medium' : 'text-stone-700 dark:text-stone-300'}`}>
                    {e.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="my-4 border border-purple-500/30 bg-purple-500/5 rounded-lg p-4 shadow-sm" {...sanitizeProps(props)}>
        <div className="flex items-center gap-2 mb-2 font-bold text-purple-600 dark:text-purple-400 uppercase text-xs tracking-wider">
          📅 Lịch Trình / Thời Gian
        </div>
        <div className="text-sm whitespace-pre-wrap font-mono text-stone-800 dark:text-stone-200">
          {children}
        </div>
      </div>
    );
  },
  'zd-status': ({ children, ...props }: any) => {
    const text = extractText(children);
    const hasBrackets = text.includes('[') && text.includes(']');
    
    // Default render for pre-formatted blocks that don't match bracket syntax (or fallback)
    let content = <div className="text-sm whitespace-pre-wrap font-mono text-stone-800 dark:text-stone-200">{children}</div>;
    
    if (hasBrackets) {
      const tags: {key: string, value: string}[] = [];
      const regex = /\[(.*?)\]/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const parts = match[1].split(':');
        if (parts.length >= 2) {
           tags.push({ key: parts[0].trim(), value: parts.slice(1).join(':').trim() });
        } else {
           tags.push({ key: 'TRẠNG THÁI', value: parts[0] });
        }
      }
      
      if (tags.length > 0) {
        content = (
          <div className="flex flex-wrap gap-1 mt-1">
            {tags.map((t, i) => (
              <TagBadge key={i} label={t.key} value={t.value} bg="bg-amber-500/20 text-amber-800 dark:text-amber-200" />
            ))}
          </div>
        );
      }
    }

    return (
      <div className="my-4 border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl p-4 shadow-sm" {...sanitizeProps(props)}>
        <div className="flex items-center gap-2 mb-3 font-bold text-amber-600 dark:text-amber-400 uppercase text-xs tracking-wider border-b border-amber-500/20 pb-2">
          <i className="fas fa-chart-bar"></i> Trạng Thái Trận Chiến
        </div>
        {content}
      </div>
    );
  },
  digest: ({ children, ...props }: any) => {
    const text = extractText(children);
    const hasBrackets = text.includes('[') && text.includes(']');
    
    let content = <div className="text-sm whitespace-pre-wrap text-stone-800 dark:text-stone-200">{children}</div>;
    
    if (hasBrackets) {
      const tags: {key: string, value: string}[] = [];
      const regex = /\[(.*?)\]/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const parts = match[1].split(':');
        if (parts.length >= 2) {
           tags.push({ key: parts[0].trim(), value: parts.slice(1).join(':').trim() });
        } else {
           tags.push({ key: 'INFO', value: parts[0] });
        }
      }
      
      if (tags.length > 0) {
        content = (
          <div className="flex flex-col gap-2 mt-1">
            {tags.map((t, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 bg-stone-500/10 rounded-lg p-2.5 border border-stone-500/20">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-stone-500 min-w-[100px] shrink-0 mt-0.5">{t.key}</span>
                <span className="text-sm text-stone-800 dark:text-stone-200 font-medium leading-relaxed">{t.value}</span>
              </div>
            ))}
          </div>
        );
      }
    }

    return (
      <div className="my-4 border border-stone-500/30 bg-stone-500/5 rounded-xl p-4 shadow-sm" {...sanitizeProps(props)}>
        <div className="flex items-center gap-2 mb-3 font-bold text-stone-600 dark:text-stone-400 uppercase text-xs tracking-wider border-b border-stone-500/20 pb-2">
          <i className="fas fa-clipboard-list"></i> Tóm Tắt Tình Hình
        </div>
        {content}
      </div>
    );
  },

  statusplaceholderimpl: ({ children, ...props }: any) => <span className="hidden" aria-hidden="true" {...sanitizeProps(props)}>{children}</span>,
  real: ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  ontologicalseverance: ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  user: ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  hypotheticalconstruct: ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  axiomaticimmunity: ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  experimentaldrift: ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  hermeticseal: ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  resonancepurpose: ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  sovereignlogic: ({ children, ...props }: any) => <span {...sanitizeProps(props)}>{children}</span>,
  'tawa-widget': MemoizedTawaWidget as any,
  'regex-widget': (props: any) => {
    const contentAttr = props['data-content'];
    if (!contentAttr) return null;
    let decoded = '';
    try {
      if (typeof atob !== 'undefined') {
        decoded = decodeURIComponent(escape(atob(contentAttr)));
      } else {
        decoded = Buffer.from(contentAttr, 'base64').toString('utf-8');
      }
    } catch (e) {
      console.error("Error decoding Regex Widget:", e);
      return <div style={{ color: 'red', fontSize: '12px' }}>Error decoding widget</div>;
    }

    const fullDoc = `
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; font-family: sans-serif; }
          </style>
        </head>
        <body>
          ${decoded}
        </body>
      </html>
    `;

    return (
      <iframe
        title="Regex Code Runner"
        srcDoc={fullDoc}
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
        style={{
          width: '100%',
          minHeight: '200px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          marginTop: '16px',
          marginBottom: '16px'
        }}
      />
    );
  },
  status_format: ({ children }: any) => <span className="status-format font-mono text-stone-300 bg-stone-850/40 px-1 rounded">{children}</span>,
  'status-format': ({ children }: any) => <span className="status-format font-mono text-stone-300 bg-stone-850/40 px-1 rounded">{children}</span>,
  comprehensive_now_status: ({ children }: any) => <span className="comprehensive-now-status font-mono text-stone-300 bg-stone-850/40 px-1 rounded">{children}</span>,
  'comprehensive-now-status': ({ children }: any) => <span className="comprehensive-now-status font-mono text-stone-300 bg-stone-850/40 px-1 rounded">{children}</span>,
  newspaper_status_format: ({ children }: any) => <span className="newspaper-status-format font-mono text-stone-300 bg-stone-850/40 px-1 rounded">{children}</span>,
  'newspaper-status-format': ({ children }: any) => <span className="newspaper-status-format font-mono text-stone-300 bg-stone-850/40 px-1 rounded">{children}</span>,
  user_now_status: ({ children }: any) => <span className="user-now-status font-mono text-stone-300 bg-stone-850/40 px-1 rounded">{children}</span>,
  'user-now-status': ({ children }: any) => <span className="user-now-status font-mono text-stone-300 bg-stone-850/40 px-1 rounded">{children}</span>,
  NPC_status: ({ children }: any) => <span className="npc-status font-mono text-stone-300 bg-stone-850/40 px-1 rounded">{children}</span>,
  npc_status: ({ children }: any) => <span className="npc-status font-mono text-stone-300 bg-stone-850/40 px-1 rounded">{children}</span>,
  'npc-status': ({ children }: any) => <span className="npc-status font-mono text-stone-300 bg-stone-850/40 px-1 rounded">{children}</span>,
  status_2: ({ children }: any) => <span className="status-2 font-mono text-stone-300 bg-stone-850/40 px-1 rounded">{children}</span>,
  'status-2': ({ children }: any) => <span className="status-2 font-mono text-stone-300 bg-stone-850/40 px-1 rounded">{children}</span>,

  // Native Support for SVGs inside markdown
  svg: ({ children, ...props }: any) => <svg {...sanitizeProps(props)}>{children}</svg>,
  g: ({ children, ...props }: any) => <g {...sanitizeProps(props)}>{children}</g>,
  path: ({ children, ...props }: any) => <path {...sanitizeProps(props)}>{children}</path>,
  defs: ({ children, ...props }: any) => <defs {...sanitizeProps(props)}>{children}</defs>,
  linearGradient: ({ children, ...props }: any) => <linearGradient {...sanitizeProps(props)}>{children}</linearGradient>,
  lineargradient: ({ children, ...props }: any) => <linearGradient {...sanitizeProps(props)}>{children}</linearGradient>,
  radialGradient: ({ children, ...props }: any) => <radialGradient {...sanitizeProps(props)}>{children}</radialGradient>,
  radialgradient: ({ children, ...props }: any) => <radialGradient {...sanitizeProps(props)}>{children}</radialGradient>,
  rect: ({ children, ...props }: any) => <rect {...sanitizeProps(props)}>{children}</rect>,
  circle: ({ children, ...props }: any) => <circle {...sanitizeProps(props)}>{children}</circle>,
  ellipse: ({ children, ...props }: any) => <ellipse {...sanitizeProps(props)}>{children}</ellipse>,
  line: ({ children, ...props }: any) => <line {...sanitizeProps(props)}>{children}</line>,
  polyline: ({ children, ...props }: any) => <polyline {...sanitizeProps(props)}>{children}</polyline>,
  polygon: ({ children, ...props }: any) => <polygon {...sanitizeProps(props)}>{children}</polygon>,
  text: ({ children, ...props }: any) => <text {...sanitizeProps(props)}>{children}</text>,
  tspan: ({ children, ...props }: any) => <tspan {...sanitizeProps(props)}>{children}</tspan>,
  use: ({ children, ...props }: any) => <use {...sanitizeProps(props)}>{children}</use>,
  symbol: ({ children, ...props }: any) => <symbol {...sanitizeProps(props)}>{children}</symbol>,
  mask: ({ children, ...props }: any) => <mask {...sanitizeProps(props)}>{children}</mask>,
  clipPath: ({ children, ...props }: any) => <clipPath {...sanitizeProps(props)}>{children}</clipPath>,
  clippath: ({ children, ...props }: any) => <clipPath {...sanitizeProps(props)}>{children}</clipPath>,
  stop: ({ children, ...props }: any) => <stop {...sanitizeProps(props)}>{children}</stop>,
  image: ({ children, ...props }: any) => <image {...sanitizeProps(props)}>{children}</image>,
  pattern: ({ children, ...props }: any) => <pattern {...sanitizeProps(props)}>{children}</pattern>,
  filter: ({ children, ...props }: any) => <filter {...sanitizeProps(props)}>{children}</filter>,
  feFlood: ({ children, ...props }: any) => <feFlood {...sanitizeProps(props)}>{children}</feFlood>,
  feflood: ({ children, ...props }: any) => <feFlood {...sanitizeProps(props)}>{children}</feFlood>,
  feBlend: ({ children, ...props }: any) => <feBlend {...sanitizeProps(props)}>{children}</feBlend>,
  feblend: ({ children, ...props }: any) => <feBlend {...sanitizeProps(props)}>{children}</feBlend>,
  feMerge: ({ children, ...props }: any) => <feMerge {...sanitizeProps(props)}>{children}</feMerge>,
  femerge: ({ children, ...props }: any) => <feMerge {...sanitizeProps(props)}>{children}</feMerge>,
  feMergeNode: ({ children, ...props }: any) => <feMergeNode {...sanitizeProps(props)}>{children}</feMergeNode>,
  femergenode: ({ children, ...props }: any) => <feMergeNode {...sanitizeProps(props)}>{children}</feMergeNode>,
  feColorMatrix: ({ children, ...props }: any) => <feColorMatrix {...sanitizeProps(props)}>{children}</feColorMatrix>,
  fecolormatrix: ({ children, ...props }: any) => <feColorMatrix {...sanitizeProps(props)}>{children}</feColorMatrix>,
  feOffset: ({ children, ...props }: any) => <feOffset {...sanitizeProps(props)}>{children}</feOffset>,
  feoffset: ({ children, ...props }: any) => <feOffset {...sanitizeProps(props)}>{children}</feOffset>,
  feGaussianBlur: ({ children, ...props }: any) => <feGaussianBlur {...sanitizeProps(props)}>{children}</feGaussianBlur>,
  fegaussianblur: ({ children, ...props }: any) => <feGaussianBlur {...sanitizeProps(props)}>{children}</feGaussianBlur>,
};

const markdownComponents = new Proxy(markdownComponentsRaw, {
  has(target, prop) {
    if (typeof prop === 'string') {
      if (prop in target) return true;
      if (/^[a-z][a-z0-9_-]*$/.test(prop)) return true;
    }
    return prop in target;
  },
  get(target, prop) {
    if (typeof prop === 'string') {
      if (prop in target) {
        return target[prop as keyof typeof target];
      }
      if (/^[a-z][a-z0-9_-]*$/.test(prop)) {
        return getCustomTagRenderer(prop);
      }
    }
    return undefined;
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop === 'string') {
      if (prop in target) {
        return Object.getOwnPropertyDescriptor(target, prop);
      }
      if (/^[a-z][a-z0-9_-]*$/.test(prop)) {
        return {
          configurable: true,
          enumerable: true,
          value: getCustomTagRenderer(prop),
          writable: false
        };
      }
    }
    return Object.getOwnPropertyDescriptor(target, prop);
  },
  ownKeys(target) {
    const targetKeys = Reflect.ownKeys(target);
    const scannedKeys = Object.keys(getCustomTagDefinitions());
    const extraKeys = ['qr', 'qr-btn'];
    const allKeys = new Set([...targetKeys, ...scannedKeys, ...extraKeys]);
    return Array.from(allKeys);
  }
}) as any;

/**
 * Kỹ thuật B: Sửa lỗi tự động chuỗi ký tự xuống dòng trái phép trong JavaScript (literal newline)
 * Tự động tìm chuỗi dùng nháy đơn (') hoặc nháy kép (") kéo dài nhiều dòng mà không được escape,
 * sau đó chuyển đổi chúng thành Template Literal (dấu backticks `) và escape các ký tự nội suy nếu cần.
 */
function repairLiteralNewlines(code: string): string {
  let inSingleComment = false;
  let inMultiComment = false;
  let inString: '"' | "'" | null = null;
  let inTemplate = false;
  let stringStartIdx = -1;
  let hasNewline = false;
  
  const replacements: { start: number; end: number }[] = [];

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = code[i + 1] || '';

    if (inSingleComment) {
      if (char === '\n' || char === '\r') {
        inSingleComment = false;
      }
      continue;
    }

    if (inMultiComment) {
      if (char === '*' && nextChar === '/') {
        inMultiComment = false;
        i++;
      }
      continue;
    }

    if (inString !== null) {
      if (char === '\\') {
        i++;
        continue;
      }
      if (char === '\n' || char === '\r') {
        hasNewline = true;
        continue;
      }
      if (char === inString) {
        if (hasNewline) {
          replacements.push({ start: stringStartIdx, end: i });
        }
        inString = null;
      }
      continue;
    }

    if (inTemplate) {
      if (char === '\\') {
        i++;
        continue;
      }
      if (char === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (char === '/' && nextChar === '/') {
      inSingleComment = true;
      i++;
      continue;
    }
    if (char === '/' && nextChar === '*') {
      inMultiComment = true;
      i++;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = char;
      stringStartIdx = i;
      hasNewline = false;
      continue;
    }
    if (char === '`') {
      inTemplate = true;
      continue;
    }
  }

  if (replacements.length === 0) return code;

  let repaired = code;
  for (let j = replacements.length - 1; j >= 0; j--) {
    const { start, end } = replacements[j];
    let stringContent = repaired.slice(start + 1, end);
    stringContent = stringContent.replace(/\$\{/g, '\\${');
    
    repaired = 
      repaired.slice(0, start) + 
      '`' + 
      stringContent + 
      '`' + 
      repaired.slice(end + 1);
  }

  return repaired;
}

/**
 * Trích xuất các khối mã HTML/XML/JS/Humble Script từ câu trả lời gỡ lỗi của AI trợ lý
 */
function extractHtmlCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const regex = /```(?:html|xml|javascript|js)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1] && match[1].trim()) {
      blocks.push(match[1].trim());
    }
  }
  return blocks;
}

const IframeSandboxWidget = ({ contentAttr }: { contentAttr: string }) => {
  const [showSource, setShowSource] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<{type: string, message: string, time: string, lineno?: number}[]>([]);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [highlightedRawLine, setHighlightedRawLine] = useState<number | null>(null);
  const [sourceTab, setSourceTab] = useState<'raw' | 'compiled' | 'ai'>('raw');
  const [aiChat, setAiChat] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const storageKey = useMemo(() => {
    if (!contentAttr) return '';
    let hash = 0;
    for (let i = 0; i < contentAttr.length; i++) {
      const char = contentAttr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `sandbox_widget_code_${Math.abs(hash)}`;
  }, [contentAttr]);

  const [editedCode, setEditedCode] = useState<string | null>(() => {
    if (!contentAttr) return null;
    let hash = 0;
    for (let i = 0; i < contentAttr.length; i++) {
       const char = contentAttr.charCodeAt(i);
       hash = (hash << 5) - hash + char;
       hash = hash & hash;
    }
    const key = `sandbox_widget_code_${Math.abs(hash)}`;
    try {
      const cached = dbService.getKeyValueSync(key);
      return typeof cached === "string" ? cached : (cached ? JSON.stringify(cached) : null);
    } catch (e) {
      console.error("Lỗi đọc code đã lưu:", e);
      return null;
    }
  });

  const [isEditingManually, setIsEditingManually] = useState(false);
  const [disableJsTransform, setDisableJsTransform] = useState<boolean>(() => {
    try {
      const cached = dbService.getKeyValueSync('tawa_sandbox_disable_js_transform');
      return cached === true || cached === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      dbService.setKeyValue('tawa_sandbox_disable_js_transform', disableJsTransform);
    } catch (e) {
      console.error(e);
    }
  }, [disableJsTransform]);

  useEffect(() => {
    if (storageKey) {
      if (editedCode !== null) {
        try {
          dbService.setKeyValue(storageKey, editedCode);
        } catch (e) {
          console.error("Lỗi lưu code sandbox:", e);
        }
      } else {
        try {
          dbService.removeKeyValue(storageKey);
        } catch (e) {
          console.error("Lỗi xóa code sandbox:", e);
        }
      }
    }
  }, [editedCode, storageKey]);

  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const widgetId = useMemo(() => Math.random().toString(36).substring(2, 9), []);

  useEffect(() => {
    console.log(`[IframeSandboxWidget] Initializing widget ${widgetId} with content length: ${contentAttr?.length}`);
  }, [widgetId, contentAttr?.length]);

  const decoded = useMemo(() => {
    if (!contentAttr && editedCode === null) return '';
    let dec = '';
    try {
      if (editedCode !== null) {
        dec = editedCode;
      } else {
        if (typeof atob !== 'undefined') {
          dec = decodeURIComponent(escape(atob(contentAttr)));
        } else {
          dec = Buffer.from(contentAttr, 'base64').toString('utf-8');
        }
      }
      
      // Fix: Escape any </script in content before rendering to prevent early browser tag closing SyntaxErrors
      dec = dec.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, 
        (_m, open, code, close) => open + code.replace(/<\/script/gi, '<\\\\/script') + close
      );

      // Fix: Transform const/let/class inside script tags into global-scoped var variables 
      // This allows them to bind to the window global object inside raw HTML widget preview sandboxes
      // so inline handlers like onclick="toggleTalent()" can find them.
      if (!disableJsTransform) {
        dec = dec.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_m, open, code, close) => {
          let temp = code;
          
          // Khắc phục kỹ thuật tự động sửa lỗi xuống dòng trái phép trong chuỗi (literal newline)
          temp = repairLiteralNewlines(temp);

          // Hỗ trợ export/import: Biến đổi các câu lệnh import và export trong block script thông thường để không gây lỗi cú pháp
          const isModuleScript = /type\s*=\s*["']module["']/i.test(open);
          if (!isModuleScript) {
            // 1) export const / let / var / function / class => loại bỏ từ khóa 'export'
            temp = temp.replace(/\bexport\s+(const|let|var|function|class)\b/g, '$1');

            // 2) export default function / class => loại bỏ 'export default' để khai báo trực tiếp
            temp = temp.replace(/\bexport\s+default\s+(function|class)\b/g, '$1');

            // 3) export default <biểu thức>; => chuyển thành ghi chú hoặc câu lệnh thông thường
            temp = temp.replace(/\bexport\s+default\s+([^;\n]+);?/g, '/* export default */ $1;');

            // 4) export { a, b as c }; => đóng băng/chuyển thành chú thích
            temp = temp.replace(/\bexport\s*\{[\s\S]*?\};?/g, '/* $& */');

            // 5) import { a, b } from 'c'; hoặc import x from 'y'; => đóng băng/chuyển thành chú thích để tránh lỗi cú pháp ngoài module
            temp = temp.replace(/\bimport\s+[\s\S]*?\s+from\s+["'][^"']*["'];?/g, '/* $& */');
            temp = temp.replace(/\bimport\s+["'][^"']*["'];?/g, '/* $& */');
          }

          // Protect comments, string literals and template strings from being incorrectly transformed
          const tokenRegex = /(\/\*[\s\S]*?\*\/)|(\/\/.*)|("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(`(?:[^`\\]|\\.)*`)/g;
          const placeholders: string[] = [];
          temp = temp.replace(tokenRegex, (match) => {
            const placeholder = `__TAWA_PLACEHOLDER_${placeholders.length}__`;
            placeholders.push(match);
            return placeholder;
          });

          // Replace const/let with var (excluding identifiers starting with const/let)
          temp = temp.replace(/(?:^|[^a-zA-Z0-9_$])\b(const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, (match, type) => {
            return match.replace(new RegExp(`\\b${type}\\b`), 'var');
          });
          // Replace class declaration with var name = class name
          temp = temp.replace(/(?:^|[^a-zA-Z0-9_$])\bclass\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, (match, name) => {
            return match.replace(`class ${name}`, `var ${name} = class ${name}`);
          });

          // Restore protected tokens
          for (let i = 0; i < placeholders.length; i++) {
            temp = temp.replace(`__TAWA_PLACEHOLDER_${i}__`, () => placeholders[i]);
          }
          return open + temp + close;
        });
      }

      // Fix 1: Vấn đề gốc rễ - Babel sandbox không thể hoạt động do không có allow-same-origin.
      // Loại bỏ type="text/babel" và data-presets="..." để cho phép trình duyệt dịch native ES6.
      dec = dec.replace(/<script\b([^>]*)\btype\s*=\s*["']text\/babel["']([^>]*)>/gi, '<script$1$2>');
      dec = dec.replace(/<script\b([^>]*)\bdata-presets\s*=\s*["'][^"']*["']([^>]*)>/gi, '<script$1$2>');
      
      return dec;
    } catch (e) {
      console.error(`[IframeSandboxWidget] Error decoding Widget ${widgetId}:`, e);
      return '';
    }
  }, [contentAttr, editedCode, disableJsTransform, widgetId]);

  const isFullHtml = useMemo(() => /<!DOCTYPE\s+html>|<\s*html\b/i.test(decoded), [decoded]);

  const safeWidgetId = useMemo(() => JSON.stringify(widgetId), [widgetId]);
  const bridgeScript = useMemo(() => `
    <script id="tawa-bridge">
      (function() {
        var _widgetId = ${safeWidgetId};
        window.sendOpeningData = function(text, data) {
          if (window.parent && typeof window.parent.sendOpeningData === 'function') {
            try {
              window.parent.sendOpeningData(text, data);
              return;
            } catch(e) {}
          }
          window.parent.postMessage({ type: 'sendOpeningData', id: _widgetId, text: text, data: data }, '*');
        };

        window.TawaAPI = {
          sendAction: function(action, payload) {
            window.parent.postMessage({ type: 'TAWA_WIDGET_ACTION', id: _widgetId, action: action, payload: payload }, '*');
          },
          // For backwards compatibility and alias
          postMessage: function(action, payload) {
            this.sendAction(action, payload);
          },
          sendOpeningData: function(text, data) {
            window.sendOpeningData(text, data);
          },
          send_opening_data: function(text, data) {
            window.sendOpeningData(text, data);
          },
          showSelect: function(options, title, defaultValue) {
            return new Promise(function(resolve) {
              var requestId = Math.random().toString(36).substr(2, 9);
              window.postMessageSelectResolvers = window.postMessageSelectResolvers || {};
              window.postMessageSelectResolvers[requestId] = resolve;
              window.parent.postMessage({
                type: 'TAWA_WIDGET_ACTION',
                id: _widgetId,
                action: 'SHOW_SELECT',
                payload: {
                  options: options,
                  title: title,
                  defaultValue: defaultValue,
                  requestId: requestId
                }
              }, '*');
            });
          }
        };

        window.tavo = {
          select: function(options, title, defaultValue) {
            return window.TawaAPI.showSelect(options, title, defaultValue);
          }
        };

        window.addEventListener('message', function(e) {
          if (e.data && e.data.type === 'TAWA_WIDGET_SELECT_RESPONSE') {
            var resolve = window.postMessageSelectResolvers && window.postMessageSelectResolvers[e.data.requestId];
            if (resolve) {
              resolve(e.data.value);
              delete window.postMessageSelectResolvers[e.data.requestId];
            }
          }
        });

        window.waitGlobalInitialized = function() {
          if (window.parent && typeof window.parent.waitGlobalInitialized === 'function') {
            return window.parent.waitGlobalInitialized();
          }
          return Promise.resolve(true);
        };

        // SillyTavern global mock proxies
        window.getCharWorldbookNames = function() {
            var names = [];
            if (window.parent && window.parent.TavernHelper) {
                try {
                    names = window.parent.TavernHelper.getWorldbookNames() || [];
                } catch(e) {
                    console.error("[TawaBridge] Error getCharWorldbookNames:", e);
                }
            }
            if (names.indexOf('Kenshi') === -1) {
                names.push('Kenshi');
            }
            return names;
        };

        window.getWorldbooks = function() {
            var result = {};
            if (window.parent && window.parent.TavernHelper) {
                try {
                    var names = window.parent.TavernHelper.getWorldbookNames() || [];
                    var rawBooks = window.parent.TavernHelper.getWorldbooks ? window.parent.TavernHelper.getWorldbooks() : [];
                    
                    for (var i = 0; i < names.length; i++) {
                        var name = names[i];
                        var rawBook = rawBooks.find ? rawBooks.find(function(b) { return b.name === name; }) : null;
                        var entriesObj = {};
                        if (rawBook && rawBook.entries) {
                            if (Array.isArray(rawBook.entries)) {
                                rawBook.entries.forEach(function(entry) {
                                    var uid = entry.uid || Math.random().toString(36).substring(2, 9);
                                    entriesObj[uid] = entry;
                                });
                            } else {
                                entriesObj = rawBook.entries;
                            }
                        }
                        result[name] = {
                            name: name,
                            entries: entriesObj
                        };
                    }
                } catch(e) {
                    console.error("[TawaBridge] Error getWorldbooks:", e);
                }
            }
            if (!result['Kenshi']) {
                result['Kenshi'] = {
                    name: 'Kenshi',
                    entries: {}
                };
            }
            return result;
        };

        window.getWorldbook = function(name) {
            var books = window.getWorldbooks();
            return books[name] || { name: name, entries: {} };
        };

        window.getVariables = function() {
            if (window.parent && window.parent.TavernHelper) {
                try {
                    return window.parent.TavernHelper.getVariables() || {};
                } catch(e) {
                    return {};
                }
            }
            return {};
        };

        window.setVariables = function(vars) {
            if (window.parent && window.parent.TavernHelper) {
                try {
                    return window.parent.TavernHelper.updateVariablesWith(vars);
                } catch(e) {
                    return false;
                }
            }
            return false;
        };

        window.setVariable = function(key, val) {
            var obj = {};
            obj[key] = val;
            return window.setVariables(obj);
        };

        window.getCharacterName = function() {
            var vars = window.getVariables();
            return vars.char_name || 'Character';
        };

        window.getCharName = function() {
            return window.getCharacterName();
        };

        window.getUserName = function() {
            var vars = window.getVariables();
            return vars.user_name || 'User';
        };

        window.getCurrentMessageId = function() {
            if (window.parent) {
                try {
                    if (typeof window.parent.getCurrentMessageId === 'function') {
                        return window.parent.getCurrentMessageId();
                    } else if (window.parent.TavernHelper && typeof window.parent.TavernHelper.getCurrentMessageId === 'function') {
                        return window.parent.TavernHelper.getCurrentMessageId();
                    }
                } catch(e) {
                    return 0;
                }
            }
            return 0;
        };

        // Tawa Logging Override
        var _log = console.log, _warn = console.warn, _error = console.error, _info = console.info;
        function sendLog(level, args) {
            var msg = Array.from(args).map(function(a) {
                if (a instanceof Error) {
                    return a.stack || a.message;
                }
                if (typeof a === 'object' && a !== null) {
                    try {
                        return JSON.stringify(a);
                    } catch (e) {
                        return '[Circular or Unserializable Object]';
                    }
                }
                return String(a);
            }).join(' ');
            
            // Filter out benign Vite WebSocket/HMR noise
            if (msg.indexOf('WebSocket') !== -1 || msg.indexOf('websocket') !== -1 || msg.indexOf('vite') !== -1 || msg.indexOf('[vite]') !== -1) {
                return;
            }
            
            window.parent.postMessage({ type: 'TAWA_WIDGET_LOG', id: _widgetId, level: level, message: msg }, '*');
        }
        console.log = function() { sendLog('log', arguments); _log.apply(console, arguments); };
        console.warn = function() { sendLog('warn', arguments); _warn.apply(console, arguments); };
        console.error = function() { sendLog('error', arguments); _error.apply(console, arguments); };
        console.info = function() { sendLog('info', arguments); _info.apply(console, arguments); };
        
        window.addEventListener('error', function(event) {
            var msg = event.message || '';
            if (msg.indexOf('WebSocket') !== -1 || msg.indexOf('websocket') !== -1 || msg.indexOf('vite') !== -1) {
                return;
            }
            window.parent.postMessage({ 
                type: 'TAWA_WIDGET_LOG', 
                id: _widgetId, 
                level: 'error', 
                message: event.message + ' (at line ' + event.lineno + ')',
                lineno: event.lineno
            }, '*');
        });
        window.addEventListener('unhandledrejection', function(event) {
            var reasonStr = '';
            if (event.reason) {
                reasonStr = event.reason.message || String(event.reason);
            }
            if (reasonStr.indexOf('WebSocket') !== -1 || reasonStr.indexOf('websocket') !== -1 || reasonStr.indexOf('vite') !== -1) {
                return;
            }
            sendLog('error', ['Unhandled Promise Rejection:', event.reason]);
        });
      })();
    </script>
  `, [safeWidgetId]);

  const { fullDoc, lineMapOffset } = useMemo(() => {
    let doc = '';
    let offset = 0;
    
    if (isFullHtml) {
      if (/<head\b[^>]*>/i.test(decoded)) {
        const headMatch = decoded.match(/(<head\b[^>]*>)/i);
        const headIndex = decoded.indexOf(headMatch![0]);
        const bridgeLinesCount = bridgeScript.split('\n').length;
        doc = decoded.replace(/(<head\b[^>]*>)/i, function(match) { return match + '\n' + bridgeScript; });
        offset = bridgeLinesCount; 
      } else if (/<html\b[^>]*>/i.test(decoded)) {
        const bridgeHeader = '<head>\n' + bridgeScript + '\n</head>';
        const bridgeLinesCount = bridgeHeader.split('\n').length;
        doc = decoded.replace(/(<html\b[^>]*>)/i, function(match) { return match + bridgeHeader; });
        offset = bridgeLinesCount;
      } else {
        const bridgeLinesCount = bridgeScript.split('\n').length + 1;
        doc = bridgeScript + '\n' + decoded;
        offset = bridgeLinesCount;
      }
    } else {
      const preamble = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      html, body { 
        margin: 0; padding: 0; 
        font-family: system-ui, -apple-system, sans-serif; 
        background-color: transparent; 
        color: #1c1917; /* stone-900 */
        overflow-x: hidden;
      }
      body { padding: 12px; }
      * { box-sizing: border-box; }
      button, input, select, textarea { font-family: inherit; }
    </style>
    ${bridgeScript}
  </head>
  <body>
    <div id="root"></div>`;
      
      doc = `${preamble}\n${decoded}\n  </body>\n</html>`;
      offset = preamble.split('\n').length;
    }
    
    return { fullDoc: doc, lineMapOffset: offset };
  }, [decoded, isFullHtml, bridgeScript]);

  const [iframeDoc, setIframeDoc] = useState(fullDoc);
  const [iframeKey, setIframeKey] = useState(0);

  // Đồng bộ hóa iframeDoc với fullDoc có debounce để tránh việc nạp lại iframe liên tục trong lúc nạp luồng AI (streaming)
  useEffect(() => {
    if (editedCode !== null || isEditingManually || !contentAttr) {
      setIframeDoc(fullDoc);
    } else {
      const handle = setTimeout(() => {
        setIframeDoc(fullDoc);
      }, 1000); // Debounce 1 giây cho streaming cốt truyện/mã nguồn mới cực kỳ mượt mà
      return () => clearTimeout(handle);
    }
  }, [fullDoc, editedCode, isEditingManually, contentAttr]);

  // Tăng counter key mỗi khi iframeDoc thay đổi thực sự để ép trình duyệt unmount và mount lại iframe, tải lại JS chuẩn xác
  useEffect(() => {
    setIframeKey(prev => prev + 1);
  }, [iframeDoc]);

  // Đồng bộ hóa/Khôi phục lại dữ liệu khi người dùng chuyển đổi cốt truyện hoặc swipe tin nhắn mới
  useEffect(() => {
    if (!contentAttr) {
      setEditedCode(null);
      setIsEditingManually(false);
      setLogs([]);
      setHighlightedLine(null);
      setHighlightedRawLine(null);
      return;
    }
    let hash = 0;
    for (let i = 0; i < contentAttr.length; i++) {
       const char = contentAttr.charCodeAt(i);
       hash = (hash << 5) - hash + char;
       hash = hash & hash;
    }
    const key = `sandbox_widget_code_${Math.abs(hash)}`;
    try {
      const cached = dbService.getKeyValueSync(key);
      const codeVal = typeof cached === "string" ? cached : (cached ? JSON.stringify(cached) : null);
      setEditedCode(codeVal);
    } catch (e) {
      setEditedCode(null);
    }
    setIsEditingManually(false);
    setLogs([]);
    setHighlightedLine(null);
    setHighlightedRawLine(null);
  }, [contentAttr]);

  const getRawLineNo = useCallback((compiledLine: number) => {
    if (!compiledLine || compiledLine <= 0) return null;
    
    const fullDocLines = fullDoc.split('\n');
    const erroredLineText = fullDocLines[compiledLine - 1]?.trim();
    
    const decodedLines = decoded.split('\n');
    
    if (erroredLineText && erroredLineText.length > 2) {
      const exactIndex = decodedLines.findIndex(line => line.trim() === erroredLineText);
      if (exactIndex !== -1) {
        return exactIndex + 1;
      }
    }
    
    if (!isFullHtml) {
      const preambleLineCount = fullDocLines.findIndex(line => line.includes('<div id="root"></div>')) + 1;
      const rawLine = compiledLine - preambleLineCount;
      if (rawLine > 0 && rawLine <= decodedLines.length) {
        return rawLine;
      }
    } else {
      const rawLine = compiledLine - lineMapOffset;
      if (rawLine > 0 && rawLine <= decodedLines.length) {
        return rawLine;
      }
    }
    
    return null;
  }, [fullDoc, decoded, isFullHtml, lineMapOffset]);

  const scrollToErrorLine = () => {
    const targetLine = sourceTab === 'compiled' ? highlightedLine : highlightedRawLine;
    if (targetLine) {
      setTimeout(() => {
        const el = document.getElementById(`${sourceTab}-line-${targetLine}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  };

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Security fix: validate event origin (only current origin or sandboxed "null" origin allowed)
      if (e.origin !== window.location.origin && e.origin !== "null") {
        return;
      }
      // Validate the message is for this specific widget instance
      if (e.data && e.data.id === widgetId) {
        if (e.data.type === 'TAWA_WIDGET_ACTION') {
           const event = new CustomEvent('tawa_widget_action', { detail: { action: e.data.action, payload: e.data.payload } });
           window.dispatchEvent(event);
        }
        if (e.data.type === 'TAWA_WIDGET_LOG') {
           setLogs(prev => {
               const newLogs = [...prev, { 
                 type: e.data.level, 
                 message: e.data.message, 
                 time: new Date().toLocaleTimeString(),
                 lineno: e.data.lineno 
               }];
               if (newLogs.length > 50) return newLogs.slice(newLogs.length - 50);
               return newLogs;
           });
           
           if (e.data.level === 'error' && e.data.lineno) {
             setHighlightedLine(e.data.lineno);
             const rawLine = getRawLineNo(e.data.lineno);
             setHighlightedRawLine(rawLine);
           }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [widgetId, getRawLineNo]);

  const askAiAssistant = async (customPrompt?: string | null, freshStarted = false) => {
    setIsAiLoading(true);
    setAiError(null);
    const userMsgText = customPrompt !== undefined ? customPrompt : aiInput;
    if (userMsgText === '' && customPrompt === undefined) {
      setIsAiLoading(false);
      return;
    }

    if (customPrompt === undefined) {
      setAiInput('');
    }

    const nextChatHistory = [...aiChat];
    if (userMsgText) {
      nextChatHistory.push({ role: 'user', text: userMsgText });
      setAiChat(nextChatHistory);
    }

    try {
      const response = await fetch('/api/ai/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rawCode: decoded,
          compiledCode: fullDoc,
          logs: logs,
          prompt: userMsgText || "Hãy phân tích tình trạng hiện tại của widget và đưa ra lời chào, đề xuất sửa lỗi nếu có.",
          chatHistory: freshStarted ? [] : aiChat
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Không thể gửi yêu cầu gỡ lỗi.');
      }

      setAiChat(prev => [...prev, { role: 'model', text: data.text }]);
    } catch (err: any) {
      setAiError(err.message || 'Lỗi không xác định khi kết nối với máy chủ AI.');
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (sourceTab === 'ai' && aiChat.length === 0 && !isAiLoading) {
      askAiAssistant("Chào bạn, tôi vừa mở Trợ lý AI Gỡ lỗi. Hãy phân tích toàn diện mã nguồn này và các log/lỗi hiện hữu, đưa ra phân tích gỡ lỗi chi tiết kèm giải thích và mã nguồn đã sửa nếu có lỗi nhé.", true);
    }
  }, [sourceTab, aiChat.length, isAiLoading]);

  if (!decoded && editedCode === null) {
    return (
      <div className="my-6 relative border border-red-350 dark:border-red-900 rounded-xl overflow-hidden bg-white dark:bg-stone-900 p-4 text-center text-red-500 text-xs font-semibold">
        Lỗi giải mã Iframe Sandbox Widget
      </div>
    );
  }

  return (
    <div className="my-6 relative border-2 border-stone-300 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-stone-900 shadow-md">
      <div className="absolute top-0 left-0 right-0 h-6 bg-stone-200 dark:bg-slate-700 flex items-center px-3 gap-2 border-b border-stone-300 dark:border-slate-600 z-10 select-none">
        <div className="w-2 h-2 rounded-full bg-red-400"></div>
        <div className="w-2 h-2 rounded-full bg-amber-400"></div>
        <div className="w-2 h-2 rounded-full bg-green-400"></div>
        <span className="text-[9px] font-mono font-bold text-stone-500 dark:text-stone-400 ml-1 tracking-wider uppercase">SANDBOX</span>
        
        {/* Toggle option for original vs compiled (const/let -> var transform) */}
        <div className="flex items-center gap-1.5 ml-4">
          <label className="inline-flex items-center cursor-pointer text-[10px] font-mono font-medium text-stone-600 dark:text-stone-300 select-none">
            <input 
              type="checkbox" 
              checked={!disableJsTransform} 
              onChange={() => setDisableJsTransform(!disableJsTransform)}
              className="sr-only peer"
            />
            <div className="relative w-7 h-4 bg-stone-300/80 peer-focus:outline-none rounded-full peer dark:bg-stone-600/80 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-stone-600 peer-checked:bg-indigo-500"></div>
            <span className="ms-1 px-1 py-0.5 rounded bg-stone-200 dark:bg-slate-800 text-[8px] font-bold tracking-tight text-stone-600 dark:text-stone-400">
              {disableJsTransform ? "MÃ GỐC (DIRECT)" : "BIÊN DỊCH BẢO VỆ (VAR)"}
            </span>
          </label>
        </div>

        {editedCode !== null && (
          <span 
            className="flex items-center text-amber-600 dark:text-amber-400 ml-1.5"
            title="Mã nguồn sandbox đã bị chỉnh sửa/gỡ lỗi và tự động lưu"
          >
            <Wrench size={10} className="animate-pulse" />
          </span>
        )}
        {editedCode !== null && (
          <button 
            type="button"
            onClick={() => {
              setEditedCode(null);
              setIsEditingManually(false);
              setLogs([]);
              setHighlightedLine(null);
            }}
            className="p-1 text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
            title="Khôi phục mã nguồn gốc ban đầu"
          >
            <RotateCcw size={10} />
          </button>
        )}
        <button 
          onClick={() => setShowLogs(!showLogs)}
          className={`ml-auto p-1 rounded transition-all cursor-pointer ${showLogs ? 'bg-indigo-500 text-white' : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-300/55 dark:hover:bg-slate-600/55'}`}
          title={showLogs ? 'Đóng nhận ký lỗi (Console Log)' : 'Xem nhật ký lỗi (Console Log)'}
        >
          <Terminal size={10} />
        </button>
        <button 
          onClick={() => setShowSource(!showSource)}
          className={`p-1 rounded transition-all cursor-pointer ${showSource ? 'bg-indigo-500 text-white' : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-300/55 dark:hover:bg-slate-600/55'}`}
          title={showSource ? 'Đóng bảng mã nguồn' : 'Xem/Sửa mã nguồn'}
        >
          <Code size={10} />
        </button>
      </div>
      
      {showSource ? (
        <div className="mt-6 mb-0 border-t border-stone-300 dark:border-slate-600 bg-stone-950 flex flex-col">
          <div className="bg-stone-900 px-3 py-1.5 flex flex-wrap items-center gap-2 border-b border-stone-800 text-xs shadow-sm">
            <span className="text-stone-400 font-medium">Chế độ xem:</span>
            <button 
              onClick={() => {
                setSourceTab('raw');
                setHighlightedLine(null);
              }} 
              className={`px-2 py-0.5 rounded font-mono text-[10px] transition-colors ${sourceTab === 'raw' ? 'bg-indigo-600 text-white font-bold' : 'text-stone-400 hover:text-white bg-stone-800'}`}
            >
              MÃ GỐC (RAW WIDGET)
            </button>
            <button 
              onClick={() => {
                setSourceTab('compiled');
              }} 
              className={`px-2 py-0.5 rounded font-mono text-[10px] transition-colors ${sourceTab === 'compiled' ? 'bg-indigo-600 text-white font-bold' : 'text-stone-400 hover:text-white bg-stone-800'}`}
            >
              HTML ĐẦY ĐỦ (COMPILED IFRAME)
            </button>
            <button 
              onClick={() => {
                setSourceTab('ai');
              }} 
              className={`px-2 py-0.5 rounded font-mono text-[10px] transition-all flex items-center gap-1.5 ${sourceTab === 'ai' ? 'bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-500/20' : 'text-stone-400 hover:text-white bg-stone-800'}`}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isAiLoading ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></span>
              TRỢ LÝ AI (AI DEBUGGER)
            </button>
            {sourceTab === 'raw' && (
              <button 
                type="button"
                onClick={() => setIsEditingManually(!isEditingManually)}
                className={`md:ml-auto px-2 py-0.5 rounded font-mono text-[10px] transition-all flex items-center gap-1 cursor-pointer ${isEditingManually ? 'bg-amber-600 text-white font-bold' : 'text-stone-400 hover:text-white bg-stone-800'}`}
              >
                ✏️ {isEditingManually ? 'HOÀN TẤT CHỈNH SỬA' : 'TỰ SỬA MÃ (MANUAL EDIT)'}
              </button>
            )}
            {((sourceTab === 'compiled' ? highlightedLine : highlightedRawLine)) && (
              <div className="md:ml-auto flex items-center gap-2">
                <span className="text-red-400 font-mono text-[10px] flex items-center gap-1 animate-pulse">
                  <span>●</span> Lỗi tại dòng {sourceTab === 'compiled' ? highlightedLine : highlightedRawLine}
                </span>
                <button 
                  onClick={scrollToErrorLine}
                  className="bg-red-800 hover:bg-red-750 text-white font-mono text-[9px] px-1.5 py-0.5 rounded transition-all uppercase tracking-wider cursor-pointer font-bold"
                >
                  Cuộn đến dòng lỗi 🎯
                </button>
              </div>
            )}
          </div>
          
          <div className="p-4 overflow-auto max-h-[500px] font-mono text-xs text-stone-300 leading-relaxed scrollbar-thin">
            {sourceTab === 'ai' ? (
              <div className="flex flex-col h-full min-h-[400px] text-stone-200" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <div className="flex items-center gap-2 mb-3 bg-stone-900/80 p-3 rounded-lg border border-stone-800">
                  <div className="p-1 px-2 rounded bg-emerald-500/10 text-emerald-400 font-bold font-mono text-[10px] tracking-wider uppercase">
                    AI CHATBOT
                  </div>
                  <div className="text-stone-300 text-xs font-semibold">
                    Trợ lý gỡ lỗi chuyên sâu Sandbox
                  </div>
                  <button 
                    onClick={() => {
                      setAiChat([]);
                      askAiAssistant("Chào bạn, tôi vừa làm sạch bộ nhớ. Hãy phân tích lại toàn diện mã nguồn này và các log/lỗi hiện hữu nhé.", true);
                    }}
                    className="ml-auto text-[10px] text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-750 p-1 px-2 rounded transition-colors font-mono flex items-center gap-1"
                  >
                    🔄 Khởi động lại AI
                  </button>
                </div>

                {/* Logs Summary Banner inside AI panel */}
                {logs.length > 0 && (
                  <div className="mb-3 bg-red-950/40 p-2.5 px-3 rounded-lg border border-red-900/30 text-xs flex items-center gap-2">
                    <span className="flex-shrink-0 inline-block w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                    <span className="text-red-300 font-medium">Tìm thấy {logs.filter(l => l.type === 'error').length} lỗi runtime trong Console logs.</span>
                    <button 
                      onClick={() => askAiAssistant("Tôi vừa gặp lỗi ở runtime. Hãy phân tích các Console logs bị lỗi này và giải thích chi tiết nguyên nhân kèm cách sửa cụ thể nhé.")}
                      className="ml-auto bg-red-800 hover:bg-red-700 text-white font-bold text-[10px] px-2 py-1 rounded transition-colors"
                      disabled={isAiLoading}
                    >
                      💡 Phân tích lỗi ngay
                    </button>
                  </div>
                )}

                {/* Conversation History */}
                <div className="flex-1 overflow-y-auto mb-4 flex flex-col gap-3 min-h-[250px] max-h-[380px] p-3 bg-stone-950/80 rounded-lg border border-stone-850 scrollbar-thin">
                  {aiChat.map((msg, index) => (
                    <div 
                      key={index} 
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div className="text-[10px] text-stone-500 mb-1 font-mono uppercase tracking-widest px-1">
                        {msg.role === 'user' ? 'MÃ NGUỒN' : 'Trợ lý AI'}
                      </div>
                      <div 
                        className={`rounded-lg p-3 text-xs leading-relaxed max-w-[90%] whitespace-pre-wrap ${
                          msg.role === 'user' 
                            ? 'bg-stone-800 text-stone-100 border border-stone-700/50' 
                            : 'bg-stone-900/60 text-stone-200 border border-stone-850 font-sans'
                        }`}
                      >
                        {msg.role === 'model' ? (
                          <div className="flex flex-col">
                            <div className="prose prose-sm prose-invert max-w-none text-stone-200 break-words font-sans space-y-1">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]} 
                                rehypePlugins={[rehypeRaw]}
                                components={markdownComponents}
                              >
                                {msg.text}
                              </ReactMarkdown>
                            </div>
                            {(() => {
                              const blocks = extractHtmlCodeBlocks(msg.text);
                              if (blocks.length === 0) return null;
                              return (
                                <div className="mt-3 pt-3 border-t border-stone-800/80 flex flex-col gap-2">
                                  <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider font-mono flex items-center gap-1">
                                    <span>🎯</span> Phát hiện mã đã sửa từ AI ({blocks.length} khối):
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    {blocks.map((block, idx) => (
                                      <div key={idx} className="flex flex-wrap gap-1.5 pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditedCode(block);
                                            setShowSource(false);
                                          }}
                                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded transition-all flex items-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                          🚀 Áp dụng & Chạy Sandbox {blocks.length > 1 ? `#${idx + 1}` : ''}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditedCode(block);
                                            setSourceTab('raw');
                                          }}
                                          className="bg-stone-800 hover:bg-stone-750 text-stone-300 border border-stone-700 text-[10px] uppercase tracking-wider px-2 py-1.5 rounded transition-all flex items-center gap-1"
                                        >
                                          🔍 Áp dụng & Xem mã
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          msg.text
                        )}
                      </div>
                    </div>
                  ))}

                  {isAiLoading && (
                    <div className="flex flex-col items-start">
                      <div className="text-[10px] text-stone-500 mb-1 font-mono uppercase tracking-widest px-1">
                        Trợ lý AI
                      </div>
                      <div className="bg-stone-900/60 text-stone-400 border border-stone-850 rounded-lg p-3 text-xs flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        <span className="font-mono text-[11px]">Trợ lý đang xem mã nguồn và gỡ lỗi...</span>
                      </div>
                    </div>
                  )}

                  {aiError && (
                    <div className="bg-red-950/50 text-red-300 border border-red-900/40 rounded-lg p-3 text-xs">
                      ⚠️ {aiError}
                    </div>
                  )}
                </div>

                {/* Quick actions suggest panel */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <button 
                    onClick={() => askAiAssistant("Giải thích ngắn gọn cấu trúc và luồng chạy của file widget này.")}
                    className="text-[10px] bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 px-2.5 py-1 rounded transition-colors"
                    disabled={isAiLoading}
                  >
                    📋 Giải thích code
                  </button>
                  <button 
                    onClick={() => askAiAssistant("Kiểm tra xem mã nguồn này có bất kỳ lỗi cú pháp, vấn đề đồng bộ, hoặc cấu trúc nào có thể tối ưu không.")}
                    className="text-[10px] bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 px-2.5 py-1 rounded transition-colors"
                    disabled={isAiLoading}
                  >
                    🛡️ Tối ưu hóa & Check lỗi
                  </button>
                  <button 
                    onClick={() => askAiAssistant("Tìm và giải thích tất cả các đoạn xử lý nút bấm (onclick/event handlers) trong widget này.")}
                    className="text-[10px] bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 px-2.5 py-1 rounded transition-colors"
                    disabled={isAiLoading}
                  >
                    🖱️ Xem bộ xử lý sự kiện (Events)
                  </button>
                </div>

                {/* Input block */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    askAiAssistant();
                  }}
                  className="flex gap-2"
                >
                  <input 
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Nhập câu hỏi hoặc mô tả lỗi bạn đang gặp phải..."
                    className="flex-1 bg-stone-900 border border-stone-800 rounded px-3 py-1.5 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                    disabled={isAiLoading}
                  />
                  <button 
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 text-white font-bold text-xs px-4 py-1.5 rounded transition-all flex items-center gap-1.5"
                    disabled={isAiLoading || !aiInput.trim()}
                  >
                    <span>Gửi</span>
                    <span>✈️</span>
                  </button>
                </form>
              </div>
            ) : sourceTab === 'raw' && isEditingManually ? (
              <div className="w-full flex flex-col gap-2.5">
                <textarea
                  value={decoded}
                  onChange={(e) => setEditedCode(e.target.value)}
                  className="w-full min-h-[350px] bg-stone-900 text-stone-100 font-mono text-xs p-3 rounded border border-stone-850 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/35 leading-relaxed scrollbar-thin resize-y"
                  placeholder="Nhập mã nguồn HTML/JS của bạn ở đây để cập nhật Sandbox trực tiếp..."
                />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] text-stone-400 font-mono gap-2 bg-stone-900/50 p-2.5 rounded border border-stone-850">
                  <span>💡 Mã nguồn tự động áp dụng vào Sandbox ngay khi nhập. Bạn có thể đóng mã nguồn để xem kết quả.</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingManually(false)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-sans uppercase tracking-wide px-3 py-1 rounded transition-colors self-end sm:self-auto cursor-pointer"
                  >
                    Hoàn tất & Chạy thử 🚀
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-w-full table border-collapse">
                {(sourceTab === 'compiled' ? fullDoc : decoded).split('\n').map((lineText, idx) => {
                  const lineNum = idx + 1;
                  const isError = sourceTab === 'compiled' 
                    ? highlightedLine === lineNum
                    : highlightedRawLine === lineNum;
                  return (
                    <div 
                      key={lineNum} 
                      id={`${sourceTab}-line-${lineNum}`}
                      className={`table-row group hover:bg-stone-900/50 ${isError ? 'bg-red-950/70 text-red-200 font-semibold' : ''}`}
                      style={isError ? { borderLeft: '4px solid #ef4444' } : undefined}
                    >
                      <span className={`table-cell select-none text-right pr-4 text-[10px] opacity-40 group-hover:opacity-75 w-12 border-r border-stone-850 ${isError ? 'text-red-400 font-bold opacity-100' : 'text-stone-500'}`}>
                        {lineNum}
                      </span>
                      <span className="table-cell pl-4 whitespace-pre break-all">
                        {lineText || ' '}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div 
          className="w-full mt-6 mb-2"
          style={{
            resize: 'vertical',
            overflow: 'auto',
            minHeight: '200px',
            height: '400px',
            border: '1px solid rgba(120,120,120,0.2)',
            borderRadius: '6px'
          }}
        >
          <iframe
            key={iframeKey}
            ref={iframeRef}
            title="Iframe Sandbox"
            srcDoc={iframeDoc}
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
            className="w-full h-full bg-transparent block"
            style={{
              border: 'none'
            }}
          />
        </div>
      )}

      {showLogs && (
        <div className="border-t-2 border-stone-300 dark:border-slate-600 bg-[#1e1e1e] max-h-[250px] overflow-y-auto">
          <div className="sticky top-0 bg-[#252526] px-2 py-1 flex items-center justify-between border-b border-stone-800">
             <span className="text-xs text-stone-300 font-mono">Console Logs ({logs.length})</span>
             <button onClick={() => setLogs([])} className="text-[10px] text-stone-400 hover:text-white uppercase px-1">Clear</button>
          </div>
          <div className="p-2 flex flex-col gap-1 font-mono text-[11px] leading-relaxed">
            {logs.length === 0 ? (
               <div className="text-stone-500 italic px-1">No logs to display...</div>
            ) : (
               logs.map((log, i) => {
                 const rawNo = log.lineno ? getRawLineNo(log.lineno) : null;
                 return (
                   <div 
                     key={i} 
                     onClick={() => {
                       if (log.lineno) {
                         setHighlightedLine(log.lineno);
                         setHighlightedRawLine(rawNo);
                         setShowSource(true);
                         setTimeout(() => {
                           const targetLine = sourceTab === 'compiled' ? log.lineno : rawNo;
                           if (targetLine) {
                             const el = document.getElementById(`${sourceTab}-line-${targetLine}`);
                             if (el) {
                               el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                             }
                           }
                         }, 100);
                       }
                     }}
                     className={`px-2 py-1 rounded border-l-2 ${log.lineno ? 'cursor-pointer hover:bg-red-950/20' : ''} ${log.type === 'error' ? 'bg-red-900/20 text-red-400 border-red-500' : log.type === 'warn' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-500' : 'text-stone-300 border-transparent hover:bg-white/5'}`}
                     title={log.lineno ? `Dòng ${rawNo || '?'} ở Mã Gốc / Dòng ${log.lineno} ở Iframe` : undefined}
                   >
                     <span className="opacity-50 mr-2 text-[9px]">{log.time}</span>
                     {log.message}
                     {log.lineno ? (
                       <span className="underline ml-2 text-[9px] text-red-300 font-sans hover:text-red-100 font-semibold font-mono">
                         (Dòng {rawNo || '?'} ở Mã Gốc / dòng {log.lineno} ở Iframe)
                       </span>
                     ) : null}
                   </div>
                 );
               })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = "", 
  regexScripts,
  userName = "User",
  charName = "Character",
  messageRole,
  depth
}) => {
  const generatedId = React.useId();
  const wrapperId = useMemo(() => "md-content-" + generatedId.replace(/:/g, ''), [generatedId]);

  const [jsMode, setJsMode] = useState<'disabled' | 'auto' | 'script' | 'code_block'>('auto');
  const [colors, setColors] = useState<{
    dialogue?: string;
    thinking?: string;
    highlight?: string;
    onomatopoeia?: string;
  }>({});

  const markdownComponentsWithScope = useMemo(() => {
    const base = {
      ...markdownComponentsRaw,
      style: (props: any) => markdownComponentsRaw.style({...props, 'data-scoper': wrapperId}),
      'regex-widget': (props: any) => <IframeSandboxWidget contentAttr={props['data-content']} />
    };

    return new Proxy(base, {
      has(target, prop) {
        if (typeof prop === 'string') {
          if (prop in target) return true;
          // Accept any unknown lowercase tag names
          if (/^[a-z][a-z0-9_-]*$/.test(prop)) return true;
        }
        return prop in target;
      },
      get(target, prop) {
        if (typeof prop === 'string') {
          if (prop in target) {
            return target[prop as keyof typeof target];
          }
          // Catch all unknown lowercase tag names that ReactMarkdown/rehypeRaw attempts to render (e.g. fangshenghua)
          if (/^[a-z][a-z0-9_-]*$/.test(prop)) {
            return getCustomTagRenderer(prop);
          }
        }
        return undefined;
      },
      getOwnPropertyDescriptor(target, prop) {
        if (typeof prop === 'string') {
          if (prop in target) {
            return Object.getOwnPropertyDescriptor(target, prop);
          }
          if (/^[a-z][a-z0-9_-]*$/.test(prop)) {
            return {
              configurable: true,
              enumerable: true,
              value: getCustomTagRenderer(prop),
              writable: false
            };
          }
        }
        return Object.getOwnPropertyDescriptor(target, prop);
      },
      ownKeys(target) {
        const targetKeys = Reflect.ownKeys(target);
        const scannedKeys = Object.keys(getCustomTagDefinitions());
        const extraKeys = ['qr', 'qr-btn'];
        const allKeys = new Set([...targetKeys, ...scannedKeys, ...extraKeys]);
        return Array.from(allKeys);
      }
    }) as any;
  }, [wrapperId]);

  useEffect(() => {
    dbService.getSettings().then(s => {
      if (s) {
        if (s.javaScriptMode) {
          setJsMode(s.javaScriptMode);
        }
        setColors({
          dialogue: s.storyDialogueColor,
          thinking: s.storyThinkingColor,
          highlight: s.storyHighlightColor,
          onomatopoeia: s.storyOnomatopoeiaColor
        });
      }
    });
  }, []);

  const processedContent = useMemo(() => {
    let text = content || '';
    
    // Resolve placeholders directly before processing
    if (userName) text = text.replace(/\{\{user\}\}/gi, userName);
    if (charName) text = text.replace(/\{\{char\}\}/gi, charName);

    // ==========================================
    // DỌN SẠCH DÒNG TRỐNG TRONG HTML & STYLE CUSTOM
    // Giúp remark-gfm/rehype-raw không bị đánh lừa ngắt khối HTML thành văn bản thô
    // ==========================================
    if (text.toLowerCase().includes('<style')) {
      // 1. Dọn dẹp dòng trống trong thẻ style
      text = text.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
        const cleanCss = css.split('\n').filter((line: string) => line.trim() !== '').join('\n');
        return `<style>${cleanCss}</style>`;
      });

      // 2. Dọn dẹp dòng trống rỗng nằm giữa các thẻ HTML kế cận
      text = text.replace(/>\s*\n\s*\n\s*</g, '>\n<');
    }

    // ==========================================
    // PROTECT BLOCKS BEFORE COLOR FORMATTING
    // ==========================================
    const protectedCodeBlocks: string[] = [];
    text = text.replace(/```[\s\S]*?```/g, (match) => {
        protectedCodeBlocks.push(match);
        return `__SYS_CODEBLOCK_${protectedCodeBlocks.length - 1}__`;
    });
        
    const protectedFullDocs: string[] = [];
    text = text.replace(/<!DOCTYPE\s+html>[\s\S]*?(?:<\/html>|$)|<\s*html\b[\s\S]*?(?:<\/html>|$)/gi, (match) => {
        protectedFullDocs.push(match);
        return `__SYS_FULLDOC_${protectedFullDocs.length - 1}__`;
    });

    const protectedSandboxes: string[] = [];
    text = text.replace(/<sandbox>([\s\S]*?)(?:<\/sandbox>|$)/gi, (match) => {
        protectedSandboxes.push(match);
        return `__SYS_SANDBOX_${protectedSandboxes.length - 1}__`;
    });
        
    const protectedScriptStyles: string[] = [];
    text = text.replace(/<(script|style)\b[\s\S]*?(?:<\/\1>|$)/gi, (match) => {
        protectedScriptStyles.push(match);
        return `__SYS_SCRIPTSTYLE_${protectedScriptStyles.length - 1}__`;
    });

    // Apply color formatting
    if (colors.dialogue) {
      text = text.replace(/(「[^」]*」)/g, `<font color="${colors.dialogue}">$1</font>`);
    }
    if (colors.thinking) {
      text = text.replace(/(﹁[^﹂]*﹂)/g, `<font color="${colors.thinking}"><i>$1</i></font>`);
    }
    if (colors.highlight) {
      text = text.replace(/(『[^』]*』)/g, `<font color="${colors.highlight}">$1</font>`);
    }
    if (colors.onomatopoeia) {
      // Find {text} but ensure to not match {{ or }}
      text = text.replace(/(?<!\{)\{([^{}]+)\}(?!\})/g, `<font color="${colors.onomatopoeia}">{$1}</font>`);
    }

    // Remove HTML blocks stripping here if jsMode is code_block or auto, because we want 
    // jsMode's regex-widget to encapsulate them to keep iframe sandbox and scripts working.
    if (jsMode === 'disabled') {
       // disabled logic - we will resolve __SYS_CODEBLOCK_ back in here to properly strip them if needed,
       // but for simplicity we will just let it be, they will be rendered as normal codeblocks in disabled mode.
    }

    // Fix invalid custom HTML tags (ones with underscores instead of hyphens)
    // CommonMark spec enforces alphanumeric characters and hyphens for HTML tags.
    text = text.replace(/<user_status\b/gi, '<user-status');
    text = text.replace(/<\/user_status>/gi, '</user-status>');
    text = text.replace(/<zd_status\b/gi, '<zd-status');
    text = text.replace(/<\/zd_status>/gi, '</zd-status>');

    // Force blank lines around major custom structural tags to ensure they parse as block HTML in remark
    text = text.replace(/(<\/?(?:user-status|zd-status|calendar|digest|equip|swordskill|content|tableEdit|table_stored|time)>)/gi, '\n\n$1\n\n');
    // Remove <br> tags specifically inside blocks that use whitespace-pre-wrap 
    // to prevent double spacing when LLMs output both \n and <br>
    const stripBrTags = (match: string, innerText: string, tagName: string) => {
      const cleanText = innerText.replace(/<br\s*\/?>/gi, '\n').replace(/\n{3,}/g, '\n\n').trim();
      return `<${tagName}>\n${cleanText}\n</${tagName}>`;
    };
    
    text = text.replace(/<equip>([\s\S]*?)<\/equip>/gi, (m, c) => stripBrTags(m, c, 'equip'));
    text = text.replace(/<swordskill>([\s\S]*?)<\/swordskill>/gi, (m, c) => stripBrTags(m, c, 'swordskill'));
    text = text.replace(/<user-status>([\s\S]*?)<\/user-status>/gi, (m, c) => stripBrTags(m, c, 'user-status'));
    text = text.replace(/<time>([\s\S]*?)<\/time>/gi, (m, c) => stripBrTags(m, c, 'time'));
    
    // Clean up excessive newlines
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Apply Regex Scripts BEFORE JS mode encoding so the output of Regex is also widget-ified
    if (regexScripts && regexScripts.length > 0 && text) {
        // Determine which placements to apply based on role
        const placementTarget = messageRole === 'user' ? 1 : 2;

        // Protect custom structural tags from user regex scripts so our React UI doesn't get overridden
        let protectedText = text;
        const protectedTags = ['equip', 'swordskill', 'user-status', 'zd-status', 'calendar', 'digest', 'time'];
        protectedTags.forEach(tag => {
          // Replace <tag> and </tag> with <sys-tag> and </sys-tag>
          protectedText = protectedText.replace(new RegExp(`<(/?)${tag}>`, 'gi'), `<$1sys-${tag}>`);
        });
        
        text = getRegexedString(protectedText, placementTarget, regexScripts, {
            userName, 
            charName, 
            isMarkdown: true,
            isPrompt: false,
            renderPhaseOnly: true,
            depth: depth ?? -1,
            isDebug: false
        });

        // Restore protected tags
        protectedTags.forEach(tag => {
          text = text.replace(new RegExp(`<(/?)\\s*sys-${tag}>`, 'gi'), `<$1${tag}>`);
        });
    }

    // ==========================================
    // RESTORE PROTECTED BLOCKS BEFORE JSMODE WIDGETING
    // ==========================================
    protectedSandboxes.forEach((block, index) => {
        text = text.replace(`__SYS_SANDBOX_${index}__`, () => block);
    });
    protectedScriptStyles.forEach((block, index) => {
        text = text.replace(`__SYS_SCRIPTSTYLE_${index}__`, () => block);
    });
    protectedFullDocs.forEach((block, index) => {
        text = text.replace(`__SYS_FULLDOC_${index}__`, () => block);
    });
    protectedCodeBlocks.forEach((block, index) => {
        text = text.replace(`__SYS_CODEBLOCK_${index}__`, () => block);
    });

    // Check execution modes based on jsMode
    if (jsMode === 'disabled') {
      // Bỏ qua, không thi hành script nào từ text AI, cũng filter script tag
      text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    } else {
      // 1. Process code blocks first so they encapsulate inner HTML
      if (jsMode === 'code_block' || jsMode === 'auto') {
        const htmlBlockRegex = /```(?:html|javascript|js|jsx|react|ts|typescript)?\n([\s\S]*?)(?:```|$)/gi;
        const preBlockRegex = /<pre>([\s\S]*?)(?:<\/pre>|$)/gi;
        
        // Thay thế các block code thành regex-widget
        text = text.replace(htmlBlockRegex, (match, code) => {
          const lowerMatch = match.toLowerCase();
          const isJs = lowerMatch.startsWith('```javascript') || lowerMatch.startsWith('```js') || lowerMatch.startsWith('```jsx') || lowerMatch.startsWith('```react') || lowerMatch.startsWith('```ts') || lowerMatch.startsWith('```typescript');
          const finalCode = isJs ? `<script type="text/babel" data-presets="react,typescript">\n${code}\n</script>` : code;
          try {
            const base64 = safeUtf8ToBase64(finalCode);
            return `<regex-widget data-content="${base64}"></regex-widget>`;
          } catch(e) {
            return match;
          }
        });

        text = text.replace(preBlockRegex, (match, code) => {
          try {
            const base64 = safeUtf8ToBase64(code);
            return `<regex-widget data-content="${base64}"></regex-widget>`;
          } catch(e) {
            return match;
          }
        });
      }

      // 2. Encode inline scripts and full HTML docs to regex-widget
      if (jsMode === 'script' || jsMode === 'auto') {
        const documentHtmlRegex = /<document_content>([\s\S]*?)(?:<\/document_content>|$)/gi;
        const fullDocRegex = /<!DOCTYPE\s+html>[\s\S]*?(?:<\/html>|$)|<\s*html\b[\s\S]*?(?:<\/html>|$)/gi;
        const nativeScriptRegex = /<script\b[\s\S]*?(?:<\/script>|$)/gi;
        
        // Wrap document content that contains HTML (preventing raw styles/scripts from breaking DOM)
        text = text.replace(documentHtmlRegex, (match, htmlContent) => {
           if (/(<!DOCTYPE\s+html|<html|<body|<script|<style)/i.test(htmlContent)) {
               try {
                 const base64 = safeUtf8ToBase64(htmlContent);
                 return `<document_content>\n<regex-widget data-content="${base64}"></regex-widget>\n</document_content>`;
               } catch(e) {
                 return match;
               }
           }
           return match;
        });

        // ------------------------- IFRAME SANDBOX CẦU NỐI API -------------------------
        // Hỗ trợ explicitly bọc HTML/CSS/JS bằng thẻ <sandbox> để ngăn chặn việc tách rời script và HTML
        const sandboxRegex = /<sandbox>([\s\S]*?)(?:<\/sandbox>|$)/gi;
        text = text.replace(sandboxRegex, (match, content) => {
           console.log(`[MarkdownRenderer] Matched sandbox block of length ${content.length}`);
           try {
             const base64 = safeUtf8ToBase64(content);
             return `<regex-widget data-content="${base64}"></regex-widget>`;
           } catch(e) {
             console.error(`[MarkdownRenderer] Error converting sandbox block to base64:`, e);
             return match;
           }
        });

        // Wrap full HTML page output from scripts
        text = text.replace(fullDocRegex, (match) => {
          console.log(`[MarkdownRenderer] Matched full doc block of length ${match.length}`);
          try {
            const base64 = safeUtf8ToBase64(match);
            return `<regex-widget data-content="${base64}"></regex-widget>`;
          } catch(e) {
            console.error(`[MarkdownRenderer] Error converting fulldoc block to base64:`, e);
            return match;
          }
        });

        // Thay thế các thẻ script cục bộ thành regex-widget để thực thi an toàn mà không làm hỏng markdown
        text = text.replace(nativeScriptRegex, (match) => {
          try {
            const base64 = safeUtf8ToBase64(match);
            return `<regex-widget data-content="${base64}"></regex-widget>`;
          } catch(e) {
            return match;
          }
        });
      }
    }

    return text;
  }, [content, regexScripts, userName, charName, messageRole, jsMode, colors, depth]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Security fix: validate event origin (only current origin or sandboxed "null" origin allowed)
      if (e.origin !== window.location.origin && e.origin !== "null") {
        return;
      }
      if (e.data && e.data.type === 'TAWA_WIDGET_ACTION') {
         const event = new CustomEvent('tawa_widget_action', { detail: { action: e.data.action, payload: e.data.payload } });
         window.dispatchEvent(event);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div id={wrapperId} className={`markdown-body flex-1 font-mali text-stone-800 dark:text-stone-300 ${className || ''}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={markdownComponentsWithScope}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
