import React from 'react';
import { CommandList, CommandEmpty } from "@/components/ui/command";
import { SearchResultGroup } from './SearchResultGroup';
import { SearchSeparator } from './SearchSeparator';
import type { SearchResult } from '@/search/search-api';

interface GroupedSearchResults {
  tabs: SearchResult[];
  bookmarks: SearchResult[];
  history: SearchResult[];
}

interface SearchResultsListProps {
  results: GroupedSearchResults;
  query?: string;
  onSelectResult: (result: SearchResult) => void;
  maxResultsPerGroup?: number;
  emptyMessage?: string;
  className?: string;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  results,
  query,
  onSelectResult,
  maxResultsPerGroup = 10,
  emptyMessage = "没有找到匹配的结果",
  className = ""
}) => {
  const { tabs, bookmarks, history } = results;
  const totalResults = tabs.length + bookmarks.length + history.length;

  return (
    <CommandList className={className}>
      <CommandEmpty>{emptyMessage}</CommandEmpty>
      
      {/* 标签页组 */}
      <SearchResultGroup
        title="打开的标签页"
        icon="🔗"
        results={tabs}
        query={query}
        onSelectResult={onSelectResult}
        maxResults={maxResultsPerGroup}
        showSeparator={false}
      />

      {/* 分隔符：标签页和书签之间 */}
      <SearchSeparator 
        show={tabs.length > 0 && (bookmarks.length > 0 || history.length > 0)}
      />

      {/* 书签组 */}
      <SearchResultGroup
        title="书签"
        icon="⭐"
        results={bookmarks}
        query={query}
        onSelectResult={onSelectResult}
        maxResults={maxResultsPerGroup}
        showSeparator={false}
      />

      {/* 分隔符：书签和历史记录之间 */}
      <SearchSeparator 
        show={(tabs.length > 0 || bookmarks.length > 0) && history.length > 0}
      />

      {/* 历史记录组 */}
      <SearchResultGroup
        title="历史记录"
        icon="📚"
        results={history}
        query={query}
        onSelectResult={onSelectResult}
        maxResults={maxResultsPerGroup}
        showSeparator={false}
      />

      {/* 结果统计 */}
      {totalResults > 0 && process.env.NODE_ENV === 'development' && (
        <div className="px-3 py-2 text-xs text-gray-400 text-center border-t border-gray-100 mt-2">
          共找到 {totalResults} 个结果
        </div>
      )}
    </CommandList>
  );
};

export default SearchResultsList;
