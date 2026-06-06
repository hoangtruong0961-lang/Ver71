import React, { useMemo, useState, useEffect } from "react";
import {
  Database,
  Bookmark,
  Compass,
  Cpu,
  ArrowRight,
  Activity,
  Award,
  ChevronRight,
  Eye,
  Sparkles,
  Search,
  Plus,
  Trash2,
  Settings,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Pin,
  AlertTriangle,
  Flame,
  CheckCircle,
  AlertCircle,
  BarChart4,
  RefreshCw,
  X,
  Radio,
  BookOpen,
  LayoutGrid,
  List
} from "lucide-react";
import { VectorData } from "../../../../../services/db/indexedDB";
import { GraphRAGService, GraphNode, GraphEdge } from "../../../../../services/ai/graph/GraphRAGService";

interface EncyclopediaDashboardProps {
  entries: VectorData[];
  onSelect: (id: string) => void;
  onAddManualWithTemplate: (template: Partial<VectorData>) => void;
  CATEGORY_MAP: Record<
    string,
    { label: string; color: string; icon: any }
  >;
  onCategoryFilterChange: (cat: string | null) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string, enabled: boolean) => void;
  campaignId?: string;
}

const STARTER_TEMPLATES = [
  {
    title: "Hiệp sĩ Lưu đày Galahad",
    category: "character",
    keyword: "Galahad",
    keywords: ["Galahad", "Lưu đày", "Hiệp sĩ"],
    description: "Hồ sơ tráng sĩ kiếm sĩ vương quốc với bi kịch rạn nứt tâm hồn và lời nguyền tiềm tàng.",
    align: "Lawful Good (Chính trực)",
    role: "Người đỡ đầu & Đồng minh (Mentor & Ally)",
    text: `{
  "name": "Hiệp sĩ Galahad",
  "gender": "Nam",
  "age": "37 tuổi",
  "appearance": "Khoác bộ giáp thép rạn nứt bị phong hóa bởi mưa cát, khoác áo choàng rách bạc màu. Ánh mắt trầm uất và có một vết sẹo dài chạy dọc má trái.",
  "voiceAndTone": "Văn phong trầm ấm, nghiêm nghị, pha chút mệt mỏi của kẻ phong sương.",
  "personality": "Kiên trung, ít nói, tôn trọng danh dư nhưng thực tế và cảnh giác cao độ.",
  "coreValues": "Luôn bảo vệ kẻ yếu thế, không bao giờ bội ước lời thề kiếm sĩ.",
  "hardLimits": "Tuyệt đối không ra tay với trẻ em và phụ nữ không có khả năng tự vệ.",
  "definingEvents": "Bị trục xuất khỏi Thánh Điện Ánh Sáng sau khi phát hiện giáo hoàng thông đồng với Đại Quỷ.",
  "background": "Từng là Đệ nhất Kiếm khiên hành lễ, nay sống ẩn dật bằng nghề săn tiền quỷ ở Vùng Biên Viễn.",
  "currentMood": "Trầm mặc, cảnh giác nhưng sẵn lòng giúp đỡ những tâm hồn lạc lối hòng tìm lại sự cứu rỗi.",
  "relationshipTags": "Kính trọng người giữ luật lệ chân chính, căm ghét ngọn lửa cuồng tín Thánh Điện.",
  "strengths": "Cận chiến tuyệt đỉnh, khiên chắn có khả năng phản lại ma pháp cấp trung.",
  "weaknesses": "Cánh tay phải bị nguyền rủa bởi ma khí, thỉnh thoảng lên cơn đau co thắt thần kinh.",
  "narrativeRole": "Mentor & Ally",
  "contradictions": "Muốn từ bỏ thanh kiếm danh dự để làm nông phu, nhưng bản năng hộ vệ luôn thôi thúc ra tay cứu trợ.",
  "failureMode": "Khi lời nguyền ma khí bùng phát, anh sẽ tự xích mình lại hoặc lao vào rừng sâu gầm rú điên loạn hòng tránh làm thương tổn đồng đội.",
  "exampleMessages": "Kiếm là để bảo vệ, không phải để khoe khoang quyền lực.\\nMột lời thề đã lập, có chết cũng phải giữ lấy trọn vẹn.\\nCẩn thận đó người trẻ, bóng tối dưới tán thông già này không tầm thường đâu."
}`,
    rpg_attrs: {
      alignment: "Chính Trực Khắc Khổ (Lawful Good)",
      role: "Đồng minh cốt cán / Mentor chính",
      danger_level: "B (Khống chế bởi ma khí nguyền rủa)",
      points_of_interest: "Vùng biên thùy sương gió / Quán lữ hành hoang phế"
    }
  },
  {
    title: "Thung lũng Sương Hải",
    category: "location",
    keyword: "Thung lũng Sương Hải",
    keywords: ["Sương Hải", "Thung lũng", "Eldoria"],
    description: "Nhật ký vùng đất sương mù huyền ảo bí ẩn, chứa đầy mana kết tinh lạnh giá lý tưởng cho pháp thuật hệ băng.",
    text: "Thung lũng sương mù vĩnh cửu nằm ở cực bắc đại lục Eldoria. Vào ban đêm, các luồng sương lam lấp lánh (mana hóa hơi) dâng cao như sóng biển, nhấn chìm toàn bộ rừng thông cổ thụ trong ánh sáng dị kỳ. Nơi đây là thánh địa phong ấn Thần Thú Băng Hà và chứa đầy các quặng ma thạch lạnh giá.",
    rpg_attrs: {
      climate: "Lạnh giá quanh năm, sương mù ma pháp dày đặc đêm xuống.",
      ruler: "Nữ vương bộ tộc Tuyết Nhung - Kaelen Sương Tuyết.",
      population: "Khoảng 1,500 tinh linh tuyết và dị tộc cư ngụ rìa hang đá.",
      danger_level: "A (Nguy hiểm cao do quái thú băng giá)",
      points_of_interest: "Đền thờ Thần Băng Cổ, Hang quặng Tinh Pha Lê."
    }
  },
  {
    title: "Mặt nạ Hắc vực",
    category: "item",
    keyword: "Mặt nạ Hắc vực",
    keywords: ["Hắc vực", "Mặt nạ", "Cổ vật"],
    description: "Món ma khí cường đại nhưng chứa đựng cái giá rùng rợn trói buộc lấy linh thức vật chủ đeo nó.",
    text: "Mặt nạ cổ xưa rèn từ mảnh sọ thần thú bóng tối bị phong ấn. Người đeo lên có thể nhìn thấu trong đêm, miễn nhiễm với ảo ảnh và có khả năng hòa tan bản thân vào bóng tối vật lý để ẩn thân. Tuy nhiên, đeo quá lâu sẽ nghe thấy những lời thì thầm gào thét tinh thần thúc giục hủy hoại đồng minh.",
    rpg_attrs: {
      rarity: "Epic (Sử thi cổ đại)",
      item_type: "Cổ vật hỗ trợ ẩn thân & Ma pháp tinh thần",
      abilities: "Hòa mình làm một với bóng tối, Nhãn quan Chân lý vạn vật.",
      value_copper: "8,500 đồng tinh kim cổ."
    }
  },
  {
    title: "Hội Đao Phủ Bạc",
    category: "faction",
    keyword: "Hội Đao Phủ Bạc",
    keywords: ["Đao Phủ Bạc", "Sát thủ", "Ám sát"],
    description: "Phe cánh sát thủ mật nghị tôn thờ pháp định, hoạt động ngầm phục vụ Vương triều Thái Dương.",
    text: "Tổ chức sát thủ bảo hoàng bí mật phục tùng Hoàng triều Mặt trời lặn. Họ mặc quan phục xám tro, đeo mặt nạ bạc hình quạ và sử dụng song đao rèn từ bụi bạc thánh tẩy ma quỷ. Sứ mệnh của hội là ám sát bất kỳ ai sử dụng cấm thuật hắc ám hoặc đe dọa hoàng tộc.",
    rpg_attrs: {
      alignment: "Lawful Neutral (Pháp định trung lập)",
      leader: "Tổng đốc Ám ảnh - Raymond Đao Phủ Bạc.",
      influence: "Cực cao (Chi phối bóng tối chính trị đế quốc)",
      hq: "Nhà ngục ngầm Dưới Đáy Mồ, Hoàng thành Solar.",
      allies_enemies: "Đồng minh: Hoàng tộc Solar | Kẻ thù: Giáo phái Hắc Vực."
    }
  },
  {
    title: "Đại hồng thủy Pha lê",
    category: "event",
    keyword: "Đại hồng thủy Pha lê",
    keywords: ["Đại hồng thủy", "Tai họa", "Kỷ thứ ba"],
    description: "Biến cố thảm họa diệt vong một nền văn minh rực rỡ bởi lòng tham và sự mất kiểm soát nguồn lõi ma năng thần bí.",
    text: "Biến cố thảm khốc xảy ra vào năm 342 của Kỷ thứ ba. Lõi tinh năng của vương quốc cổ đại Aethelgard quá tải và phát nổ, giải phóng lượng ma năng tinh pha lê lỏng khổng lồ chảy tràn như dung nham nguội, hóa đá và đóng băng vĩnh viễn 80% cư dân cùng đất đai trong bán kính 100 dặm thành những khối pha lê bất tử.",
    rpg_attrs: {
      timeline_date: "Năm 342, Kỷ thứ ba (Thời đại Sụp đổ).",
      characters_involved: "Pháp vương Magnus Đệ lục, Đại phù thủy Cheryl.",
      consequences: "Biến Aethelgard trù phú thành Sa mạc Pha Lê chết chóc hoang phế."
    }
  },
];

export const EncyclopediaDashboard: React.FC<EncyclopediaDashboardProps> = ({
  entries,
  onSelect,
  onAddManualWithTemplate,
  CATEGORY_MAP,
  onCategoryFilterChange,
  onDelete,
  onToggleStatus,
  campaignId,
}) => {
  const [activeTemplateTab, setActiveTemplateTab] = useState<string>("character");
  const [hoveredNode, setHoveredNode] = useState<any | null>(null);
  const [activeFilterIndicator, setActiveFilterIndicator] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchTips, setShowSearchTips] = useState(false);
  const [showGraph, setShowGraph] = useState(true);
  const [graphViewMode, setGraphViewMode] = useState<'constellation' | 'graphrag'>('constellation');
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAIHuyenCo, setShowAIHuyenCo] = useState(false);
  const [layoutStyle, setLayoutStyle] = useState<'cards' | 'dense'>('cards');

  // AI Logic Optimization states
  const [complianceScan, setComplianceScan] = useState(true);
  const [multiTrigger, setMultiTrigger] = useState(true);
  const [antiDrift, setAntiDrift] = useState(false);
  const [deepReasoning, setDeepReasoning] = useState(true);
  const [optimizingState, setOptimizingState] = useState<'idle' | 'running' | 'success'>('idle');
  const [optimizationProgress, setOptimizationProgress] = useState(0);

  const handleOptimizeLogic = () => {
    setOptimizingState('running');
    setOptimizationProgress(5);
    const interval = setInterval(() => {
      setOptimizationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setOptimizingState('success');
          setTimeout(() => {
            setOptimizingState('idle');
          }, 3500);
          return 100;
        }
        return prev + 20;
      });
    }, 120);
  };

  // Load GraphRAG nodes and edges dynamically when graph View Mode is graphrag
  useEffect(() => {
    if (graphViewMode === 'graphrag' && campaignId) {
      setIsLoadingGraph(true);
      Promise.all([
        GraphRAGService.getAllNodes(campaignId),
        GraphRAGService.getAllEdges(campaignId)
      ]).then(([nodes, edges]) => {
        setGraphNodes(nodes || []);
        setGraphEdges(edges || []);
      }).catch(err => {
        console.error("Failed to load GraphRAG nodes/edges:", err);
      }).finally(() => {
        setIsLoadingGraph(false);
      });
    }
  }, [graphViewMode, campaignId]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      
      if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.getElementById("smart-search-bar");
        searchInput?.focus();
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        onAddManualWithTemplate?.({
          category: "world",
          keyword: "",
          keywords: [],
          text: ""
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAddManualWithTemplate]);

  // Core Smart Search Parser
  const parsedSearchFilter = (item: VectorData): boolean => {
    if (!searchTerm.trim()) return true;
    
    const tokens = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    
    return tokens.every(token => {
      if (token.startsWith('@')) {
        const cat = token.slice(1);
        return (item.category || '').toLowerCase() === cat;
      }
      
      if (token.startsWith('#')) {
        const tag = token.slice(1);
        const keywords = item.keywords || [];
        return keywords.some(k => k.toLowerCase().includes(tag));
      }
      
      if (token.startsWith('p>') || token.startsWith('p<') || token.startsWith('p:')) {
        const op = token.charAt(1);
        const val = parseInt(token.slice(2));
        const entryPriority = item.priority || 50;
        if (isNaN(val)) return true;
        if (op === '>') return entryPriority > val;
        if (op === '<') return entryPriority < val;
        if (op === ':') return entryPriority === val;
      }
      
      if (token.startsWith('trigger:')) {
        const mode = token.slice(8);
        return (item.triggerMode || '').toLowerCase() === mode;
      }

      if (token.startsWith('status:')) {
        const stat = token.slice(7);
        const isEnabled = item.isEnabled !== false;
        if (stat === 'enabled' || stat === 'on') return isEnabled;
        if (stat === 'disabled' || stat === 'off') return !isEnabled;
      }
      
      if (token.startsWith('linked:')) {
        const val = token.slice(7);
        const hasLinks = (item.relatedEntries || []).length > 0;
        if (val === 'true') return hasLinks;
        if (val === 'false') return !hasLinks;
      }
      
      return (item.keyword || '').toLowerCase().includes(token) ||
             (item.text || '').toLowerCase().includes(token);
    });
  };

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (activeFilterIndicator) {
      result = result.filter(e => e.category === activeFilterIndicator);
    }
    return result.filter(parsedSearchFilter);
  }, [entries, activeFilterIndicator, searchTerm]);

  // Convert priority to human-readable Tier
  const getPriorityTier = (pr: number = 50) => {
    if (pr >= 90) return { label: "S Class", color: "text-red-400 border-red-500/20 bg-red-500/10 shadow-[1px_1px_3px_#04060b]" };
    if (pr >= 75) return { label: "A Class", color: "text-amber-400 border-amber-500/20 bg-amber-500/10 shadow-[1px_1px_3px_#04060b]" };
    if (pr >= 50) return { label: "B Class", color: "text-violet-400 border-violet-500/20 bg-violet-500/10 shadow-[1px_1px_3px_#04060b]" };
    if (pr >= 30) return { label: "C Class", color: "text-sky-400 border-sky-500/20 bg-sky-500/10 shadow-[1px_1px_3px_#04060b]" };
    return { label: "D Class", color: "text-zinc-400 border-zinc-500/10 bg-zinc-500/5 shadow-[1px_1px_3px_#04060b]" };
  };

  // Health Check Diagnostic Engine
  const healthChecks = useMemo(() => {
    const issues: Array<{ id: string; type: "error" | "warning" | "info"; msg: string; target: string }> = [];
    const keywordMap: Record<string, string[]> = {};

    entries.forEach(item => {
      const isEnabled = item.isEnabled !== false;
      
      if (item.triggerMode !== 'always' && (!item.keywords || item.keywords.length === 0) && (!item.keyword)) {
        issues.push({
          id: `no-kw-${item.id}`,
          type: "error",
          msg: `Bài viết bối cảnh này không có từ khóa kích hoạt nào, AI sẽ không bao giờ cảm ứng được`,
          target: item.keyword || item.title || "Untitled"
        });
      }

      const byteLen = (item.text || '').length;
      if (byteLen > 4000) {
        issues.push({
          id: `too-long-${item.id}`,
          type: "warning",
          msg: `Nội dung quá dài (~${Math.round(byteLen/3.8)} Tokens). Nguy cơ gây tràn bộ nhớ đệm bối cảnh`,
          target: item.keyword || item.title || "Untitled"
        });
      }

      if (!isEnabled && (item.priority || 50) >= 80) {
        issues.push({
          id: `hi-disabled-${item.id}`,
          type: "info",
          msg: `Bối cảnh bậc cao (PR:${item.priority}) đang tạm tắt, hãy bật lại nếu AI quên dữ kiện quan trọng`,
          target: item.keyword || item.title || "Untitled"
        });
      }

      if (isEnabled && (!item.relatedEntries || item.relatedEntries.length === 0)) {
        issues.push({
          id: `isolated-${item.id}`,
          type: "info",
          msg: `Bài viết cô độc (chưa liên kết với bất kỳ mốc thế giới quan nào khác)`,
          target: item.keyword || item.title || "Untitled"
        });
      }

      const kws = [...(item.keywords || [])];
      if (item.keyword) kws.push(item.keyword);
      kws.forEach(kw => {
        const normalized = kw.trim().toLowerCase();
        if (normalized) {
          if (!keywordMap[normalized]) keywordMap[normalized] = [];
          keywordMap[normalized].push(item.keyword || item.title || "Untitled");
        }
      });
    });

    Object.entries(keywordMap).forEach(([kw, items]) => {
      if (items.length > 1) {
        issues.push({
          id: `dup-kw-${kw}`,
          type: "warning",
          msg: `Từ khóa "${kw}" bị trùng lặp kích hoạt chéo giữa các bài viết: [${items.join(', ')}]`,
          target: `Khắp chéo #${kw}`
        });
      }
    });

    return issues.slice(0, 10);
  }, [entries]);

  // Token Budget Visualizer Calculations
  const tokenStatistics = useMemo(() => {
    const getTokens = (text: string) => Math.ceil((text || '').length / 3.8);

    const alwaysEntriesBytes = entries
      .filter(e => e.isEnabled !== false && (e.triggerMode === 'always' || e.isSticky))
      .reduce((acc, e) => acc + (e.text || '').length, 0);

    const potentialPoolBytes = entries
      .filter(e => e.isEnabled !== false && e.triggerMode !== 'always' && !e.isSticky)
      .reduce((acc, e) => acc + (e.text || '').length, 0);

    const alwaysTokens = getTokens(alwaysEntriesBytes);
    const potentialTokens = getTokens(potentialPoolBytes);
    const budgetLimit = 8000;
    const percentage = Math.min(100, Math.round((alwaysTokens / budgetLimit) * 100));

    return {
      activeTokens: alwaysTokens,
      potentialTokens,
      percentage,
      limit: budgetLimit,
      isDanger: alwaysTokens > budgetLimit * 0.85
    };
  }, [entries]);

  // Stable Node Coordinates inside Clustered Circular Graph View
  const cosmosNodes = useMemo(() => {
    if (entries.length === 0) return [];

    const visibleEntries = entries.slice(0, 18);
    const n = visibleEntries.length;
    const centerX = 200;
    const centerY = 180;

    return visibleEntries.map((entry, index) => {
      const hashCategory = (entry.category || 'world').charCodeAt(0) % 5;
      const angle = (index * 2 * Math.PI) / n;
      const radius = 100 + (hashCategory * 15) + (index % 2 === 0 ? 15 : -15);

      const cx = centerX + Math.cos(angle) * radius;
      const cy = centerY + Math.sin(angle) * radius;

      return {
        id: entry.id,
        keyword: entry.keyword || "Untitled",
        category: entry.category || "world",
        cx,
        cy,
        entry,
        priority: entry.priority || 50,
      };
    });
  }, [entries]);

  // Compute connections
  const cosmosLinks = useMemo(() => {
    const links: { x1: number; y1: number; x2: number; y2: number; id: string; strong: boolean }[] = [];
    if (cosmosNodes.length < 2) return [];

    for (let i = 0; i < cosmosNodes.length; i++) {
      const nodeA = cosmosNodes[i];
      const textA = (nodeA.entry.text || "").toLowerCase();

      for (let j = i + 1; j < cosmosNodes.length; j++) {
        const nodeB = cosmosNodes[j];
        const keywordB = (nodeB.entry.keyword || "").toLowerCase();
        const textB = (nodeB.entry.text || "").toLowerCase();
        const keywordA = (nodeA.entry.keyword || "").toLowerCase();

        const isRelated =
          (keywordB && textA.includes(keywordB)) ||
          (keywordA && textB.includes(keywordA)) ||
          nodeA.entry.relatedEntries?.includes(nodeB.id) ||
          nodeB.entry.relatedEntries?.includes(nodeA.id);

        if (isRelated) {
          const directMatch = (keywordB && textA.includes(keywordB)) || (keywordA && textB.includes(keywordA));
          links.push({
            x1: nodeA.cx,
            y1: nodeA.cy,
            x2: nodeB.cx,
            y2: nodeB.cy,
            id: `${nodeA.id}-${nodeB.id}`,
            strong: directMatch || (nodeA.category === nodeB.category),
          });
        }
      }
    }
    return links.slice(0, 40);
  }, [cosmosNodes]);

  // Stable Node Coordinates inside Clustered Circular Graph View for GraphRAG
  const ragNodes = useMemo(() => {
    if (graphNodes.length === 0) return [];

    const visibleNodes = graphNodes.slice(0, 24);
    const n = visibleNodes.length;
    const centerX = 200;
    const centerY = 180;

    return visibleNodes.map((node, index) => {
      const hashLabel = (node.label || 'Entity').charCodeAt(0) % 5;
      const angle = (index * 2 * Math.PI) / n;
      const radius = 95 + (hashLabel * 16) + (index % 2 === 0 ? 12 : -12);

      const cx = centerX + Math.cos(angle) * radius;
      const cy = centerY + Math.sin(angle) * radius;

      return {
        id: node.id,
        name: node.name,
        label: node.label || "Entity",
        cx,
        cy,
        node,
        description: node.description || ""
      };
    });
  }, [graphNodes]);

  // Compute GraphRAG connections
  const ragLinks = useMemo(() => {
    const links: { x1: number; y1: number; x2: number; y2: number; id: string; relationship: string; description: string }[] = [];
    if (ragNodes.length < 2) return [];

    graphEdges.forEach((edge) => {
      const sourceNode = ragNodes.find(n => n.id === edge.source);
      const targetNode = ragNodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        links.push({
          x1: sourceNode.cx,
          y1: sourceNode.cy,
          x2: targetNode.cx,
          y2: targetNode.cy,
          id: edge.id,
          relationship: edge.relationship || "related_to",
          description: edge.description || ""
        });
      }
    });

    return links;
  }, [ragNodes, graphEdges]);

  // Stars coordinates for realistic star field background inside the map
  const starsField = useMemo(() => {
    const arr: { cx: number; cy: number; r: number; opacity: number }[] = [];
    let seed = 42;
    const pseudoRandom = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 30; i++) {
      arr.push({
        cx: Math.floor(pseudoRandom() * 400),
        cy: Math.floor(pseudoRandom() * 360),
        r: pseudoRandom() * 1.5 + 0.3,
        opacity: pseudoRandom() * 0.7 + 0.3
      });
    }
    return arr;
  }, []);

  const handleCategoryFilterClick = (catKey: string) => {
    if (activeFilterIndicator === catKey) {
      onCategoryFilterChange(null);
      setActiveFilterIndicator(null);
    } else {
      onCategoryFilterChange(catKey);
      setActiveFilterIndicator(catKey);
    }
  };

  const selectedTemplate = useMemo(() => {
    return STARTER_TEMPLATES.find((t) => t.category === activeTemplateTab) || STARTER_TEMPLATES[0];
  }, [activeTemplateTab]);

  return (
    <div 
      id="encyclopedia-manager-root" 
      className="flex-1 flex flex-col h-full bg-[#0d1220] text-slate-100 overflow-y-auto custom-scrollbar relative font-sans selection:bg-sky-500/20 selection:text-sky-200 p-4 lg:p-6"
    >
      {/* Absolute Noise Texture for depth */}
      <div 
        className="absolute inset-0 bg-repeat bg-center opacity-[0.015] pointer-events-none" 
        style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/dark-matter.png')" }} 
      />
      
      <div className="max-w-7xl mx-auto w-full space-y-8 pb-20 relative z-10">
        
        {/* Visual Title Header Block - Premium extruded Neumorphic structure */}
        <div 
          id="portal-header-banner"
          className="p-6 md:p-8 bg-[#0d1220] rounded-[32px] shadow-[8px_8px_16px_#04060c,_-8px_-8px_16px_#161e35] border border-[#1b253b]/20 flex flex-col xl:flex-row items-center justify-between gap-6 transition-all"
        >
          <div className="text-center xl:text-left">
            <h1 className="font-sans text-2xl lg:text-3xl font-black tracking-wider uppercase flex items-center justify-center xl:justify-start gap-3 select-none text-sky-400">
              <BookOpen size={28} className="text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]" />
              THƯ KHỐ VŨ TRỤ
            </h1>
            <p className="font-mono text-[9px] text-slate-400 mt-1 uppercase tracking-widest font-extrabold flex items-center gap-1.5 justify-center xl:justify-start">
              <span>Đại Học Giới Thiết Lập</span>
              <span className="text-sky-500/50">•</span>
              <span className="text-sky-455">Tactile Neumorphic Encyclopedia Portal</span>
            </p>
          </div>
          
          {/* Main Controls - Flat soft sunken dock with extruded buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 bg-[#090d18] p-2 rounded-2xl shadow-[inset_3px_3px_6px_#04050a,_inset_-3px_-3px_6.5px_#121b2d] border border-[#141b2c]/20 shrink-0 select-none">
            <button
              onClick={() => setShowGraph(!showGraph)}
              className={`px-4 py-2 text-[9px] font-mono font-bold uppercase rounded-xl transition-all duration-300 flex items-center gap-1.5 cursor-pointer touch-manipulation text-center ${
                showGraph
                  ? "bg-[#0d1220] text-sky-400 shadow-[2px_2px_4px_#04050a,_-2px_-2px_4px_#161e35] border border-[#152342]/20"
                  : "text-slate-400 hover:text-slate-250 border border-transparent"
              }`}
            >
              <Compass size={12} className={showGraph ? "animate-[spin_24s_linear_infinite] text-sky-400" : ""} />
              Mạng Lưới {showGraph ? "BẬT" : "TẮT"}
            </button>

            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`px-4 py-2 text-[9px] font-mono font-bold uppercase rounded-xl transition-all duration-300 flex items-center gap-1.5 cursor-pointer touch-manipulation text-center ${
                showTemplates
                  ? "bg-[#0d1220] text-indigo-400 shadow-[2px_2px_4px_#04050a,_-2px_-2px_4px_#161e35] border border-[#1d1b46]/20"
                  : "text-slate-400 hover:text-slate-250 border border-transparent"
              }`}
            >
              <Award size={12} className={showTemplates ? "text-indigo-400" : ""} />
              Mẫu Điển {showTemplates ? "BẬT" : "TẮT"}
            </button>

            <button
              onClick={() => setShowAIHuyenCo(!showAIHuyenCo)}
              className={`px-4 py-2 text-[9px] font-mono font-bold uppercase rounded-xl transition-all duration-300 flex items-center gap-1.5 cursor-pointer touch-manipulation text-center ${
                showAIHuyenCo
                  ? "bg-[#0d1220] text-purple-400 shadow-[2px_2px_4px_#04050a,_-2px_-2px_4px_#161e35] border border-[#3e1e55]/20"
                  : "text-slate-400 hover:text-slate-250 border border-transparent"
              }`}
            >
              <Activity size={12} className={showAIHuyenCo ? "text-purple-400 animate-pulse" : ""} />
              Chẩn Đoán Logic {showAIHuyenCo ? "ON" : "OFF"}
            </button>

            <div className="w-[1px] h-4 bg-slate-800/60 mx-1.5 self-center" />

            <button
              onClick={() => setLayoutStyle(layoutStyle === 'cards' ? 'dense' : 'cards')}
              className="px-4 py-2 text-[9px] font-mono font-bold uppercase rounded-xl bg-[#0d1220] text-sky-400 shadow-[2px_2px_4px_#04050a,_-2px_-2px_4px_#161e35] hover:text-sky-300 border border-[#141b2c]/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {layoutStyle === 'cards' ? <LayoutGrid size={11} /> : <List size={11} />}
              <span>{layoutStyle === 'cards' ? "Dạng Lưới" : "Thu Gọn"}</span>
            </button>
          </div>
        </div>

        {/* Overview Portal Section - 4 Column Neumorphic Stats Tiles Grid */}
        <div id="portal-overview-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 select-none">
          {/* Tile 1: Total Entries */}
          <div className="bg-[#0d1220] rounded-2xl sm:rounded-[24px] p-4 sm:p-5 shadow-[6px_6px_12px_#04060c,_-6px_-6px_12px_#161e35] border border-[#1b253b]/20 flex flex-col justify-between group hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-extrabold uppercase text-slate-400 tracking-wider">Tổng bách khoa</span>
              <BookOpen className="text-sky-400 w-4 h-4" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-100">{entries.length}</span>
              <span className="text-[10px] font-mono font-bold text-slate-500">cổ bản</span>
            </div>
            <div className="mt-2 text-[8.5px] font-sans font-bold text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Đã lập chỉ mục cục bộ
            </div>
          </div>

          {/* Tile 2: High Priority (S-Class) */}
          <div className="bg-[#0d1220] rounded-2xl sm:rounded-[24px] p-4 sm:p-5 shadow-[6px_6px_12px_#04060c,_-6px_-6px_12px_#161e35] border border-[#1b253b]/20 flex flex-col justify-between group hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-extrabold uppercase text-slate-400 tracking-wider">Trọng điểm bậc S</span>
              <Award className="text-red-400 w-4 h-4 animate-pulse" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-red-405">{entries.filter(e => e.isEnabled !== false && (e.priority || 50) >= 80).length}</span>
              <span className="text-[10px] font-mono font-bold text-slate-500">khối bối cảnh</span>
            </div>
            <div className="mt-2 text-[8.5px] font-sans font-bold text-red-450">
              Sẵn sàng truyền tư duy cốt lõi
            </div>
          </div>

          {/* Tile 3: Always Active (Always-ON) */}
          <div className="bg-[#0d1220] rounded-2xl sm:rounded-[24px] p-4 sm:p-5 shadow-[6px_6px_12px_#04060c,_-6px_-6px_12px_#161e35] border border-[#1b253b]/20 flex flex-col justify-between group hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-extrabold uppercase text-slate-400 tracking-wider">Thức thường trực</span>
              <Pin className="text-amber-400 w-4 h-4" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-400">{entries.filter(e => e.isEnabled !== false && e.triggerMode === 'always').length}</span>
              <span className="text-[10px] font-mono font-bold text-slate-500">mũi chỉ định</span>
            </div>
            <div className="mt-2 text-[8.5px] font-sans font-bold text-amber-500/90 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
              Luôn ở trong khung đệm
            </div>
          </div>

          {/* Tile 4: Energy Memory Gauge */}
          <div className="bg-[#0d1220] rounded-2xl sm:rounded-[24px] p-4 sm:p-5 shadow-[6px_6px_12px_#04060c,_-6px_-6px_12px_#161e35] border border-[#1b253b]/20 flex flex-col justify-between group hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-extrabold uppercase text-slate-400 tracking-wider">Bộ đệm tối đa</span>
              <Cpu className="text-purple-400 w-4 h-4" />
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className={`text-xl sm:text-2xl font-black ${tokenStatistics.isDanger ? 'text-red-450' : 'text-sky-400'}`}>
                {tokenStatistics.percentage}%
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-500">
                ({tokenStatistics.activeTokens.toLocaleString()} TKn)
              </span>
            </div>
            <div className="mt-2">
              <div className="w-full h-1.5 bg-[#090d18] rounded-full p-[1px] border border-[#141b2c]/10 shadow-inner">
                <div 
                  className={`h-full rounded-full ${tokenStatistics.isDanger ? 'bg-red-500' : 'bg-gradient-to-r from-sky-500 to-indigo-500'}`}
                  style={{ width: `${tokenStatistics.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Central Search, Tags and Shortcuts Station */}
        <div className="bg-[#0d1220] rounded-[28px] shadow-[8px_8px_16px_#04060c,_-8px_-8px_16px_#161e35] p-6 border border-[#1b253b]/20 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left Search input Box */}
            <div className="lg:col-span-7 space-y-1.5 text-left">
              <label htmlFor="smart-search-bar" className="text-[10px] font-mono font-black uppercase text-slate-400 tracking-widest pl-1">
                Tìm kiếm tích hợp đa ký tự liên hội
              </label>
              <div className="relative">
                <div className="bg-[#090d18] rounded-2xl shadow-[inset_4px_4px_8px_#04060c,_inset_-4px_-4px_8px_#161e35] border border-[#141b2c]/10 flex items-center px-4 py-3.5 w-full">
                  <Search size={18} className="text-sky-400 mr-3 shrink-0" />
                  <input
                    id="smart-search-bar"
                    type="text"
                    placeholder="Nhập kí tự lẻ hoặc từ khóa, hoặc gõ '@character' '#thung-lung' 'p>65' 'status:on'..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-transparent outline-none border-none text-slate-200 placeholder-slate-500 text-xs sm:text-sm font-sans font-semibold"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="text-slate-500 hover:text-sky-400 transition-colors ml-2 pointer-events-auto touch-manipulation"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Shortcuts & Actions Block */}
            <div className="lg:col-span-5 flex flex-wrap gap-4 items-center justify-start lg:justify-end text-left">
              <div className="text-[10px] font-mono text-slate-400 font-bold bg-[#0a0f1b]/50 px-3.5 py-2.5 rounded-2xl border border-[#141b2c]/10 shadow-inner flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-450 animate-pulse"></span>
                <span>Ấn <kbd className="bg-[#04060c] text-sky-400 px-1 py-0.5 rounded font-bold shadow-sm">/</kbd> để Tìm • <kbd className="bg-[#04060c] text-sky-400 px-1 py-0.5 rounded font-bold shadow-sm">N</kbd> để Tạo Mới</span>
              </div>

              <button
                onClick={() => onAddManualWithTemplate({
                  category: "world",
                  keyword: "",
                  keywords: [],
                  text: ""
                })}
                className="px-5 py-3.5 bg-[#0d1220] text-sky-400 font-sans font-black text-xs uppercase rounded-2xl shadow-[4px_4px_8px_#04060c,_-4px_-4px_8px_#161e35] hover:shadow-[5px_5px_10px_#04060c,_-5px_-5px_10px_#1d2a4c] active:shadow-[inset_2px_2px_4px_#04060c,_inset_-2px_-2px_4px_#161e35] hover:text-sky-300 transition-all cursor-pointer flex items-center gap-2 border border-[#1b253b]/20"
              >
                <Plus size={14} /> Trực dệt cổ bản
              </button>
            </div>
          </div>

          {/* Expanded Grid Category Filters: Large Neumorphic Interactive Tiles Block */}
          <div className="space-y-3.5 pt-2 text-left">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#38bdf8]/90">
                Phân Loại Thể Kỷ Tri Thức
              </span>
              {activeFilterIndicator && (
                <button
                  onClick={() => {
                    onCategoryFilterChange(null);
                    setActiveFilterIndicator(null);
                  }}
                  className="text-[9px] font-mono font-bold text-sky-400 hover:text-sky-300 uppercase tracking-widest flex items-center gap-1"
                >
                  ✕ Hủy bỏ tiêu điểm bách khoa
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 select-none">
              {Object.entries(CATEGORY_MAP).map(([catKey, catInfo]) => {
                const count = entries.filter(e => e.category === catKey).length;
                const isSelected = activeFilterIndicator === catKey;
                const IconComp = catInfo.icon;

                return (
                  <button
                    key={catKey}
                    onClick={() => handleCategoryFilterClick(catKey)}
                    className={`p-3.5 rounded-2xl text-center transition-all duration-300 flex flex-col items-center justify-center gap-2 relative overflow-hidden border cursor-pointer group ${
                      isSelected
                        ? "bg-[#0d1220] text-sky-400 border-sky-500/30 shadow-[inset_3px_3px_6px_#04050a,_inset_-3px_-3px_6px_#161e35]"
                        : "bg-[#0d1220] border-[#1b253b]/20 text-slate-400 shadow-[4px_4px_8px_#04060c,_-4px_-4px_8px_#161e35] hover:border-sky-500/20 hover:scale-[1.03]"
                    }`}
                  >
                    <div className={`p-2 rounded-xl transition-all ${
                      isSelected 
                        ? "text-sky-400 bg-[#090d18] shadow-inner" 
                        : "text-slate-400 bg-[#090d18]/40 group-hover:text-sky-400"
                    }`}>
                      <IconComp size={16} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[8.5px] font-mono font-bold uppercase tracking-wider block truncate">
                        {catInfo.label}
                      </span>
                      <span className="text-[10px] font-sans font-black text-slate-150 block mt-0.5">
                        {count} bản
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dual-Pane Modern Grid Architecture */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start text-left">
          
          {/* LEFT CONSOLE SIDEBAR: Starfield Constellation, Custom Logic Toggles & Mythos Presets */}
          <div className="xl:col-span-5 space-y-8 xl:sticky xl:top-4">
            
            {/* NEUMORPHIC CONSTELLATION MAP/NETWORK BLOCK */}
            {showGraph && (
              <div className="bg-[#0d1220] border border-[#1b253b]/20 rounded-[28px] shadow-[8px_8px_16px_#04060c,_-8px_-8px_16px_#161e35] p-6 flex flex-col min-h-[440px] relative overflow-hidden select-none">
                
                {/* Header view toggle row */}
                <div className="flex items-center justify-between border-b border-[#141b2c]/20 pb-4 mb-4 shrink-0 z-10">
                  <div className="flex items-center gap-2">
                    <Compass size={14} className={`text-sky-400 ${graphViewMode === 'graphrag' ? 'text-purple-400 animate-[spin_32s_linear_infinite]' : 'animate-[spin_120s_linear_infinite]'}`} />
                    <h3 className="font-sans text-[10px] font-black text-sky-400 uppercase tracking-widest">
                      {graphViewMode === 'graphrag' ? "MỘT BẢN THƯ THỰC THỂ (GRAPHRAG)" : "TINH ĐỒ BỐI CẢNH (CONSTELLATION)"}
                    </h3>
                  </div>

                  {/* Neumorphic view mode tab slider */}
                  <div className="flex bg-[#090d18] border border-[#141b2c]/10 p-1 rounded-xl shadow-inner shrink-0">
                    <button
                      onClick={() => {
                        setGraphViewMode('constellation');
                        setHoveredNode(null);
                      }}
                      className={`px-3 py-1.5 text-[8px] font-mono font-black uppercase rounded-lg transition-all cursor-pointer ${
                        graphViewMode === 'constellation'
                          ? 'bg-[#0d1220] text-sky-400 shadow-[1px_1px_3px_rgba(0,0,0,0.65)]'
                          : 'text-slate-450 hover:text-slate-200'
                      }`}
                    >
                      Bản Đồ Cố Định
                    </button>
                    <button
                      onClick={() => {
                        setGraphViewMode('graphrag');
                        setHoveredNode(null);
                      }}
                      className={`px-3 py-1.5 text-[8px] font-mono font-black uppercase rounded-lg transition-all cursor-pointer ${
                        graphViewMode === 'graphrag'
                          ? 'bg-[#0d1220] text-purple-400 shadow-[1px_1px_3px_rgba(0,0,0,0.65)]'
                          : 'text-slate-450 hover:text-slate-200'
                      }`}
                    >
                      GraphRAG
                    </button>
                  </div>
                </div>

                {/* Starfield Render Arena */}
                {(graphViewMode === 'graphrag' ? graphNodes.length === 0 : entries.length === 0) ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#090d18] rounded-2xl border border-dashed border-[#141b2c]/15 my-2 shadow-inner">
                    <svg className={`w-16 h-16 opacity-25 mb-4 ${graphViewMode === 'graphrag' ? 'text-purple-400 animate-[spin_80s_linear_infinite]' : 'text-sky-400 animate-[spin_120s_linear_infinite]'}`} viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 3" />
                      <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
                    </svg>
                    <h4 className="font-sans font-black text-[10px] uppercase tracking-wider text-sky-400">
                      Thư Tự Tuyến Hoang Dã
                    </h4>
                    <p className="text-[9px] text-slate-500 max-w-[210px] mt-1.5 leading-relaxed">
                      Chưa cảm biến thấy cổ thư tương thích. Hãy tạo lập thêm Thư tịch bồi đắp địa hạt bối cảnh!
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 relative w-full h-[320px] rounded-2xl bg-[#090d18] border border-[#141b2c]/10 shadow-inner flex items-center justify-center overflow-hidden">
                    {isLoadingGraph && (
                      <div className="absolute inset-0 bg-[#0d1220]/80 flex items-center justify-center z-20 rounded-2xl">
                        <RefreshCw className="animate-spin text-purple-400" size={24} />
                      </div>
                    )}

                    <svg className="w-full h-full min-h-[320px]" viewBox="0 0 400 360">
                      <defs>
                        <filter id="galaxyGlow" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <radialGradient id="ambGlow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor={graphViewMode === 'graphrag' ? "#a855f7" : "#38bdf8"} stopOpacity="0.08" />
                          <stop offset="100%" stopColor={graphViewMode === 'graphrag' ? "#a855f7" : "#38bdf8"} stopOpacity="0" />
                        </radialGradient>
                      </defs>

                      <rect width="400" height="360" fill="url(#ambGlow)" rx="20" />

                      {starsField.map((s, i) => (
                        <circle
                          key={`star_${i}`}
                          cx={s.cx}
                          cy={s.cy}
                          r={s.r}
                          fill={graphViewMode === 'graphrag' ? "#c084fc" : "#38bdf8"}
                          opacity={s.opacity * 0.6}
                        />
                      ))}

                      <circle cx="200" cy="180" r="115" fill="none" stroke={graphViewMode === 'graphrag' ? "#c084fc" : "#38bdf8"} strokeOpacity="0.08" strokeWidth="1" strokeDasharray="3 6" />
                      <circle cx="200" cy="180" r="150" fill="none" stroke={graphViewMode === 'graphrag' ? "#c084fc" : "#38bdf8"} strokeOpacity="0.04" strokeWidth="0.5" />
                      <circle cx="200" cy="180" r="70" fill="none" stroke={graphViewMode === 'graphrag' ? "#c084fc" : "#38bdf8"} strokeOpacity="0.08" strokeWidth="0.5" strokeDasharray="1 3" />

                      {/* Connection wires */}
                      {graphViewMode === 'graphrag' ? (
                        <g>
                          {ragLinks.map((link) => (
                            <line
                              key={link.id}
                              x1={link.x1}
                              y1={link.y1}
                              x2={link.x2}
                              y2={link.y2}
                              stroke="#c084fc"
                              strokeOpacity="0.22"
                              strokeWidth="1.5"
                            />
                          ))}
                        </g>
                      ) : (
                        <g>
                          {cosmosLinks.map((link) => (
                            <line
                              key={link.id}
                              x1={link.x1}
                              y1={link.y1}
                              x2={link.x2}
                              y2={link.y2}
                              stroke={link.strong ? "#38bdf8" : "#818cf8"}
                              strokeOpacity={link.strong ? "0.32" : "0.12"}
                              strokeWidth={link.strong ? "1.8" : "1"}
                              strokeDasharray={link.strong ? "0" : "2 2"}
                            />
                          ))}
                        </g>
                      )}

                      {/* Nodes */}
                      {graphViewMode === 'graphrag' ? (
                        <g>
                          {ragNodes.map((node) => {
                            const isNodeHovered = hoveredNode && hoveredNode.id === node.id;
                            
                            const labelLower = node.label.toLowerCase();
                            const nodeColor = labelLower.includes('person') || labelLower.includes('char') || labelLower.includes('người') || labelLower.includes('nhân') ? "#38bdf8" :
                                              labelLower.includes('loc') || labelLower.includes('địa') || labelLower.includes('nơi') ? "#34d399" :
                                              labelLower.includes('faction') || labelLower.includes('thế lực') || labelLower.includes('bang') ? "#a78bfa" :
                                              labelLower.includes('item') || labelLower.includes('vật') || labelLower.includes('khí') ? "#fbbf24" :
                                              labelLower.includes('event') || labelLower.includes('sự kiện') ? "#f87171" : "#e2e8f0";

                            return (
                              <g
                                key={node.id}
                                className="cursor-pointer"
                                onMouseEnter={() => setHoveredNode(node)}
                                onMouseLeave={() => setHoveredNode(null)}
                              >
                                <circle
                                  cx={node.cx}
                                  cy={node.cy}
                                  r={isNodeHovered ? 13 : 9}
                                  fill="none"
                                  stroke={nodeColor}
                                  strokeWidth="1.5"
                                  strokeOpacity={isNodeHovered ? "0.8" : "0.35"}
                                  className="transition-all duration-300"
                                />
                                <circle
                                  cx={node.cx}
                                  cy={node.cy}
                                  r={6.5}
                                  fill={nodeColor}
                                  className="transition-all duration-200"
                                />
                                <circle
                                  cx={node.cx}
                                  cy={node.cy}
                                  r="2"
                                  fill="#ffffff"
                                />
                                <text
                                  x={node.cx}
                                  y={node.cy + 17}
                                  textAnchor="middle"
                                  fill={isNodeHovered ? "#d8b4fe" : "#94a3b8"}
                                  className="text-[8px] font-mono font-bold pointer-events-none select-none transition-colors"
                                >
                                  {node.name.length > 10 ? `${node.name.slice(0, 9)}…` : node.name}
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      ) : (
                        <g>
                          {cosmosNodes.map((node) => {
                            const isNodeHovered = hoveredNode && hoveredNode.id === node.id;
                            
                            const colorHex = node.category === "character" ? "#38bdf8" :
                                             node.category === "location" ? "#34d399" :
                                             node.category === "faction" ? "#a78bfa" :
                                             node.category === "item" ? "#fbbf24" :
                                             node.category === "event" ? "#f87171" :
                                             node.category === "relationship" ? "#f472b6" :
                                             node.category === "law" ? "#818cf8" : "#38bdf8";

                            const sizeMultiplier = node.priority >= 90 ? 8 :
                                                    node.priority >= 75 ? 6.5 :
                                                    node.priority >= 50 ? 5.5 : 4.5;

                            return (
                              <g
                                key={node.id}
                                className="cursor-pointer"
                                onClick={() => onSelect(node.id)}
                                onMouseEnter={() => setHoveredNode(node)}
                                onMouseLeave={() => setHoveredNode(null)}
                              >
                                <circle
                                  cx={node.cx}
                                  cy={node.cy}
                                  r={isNodeHovered ? sizeMultiplier + 7 : sizeMultiplier + 4}
                                  fill="none"
                                  stroke={colorHex}
                                  strokeWidth="1.5"
                                  strokeOpacity={isNodeHovered ? "0.75" : "0.3"}
                                  className="transition-all duration-300"
                                />
                                <circle
                                  cx={node.cx}
                                  cy={node.cy}
                                  r={sizeMultiplier}
                                  fill={colorHex}
                                  className="transition-all duration-200"
                                />
                                <circle
                                  cx={node.cx}
                                  cy={node.cy}
                                  r="2"
                                  fill="#ffffff"
                                />
                                <text
                                  x={node.cx}
                                  y={node.cy + sizeMultiplier + 10}
                                  textAnchor="middle"
                                  fill={isNodeHovered ? "#38bdf8" : "#94a3b8"}
                                  className="text-[8px] font-mono font-bold pointer-events-none select-none transition-colors"
                                >
                                  {node.keyword.length > 9 ? `${node.keyword.slice(0, 8)}…` : node.keyword}
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      )}

                      {/* Origin central Beacon */}
                      <circle cx="200" cy="180" r="18" fill={graphViewMode === 'graphrag' ? "#c084fc" : "#38bdf8"} fillOpacity="0.05" className="animate-pulse" />
                      <circle cx="200" cy="180" r="4" fill={graphViewMode === 'graphrag' ? "#c084fc" : "#38bdf8"} filter="url(#galaxyGlow)" />
                    </svg>

                    {/* Tactile detail tooltip over lay */}
                    {hoveredNode ? (
                      graphViewMode === 'graphrag' ? (
                        <div className="absolute right-4 top-4 w-[225px] bg-[#090d18] border border-purple-500/30 p-3.5 rounded-2xl shadow-xl backdrop-blur-md animate-fadeIn text-left space-y-1 z-20 pointer-events-none">
                          <div className="flex justify-between items-center border-b border-purple-950/40 pb-1.5 text-[8px] font-mono font-black uppercase tracking-wider">
                            <span className="text-purple-400">RAG THỰC THỂ</span>
                            <span className="text-slate-400 font-bold">
                              {hoveredNode.label || "Entity"}
                            </span>
                          </div>
                          <h4 className="text-xs font-sans font-black text-slate-100 capitalize">{hoveredNode.name}</h4>
                          <p className="text-[9.5px] text-slate-400 leading-normal line-clamp-3 font-semibold">
                            {hoveredNode.description || "Chưa dệt dã bối cảnh."}
                          </p>
                        </div>
                      ) : (
                        <div className="absolute right-4 top-4 w-[225px] bg-[#090d18] border border-sky-500/30 p-3.5 rounded-2xl shadow-xl backdrop-blur-md animate-fadeIn text-left space-y-1 z-20 pointer-events-none">
                          <div className="flex justify-between items-center border-b border-sky-950/40 pb-1.5 text-[8px] font-mono font-black uppercase tracking-wider">
                            <span className="text-sky-400">{hoveredNode.category}</span>
                            <span className="text-slate-400 font-bold">
                              PR: {hoveredNode.priority}
                            </span>
                          </div>
                          <h4 className="text-xs font-sans font-black text-slate-100 capitalize">{hoveredNode.keyword}</h4>
                          <p className="text-[9.5px] text-slate-400 leading-normal line-clamp-3 font-semibold">
                            {hoveredNode.entry?.text ? hoveredNode.entry.text.slice(0, 110).replace(/[#*`~>]/g, '') : "Chưa có ghi chép dã sử."}
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="absolute bottom-3.5 left-4 right-4 flex items-center justify-between text-[8px] text-slate-500 font-mono uppercase tracking-widest font-black">
                        <span>🛸 Orbit Space Core v5</span>
                        <span>{graphViewMode === 'graphrag' ? "GraphRAG" : "Orbits Spheres"}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* COLLAPSIBLE INTELLIGENT COGNITIVE DIAGNOSTICS */}
            {showAIHuyenCo && (
              <div className="bg-[#0d1220] rounded-[28px] shadow-[8px_8px_16px_#04060c,_-8px_-8px_16px_#161e35] border border-[#1b253b]/20 p-6 space-y-6 animate-fadeIn text-left">
                {/* Header view */}
                <div className="flex justify-between items-center border-b border-[#141b2c]/20 pb-3">
                  <h3 className="font-sans text-xs font-black text-sky-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity size={14} className="text-purple-400 animate-pulse" />
                    CHẨN ĐOÁN NÃO BỘ LẬP LUẬN AI
                  </h3>
                  <span className="text-[8px] font-mono uppercase bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 text-purple-405 font-black animate-pulse">
                    COGNITION SYS V5
                  </span>
                </div>

                {/* Sub: Active logs inside a sunken black terminal */}
                <div className="space-y-3">
                  <span className="text-[9px] font-mono font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Radio size={11} className="text-sky-450" /> Quản TRỊ NHẤT QUÁN TOÀN CỤC
                  </span>
                  <div className="bg-[#090d18] rounded-2xl p-4 border border-[#141b2c]/10 max-h-[160px] overflow-y-auto custom-scrollbar space-y-2.5 text-[9.5px] font-mono shadow-inner">
                    {healthChecks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-5 text-center text-emerald-400 font-bold gap-1.5">
                        <CheckCircle size={16} />
                        <span>Hệ thống nhất quán, không phát hiện rạn nứt tư duy!</span>
                      </div>
                    ) : (
                      healthChecks.map((issue) => (
                        <div key={issue.id} className="flex items-start gap-2 border-b border-[#141b2c]/5 pb-2.5 last:border-0 last:pb-0">
                          {issue.type === "error" ? (
                            <span className="text-red-500 shrink-0 mt-0.5">⬤</span>
                          ) : issue.type === "warning" ? (
                            <span className="text-amber-500 shrink-0 mt-0.5">▲</span>
                          ) : (
                            <span className="text-sky-400 shrink-0 mt-0.5">◆</span>
                          )}
                          <div className="text-slate-300 leading-normal">
                            <span className="text-sky-400 font-black block">[{issue.target}]</span>
                            <span>{issue.msg}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Cognitive switches: Neumorphic toggle buttons */}
                <div className="space-y-4 border-t border-[#141b2c]/15 pt-4">
                  <div className="flex justify-between items-center text-[9px] font-mono font-black uppercase text-slate-400 tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Cpu size={12} className="text-purple-400" /> Bản đồ kiểm soát lý tính
                    </span>
                    <span className="text-[8px] text-purple-400 font-black uppercase">REINFORCEMENT ACTIVE</span>
                  </div>

                  <div className="space-y-3">
                    {/* Solution 1 */}
                    <div className="bg-[#0d1220] border border-[#1b253b]/20 shadow-[4px_4px_8px_#04060c,_-4px_-4px_8px_#161e35] rounded-2xl p-3.5 flex items-start gap-3 justify-between transition-all hover:shadow-[5px_5px_10px_#04060c,_-5px_-5px_10px_#18233e]">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle size={13} className={complianceScan ? "text-emerald-400" : "text-slate-500"} />
                          <span className="text-[10px] font-sans font-extrabold text-[#e2e8f0]">Ép Thực Tuân Thủ (Self-Compliance Scan)</span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
                          Ép buộc AI quét các giới hạn & sự sụp đổ bối cảnh trước khi ghi truyện, ngăn chặn ảo giác lập luận.
                        </p>
                      </div>
                      <button
                        onClick={() => setComplianceScan(!complianceScan)}
                        className="text-slate-400 transition-colors shrink-0 mt-0.5 cursor-pointer"
                      >
                        {complianceScan ? (
                          <ToggleRight className="text-emerald-500" size={22} />
                        ) : (
                          <ToggleLeft size={22} className="opacity-45" />
                        )}
                      </button>
                    </div>

                    {/* Solution 2 */}
                    <div className="bg-[#0d1220] border border-[#1b253b]/20 shadow-[4px_4px_8px_#04060c,_-4px_-4px_8px_#161e35] rounded-2xl p-3.5 flex items-start gap-3 justify-between transition-all hover:shadow-[5px_5px_10px_#04060c,_-5px_-5px_10px_#18233e]">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Radio size={13} className={multiTrigger ? "text-sky-400 animate-pulse" : "text-slate-500"} />
                          <span className="text-[10px] font-sans font-extrabold text-[#e2e8f0]">Kích Hoạt Liên Kết Phụ Thuộc</span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
                          Khi nạp NPC đặc biệt, tự động đồng bộ hóa vùng trú ẩn và bảo tàng rèn phục vụ mốc hội thoại.
                        </p>
                      </div>
                      <button
                        onClick={() => setMultiTrigger(!multiTrigger)}
                        className="text-slate-400 transition-colors shrink-0 mt-0.5 cursor-pointer"
                      >
                        {multiTrigger ? (
                          <ToggleRight className="text-emerald-500" size={22} />
                        ) : (
                          <ToggleLeft size={22} className="opacity-45" />
                        )}
                      </button>
                    </div>

                    {/* Solution 3 */}
                    <div className="bg-[#0d1220] border border-[#1b253b]/20 shadow-[4px_4px_8px_#04060c,_-4px_-4px_8px_#161e35] rounded-2xl p-3.5 flex items-start gap-3 justify-between transition-all hover:shadow-[5px_5px_10px_#04060c,_-5px_-5px_10px_#18233e]">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={13} className={antiDrift ? "text-[#a78bfa]" : "text-slate-500"} />
                          <span className="text-[10px] font-sans font-extrabold text-[#e2e8f0]">Khử Trôi Dã Bản Kỷ (Anti-Drift Guard)</span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
                          Tích tụ nén đệ quy tóm lược dã bối cảnh vạn năm định kỳ sau mỗi 20 lượt truyện, khóa dính dòng thời gian gốc.
                        </p>
                      </div>
                      <button
                        onClick={() => setAntiDrift(!antiDrift)}
                        className="text-slate-400 transition-colors shrink-0 mt-0.5 cursor-pointer"
                      >
                        {antiDrift ? (
                          <ToggleRight className="text-emerald-500" size={22} />
                        ) : (
                          <ToggleLeft size={22} className="opacity-45" />
                        )}
                      </button>
                    </div>

                    {/* Solution 4 */}
                    <div className="bg-[#0d1220] border border-[#1b253b]/20 shadow-[4px_4px_8px_#04060c,_-4px_-4px_8px_#161e35] rounded-2xl p-3.5 flex items-start gap-3 justify-between transition-all hover:shadow-[5px_5px_10px_#04060c,_-5px_-5px_10px_#18233e]">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Flame size={13} className={deepReasoning ? "text-amber-400 animate-bounce" : "text-slate-500"} />
                          <span className="text-[10px] font-sans font-extrabold text-[#e2e8f0]">Quỹ Thinking Phân Nhánh (Deep CoT Mode)</span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
                          Yêu cầu khóa tối thiểu 1024 tokens phân rã kế hoặc phân tích tâm can NPC trước khi thoại.
                        </p>
                      </div>
                      <button
                        onClick={() => setDeepReasoning(!deepReasoning)}
                        className="text-slate-400 transition-colors shrink-0 mt-0.5 cursor-pointer"
                      >
                        {deepReasoning ? (
                          <ToggleRight className="text-emerald-500" size={22} />
                        ) : (
                          <ToggleLeft size={22} className="opacity-45" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cognitive run optimizing button */}
                <div className="border-t border-[#141b2c]/20 pt-4">
                  {optimizingState === 'idle' && (
                    <button
                      onClick={handleOptimizeLogic}
                      className="w-full bg-[#0d1220] text-sky-400 hover:text-sky-305 font-mono text-[9.5px] font-black uppercase py-3.5 rounded-2xl border border-sky-500/25 shadow-[4px_4px_10px_#03050a,_-4px_-4px_10px_#16233f] hover:shadow-[6px_6px_14px_#03050a,_-6px_-6px_14px_#1b2d51] active:shadow-[inset_2px_2px_5px_#03050a,_inset_-2px_-2px_5px_#16233f] transition-all duration-300 text-center flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw size={13} />
                      ĐỒNG BỘ TỐI ƯU HỆ THỐNG NHẬN THỨC NGAY
                    </button>
                  )}

                  {optimizingState === 'running' && (
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-[8.5px] font-mono text-purple-405 font-black uppercase animate-pulse">
                        <span>Đang cân đối tham số dã bối cảnh...</span>
                        <span>{optimizationProgress}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-[#090d18] rounded-full p-[2px] border border-[#141b2c]/10 shadow-inner">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 shadow-[0_0_8px_rgba(168,85,247,0.5)] transition-all duration-155"
                          style={{ width: `${optimizationProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {optimizingState === 'success' && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center text-emerald-400 font-mono text-[9.5px] font-black space-y-1.5 animate-bounce">
                      <CheckCircle size={16} className="text-emerald-400 animate-[spin_1s_ease-out_1]" />
                      <span>ĐÃ HOÀN THÀNH TỐI ƯU HÓA HỆ THỐNG!</span>
                      <span className="text-slate-450 font-medium text-[8px] uppercase tracking-wider block">
                        4/4 cấu phần nhận thức đã áp chế tư duy mạch lạc thành công.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PRESETS CHEST (SÁCH MẪU THẦN THOẠI) */}
            {showTemplates && (
              <div className="bg-[#0d1220] border border-[#1b253b]/20 rounded-[28px] shadow-[8px_8px_16px_#04060c,_-8px_-8px_16px_#161e35] p-6 flex flex-col justify-between relative animate-fadeIn text-left space-y-5">
                <div className="space-y-4">
                  
                  <div className="flex items-center justify-between border-b border-[#141b2c]/20 pb-3">
                    <div className="flex items-center gap-2">
                      <Award size={15} className="text-indigo-400" />
                      <span className="font-sans text-xs font-black text-slate-300 tracking-wider uppercase">
                        SÁCH MẪU THẦN THOẠI CỔ ĐẠI
                      </span>
                    </div>
                    <span className="text-[8px] font-mono py-0.5 px-2 bg-[#090d18] text-indigo-400 border border-indigo-500/20 rounded uppercase font-black shadow-inner">
                      PRESETS
                    </span>
                  </div>

                  {/* Neumorphic Preset tabs */}
                  <div className="flex bg-[#090d18] border border-[#141b2c]/10 p-1 rounded-xl shadow-inner gap-1 shrink-0 select-none">
                    {["character", "location", "item", "faction"].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveTemplateTab(cat)}
                        className={`flex-1 text-[8.5px] py-1.8 text-center font-mono font-black uppercase rounded-lg transition-all cursor-pointer ${
                          activeTemplateTab === cat 
                            ? "bg-[#0d1220] text-sky-400 shadow-[1px_1px_3px_rgba(0,0,0,0.65)]" 
                            : "text-slate-450 hover:text-slate-200"
                        }`}
                      >
                        {cat === 'character' ? 'NPC' : cat === 'location' ? 'VÙNG ĐẤT' : cat === 'item' ? 'BẢO KHÍ' : 'THẾ LỰC'}
                      </button>
                    ))}
                  </div>

                  {/* Template description inside standard sunken panel */}
                  <div className="bg-[#090d18] p-4.5 border border-[#141b2c]/10 shadow-inner rounded-2xl flex flex-col justify-between relative text-left space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-[8px] font-mono font-black text-slate-500">
                        <span>LORE ATTRIBUTED DESIGN TEMPLATE</span>
                        <span className="font-black text-indigo-405">
                          GRADE_0{STARTER_TEMPLATES.findIndex((t) => t.category === activeTemplateTab) + 1}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs sm:text-sm font-sans font-black text-indigo-400 hover:text-indigo-305 uppercase tracking-wide flex items-center gap-1.5 select-none">
                          <ChevronRight size={13} className="text-indigo-400 animate-pulse" />
                          {selectedTemplate.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed font-sans line-clamp-3">
                          {selectedTemplate.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[9px] pt-2 border-t border-[#141b2c]/15 font-sans text-slate-400">
                        {selectedTemplate.rpg_attrs && Object.entries(selectedTemplate.rpg_attrs).map(([key, value]: any) => {
                          const label = key === "alignment" ? "Chuẩn đức" :
                                        key === "role" ? "Vai diễn AI" :
                                        key === "danger_level" ? "Độ hiểm" :
                                        key === "climate" ? "Khí hậu" :
                                        key === "ruler" ? "Lãnh chúa" :
                                        key === "population" ? "Dị tộc" :
                                        key === "rarity" ? "Phẩm thế" :
                                        key === "abilities" ? "Thần thông" :
                                        key === "influence" ? "Phóng tát" : key;
                          return (
                            <div key={key} className="space-y-0.5 truncate bg-[#0d1220]/45 p-1.5 rounded-lg border border-[#141b2c]/10">
                              <span className="text-slate-550 block uppercase tracking-wider text-[7px] font-mono font-extrabold">
                                {label}
                              </span>
                              <span className="font-black block truncate text-slate-350">
                                {value}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#141b2c]/10">
                      <button
                        onClick={() => {
                          const modelData: Partial<VectorData> = {
                            category: selectedTemplate.category,
                            keyword: selectedTemplate.keyword,
                            keywords: selectedTemplate.keywords,
                            text: selectedTemplate.text,
                            triggerMode: selectedTemplate.category === "character" ? "keyword" : "hybrid",
                            priority: 50,
                            isEnabled: true,
                            position: selectedTemplate.category === "character" ? "before_char" : "before_history",
                            tags: selectedTemplate.keywords,
                          };
                          if (selectedTemplate.rpg_attrs) {
                            try {
                              (modelData as any).rpg_attrs = selectedTemplate.rpg_attrs;
                            } catch {}
                          }
                          onAddManualWithTemplate(modelData);
                        }}
                        className="w-full py-2.5 bg-[#0d1220] hover:bg-[#11172a] text-indigo-400 font-bold text-[9.5px] rounded-xl shadow-[3px_3px_6px_#04060c,_-3px_-3px_5px_#161e35] hover:text-indigo-305 border border-[#1b253b]/20 hover:scale-[1.01] active:shadow-inner cursor-pointer transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider font-mono"
                      >
                        <Sparkles size={11} className="text-indigo-400 animate-pulse" />
                        Trích dệt cổ bản bối cảnh mẫu
                        <ArrowRight size={11} className="ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* RIGHT CONTENT COLUMN: Categories Grid & Dossier Cards */}
          <div className="xl:col-span-7 space-y-6">
            
            {/* Core Main Stage Bento Grid of Lore Dossier Cards */}
            <div className="space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-[#141b2c]/30 pb-3">
                <h3 className="font-sans text-xs sm:text-sm font-black text-sky-400 uppercase tracking-widest flex items-center gap-2 select-none">
                  <Database size={15} />
                  DANH MỤC THỬ KIẾM CỔ DIỄN ({filteredEntries.length} Hồ Sơ)
                </h3>
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-black">LORE RECORD TILES</span>
              </div>

              {filteredEntries.length === 0 ? (
                /* Sunken empty state card */
                <div className="text-center bg-[#090d18] border border-[#141b2c]/15 rounded-[32px] py-20 flex flex-col items-center justify-center gap-4 shadow-inner">
                  <Search size={36} className="text-sky-400/35 animate-pulse" />
                  <h4 className="font-sans text-sm text-sky-400 uppercase tracking-wider font-extrabold">Cổ bối cảnh không có tàng thư tương hợp</h4>
                  <p className="text-slate-450 text-[10.5px] max-w-sm leading-relaxed px-5 font-bold text-center">
                    Hãy dệt một bách khoa bối cảnh hoàn toàn mới hoặc trích dữ bối cảnh mẫu từ bên trái để tháp kích tư duy AI!
                  </p>
                  <button
                    onClick={() => onAddManualWithTemplate({
                      category: "world",
                      keyword: "",
                      keywords: [],
                      text: ""
                    })}
                    className="mt-2 px-5 py-2.5 bg-[#0d1220] text-sky-450 hover:text-sky-350 text-xs font-mono uppercase font-black rounded-xl border border-sky-400/20 shadow-[2px_2px_5px_rgba(0,0,0,0.6)] cursor-pointer hover:scale-102 transition-all"
                  >
                    + Tạo lập Thư Mới Ngay
                  </button>
                </div>
              ) : (
                /* Grid of Tiles and Cards (Gạch và Thẻ) */
                <div className={layoutStyle === "dense" ? "space-y-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>
                  {filteredEntries.map((e) => {
                    const isEnabled = e.isEnabled !== false;
                    const catInfo = CATEGORY_MAP[e.category || 'world'];
                    const { label: tierLabel, color: tierColor } = getPriorityTier(e.priority);
                    const IconComponent = catInfo ? catInfo.icon : Database;

                    if (layoutStyle === "dense") {
                      return (
                        <div
                          key={e.id}
                          onClick={() => onSelect(e.id)}
                          className={`group rounded-2xl text-left transition-all px-4 py-3.5 cursor-pointer flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 select-none border border-[#1b253b]/20 ${
                            !isEnabled 
                              ? 'bg-[#090d18]/50 opacity-40 grayscale hover:opacity-75 hover:grayscale-0 shadow-inner' 
                              : 'bg-[#0d1220] shadow-[5px_5px_10px_#04060c,_-5px_-5px_10px_#161e35] hover:shadow-[7px_7px_14px_#04060c,_-7px_-7px_14px_#1a243d] hover:scale-[1.006]'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div className={`p-1.8 w-8 h-8 rounded-lg border shrink-0 flex items-center justify-center ${
                              isEnabled ? "text-sky-400 border-sky-500/20 bg-[#090d18] shadow-inner" : "text-slate-500 border-slate-900 bg-[#090d18]"
                            }`}>
                              <IconComponent size={14} />
                            </div>
                            <div className="min-w-0 flex-1 font-sans">
                              <div className="flex items-center gap-2">
                                <h4 className={`text-xs sm:text-sm font-sans font-black tracking-wide text-sky-400 group-hover:text-sky-300 capitalize truncate ${!isEnabled ? 'line-through opacity-50' : ''}`}>
                                  {e.keyword || e.title || "Vô danh thư"}
                                </h4>
                                {e.triggerMode === 'always' && <Pin size={10} className="text-sky-400 animate-pulse shrink-0" />}
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold truncate block mt-0.5 leading-normal">
                                {e.category === 'character' ? (() => {
                                  try {
                                    const cData = JSON.parse(e.text || "{}");
                                    return [cData.narrativeRole, cData.personality].filter(Boolean).join(" • ");
                                  } catch {
                                    return (e.text || '').replace(/[#*`~>]/g, '');
                                  }
                                })() : (e.text || '').replace(/[#*`~>]/g, '')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3.5 shrink-0 ml-auto sm:ml-0 font-bold font-mono text-[9px]">
                            {e.keywords && e.keywords.length > 0 && (
                              <div className="hidden sm:flex gap-1 overflow-hidden max-w-[140px] select-none">
                                {e.keywords.slice(0, 2).map((w, idx) => (
                                  <span key={idx} className="text-[8px] text-slate-400 bg-[#090d18] px-1.5 py-0.5 rounded border border-[#141b2c]/20">
                                    #{w}
                                  </span>
                                ))}
                              </div>
                            )}

                            <span className={`px-1.5 py-0.5 rounded text-[8px] border shrink-0 uppercase font-bold ${tierColor}`}>
                              {tierLabel}
                            </span>

                            <div className="flex items-center gap-2 border-l border-[#141b2c]/30 pl-2.5">
                              {onToggleStatus && (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onToggleStatus(e.id, !isEnabled);
                                  }}
                                  className="text-slate-400 hover:text-sky-400 transition-colors shrink-0 cursor-pointer"
                                  title="Bật/Tắt định tuyến"
                                >
                                  {isEnabled ? (
                                    <ToggleRight className="text-emerald-500 hover:text-emerald-400" size={19} />
                                  ) : (
                                    <ToggleLeft size={19} className="opacity-40" />
                                  )}
                                </button>
                              )}
                              
                              {onDelete && (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (confirm("Bạn có chắc chắn muốn xóa thư tịch tri thức này?")) {
                                      onDelete(e.id);
                                    }
                                  }}
                                  className="text-slate-500 hover:text-red-400 transition-colors ml-0.5 shrink-0 cursor-pointer p-1"
                                  title="Xóa cổ bản"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={e.id}
                        onClick={() => onSelect(e.id)}
                        className={`group rounded-[28px] text-left transition-all duration-300 p-5.5 shadow-lg relative overflow-hidden cursor-pointer flex flex-col justify-between h-[235px] select-none border border-[#1b253b]/20 ${
                          !isEnabled 
                            ? 'bg-[#090d18]/50 opacity-40 grayscale hover:opacity-75 hover:grayscale-0 shadow-inner' 
                            : 'bg-[#0d1220] shadow-[6px_6px_12px_#04060c,_-6px_-6px_12px_#161e35] hover:shadow-[10px_10px_20px_#04060c,_-10px_-10px_20px_#1a243d] hover:scale-[1.012]'
                        }`}
                      >
                        <div className="space-y-2.5 flex-1 flex flex-col">
                          <div className="flex justify-between items-center text-[9px] font-mono font-black select-none mb-1">
                            <span className="flex items-center gap-1.5 text-sky-400">
                              <IconComponent size={11} className="shrink-0" />
                              {catInfo ? catInfo.label : 'Cổ Bản'}
                            </span>
                            
                            <div className="flex gap-1.5 items-center">
                              {e.triggerMode && (
                                <span className="bg-[#090d18] px-1.5 py-0.5 rounded text-[7.5px] text-sky-400 font-bold border border-[#141b2c]/10 shadow-inner">
                                  {e.triggerMode === 'always' ? 'Thường trực' : e.triggerMode}
                                </span>
                              )}
                              <span className={`px-1.5 rounded text-[7.5px] border font-bold uppercase ${tierColor}`}>
                                {tierLabel.replace(" Class", "")}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1 flex-1">
                            <h4 className={`text-sm sm:text-xs md:text-sm font-sans font-black tracking-wide text-sky-400 group-hover:text-sky-305 capitalize truncate ${!isEnabled ? 'line-through opacity-50' : ''}`}>
                              {e.keyword || e.title || "Vô danh thư"}
                            </h4>
                            
                            <p className="text-[10px] text-slate-300 leading-relaxed font-sans line-clamp-4 font-semibold">
                              {e.category === 'character' ? (() => {
                                try {
                                  const cData = JSON.parse(e.text || "{}");
                                  return [cData.narrativeRole, cData.personality, cData.appearance].filter(Boolean).join(" • ");
                                } catch {
                                  return (e.text || '').replace(/[#*`~>]/g, '');
                                }
                              })() : (e.text || '').replace(/[#*`~>]/g, '')}
                            </p>
                          </div>
                        </div>

                        {/* Footer card controls with neumorphic slider and stats */}
                        <div className="pt-2 border-t border-[#141b2c]/25 flex flex-col gap-2">
                          {e.keywords && e.keywords.length > 0 && (
                            <div className="flex gap-1 overflow-hidden h-4.5 select-none items-center">
                              {e.keywords.slice(0, 3).map((w, idx) => (
                                <span key={idx} className="text-[8px] font-mono text-slate-400 bg-[#090d18] px-1.5 py-0.5 rounded border border-[#141b2c]/20">
                                  #{w}
                                </span>
                              ))}
                              {e.keywords.length > 3 && (
                                <span className="text-[8px] font-mono text-slate-500 font-extrabold">+{e.keywords.length - 3}</span>
                              )}
                            </div>
                          )}

                          <div className="flex justify-between items-center text-[8.5px] font-mono text-slate-400 font-bold pt-0.5 select-none">
                            <span className="flex items-center gap-1.5">
                              {(e.relatedEntries || []).length > 0 ? (
                                <span className="text-sky-400 flex items-center gap-1 font-black">🔗 {(e.relatedEntries || []).length} kết hợp</span>
                              ) : (
                                <span className="text-slate-500">Đối độc lập</span>
                              )}
                              {e.triggerMode === 'always' && <Pin size={8} className="text-sky-450 animate-pulse" />}
                            </span>

                            <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
                              <span className="text-slate-500 text-[8px] font-extrabold mb-0.5">~{Math.round((e.text?.length || 0)/3.8)} Tokens</span>
                              
                              {onToggleStatus && (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onToggleStatus(e.id, !isEnabled);
                                  }}
                                  className="text-slate-400 hover:text-sky-455 transition-colors cursor-pointer"
                                  title="Chuyển hoạt trạng"
                                >
                                  {isEnabled ? (
                                    <ToggleRight className="text-emerald-500 hover:text-emerald-400" size={18} />
                                  ) : (
                                    <ToggleLeft size={18} className="opacity-40" />
                                  )}
                                </button>
                              )}
                              
                              {onDelete && (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (confirm("Bạn có chắc chắn muốn xóa thư tịch tri thức này?")) {
                                      onDelete(e.id);
                                    }
                                  }}
                                  className="text-slate-500 hover:text-red-450 transition-colors ml-0.5 cursor-pointer p-1"
                                  title="Hủy diệt dã thư"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
