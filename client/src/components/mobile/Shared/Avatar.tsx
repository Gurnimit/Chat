import React from 'react';

interface AvatarProps {
  src?: string | null;
  username: string;
  isOnline?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  username,
  isOnline = false,
  size = 'md',
  onClick,
  className = ''
}) => {
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px] rounded-lg',
    sm: 'w-8 h-8 text-xs rounded-xl',
    md: 'w-10 h-10 text-sm rounded-xl',
    lg: 'w-14 h-14 text-lg rounded-2xl',
    xl: 'w-20 h-20 text-2xl rounded-3xl'
  };

  const dotClasses = {
    xs: 'w-1.5 h-1.5 -bottom-0.5 -right-0.5 border',
    sm: 'w-2 h-2 -bottom-0.5 -right-0.5 border',
    md: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5 border-2',
    lg: 'w-3 h-3 bottom-0 right-0 border-2',
    xl: 'w-4 h-4 bottom-0.5 right-0.5 border-2'
  };

  const initials = (username || '?').substring(0, 2).toUpperCase();

  return (
    <div 
      onClick={onClick}
      className={`relative shrink-0 select-none ${sizeClasses[size]} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={username}
          loading="lazy"
          className="w-full h-full object-cover rounded-[inherit] border border-white/5"
          onError={(e) => {
            // Fallback if image fails to load
            (e.target as HTMLImageElement).style.display = 'none';
            const parent = (e.target as HTMLImageElement).parentElement;
            if (parent) {
              const fallback = parent.querySelector('.avatar-fallback');
              if (fallback) fallback.classList.remove('hidden');
            }
          }}
        />
      ) : null}
      
      {/* Fallback Display */}
      <div 
        className={`avatar-fallback w-full h-full flex items-center justify-center font-bold text-white bg-gradient-to-tr from-brand-600 to-indigo-500 rounded-[inherit] border border-white/5 uppercase ${
          src ? 'hidden absolute inset-0' : ''
        }`}
      >
        {initials}
      </div>

      {/* Status Dot */}
      {isOnline && (
        <span 
          className={`absolute rounded-full bg-emerald-500 border-dark-surface z-10 ${dotClasses[size]}`}
          title="Online"
        />
      )}
    </div>
  );
};

export default Avatar;
