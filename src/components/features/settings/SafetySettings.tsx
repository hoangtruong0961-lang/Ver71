
import React from 'react';
import { motion } from 'framer-motion';
import { AppSettings } from '../../../types';

const CATEGORY_NAMES: Record<string, string> = {
  'HARM_CATEGORY_HARASSMENT': 'Quấy rối (Harassment)',
  'HARM_CATEGORY_HATE_SPEECH': 'Ngôn từ thù ghét (Hate Speech)',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT': 'Nội dung khiêu dâm (Sexually Explicit)',
  'HARM_CATEGORY_DANGEROUS_CONTENT': 'Nội dung nguy hiểm (Dangerous)',
  'HARM_CATEGORY_CIVIC_INTEGRITY': 'Liêm chính công dân (Civic Integrity)',
};

interface SafetySettingsProps {
  settings: AppSettings;
  onUpdate: (newSettings: AppSettings) => void;
}

const SafetySettings: React.FC<SafetySettingsProps> = ({ settings, onUpdate }) => {

  const handleToggle = (category: string) => {
    if (!settings.safetySettings) return;

    const newSafetySettings = settings.safetySettings.map(s => {
      if (s.category === category) {
        // Toggle between BLOCK_NONE (OFF) and BLOCK_MEDIUM_AND_ABOVE (ON/Default)
        return { 
          ...s, 
          threshold: s.threshold === 'BLOCK_NONE' ? 'BLOCK_MEDIUM_AND_ABOVE' : 'BLOCK_NONE' 
        };
      }
      return s;
    });

    onUpdate({
      ...settings,
      safetySettings: newSafetySettings
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-6 rounded-3xl border border-[#cbd2df]/20 dark:border-[#142042]/10 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042]">
        <div className="flex items-start gap-4 mb-6 pb-4 border-b border-[#cbd2df]/25 dark:border-[#142042]/15">
           <div>
             <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">Bộ lọc an toàn AI</h3>
             <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-relaxed">
               Cấu hình mức độ kiểm duyệt nội dung của AI nhằm đảm bảo văn phong an toàn thông tin hoặc cho tự do tối đa.
             </p>
           </div>
        </div>

        <div className="space-y-4">
          {settings.safetySettings?.map((setting) => {
            const isOff = setting.threshold === 'BLOCK_NONE';
            return (
              <motion.div 
                key={setting.category} 
                className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${
                  isOff 
                  ? 'bg-[#e6ebf4] dark:bg-[#0b1329] border-red-500/20 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042]' 
                  : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042]'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {CATEGORY_NAMES[setting.category] || setting.category}
                  </span>
                  <span className={`text-[10px] uppercase font-black tracking-wider mt-1.5 transition-colors ${isOff ? 'text-red-500' : 'text-emerald-500'}`}>
                    {isOff ? '❌ Đã tắt bộ lọc (Không an toàn)' : '🛡️ Đang bật (Mặc định)'}
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleToggle(setting.category)}
                  className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-300 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10 cursor-pointer"
                >
                   <motion.div 
                     layout 
                     className={`absolute top-0.5 left-1 w-4 h-4 rounded-full shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] transition-colors ${!isOff ? 'bg-mystic-accent' : 'bg-slate-400 dark:bg-slate-600'}`}
                     animate={{ x: !isOff ? 24 : 0 }}
                     transition={{ type: "spring", stiffness: 500, damping: 30 }}
                   />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SafetySettings;