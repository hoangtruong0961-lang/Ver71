import React from 'react';
import { motion } from 'framer-motion';

interface ArkLogoProps {
  size?: number;
  className?: string;
}

export const ArkLogo: React.FC<ArkLogoProps> = ({ size = 100, className = '' }) => {
  return (
    <div 
      className={`${className} relative flex items-center justify-center rounded-full select-none transition-all duration-500`}
      style={{ 
        width: size, 
        height: size,
      }}
    >
      {/* Outer Neumorphic Extruded Circle (Embossed Plate) */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#eae7e4] to-[#c3beba] dark:from-[#0e182e] dark:to-[#04060c] shadow-[6px_6px_14px_rgba(176,171,168,0.75),-6px_-6px_14px_rgba(255,255,255,0.95)] dark:shadow-[8px_8px_18px_rgba(1,3,7,0.9),-8px_-8px_18px_rgba(21,33,59,0.8)] border border-white/40 dark:border-white/5" />

      {/* Inner Neumorphic Recessed Circle (Sunken Plate) */}
      <div className="absolute w-[80%] h-[80%] rounded-full bg-gradient-to-br from-[#c3beba] to-[#eae7e4] dark:from-[#03050a] dark:to-[#101c34] shadow-[inset_4px_4px_8px_rgba(176,171,168,0.75),inset_-4px_-4px_8px_rgba(255,255,255,0.95)] dark:shadow-[inset_4px_4px_10px_rgba(1,3,7,0.9),inset_-4px_-4px_10px_rgba(21,33,59,0.8)] border border-black/5 dark:border-white/5 flex items-center justify-center overflow-hidden">
        
        {/* Subtle radial sheen overlay for material feel */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_60%)] dark:bg-[radial-gradient(circle_at_30%_30%,rgba(56,189,248,0.06),transparent_60%)]" />

        {/* Minimalist Logo Symbol (Sleek minimalist Ark ship + Sun combination) */}
        <motion.svg
          width="52%"
          height="52%"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 text-sky-500 dark:text-sky-400"
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.9, 1, 0.9],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* Minimalist Sun disc in the center-top */}
          <circle 
            cx="50" 
            cy="40" 
            r="13" 
            className="fill-sky-500/10 dark:fill-sky-400/15 stroke-sky-500 dark:stroke-sky-400" 
            strokeWidth="2.5" 
          />
          
          {/* Subtle sunrays as minimalist anchors */}
          <line x1="50" y1="18" x2="50" y2="23" className="stroke-sky-500 dark:stroke-sky-400" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="27" y1="40" x2="32" y2="40" className="stroke-sky-500 dark:stroke-sky-400" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="73" y1="40" x2="68" y2="40" className="stroke-sky-500 dark:stroke-sky-400" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="34" y1="24" x2="38" y2="28" className="stroke-sky-500 dark:stroke-sky-400" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="66" y1="24" x2="62" y2="28" className="stroke-sky-500 dark:stroke-sky-400" strokeWidth="2.5" strokeLinecap="round" />

          {/* Minimalist geometric crescent shape representing the ARK */}
          <path
            d="M20 62C20 62 35 73 50 73C65 73 80 62 80 62C80 62 65 67 50 67C35 67 20 62 20 62Z"
            className="fill-sky-500 dark:fill-sky-400 stroke-sky-500 dark:stroke-sky-400"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Symmetrical support line anchor below the ship */}
          <path
            d="M32 78H68"
            className="stroke-sky-500/60 dark:stroke-sky-400/50"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </motion.svg>
      </div>
    </div>
  );
};
