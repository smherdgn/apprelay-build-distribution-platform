
import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className = "" }) => {
  return (
    <div 
      className={`bg-slate-700/30 backdrop-filter backdrop-blur-lg shadow-xl border border-slate-600/50 rounded-2xl p-6 ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassCard;