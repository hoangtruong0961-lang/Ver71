
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Trash2, Image as ImageIcon, Search, Check } from 'lucide-react';
import { ImageMetadata } from '../../../types';
import { ImageLibraryService } from '../../../../services/image/ImageLibraryService';

interface ImageLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (image: ImageMetadata) => void;
  selectedId?: string;
}

const ImageLibraryModal: React.FC<ImageLibraryModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelect,
  selectedId 
}) => {
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const allImages = await ImageLibraryService.getAllImages();
      setImages(allImages.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadImages();
    }
  }, [isOpen, loadImages]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await ImageLibraryService.addImage(files[i]);
      }
      await loadImages();
      toast.success("Tải ảnh lên thư viện thành công!");
    } catch (error: any) {
      console.error('Upload failed:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Tải ảnh lên thất bại. Chi tiết: ${errMsg}`);
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bạn có chắc chắn muốn xóa ảnh này?')) return;

    try {
      await ImageLibraryService.deleteImage(id);
      setImages(prev => prev.filter(img => img.id !== id));
      toast.success("Đã xóa ảnh thành công!");
    } catch (error: any) {
      console.error('Delete failed:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Xóa ảnh thất bại. Chi tiết: ${errMsg}`);
    }
  };

  const filteredImages = images.filter(img => 
    img.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-slate-950 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mystic-accent/20 rounded-lg">
              <ImageIcon className="w-6 h-6 text-mystic-accent" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Thư Viện Ảnh</h2>
              <p className="text-xs text-slate-400">{images.length} ảnh đã lưu trữ</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Tìm kiếm ảnh..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-full text-sm text-white focus:outline-none focus:border-mystic-accent w-64"
              />
            </div>

            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                uploading ? 'bg-slate-700 text-slate-400' : 'bg-mystic-accent text-slate-950 hover:scale-105 active:scale-95'
              }`}>
                <Upload className="w-4 h-4" />
                <span>{uploading ? 'Đang tải...' : 'Tải ảnh lên'}</span>
              </div>
            </label>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Search for Mobile */}
        <div className="p-4 md:hidden border-b border-slate-800 bg-slate-900/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm kiếm ảnh..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-full text-sm text-white focus:outline-none focus:border-mystic-accent w-full"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-12 h-12 border-4 border-mystic-accent border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 animate-pulse">Đang tải thư viện...</p>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="p-6 bg-slate-900 rounded-full">
                <ImageIcon className="w-16 h-16 text-slate-700" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">Chưa có ảnh nào</h3>
                <p className="text-slate-500 max-w-xs mx-auto mt-2">
                  {searchTerm ? 'Không tìm thấy ảnh phù hợp với từ khóa.' : 'Hãy tải ảnh lên để bắt đầu xây dựng thư viện của bạn.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredImages.map((img, idx) => (
                <motion.div
                  layout
                  key={img.id ? `${img.id}-${idx}` : idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4 }}
                  onClick={() => onSelect?.(img)}
                  className={`group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                    selectedId === img.id ? 'border-mystic-accent ring-4 ring-mystic-accent/20' : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <img
                    src={img.data}
                    alt={img.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    <p className="text-[10px] text-white font-medium truncate mb-1">{img.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-300">{(img.size / 1024).toFixed(1)} KB</span>
                      <button
                        onClick={(e) => handleDelete(img.id, e)}
                        className="p-1.5 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-md transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Selected Indicator */}
                  {selectedId === img.id && (
                    <div className="absolute top-2 right-2 p-1 bg-mystic-accent rounded-full text-slate-950 shadow-lg">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">
            Tất cả ảnh được lưu trữ cục bộ trong trình duyệt của bạn
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImageLibraryModal;
