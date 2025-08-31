import { Command } from "@/components/command";
import { SearchResultGroup } from "./SearchResultGroup";
import type { SearchResult } from "@/search/search-api";

interface GroupedSearchResults {
  tabs: SearchResult[];
  bookmarks: SearchResult[];
  history: SearchResult[];
  suggestions: SearchResult[];
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
  className = "",
}: SearchResultsListProps) {
  const { tabs, bookmarks, history, suggestions } = results;
  const totalResults = tabs.length + bookmarks.length + history.length + suggestions.length;

  return (
    <Command.List className={className}>
      {totalResults === 0 && <Command.Empty className="py-6 text-center text-sm">暂无搜索结果</Command.Empty>}

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

      {/* 搜索建议组 */}
      <SearchResultGroup
        title="搜索建议"
        icon="�"
        results={suggestions}
        onSelectResult={onSelectResult}
        maxResults={Math.min(maxResultsPerGroup, 5)} // 限制搜索建议数量
        showSeparator={false}
      />

      {/* 历史记录组 */}
      <SearchResultGroup
        title="历史记录"
        icon="�"
        results={history}
        onSelectResult={onSelectResult}
        maxResults={maxResultsPerGroup}
        showSeparator={false}
      />

      {/* 搜索建议组 - 优先显示 */}
      <SearchResultGroup
        title="搜索建议"
        icon="�"
        results={suggestions}
        onSelectResult={onSelectResult}
        maxResults={Math.min(maxResultsPerGroup, 5)} // 限制搜索建议数量
        showSeparator={false}
      />
    </Command.List>
  );
}
