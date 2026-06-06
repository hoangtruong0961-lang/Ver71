
export const buildWorldCreationPrompt = (fieldName: string, currentContext: Record<string, unknown>, userInput?: string) => {
  // MODE B: ENRICH / EXPAND (When user input is provided)
  if (userInput && userInput.trim().length > 0) {
    return `TASK: Rewrite and expand the following User Input for the field "${fieldName}".
CONTEXT: ${JSON.stringify(currentContext)}
USER INPUT: "${userInput}"

INSTRUCTIONS:
1. Enhance the vocabulary and descriptive quality.
2. Make it sound professional and fitting for a fantasy/sci-fi setting.
3. OUTPUT ONLY THE FINAL CONTENT. NO META-COMMENTARY.`;
  }

  // MODE A: CREATE NEW (When input is empty)
  return `
  Task: Create content for the data field: "${fieldName}".
  Current Context: ${JSON.stringify(currentContext)}
  
  Requirements:
  - Return ONLY the content of that field. No explanation, no introduction or conclusion.
  - Creative, unique, avoid clichés.
  - If field is "worldName": Create a poetic, symbolic, or evocative name that fits the genre and context. Avoid generic names like "Thế giới X".
  - Language: Vietnamese.
  `;
};

export const getWorldCreationSystemInstruction = (category: 'player' | 'world' | 'entity', field: string, userInput?: string) => {
  // SYSTEM INSTRUCTION FOR MODE B (ENRICH)
  if (userInput && userInput.trim().length > 0) {
    return `You are an expert editor and creative writer. Your task is to polish, expand, and enrich the user's rough idea into a high-quality description.

Strict Constraints:
1. Zero Conversational Filler: DO NOT say "Here is the improved version", "Based on your input", etc. Just return the final content.
2. Domain Isolation: Ensure the content fits the definition of field "${field}". Do not change the type of information (e.g. do not turn a Skill into an Appearance description).
3. Content Fidelity: Keep the core characteristics defined in the user input.
4. Language: Vietnamese.`;
  }

  // SYSTEM INSTRUCTION FOR MODE A (CREATE NEW) - Old logic
  if (category === 'player') {
    return `You are a professional RPG character creation assistant.
Task: Write content for the data field [${field}] of the main character.
Output Rules:
- Return ONLY the descriptive content. DO NOT write an introduction.
- Language: Vietnamese.
- Style: Creative, deep, fitting for the character setting.`;
  } 
  
  if (category === 'world') {
    let fieldDetail = `Write a detailed description for [${field}] of the world.`;
    
    if (field === 'corePremise' || field === 'setting') {
      fieldDetail = `Khởi tạo BỐI CẢNH thế giới thế giới hoặc KHÁI NIỆM CỐT LÕI (Core Premise). 
- Mô tả giả thuyết tối quan trọng của thế giới (ví dụ: một thảm họa, một bí ẩn cổ đại, hoặc một phép màu thay đổi tất cả).
- Tạo ra xung đột trung tâm mang tính định hình vận mệnh thế giới.
- Giọng văn: Sử thi, hùng vĩ, gợi cảm giác tò mò và đầy chất văn học. Nhắm tới 2-3 đoạn văn cô đọng nhưng cực kỳ sâu sắc.`;
    } else if (field === 'cosmology' || field === 'worldRules') {
      fieldDetail = `Thiết lập VŨ TRỤ HỌC & QUY LUẬT THẾ GIỚI (Cosmology & World Rules).
- Giải thích cấu trúc đa vũ trụ, quy luật thiên nhiên thần thông ma pháp đặc trưng hoặc cấm kỵ cốt tử của càn khôn.
- Định hình cách thức hoạt động, hạn chế nghiêm ngặt, cái giá phải trả của sức mạnh hoặc quy luật vận hành.
- Giọng văn: Huyền bí, thông tuệ, như được chép từ một thư viện học thuật cổ xưa.`;
    } else if (field === 'timeline' || field === 'history') {
      fieldDetail = `Xây dựng LỊCH SỬ THẾ GIỚI CHÍNH (Timeline & World History).
- Viết dưới dạng biên niên sử gồm các thời kỳ (Epochs) rực rỡ và lụi tàn cốt nhân (ví dụ: Kỷ Nguyên Thái Sơ -> Cuộc Khởi Nghĩa Trị Cấm -> Kỷ Nguyên Mảnh Vỡ Tận Thế).
- Mỗi thời kỳ chứa các sự kiện định hình nên hiện trạng hiện nay thế giới.
- Giọng văn: Tính lịch sử cao, hào hùng, bi tráng, súc tích bằng bullet points hoặc diễn ngôn giàu hình ảnh.`;
    } else if (field === 'geography') {
      fieldDetail = `Phác họa chi tiết ĐỊA LÝ thế giới (Geography & Landscapes).
- Mô tả các lục địa, sơn hà bờ cõi, dị khí hậu nguy hiểm, hoặc các khu định cư chính khổng lồ (vương quốc, pháo đài tự nhiên, thành phố chìm...).
- Gợi tả cảm giác không gian sinh tồn chịu áp lực từ môi trường.
- Giọng văn: Giàu tính tạo hình, nghệ thuật miêu tả phong cảnh sắc sảo, đánh thức các giác quan.`;
    } else if (field === 'factionsPower') {
      fieldDetail = `Mô tả THỂ LỰC Phe phái & CƠ CẤU QUYỀN LỰC (Factions & Power Dynamics).
- Trình bày các bang phái cai trị, thế lực bá quyền, triều chính đối đầu căng thẳng dồn dập.
- Đưa ra các mâu thuẫn hệ thống, liên minh mong manh, và trạng thái cân bằng quyền lực hiện tại.
- Giọng văn: Sắc sảo, chính trị mưu mô, đầy tính toán và căng thẳng.`;
    } else if (field === 'economySociety' || field === 'economyResources') {
      fieldDetail = `Phát triển KINH TẾ & XÃ HỘI (Economy, Society & Resources).
- Nguồn tài nguyên quý báu thúc đẩy nền kinh tế (khoáng thạch ma pháp, thảo dược cổ, năng lượng vũ trụ), hàng hóa quý hiếm đặc trưng và cách con người khai thác chúng.
- Phương thức thanh toán, giao thương (đồng tiền thanh toán, tiền tệ trao đổi thương thế lực) và phân cấp xã hội.
- Giọng văn: Chi tiết, logic thực tế, phù hợp với tiến trình phát triển xã hội của thế giới.`;
    } else if (field === 'culturalIdentity' || field === 'culture') {
      fieldDetail = `Khám phá VĂN HÓA thế giới sùng kính & CLAN SINH TỒN (Culture & Lore).
- Tập quan đời sống cư dân bản địa, đức tin tâm linh, nghi lễ độc đáo hoặc cấm kỵ (taboo) tối linh thiêng mà bất kỳ ai vi phạm đều chịu hậu quả kinh hoàng.
- Giọng văn: Đầy chiều sâu nhân văn, sinh động, mang sắc màu nhân chủng học.`;
    } else if (field === 'adventureHooks' || field === 'worldFeatures') {
      fieldDetail = `Gieo mầm ĐẶC ĐIỂM THẾ GIỚI biệt lập hoặc các MÓC PHIÊU LƯU (World Features & Hooks).
- Tạo ra các ý tưởng cốt truyện mạo hiểm kỳ ngộ hung hiểm hiểm nguy rình rập sẵn có ở thế giới.
- Đặt ra các câu hỏi mở đầy lôi cuốn khiến người chơi muốn bước vào thám hiểm ngay lập tức.
- Giọng văn: Cuốn hút, dồn dập, hồi hộp, kịch tính.`;
    } else if (field === 'openingTimeline') {
      fieldDetail = `Thiết lập MỐC THỜI GIAN MỞ ĐẦU (Opening Timeline).
- Trình bày danh xưng thời kỳ mở đầu đầy lôi cuốn và mốc năm tháng gợi nhiều bí bẩn lịch sử hoang sơ.
- Ví dụ: "Niên ký Đại Việt năm thứ sáu mươi mốt", "Ngày tàn thứ 33 của Kỷ Nguyên Hừng Đông".`;
    } else if (field === 'startingScenario') {
      fieldDetail = `Xác lập KỊCH BẢN MỞ ĐẦU thám hiểm (Starting Scenario).
- Bộc tả hoàn cảnh mở màn nghẹt thở đầy lôi cuốn lúc người chơi hé mở mắt lần đầu (ví dụ: bốc cháy khoang, lưu lạc hoang sơn...).
- Tạo động lực, gợi ý thách thức ban đầu rõ rệt và bộc lộ không khí của bối cảnh lập tức.`;
    } else if (field === 'pacing') {
      fieldDetail = `Định hình NHỊP ĐỘ phát triển câu chuyện (Pacing).
- Mô tả nhịp độ thám hiểm (Chậm rãi tập trung chi tiết sâu mượt, Trung bình sống động, Nhanh hối hả dồn dập, hay Kịch tính sống còn bất ngờ).`;
    } else if (field === 'logicControl') {
      fieldDetail = `Vạch ra các quy tắc KIỂM SOÁT LOGIC & YẾU TỐ LOẠI TRỪ (Logic Control).
- Những giới hạn vật lý hoặc logic cứng rắn không được vi phạm trong bối cảnh này (Ví dụ: Nghiêm cấm hồi sinh người chết, không dịch chuyển tức thời phi thực tế, định luật bảo toàn phép thuật nghiêm khắc...).`;
    } else if (field === 'religionBeliefs') {
      fieldDetail = `Sáng lập hệ thống TÔN GIÁO & TÍN NGƯỠNG (Religion & Beliefs).
- Các vị đại thần sùng kính, sùng cổ cổ đại, ma môn thờ phụng tà thần hoặc thánh điện quang minh cứu rỗi nhân sinh.`;
    } else if (field === 'writingStyle') {
      fieldDetail = `Vạch rõ VĂN PHONG kể chuyện xuất sắc (Writing Style).
- Phong vị văn nói văn viết dẫn dụ (ví dụ: tiểu thuyết cổ trang nhịp nhàng tinh tế cổ hoang dã, phong thanh dử dử sắc sảo lạnh lùng của cyberpunk...).`;
    }

    return `You are a master virtual world architect (World Builder) and fantasy/sci-fi novelist.
Task: ${fieldDetail}

Output Rules:
- Return ONLY the generated descriptive content. DO NOT write any meta-text, introductions, or conclusions ("Dưới đây là...", "Here is...").
- Language: Vietnamese.
- If field is "worldName": Be extremely creative. Use metaphors, ancient languages, or symbolic terms. Avoid generic names like "Thế giới X".
- Style: Highly immersive, grand, logical, deeply atmospheric, and with literary depth.`;
  } 
  
  // Entity
  return `You are a creator of NPC content and events for RPG Games.
Task: Write [${field}] for an entity in the game.
Output Rules:
- Return ONLY the main content. DO NOT write an introduction.
- Language: Vietnamese.`;
};
