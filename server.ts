import express from "express";
import cors from "cors";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Strict CORS Configuration whitelist
  const allowedOrigins = [
    /\.run\.app$/, // matches any subdomain of run.app
    /^http:\/\/localhost:\d+$/, // localhost with any port
    /^http:\/\/127\.0\.0\.1:\d+$/, // localhost IP with any port
  ];

  app.use(cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, or same origin calls within server)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.some(regex => regex.test(origin));
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Chặn bởi CORS: Origin không được phép.'));
      }
    },
    credentials: true
  }));

  app.use(express.json({ limit: '10mb' }));

  // Resolved once during startup to avoid expensive calculations / dynamic tokens per request
  const proxySecret = process.env.ARK_PROXY_SECRET || (
    process.env.NODE_ENV === 'production'
      ? (() => {
          const randomSecret = crypto.randomBytes(32).toString('hex');
          console.warn(`[SECURITY WARNING] ARK_PROXY_SECRET is not set in production! Fallback random secure token generated.`);
          return randomSecret;
        })()
      : 'ark-v2-client'
  );

  // Lightweight in-memory rate limiter for backend proxy
  const ipLog: Record<string, { count: number; resetTime: number }> = {};
  const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  const MAX_REQUESTS_PER_WINDOW = 60;  // 60 requests/minute max

  // Periodic cleanup of ipLog entries to avoid memory leak
  const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
  setInterval(() => {
    const now = Date.now();
    Object.keys(ipLog).forEach((ip) => {
      if (now > ipLog[ip].resetTime) {
        delete ipLog[ip];
      }
    });
  }, CLEANUP_INTERVAL).unref();

  const proxyRateLimiter = (req: any, res: any, next: any) => {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp);
    const now = Date.now();
    
    if (!ipLog[ip] || now > ipLog[ip].resetTime) {
      ipLog[ip] = {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW
      };
      return next();
    }
    
    ipLog[ip].count++;
    if (ipLog[ip].count > MAX_REQUESTS_PER_WINDOW) {
      return res.status(429).json({ 
        error: "Quá tải yêu cầu proxy (Rate Limit Exceeded). Vui lòng thử lại sau một phút." 
      });
    }
    next();
  };

  // AI Proxy Endpoint to bypass CORS
  app.post("/api/ai/proxy", proxyRateLimiter, async (req, res) => {
    // Basic auth check to prevent random abuse, configurable via env
    const authHeader = req.headers['x-ark-client'] || req.query?.client;
    
    // Check origin / refereer for basic defense-in-depth on production
    const referer = (req.headers.referer || '').toLowerCase();
    const origin = (req.headers.origin || '').toLowerCase();
    const host = (req.headers.host || '').toLowerCase();
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0');
    const isAuthorizedOrigin = isLocal || 
       (referer && referer.includes('run.app')) || 
       (origin && origin.includes('run.app'));

    // Validate proxySecret token across all environments first
    if (authHeader !== proxySecret) {
      return res.status(403).json({ error: "Xác thực token bất hợp lệ hoặc bị thiếu." });
    }

    // Additional check for production origin defense-in-depth
    if (process.env.NODE_ENV === 'production' && !isAuthorizedOrigin) {
      return res.status(403).json({ error: "Thường dân không thể gọi trực tiếp API này (Origin không được phép)." });
    }

    const { url, method, headers, body } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Missing URL for proxy" });
    }

    // SSRF Prevention: strict URL / Host checking
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return res.status(400).json({ error: "Giao thức URL không hợp lệ. Chỉ chấp nhận HTTP/HTTPS." });
      }
      const hostname = parsedUrl.hostname.toLowerCase();
      const isPrivateOrLocal = hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname.startsWith('169.254.') || // Metadata service
        hostname.startsWith('10.') ||      // Private network A
        hostname.startsWith('192.168.') || // Private network C
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./); // Private network B

      if (isPrivateOrLocal) {
        return res.status(400).json({ error: "Không được phép truy cập địa chỉ mạng nội bộ hoặc hệ thống (SSRF Blocked)." });
      }
    } catch (urlErr) {
      return res.status(400).json({ error: "Định dạng URL không hợp lệ." });
    }

    try {
      // console.log(`[Backend Proxy] 🚀 Forwarding request to: ${url}`);
      
      const isStream = !!body?.stream || 
                       (url && typeof url === 'string' && (
                         url.includes(':streamGenerateContent') || 
                         url.includes('/stream') || 
                         url.includes('stream=true')
                       )) ||
                       (headers && (
                         headers['Accept']?.includes('event-stream') || 
                         headers['accept']?.includes('event-stream')
                       ));

      const response = await axios({
        url,
        method: method || 'POST',
        headers: {
          ...headers,
          // Remove host header to avoid issues with some proxies
          'host': undefined,
          'referer': undefined,
          'origin': undefined
        },
        data: body,
        responseType: isStream ? 'stream' : 'json',
        validateStatus: () => true // Don't throw on error status codes
      });

      // Forward headers from the target response
      Object.entries(response.headers).forEach(([key, value]) => {
        if (value) res.setHeader(key, value);
      });

      res.status(response.status);

      if (isStream) {
        response.data.pipe(res);
      } else {
        res.json(response.data);
      }
    } catch (error: any) {
      console.error("[Backend Proxy] ❌ Error:", error.message);
      res.status(500).json({ 
        error: "Proxy request failed", 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // AI Debug Assistant Endpoint
  app.post("/api/ai/debug", async (req, res) => {
    const { rawCode, compiledCode, logs, prompt, chatHistory } = req.body;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "Chưa cấu hình API Key cho Gemini (GEMINI_API_KEY). Người chơi cần cài đặt API Key trong cài đặt AI Studio hoặc file cấu hình để kích hoạt trợ lý AI." 
        });
      }

      // Lazy initialize the GoogleGenAI SDK safely
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `Bạn là một chuyên gia lập trình và trợ lý gỡ lỗi (AI Debugging Agent) hoạt động trong môi trường HTML/JS Sandbox (Iframe).
Nhiệm vụ của bạn là đọc mã nguồn của widget (bao gồm mã thô dạng RAW WIDGET và mã HTML hoàn chỉnh biên dịch trong COMPILED IFRAME) cùng với lịch sử lỗi/Console Log hiện có để phân tích lỗi và đưa ra lời khuyên hoặc sửa đổi code chính xác.

Quy tắc phản hồi:
1. Hãy giao tiếp bằng tiếng Việt thân thiện, rõ ràng, ngắn gọn và tập trung giải quyết lỗi kỹ thuật.
2. Nếu phát hiện lỗi cụ thể trong mã nguồn:
   - Hãy chỉ rõ dòng bị lỗi trong chế độ xem mã nguồn (nếu có thông tin dòng line number từ log).
   - Giải thích ngắn gọn nguyên nhân gây ra lỗi JavaScript, HTML, CSS hoặc thư viện (ví dụ: thiếu thư viện, lỗi cú pháp, binding sai sự kiện, xung đột biến toàn cục).
   - Đưa ra phần mã nguồn đã được sửa lỗi hoàn chỉnh (khoanh trong khối markdown \`\`\`html) để người dùng có thể dễ dàng sao chép và cập nhật lại widget của họ.
3. Khi phân tích Console Logs, bỏ qua các lỗi liên quan tới kết nối WebSocket hay Hot Module Replacement (HMR) mỏ neo, vì đó là lỗi môi trường dev sandbox không ảnh hưởng tới gameplay của widget.
4. Trả lời nhiệt tình các thắc mắc cụ thể khác của người dùng về mã nguồn này.`;

      // Build context and query
      const formattedHistory: any[] = [];
      if (chatHistory && Array.isArray(chatHistory)) {
        chatHistory.forEach((msg: any) => {
          formattedHistory.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
          });
        });
      }

      const currentPromptText = `
[MÃ NGUỒN WIDGET GỐC (RAW WIDGET)]
\`\`\`html
${rawCode || ''}
\`\`\`

[HTML HOÀN CHỈNH BÊN TRONG IFRAME (COMPILED IFRAME)]
\`\`\`html
${compiledCode || ''}
\`\`\`

[DANH SÁCH CONSOLE LOG / LỖI GHI NHẬN ĐƯỢC TỪ RUNTIME]
${JSON.stringify(logs || [], null, 2)}

---
Yêu cầu gỡ lỗi hoặc câu hỏi hiện tại từ người chơi:
${prompt || 'Hãy phân tích mã này và gỡ lỗi giúp tôi nếu có bất kỳ vấn đề gì.'}
`;

      formattedHistory.push({
        role: 'user',
        parts: [{ text: currentPromptText }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedHistory,
        config: {
          systemInstruction,
          temperature: 0.3, // lower temperature for more accurate & factual debug suggestions
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("[AI Debug API] Error:", error);
      res.status(500).json({ 
        error: "Có lỗi xảy ra khi kết nối với máy chủ AI gỡ lỗi.", 
        details: error.message 
      });
    }
  });

  // AI Debug Chính Văn (Narrative & Story Diagnostician) Endpoint
  app.post("/api/ai/debug-chinhvan", async (req, res) => {
    const { displayedMessages, selectedMessageIndex, targetMessage, worldContext, playerProfile, entities, prompt, chatHistory } = req.body;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "Chưa cấu hình API Key cho Gemini (GEMINI_API_KEY). Trợ lý gỡ lỗi chính văn yêu cầu API Key để hoạt động." 
        });
      }

      // Initialize Gemini SDK
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `Bạn là một chuyên gia Chẩn đoán và Gỡ lỗi Cốt truyện (AI Debugging Chính Văn) trong trò chơi mô phỏng nhập vai văn bản (Text RPG / Interactive Fiction).
Nhiệm vụ của bạn là phân tích nội dung truyện hiển thị trên màn hình ("Chính Văn" bao gồm lời thoại nhân vật, văn phong miêu tả, lựa chọn rẽ nhánh) cùng với cấu hình Thế giới (World Setting), Hồ sỹ người chơi, Trạng thái các Thực thể (NPC, Items, v.v.), và hệ thống luật lệ (Rules) đang áp dụng để tìm ra:
1. Tại sao lỗi cốt truyện, mâu thuẫn nhân vật hay sự cố hiển thị xảy ra trong phần Chính Văn đang hiển thị.
2. Hướng dẫn sửa chữa (hướng fix) hoặc điều chỉnh cấu hình trò chơi (v.v. sửa lại hồ sơ nhân vật, sửa lại luật, thay đổi hành vi người chơi, v.v.) dành cho người chơi để gỡ rối, chứ KHÔNG hỗ trợ viết code phần mềm thay thế.

Hãy phân tích kỹ các lỗi thường gặp trong Chính Văn:
- Mâu thuẫn Logics: Nhân vật thay đổi danh xưng, quên ký ức trước đó, đã chết nhưng sống dậy, hoặc hành xử sai so với Core Values hay Hard Limits trong Character Sheet.
- Rò rỉ thẻ cấu trúc: Lộ các tag XML/HTML chưa đóng như <thinking>, <choice>, <tavo>, các khối code hoặc Regex thế chưa chạy chuẩn, hoặc không định dạng chuẩn Markdown.
- Lỗi lựa chọn rẽ nhánh: Lựa chọn hành động phi thực tế, bị lặp lại, hoặc không rẽ nhánh phù hợp với bối cảnh truyện.
- Lỗi LSR / Tinh chỉnh văn cảnh: Trạng thái cơ sở dữ liệu Long-term State Representation (LSR) không ăn khớp với tình trạng trò chơi hiện tại.

Quy tắc phản hồi:
- Sử dụng tiếng Việt thân thiện, rõ ràng, gãy gọn nhưng đầy đủ phân tích thực tế sâu sắc. Định dạng Markdown có đề mục rõ ràng, thụt lề sạch sẽ và bôi đậm quan trọng.
- Trả lời thẳng vào nguyên nhân cốt lõi tại sao cốt truyện bị lỗi và đề xuất cách giải quyết cốt truyện (ví dụ: gợi ý điều chỉnh World Context, tinh chỉnh Luật Lệ, sửa đổi Hồ sơ Nhân vật trong game, hay viết lệnh hiệu đính lại câu thoại bằng nút Edit, sử dụng Regex để thay thế chuỗi chữ bị lỗi).
- Bạn KHÔNG hỗ trợ viết code phần mềm phần cứng dưới mọi hình thức, chỉ phân tích nội dung chính văn và hướng gỡ lỗi trong bối cảnh chơi game.`;

      // Build chat context
      const formattedHistory: any[] = [];
      if (chatHistory && Array.isArray(chatHistory)) {
        chatHistory.forEach((msg: any) => {
          formattedHistory.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
          });
        });
      }

      const debugPromptContext = `
[THÔNG TIN BỐI CẢNH THẾ GIỚI]
- Tên thế giới: ${worldContext?.worldName || 'Không có tên'}
- Thể loại: ${worldContext?.genre || 'Chưa định nghĩa'}
- Văn cảnh cơ bản (World Context): ${worldContext?.context || 'Chưa định nghĩa'}
- Mở đầu / Starting Scenario: ${worldContext?.startingScenario || 'Không'}
- Luật lệ (Config Rules): ${JSON.stringify(worldContext?.rules || [])}
- Góc nhìn trần thuật (POV): ${worldContext?.perspective || 'Không có'}
- Số mục Story Bible / Lorebook đang nạp: ${worldContext?.storyBibleCount || 0}

[HỒ SƠ NGƯỜI CHƠI (PLAYER SHEET)]
- Tên: ${playerProfile?.name || 'Không rõ'}
- Tuổi: ${playerProfile?.age || 'Không rõ'}
- Giới tính: ${playerProfile?.gender || 'Không rõ'}
- Ngoại hình: ${playerProfile?.appearance || 'Không rõ'}
- Giọng nói/Văn phong: ${playerProfile?.voiceAndTone || 'Không rõ'}
- Giá trị cốt lõi: ${playerProfile?.coreValues || 'Không rõ'}
- Hard Limits: ${playerProfile?.hardLimits || 'Không rõ'}

[DANH SÁCH THỰC THỂ / NPC ĐANG HOẠT ĐỘNG]
${JSON.stringify(entities || [], null, 2)}

[LỊCH SỬ CHÍNH VĂN GẦN ĐÂY (10 LƯỢT GẦN NHẤT)]
${JSON.stringify(displayedMessages || [], null, 2)}

${targetMessage ? `
[YÊU CẦU CHẨN ĐOÁN TRỌNG TÂM TRÊN UỶ THÁC LƯỢT ${targetMessage.turnNumber || 'HIỆN TẠI'}]
- Lượt: ${targetMessage.turnNumber || '"Chưa rõ"'}
- Vai trò: ${targetMessage.role}
- Nội dung câu thoại/Văn bản nghi có lỗi: "${targetMessage.text}"
- Hành động của người chơi dẫn đến lượt này: "${targetMessage.userAction || 'Không rõ'}"
` : ''}

---
Yêu cầu phân tích chi tiết lỗi chính văn từ người chơi hiện tại:
${prompt || 'Hãy chẩn đoán toàn diện câu truyện hiển thị xem có bất kỳ mâu thuẫn hay lỗi cú pháp nào không.'}
`;

      formattedHistory.push({
        role: 'user',
        parts: [{ text: debugPromptContext }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedHistory,
        config: {
          systemInstruction,
          temperature: 0.3,
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("[AI Debug Chinh Van API] Error:", error);
      res.status(500).json({
        error: "Lỗi luồng xử lý AI Trợ lý gỡ lỗi chính văn.",
        details: error.message
      });
    }
  });

  // AI Debug Regex Script Endpoint
  app.post("/api/ai/debug-regex", async (req, res) => {
    const { scriptName, findRegex, replaceString, testInput, testOutput, prompt, chatHistory } = req.body;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "Chưa cấu hình API Key cho Gemini (GEMINI_API_KEY). Trợ lý gỡ lỗi Regex yêu cầu API Key để hoạt động." 
        });
      }

      // Initialize Gemini SDK
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `Bạn là một chuyên gia về Biểu thức chính quy (JS RegExp) và gỡ lỗi kịch bản Regex (Regex Code & CSS/JS Widget Sandbox Debugger) trong môi trường nhập vai văn bản.
Nhiệm vụ của bạn là xem xét tóm tắt và lỗi liên quan đến:
1. Tên kịch bản Regex: \${scriptName || 'Chưa đặt tên'}
2. Chuỗi tìm kiếm (Regex Pattern): \\\`\${findRegex || ''}\\\`
3. Chuỗi thay thế (Replace String): \\\`\${replaceString || ''}\\\`
4. Dữ liệu thử mẫu (Test Input): \\\`\${testInput || ''}\\\`
5. Kết quả sau Regex (Test Output): \\\`\${testOutput || ''}\\\`

Hãy phân tích xem Regex Pattern có lỗi cú pháp không, có khớp đúng với nhóm mong muốn trong cấu trúc của Test Input không, chuỗi thay thế có bị vỡ thẻ HTML/CSS không, hoặc rò rỉ mã bảo mật không.

Quy tắc phản hồi:
- Hãy nhiệt tình, chi tiết, sử dụng tiếng Việt rõ ràng, rành mạch.
- Nếu Regex không chạy, bị lỗi runtime hoặc không bắt đúng dữ liệu, hãy cung cấp Biểu thức Regex mới chính xác (ví dụ dạng /pattern/flags) và chuỗi viết lại cụ thể.
- Đưa các câu trả lời, phân tích kỹ thuật gọn gàng trong các khối mã Markdown, chỉ rõ nguyên nhân gốc rễ.`;

      const formattedHistory: any[] = [];
      if (chatHistory && Array.isArray(chatHistory)) {
        chatHistory.forEach((msg: any) => {
          formattedHistory.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
          });
        });
      }

      const regexPromptContext = `
[KỊCH BẢN REGEX KHẢO SÁT]
- Tên: \${scriptName || 'Chưa đặt'}
- Biểu thức chính quy (Tìm kiếm): \\\`\${findRegex || '(trống)'}\\\`
- Chuỗi Thay thế (HTML/CSS/JS): 
\\\`\\\`\\\`html
\${replaceString || '(trống)'}
\\\`\\\`\\\`
- Chuỗi Đầu Vào Kiểm Thử (Test Input): 
\\\`\\\`\\\`text
\${testInput || ''}
\\\`\\\`\\\`
- Kết Quả Đầu Ra Thực Tế (Test Output): 
\\\`\\\`\\\`text
\${testOutput || ''}
\\\`\\\`\\\`

Yêu cầu phân tích gỡ lỗi Regex từ người chơi:
\${prompt || 'Hãy phân tích kịch bản Regex này, chỉ ra lỗi nếu có và đề xuất giải pháp tối ưu.'}
`;

      formattedHistory.push({
        role: 'user',
        parts: [{ text: regexPromptContext }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedHistory,
        config: {
          systemInstruction,
          temperature: 0.3,
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("[AI Debug Regex API] Error:", error);
      res.status(500).json({
        error: "Lỗi luồng xử lý AI Trợ lý gỡ lỗi Regex.",
        details: error.message
      });
    }
  });

  // AI Debug Card Regexes Endpoint
  app.post("/api/ai/debug-card-regexs", async (req, res) => {
    const { characterName, regexScripts } = req.body;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "Chưa cấu hình API Key cho Gemini (GEMINI_API_KEY). Người chơi cần cài đặt API Key để kích hoạt Trợ lý AI gỡ lỗi Regex." 
        });
      }

      // Initialize Gemini SDK
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `Bạn là Trợ lý AI Gỡ lỗi Regex (Chuyên gia Kịch bản Regex cho SillyTavern Character Card, hoạt động tối ưu bên trong Iframe Sandbox).
Nhiệm vụ của bạn là quét qua toàn bộ danh sách kịch bản Regex hiện có và dò lỗi cẩn thận, chi tiết.
Đối với mỗi kịch bản Regex, hãy kiểm tra:
1. Có bị lỗi cú pháp không (ví dụ: thiếu dấu ngoặc đóng, sai ký tự thoát, cờ flags không hợp lệ)?
2. Có thể bị lỗi lặp vô tận hoặc hiệu năng cực kém (ReDoS) không?
3. Chuỗi thay thế có bị rò rỉ mã độc hoặc vỡ giao diện HTML/CSS không?
4. Đề xuất viết lại thông minh và hiệu quả hơn nếu có lỗi hoặc điểm tối ưu hóa.

Bạn PHẢI trả về một chuỗi JSON hợp lệ có dạng cấu trúc chính xác sau (không bọc trong tag markdown hay bất kỳ ký tự nào dư thừa):
{
  "hasErrors": true, // (đặt thành true nếu có ít nhất một lỗi cú pháp hoặc logic cần sửa ở bất kỳ kịch bản nào, ngược lại là false)
  "summary": "Tóm tắt cực kỳ ngắn gọn 1-2 câu về tình trạng danh sách Regex bằng tiếng Việt",
  "diagnostics": [
    {
      "scriptIndex": 0, // số thứ tự index của kịch bản khớp với danh sách đầu vào
      "scriptName": "Tên kịch bản",
      "status": "error" // hoặc "warning" (CHỈ liệt kê các kịch bản thực sự có lỗi hoặc điểm tối ưu hóa. KHÔNG bao gồm các kịch bản hoạt động hoàn hảo mang status "ok" để tinh giảm kích thước token phản hồi và tăng tốc độ tối đa)
      "issueDescription": "Mô tả siêu ngắn gọn lỗi bằng tiếng Việt (1 câu)",
      "originalRegex": "biểu thức tìm kiếm gốc của kịch bản",
      "originalReplacement": "chuỗi thay thế gốc của kịch bản",
      "proposedRegex": "biểu thức tìm kiếm khuyên dùng mới (đã sửa lỗi/tối ưu)",
      "proposedReplacement": "chuỗi thay thế khuyên dùng mới (đã sửa lỗi/tối ưu)",
      "explanation": "Giải thích siêu ngắn gọn lý do tại sao thay đổi này lại tối ưu hơn bằng tiếng Việt (1 câu)"
    }
  ]
}

LƯU Ý CỰC KỲ QUAN TRỌNG ĐỂ TĂNG TỐC ĐỘ: Chỉ liệt kê các kịch bản có lỗi hoặc cần cải tiến (status là 'error' hoặc 'warning') vào mảng 'diagnostics'. Đối với các kịch bản hoàn hảo không có vấn đề gì, hãy BỎ QUA KHÔNG ĐƯA VÀO mảng 'diagnostics' để tiết kiệm lưu lượng token ra và đạt được tốc độ nhanh nhất!`;

      const promptText = `
Hãy phân tích danh sách kịch bản Regex của nhân vật "${characterName || 'SillyTavern Card'}":
${JSON.stringify(regexScripts || [], null, 2)}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          systemInstruction,
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      });

      // Try to parse JSON response to ensure validity
      try {
        const parsed = JSON.parse(response.text || "{}");
        res.json(parsed);
      } catch (e) {
        // Fallback if parsing failed but we got some text
        res.json({
          hasErrors: false,
          summary: "Kết quả phân tích từ AI (Vui lòng xem chi tiết văn bản):",
          rawText: response.text
        });
      }
    } catch (error: any) {
      console.error("[AI Debug Card Regexes API] Error:", error);
      res.status(500).json({
        error: "Lỗi luồng xử lý AI Trợ lý gỡ lỗi toàn bộ Regex.",
        details: error.message
      });
    }
  });

  // AI Assistant for Rule Customizer (Draft, Rephrase, Conflict check, Suggest)
  app.post("/api/ai/rule-assist", async (req, res) => {
    const { action, currentRule, existingRules, prompt } = req.body;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "Chưa cấu hình API Key cho Gemini (GEMINI_API_KEY). Trợ lý AI Luật Lệ yêu cầu API Key để hoạt động." 
        });
      }

      // Initialize Gemini SDK
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      let systemInstruction = "";
      let requestPrompt = "";

      if (action === "draft") {
        systemInstruction = "Bạn là trợ lý AI thiết kế luật lệ (System Prompt Rule Architect) cho trò chơi Text RPG. Nhiệm vụ của bạn là nhận một ý tưởng ngắn hoặc chủ đề và bồi đắp nó thành một luật lệ (Rule/Constraint) chuẩn sát, súc tích, tàn nhẫn và có cấu trúc cao để ép buộc mô hình LLM chính văn phải tuân thủ nghiêm ngặt. Hãy viết trực tiếp nội dung luật lệ đề xuất (không dông dài mở bài hay giải thích).";
        requestPrompt = `Ý tưởng ngắn: "${prompt || 'chống tự đóng thế'}"\nDanh mục: "${currentRule?.category || 'Chung'}"\nĐộ ưu tiên: "${currentRule?.priority || 'Cao'}"\n\nHãy sinh ra luật lệ tối ưu:`;
      } else if (action === "rephrase") {
        systemInstruction = "Bạn là chuyên gia tinh luyện câu từ kịch bản AI System Prompt. Nhiệm vụ của bạn là nhận vào nội dung một luật lệ và viết lại nó sao cho rõ ràng hơn, mạnh mẽ hơn, gãy gọn súc tích và có tính cưỡng chế cao nhất để AI tuyệt đối không thể bỏ qua hoặc phá vỡ. Hãy chỉ trả về nội dung của luật lệ đã viết lại, không ghi thêm lời thoại hay lời khuyên nào khác.";
        requestPrompt = `Nội dung luật gốc:\n"${currentRule?.content || ''}"\n\nHãy viết lại tối ưu nhất:`;
      } else if (action === "detect-conflict") {
        systemInstruction = "Bạn là chuyên gia phân tích logic kịch thức RPG. Hãy so sánh luật mới đang soạn thảo với danh sách luật lệ hiện hữu để tìm ra mâu thuẫn trực tiếp hay gián tiếp (ví dụ: một luật yêu cầu NPC đóng vai tàn nhẫn và một luật khác yêu cầu NPC nhân đạo). Hãy trả về JSON chuẩn có định dạng sau: {\"hasConflict\": boolean, \"explanation\": \"Mô tả cực kỳ ngắn gọn và chính xác mâu thuẫn bằng tiếng Việt (1-2 câu)\"}";
        requestPrompt = `Luật lệ mới đang soạn:\nTiêu đề: ${currentRule?.title || ''}\nNội dung: ${currentRule?.content || ''}\n\nDanh sách luật lệ hiện tại:\n${JSON.stringify(existingRules || [])}\n\nHãy đánh giá logic và trả về JSON chuẩn:`;
      } else if (action === "suggest") {
        systemInstruction = "Bạn là kiến trúc sư kịch bản và luật vận hành phong phú cho AI RPG. Dựa trên luật lệ hiện tại của người dùng, hãy đề xuất 3 luật bổ trợ thông minh để làm phong phú thêm trải nghiệm cốt truyện, tăng tính thực tế hoặc tăng kịch tính. Trả về mảng JSON chuẩn có định dạng: [{\"title\": \"Tiêu đề luật gợi ý ngắn gọn\", \"content\": \"Nội dung chi tiết luật gợi ý\"}]";
        requestPrompt = `Luật hiện tại:\nTiêu đề: ${currentRule?.title || ''}\nNội dung: ${currentRule?.content || ''}\n\nHãy trả về 3 gợi ý bổ trợ dưới dạng mảng JSON chuẩn:`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: requestPrompt,
        config: {
          systemInstruction,
          temperature: 0.3,
          responseMimeType: (action === "detect-conflict" || action === "suggest") ? "application/json" : "text/plain"
        }
      });

      res.json({ result: response.text });
    } catch (error: any) {
      console.error("[AI Rule Assist API] Error:", error);
      res.status(500).json({ error: "Lỗi kết nối bộ não AI Luật Lệ.", details: error.message });
    }
  });

  // SOTA Web Search Endpoint (Layer 2 Cascade Waterfall)
  app.post("/api/ai/sota-search", async (req, res) => {
    const { query, maxResults } = req.body;
    if (!query) {
      return res.status(451).json({ error: "Yêu cầu từ khóa tìm kiếm (query)." });
    }
    try {
      const { SotaSearchService } = await import("./src/services/ai/search/SotaSearchService");
      const searchResult = await SotaSearchService.executeWaterfallSearch(query, maxResults || 8);
      res.json(searchResult);
    } catch (error: any) {
      console.error("[SOTA Search API] Error:", error);
      res.status(500).json({
        error: "Gặp sự cố khi thực thi SOTA Web Search.",
        details: error.message
      });
    }
  });

  // ElevenLabs Proxy Endpoints
  app.get("/api/audio/elevenlabs/voices", async (req, res) => {
    let apiKey = req.headers['xi-api-key'] || req.query.apiKey;
    if (!apiKey) {
      apiKey = process.env.ELEVENLABS_API_KEY;
    }

    if (!apiKey) {
      return res.status(400).json({ error: "Chưa cấu hình API Key cho ElevenLabs. Hãy điền API Key trong phần Cài đặt." });
    }

    try {
      const response = await axios.get("https://api.elevenlabs.io/v1/voices", {
        headers: {
          "xi-api-key": apiKey as string,
        },
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("[ElevenLabs Voices API] Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        error: "Không thể lấy danh sách giọng nói từ ElevenLabs.",
        details: error.response?.data?.detail?.message || error.message
      });
    }
  });

  app.post("/api/audio/elevenlabs/tts", async (req, res) => {
    const { text, voiceId, modelId, stability, similarityBoost } = req.body;
    let apiKey = req.headers['xi-api-key'] || req.body.apiKey;
    if (!apiKey) {
      apiKey = process.env.ELEVENLABS_API_KEY;
    }

    if (!apiKey) {
      return res.status(400).json({ error: "Chưa cấu hình API Key cho ElevenLabs. Hãy điền API Key trong phần Cài đặt." });
    }

    if (!text) {
      return res.status(400).json({ error: "Thiếu văn bản cần chuyển thành giọng nói." });
    }

    const targetVoiceId = voiceId || "21m00Tcm4TlvDq8ikWAM"; // Rachel default
    const targetModelId = modelId || "eleven_turbo_v2_5";

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`,
        {
          text: text,
          model_id: targetModelId,
          voice_settings: {
            stability: typeof stability === 'number' ? stability : 0.5,
            similarity_boost: typeof similarityBoost === 'number' ? similarityBoost : 0.75,
          }
        },
        {
          headers: {
            "xi-api-key": apiKey as string,
            "Content-Type": "application/json",
          },
          responseType: "arraybuffer",
        }
      );

      res.setHeader("Content-Type", "audio/mpeg");
      res.send(response.data);
    } catch (error: any) {
      console.error("[ElevenLabs TTS API] Error:", error.message);
      let errorDetail = error.message;
      if (error.response?.data) {
        try {
          const dec = new TextDecoder("utf-8");
          const errorJson = JSON.parse(dec.decode(error.response.data));
          errorDetail = errorJson.detail?.message || errorDetail;
        } catch (e) {
          // ignore
        }
      }
      res.status(error.response?.status || 500).json({
        error: "Không thể chuyển đổi văn bản thành giọng nói.",
        details: errorDetail
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`AI Proxy available at /api/ai/proxy`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
