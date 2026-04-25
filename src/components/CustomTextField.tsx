import React, { useState } from 'react';
import { LucideIcon, Eye, EyeOff } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CustomTextFieldProps {
  label: string;
  hintText: string;
  prefixIcon?: LucideIcon;
  isPassword?: boolean;
  value?: string;
  onChange?: (val: string) => void;
  readOnly?: boolean;
  type?: string;
}

export const CustomTextField: React.FC<CustomTextFieldProps> = ({
  label,
  hintText,
  prefixIcon: PrefixIcon,
  isPassword = false,
  value,
  onChange,
  readOnly = false,
  type = 'text',
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-[11px] font-semibold text-onSurfaceVariant tracking-[1.2px] uppercase">
        {label}
      </label>
      <div className="relative group">
        {PrefixIcon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-onSurfaceVariant">
            <PrefixIcon size={20} />
          </div>
        )}
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={hintText}
          readOnly={readOnly}
          className={cn(
            "w-full h-14 bg-surfaceContainerLow border border-outlineVariant rounded-2xl px-4 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
            PrefixIcon && "pl-12",
            isPassword && "pr-12",
            "text-base text-onSurface placeholder:text-onSurfaceVariant/50"
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-outlineVariant hover:text-onSurfaceVariant transition-colors"
          >
            {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
        )}
      </div>
    </div>
  );
};
