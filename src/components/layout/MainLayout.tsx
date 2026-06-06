
import React from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { MOBILE_CONFIG } from '../../constants/mobileConfig';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { visualEffects } = useTheme();
  const { isMobile } = useResponsive();

  return (
    <MotionConfig reducedMotion={visualEffects ? 'never' : 'always'}>
      {/* 
        Sử dụng h-full để tương thích thu phóng lên tới 70% hoàn toàn.
        Áp dụng safe-area-padding từ MOBILE_CONFIG.
      */}
      <div 
        className="relative w-full h-full bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200 overflow-hidden selection:bg-mystic-accent selection:text-mystic-900 font-sans transition-colors duration-300"
        style={{ 
          paddingBottom: isMobile ? MOBILE_CONFIG.safeAreaPadding : 0
        }}
      >
        
        {/* Underlay canvas */}
        <div className="absolute inset-0 z-0 bg-[#e6ebf4] dark:bg-[#0b1329]" />

        {/* Floating Particles - Adjusted sizes for mobile/desktop */}
        {visualEffects && (
          <>
            <div className="absolute top-1/4 left-1/4 w-64 h-64 md:w-96 md:h-96 bg-mystic-accent/10 dark:bg-mystic-accent/5 rounded-full blur-[80px] md:blur-[100px] animate-pulse-slow pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-48 h-48 md:w-64 md:h-64 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-[60px] md:blur-[80px] animate-pulse-slow pointer-events-none delay-1000" />
          </>
        )}

        {/* Main Content */}
        <motion.main 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: visualEffects ? 1 : 0 }}
          className="relative z-10 w-full h-full flex flex-col"
        >
          {children}
        </motion.main>
      </div>
    </MotionConfig>
  );
};

export default MainLayout;