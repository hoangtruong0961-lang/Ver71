import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Upload, Trash2, Play, Users, Link2, Filter, AlertCircle, FileText, Settings, BookOpen, RefreshCw } from 'lucide-react';
import Button from '../../ui/Button';
import { dbService } from '../../../services/db/indexedDB';
import { StoredCharacter, PlayerProfile } from '../../../types';
import { CharacterImportService } from '../../../services/character/CharacterImportService';
import { CharacterDetailPanel } from './CharacterDetailPanel';

const DEFAULT_PLAYER: PlayerProfile = {
  name: "Người chơi",
  gender: "Vô tính?",
  age: "20",
  appearance: "Trang phục giản dị",
  voiceAndTone: "Bình thường",
  coreValues: "Sinh tồn",
  hardLimits: "Chưa",
  definingEvents: "Bị mất trí nhớ",
  currentMood: "Bình tĩnh",
  relationshipTags: "Thân thiện",
  strengths: "Dẻo dai",
  weaknesses: "Yếu",
  narrativeRole: "Protagonist",
  contradictions: "Nói 1 đằng làm 1 nẻo",
  failureMode: "Chạy trốn",
  personality: "Tò mò, thích khám phá",
  background: "Một lữ khách vô tình lạc vào thế giới này",
  skills: "Thích nghi nhanh",
  goal: "Khám phá bí ẩn của thế giới"
};

interface CharacterLibraryScreenProps {
  onClose: () => void;
  onGameStart: (worldData: any) => void;
  playerProfile?: PlayerProfile;
}

export const CharacterLibraryScreen: React.FC<CharacterLibraryScreenProps> = ({ onClose, onGameStart, playerProfile = DEFAULT_PLAYER }) => {
  const [characters, setCharacters] = useState<StoredCharacter[]>([]);
  const [filteredCharacters, setFilteredCharacters] = useState<StoredCharacter[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');
  const [selectedChar, setSelectedChar] = useState<StoredCharacter | null>(null);
  const [charToDelete, setCharToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    setIsLoading(true);
    try {
      const chars = await dbService.getAllCharacters();
      setCharacters(chars);
      applyFiltersAndSort(chars, searchTerm, sortBy);
    } catch (err) {
      console.error("Failed to load characters", err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFiltersAndSort = (chars: StoredCharacter[], term: string, sortMode: string) => {
    let filtered = [...chars];
    if (term) {
      const lower = term.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(lower) || 
        c.description.toLowerCase().includes(lower) ||
        c.tags?.some(t => t.toLowerCase().includes(lower))
      );
    }

    if (sortMode === 'recent') {
      filtered.sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0));
    } else if (sortMode === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    setFilteredCharacters(filtered);
  };

  useEffect(() => {
    applyFiltersAndSort(characters, searchTerm, sortBy);
  }, [searchTerm, sortBy, characters]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    let successCount = 0;
    let lastChar = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const buffer = await file.arrayBuffer();
        const { data, avatarUrl } = await CharacterImportService.parseBuffer(buffer, file.type, file.name);
        
        const storedChar = CharacterImportService.toStoredCharacter(data, avatarUrl);
        await dbService.saveCharacter(storedChar);
        lastChar = storedChar;
        successCount++;
      } catch (err: any) {
        console.error("Lỗi khi import file:", file.name, err);
      }
    }

    await loadCharacters();
    if (lastChar && successCount === 1) {
      setSelectedChar(lastChar);
      toast.success(`Đã import thành công nhân vật: ${lastChar.name}`);
    } else if (successCount > 0) {
      toast.success(`Đã import thành công ${successCount} nhân vật mới vào thư viện!`);
    } else {
      toast.error("Không có nhân vật nào được nhập. File có thể không hợp lệ hoặc bị hỏng.");
    }
    
    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportUrl = async () => {
    const url = prompt("Nhập URL của thẻ nhân vật (ảnh PNG hoặc JSON từ Chub.ai, v.v.):\nVí dụ: https://files.catbox.moe/...png");
    if (!url) return;

    setIsImporting(true);
    try {
      const { data, avatarUrl, name } = await CharacterImportService.parseUrl(url);
      const storedChar = CharacterImportService.toStoredCharacter(data, avatarUrl);
      if (storedChar.name === 'Unknown') storedChar.name = name; // Fallback
      
      await dbService.saveCharacter(storedChar);
      await loadCharacters();
      setSelectedChar(storedChar);
      toast.success(`Đã tải và import thành công nhân vật: ${storedChar.name}`);
    } catch (err: any) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Lỗi import từ URL: Không thể tải hoặc phân tích thẻ nhân vật.\nChi tiết lỗi: ${errorMsg}\nVui lòng kiểm tra lại đường dẫn và đảm bảo file ảnh PNG chứa Spec SillyTavern hoặc file JSON hợp lệ.`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteRequest = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCharToDelete(id);
  };

  const confirmDelete = async () => {
    if (!charToDelete) return;
    await dbService.deleteCharacter(charToDelete);
    if (selectedChar?.id === charToDelete) setSelectedChar(null);
    setCharToDelete(null);
    await loadCharacters();
  };

  const cancelDelete = () => {
    setCharToDelete(null);
  };

  const handleStartGame = async (char: StoredCharacter, alternateGreetingIndex?: number) => {
     // Clone char to apply greeting if needed before converting to world
     const clonedChar = JSON.parse(JSON.stringify(char));

      const dataBlock = (clonedChar.rawData?.data && (clonedChar.spec === 'chara_card_v2' || clonedChar.spec === 'chara_card_v3')) ? clonedChar.rawData.data : (clonedChar.rawData || clonedChar || {});
     
     if (alternateGreetingIndex !== undefined && alternateGreetingIndex !== -1 && dataBlock.alternate_greetings) {
         dataBlock.first_mes = dataBlock.alternate_greetings[alternateGreetingIndex];
     }

     const worldData = CharacterImportService.toWorldData(clonedChar, playerProfile);
     await dbService.updateCharacterLastPlayed(char.id);
     
     onGameStart(worldData);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden"
    >
      <input 
        type="file" 
        accept=".png,.webp,.json" 
        multiple
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleImportFile} 
      />

      {/* Header */}
      <div className="flex-none h-16 border-b border-slate-800/50 flex items-center justify-between px-6 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 leading-none">Thư Viện Nhân Vật</h2>
            <p className="text-xs text-slate-400 font-medium tracking-wide mt-1">
              Quản lý và chơi các thẻ nhân vật (SillyTavern)
            </p>
          </div>
        </div>
        <Button variant="ghost" icon={<X size={20}/>} onClick={onClose} className="rounded-full w-10 h-10 p-0 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white" />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content - Grid */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${selectedChar ? 'mr-0 lg:mr-96' : ''} bg-[#040814]`}>
          
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-800/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Tìm nhân vật..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 text-slate-200 text-sm rounded-full pl-10 pr-4 py-2 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Sắp xếp:</span>
              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-slate-900/60 border border-slate-800 text-slate-300 text-sm rounded-lg px-2 py-1 outline-none focus:border-indigo-500/50 font-mono"
              >
                 <option value="recent">Mới nhất</option>
                 <option value="name">Tên A-Z</option>
              </select>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="primary" 
                icon={isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex-1 sm:flex-none text-xs font-bold uppercase tracking-wider py-2"
              >
                Import File
              </Button>
              <Button 
                variant="outline" 
                icon={isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                onClick={handleImportUrl}
                disabled={isImporting}
                className="flex-1 sm:flex-none text-xs font-bold uppercase tracking-wider py-2"
              >
                Import URL
              </Button>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
            {isLoading ? (
               <div className="flex items-center justify-center h-full">
                 <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
               </div>
            ) : filteredCharacters.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                 <Users className="w-16 h-16 opacity-20" />
                 <p className="text-sm font-medium tracking-wide">Không tìm thấy nhân vật nào.</p>
                 {characters.length === 0 && (
                   <div className="flex gap-4 mt-4">
                     <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                       Tải file JSON/PNG
                     </Button>
                   </div>
                 )}
               </div>
            ) : (
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                 {filteredCharacters.map(char => (
                   <motion.div
                     layoutId={`char-${char.id}`}
                     key={char.id}
                     onClick={() => setSelectedChar(char)}
                     className={`group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all duration-300 ${
                       selectedChar?.id === char.id 
                         ? 'border-indigo-500 ring-4 ring-indigo-500/20' 
                         : 'border-slate-800 hover:border-slate-600 bg-slate-900/50'
                     }`}
                   >
                     {/* Img */}
                     {char.avatarUrl ? (
                        <img src={char.avatarUrl} alt={char.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                     ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 bg-slate-920">
                           <Users size={32} className="mb-2 opacity-50" />
                           <span className="text-xs font-bold font-mono tracking-wider opacity-30">NO IMAGE</span>
                        </div>
                     )}
                     
                     {/* Overlay */}
                     <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                     
                     {/* Info */}
                     <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 pb-4">
                       <h3 className="font-bold text-white text-sm sm:text-base leading-tight line-clamp-1 drop-shadow-md">
                         {char.name}
                       </h3>
                       <p className="text-[10px] sm:text-xs text-slate-300 line-clamp-2 mt-1 leading-relaxed opacity-80">
                         {char.description || "Không có mô tả..."}
                       </p>
                     </div>

                     {/* Delete Button */}
                     <button
                       onClick={(e) => handleDeleteRequest(char.id, e)}
                       className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-950/60 text-slate-400 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all border border-slate-700 hover:border-red-500/30"
                     >
                       <Trash2 size={14} />
                     </button>
                   </motion.div>
                 ))}
               </div>
            )}
          </div>
        </div>

        {/* Delete Confirm Modal */}
        <AnimatePresence>
          {charToDelete && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            >
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                <div className="flex items-center gap-3 text-red-400 mb-4">
                  <AlertCircle size={24} />
                  <h3 className="text-lg font-bold">Xác nhận xóa</h3>
                </div>
                <p className="text-slate-300 mb-6 text-sm">Bạn có chắc chắn muốn xóa vĩnh viễn nhân vật này khỏi thư viện? Dữ liệu không thể khôi phục sau khi xóa.</p>
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={cancelDelete}>Hủy</Button>
                  <Button variant="primary" className="bg-red-500 hover:bg-red-600 border-none text-white" onClick={confirmDelete}>Xóa vĩnh viễn</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Character Detail Panel Drawer */}
        <AnimatePresence>
          {selectedChar && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-full md:w-[450px] lg:w-96 bg-slate-900 border-l border-slate-800 z-10 flex flex-col shadow-2xl overflow-hidden"
            >
              <CharacterDetailPanel 
                character={selectedChar} 
                onClose={() => setSelectedChar(null)}
                onStart={(alternateGreetingIndex) => handleStartGame(selectedChar, alternateGreetingIndex)}
                onUpdate={(updatedChar) => {
                  setSelectedChar(updatedChar);
                  loadCharacters();
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
