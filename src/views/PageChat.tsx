import SearchResultsList from "@/components/search/SearchResultsList";
import { RecommendationsList } from "@/recommendations/RecommendationsList";
import { Command } from "@/components/command";
import { LoaderOne } from "@/components/ui/loader";
import { useSearch } from "@/hooks/useSearch";

export default function PageChat() {
  // 使用统一的搜索 hook，不启用直接搜索功能（因为这是聊天页面）
  const {
    loading,
    groupedResults,
    currentQuery,
    performSearch,
    handleResultSelect,
    handleCommandSelect,
    inputProps
  } = useSearch({ 
    debounceDelay: 300, 
    minQueryLength: 1, // 聊天页面可以设置更低的最小查询长度
    enableDirectSearch: false 
  });

  return (
    <div className="w-full md:w-200 mx-auto">
      <Command.Root className="w-full" onValueChange={performSearch} onSelect={handleCommandSelect}>
        <Command.Input 
          placeholder="搜索书签、标签页、历史记录和建议..."
          {...inputProps}
        />
        <div className="ctrlk-raycast-loader" />
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <LoaderOne />
          </div>
        ) : currentQuery.trim() === "" ? (
          // 没有搜索查询时显示推荐内容
          <RecommendationsList
            className="max-h-[50vh]"
            limit={6}
            title="推荐内容"
            emptyMessage="开始使用浏览器后，这里会显示个性化推荐"
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
