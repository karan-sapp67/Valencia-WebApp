import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CustomButtonProps {
  text: string;
  onPressed?: () => void;
  isSecondary?: boolean;
  isLoading?: boolean;
  className?: string;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  text,
  onPressed,
  isSecondary = false,
  isLoading = false,
  className,
}) => {
  if (isSecondary) {
    return (
      <button
        onClick={onPressed}
        disabled={isLoading}
        className={cn(
          "w-full h-14 rounded-full flex items-center justify-center font-semibold text-base transition-all",
          "bg-white text-primary border border-outlineVariant hover:bg-surface transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
      >
        {isLoading ? "Loading..." : text}
      </button>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onPressed}
      disabled={isLoading}
      className={cn(
        "relative w-full h-14 rounded-full overflow-hidden flex items-center justify-center",
        "bg-primary-gradient text-white font-semibold text-base",
        "shadow-[0_8px_16px_rgba(0,93,167,0.2)] transition-shadow",
        "disabled:opacity-70 disabled:cursor-not-allowed",
        className
      )}
    >
      <span className="relative z-10">{isLoading ? "Processing..." : text}</span>

      {/* Shimmer Effect */}
      {!isLoading && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            delay: 3,
            repeatDelay: 2
          }}
          className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
        />
      )}
    </motion.button>
  );
};
