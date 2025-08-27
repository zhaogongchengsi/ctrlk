import React from 'react';
import { CommandGroup, CommandSeparator } from "@/components/ui/command";
import { SearchResultItem } from './SearchResultItem';
import type { SearchResult } from '@/search/search-api';

interface SearchResultGroupProps {
  title: string;
  icon: string;
  results: SearchResult[];
  query?: string;
  onSelectResult: (result: SearchResult) => void;
  showSeparator?: boolean;
  maxResults?: number;
  className?: string;
}

// 获取结果类型的显示名称
const getTypeDisplayName = (type: SearchResult['type']): string => {
  switch (type) {
    case 'bookmark':
      return '书签';
    case 'tab':
      return '打开的标签页';
    case 'history':
      return '历史记录';
    default:
      return '结果';
  }
};

export const SearchResultGroup: React.FC<SearchResultGroupProps> = ({
  title,
  icon,
  results,
  query,
  onSelectResult,
  showSeparator = false,
  maxResults,
  className = ""
}) => {
  // 如果没有结果，不渲染组件
  if (results.length === 0) {
    return null;
  }

  // 限制显示的结果数量
  const displayResults = maxResults ? results.slice(0, maxResults) : results;
  const hasMoreResults = maxResults && results.length > maxResults;

  return (
    <>
      {/* 分隔符 */}
      {showSeparator && <CommandSeparator />}
      
      {/* 结果组 */}
      <CommandGroup 
        heading={`${icon} ${title} (${results.length})`}
        className={className}
      >
        {displayResults.map((result) => (
          <SearchResultItem
            key={result.id}
            result={result}
            query={query}
            onSelect={onSelectResult}
          />
        ))}
        
        {/* 显示更多结果的提示 */}
        {hasMoreResults && (
          <div className="px-3 py-2 text-xs text-gray-400 text-center border-t border-gray-100">
            还有 {results.length - maxResults!} 个{getTypeDisplayName(results[0].type)}...
          </div>
        )}
      </CommandGroup>
    </>
  );
};

export default SearchResultGroup;
