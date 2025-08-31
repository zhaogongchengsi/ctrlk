import SearchResultsList from "@/components/search/SearchResultsList";
import { RecommendationsList } from "@/recommendations/RecommendationsList";
import { Command } from "@/components/command";
import { LoaderOne } from "@/components/ui/loader";
import { useSearch } from "@/hooks/useSearch";
import { useRecommendations } from "@/recommendations/useRecommendations";
import { useCallback } from "react";

export default function PageChat() {
  // 使用统一的搜索 hook，不启用直接搜索功能（因为这是聊天页面）
  const { loading, groupedResults, currentQuery, performSearch, handleResultSelect, handleCommandSelect, inputProps } =
    useSearch({
      debounceDelay: 300,
      minQueryLength: 1, // 聊天页面可以设置更低的最小查询长度
      enableDirectSearch: false,
    });

  const {
    recommendations,
    loading: getRecommendationLoading,
    error,
    handleRecommendationSelect,
  } = useRecommendations({ limit: 10 });

  // 统一的选择处理函数，根据类型分别处理
  const handleUnifiedSelect = useCallback(
    async (value: string, type?: string) => {
      console.log("handleUnifiedSelect called with:", { value, type });

      if (type === "recommendation") {
        console.log("Handling recommendation selection:", value);
        await handleRecommendationSelect(value);
      } else if (type === "search") {
        // 搜索结果选择
        console.log("Handling search result selection:", value);
        await handleCommandSelect(value);
      } else {
        // 默认处理（回退到原有逻辑）
        console.log("Handling default selection:", value);
        await handleCommandSelect(value);
      }
    },
    [handleCommandSelect, handleRecommendationSelect],
  );

  return (
    <div className="w-full md:w-200 mx-auto">
      <Command.Root className="w-full" onValueChange={performSearch} onSelect={handleUnifiedSelect}>
        <Command.Input placeholder="搜索书签、标签页、历史记录和建议..." {...inputProps} />
        <div className="ctrlk-raycast-loader" />
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <LoaderOne />
          </div>
        ) : currentQuery.trim() === "" ? (
          // 没有搜索查询时显示推荐内容
          <RecommendationsList
            loading={getRecommendationLoading}
            error={error}
            className="max-h-[50vh]"
            recommendations={recommendations}
            title="推荐内容"
          />
        ) : (
          // 有搜索查询时显示搜索结果
          <SearchResultsList
            className="max-h-[50vh]"
            results={groupedResults}
            onSelectResult={handleResultSelect}
            maxResultsPerGroup={10}
            emptyMessage="没有找到匹配的结果"
          />
        )}
      </Command.Root>
    </div>
  );
}
