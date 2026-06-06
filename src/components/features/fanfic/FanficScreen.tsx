import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Sparkles, Play, Sliders, User, Users, Compass, 
  MapPin, Flame, ScrollText, Check, ChevronRight, Wand2, Search,
  RefreshCw, Clock, Sparkle, AlertCircle, Database, Upload, CheckCircle2
} from 'lucide-react';
import { NavigationProps, GameState, WorldData, AppSettings, PlayerProfile, Entity } from '../../../types';
import { toast } from 'sonner';
import Button from '../../ui/Button';
import { useWorldCreationStore } from '../../../store/worldCreationStore';
import { fanficAiService, FanficCharacter } from '../../../services/ai/fanfic/service';
import { worldAiService } from '../../../services/ai/world-creation/service';
import { dbService } from '../../../services/db/indexedDB';

interface FanficScreenProps extends NavigationProps {
  onGameStart?: (data: WorldData) => void;
  initialData?: WorldData | null;
}

const PRESET_IPS = [
  { name: "Harry Potter", desc: "Thế giới phép thuật Hogwarts, đũa phép và những bí ẩn ma thuật hắc ám." },
  { name: "Đấu Phá Thương Khung", desc: "Đế quốc Gia Mã, tu luyện Đấu Khí, Dị Hỏa bùng cháy và hẹn ước ba năm." },
  { name: "Naruto", desc: "Thế giới nhẫn giả ngũ đại cường quốc, nhẫn thuật, chakra và vĩ thú." },
  { name: "Tây Du Ký", desc: "Đông Thổ Đại Đường, hành trình thỉnh kinh cứu độ chúng sinh qua 81 kiếp nạn." },
  { name: "Genshin Impact", desc: "Lục địa Teyvat, sự dẫn dắt của bảy vị Thần và hành trình đi tìm người thân." },
  { name: "Marvel Cinematic Universe", desc: "Thế giới siêu anh hùng, thực tại đa vũ trụ và những viên đá vô cực." }
];

const getPresetPlayerForIP = (ipName: string): Partial<PlayerProfile> => {
  const norm = (ipName || "").toLowerCase();
  if (norm.includes("harry potter")) {
    return {
      name: "Edward Evans",
      gender: "Nam",
      age: "11",
      personality: "Hiếu kỳ, quả cảm, thông minh và có xu hướng hướng nội.",
      background: "Một phù thủy gốc Muggle mới nhận được thư nhập học Hogwarts từ con cú tuyết.",
      appearance: "Áo choàng đen Hogwarts, tóc màu nâu nhạt hạt dẻ, tay cầm đũa phép gỗ sồi gai.",
      voiceAndTone: "Lịch sự, tự tin, hiếu học.",
      skills: "Có tài về môn Độc dược và Ma thuật Phòng chống Nghệ thuật Hắc ám.",
      goal: "Học hỏi vạn tượng tri thức Hogwarts, trở thành Đại Phù Thủy thám hiểm vũ trụ ma thuật."
    };
  }
  if (norm.includes("naruto")) {
    return {
      name: "Takahara Ken",
      gender: "Nam",
      age: "12",
      personality: "Nhiệt huyết, kiên trì, hào sảng và trân trọng tình bạn.",
      background: "Học viên mới tốt nghiệp học viện Ninja làng Lá (Konohagakure).",
      appearance: "Băng bảo vệ trán Làng Lá, quần áo ninja gọn gàng màu lam xám, tay quấn băng vải trắng.",
      voiceAndTone: "Mạnh mẽ, ấm áp, thẳng thắn.",
      skills: "Sử dụng Phi tiêu kunai nhuần nhuyễn, chakra thuộc tính Phong và nhẫn thuật phân thân hoàn hảo.",
      goal: "Bảo vệ gia đình, rèn luyện nhẫn đạo độc tôn, trở thành một Jounin vĩ đại."
    };
  }
  if (norm.includes("đấu phá") || norm.includes("đấu khí")) {
    return {
      name: "Tiêu Vũ",
      gender: "Nam",
      age: "16",
      personality: "Ý chí kiên định, bình tĩnh trước nghịch cảnh, thấu hiểu nhân tình thế thái.",
      background: "Một đệ tử chi hệ của Tiêu Gia, bắt đầu con đường ngưng tụ Đấu Khí đan điền.",
      appearance: "Y phục gọn gàng màu xám xanh, vóc dáng cân đối săn chắc, ánh mắt sắc sảo.",
      voiceAndTone: "Khiêm tốn nhưng đanh thép, quả quyết.",
      skills: "Bộ pháp linh hoạt, Đấu khí thuộc tính Hỏa dồi dào, có thiên phú thấu lĩnh hỏa hồn.",
      goal: "Tìm kiếm Dị Hỏa càn khôn, đột phá ngưng tụ Đấu Giả, bước lên đỉnh phong của Đấu Khí Đại Lục."
    };
  }
  if (norm.includes("genshin")) {
    return {
      name: "Avery",
      gender: "Nam",
      age: "18",
      personality: "Yêu thích thám hiểm, hòa đồng, nhạy cảm với các nguyên tố thế giới.",
      background: "Một mạo hiểm giả đến từ tổ chức Hiệp Hội Mạo Hiểm Giả Mondstadt.",
      appearance: "Trang phục dã ngoại phong cách gió tự do, sau lưng đeo một thanh kiếm rèn rỉ sét cổ, mang huy hiệu Mondstadt.",
      voiceAndTone: "Cởi mở, hài hước, luôn tràn trề hứng thú phiêu lưu.",
      skills: "Kiếm thuật một tay linh hoạt, khả năng tương tác với nguyên tố Phong của Phong Thần.",
      goal: "Đi qua khắp bảy quốc gia Teyvat, ghi chép mọi bối cảnh và thăng tiến cấp bậc mạo hiểm giả."
    };
  }
  if (norm.includes("marvel")) {
    return {
      name: "Luke Stark",
      gender: "Nam",
      age: "19",
      personality: "Hơi ngạo nghễ, đam mê công nghệ, tư duy logic của nhà phát minh khoa học.",
      background: "Một kỹ sư trẻ xuất sắc thực tập tại tập đoàn Stark Industries, mang siêu trí tuệ bẩm sinh.",
      appearance: "Kính thông minh hologram, áo khoác thể thao trẻ trung, tay đeo vòng điều khiển robot mini tự chế.",
      voiceAndTone: "Hơi dí dỏm châm biếm, tốc độ nói nhanh và trực quan đại khái.",
      skills: "Lập trình AI siêu việt, thiết kế cơ khí chính xác, am hiểu vật lý lượng tử.",
      goal: "Chế tạo bộ giáp cá nhân tối tân bảo vệ hòa bình trái đất chống lại các hiểm họa đa vũ trụ."
    };
  }
  if (norm.includes("tây du")) {
    return {
      name: "Ngộ Không Đệ Tử",
      gender: "Nam",
      age: "24",
      personality: "Ngộ đạo chính nghĩa, bất khuất, căm ghét tà ma yêu quái.",
      background: "Một tiểu hành giả học đạo tu luyện từ Linh Đài Phương Thốn Sơn của Bồ Đề Tổ Sư.",
      appearance: "Đeo vòng kim cô gỗ giản dị, khoác áo nâu sồng, tay cầm một thanh trượng gỗ bách phong trần.",
      voiceAndTone: "Cung kính lễ phép nhưng đầy hào kiệt khí phách.",
      skills: "Địa sát thuật biến hóa cơ bản, nhãn lực nhìn thấu chướng khí yêu quái.",
      goal: "Theo chân hành trình thỉnh kinh trừ ma diệt bạo, tầm đạo chân chính cứu nhân tinh."
    };
  }
  
  // Generic Fallback (NOT a Wuxia/Xianxia character!)
  return {
    name: "Lâm Phong",
    gender: "Nam",
    age: "18",
    personality: "Kiên cường, bình tĩnh, ham học hỏi và giỏi thích ứng.",
    background: "Một người thám hiểm xuyên du qua vô vàn kịch bản thế giới giả tưởng.",
    appearance: "Bộ đồ du hành gọn gàng màu xám than, đeo balo đa năng, đôi mắt sáng thông tuệ.",
    voiceAndTone: "Biết lắng nghe, ôn hòa nhưng khi cần thì cực kỳ dứt khoát.",
    skills: "Khả năng phân tích quy tắc thế giới cực nhanh, thể chất dẻo dai linh động.",
    goal: "Khám phá mọi ngõ ngách bối cảnh của câu chuyện hiện tại và tìm ra chân lý lịch sử."
  };
};

export const FanficScreen: React.FC<FanficScreenProps> = ({ onNavigate, onGameStart, initialData }) => {
  const store = useWorldCreationStore();
  const state = {
    player: store.player,
    world: store.world,
    config: store.config,
    entities: store.entities,
    gameTime: store.gameTime,
  };

  // State Management
  const [originalWorkName, setOriginalWorkName] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [aiModel, setAiModel] = useState<string>('gemini-2.5-pro');
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Workflow states
  const [step, setStep] = useState<'INPUT' | 'LOADING' | 'SANDBOX_SELECT'>('INPUT');
  const [loadingText, setLoadingText] = useState('Đang khởi tạo bối cảnh đồng nhân...');
  
  // Sandbox setup responses
  interface SandboxSetup {
    scenarios: Array<{ id: string; title: string; description: string; startingYear: number; worldContext: string }>;
    characters: FanficCharacter[];
    worldGenre: string;
    worldTheme: string;
  }
  const [sandboxSetup, setSandboxSetup] = useState<SandboxSetup | null>(null);
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);
  const [roleplayMode, setRoleplayMode] = useState<'EXISTING' | 'CUSTOM'>('EXISTING');
  const [selectedCharName, setSelectedCharName] = useState<string>('');
  
  const [customPlayer, setCustomPlayer] = useState<Partial<PlayerProfile>>(() => getPresetPlayerForIP(""));

  const [searchCharTerm, setSearchCharTerm] = useState('');
  const [bgImage, setBgImage] = useState<string | null>(null);

  // AI Gen Knowledge RAG state
  const [showRagPanel, setShowRagPanel] = useState(false);
  const [ragJsonFile, setRagJsonFile] = useState<File | null>(null);
  const [ragContentText, setRagContentText] = useState<string>('');
  const [ragStoryName, setRagStoryName] = useState<string>('');
  const [ragChunksLoaded, setRagChunksLoaded] = useState<number>(0);
  const ragInputRef = useRef<HTMLInputElement>(null);

  // Timeline states for Strategy 3 RAG
  interface TimelineEventItem {
    id: string;
    title: string;
    period: string;
    description: string;
  }
  const [timelineEvents, setTimelineEvents] = useState<TimelineEventItem[]>([]);
  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState<string | null>(null);
  const [isExtractingTimeline, setIsExtractingTimeline] = useState<boolean>(false);
  
  // RAG Mode Character Selection States (Strategy 3)
  const [ragRoleplayMode, setRagRoleplayMode] = useState<'EXISTING' | 'CUSTOM'>('EXISTING');
  const [ragCharacters, setRagCharacters] = useState<FanficCharacter[]>([]);
  const [selectedRagCharName, setSelectedRagCharName] = useState<string>('');
  const [searchRagCharTerm, setSearchRagCharTerm] = useState('');
  const [isExtractingRagChars, setIsExtractingRagChars] = useState(false);
  
  // Custom OC state for Strategy 3
  const [ragCustomPlayer, setRagCustomPlayer] = useState<Partial<PlayerProfile>>({
    name: '',
    gender: 'Nam',
    age: '18',
    personality: '',
    background: '',
    appearance: '',
    skills: '',
    goal: '',
    voiceAndTone: 'Chậm rãi, chín chắn'
  });
  const [ocPromptPrefix, setOcPromptPrefix] = useState<string>(''); // brief idea of OC
  const [isGeneratingOc, setIsGeneratingOc] = useState<boolean>(false);

  // Extra function to handle canonical characters extraction in Strategy 3
  const handleExtractRagCharacters = async () => {
    if (!ragContentText.trim()) {
      toast.error("Vui lòng tải tệp tin Tri thức JSON hợp lệ trước!");
      return;
    }
    setIsExtractingRagChars(true);
    try {
      const extracted = await worldAiService.extractCharactersFromKnowledge(
        ragContentText,
        originalWorkName || "Tác phẩm đồng nhân",
        aiModel,
        settings || undefined
      );

      if (extracted && extracted.length > 0) {
        setRagCharacters(extracted);
        setSelectedRagCharName(extracted[0].name);
        toast.success(`Đã trích xuất thành công ${extracted.length} nhân vật từ tệp tri thức!`);
      } else {
        toast.error("Không thể trích xuất nhân vật nào từ tệp tri thức. Hãy thử tạo nhân vật OC.");
      }
    } catch (err: any) {
      toast.error("Lỗi trích xuất nhân vật: " + err.message);
    } finally {
      setIsExtractingRagChars(false);
    }
  };

  // Helper function to handle OC character generation in Strategy 3
  const handleGenerateOcCharacter = async () => {
    if (!ragContentText.trim()) {
      toast.error("Vui lòng tải tệp tin Tri thức JSON hợp lệ trước!");
      return;
    }
    if (!ocPromptPrefix.trim()) {
      toast.error("Vui lòng nhập vài từ gợi ý ý tưởng cho nhân vật OC!");
      return;
    }
    setIsGeneratingOc(true);
    try {
      const generated = await worldAiService.generateOcCharacterFromKnowledge(
        ragContentText,
        ocPromptPrefix,
        aiModel,
        settings || undefined
      );

      if (generated && generated.name) {
        setRagCustomPlayer({
          name: generated.name || '',
          gender: generated.gender || 'Nam',
          age: generated.age || '18',
          personality: generated.personality || '',
          background: generated.background || '',
          appearance: generated.appearance || '',
          skills: generated.skills || '',
          goal: generated.goal || '',
          voiceAndTone: generated.voiceAndTone || 'Lạnh lùng, quả quyết'
        });
        toast.success("AI đã phác họa xong hồ sơ nhân vật OC! Bạn có thể chỉnh sửa lại các thông tin.");
      } else {
        toast.error("Sắp xếp ý tưởng thất bại, thử lại với mô tả rõ ràng hơn.");
      }
    } catch (err: any) {
      toast.error("Lỗi sinh nhân vật OC: " + err.message);
    } finally {
      setIsGeneratingOc(false);
    }
  };
  
  // Timeline event edit / add form state
  const [editingTimelineId, setEditingTimelineId] = useState<string | null>(null);
  const [editTimelineTitle, setEditTimelineTitle] = useState('');
  const [editTimelinePeriod, setEditTimelinePeriod] = useState('');
  const [editTimelineDesc, setEditTimelineDesc] = useState('');
  const [showAddTimelineForm, setShowAddTimelineForm] = useState(false);
  const [newTimelineTitle, setNewTimelineTitle] = useState('');
  const [newTimelinePeriod, setNewTimelinePeriod] = useState('');
  const [newTimelineDesc, setNewTimelineDesc] = useState('');

  // Load configuration
  useEffect(() => {
    dbService.getSettings().then(s => {
      setSettings(s);
      if (s?.aiModel) setAiModel(s.aiModel);
    });

    dbService.getAsset('ark_v2_custom_bg').then(savedBg => {
      if (savedBg) {
        setBgImage(savedBg);
      }
    });

    if (initialData) {
      store.importData(initialData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  // Loading animation simulation logs
  useEffect(() => {
    if (step !== 'LOADING') return;
    const phrases = [
      "Đang tra cứu dữ liệu gốc bằng Google Search...",
      "Đang thiết lập biên niên ký lịch sử thế giới...",
      "Đang cấu trúc các mốc sự kiện (Timeline) bắt đầu...",
      "Đang trích xuất danh sách nhân vật vạn tượng tôn sư...",
      "Đang chuẩn bị bản đồ bối cảnh và quy tắc quy luật...",
      "Đang đồng bộ hóa không gian sandbox riêng biệt cho bạn..."
    ];
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setLoadingText(phrases[count % phrases.length]);
    }, 4500);
    return () => clearInterval(interval);
  }, [step]);

  // Handle preset clicks
  const selectPreset = (name: string) => {
    setOriginalWorkName(name);
    setCustomPlayer(getPresetPlayerForIP(name));
    toast.success(`Đã chọn IPpreset: ${name}`);
  };

  // Option 1: Sandbox Flow Start
  const handleSandboxStart = async () => {
    if (!originalWorkName.trim()) {
      toast.error("Vui lòng nhập tên tác phẩm IP gốc trước!");
      return;
    }

    setStep('LOADING');
    setLoadingText("Đang phân tích tác phẩm và tạo các mốc kịch bản...");
    try {
      const data = await fanficAiService.generateSandboxSetup(originalWorkName, additionalContext, settings || undefined);
      setSandboxSetup(data);
      if (data.characters && data.characters.length > 0) {
        setSelectedCharName(data.characters[0].name);
      }
      setStep('SANDBOX_SELECT');
      toast.success("Khởi hành Sandbox thành công! Hãy chọn kịch bản và vai diễn.");
    } catch (error: any) {
      toast.error("Sáng tạo Sandbox thất bại: " + error.message);
      setStep('INPUT');
    }
  };

  // Option 2: Fill All Flow Start
  const handleFillAllStart = async () => {
    if (!originalWorkName.trim()) {
      toast.error("Vui lòng nhập tên tác phẩm IP gốc trước!");
      return;
    }

    setStep('LOADING');
    setLoadingText("Đang tổng hợp lập bảng và nạp toàn bộ cấu trúc sang World Creator...");
    try {
      let concept = `Đồng nhân của tác phẩm: ${originalWorkName}`;
      if (additionalContext.trim()) {
        concept += `\n\nYêu cầu bổ sung của độc giả:\n${additionalContext}`;
      }

      const data = await worldAiService.generateFullWorld(concept, aiModel, settings || undefined);
      
      // Auto fill data into world creations store
      store.autoFillAll(data, true);
      
      toast.success("Đã nạp toàn bộ dữ liệu thế giới thành công! Đang chuyển sang World Creator...");
      onNavigate(GameState.WORLD_CREATION);
    } catch (error: any) {
      toast.error("Sáng tạo thế giới thất bại: " + error.message);
      setStep('INPUT');
    }
  };

  // Option 3: AI Gen Knowledge RAG
  const handleRagJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setRagJsonFile(file);
      setTimelineEvents([]);
      setSelectedTimelineEventId(null);
      try {
        const text = await file.text();
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch (jsonErr: any) {
          // Fallback if the user uploaded a plain text file renamed as .json or raw txt
          console.warn("JSON parse failed, treating as raw text string", jsonErr);
          setRagContentText(text);
          const detectedStory = file.name.replace(/\.[^/.]+$/, "").replace('Knowledge_', '');
          setRagStoryName(detectedStory);
          setRagChunksLoaded(1);
          if (!originalWorkName) {
            setOriginalWorkName(detectedStory);
          }
          toast.success("Nạp tri thức dạng thản văn (text) thành công!");
          return;
        }

        let chunksArray: any[] = [];
        if (Array.isArray(parsed)) {
          chunksArray = parsed;
        } else if (parsed && typeof parsed === 'object') {
          // Look for common array keys
          const keys = ['chunks', 'data', 'vectors', 'embeddings', 'knowledge', 'entries', 'items'];
          const foundKey = keys.find(k => Array.isArray(parsed[k]));
          if (foundKey) {
            chunksArray = parsed[foundKey];
            toast.info(`Phát hiện cấu trúc '${foundKey}' chứa danh sách phân đoạn.`);
          } else {
            // Treat the whole object as a single chunk
            chunksArray = [parsed];
          }
        }

        // Extract text safely from the chunks array
        const texts = chunksArray.map((item: any) => {
          if (!item) return '';
          if (typeof item === 'string') return item;
          if (typeof item === 'object') {
            return item.text || item.content || item.value || item.entry || item.description || JSON.stringify(item);
          }
          return String(item);
        }).filter(Boolean);

        if (texts.length === 0) {
          toast.error("Tệp JSON không chứa các phân mảnh văn bản tri thức học.");
          return;
        }

        const combined = texts.join('\n\n');
        setRagContentText(combined);

        // Determine story name
        let detectedStory = '';
        const firstItem = chunksArray[0];
        if (firstItem && typeof firstItem === 'object') {
          detectedStory = firstItem.meta?.story || firstItem.story || firstItem.name || '';
        }
        if (!detectedStory && parsed && typeof parsed === 'object') {
          detectedStory = parsed.story || parsed.name || '';
        }
        if (!detectedStory) {
          detectedStory = file.name.replace('Knowledge_', '').replace('.json', '').replace(/_\d+$/, '');
        }

        setRagStoryName(detectedStory);
        setRagChunksLoaded(chunksArray.length);

        if (!originalWorkName) {
          setOriginalWorkName(detectedStory);
        }
        toast.success(`Nạp tri thức thành công: ${chunksArray.length} phân đoạn!`);
      } catch (err: any) {
        toast.error("Lỗi xử lý tệp: " + err.message);
      }
    }
  };

  const handleExtractTimeline = async () => {
    if (!ragContentText.trim()) {
      toast.error("Vui lòng tải tệp tin Tri thức JSON hợp lệ trước!");
      return;
    }
    setIsExtractingTimeline(true);
    try {
      const extracted = await worldAiService.extractTimelineFromKnowledge(
        ragContentText,
        originalWorkName || "Tác phẩm đồng nhân",
        aiModel,
        settings || undefined
      );

      if (extracted && extracted.length > 0) {
        const mapped = extracted.map((ev, idx) => ({
          id: `timeline-ev-${idx}-${Date.now()}`,
          title: ev.title,
          period: ev.period,
          description: ev.description
        }));
        setTimelineEvents(mapped);
        setSelectedTimelineEventId(mapped[0].id);
        toast.success(`Đã trích xuất thành công ${mapped.length} mốc sự kiện từ RAG!`);
      } else {
        toast.error("Không thể trích xuất mốc nào. Hãy thử lại hoặc tự thêm mốc.");
      }
    } catch (err: any) {
      toast.error("Lỗi trích xuất timeline: " + err.message);
    } finally {
      setIsExtractingTimeline(false);
    }
  };

  const handleAddTimeline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTimelineTitle.trim() || !newTimelineDesc.trim()) {
      toast.error("Vui lòng nhập tên mốc và tóm tắt diễn biến!");
      return;
    }
    const newItem: TimelineEventItem = {
      id: `timeline-ev-custom-${Date.now()}`,
      title: newTimelineTitle.trim(),
      period: newTimelinePeriod.trim() || "Chưa rõ thời kỳ",
      description: newTimelineDesc.trim()
    };
    const updated = [...timelineEvents, newItem];
    setTimelineEvents(updated);
    if (!selectedTimelineEventId) {
      setSelectedTimelineEventId(newItem.id);
    }
    setNewTimelineTitle('');
    setNewTimelinePeriod('');
    setNewTimelineDesc('');
    setShowAddTimelineForm(false);
    toast.success("Đã thêm mốc sự kiện mới!");
  };

  const handleSaveEditTimeline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTimelineTitle.trim() || !editTimelineDesc.trim()) {
      toast.error("Vui lòng nhập tên mốc và tóm tắt diễn biến!");
      return;
    }
    setTimelineEvents(prev => prev.map(ev => {
      if (ev.id === editingTimelineId) {
        return {
          ...ev,
          title: editTimelineTitle.trim(),
          period: editTimelinePeriod.trim() || "Chưa rõ thời kỳ",
          description: editTimelineDesc.trim()
        };
      }
      return ev;
    }));
    setEditingTimelineId(null);
    toast.success("Đã cập nhật mốc sự kiện!");
  };

  const handleDeleteTimeline = (id: string) => {
    const filtered = timelineEvents.filter(ev => ev.id !== id);
    setTimelineEvents(filtered);
    if (selectedTimelineEventId === id) {
      setSelectedTimelineEventId(filtered.length > 0 ? filtered[0].id : null);
    }
    toast.info("Đã xóa mốc sự kiện.");
  };

  const handleRagCreationStart = async () => {
    if (!ragContentText.trim()) {
      toast.error("Vui lòng tải tệp tin Tri thức JSON hợp lệ trước!");
      return;
    }

    if (ragRoleplayMode === 'EXISTING' && !selectedRagCharName) {
      if (ragCharacters.length === 0) {
        toast.error("Hãy bấm nút 'Trích xuất nhân vật gốc' để chọn nhân vật, hoặc chuyển sang tự tạo OC!");
        return;
      }
      toast.error("Vui lòng chọn một nhân vật từ danh sách!");
      return;
    }

    if (ragRoleplayMode === 'CUSTOM' && !ragCustomPlayer.name?.trim()) {
      toast.error("Vui lòng nhập tên cho nhân vật OC của bạn!");
      return;
    }

    setStep('LOADING');
    setLoadingText("Đang phân tích tri thức và tạo lập thế giới đồng nhân nguyên bản...");

    try {
      let concept = `Đồng nhân của tác phẩm dựa trên Tệp Tri Thức đặc thù.\n`;
      if (originalWorkName.trim()) {
        concept += `Tên IP gốc: ${originalWorkName}\n`;
      }
      if (additionalContext.trim()) {
        concept += `Mong muốn tùy chỉnh bổ sung của người chơi:\n${additionalContext}\n`;
      }

      // Inject timeline events if present
      if (timelineEvents.length > 0) {
        concept += `\n--- CHUỖI SỰ KIỆN BIÊN NIÊN SỬ TUYẾN TÍNH NGUYÊN TÁC (CHOSEN TIMELINE) ---\n`;
        timelineEvents.forEach((ev, idx) => {
          const isActive = ev.id === selectedTimelineEventId;
          concept += `Mốc ${idx + 1}: ${ev.title} (${ev.period}) ${isActive ? '*(ĐÂY LÀ MỐC KHỞI ĐẦU CHƠI)*' : ''}\n   Diễn biến nguyên tác: ${ev.description}\n`;
        });

        const activeIndex = timelineEvents.findIndex(ev => ev.id === selectedTimelineEventId);
        const activeEv = timelineEvents[activeIndex];
        const nextEv = activeIndex < timelineEvents.length - 1 ? timelineEvents[activeIndex + 1] : null;

        concept += `\nQUY TẮC PHÁT TRIỂN TUYẾN TÍNH (CRITICAL TIMELINE LAW):\n`;
        concept += `1. Trò chơi TUYỆT ĐỐI BẮT ĐẦU từ mốc: "${activeEv?.title}" (${activeEv?.period}).\n`;
        if (nextEv) {
          concept += `2. Tiến trình truyện PHẢI phát hành tuần tự và tuy chỉ dẫn dẫn về mốc tiếp theo: "${nextEv.title}" (${nextEv.period}). Cấm tự ý đốt cháy giai đoạn hoặc chế diễn biến của mốc tương lai một cách vô lý, phớt lờ mốc nguyên tác trung gian.\n`;
        }
        concept += `3. Các quy luật thiên địa, phe phái NPC, kịch bản mở đầu phải chuẩn chỉ với bối cảnh mốc xuất phát này.\n`;
      }

      concept += `\n--- CORE KNOWLEDGE RETRIEVED (RAG DATA) ---\n`;
      // Take up to 120,000 words to avoid exceeding LLM context length gracefully, allowing whole file details
      const words = ragContentText.split(/\s+/);
      const slicedWords = words.slice(0, 120000).join(' ');
      concept += slicedWords;
      concept += `\n--- END OF RAG KNOWLEDGE ---`;

      const data = await worldAiService.generateFullWorld(concept, aiModel, settings || undefined);
      
      // Auto-extract strict Advanced AI Rules from the database of Knowledge
      try {
        setLoadingText("Đang phân tích và đúc kết Luật AI pháp chế từ tệp Tri thức nguyên tác...");
        const worldContextRules = data?.world ? JSON.stringify(data.world) : concept;
        const extractedRules = await worldAiService.extractRulesFromKnowledge(
          ragContentText,
          worldContextRules,
          aiModel,
          settings || undefined
        );
        if (extractedRules && extractedRules.length > 0) {
          if (!data.config) data.config = {};
          // Assign rules to overwrite default
          (data.config as any).rules = extractedRules;
        }
      } catch (ruleErr) {
        console.warn("Lỗi trích xuất Luật AI chuyên sâu:", ruleErr);
      }
      
      // Override values to stick with selected start timeline
      if (data && data.world) {
        const w = data.world as any;
        if (timelineEvents.length > 0) {
          const activeIndex = timelineEvents.findIndex(ev => ev.id === selectedTimelineEventId);
          const activeEv = timelineEvents[activeIndex];
          const nextEv = activeIndex < timelineEvents.length - 1 ? timelineEvents[activeIndex + 1] : null;

          w.openingTimeline = `${activeEv?.title} (${activeEv?.period})`;
          w.startingScenario = `Bản đồ & Kịch bản mở đầu tại mốc: ${activeEv?.title}.\nBối cảnh chi tiết: ${activeEv?.description}\n\n[DIỄN BIẾN MỞ ĐẦU AI PHÁT THOẠI]:\n${w.startingScenario || ''}`;

          let historyTimelineStr = `### 📅 CHUỖI TIMELINE BIÊN NIÊN SỬ TUYẾN TÍNH (KNOWLEDGE TIMELINE):\n`;
          timelineEvents.forEach((ev, idx) => {
            const isSelect = ev.id === selectedTimelineEventId;
            historyTimelineStr += `- **Mốc ${idx + 1} [${ev.period}]: ${ev.title}** ${isSelect ? '*(ĐIỂM XUẤT PHÁT CỦA BẠN)*' : ''}\n  *Chi tiết diễn biến*: ${ev.description}\n\n`;
          });

          w.history = `${historyTimelineStr}\n\n### LỊCH SỬ THẾ GIỚI CHI TIẾT AI SINH:\n${w.history || ''}`;

          let logicSpec = `\n[LUẬT TUYẾN TÍNH TRUYỆN MÔC LỊCH SỬ]:\n`;
          logicSpec += `- Mốc hiện tại: ${activeEv?.title} (${activeEv?.period})\n`;
          if (nextEv) {
            logicSpec += `- Mốc tiếp theo phải hướng tới: ${nextEv.title} (${nextEv.period})\n`;
            logicSpec += `- YÊU CẦU QUÝ KHÁCH: AI chỉ giải quyết cốt truyện xoay quanh mốc hiện tại, từ từ tịnh tiến sang mốc tiếp theo. Không nhảy cóc bừa bãi, không ảo giác chế diễn biến phế bỏ mốc lịch sử gốc.\n`;
          }
          w.logicControl = `${w.logicControl || ''}\n${logicSpec}`;
        }
      }

      // Override the generated player with selected character from RAG configuration
      if (data) {
        if (ragRoleplayMode === 'EXISTING') {
          const chosenChar = ragCharacters.find(c => c.name === selectedRagCharName);
          if (chosenChar) {
            data.player = {
              ...data.player,
              name: chosenChar.name,
              gender: chosenChar.gender || 'Nam',
              age: chosenChar.age || '18',
              personality: chosenChar.personality || '',
              background: chosenChar.background || '',
              appearance: chosenChar.appearance || '',
              skills: chosenChar.skills || '',
              goal: chosenChar.goal || '',
              voiceAndTone: chosenChar.role || 'Nhân vật chính',
              coreValues: 'Kiên quang, dũng nghị dũng cảm.',
              hardLimits: 'Không bất nghĩa với bằng hữu.',
              definingEvents: 'Xuất thân gắn liền với thế giới nguyên tác ' + (originalWorkName || 'Đồng nhân'),
              currentMood: 'Sẵn sàng dấn bước thám hiểm.',
              relationshipTags: 'Cương nghị khảng khái.',
              strengths: chosenChar.skills || '',
              weaknesses: 'Chưa phát huy tối đa tiềm lực bẩm sinh.',
              contradictions: 'Trầm lặng hướng nội nhưng hành động quyết đoán.',
              failureMode: 'Quyết không nản chí sụp đổ.'
            };
          }
        } else {
          if (ragCustomPlayer.name?.trim()) {
            data.player = {
              ...data.player,
              name: ragCustomPlayer.name,
              gender: ragCustomPlayer.gender || 'Nam',
              age: ragCustomPlayer.age || '18',
              personality: ragCustomPlayer.personality || '',
              background: ragCustomPlayer.background || '',
              appearance: ragCustomPlayer.appearance || '',
              skills: ragCustomPlayer.skills || '',
              goal: ragCustomPlayer.goal || '',
              voiceAndTone: ragCustomPlayer.voiceAndTone || 'Chậm rãi, chín chắn',
              coreValues: 'Bảo hộ chí hữu danh dự.',
              hardLimits: 'Tuyệt không khuất phục ác thế lực.',
              definingEvents: 'Dấn tiến vùng đất vô định.',
              currentMood: 'Trấn định, bình tĩnh.',
              relationshipTags: 'Giao hữu thâm tình quang minh.',
              strengths: ragCustomPlayer.skills || '',
              weaknesses: 'Chiến lực lúc đầu còn chưa cứng cáp.',
              contradictions: 'Cô lặng điềm tĩnh nhưng nội tâm dậy sóng.',
              failureMode: 'Rút binh nhẫn nại ẩn nhẫn phục cừu.'
            };
          }
        }
      }

      // Auto fill data into world creations store
      store.autoFillAll(data, true);
      
      toast.success("Hệ thống RAG đã thiết lập thế giới thành công! Đang chuyển sang World Creator...");
      onNavigate(GameState.WORLD_CREATION);
    } catch (error: any) {
      toast.error("Thiết lập thế giới RAG thất bại: " + error.message);
      setStep('INPUT');
    }
  };

  // Launch game session
  const handleLaunchSandboxGame = async () => {
    if (!sandboxSetup) return;
    
    const selectedScenario = sandboxSetup.scenarios[selectedScenarioIndex];
    if (!selectedScenario) {
      toast.error("Vui lòng lựa chọn mốc kịch bản bắt đầu!");
      return;
    }

    let finalPlayer: PlayerProfile;
    if (roleplayMode === 'EXISTING') {
      const originalChar = sandboxSetup.characters.find(c => c.name === selectedCharName);
      if (!originalChar) {
        toast.error("Nhân vật được lựa chọn không tồn tại.");
        return;
      }
      finalPlayer = {
        name: originalChar.name,
        gender: originalChar.gender,
        age: originalChar.age,
        personality: originalChar.personality,
        background: originalChar.background,
        appearance: originalChar.appearance,
        voiceAndTone: originalChar.role || 'Nhân vật chính',
        skills: originalChar.skills,
        goal: originalChar.goal,
        // Fill additional values safely
        coreValues: 'Kiên nghị dũng cảm, tôn thờ sự tự do.',
        hardLimits: 'Không bất nghĩa với bằng hữu.',
        definingEvents: 'Vạn dặm hành trình bước vào bối cảnh ' + originalWorkName,
        currentMood: 'Cao trào, quyết liệt.',
        relationshipTags: 'Nồng ấm tôn kính đối với đồng minh, khảng khái đối đầu kẻ địch.',
        strengths: originalChar.skills,
        weaknesses: 'Chưa thức tỉnh toàn diện sức mạnh.',
        contradictions: 'Thiên lương cao thượng nhưng hành sự tàn nhẫn khi cần thiết.',
        failureMode: 'Quyết chiến đến giọt máu cuối cùng.'
      };
    } else {
      if (!customPlayer.name?.trim()) {
        toast.error("Vui lòng điền tên cho nhân vật tự tạo!");
        return;
      }
      finalPlayer = {
        name: customPlayer.name || 'Người Vô Danh',
        gender: customPlayer.gender || 'Nam',
        age: customPlayer.age || '18',
        personality: customPlayer.personality || 'Chưa rõ',
        background: customPlayer.background || 'Đồng nhân độc quyền',
        appearance: customPlayer.appearance || 'Chưa rõ',
        voiceAndTone: customPlayer.voiceAndTone || 'Chưa rõ',
        skills: customPlayer.skills || 'Chưa rõ',
        goal: customPlayer.goal || 'Chưa rõ',
        coreValues: 'Kiên định bền bỉ.',
        hardLimits: 'Tuyệt đối không cúi đầu trước bạo quyền.',
        definingEvents: 'Xuyên việt đến vùng ' + originalWorkName,
        currentMood: 'Sẵn sàng chinh phục mọi đỉnh cao.',
        relationshipTags: 'Giao tế chu đáo, cảnh giác phòng bị.',
        strengths: customPlayer.skills || 'Đa tài đa nghệ',
        weaknesses: 'Tư chất chưa khai phá tối đa.',
        contradictions: 'Trầm lặng hướng nội nhưng hành động bất ngờ.',
        failureMode: 'Lùi một bước để lập mưu đồ nghịch chuyển.'
      };
    }

    // Convert other characters to Encyclopedia Entities / NPC database
    const finalEntities: Entity[] = sandboxSetup.characters
      .filter(c => c.name !== finalPlayer.name)
      .map((c, index) => ({
        id: `npc-fanfic-${index}-${Date.now()}`,
        type: 'NPC',
        name: c.name,
        description: `Bối cảnh: ${c.background}\nTính cách: ${c.personality}\nKỹ năng: ${c.skills}\nVai trò cốt truyện: ${c.role}`,
        gender: c.gender,
        age: c.age,
        personality: c.personality,
        background: c.background,
        appearance: c.appearance,
        skills: c.skills,
        goal: c.goal,
        voiceAndTone: c.role
      }));

    // Package world configuration
    const saveId = `autosave-sandbox-${Date.now()}`;
    const worldData: WorldData = {
      id: `sandbox-campaign-${crypto.randomUUID()}`,
      activeSaveId: saveId,
      player: finalPlayer,
      world: {
        worldName: `${originalWorkName} - ${selectedScenario.title}`,
        genre: sandboxSetup.worldGenre || "Đồng Nhân / Sandbox",
        context: `BỐI CẢNH SANDBOX:\n${selectedScenario.worldContext}\n\nYÊU CẦU NGƯỜI CHƠI:\n${additionalContext}\n\nCHỦ ĐỀ THẾ GIỚI:\n${sandboxSetup.worldTheme}`,
        startingScenario: selectedScenario.title,
        corePremise: sandboxSetup.worldTheme,
        adventureHooks: "Khởi động kịch bản: " + selectedScenario.title
      },
      config: {
        ...state.config,
        difficulty: settings?.difficulty || { id: 'medium', label: 'Bình thường', description: 'AI ứng phó công bằng, thế giới chân thực.' },
        outputLength: settings?.outputLength || { id: 'standard', label: 'Tiêu chuẩn', minWords: 150, maxWords: 400 },
        perspective: settings?.perspective || 'second',
        rules: [
          `Đúng nguyên tác chính xác với IP: ${originalWorkName}`,
          `Tôn trọng mốc bối cảnh xuất phát: ${selectedScenario.title}`,
          `Hỗ trợ tự động tra cứu, tìm kiếm bách khoa khi người chơi tương tác với nhân vật mới.`,
          `Phản hồi sinh động, sâu sắc, có tính sáng tạo cao.`
        ]
      },
      entities: finalEntities,
      gameTime: {
        year: selectedScenario.startingYear || 1000,
        month: 1,
        day: 1,
        hour: 8,
        minute: 0,
        startingYear: selectedScenario.startingYear || 1000
      },
      lorebook: { entries: {} },
      savedState: { history: [], turnCount: 0 }
    };

    // Save autosave locally in database
    try {
      await dbService.saveAutosave({
        id: saveId,
        name: `[Sandbox] ${originalWorkName} (${selectedScenario.title})`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        data: worldData
      });
      toast.success("Đang thiết lập thế giới đồng nhân Sandbox...");
      if (onGameStart) {
        onGameStart(worldData);
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khởi tạo kịch bản lưu.");
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden bg-slate-50 dark:bg-[#030712] transition-colors duration-500">
      {/* Background Layer with subtle blur */}
      {bgImage && (
        <>
          <div 
            className="absolute inset-0 z-0 transition-all duration-1000"
            style={{ 
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `brightness(0.25) blur(10px)`
            }}
          />
          <div className="absolute inset-0 z-0 bg-[#0f172a]/20 dark:bg-[#020617]/55 backdrop-blur-[2px]" />
        </>
      )}

      {/* Main container with clean scrolling layout to prevent layout clipping */}
      <div className="flex-grow flex flex-col max-w-5xl w-full mx-auto p-4 md:p-8 z-10 overflow-y-auto no-scrollbar justify-start">
        
        {/* Header toolbar */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => onNavigate(GameState.MENU)} 
            className="group flex items-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-mystic-accent bg-white/70 dark:bg-[#0b1329]/80 backdrop-blur border border-slate-200/50 dark:border-slate-800/40 rounded-2xl transition-all shadow-sm shadow-slate-100 dark:shadow-none hover:shadow-md hover:-translate-y-0.5"
          >
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" />
            Quay lại Menu
          </button>
          
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#38bdf8] uppercase tracking-widest bg-blue-500/10 p-2 px-3 rounded-xl border border-blue-500/10">
            <Sparkles size={13} className="animate-pulse" />
            Đồng Nhân Multiverse
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Input formulation */}
          {step === 'INPUT' && (
            <motion.div 
              key="input_screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="bg-white/85 dark:bg-[#090d1a]/85 backdrop-blur-xl border border-slate-200/50 dark:border-[#142042]/20 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-200/40 dark:shadow-[#02050c]/80 flex flex-col gap-6"
            >
              <div className="text-center max-w-2xl mx-auto flex flex-col gap-2">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-800 dark:text-white uppercase font-sans">
                  Sáng Tạo Nhập Vai Đồng Nhân
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Bước vào thế giới của cuốn sách, bộ phim hoặc tác phẩm yêu thích của bạn. 
                  Hãy điền tên IP gốc và chỉ rõ ước vọng bối cảnh muốn tinh chỉnh.
                </p>
              </div>

              {/* Input for IP name */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-[#0ea5e9]">
                  Tên Tác Phẩm hoặc IP nguyên tác *
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors">
                    <Compass size={18} />
                  </div>
                  <input 
                    type="text"
                    value={originalWorkName}
                    onChange={(e) => setOriginalWorkName(e.target.value)}
                    placeholder="Ví dụ: Harry Potter, Đấu Phá Thương Khung, Tây Du Ký..."
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#02050c] border border-slate-250 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-800 dark:text-slate-150 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#0ea5e9]/50 focus:border-[#0ea5e9] transition-all"
                  />
                </div>
              </div>

              {/* IP Presets list */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Phổ Biến Của Fandom:
                </span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {PRESET_IPS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectPreset(preset.name)}
                      className={`text-left p-3 rounded-2xl border text-xs transition-all hover:border-[#0ea5e9]/30 hover:bg-slate-100/50 dark:hover:bg-[#0e172e]/40 ${
                        originalWorkName === preset.name 
                          ? 'bg-blue-500/5 dark:bg-[#0c1b35] border-[#0ea5e9] text-[#0ea5e9]' 
                          : 'bg-slate-50/50 dark:bg-[#0d1326]/50 border-slate-200/60 dark:border-slate-800/65 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 truncate">
                        <Flame size={12} className={originalWorkName === preset.name ? 'text-[#0ea5e9]' : 'text-slate-400'} />
                        {preset.name}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                        {preset.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Input for Additional Context */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Yêu Cầu Bổ Sung về bối cảnh (Tùy chọn)
                </label>
                <textarea 
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Tôi muốn nhập vai làm một đệ tử Vân Lam Tông mang dị hỏa ám hệ, thay đổi cốt truyện Tiêu Viêm đại náo... Hoặc chỉ đơn giản là làm một pháp sư mộc hệ muốn cứu vớt gia tộc."
                  className="w-full h-24 p-4 bg-slate-50 dark:bg-[#02050c] border border-slate-250 dark:border-slate-800 rounded-2xl text-sm font-medium text-slate-800 dark:text-slate-150 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400/30 transition-all resize-none"
                />
              </div>

              {/* Mode Select Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-150 dark:border-slate-800/40">
                {/* Mode A: Sandbox Start */}
                <button
                  type="button"
                  onClick={handleSandboxStart}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/65 bg-gradient-to-br from-[#0c1830] to-[#040815] text-white hover:border-[#38bdf8]/50 shadow-md transition-all duration-300 group hover:-translate-y-1"
                >
                  <div className="p-3 bg-[#38bdf8]/10 rounded-xl group-hover:scale-110 transition-transform">
                    <Play className="text-[#38bdf8]" size={22} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-extrabold text-[12px] uppercase tracking-wider text-slate-100">
                      1. KHỞI CHẠY SANDBOX (CHƠI LUÔN)
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-sm">
                      AI tự động thiết lập các mốc thời gian và nhân vật. Trực tiếp tham gia kịch bản chơi ngay tức khắc.
                    </p>
                  </div>
                </button>

                {/* Mode B: Detailed Fill All */}
                <button
                  type="button"
                  onClick={handleFillAllStart}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-slate-250 dark:border-slate-800/65 bg-slate-100/50 dark:bg-slate-900/40 hover:border-violet-500/50 hover:bg-slate-200/50 dark:hover:bg-slate-800/30 transition-all duration-300 group hover:-translate-y-1"
                >
                  <div className="p-3 bg-violet-500/10 rounded-xl group-hover:scale-110 transition-transform">
                    <Sliders className="text-violet-500 dark:text-violet-400" size={22} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-extrabold text-[12px] uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      2. ĐIỀN TẤT CẢ (WORLD CREATOR)
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-sm">
                      AI sẽ tự động sinh ngẫu nhiên toàn diện cốt truyện, địa lý, khu vực, nhân vật vào kho World Creator để tùy chỉnh.
                    </p>
                  </div>
                </button>

                {/* Mode C: AI Gen Knowledge RAG */}
                <button
                  type="button"
                  onClick={() => {
                    setShowRagPanel(prev => !prev);
                    toast.info(showRagPanel ? "Đã thu gọn cài đặt RAG" : "Vui lòng chọn tệp tin Tri thức JSON ở bảng cài đặt phía dưới!");
                  }}
                  className={`flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all duration-300 group hover:-translate-y-1 ${
                    showRagPanel
                      ? 'bg-emerald-500/5 dark:bg-[#061810] border-emerald-500 text-emerald-500 shadow-lg shadow-emerald-500/5'
                      : 'border-slate-250 dark:border-slate-800/65 bg-slate-100/50 dark:bg-slate-900/40 hover:border-emerald-500/50 hover:bg-slate-200/50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${showRagPanel ? 'bg-emerald-500/20' : 'bg-emerald-500/10'}`}>
                    <Database className="text-emerald-500 dark:text-emerald-400" size={22} />
                  </div>
                  <div className="text-center">
                    <h3 className={`font-extrabold text-[12px] uppercase tracking-wider ${showRagPanel ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-200'}`}>
                      3. AI GEN KNOWLEDGE RAG
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-sm">
                      Nạp tệp tin Tri Thức (.json) đã được huấn luyện sẵn để AI trích từ bộ dữ liệu này ra toàn bộ thế giới gốc chân thực nhất.
                    </p>
                  </div>
                </button>
              </div>

              {/* RAG Configuration Panel */}
              <AnimatePresence>
                {showRagPanel && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-[#f0f4fc] dark:bg-[#090e1a] border border-[#cbd2df]/50 dark:border-[#142042]/50 rounded-2xl p-4 md:p-5 mt-2 space-y-4 overflow-hidden"
                  >
                    <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800/60 pb-2">
                      <h3 className="font-extrabold text-emerald-500 uppercase tracking-widest text-xs flex items-center gap-2">
                        <Database size={15} /> BẢNG NẠP TRI THỨC ĐỒNG NHÂN (RAG MODE)
                      </h3>
                      <span className="text-[10px] bg-emerald-500/15 text-emerald-500 p-1 px-2.5 rounded-lg border border-emerald-500/20 font-extrabold uppercase tracking-wider">
                        Đang Kích hoạt RAG
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Upload Block */}
                      <div className="bg-slate-50 dark:bg-[#030610] p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                          Chọn tệp JSON kết quả huấn luyện (Train vạn tự):
                        </span>
                        <div className="flex flex-wrap items-center gap-3">
                          <input 
                            type="file"
                            accept=".json"
                            onChange={handleRagJsonUpload}
                            ref={ragInputRef}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => ragInputRef.current?.click()}
                            className="bg-emerald-500 hover:bg-emerald-600 text-[#0c1830] font-black tracking-wider text-[11px] px-4 py-2.5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md flex items-center gap-1.5 focus:outline-none"
                          >
                            <Upload size={14} /> Chọn tệp Tri thức .JSON
                          </button>
                          {ragJsonFile && (
                            <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-300 truncate max-w-[150px]">
                              {ragJsonFile.name}
                            </span>
                          )}
                        </div>

                        {ragChunksLoaded > 0 && (
                          <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 space-y-1 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                            <p className="font-bold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={13} /> Nạp tri thức thành công!
                            </p>
                            <p className="font-medium text-[11px]">Đồng nhân: <span className="font-bold text-blue-400">{ragStoryName || 'Đã nhận dạng'}</span></p>
                            <p className="font-medium text-[11px]">Số mảnh tri thức: <span className="font-bold font-mono text-emerald-500">{ragChunksLoaded} phân đoạn</span></p>
                          </div>
                        )}
                      </div>

                      {/* Action Panel */}
                      <div className="flex flex-col justify-between">
                        <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                          <p>AI sẽ đọc tệp JSON tri thức, dùng RAG liên kết và trích xuất mọi chi tiết, quy luật lực lượng cốt lõi để khởi sinh cảnh giới, nhân vật chuẩn cốt truyện gốc nhất.</p>
                          <p className="mt-1 text-[10px] text-amber-500 font-bold flex items-center gap-1">• Khuyên dùng tệp JSON xuất từ tính năng Huấn Luyện Tri Thức.</p>
                        </div>

                        <button
                          type="button"
                          onClick={handleRagCreationStart}
                          disabled={!ragJsonFile || ragChunksLoaded === 0}
                          className="w-full justify-center bg-blue-600 text-white font-black tracking-widest py-3.5 mt-3 rounded-xl shadow-lg transition-all uppercase text-[11px] disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 hover:bg-blue-700 active:scale-[0.99] flex items-center justify-center gap-1.5 focus:outline-none"
                        >
                          <Sparkles size={14} className="inline-block" /> Bắt đầu RAG Sáng Tạo Thế Giới {timelineEvents.length > 0 ? "Với Timeline" : ""}
                        </button>
                      </div>
                    </div>

                    {/* Timeline step segment */}
                    {ragChunksLoaded > 0 && (
                      <div className="mt-6 pt-5 border-t border-slate-200/60 dark:border-slate-850/60 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-dashed border-slate-250 dark:border-slate-800">
                          <div>
                            <h4 className="font-extrabold text-[#0ea5e9] uppercase tracking-wider text-xs flex items-center gap-1.5 font-sans">
                              <Clock size={14} className="animate-pulse" /> Sắp Xếp Tuyến Tính Thời Gian (Chosen Timeline)
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">
                              Chọn mốc thời kỳ bắt đầu để AI bám sát tình tiết gốc nguyên mẫu từ tệp tri thức, sau đó tịnh tiến dần sang mốc tiếp theo.
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleExtractTimeline}
                              disabled={isExtractingTimeline}
                              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-850 text-slate-950 font-black text-[10px] uppercase px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm focus:outline-none"
                            >
                              {isExtractingTimeline ? (
                                <>
                                  <RefreshCw size={11} className="animate-spin" /> Đang trích xuất...
                                </>
                              ) : (
                                <>
                                  <Sparkles size={11} /> ✨ Trích xuất tự động
                                </>
                              )}
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddTimelineForm(!showAddTimelineForm);
                                setEditingTimelineId(null);
                              }}
                              className="bg-[#0c1830] hover:bg-[#142345] text-slate-200 border border-slate-700/30 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-all focus:outline-none"
                            >
                              {showAddTimelineForm ? "Đóng" : "➕ Thêm mốc thủ công"}
                            </button>
                          </div>
                        </div>

                        {/* Add Timeline form */}
                        {showAddTimelineForm && (
                          <div className="p-4 bg-slate-50 dark:bg-[#030611] rounded-2xl border border-slate-200/55 dark:border-slate-800/60 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-extrabold text-slate-500 uppercase">Tên mốc sự kiện *</label>
                                <input
                                  type="text"
                                  required
                                  value={newTimelineTitle}
                                  onChange={(e) => setNewTimelineTitle(e.target.value)}
                                  placeholder="Ví dụ: Đại chiến đỉnh Vân Lam"
                                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none text-slate-800 dark:text-slate-200"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-extrabold text-slate-500 uppercase">Giai đoạn / Tiêu niên (Period)</label>
                                <input
                                  type="text"
                                  value={newTimelinePeriod}
                                  onChange={(e) => setNewTimelinePeriod(e.target.value)}
                                  placeholder="Ví dụ: Năm thứ ba hẹn ước"
                                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none text-slate-800 dark:text-slate-200"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-extrabold text-slate-500 uppercase">Mô tả cốt lõi diễn biến nguyên tác *</label>
                              <textarea
                                value={newTimelineDesc}
                                onChange={(e) => setNewTimelineDesc(e.target.value)}
                                placeholder="Tóm tắt những gì canonically diễn ra ở mốc này để AI lấy làm dữ liệu gốc..."
                                className="w-full h-16 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-medium focus:outline-none resize-none text-slate-800 dark:text-slate-200"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAddTimeline}
                              className="bg-[#38bdf8] hover:bg-[#0ea5e9] text-slate-950 font-black uppercase text-[10px] px-4 py-2 rounded-xl transition-all"
                            >
                              Thêm mốc thời kỳ
                            </button>
                          </div>
                        )}

                        {/* Edit form */}
                        {editingTimelineId && (
                          <div className="p-4 bg-[#fffbfa] dark:bg-[#1a120b] rounded-2xl border border-amber-500/30 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-extrabold text-slate-500 uppercase">Sửa Tên mốc sự kiện *</label>
                                <input
                                  type="text"
                                  required
                                  value={editTimelineTitle}
                                  onChange={(e) => setEditTimelineTitle(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none text-slate-800 dark:text-slate-200"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-extrabold text-slate-500 uppercase">Sửa Giai đoạn (Period)</label>
                                <input
                                  type="text"
                                  value={editTimelinePeriod}
                                  onChange={(e) => setEditTimelinePeriod(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none text-slate-800 dark:text-slate-200"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-extrabold text-slate-500 uppercase">Sửa Mô tả cốt lõi diễn biến nguyên tác *</label>
                              <textarea
                                value={editTimelineDesc}
                                onChange={(e) => setEditTimelineDesc(e.target.value)}
                                className="w-full h-16 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-medium focus:outline-none resize-none text-slate-800 dark:text-slate-200"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleSaveEditTimeline}
                                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase text-[10px] px-4 py-2 rounded-xl transition-all"
                              >
                                Lưu thay đổi
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTimelineId(null)}
                                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[10px] px-4 py-2 rounded-xl transition-all"
                              >
                                Hủy bỏ
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Interactive Vertical Timeline List */}
                        {timelineEvents.length > 0 ? (
                          <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 ml-3 space-y-4 py-2">
                            {timelineEvents.map((ev, idx) => {
                              const isSelected = ev.id === selectedTimelineEventId;
                              return (
                                <div key={ev.id} className="relative group/time">
                                  {/* Dot Bullet on line */}
                                  <div 
                                    onClick={() => setSelectedTimelineEventId(ev.id)}
                                    className={`absolute -left-[31px] top-1 w-[12px] h-[12px] rounded-full ring-4 transition-all duration-300 cursor-pointer ${
                                      isSelected 
                                        ? 'bg-[#0ea5e9] ring-[#0ea5e9]/20 scale-125' 
                                        : 'bg-slate-300 ring-transparent hover:scale-110 hover:bg-slate-400'
                                    }`}
                                  />
                                  <div className={`p-4 rounded-2xl border transition-all duration-300 ${
                                    isSelected 
                                      ? 'bg-gradient-to-r from-blue-500/5 to-sky-500/5 border-[#0ea5e9]/40 shadow-sm shadow-blue-500/5' 
                                      : 'bg-white/40 dark:bg-slate-900/30 border-slate-200/55 dark:border-slate-850/60 hover:bg-white/80 dark:hover:bg-slate-900/50'
                                  }`}>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="cursor-pointer flex-grow text-left" onClick={() => setSelectedTimelineEventId(ev.id)}>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] bg-slate-900/10 dark:bg-slate-100/10 px-2.5 py-0.5 rounded-lg border border-slate-700/10 font-black font-mono text-slate-700 dark:text-slate-300">
                                            {ev.period}
                                          </span>
                                          {isSelected && (
                                            <span className="text-[9px] font-extrabold uppercase bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                              <Check size={10} /> Xuất phát
                                            </span>
                                          )}
                                        </div>
                                        <h5 className={`font-black text-xs uppercase mt-1.5 tracking-wide ${isSelected ? 'text-[#0ea5e9]' : 'text-slate-850 dark:text-slate-150'}`}>
                                          {idx + 1}. {ev.title}
                                        </h5>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold leading-relaxed">
                                          {ev.description}
                                        </p>
                                      </div>

                                      {/* Row Actions */}
                                      <div className="flex items-center gap-1.5 opacity-40 group-hover/time:opacity-100 transition-opacity">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingTimelineId(ev.id);
                                            setEditTimelineTitle(ev.title);
                                            setEditTimelinePeriod(ev.period);
                                            setEditTimelineDesc(ev.description);
                                            setShowAddTimelineForm(false);
                                          }}
                                          className="text-slate-600 dark:text-slate-400 hover:text-[#0ea5e9] hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-[10px] font-bold p-1 bg-slate-100/30 dark:bg-slate-800/30 rounded px-2"
                                        >
                                          Sửa
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteTimeline(ev.id)}
                                          className="text-slate-600 dark:text-slate-400 hover:text-red-500 hover:bg-red-500/5 text-[10px] font-bold p-1 bg-slate-100/30 dark:bg-slate-800/30 rounded px-2"
                                        >
                                          Xóa
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Summary pipeline indicator */}
                            <div className="p-3 bg-blue-500/5 dark:bg-blue-500/10 rounded-2xl border border-blue-500/10 mt-4 text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed text-left">
                              💡 <span className="font-extrabold text-blue-400 uppercase">Liên Kết Tuyến Tính:</span> Người chơi bắt đầu chơi từ mốc <strong>{timelineEvents.findIndex(ev => ev.id === selectedTimelineEventId) + 1} ({timelineEvents.find(ev => ev.id === selectedTimelineEventId)?.title})</strong>. AI sẽ khóa thế giới thám hiểm ở mốc hiện tại này, và tịnh tiến dần sang mốc tiếp theo: <strong>{
                                timelineEvents.findIndex(ev => ev.id === selectedTimelineEventId) < timelineEvents.length - 1 
                                  ? timelineEvents[timelineEvents.findIndex(ev => ev.id === selectedTimelineEventId) + 1]?.title 
                                  : "Đích kết hành trình"
                              }</strong>. Cấm tự ý ảo giác lôi diễn biến hoặc nhân vật ngoài mốc thời đại này ra tùy tiện.
                            </div>
                          </div>
                        ) : (
                          <div className="text-center p-6 bg-slate-150/20 dark:bg-slate-900/10 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-3">
                            <p className="text-[11px] text-slate-400 font-bold">
                              Chưa có chuỗi sự kiện được chỉ định. Hãy nhấn "Trích xuất" để AI quét tệp tri thức tự động hoặc nạp mốc thủ công.
                            </p>
                            <button
                              type="button"
                              onClick={handleExtractTimeline}
                              disabled={isExtractingTimeline}
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 font-extrabold text-[10px] uppercase border border-emerald-500/20 p-2 px-4 rounded-xl transition-all"
                            >
                              {isExtractingTimeline ? "Đang xử lý tri thức kỹ lưỡng..." : "🪄 Trích xuất Biên niên sử học"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Character selection segment */}
                    {ragChunksLoaded > 0 && (
                      <div className="mt-6 pt-5 border-t border-slate-200/65 dark:border-slate-850/60 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-dashed border-slate-250 dark:border-slate-800">
                          <div>
                            <h4 className="font-extrabold text-[#38bdf8] uppercase tracking-wider text-xs flex items-center gap-1.5 font-sans">
                              <User size={14} className="animate-pulse" /> Sắp đặt Vai diễn & Nhân vật (Roleplay Model)
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-0.5 font-medium leading-relaxed">
                              Chọn danh phận một nhân vật có sẵn trong file tri thức, hoặc xây dựng nhân vật custom OC tự ngoại của riêng bạn.
                            </p>
                          </div>
                        </div>

                        {/* Selection Mode Toggle */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-200/65 dark:bg-[#030610] p-1 rounded-xl max-w-sm">
                          <button
                            type="button"
                            onClick={() => setRagRoleplayMode('EXISTING')}
                            className={`py-1.5 px-3 text-[10px] uppercase font-bold rounded-lg transition-all ${
                              ragRoleplayMode === 'EXISTING' 
                                ? 'bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-150 shadow-sm' 
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                            }`}
                          >
                            🎭 Nhân vật chính tuyến
                          </button>
                          <button
                            type="button"
                            onClick={() => setRagRoleplayMode('CUSTOM')}
                            className={`py-1.5 px-3 text-[10px] uppercase font-bold rounded-lg transition-all ${
                              ragRoleplayMode === 'CUSTOM' 
                                ? 'bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-150 shadow-sm' 
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                            }`}
                          >
                            ✏️ Tự custom nhân vật OC
                          </button>
                        </div>

                        {ragRoleplayMode === 'EXISTING' ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black uppercase text-slate-400">Chọn 1 nhân vật trong tệp tri thức:</span>
                              
                              <button
                                type="button"
                                onClick={handleExtractRagCharacters}
                                disabled={isExtractingRagChars}
                                className="bg-[#10b981]/10 hover:bg-[#10b981]/20 text-emerald-500 font-extrabold text-[10px] uppercase border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 focus:outline-none"
                              >
                                {isExtractingRagChars ? (
                                  <>
                                    <RefreshCw size={10} className="animate-spin" /> Đang trích xuất...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={10} /> Trích xuất nhân vật gốc
                                  </>
                                )}
                              </button>
                            </div>

                            {ragCharacters.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                                {ragCharacters.map((char, index) => {
                                  const isSelected = selectedRagCharName === char.name;
                                  return (
                                    <div
                                      key={index}
                                      onClick={() => setSelectedRagCharName(char.name)}
                                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 relative ${
                                        isSelected 
                                          ? 'bg-blue-500/5 dark:bg-[#0c1830] border-[#0ea5e9] shadow-sm' 
                                          : 'bg-white/40 dark:bg-[#070c18]/45 border-slate-200/60 dark:border-slate-850/65 hover:border-slate-350 dark:hover:border-slate-850 bg-slate-50/50'
                                      }`}
                                    >
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${
                                        isSelected ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-850 text-slate-500'
                                      }`}>
                                        {char.name.charAt(0)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-extrabold text-xs text-slate-800 dark:text-slate-150 truncate">
                                            {char.name}
                                          </span>
                                          <span className="text-[8px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100/80 dark:bg-slate-800 text-slate-400 dark:text-slate-300 font-extrabold">
                                            {char.role || "Nhân vật gốc"}
                                          </span>
                                        </div>
                                        <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 flex gap-2 font-mono font-bold">
                                          <span>Tuổi: {char.age}</span>
                                          <span>•</span>
                                          <span>Giới tính: {char.gender}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 lines-clamp-2 leading-relaxed font-semibold">
                                          <strong>Tiểu sử:</strong> {char.background}
                                        </p>
                                      </div>
                                      {isSelected && (
                                        <div className="absolute right-3 bottom-3 text-[#0ea5e9]">
                                          <Check size={14} />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center p-6 bg-slate-150/20 dark:bg-slate-900/10 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl space-y-2">
                                <p className="text-[10.5px] text-slate-400 font-bold">
                                  Chưa quét thông tin nhân vật chính truyện nào. Hãy ấn nút "Trích xuất" để AI tìm tự động.
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 dark:bg-[#030611] rounded-2xl border border-slate-200/55 dark:border-slate-800/60 space-y-4">
                            {/* Prompt helper to generate OC character */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase text-[#38bdf8]">1. Ý tưởng thiết kế nhân vật custom OC của bạn:</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={ocPromptPrefix}
                                  onChange={(e) => setOcPromptPrefix(e.target.value)}
                                  placeholder="Ví dụ: đệ tử Vân Lam Tông hệ Hỏa, muốn báo thù chi nhánh gia tộc, tính khí quả quyết..."
                                  className="flex-grow bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[#0ea5e9] text-slate-800 dark:text-slate-200 placeholder-slate-400"
                                />
                                <button
                                  type="button"
                                  onClick={handleGenerateOcCharacter}
                                  disabled={isGeneratingOc || !ragContentText.trim()}
                                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-350 dark:disabled:bg-slate-850 text-white font-extrabold text-[10px] px-4 py-2 rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5 uppercase"
                                >
                                  {isGeneratingOc ? (
                                    <>
                                      <RefreshCw size={11} className="animate-spin" /> Đang lập hồ sơ...
                                    </>
                                  ) : (
                                    <>
                                      <Wand2 size={11} /> AI Tự Sinh OC
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="text-[9.5px] text-slate-400 font-semibold">• AI sẽ phân tích tệp tri thức và sinh ra toàn diện bối cảnh, ngoại hình, kỹ năng phù hợp nhất cho OC này. Bạn có thể tự chỉnh sửa trực tiếp mọi trường bên dưới!</p>
                            </div>

                            {/* Editable character sheet details */}
                            <div className="border-t border-slate-200/50 dark:border-slate-800/40 pt-4 space-y-3.5">
                              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">2. Hồ sơ chi tiết nhân vật OC (Người chơi tự do hiệu chỉnh):</span>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tên nhân vật *</label>
                                  <input
                                    type="text"
                                    value={ragCustomPlayer.name || ''}
                                    onChange={(e) => setRagCustomPlayer({ ...ragCustomPlayer, name: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Giới tính</label>
                                  <select
                                    value={ragCustomPlayer.gender || 'Nam'}
                                    onChange={(e) => setRagCustomPlayer({ ...ragCustomPlayer, gender: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none text-slate-700 dark:text-slate-200"
                                  >
                                    <option value="Nam">Nam</option>
                                    <option value="Nữ">Nữ</option>
                                    <option value="Khác">Khác/Phát triển tự do</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tuổi thế gian</label>
                                  <input
                                    type="text"
                                    value={ragCustomPlayer.age || ''}
                                    onChange={(e) => setRagCustomPlayer({ ...ragCustomPlayer, age: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Cốt tính khí / Tính cách</label>
                                  <input
                                    type="text"
                                    value={ragCustomPlayer.personality || ''}
                                    onChange={(e) => setRagCustomPlayer({ ...ragCustomPlayer, personality: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Phong phong khôi lý / Giọng nói</label>
                                  <input
                                    type="text"
                                    value={ragCustomPlayer.voiceAndTone || ''}
                                    onChange={(e) => setRagCustomPlayer({ ...ragCustomPlayer, voiceAndTone: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Tiểu sử & Chân tướng xuất thân</label>
                                <textarea
                                  value={ragCustomPlayer.background || ''}
                                  onChange={(e) => setRagCustomPlayer({ ...ragCustomPlayer, background: e.target.value })}
                                  className="w-full h-16 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-medium focus:outline-none resize-none text-slate-800 dark:text-slate-200 leading-relaxed"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Ngoại hình, Khí chất & Y sồng</label>
                                <textarea
                                  value={ragCustomPlayer.appearance || ''}
                                  onChange={(e) => setRagCustomPlayer({ ...ragCustomPlayer, appearance: e.target.value })}
                                  className="w-full h-16 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-medium focus:outline-none resize-none text-slate-800 dark:text-slate-200 leading-relaxed"
                                />
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Kỹ năng đặc dị / Công pháp hằng cổ</label>
                                  <input
                                    type="text"
                                    value={ragCustomPlayer.skills || ''}
                                    onChange={(e) => setRagCustomPlayer({ ...ragCustomPlayer, skills: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Hành trình mục tiêu / Chí nguyện lực</label>
                                  <input
                                    type="text"
                                    value={ragCustomPlayer.goal || ''}
                                    onChange={(e) => setRagCustomPlayer({ ...ragCustomPlayer, goal: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Loading view */}
          {step === 'LOADING' && (
            <motion.div 
              key="loading_screen"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center gap-6"
            >
              <div className="relative flex items-center justify-center">
                {/* Dual rotating rings */}
                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <div className="absolute w-12 h-12 border-4 border-indigo-500/10 border-b-indigo-400 rounded-full animate-spin [animation-duration:1.5s]" />
                <Sparkle size={20} className="absolute text-yellow-400 animate-pulse" />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-bold text-slate-850 dark:text-slate-150 uppercase tracking-widest animate-pulse">
                  Khai Kỳ Đồng Nhân Lộ...
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-mono max-w-md mx-auto">
                  {loadingText}
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 3: Sandbox customizer Selection */}
          {step === 'SANDBOX_SELECT' && sandboxSetup && (
            <motion.div
              key="sandbox_setup_screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-6"
            >
              {/* Back to inputs link */}
              <button 
                onClick={() => setStep('INPUT')}
                className="self-start text-xs font-bold text-[#0ea5e9] hover:underline flex items-center gap-1.5 transition-all dark:bg-[#0a1122] p-2 rounded-xl border border-slate-700/10"
              >
                <RefreshCw size={13} /> Thay Đổi Tác Phẩm Gốc
              </button>

              {/* Title layout info */}
              <div className="p-5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-3xl border border-blue-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    {originalWorkName} — Cấu Hình Sandbox
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                    Thể loại đề văn: {sandboxSetup.worldGenre || "Huyền Huyễn"} | Chủ đề vĩ cảnh: {sandboxSetup.worldTheme}
                  </p>
                </div>
                <div className="text-xs bg-slate-900/10 dark:bg-white/10 px-3.5 py-1.5 rounded-2xl font-mono text-slate-500 dark:text-slate-350 self-start md:self-auto uppercase font-bold tracking-wider">
                  🎯 Chế độ chơi tự do
                </div>
              </div>

              {/* Main content grid split */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Column left: Scenario timeline starting points (size 5/12) */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 px-1">
                    <Compass size={16} className="text-[#38bdf8]" />
                    <span className="text-sm font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      1. Chọn điểm mốc mốc thời gian bắt đầu (Arcs):
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {sandboxSetup.scenarios.map((scenario, index) => {
                      const isSelected = selectedScenarioIndex === index;
                      return (
                        <div
                          key={scenario.id || index}
                          onClick={() => setSelectedScenarioIndex(index)}
                          className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-blue-500/5 dark:bg-[#0c1830] border-[#0ea5e9] shadow-sm shadow-[#0ea5e9]/10' 
                              : 'bg-white dark:bg-[#090d1a]/90 border-slate-200/60 dark:border-[#142042]/20 hover:border-slate-350 dark:hover:border-slate-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-black uppercase tracking-wide text-slate-850 dark:text-slate-200">
                              {scenario.title}
                            </span>
                            <span className="text-[10px] font-mono bg-slate-100 dark:bg-[#1a2034] text-slate-500 dark:text-slate-400 p-1 px-2 rounded-lg font-bold">
                              Năm {scenario.startingYear || 100}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">
                            {scenario.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Column right: Character roleplaying (size 7/12) */}
                <div className="lg:col-span-7 flex flex-col gap-4 bg-white/70 dark:bg-[#070b16]/75 border border-slate-200/50 dark:border-slate-800/35 p-5 rounded-2xl">
                  <div className="flex items-center gap-2 border-b border-slate-150 dark:border-slate-800 pb-3">
                    <User size={16} className="text-violet-500" />
                    <span className="text-sm font-black uppercase tracking-wider text-slate-650 dark:text-slate-300">
                      2. Thiết lập vai diễn Nhân Vật (Roleplay):
                    </span>
                  </div>

                  {/* Character selection toggle options */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-[#02050c] p-1 rounded-xl">
                    <button
                      onClick={() => setRoleplayMode('EXISTING')}
                      className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                        roleplayMode === 'EXISTING' 
                          ? 'bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-100 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                    >
                      🎭 Nhân vật cổ điển
                    </button>
                    <button
                      onClick={() => setRoleplayMode('CUSTOM')}
                      className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                        roleplayMode === 'CUSTOM' 
                          ? 'bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-100 shadow-sm shadow-slate-200 dark:shadow-none' 
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                    >
                      ✏️ Tự tạo nhân vật riêng
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {/* Roleplay Mode: EXISTING */}
                    {roleplayMode === 'EXISTING' ? (
                      <motion.div
                        key="existing_selector"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col gap-3"
                      >
                        {/* Search character */}
                        <div className="relative group">
                          <Search size={14} className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 my-auto" />
                          <input 
                            value={searchCharTerm}
                            onChange={(e) => setSearchCharTerm(e.target.value)}
                            placeholder="Tìm kiếm nhân vật..."
                            className="w-full bg-slate-50 dark:bg-[#02050c] border border-slate-250 dark:border-slate-800/80 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-0 text-slate-705 dark:text-slate-200"
                          />
                        </div>

                        {/* List grid array of characters limit to 6 scrollable */}
                        <div className="max-h-72 overflow-y-auto custom-scrollbar flex flex-col gap-2.5 pr-1">
                          {sandboxSetup.characters
                            .filter(c => c.name.toLowerCase().includes(searchCharTerm.toLowerCase()))
                            .map((char, index) => {
                              const isSelected = selectedCharName === char.name;
                              return (
                                <div
                                  key={index}
                                  onClick={() => setSelectedCharName(char.name)}
                                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 relative ${
                                    isSelected 
                                      ? 'bg-blue-500/5 dark:bg-[#0c1830] border-[#0ea5e9] shadow-inner shadow-blue-500/5' 
                                      : 'bg-slate-50/50 dark:bg-[#0b1223]/50 border-slate-200/60 dark:border-[#142042]/25 hover:border-slate-350 dark:hover:border-slate-800'
                                  }`}
                                >
                                  {/* Visual index card indicator */}
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black outline uppercase ${
                                    isSelected ? 'bg-blue-500 text-white outline-blue-500/20' : 'bg-slate-200/50 dark:bg-slate-850 text-slate-500 outline-transparent'
                                  }`}>
                                    {char.name.charAt(0)}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-150 group-hover:text-blue-400">
                                        {char.name}
                                      </span>
                                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#1a2135] text-slate-400 dark:text-slate-300 font-bold shrink-0">
                                        {char.role || "Phụ"}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-400 mt-1 flex gap-2 font-mono font-bold">
                                      <span>Giới tính: {char.gender}</span>
                                      <span>•</span>
                                      <span>Tuổi: {char.age}</span>
                                    </div>
                                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed truncate">
                                      <span className="font-semibold text-slate-600 dark:text-slate-350">Mô tả:</span> {char.background}
                                    </p>
                                  </div>

                                  {isSelected && (
                                    <div className="absolute right-3 bottom-3 text-[#0ea5e9]">
                                      <Check size={16} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </motion.div>
                    ) : (
                      /* Roleplay Mode: CUSTOM */
                      <motion.div
                        key="custom_creator"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col gap-3.5"
                      >
                        {/* Name and Basic features */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase text-slate-400">Tên Nhân Vật *</span>
                            <input
                              type="text"
                              value={customPlayer.name}
                              onChange={(e) => setCustomPlayer({ ...customPlayer, name: e.target.value })}
                              placeholder="Nhập tên nhân vật..."
                              className="w-full bg-slate-50 dark:bg-[#02050c] border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#0ea5e9]"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase text-slate-400">Giới Tính *</span>
                            <select
                              value={customPlayer.gender}
                              onChange={(e) => setCustomPlayer({ ...customPlayer, gender: e.target.value })}
                              className="w-full bg-slate-50 dark:bg-[#02050c] border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#0ea5e9]"
                            >
                              <option value="Nam">Nam</option>
                              <option value="Nữ">Nữ</option>
                              <option value="Khác">Phù hợp riêng</option>
                            </select>
                          </div>
                        </div>

                        {/* Personality and Backstory background */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase text-slate-400">Tuổi tác</span>
                          <input
                            type="text"
                            value={customPlayer.age}
                            onChange={(e) => setCustomPlayer({ ...customPlayer, age: e.target.value })}
                            placeholder="Thiết lập tuổi thích hợp..."
                            className="w-full bg-slate-50 dark:bg-[#02050c] border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#0ea5e9]"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase text-slate-400">Tính cách bẩm sinh</span>
                          <input
                            type="text"
                            value={customPlayer.personality}
                            onChange={(e) => setCustomPlayer({ ...customPlayer, personality: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-[#02050c] border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#0ea5e9]"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase text-slate-400">Tiểu sử xuất thân</span>
                          <textarea
                            value={customPlayer.background}
                            onChange={(e) => setCustomPlayer({ ...customPlayer, background: e.target.value })}
                            className="w-full h-16 bg-slate-50 dark:bg-[#02050c] border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#0ea5e9] resize-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase text-slate-400">Khả năng sở tài và Kỹ năng nổi tiếng</span>
                          <input
                            type="text"
                            value={customPlayer.skills}
                            onChange={(e) => setCustomPlayer({ ...customPlayer, skills: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-[#02050c] border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Action layout button to confirm launch sandbox */}
              <div className="p-4 bg-slate-100 dark:bg-[#060b18]/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 flex flex-col md:flex-row items-center justify-between gap-4 mt-2">
                <div className="flex items-center gap-2.5">
                  <AlertCircle size={16} className="text-[#38bdf8] shrink-0" />
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                    AI sẽ tự phục hình thông tin bối cảnh & nhân vật, tự động cập nhật bách khoa bối cảnh khi bạn tương tác trong trận đấu.
                  </p>
                </div>

                <Button
                  onClick={handleLaunchSandboxGame}
                  className="w-full md:w-auto py-3.5 px-8 font-black uppercase tracking-widest text-[#0ea5e9] hover:text-white hover:bg-[#0ea5e9] bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 group shrink-0 active:scale-95 cursor-pointer"
                >
                  Bắt Đầu Chơi Ngay
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FanficScreen;
