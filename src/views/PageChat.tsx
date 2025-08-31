import SearchResultsList from "@/components/search/SearchResultsList";
import { Command } from "@/components/command";
import { LoaderOne } from "@/components/ui/loader";
import { useSearch } from "@/hooks/useSearch";

export default function PageChat() {
  // 使用统一的搜索 hook，不启用直接搜索功能（因为这是聊天页面）
  const {
    loading,
    groupedResults,
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
        ) : (
          <SearchResultsList
            className="max-h-[50vh]"
            results={groupedResults}
            onSelectResult={handleResultSelect}
            maxResultsPerGroup={10}
          />
        )}
      </Command.Root>
    </div>
  );
}
