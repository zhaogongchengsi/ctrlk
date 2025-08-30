import SearchResultsList from "@/components/search/SearchResultsList";
import { Command } from "@/components/command";
import { LoaderOne } from "@/components/ui/loader";
import { groupSearchResults, openSearchResult, RxSearchManager } from "@/search/search-api";
import type { SearchResult } from "@/search/search-engine";
import { useCallback, useState, useEffect, useRef } from "react";


export default function PageChat() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const searchManagerRef = useRef<RxSearchManager | null>(null);

  // 初始化搜索管理器
  useEffect(() => {
    const searchManager = new RxSearchManager(300);
    searchManagerRef.current = searchManager;

    // 订阅搜索结果
    const subscription = searchManager.subscribe(
      (searchResults, query) => {
        setResults(searchResults);
        setCurrentQuery(query);
        setLoading(false);
      },
      (error) => {
        console.error('Search error:', error);
        setResults([]);
        setLoading(false);
      }
    );

    // 清理函数
    return () => {
      subscription.unsubscribe();
      searchManager.destroy();
    };
  }, []);

  const performSearch = useCallback((value: string) => {
    if (!searchManagerRef.current) return;
    
    // 更新当前查询状态
    setCurrentQuery(value);
    
    if (!value.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    
    // 只有在查询不为空时才显示loading状态
    setLoading(true);
    searchManagerRef.current.search(value);
  }, []);

  const handleResultSelect = async (result: SearchResult) => {
    try {
      await openSearchResult(result);
      console.log("Opened:", result.title);
    } catch (error) {
      console.error("Failed to open result:", error);
    }
  };

  // 分组搜索结果
  const groupedResults = groupSearchResults(results);

  return (
    <div className="w-full md:w-200 mx-auto">
      <Command.Root 
        className="w-full"
        value={currentQuery}
        onValueChange={performSearch}
      >
        <Command.Input
          placeholder="搜索书签、标签页、历史记录和建议..."
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
