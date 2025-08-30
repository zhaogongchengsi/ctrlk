import React from "react";
import { Command } from "@/components/command";
import { SearchResultItem } from "./SearchResultItem";
import type { SearchResult } from "@/search/search-api";

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
  results,
  onSelectResult,
  maxResults,
  className = "",
  title,
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
      <Command.Group heading={title} className={className}>
        {displayResults.map((result) => (
          <SearchResultItem key={result.id} result={result} onSelect={onSelectResult} />
        ))}
      </Command.Group>
    </>
  );
};

export default SearchResultGroup;
