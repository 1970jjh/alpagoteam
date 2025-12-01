
import React from 'react';

export const Panel: React.FC<{ children: React.ReactNode; className?: string; border?: boolean }> = ({ children, className = '', border = true }) => (
  <div className={`glass-panel rounded-2xl p-6 transition-colors duration-300 ${className} ${border ? 'border dark:border-glass-highlight' : ''}`}>
    {children}
  </div>
);

export const Button: React.FC<{ 
  onClick?: (e?: React.MouseEvent) => void; 
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}> = ({ onClick, children, variant = 'primary', disabled = false, className = '', type = 'button' }) => {
  
  const variants = {
    primary: 'bg-cyan-600/10 text-cyan-700 border-cyan-600 hover:bg-cyan-600 hover:text-white dark:bg-ai-primary/10 dark:text-ai-primary dark:border-ai-primary dark:hover:bg-ai-primary dark:hover:text-black dark:shadow-[0_0_15px_rgba(0,242,255,0.2)]',
    secondary: 'bg-purple-600/10 text-purple-700 border-purple-600 hover:bg-purple-600 hover:text-white dark:bg-ai-secondary/10 dark:text-ai-secondary dark:border-ai-secondary dark:hover:bg-ai-secondary dark:hover:text-white dark:shadow-[0_0_15px_rgba(112,0,255,0.2)]',
    danger: 'bg-red-500/10 text-red-600 border-red-500 hover:bg-red-500 hover:text-white dark:bg-ai-accent/10 dark:text-ai-accent dark:border-ai-accent dark:hover:bg-ai-accent dark:hover:text-white',
    ghost: 'bg-transparent border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-400 dark:border-glass-border dark:text-ai-dim dark:hover:text-white dark:hover:border-white/30'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative px-6 py-3 rounded-lg font-display font-bold uppercase tracking-wider text-sm transition-all duration-300 border
        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
        active:scale-95 flex items-center justify-center gap-2
        ${variants[variant]}
        ${className}
      `}
    >
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`glass-input w-full px-4 py-3 rounded-lg font-mono text-sm placeholder-gray-500 dark:placeholder-gray-400 transition-all ${props.className}`}
  />
);

export const Badge: React.FC<{ label: string; value: string | number; color?: string }> = ({ label, value, color = 'text-ai-primary' }) => (
  <div className="flex flex-col items-center">
    <span className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-ai-dim font-mono mb-1">{label}</span>
    <span className={`font-display font-bold text-xl neon-text ${color}`}>{value}</span>
  </div>
);

export const GridBackground = () => (
  <div className="fixed inset-0 z-[-1] bg-[length:40px_40px] opacity-20 pointer-events-none transition-all duration-300
    bg-light-grid dark:bg-cyber-grid
  " />
);

export const Footer: React.FC<{ className?: string; theme?: 'light' | 'dark' }> = ({ className = '', theme = 'dark' }) => (
  <div className={`w-full text-center py-4 mt-auto border-t border-gray-200 dark:border-white/5 ${className}`}>
    <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
      @ All Right Reserved by <span className="font-bold text-gray-600 dark:text-gray-400">JJ Creative 교육연구소</span>
    </p>
  </div>
);
