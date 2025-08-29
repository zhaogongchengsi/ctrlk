import React from 'react';
import { CommandSeparator } from "@/components/ui/command";

interface SearchSeparatorProps {
  show: boolean;
  className?: string;
  variant?: 'default' | 'thick' | 'dotted';
}

export const SearchSeparator: React.FC<SearchSeparatorProps> = ({
  show,
  className = "",
  variant = 'default'
}) => {
  if (!show) {
    return null;
  }

  const variantClasses = {
    default: "border-gray-200",
    thick: "border-gray-300 border-t-2",
    dotted: "border-gray-200 border-dotted"
  };

  return (
    <CommandSeparator 
      className={`${variantClasses[variant]} ${className}`}
    />
  );
};

export default SearchSeparator;
