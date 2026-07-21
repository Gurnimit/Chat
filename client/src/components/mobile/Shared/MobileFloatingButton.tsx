import React from 'react';

interface MobileFloatingButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  title?: string;
}

export const MobileFloatingButton: React.FC<MobileFloatingButtonProps> = ({
  onClick,
  icon,
  title
}) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-6 w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center shadow-xl transition-transform hover:scale-105 active:scale-95 z-25 min-h-[44px] min-w-[44px]"
      title={title}
    >
      {icon}
    </button>
  );
};

export default MobileFloatingButton;
