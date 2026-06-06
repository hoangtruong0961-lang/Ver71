import { RegexScript } from '../types';

export function isDangerousRegexPattern(pattern: string): boolean {
  if (!pattern || typeof pattern !== 'string') return false;
  
  // 1. Nested quantifiers: e.g. (a+)+, (a*)*, (a+)*, (\s+)+
  if (/(\([^()]*[*+?{][^()]*\)[*+?{])/.test(pattern)) {
    return true;
  }
  
  // 2. Overlapping alternations inside groups with quantifiers, e.g. (a|a+)+
  if (/(\([^()|]*\|[^()]*[*+?{][^()]*\)[*+?{])/.test(pattern)) {
    return true;
  }
  
  // 3. Repeated overlapping backreferences with quantifiers, e.g. (a+)\1+
  if (/(\([^()]*\)[*+?{]\\[1-9][*+?{])/.test(pattern)) {
    return true;
  }

  return false;
}

export function safeUtf8ToBase64(str: string): string {
  try {
    const percentEncoded = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    });
    return btoa(percentEncoded);
  } catch (e) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf-8').toString('base64');
    }
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch {
      return "";
    }
  }
}

export const LSR_REGEX = [
  {
      "name": "Hide TableEdit",
      "regex": /<tableEdit>((?:(?!<tableEdit>).)*?)<\/tableEdit>/gs
  },
  {
      "name": "Hide TableThink",
      "regex": /<tableThink>((?:(?!<tableThink>).)*?)<\/tableThink>/gs
  },
  {
      "name": "Hide User Input Wrapper",
      "regex": /<user_input>[\s\S]*?<\/user_input>/gs
  },
  {
      "name": "Hide Content Tags",
      "regex": /<\/?content>/g
  }
];

/**
 * Các Regex hệ thống cho Tawa Protocol
 */
export const TAWA_REGEX = {
  // Các mẫu cần loại bỏ khỏi văn bản hiển thị
  ARTIFACTS_REMOVAL: [
    /\[Hệ thống:.*?\]/gi,
    /\[Thông báo:.*?\]/gi,
    /\[Status:.*?\]/gi,
    /\[Cảnh báo:.*?\]/gi,
    /\[Lưu ý:.*?\]/gi,
    /\[Gợi ý:.*?\]/gi,
    /\[Time:.*?\]/gi,
    /\[Turn:.*?\]/gi,
    /\[Mục tiêu:.*?\]/gi,
    /\[Tiến độ:.*?\]/gi,
    /\[Giai đoạn:.*?\]/gi,
    /\[Đoạn:.*?\]/gi,
    /\[Số chữ:.*?\]/gi,
    /\[Tình trạng:.*?\]/gi,
    /\[Kiểm tra:.*?\]/gi,
    /\[Phân tích:.*?\]/gi,
    /\[Thinking:.*?\]/gi,
    /\[Content:.*?\]/gi,
    /\[Branches:.*?\]/gi,
    /\[Choices:.*?\]/gi,
    /\[Actions:.*?\]/gi,
    /\[LSR_SYNC:.*?\]/gi,
    /\[DATA_SYNC:.*?\]/gi,
    /\[INPUT_DECODING:.*?\]/gi,
    /\[SYNCHRONIZATION:.*?\]/gi,
    /\[Loading.*?:.*?\]/gi,
    /\[Tải.*?:.*?\]/gi,
    /\[KẾT THÚC PHẦN TRUYỆN\]/gi,
    /\[BẮT ĐẦU PHẦN TRUYỆN\]/gi,
    /\[SYSTEM BOOT & RESOURCE LOADING\]/gi,
    /^\s*->\s*$/gm,
    /^\s*=>\s*$/gm
  ]
};

/**
 * Tự động chuẩn hóa và đóng các thẻ thinking chưa đóng khi AI quên đóng trước khi vào nội dung chính.
 * Giải pháp tối ưu: Chuẩn hóa tất cả các biến thể và tự động đóng thẻ bằng cách tìm thẻ có mức độ ưu tiên
 * tiếp theo trong cấu trúc XML của hệ thống (như <content>, <story>, <branches>...).
 */
export const sanitizeUnclosedThinkingTags = (text: string): string => {
  if (typeof text !== 'string' || !text) return text;

  // Bước 1: Chuẩn hóa tất cả các biến thể của thẻ mở và đóng thinking về chuẩn duy nhất <thinking> và </thinking>
  // Hỗ trợ cả khoảng trắng phụ bên trong tag như <thinking > hoặc </ thought >
  let balanced = text;
  balanced = balanced.replace(/<(thinking|think|thinhking|thought|thoughts)\b[^>]*>/gi, '<thinking>');
  balanced = balanced.replace(/<\/(thinking|think|thinhking|thought|thoughts)\b[^>]*>/gi, '</thinking>');

  // Chuẩn hóa các biến thể đóng bị viết sai hoặc có khoảng trắng như < /thinking> hoặc <\thinking>
  balanced = balanced.replace(/<\s*\/+\s*(thinking|think|thinhking|thought|thoughts)\s*>/gi, '</thinking>');
  balanced = balanced.replace(/\\(thinking|think|thinhking|thought|thoughts)>/gi, '</thinking>');

  // Bước 2: Tìm kiếm xem có thẻ <thinking> mở nào chưa được đóng hay không
  let lastSearchIdx = 0;
  while (true) {
    const remainingText = balanced.substring(lastSearchIdx);
    const openMatch = remainingText.match(/<thinking>/i);
    if (!openMatch) break;

    const openIdx = lastSearchIdx + openMatch.index!;
    const contentStartIdx = openIdx + openMatch[0].length;
    const afterOpenText = balanced.substring(contentStartIdx);

    // Kiểm tra xem sau thẻ mở này có thẻ đóng </thinking> nào không
    const closeMatch = afterOpenText.match(/<\/thinking>/i);
    if (closeMatch) {
      // Đã đóng hợp lệ, tiếp tục tìm cặp tiếp theo nếu có (ví dụ khi hiển thị lịch sử hoặc ghép đoạn)
      lastSearchIdx = contentStartIdx + closeMatch.index! + closeMatch[0].length;
      if (lastSearchIdx >= balanced.length) break;
      continue;
    }

    // Nếu KHÔNG có thẻ đóng </thinking>:
    // Hướng xử lý tối ưu 1: Tìm sự xuất hiện của bất kỳ thẻ hệ thống/câu lệnh tiếp theo nào trong luồng XML
    // Theo thiết kế, các khối như <content>, <story>, <branches>, <choices>, <table_stored>, [BẮT ĐẦU TRUYỆN]...
    // luôn ở sau phần suy nghĩ.
    const otherTags = [
      "content", "story", "branches", "choices", "actions", "table_stored", "tableEdit", 
      "set_time", "time_cost", "incrementalSummary", "system_event"
    ];

    let earliestSubsequentIdx = -1;

    for (const otherTag of otherTags) {
      const otherOpenRegex = new RegExp(`<${otherTag}\\b[^>]*>`, 'i');
      const otherCloseRegex = new RegExp(`</${otherTag}\\b[^>]*>`, 'i');

      const openMatchOther = afterOpenText.match(otherOpenRegex);
      if (openMatchOther && (earliestSubsequentIdx === -1 || openMatchOther.index! < earliestSubsequentIdx)) {
        earliestSubsequentIdx = openMatchOther.index!;
      }

      const closeMatchOther = afterOpenText.match(otherCloseRegex);
      if (closeMatchOther && (earliestSubsequentIdx === -1 || closeMatchOther.index! < earliestSubsequentIdx)) {
        earliestSubsequentIdx = closeMatchOther.index!;
      }
    }

    // Kiểm tra thêm các nhãn mốc quan trọng ở đầu phần chính văn
    const narrativeMarkers = [/\[BẮT ĐẦU TRUYỆN\]/i, /\[BẮT ĐẦU PHẦN TRUYỆN\]/i, /\[START_STORY\]/i];
    for (const marker of narrativeMarkers) {
      const markerMatch = afterOpenText.match(marker);
      if (markerMatch && (earliestSubsequentIdx === -1 || markerMatch.index! < earliestSubsequentIdx)) {
        earliestSubsequentIdx = markerMatch.index!;
      }
    }

    if (earliestSubsequentIdx !== -1) {
      // Tìm thấy thẻ hoặc nhãn mốc tiếp theo. Đóng <thinking> ngay trước điểm này.
      const closePosition = contentStartIdx + earliestSubsequentIdx;
      balanced = balanced.substring(0, closePosition) + "\n</thinking>\n" + balanced.substring(closePosition);
      lastSearchIdx = closePosition + "\n</thinking>\n".length;
      continue;
    }

    // Hướng xử lý tối ưu 2 (Fallback độc lập ngôn ngữ): Nếu không có thẻ cấu trúc nào ở sau,
    // nhưng xuất hiện hai dòng xuống hàng liên tiếp (\n\n) đi trước một ký tự hoặc dấu hội thoại thông thường 
    // (như các loại dấu ngoặc kép, gạch đầu dòng hội thoại, chữ cái viết hoa) và KHÔNG phải là một gạch đầu dòng của phân tích.
    const transitionRegex = /\n\s*\n+(?=[“"「『—\u00C0-\u1EF9a-zA-Z](?![\s\S]*?[:：\-•*]\s))/i;
    const transitionMatch = afterOpenText.match(transitionRegex);
    if (transitionMatch && transitionMatch.index! > 10) {
      const closePosition = contentStartIdx + transitionMatch.index!;
      balanced = balanced.substring(0, closePosition) + "\n</thinking>" + balanced.substring(closePosition);
      lastSearchIdx = closePosition + "\n</thinking>".length;
      continue;
    }

    // Không tìm thấy bất kỳ điểm chuyển cảnh đáng tin cậy nào, giữ nguyên (có thể là do AI đang stream dở dang ở lượt suy nghĩ)
    break;
  }

  return balanced;
};

/**
 * Trích xuất nội dung nằm giữa tag mở và tag đóng
 * Hỗ trợ cả trường hợp tag chưa đóng (cho streaming) hoặc có khoảng trắng trong tag
 * @param text Văn bản gốc
 * @param tagName Tên thẻ (không bao gồm < >)
 * @returns Nội dung bên trong hoặc null
 */
export const extractTagContent = (text: string, tagName: string): string | null => {
  if (typeof text !== 'string' || !text) return null;
  
  const isThinkingTag = ['thinking', 'think', 'thinhking', 'thought', 'thoughts'].includes(tagName.toLowerCase());
  const targetText = isThinkingTag ? sanitizeUnclosedThinkingTags(text) : text;
  
  // Regex hỗ trợ khoảng trắng trong tag mở: <tag >
  const openTagRegex = new RegExp(`<${tagName}\\s*>`, 'i');
  
  const openMatch = targetText.match(openTagRegex);
  if (!openMatch) return null;
  
  const startIndex = openMatch.index! + openMatch[0].length;
  const afterOpenText = targetText.substring(startIndex);
  
  // Standard nested tag balancing with depths to handle nested tag of same name safely
  const tokenRegex = new RegExp(`<(/?)${tagName}\\s*>`, 'gi');
  let match;
  let depth = 1;
  let closingIndex = -1;
  
  while ((match = tokenRegex.exec(afterOpenText)) !== null) {
    const isClose = match[1] === '/';
    if (isClose) {
      depth--;
      if (depth === 0) {
        closingIndex = match.index;
        break;
      }
    } else {
      depth++;
    }
  }
  
  if (closingIndex !== -1) {
    return afterOpenText.substring(0, closingIndex).trim();
  }
  
  // Fallback if not balanced: find the absolute last closing tag (highly effective for streaming)
  const closeMatches = Array.from(afterOpenText.matchAll(new RegExp(`</${tagName}\\s*>`, 'gi')));
  if (closeMatches.length > 0) {
    const lastCloseMatch = closeMatches[closeMatches.length - 1];
    return afterOpenText.substring(0, lastCloseMatch.index!).trim();
  }
  
  // Nếu không tìm thấy tag đóng nào, lấy hết phần còn lại (hữu ích cho streaming)
  return afterOpenText.trim();
};

/**
 * Phân tách nội dung tag branches thành danh sách các lựa chọn
 * @param content Nội dung thô bên trong tag branches
 * @returns Danh sách các chuỗi lựa chọn
 */
export const parseChoices = (content: string | null): string[] => {
  if (!content) return [];
  
  // Tách theo dòng. Không tách theo | hoặc ; vì chúng có thể xuất hiện trong dữ liệu LSR rò rỉ
  const rawLines = content.split('\n');
  const validChoices: string[] = [];
  const fallbackChoices: string[] = [];
    
  for (const line of rawLines) {
    // 1. Làm sạch dòng: loại bỏ số thứ tự (1., 2., - , * , v.v.) ở đầu câu
    // Điều này giúp các regex sau đó (như narrativePatterns) hoạt động chính xác hơn.
    const cleaned = line.trim().replace(/^(\d+[.)-\s]+|[-*\u2022]\s*)/, '').trim();
    if (!cleaned) continue;

    // 0. BẮT BUỘC: Phải có định dạng chi phí thời gian [phút] ở đầu hoặc trong câu
    // Theo yêu cầu người dùng: "chỉ những hành động có chi phí thời gian mới được hiển thị"
    // Cải tiến: Hỗ trợ [10], [10 phút], [10 min], v.v.
    // Tránh khớp với các phân số như [580/1800] bằng cách giới hạn ký tự bên trong ngoặc
    const hasTime = cleaned.match(/\[\d+\s*(m|phút|min)?\]/i);

    // CẢI TIẾN QUAN TRỌNG: Nếu một dòng quá dài, nó có khả năng là văn bản truyện bị rò rỉ
    // Một lựa chọn hành động thường không quá 300 ký tự.
    if (cleaned.length > 350) continue;

    // KIỂM TRA CẤU TRÚC VĂN KỂ CHUYỆN & ĐỐI THOẠI:
    // Nới lỏng: Không lọc các câu kết thúc bằng dấu chấm trừ khi quá dài (văn kể chuyện thường rất dài)
    if (cleaned.endsWith('.') && cleaned.length > 200) continue;

    // 2. Nếu dòng chứa dấu ngoặc kép và có dấu hai chấm (định dạng đối thoại: Tên: "..."), loại bỏ.
    // Nhưng cho phép đối thoại ngắn trong lựa chọn (ví dụ: [5] Nói "Chào")
    if (cleaned.includes('"') && cleaned.includes(':') && cleaned.indexOf(':') < cleaned.indexOf('"')) continue;

    // 3. Nếu dòng bắt đầu bằng một cái tên và dấu hai chấm (ví dụ: Lâm Phong: ), loại bỏ.
    if (cleaned.match(/^[A-ZÀ-Ỹ][a-zà-ỹ]*(\s+[A-ZÀ-Ỹ][a-zà-ỹ]*)*\s*:/)) continue;

    // Narrative often starts with a name followed by a verb (Vietnamese specific patterns)
    // e.g., "Elara khẽ thở dài", "Hắn nhìn quanh", "Cô ấy mỉm cười", "Dân làng phẫn nộ"
    const narrativePatterns = [
      /^[A-ZÀ-Ỹ][a-zà-ỹ]*\s+(khẽ|đang|vừa|đã|sẽ|mỉm|nhìn|bước|thở|nói|hỏi|đáp|nghĩ|cảm|thấy|đứng|ngồi|đi|chạy|cười|khóc|mất|ra|lấy|cầm|đưa|nhảy|la|hét|gầm|nhếch|quay|tiến|lùi|đấm|đá|tấn|phòng|vung|chém|bắn|tung|rơi|bay|nằm|gục|chết|sống|biến|hiện|tỏa|thu|phát|truyền|hút|đẩy|kéo|nâng|hạ|mở|đóng|xé|nát|vỡ|tan|hợp|chia|đổi|giữ|buông|thả|bắt|thả|giết|cứu|giúp|hại|yêu|ghét|giận|vui|buồn|lo|sợ|kinh|ngạc|ngỡ|ngàng|bàng|hoàng|sửng|sốt|phẫn|nộ|hậm|hực|cay|cú|uất|ức|đau|khổ|sung|sướng|hạnh|phúc|tự|hào|thất|vọng|chán|nản|mệt|mỏi|yếu|ớt|mạnh|mẽ|hung|hăng|hung|dữ|hiền|lành|ngoan|ngoãn|hư|hỏng|tốt|bụng|xấu|xa|tham|lam|nhát|gan|dũng|cảm|thông|minh|ngu|ngốc|khờ|khạo|tinh|ranh|xảo|quyệt|gian|xảo|thật|thà|hiền|hậu|nhân|từ|độc|ác|tàn|nhẫn|vô|tình|hữu|ý|vô|ý|cố|tình|vô|tình)/,
      /^(Hắn|Cô|Anh|Chị|Nó|Họ|Tôi|Ta|Chúng|Bọn|Đám|Dân|Lính|Người|Kẻ|Tên|Gã|Mụ|Lão|Bà|Ông|Con|Cái|Sự|Cái|Điều)\s+(khẽ|đang|vừa|đã|sẽ|mỉm|nhìn|bước|thở|nói|hỏi|đáp|nghĩ|cảm|thấy|đứng|ngồi|đi|chạy|cười|khóc|mất|ra|lấy|cầm|đưa|nhảy|la|hét|gầm|nhếch|quay|tiến|lùi|đấm|đá|tấn|phòng|vung|chém|bắn|tung|rơi|bay|nằm|gục|chết|sống|biến|hiện|tỏa|thu|phát|truyền|hút|đẩy|kéo|nâng|hạ|mở|đóng|xé|nát|vỡ|tan|hợp|chia|đổi|giữ|buông|thả|bắt|thả|giết|cứu|giúp|hại|yêu|ghét|giận|vui|buồn|lo|sợ|kinh|ngạc|ngỡ|ngàng|bàng|hoàng|sửng|sốt|phẫn|nộ|hậm|hực|cay|cú|uất|ức|đau|khổ|sung|sướng|hạnh|phúc|tự|hào|thất|vọng|chán|nản|mệt|mỏi|yếu|ớt|mạnh|mẽ|hung|hăng|hung|dữ|hiền|lành|ngoan|ngoãn|hư|hỏng|tốt|bụng|xấu|xa|tham|lam|nhát|gan|dũng|cảm|thông|minh|ngu|ngốc|khờ|khạo|tinh|ranh|xảo|quyệt|gian|xảo|thật|thà|hiền|hậu|nhân|từ|độc|ác|tàn|nhẫn|vô|tình|hữu|ý|vô|ý|cố|tình|vô|tình)/,
      /^[A-ZÀ-Ỹ][a-zà-ỹ]*\s+[a-zà-ỹ]*\s+(khẽ|đang|vừa|đã|sẽ|mỉm|nhìn|bước|thở|nói|hỏi|đáp|nghĩ|cảm|thấy|đứng|ngồi|đi|chạy|cười|khóc)/,
      /^[A-ZÀ-Ỹ][a-zà-ỹ]*\s+có\s+chút\s+[a-zà-ỹ]*/,
      /^(Dân làng|Bọn lính|Đám đông|Mọi người|Kẻ địch|Đối phương|Nhân vật|Hệ thống)\s+/
    ];
    if (narrativePatterns.some(p => p.test(cleaned))) continue;

    // 4. Nếu dòng bắt đầu bằng # hoặc có định dạng index:Value (thông tin hệ thống rò rỉ), loại bỏ.
    if (cleaned.startsWith('#')) continue;
    // Regex mạnh hơn để bắt format d: hoặc d:d (LSR data)
    if (cleaned.match(/^\d+\s*:/)) continue;
    if (cleaned.match(/^[a-zA-Z0-9_]+\s*:/) && !cleaned.includes(' ')) continue; // Tên biến hệ thống: giá trị

    // 5. Nếu dòng quá ngắn (dưới 3 ký tự) và không phải là số trong ngoặc, loại bỏ.
    if (cleaned.length < 3 && !hasTime) continue;
    if (/^[^\w\s]+$/.test(cleaned)) continue;

    // 6. Nới lỏng: Cho phép dấu ngoặc kép trong lựa chọn hành động
    // if (cleaned.includes('"') || cleaned.includes('“') || cleaned.includes('”')) continue;

    // LOẠI BỎ CÁC DÒNG TƯ DUY / LOG HỆ THỐNG (Dựa trên ảnh lỗi của người dùng)
    const lower = cleaned.toLowerCase();
    if (lower === 'is clean.' || 
        lower === 'is clean' ||
        lower.includes('đoạn:') || 
        lower.includes('số chữ:') || 
        lower.includes('giai đoạn:') || 
        lower.includes('mục tiêu:') || 
        lower.includes('tiến độ:') || 
        lower.includes('đạt chuẩn') || 
        lower.includes('đang viết') ||
        lower.includes('kiểm tra') ||
        lower.includes('phân tích') ||
        lower.includes('thinking') ||
        lower.includes('content') ||
        lower.includes('branches') ||
        lower.includes('choices') ||
        lower.includes('actions') ||
        lower.includes('bắt đầu phần truyện') ||
        lower.includes('kết thúc phần truyện') ||
        cleaned.match(/\[(BẮT ĐẦU|KẾT THÚC)\s+PHẦN\s+TRUYỆN\]/i) ||
        cleaned.match(/^\[.*?\]$/) && (lower.includes('truyện') || lower.includes('phần')) ||
        lower.includes('lsr_sync') ||
        lower.includes('data_sync') ||
        lower.includes('input_decoding') ||
        lower.includes('synchronization') ||
        lower.includes('loading') ||
        lower.includes('tải biến') ||
        lower.includes('tải hiến pháp') ||
        lower.includes('luật cấm') ||
        lower.includes('đồng bộ') ||
        lower.includes('văn bản chính') ||
        lower.includes('chính văn') ||
        lower.includes('kết quả:') ||
        lower.includes('trạng thái:') ||
        lower.includes('thời gian:') ||
        lower.includes('địa điểm:') ||
        lower.includes('nhân vật:') ||
        lower.includes('hành động:') ||
        lower.includes('bối cảnh:') ||
        lower.includes('director\'s notes') ||
        lower.includes('director notes') ||
        lower.includes('system boot') ||
        lower.includes('resource loading') ||
        lower.includes('- ensure') ||
        lower.includes('- style') ||
        lower.includes('- anti-leakage') ||
        lower.includes('- structure') ||
        lower.includes('- no dialogue') ||
        lower.includes('- no narrative') ||
        lower.includes('- format') ||
        lower.includes('- purity') ||
        lower.includes('style enforcement') ||
        lower.includes('anti-leakage') ||
        lower.includes('structure check') ||
        lower.includes('player-centric') ||
        lower.includes('choice logic') ||
        lower.includes('action format') ||
        lower.includes('detail & progression') ||
        lower.includes('strict separation') ||
        lower.includes('important warning') ||
        lower.includes('branching rules') ||
        lower.includes('output structure') ||
        lower.includes('integrity check') ||
        lower.includes('word count') ||
        lower.includes('paragraphs:') ||
        lower.includes('plan for next stage') ||
        lower.includes('words per paragraph') ||
        lower.includes('internal dialogue') ||
        lower.includes('decision-making process') ||
        lower.includes('inprogress') ||
        cleaned.match(/^\w+\s+\d+\s+word\s+count/i) ||
        cleaned.match(/^\w+\s+\d+\s+paragraphs/i) ||
        cleaned.match(/^\w+\s+\d+\s+plan\s+for/i) ||
        cleaned.match(/\[\d+\/\d+\]/) || // Loại bỏ các fraction như [580/1800]
        cleaned.match(/^\d{4}-\d{2}-\d{2}/) || // Loại bỏ dòng ngày tháng rò rỉ
        cleaned.match(/^\d{2}:\d{2}/) // Loại bỏ dòng giờ giấc rò rỉ
    ) continue;

    // Loại bỏ các dòng rác hoặc tag rò rỉ
    if (cleaned.includes('|') && (cleaned.includes(':') || cleaned.startsWith('#'))) continue; // Lọc bỏ dữ liệu LSR dạng bảng
    if (cleaned.includes('<') || cleaned.includes('>')) continue;

    // Loại bỏ các dòng nằm trong ngoặc đơn (thường là lời nhắn của AI)
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) continue;

    // Loại bỏ các dòng chỉ có dấu chấm hoặc ký tự đặc biệt rác
    if (cleaned === '.' || cleaned === '...' || cleaned === '-' || cleaned === '->' || cleaned === '=>' || cleaned === '---') continue;

    // Loại bỏ các dòng bắt đầu bằng dấu gạch ngang hoặc mũi tên rác (thường là list chỉ dẫn rò rỉ)
    if (cleaned.startsWith('- ') || cleaned.startsWith('->') || cleaned.startsWith('=>') || cleaned.startsWith('---')) continue;
    
    // Loại bỏ các dòng có định dạng tiêu đề [THIẾT LẬP...] hoặc dấu mốc cấu trúc
    if (cleaned.match(/^\[(THIẾT LẬP|HỆ THỐNG|THÔNG BÁO|STATUS|START WRITING|WRITING START|STORY START|CONTINUE|NEXT|BẮT ĐẦU PHẦN TRUYỆN|KẾT THÚC PHẦN TRUYỆN).*?\]$/i)) continue;

    // 7. Thêm vào danh sách lựa chọn nếu vượt qua tất cả các bộ lọc
    if (cleaned) {
      const timeMatch = cleaned.match(/\[(\d+)\s*(m|phút|min)?\]/i);
      if (timeMatch) {
        const timeValue = timeMatch[1];
        const actionText = cleaned.replace(timeMatch[0], '').trim();
        validChoices.push(`${actionText} | ${timeValue}m`);
      } else {
        fallbackChoices.push(cleaned);
      }
    }
  }
  
  // Nếu có lựa chọn có thời gian, ưu tiên chúng
  if (validChoices.length > 0) return validChoices;
  
  // Nếu không có lựa chọn có thời gian, nhưng có lựa chọn tiềm năng, gắn thời gian mặc định [5]
  if (fallbackChoices.length > 0) {
    return fallbackChoices.map(c => `${c} | 5m`).slice(0, 10);
  }

  return [];
};

/**
 * Trích xuất định dạng JSON từ một chuỗi (hỗ trợ loại bỏ text/markdown dư thừa)
 * @param text Văn bản chứa cấu trúc JSON
 * @returns JSON object hoặc mảng nếu có, null nếu thất bại
 */
export const extractJson = <T>(text: string): T | null => {
  if (!text) return null;
  // Xóa bỏ các định dạng markdown
  const cleanedText = text.replace(/```[a-z]*\s*/gi, "").replace(/```/g, "").trim();

  // Tìm cặp ngoặc nhọn hoặc ngoặc vuông đầu tiên/cuối cùng để trích xuất JSON
  const startBracketIndex = cleanedText.indexOf('{');
  const startSquareIndex = cleanedText.indexOf('[');
  
  let startIndex = -1;
  let endIndex = -1;
  if (startBracketIndex !== -1 && (startSquareIndex === -1 || startBracketIndex < startSquareIndex)) {
    startIndex = startBracketIndex;
    endIndex = cleanedText.lastIndexOf('}');
  } else if (startSquareIndex !== -1) {
    startIndex = startSquareIndex;
    endIndex = cleanedText.lastIndexOf(']');
  }

  const tryParse = (str: string): T | null => {
    try {
      return JSON.parse(str);
    } catch (e) {
      // Fix common LLM JSON errors:
      // 1. Trailing commas
      const fixedStr = str.replace(/,\s*([}\]])/g, "$1");
      try {
        return JSON.parse(fixedStr);
      } catch (e2) {
        console.warn("Lỗi phân tích JSON nội bộ:", e);
        console.log("Raw JSON Str:", str);
      }
    }
    return null;
  };

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const jsonStr = cleanedText.substring(startIndex, endIndex + 1);
    const parsed = tryParse(jsonStr);
    if (parsed) return parsed;
  }

  // Fallback direct parse (in case it's clean enough)
  try {
    return JSON.parse(cleanedText);
  } catch (e) {
    console.warn("Lỗi phân tích JSON toàn bộ:", e);
    return null;
  }
};

/**
 * Loại bỏ các thẻ hệ thống để lấy nội dung truyện thuần túy hiển thị ra UI
 * @param text Văn bản gốc
 * @returns Văn bản đã làm sạch
 */
export const cleanRawText = (text: string): string => {
  if (typeof text !== 'string' || !text) return "";
  
  // Tự động sửa chữa các thẻ thinking chưa được đóng để tránh nuốt mất chính văn
  const balancedText = sanitizeUnclosedThinkingTags(text);
  
  const absoluteOriginal = balancedText.trim();

  // 0. Bảo vệ code blocks, sandboxes, và full HTML documents khỏi bị làm sạch hoặc lọc dòng
  const protectedCodeBlocks: string[] = [];
  let cleaned = balancedText.replace(/```[\s\S]*?```/g, (match) => {
    protectedCodeBlocks.push(match);
    return `__SYS_CODEBLOCK_PROTECTED_${protectedCodeBlocks.length - 1}__`;
  });

  const protectedFullDocs: string[] = [];
  cleaned = cleaned.replace(/<!DOCTYPE\s+html>[\s\S]*?(?:<\/html>|$)|<\s*html\b[\s\S]*?(?:<\/html>|$)/gi, (match) => {
    protectedFullDocs.push(match);
    return `__SYS_FULLDOC_PROTECTED_${protectedFullDocs.length - 1}__`;
  });

  const protectedSandboxes: string[] = [];
  cleaned = cleaned.replace(/<sandbox>([\s\S]*?)(?:<\/sandbox>|$)/gi, (match) => {
    protectedSandboxes.push(match);
    return `__SYS_SANDBOX_PROTECTED_${protectedSandboxes.length - 1}__`;
  });

  // Danh sách các thẻ hệ thống cần loại bỏ hoàn toàn (bao gồm cả nội dung bên trong)
  const tagsToRemove = [
    'thinking',
    'think',
    'thinhking', // Typos
    'thought',
    'thoughts',
    'meow_FM',
    'meow_fm',
    'table_stored',
    'tableEdit',
    'branches',
    'choices',
    'actions',
    'memory_table_guide',
    'user_input',
    'word_count',
    'set_time',
    'time_cost',
    'incrementalSummary',
    'finish',
    'OntologicalSeverance',
    'Co-AuthorshipGrant',
    'HypotheticalConstruct',
    'AxiomaticImmunity',
    'ExperimentalDrift',
    'HermeticSeal',
    'ResonancePurpose',
    'SovereignLogic'
  ];

  // 1. Xóa các khối thẻ hệ thống (Thẻ + Nội dung bên trong)
  tagsToRemove.forEach(tag => {
    const openTagStr = `<${tag}\\s*>`;
    const openTagRegex = new RegExp(openTagStr, 'i');
    
    let searchIndex = 0;
    while (true) {
        const remainingText = cleaned.substring(searchIndex);
        const openMatch = remainingText.match(openTagRegex);
        
        if (!openMatch) break;
        
        const startIndex = searchIndex + openMatch.index!;
        const contentStartIndex = startIndex + openMatch[0].length;
        const afterOpen = cleaned.substring(contentStartIndex);
        
        // Scan for matching closing tag with depth balancing
        const tokenRegex = new RegExp(`<(/?)${tag}\\s*>`, 'gi');
        let match;
        let depth = 1;
        let closingIndex = -1;
        let closingLength = 0;
        
        while ((match = tokenRegex.exec(afterOpen)) !== null) {
            const isClose = match[1] === '/';
            if (isClose) {
                depth--;
                if (depth === 0) {
                    closingIndex = match.index;
                    closingLength = match[0].length;
                    break;
                }
            } else {
                depth++;
            }
        }
        
        // If nested balancing fails, try fallback to last </tag>
        if (closingIndex === -1) {
            const fallbackMatches = Array.from(afterOpen.matchAll(new RegExp(`</${tag}\\s*>`, 'gi')));
            if (fallbackMatches.length > 0) {
                const lastCloseMatch = fallbackMatches[fallbackMatches.length - 1];
                closingIndex = lastCloseMatch.index!;
                closingLength = lastCloseMatch[0].length;
            }
        }
        
        if (closingIndex !== -1) {
            const endIndex = contentStartIndex + closingIndex + closingLength;
            // Xóa toàn bộ thân thẻ và nội dung bên trong
            cleaned = cleaned.substring(0, startIndex) + cleaned.substring(endIndex);
            searchIndex = startIndex;
        } else {
            // Nếu không tìm thấy thẻ đóng, xóa toàn bộ phần còn lại (hữu ích cho streaming)
            cleaned = cleaned.substring(0, startIndex);
            break; 
        }
        if (searchIndex >= cleaned.length) break;
    }
  });

  const originalBeforeFiltering = cleaned;

  // Hướng 2: Sau khi xóa các thẻ cấu trúc (như <branches>, <thinking>), 
  // nếu chúng được bọc trong các thẻ <details> rỗng (chỉ có <summary> mà không có nội dung cốt truyện khác),
  // ta dọn dẹp các cụm <details> rỗng này để tránh để lại khung rỗng xấu xí trên bong bóng chat.
  cleaned = cleaned.replace(/<details[^>]*>\s*<summary>[\s\S]*?<\/summary>\s*(?:&nbsp;|\s|<br\s*\/?>)*<\/details>/gi, "");

  // 2. Xử lý thẻ <content> hoặc <story>
  const contentBody = extractTagContent(cleaned, 'content');
  const storyBody = extractTagContent(cleaned, 'story');
  
  if (contentBody && contentBody.length > 20) {
      let extraContent = '';
      
      // Only extract extra content if <content> tag is actually closed, to avoid duplication during streaming
      if (/<\/content\s*>/i.test(cleaned)) {
          const outsideText = cleaned.replace(/<content>[\s\S]*?<\/content>/gi, '');
          
          // Match any paired XML/HTML tag outside the content (e.g. <equip>...</equip>, <quest>...</quest>)
          // This avoids hardcoding structural tags and preserves user-defined elements.
          const anyTagRegex = /<([A-Za-z0-9_-]+)(?:\s+[^>]*)?>[\s\S]*?<\/\1>/gi;
          let match;
          while ((match = anyTagRegex.exec(outsideText)) !== null) {
              // Ignore typical inline text styling tags if they are just part of stray text, 
              // but mostly it's fine to just include all paired tags since stray text itself is dropped.
              extraContent += '\n\n' + match[0];
          }
      }
      cleaned = contentBody + extraContent;
  } else if (storyBody && storyBody.length > 20) {
      let extraContent = '';
      if (/<\/story\s*>/i.test(cleaned)) {
          const outsideText = cleaned.replace(/<story>[\s\S]*?<\/story>/gi, '');
          const anyTagRegex = /<([A-Za-z0-9_-]+)(?:\s+[^>]*)?>[\s\S]*?<\/\1>/gi;
          let match;
          while ((match = anyTagRegex.exec(outsideText)) !== null) {
              extraContent += '\n\n' + match[0];
          }
      }
      cleaned = storyBody + extraContent;
  }

  // 3. XÓA BỎ CÁC THẺ CÒN SÓT LẠI (Cực kỳ quan trọng để tránh lỗi React unrecognized tag)
  const allTagsToStrip = [...tagsToRemove, 'content', 'story', 'incrementalSummary'];
  allTagsToStrip.forEach(tag => {
      // Regex mạnh mẽ hơn để bắt mọi biến thể của thẻ: <tag>, <tag >, <tag\n>, v.v.
      const openRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
      const closeRegex = new RegExp(`</${tag}[^>]*>`, 'gi');
      cleaned = cleaned.replace(openRegex, '').replace(closeRegex, '');
  });

  // 4. LỌC CÁC DÒNG CHỈ DẪN HỆ THỐNG DẠNG VĂN BẢN THUẦN
  const lines = cleaned.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true; // Giữ lại dòng trống để ngắt đoạn

    // Loại bỏ các artifact kỹ thuật
    const lowerTrimmed = trimmed.toLowerCase();
    if (lowerTrimmed.includes('<finish>') || 
        lowerTrimmed === 'is clean.' ||
        lowerTrimmed === 'is clean' ||
        trimmed.match(/^['\s,.]*$/) || // Xóa dòng chỉ có dấu phẩy, chấm, nháy đơn rác
        trimmed === '->' || trimmed === '=>' || // Xóa dòng chỉ có mũi tên
        lowerTrimmed.includes('[kết thúc phần truyện]') ||
        lowerTrimmed.includes('kết thúc phần truyện]') ||
        lowerTrimmed.includes('[bắt đầu phần truyện]') ||
        lowerTrimmed.includes('[system boot & resource loading]') ||
        lowerTrimmed.includes('[start writing]') ||
        lowerTrimmed.includes('[writing_start]') ||
        lowerTrimmed.includes('[story_start]') ||
        lowerTrimmed.includes('[continue]') ||
        lowerTrimmed.includes('[next]') ||
        lowerTrimmed.includes('perspective:') ||
        lowerTrimmed.includes('director\'s notes') ||
        lowerTrimmed.includes('director notes') ||
        lowerTrimmed.includes('system boot') ||
        lowerTrimmed.includes('resource loading')
    ) return false;
    
    // Chỉ xóa dòng nếu nó CHỈ chứa một thẻ hệ thống (không có văn bản truyện đi kèm)
    if (trimmed.match(/^<\/?(set_time|time_cost|branches|think(?:ing)?|content|story|tableEdit|table_stored|incrementalSummary).*?>$/i)) return false;
    
    // Loại bỏ các dòng log hệ thống đặc thù của Tawa (Cẩn thận không xóa nhầm hội thoại có ký tự đặc biệt)
    if (trimmed.match(/^\d+:\s*(?:[A-Za-z0-9_]+|Value)/)) return false; // Chỉ lọc LSR log cụ thể
    if (trimmed.match(/^\|.*?\|.*?\|/) && trimmed.includes('LSR')) return false; // Chỉ lọc bảng LSR
    if (trimmed.match(/^\[(Tải Hiến Pháp|DATA SYNC|INPUT DECODING|ĐỒNG BỘ HÓA|Tải Biến Số|Luật Cấm|Đồng bộ Canon|Đồng bộ Trạng thái|Thiết lập thời gian|Địa điểm|Mục tiêu|Giai đoạn|Đoạn|Số chữ|Tiến độ|Tình trạng|Kiểm tra|Phân tích|Thinking|Content|Branches|Choices|Actions|LSR_SYNC|DATA_SYNC|INPUT_DECODING|SYNCHRONIZATION|Loading|Tải).*?\]/i)) return false;
    if (trimmed.match(/^\d+\.\s*\[(Tải Hiến Pháp|DATA SYNC|INPUT DECODING|ĐỒNG BỘ HÓA|Tải Biến Số|Luật Cấm|Mục tiêu|Giai đoạn|Đoạn|Số chữ|Tiến độ|Tình trạng|Kiểm tra|Phân tích).*?\]/i)) return false;
    if (trimmed.match(/^(\*|-) (User|NPC|Đồng bộ|Thiết lập|Địa điểm|Perspective|Cảnh báo|Lưu ý|Mục tiêu|Giai đoạn|Đoạn|Số chữ|Tiến độ|Tình trạng|Kiểm tra|Phân tích):/i)) return false;
    if (trimmed.match(/^(Mục tiêu|Giai đoạn|Đoạn|Số chữ|Tình trạng đạt chuẩn|Sắp xếp số chữ|Perspective|Cảnh báo|Lưu ý|Tiến độ|Tình trạng|Kiểm tra|Phân tích|Thinking|Content|Branches|Choices|Actions|LSR_SYNC|DATA_SYNC|INPUT_DECODING|SYNCHRONIZATION|Loading|Tải).*?:/i)) return false;
    if (trimmed.match(/^<!--.*?-->$/)) return false;
    if (trimmed.toLowerCase().includes('tiến hành viết chính văn')) return false;
    if (trimmed.toLowerCase().includes('bắt đầu viết')) return false;
    if (trimmed.toLowerCase().includes('đang viết')) return false;
    if (trimmed.toLowerCase().includes('kết thúc viết')) return false;
    if (trimmed.toLowerCase().includes('hoàn thành viết')) return false;
    if (trimmed.includes('[START WRITING]')) return false;
    if (trimmed.includes('[WRITING_START]')) return false;
    if (trimmed.includes('[STORY_START]')) return false;
    if (trimmed.includes('[CONTINUE]')) return false;
    if (trimmed.includes('[NEXT]')) return false;

    // Loại bỏ các dòng chỉ dẫn hệ thống tiếng Anh bị rò rỉ
    if (trimmed.startsWith('- Ensure') || 
        trimmed.startsWith('- STYLE') || 
        trimmed.startsWith('- ANTI-LEAKAGE') || 
        trimmed.startsWith('- STRUCTURE') ||
        trimmed.startsWith('- NO DIALOGUE') ||
        trimmed.startsWith('- NO NARRATIVE') ||
        trimmed.startsWith('- FORMAT') ||
        trimmed.startsWith('- PURITY') ||
        trimmed.startsWith('STYLE ENFORCEMENT') ||
        trimmed.startsWith('ANTI-LEAKAGE') ||
        trimmed.startsWith('STRUCTURE CHECK') ||
        trimmed.startsWith('CRITICAL_CHOICE_FORMATTING') ||
        trimmed.startsWith('TECHNICAL_FORMATTING_RULES') ||
        trimmed.startsWith('. No meta-talk') ||
        trimmed.startsWith('Anti-Mind Reading') ||
        trimmed.startsWith('Humility:') ||
        trimmed.startsWith('Integrity:') ||
        trimmed.startsWith('Load Core Variables') ||
        trimmed.startsWith('Axioms:') ||
        trimmed.startsWith('Anti-Rules:') ||
        trimmed.startsWith('Goal Analysis') ||
        trimmed.startsWith('Goal:') ||
        trimmed.startsWith('Paragraphs:') ||
        trimmed.startsWith('Words per paragraph') ||
        trimmed.startsWith('Canon Sync') ||
        trimmed.startsWith('Coordinates:') ||
        trimmed.startsWith('Status Sync') ||
        trimmed.startsWith('Enigma:') ||
        trimmed.startsWith('Thân thế thực sự') ||
        trimmed.startsWith('Bí mật về thảm họa') ||
        trimmed.startsWith('Seeds:') ||
        trimmed.startsWith('[World -') ||
        trimmed.startsWith('Thrilling Core') ||
        trimmed.startsWith('Axioms:') ||
        trimmed.startsWith('Anti-Rules:') ||
        trimmed.startsWith('Goal Analysis') ||
        trimmed.startsWith('Goal:') ||
        trimmed.startsWith('Paragraphs:') ||
        trimmed.startsWith('Words per paragraph') ||
        trimmed.startsWith('Canon Sync') ||
        trimmed.startsWith('Coordinates:') ||
        trimmed.includes('💭Tawa Finished Thinking') ||
        trimmed.includes('Anti-Mind Reading') ||
        trimmed.includes('Humility:') ||
        trimmed.includes('Integrity:') ||
        trimmed.includes('Load Core Variables') ||
        trimmed.includes('. No meta-talk')
    ) {
      return false;
    }

    return true;
  });

  cleaned = filteredLines.join('\n').trim();

  // Khôi phục lại các khối bảo vệ ban đầu
  protectedSandboxes.forEach((block, index) => {
    cleaned = cleaned.replace(`__SYS_SANDBOX_PROTECTED_${index}__`, () => block);
  });

  protectedFullDocs.forEach((block, index) => {
    cleaned = cleaned.replace(`__SYS_FULLDOC_PROTECTED_${index}__`, () => block);
  });

  protectedCodeBlocks.forEach((block, index) => {
    cleaned = cleaned.replace(`__SYS_CODEBLOCK_PROTECTED_${index}__`, () => block);
  });

  // FALLBACK: Nếu sau khi lọc mà không còn gì, nhưng trước đó có văn bản, hãy trả về văn bản trước khi lọc
  // Điều này giúp tránh việc hiển thị "Nội dung truyện trống" khi AI viết truyện nhưng bị nhầm là hệ thống
  if (!cleaned) {
      if (originalBeforeFiltering.trim().length > 10) {
          return originalBeforeFiltering.trim();
      }
      // CẢI TIẾN CUỐI CÙNG: Nếu vẫn trống, trả về văn bản gốc (đã trim) để người dùng có cái để đọc/sửa
      if (absoluteOriginal.length > 5) {
          return absoluteOriginal;
      }
  }

  return cleaned;
};

class RegexProvider {
    private static _instance: RegexProvider;
    private cache: Map<string, RegExp> = new Map();
    private maxCacheSize = 1000;

    static get instance() {
        if (!RegexProvider._instance) RegexProvider._instance = new RegexProvider();
        return RegexProvider._instance;
    }

    get(regexString: string, flags: string = 'g'): RegExp | null {
        const cacheKey = `/${regexString}/${flags}`;
        
        if (this.cache.has(cacheKey)) {
            const re = this.cache.get(cacheKey)!;
            // Prevent sharing regex object and race conditions with lastIndex
            return new RegExp(re.source, re.flags);
        }

        try {
            const re = new RegExp(regexString, flags);
            if (this.cache.size >= this.maxCacheSize) {
                const firstKey = this.cache.keys().next().value;
                if (firstKey !== undefined) {
                    this.cache.delete(firstKey);
                }
            }
            this.cache.set(cacheKey, re);
            return new RegExp(re.source, re.flags);
        } catch (e) {
            console.error("Lỗi biên dịch Regex:", e, cacheKey);
            return null;
        }
    }

    clear() {
        this.cache.clear();
    }
}

export const regexProvider = RegexProvider.instance;

function filterString(str: string, trims: string[], macros: Record<string, string>): string {
    let result = str;
    for (const trim of trims) {
        if (!trim) continue;
        let processedTrim = trim;
        Object.entries(macros).forEach(([k, v]) => {
            processedTrim = processedTrim.split(k).join(v || '');
        });
        result = result.split(processedTrim).join('');
    }
    return result;
}

export function extractFlags(findRegex: string): { regex: string, flags: string } {
    if (!findRegex) return { regex: '', flags: 'g' };
    const match = findRegex.match(/^\/(.+)\/([gimsuy]*)$/s);
    if (match) {
        return { regex: match[1], flags: match[2] || 'g' };
    }
    return { regex: findRegex, flags: 'g' }; // ST defaults to 'g', not 'gi'
}

function unescapeSafe(str: string): string {
    let result = '';
    let i = 0;
    let inQuote: '"' | "'" | '`' | null = null;
    let inEscape = false;

    while (i < str.length) {
        const char = str[i];

        if (inQuote !== null) {
            if (inEscape) {
                result += '\\' + char;
                inEscape = false;
                i++;
                continue;
            }

            if (char === '\\') {
                inEscape = true;
                i++;
                continue;
            }

            if (char === inQuote) {
                inQuote = null;
            }

            result += char;
            i++;
            continue;
        }

        if (inEscape) {
            if (char === 'n') {
                result += '\n';
            } else if (char === 't') {
                result += '\t';
            } else if (char === 'r') {
                result += '\r';
            } else if (char === '\\') {
                result += '\\';
            } else {
                result += '\\' + char;
            }
            inEscape = false;
            i++;
            continue;
        }

        if (char === '\\') {
            inEscape = true;
            i++;
            continue;
        }

        if (char === '"' || char === "'" || char === '`') {
            inQuote = char;
        }

        result += char;
        i++;
    }

    if (inEscape) {
        result += '\\';
    }

    return result;
}

export function runRegexScript(
    script: RegexScript, 
    rawString: string, 
    params: { userName?: string; charName?: string; isDebug?: boolean; input?: string; original?: string; } = {}
): string {
    if (script.disabled === true || !script.findRegex || !rawString) return rawString;

    // Intercept/disable SillyTavern-specific thinking beautification scripts that break React state & DOM
    const isThinkingScript = 
        script.id === '3d2538e9-525b-4561-bf3a-2d009177f45f' || 
        script.id === 'c6b7140f-7fe7-44f9-957b-53df725e2dd1' ||
        (script.scriptName && (
            script.scriptName.includes('Làm đẹp Thinking') || 
            script.scriptName.includes('Dọn dẹp Thinking')
        ));
    if (isThinkingScript) {
        return rawString;
    }

    // Poor-man's ReDoS protection: Limit input string length
    if (rawString.length > 250000) {
        console.warn(`[Regex Safety] Skipping regex execution on extremely large input: ${script.scriptName}`);
        return rawString;
    }

    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const macros: Record<string, string> = {
        '{{user}}': params.userName || 'User',
        '{{char}}': params.charName || 'Character',
        '{{User}}': params.userName || 'User',
        '{{Char}}': params.charName || 'Character',
        '{{newline}}': '\n',
        '{{input}}': params.input || '',
        '{{original}}': params.original || rawString
    };

    const substituteParams = (text: string, escapeMode: number) => {
        if (!text) return text;
        
        let result = text;
        const replaceMacro = (macro: RegExp, value: string) => {
            let v = value || '';
            if (escapeMode === 2) v = escapeRegExp(v);
            result = result.replace(macro, v);
        };

        // case-insensitive match for macros
        replaceMacro(/\{\{\s*user\s*\}\}/gi, params.userName || 'User');
        replaceMacro(/\{\{\s*char\s*\}\}/gi, params.charName || 'Character');
        replaceMacro(/\{\{\s*newline\s*\}\}/gi, '\n');
        replaceMacro(/\{\{\s*input\s*\}\}/gi, params.input || '');
        replaceMacro(/\{\{\s*original\s*\}\}/gi, params.original || rawString);
        
        return result;
    };

    if (script.minActivationRegex) {
        const minActPattern = substituteParams(script.minActivationRegex, script.substituteRegex || 0);
        const extractedMin = extractFlags(minActPattern);
        
        if (extractedMin && isDangerousRegexPattern(extractedMin.regex) && rawString.length > 150) {
            console.warn(`[Regex ReDoS Prevention] Skipped minActivationRegex check in script "${script.scriptName || 'Unknown'}" because its pattern "${extractedMin.regex}" has potential catastrophic backtracking and input is long (${rawString.length} chars).`);
            return rawString;
        }

        const minRe = RegexProvider.instance.get(extractedMin.regex, extractedMin.flags);
        if (minRe && !minRe.test(rawString)) {
            return rawString;
        }
    }

    // In ST, substituteRegex = 1 means replace macros raw, 2 means escape them.
    // If 0, then NO macro substitution for findRegex, but replaceString still gets macros replaced natively by ST? 
    // Actually, in ST, substituteRegex applies to both `findRegex` and `replaceString`.
    const findRegexPattern = script.substituteRegex && script.substituteRegex > 0 
        ? substituteParams(script.findRegex, script.substituteRegex)
        : script.findRegex;
        
    const extracted = extractFlags(findRegexPattern);
    
    if (extracted && isDangerousRegexPattern(extracted.regex) && rawString.length > 150) {
        console.warn(`[Regex ReDoS Prevention] Skipped script "${script.scriptName || 'Unknown'}" execution because findRegex pattern "${extracted.regex}" has potential catastrophic backtracking and input is long (${rawString.length} chars).`);
        return rawString;
    }

    const re = RegexProvider.instance.get(extracted.regex, extracted.flags);
    
    if (!re) {
        if (params.isDebug) {
            console.error(`[Regex Error] Script "${script.scriptName || 'Unknown'}" failed to compile findRegex:`, findRegexPattern);
        }
        return rawString;
    }

    const trims = script.trimStrings || [];
    let replaceString = script.replaceString || '';
    
    // Custom Fenced block matching removed to avoid ST conflict
    
    // In ST, macro replacement happens for replaceString as well.
    if (script.substituteRegex && script.substituteRegex > 0) {
        replaceString = substituteParams(replaceString, script.substituteRegex);
    } else {
        // Fallback: If substituteRegex is 0, ST still natively replaces some predefined macros in replaceString
        // To be safe and compliant with ST's fallback, we just apply RAW substitution.
        replaceString = substituteParams(replaceString, 1);
    }
    
    replaceString = unescapeSafe(replaceString);

    try {
        return rawString.replace(re, (...args) => {
            const match = args[0];
            const isObject = (val: any) => val !== null && typeof val === 'object';
            const hasNamedGroups = args.length > 0 && isObject(args[args.length - 1]);
            const namedGroups = hasNamedGroups ? args[args.length - 1] : {};
            
            // Correct the calculation of number of captured groups
            // In JS, args are: match, p1, p2, ..., offset, string, [namedGroups]
            const numGroups = hasNamedGroups ? args.length - 4 : Math.max(0, args.length - 3);
            const groups = args.slice(1, 1 + numGroups);

            const filteredMatch = filterString(match, trims, macros);

            // Safer dynamic replacement that doesn't re-parse already replaced parts
            // Find $$ (escaped $), $& or {{match}}, $1 to $99, and $<name>
            const result = replaceString.replace(/\$\$|\$&|{{match}}|\$(\d{1,2})|\$<([^>]+)>/g, (m, gNum, gName) => {
                if (m === '$$') return '$';
                if (m === '$&' || m === '{{match}}') return filteredMatch;
                
                if (gNum) {
                    const idx = parseInt(gNum, 10) - 1;
                    if (idx >= 0 && idx < groups.length) {
                        const g = groups[idx];
                        return g !== undefined ? filterString(String(g), trims, macros) : '';
                    }
                    return m; // unchanged if group doesn't exist
                }
                
                if (gName) {
                    if (hasNamedGroups && namedGroups[gName] !== undefined) {
                        return filterString(String(namedGroups[gName]), trims, macros);
                    }
                    return m;
                }
                
                return m;
            });

            // If the result is a full HTML document or code block, or forceIframe option is enabled,
            // encode it strictly to base64 here to bypass the markdown pipeline and prevent template literals (`) from being corrupted
            if (script.forceIframe || /^```(?:html|javascript|js|jsx|react|ts|typescript)\b|\b<!DOCTYPE\s+html>/i.test(result)) {
                let code = result;
                // Strip markdown fences if present
                const blockMatch = result.match(/^```(?:html|javascript|js|jsx|react|ts|typescript)?\n([\s\S]*?)(?:```|$)/i);
                if (blockMatch) {
                    code = blockMatch[1];
                }
                
                try {
                    const base64 = safeUtf8ToBase64(code);
                    // We output a Document Content sandbox for safety, leveraging MarkdownRenderer's component directly
                    return `<regex-widget data-content="${base64}"></regex-widget>`;
                } catch(e) {
                    return result;
                }
            }

            return result;
        });
    } catch (e) {
        if (params.isDebug) console.error(`[Regex Error] in script "${script.scriptName}":`, e);
        return rawString;
    }
}

export function getRegexedString(
    rawString: string,
    placement: number,
    scripts: RegexScript[],
    params: {
        userName?: string;
        charName?: string;
        isMarkdown?: boolean;
        isPrompt?: boolean;
        isEdit?: boolean;
        depth?: number;
        isDebug?: boolean;
        renderPhaseOnly?: boolean;
        input?: string;
    } = {}
): string {
    if (!scripts || scripts.length === 0 || !rawString || typeof rawString !== 'string') return rawString;

    // Lọc trước các scripts áp dụng cho context hiện tại thay vì loop và check liên tục bên trong
    const applicableScripts = scripts.filter(script => {
        if (script.disabled === true) return false;
        
        if (script.placement && script.placement.length > 0) {
            const matchesPlacement = script.placement.includes(placement);
            // In ST, runOnEdit bypasses placement check when actually editing
            if (!matchesPlacement && !(params.isEdit && script.runOnEdit)) return false;
        }

        const markdownOnly = script.markdownOnly !== undefined ? script.markdownOnly : script.alterChatDisplay;
        const promptOnly = script.promptOnly !== undefined ? script.promptOnly : script.alterOutgoingPrompt;

        if (markdownOnly && !params.isMarkdown) return false;
        if (promptOnly && !params.isPrompt) return false;
        if (params.renderPhaseOnly && !markdownOnly) return false;
        if (params.isEdit && !script.runOnEdit) return false;
        
        if (typeof params.depth === 'number' && params.depth !== -1) {
            const min = script.minDepth !== null && script.minDepth !== undefined ? script.minDepth : 0;
            const max = script.maxDepth !== null && script.maxDepth !== undefined ? script.maxDepth : Infinity;
            if (params.depth < min || params.depth > max) return false;
        }
        return true;
    });

    if (applicableScripts.length === 0) return rawString;

    // Sắp xếp các kịch bản theo thứ tự "order" tăng dần để chạy đồng bộ chuẩn xác.
    // Nếu không có "order", giữ nguyên thứ tự ban đầu trong danh sách (stable sort).
    const sortedScripts = [...applicableScripts]
        .map((script, idx) => ({ script, originalIndex: idx }))
        .sort((a, b) => {
            const orderA = a.script.order !== undefined && a.script.order !== null ? a.script.order : 1000;
            const orderB = b.script.order !== undefined && b.script.order !== null ? b.script.order : 1000;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return a.originalIndex - b.originalIndex;
        })
        .map(item => item.script);

    // Hướng 2 - Commit vào React: Bảo vệ cấu trúc (thinking, choices, meow_FM, table_stored...) 
    // Khi chạy preset regex, chúng ta muốn preset chỉ beautify text thông thường, không phá hủy hoặc sửa đổi các thẻ structural.
    const blockTagsToProtect = [
      'thinking',
      'think',
      'thinhking',
      'thought',
      'thoughts',
      'meow_FM',
      'meow_fm',
      'table_stored',
      'tableEdit',
      'branches',
      'choices',
      'actions',
      'memory_table_guide',
      'user_input',
      'word_count',
      'set_time',
      'time_cost',
      'incrementalSummary',
      'finish',
      'OntologicalSeverance',
      'Co-AuthorshipGrant',
      'HypotheticalConstruct',
      'AxiomaticImmunity',
      'ExperimentalDrift',
      'HermeticSeal',
      'ResonancePurpose',
      'SovereignLogic'
    ];

    const wrapperTagsToProtect = [
      'content',
      'story'
    ];

    const protectedBlocks: Map<string, string> = new Map();
    let protectedString = rawString;
    let blockCounter = 0;

    blockTagsToProtect.forEach(tag => {
        const regex = new RegExp(`<${tag}\\s*>([\\s\\S]*?)(?:</${tag}\\s*>|$)`, 'gi');
        protectedString = protectedString.replace(regex, (match) => {
            const key = `__TAWA_BLOCK_PROTECTION_${tag}_${blockCounter++}__`;
            protectedBlocks.set(key, match);
            return key;
        });
    });

    const protectedWrappers: Map<string, string> = new Map();
    let wrapperCounter = 0;

    wrapperTagsToProtect.forEach(tag => {
        const openRegex = new RegExp(`<${tag}\\s*>`, 'gi');
        protectedString = protectedString.replace(openRegex, (match) => {
            const key = `__TAWA_WRAP_OPEN_${tag}_${wrapperCounter++}__`;
            protectedWrappers.set(key, match);
            return key;
        });

        const closeRegex = new RegExp(`</${tag}\\s*>`, 'gi');
        protectedString = protectedString.replace(closeRegex, (match) => {
            const key = `__TAWA_WRAP_CLOSE_${tag}_${wrapperCounter++}__`;
            protectedWrappers.set(key, match);
            return key;
        });
    });

    let finalString = protectedString;

    sortedScripts.forEach(script => {
        const preLength = finalString.length;
        finalString = runRegexScript(script, finalString, { ...params, original: rawString });
        if (params.isDebug && preLength !== finalString.length) {
            console.log(`[Regex Debug] Script "${script.scriptName}" changed length from ${preLength} to ${finalString.length}`);
        }
    });

    // Khôi phục các thẻ bọc (wrapper tags)
    protectedWrappers.forEach((val, key) => {
        finalString = finalString.split(key).join(val);
    });

    // Khôi phục các block cấu trúc (structural blocks)
    protectedBlocks.forEach((val, key) => {
        finalString = finalString.split(key).join(val);
    });

    return finalString;
}

export const applySTRegex = (
  text: string,
  scripts: RegexScript[],
  userName: string = 'User',
  charName: string = 'Character',
  placementTargets: number[] = [2],
  debug: boolean = false,
  messageDepth: number = -1
): string => {
   return getRegexedString(text, placementTargets[0] || 2, scripts, {
       userName, charName, isDebug: debug, depth: messageDepth, isMarkdown: placementTargets.includes(2)
   });
};
