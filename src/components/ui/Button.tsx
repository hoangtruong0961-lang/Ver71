import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
  icon?: React.ReactNode;
  isLoading?: boolean;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  icon, 
  isLoading, 
  disabled,
  ...props 
}) => {
  
  const baseStyles = "relative px-6 py-3 rounded-xl font-sans font-black transition-all duration-200 flex items-center justify-center gap-2.5 overflow-hidden group select-none";
  
  const variants = {
    // Neumorphic raised primary plate with soft sky-400 theme text & hover glow
    primary: "bg-[#0d1220] text-sky-400 border border-[#141b2c]/10 shadow-[4px_4px_8px_rgba(3,4,8,0.7),_-4px_-4px_8px_rgba(25,35,58,0.2)] hover:text-sky-300 hover:shadow-[5px_5px_12px_rgba(3,4,8,0.8),_-5px_-5px_12px_rgba(25,35,58,0.25)] active:shadow-[inset_2px_2px_5px_rgba(3,4,8,0.7),_inset_-2px_-2px_5px_rgba(25,35,58,0.15)]",
    
    // Ghost sunken/translucent plate
    ghost: "bg-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-805/20 border border-transparent hover:border-[#141b2c]/10",
    
    // Neumorphic outline - clean raised bone outline plate
    outline: "bg-[#0d1220] border border-[#141b2c]/20 text-slate-300 shadow-[3px_3px_6px_rgba(3,4,8,0.65),_-3.5px_-3.5px_6px_rgba(25,35,58,0.18)] hover:text-slate-100 active:shadow-inner",
    
    // Neumorphic danger - raised red warning plate
    danger: "bg-[#0d1220] border border-red-500/20 text-red-400 shadow-[2px_2px_5px_rgba(3,4,8,0.75),_-2px_-2px_5px_rgba(25,35,58,0.15)] hover:text-red-301 hover:border-red-500/40 hover:shadow-[3px_3px_8px_rgba(3,4,8,0.8)] active:shadow-inner"
  };

  const disabledStyles = "opacity-40 cursor-not-allowed grayscale shadow-none pointer-events-none";

  return (
    <motion.button
      type={props.type || "button"}
      whileHover={!disabled ? { scale: 1.01 } : {}}
      whileTap={!disabled ? { scale: 0.99 } : {}}
      className={`${baseStyles} ${variants[variant]} ${disabled || isLoading ? disabledStyles : ''} ${className}`}
      disabled={disabled || isLoading}
      onClick={props.onClick}
      {...props}
    >
      {/* Background sweep effect for primary buttons */}
      {variant === 'primary' && !disabled && (
        <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
      )}

      {isLoading ? (
        <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
      ) : (
        <>
          {icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>}
          <span className="tracking-widest uppercase text-[10px] font-bold font-mono">{children}</span>
        </>
      )}
    </motion.button>
  );
};

export default Button;
