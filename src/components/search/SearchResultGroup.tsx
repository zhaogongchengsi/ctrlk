import React from 'react';
import { CommandGroup } from "@/components/ui/command";
import { SearchResultItem } from './SearchResultItem';
import type { SearchResult } from '@/search/search-api';

interface SearchResultGroupProps {
  title: string;
  icon: string;
  results: SearchResult[];
  onSelectResult: (result: SearchResult) => void;
  showSeparator?: boolean;
  maxResults?: number;
  className?: string;
}

export const SearchResultGroup: React.FC<SearchResultGroupProps> = ({
  title,
  results,
  onSelectResult,
  maxResults,
  className = ""
}) => {
  // 如果没有结果，不渲染组件
  if (results.length === 0) {
    return null;
  }

  // 限制显示的结果数量
  const displayResults = maxResults ? results.slice(0, maxResults) : results;

  return (
    <>
      {/* 结果组 */}
      <CommandGroup 
        heading={`${title} (${results.length})`}
        className={className}
      >
        {displayResults.map((result) => (
          <SearchResultItem
            key={result.id}
            result={result}
            onSelect={onSelectResult}
          />
        ))}
      </CommandGroup>
    </>
  );
};

export default SearchResultGroup;
