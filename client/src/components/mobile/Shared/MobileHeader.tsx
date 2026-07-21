import React from 'react';

interface MobileHeaderProps {
  title: string;
  subtitle?: string | React.ReactNode;
  leftAction?: React.ReactNode;
  rightActions?: React.ReactNode;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  leftAction,
  rightActions
}) => {
  return (
    <div className="sticky top-0 left-0 right-0 h-16 bg-dark-surface/90 backdrop-blur-lg border-b border-dark-border flex items-center justify-between px-4 z-20 select-none">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        {leftAction && <div className="flex items-center">{leftAction}</div>}
        <div className="flex flex-col min-w-0 text-left">
          <h1 className="text-base font-bold text-white leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <div className="text-[10px] text-dark-muted font-medium truncate mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {rightActions && <div className="flex items-center space-x-2 shrink-0">{rightActions}</div>}
    </div>
  );
};

export default MobileHeader;
