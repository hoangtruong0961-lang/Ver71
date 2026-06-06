import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown } from 'lucide-react';
import { MarkdownRenderer } from '../../../common/MarkdownRenderer';
import { useTheme } from '../../../../context/ThemeContext';

interface TawaThinkingWidgetProps {
  thinkingContent: string;
  charName?: string;
  isOpen: boolean;
  onToggle: () => void;
  contentBeautify?: boolean;
}

export const TawaThinkingWidget: React.FC<TawaThinkingWidgetProps> = ({
  thinkingContent,
  charName = 'Tawa',
  isOpen,
  onToggle,
  contentBeautify = true,
}) => {
  const { theme } = useTheme();

  // Neumorphic styling for all 4 default themes
  const styles = useMemo(() => {
    switch (theme) {
      case 'light':
        return {
          bg: '#e6ebf4', // Classic neumorphic soft blue-gray
          text: '#2c3e50',
          textMuted: '#7f8c8d',
          accent: '#ec4899', // Pinkish heart accent for Tawa
          border: '1px solid rgba(255, 255, 255, 0.75)',
          shadowOuter: '8px 8px 16px #c8d0dc, -8px -8px 16px #ffffff',
          shadowInner: 'inset 3px 3px 6px #cbd5e1, inset -3px -3px 6px #ffffff',
          flatBg: 'linear-gradient(135deg, #edf2fc, #dee4ed)',
          convexBg: 'linear-gradient(135deg, #f2f7fc, #dae0e9)',
          bubbleColors: [
            'rgba(244, 114, 182, 0.4)', // Pink
            'rgba(147, 197, 253, 0.4)', // Blue
            'rgba(192, 132, 252, 0.4)', // Purple
          ]
        };
      case 'dark':
        return {
          bg: '#0b1329', // Dark navy background
          text: '#f1f5f9',
          textMuted: '#94a3b8',
          accent: '#f472b6',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          shadowOuter: '9px 9px 18px #040812, -9px -9px 18px #121e40',
          shadowInner: 'inset 4px 4px 8px #040812, inset -4px -4px 8px #121e40',
          flatBg: 'linear-gradient(135deg, #0d162d, #080d1e)',
          convexBg: 'linear-gradient(135deg, #0f1c3a, #060a16)',
          bubbleColors: [
            'rgba(244, 114, 182, 0.25)', // Pink
            'rgba(192, 132, 252, 0.25)', // Purple
            'rgba(56, 189, 248, 0.25)',  // Cyan
          ]
        };
      case 'pastel':
        return {
          bg: '#e8e2d5', // Creamy warm sand
          text: '#2c1810',
          textMuted: '#7a6a60',
          accent: '#bf7575',
          border: '1px solid rgba(255, 255, 255, 0.75)',
          shadowOuter: '9px 9px 18px #cbc3b2, -9px -9px 18px #ffffff',
          shadowInner: 'inset 4px 4px 8px #cbc3b2, inset -4px -4px 8px #ffffff',
          flatBg: 'linear-gradient(135deg, #f3ede2, #ddd6c8)',
          convexBg: 'linear-gradient(135deg, #f9f4ea, #d5cebf)',
          bubbleColors: [
            'rgba(191, 117, 117, 0.3)', // Rose
            'rgba(224, 182, 163, 0.35)', // Soft Sand
            'rgba(182, 212, 203, 0.35)', // Sage
          ]
        };
      case 'clay':
        return {
          bg: '#debca3', // Matte earthy clay
          text: '#35251c',
          textMuted: '#7c6353',
          accent: '#cf5c36',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          shadowOuter: '9px 9px 18px #be967a, -9px -9px 18px #fadec4',
          shadowInner: 'inset 4px 4px 8px #be967a, inset -4px -4px 8px #fadec4',
          flatBg: 'linear-gradient(135deg, #ebd0bc, #cca78d)',
          convexBg: 'linear-gradient(135deg, #f0d6c4, #c7a186)',
          bubbleColors: [
            'rgba(207, 92, 54, 0.25)', // Terracotta
            'rgba(235, 208, 188, 0.3)', // Light clay
            'rgba(111, 140, 106, 0.25)', // Olive clay
          ]
        };
      default:
        // Dynamic fallback referencing CSS styles
        return {
          bg: 'var(--theme-bg, #0b1329)',
          text: 'var(--theme-text, #f1f5f9)',
          textMuted: 'var(--theme-muted, #94a3b8)',
          accent: 'var(--theme-accent, #ec4899)',
          border: 'var(--neu-border, 1px solid rgba(255, 255, 255, 0.05))',
          shadowOuter: '8px 8px 16px var(--neu-shadow-dark, rgba(0,0,0,0.5)), -8px -8px 16px var(--neu-shadow-light, rgba(255,255,255,0.05))',
          shadowInner: 'inset 4px 4px 8px var(--neu-shadow-dark, rgba(0,0,0,0.5)), inset -4px -4px 8px var(--neu-shadow-light, rgba(255,255,255,0.05))',
          flatBg: 'var(--neu-flat-bg, var(--theme-bg, #0b1329))',
          convexBg: 'var(--neu-convex-bg, var(--theme-bg, #0b1329))',
          bubbleColors: [
            'rgba(244, 114, 182, 0.25)',
            'rgba(56, 189, 248, 0.25)',
          ]
        };
    }
  }, [theme]);

  // Generate randomized float coordinates for background bubbles when component mounts
  const bubbles = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const size = Math.random() * 45 + 15; // 15px to 60px
      const duration = Math.random() * 7 + 7; // 7s to 14s
      const delay = Math.random() * 3; // 0s to 3s
      const left = Math.random() * 100; // 0% to 100%
      const swayXEnd = (Math.random() - 0.5) * 60; // -30px to 30px
      const opacity = Math.random() * 0.3 + 0.15; // 0.15 to 0.45

      return {
        id: i,
        size,
        duration,
        delay,
        left,
        swayXEnd,
        opacity,
      };
    });
  }, []);

  if (!thinkingContent) return null;

  const displayName = charName || 'Nhân vật';

  return (
    <div className="w-full my-6 select-none font-sans px-1">
      {/* Dynamic CSS animations for Neumorphic bubble physics */}
      <style>{`
        @keyframes tawaBubbleRiseNew {
          0% {
            transform: translate3d(0, 15px, 0) scale(0.7);
            opacity: 0;
          }
          15% {
            opacity: var(--bubble-opacity, 0.4);
          }
          85% {
            opacity: var(--bubble-opacity, 0.4);
          }
          100% {
            transform: translate3d(var(--sway-x-end, 15px), -175px, 0) scale(0.5);
            opacity: 0;
          }
        }
        .tawa-pulse-heart {
          animation: tawaHeartPulseNew 1.6s ease-in-out infinite;
        }
        @keyframes tawaHeartPulseNew {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.25); }
          30% { transform: scale(1); }
          45% { transform: scale(1.15); }
          75% { transform: scale(1); }
        }
      `}</style>

      {/* Main raised plate (Neumorphic element) */}
      <div 
        className="w-full rounded-2xl overflow-hidden transition-all duration-300 relative"
        style={{
          background: styles.flatBg,
          boxShadow: styles.shadowOuter,
          border: styles.border,
        }}
      >
        {/* Rising Particles aligned with Theme Colors */}
        {contentBeautify && isOpen && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-80 transition-opacity duration-500">
            {bubbles.map((b) => {
              const bgGradientColor = styles.bubbleColors[b.id % styles.bubbleColors.length];
              return (
                <div
                  key={b.id}
                  className="absolute rounded-full"
                  style={{
                    width: `${b.size}px`,
                    height: `${b.size}px`,
                    left: `${b.left}%`,
                    bottom: `-20px`,
                    background: `radial-gradient(circle at 35% 35%, ${bgGradientColor}, transparent 80%)`,
                    filter: 'blur(1px)',
                    animation: `tawaBubbleRiseNew ${b.duration}s linear infinite`,
                    animationDelay: `${b.delay}s`,
                    // @ts-ignore
                    '--sway-x-end': `${b.swayXEnd}px`,
                    '--bubble-opacity': b.opacity,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Tactile button trigger shifting state on click */}
        <button
          onClick={onToggle}
          className="w-full flex justify-between items-center px-6 py-4.5 cursor-pointer relative z-10 transition-all duration-200 text-left outline-none select-none hover:opacity-95"
          style={{
            background: isOpen ? 'rgba(128,128,128,0.04)' : 'transparent',
          }}
        >
          <span className="flex items-center gap-2.5">
            {contentBeautify ? (
              <span className="tawa-pulse-heart inline-block text-base leading-none">💕</span>
            ) : (
              <Brain className="w-4 h-4" style={{ color: styles.accent }} />
            )}
            <span 
              className="font-extrabold text-[13.5px] md:text-sm tracking-wide select-none"
              style={{ color: styles.text }}
            >
              Tư Duy AI
            </span>
          </span>

          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 220 }}
            className="flex-shrink-0"
            style={{ color: styles.accent }}
          >
            <ChevronDown size={18} className="stroke-[2.5]" />
          </motion.div>
        </button>

        {/* Expandable internal compartments (Recessed/reversing neumorphic design) */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
              className="relative z-10 overflow-hidden"
            >
              <div className="px-5 pb-5 pt-1">
                <div 
                  className="px-5 py-4 transition-all duration-300"
                  style={{
                    boxShadow: styles.shadowInner,
                    borderRadius: '16px',
                    background: theme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.25)',
                    color: styles.text,
                  }}
                >
                  {/* Scrollable internal area for thoughts with custom scrollbar */}
                  <div className="max-h-[350px] overflow-y-auto pr-1 custom-scrollbar text-left font-normal">
                    <MarkdownRenderer
                      content={thinkingContent}
                      regexScripts={[]}
                      className="text-xs md:text-[13px] leading-relaxed font-normal"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
