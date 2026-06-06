
import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Hook dùng để kiểm tra xem thiết bị hiện tại có phải là di động hay không.
 * Ngưỡng mặc định là 768px (MD breakpoint của Tailwind).
 */
export const useResponsive = (breakpoint: number = 1024) => {
  const getLogicalWidth = () => {
    if (typeof window === 'undefined') return 0;
    return window.innerWidth;
  };

  const [width, setWidth] = useState<number>(getLogicalWidth());

  useEffect(() => {
    const handleResize = () => {
      setWidth(getLogicalWidth());
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // ensure it runs on mount and option updates
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = width < breakpoint;

  return { 
    isMobile, 
    width 
  };
};
