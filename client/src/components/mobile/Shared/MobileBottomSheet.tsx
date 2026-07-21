import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end select-none">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />
      
      {/* Content Sheet */}
      <div className="relative bg-dark-surface border-t border-dark-border rounded-t-3xl max-h-[85vh] flex flex-col z-10 animate-slide-up shadow-2xl overflow-hidden">
        {/* Notch Handler bar */}
        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto my-3 shrink-0" />
        
        {/* Sheet Header */}
        {title && (
          <div className="px-5 pb-3 flex items-center justify-between border-b border-dark-border/50 shrink-0">
            <h3 className="font-bold text-white text-base text-left">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-dark-muted hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto flex-1 scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  );
};

export default MobileBottomSheet;
