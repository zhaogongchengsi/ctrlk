import { CommandList, CommandEmpty } from "@/components/ui/command";
import { SearchResultGroup } from './SearchResultGroup';
import type { SearchResult } from '@/search/search-api';

interface GroupedSearchResults {
  tabs: SearchResult[];
  bookmarks: SearchResult[];
  history: SearchResult[];
}

interface SearchResultsListProps {
  results: GroupedSearchResults;
  onSelectResult: (result: SearchResult) => void;
  maxResultsPerGroup?: number;
  emptyMessage?: string;
  className?: string;
}

export default function SearchResultsList({
  results,
  onSelectResult,
  maxResultsPerGroup = 3,
  emptyMessage = '暂无搜索结果',
  className = '',
}: SearchResultsListProps) {
  const { tabs, bookmarks, history } = results;
  // const totalResults = tabs.length + bookmarks.length + history.length;

  return (
    <CommandList className={className}>
      <CommandEmpty>{emptyMessage}</CommandEmpty>
      
      {/* 标签页组 */}
      <SearchResultGroup
        title="打开的标签页"
        icon="🔗"
        results={tabs}
        onSelectResult={onSelectResult}
        maxResults={maxResultsPerGroup}
        showSeparator={false}
      />


      {/* 书签组 */}
      <SearchResultGroup
        title="书签"
        icon="⭐"
        results={bookmarks}
        onSelectResult={onSelectResult}
        maxResults={maxResultsPerGroup}
        showSeparator={false}
      />

      {/* 历史记录组 */}
      <SearchResultGroup
        title="历史记录"
        icon="📚"
        results={history}
        onSelectResult={onSelectResult}
        maxResults={maxResultsPerGroup}
        showSeparator={false}
      />
    </CommandList>
  );
}
