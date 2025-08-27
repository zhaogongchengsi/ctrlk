import { Command, CommandInput } from "@/components/ui/command";
import CommandWrapper from "./components/CommandWrapper";
import SearchResultsList from "./components/SearchResultsList";
import { useState, useCallback, useRef } from "react";
import { createDebouncedSearch, openSearchResult, groupSearchResults } from "./search/search-api";
import type { SearchResult } from "./search/search-api";
import { useInputFocus, useDialogLifecycle } from "./hooks/useDialogLifecycle";

const debouncedSearch = createDebouncedSearch(300);

function App() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // 使用输入框聚焦 Hook
  useInputFocus(inputRef);

  // 使用生命周期 Hook 来处理对话框显示时的额外逻辑
  useDialogLifecycle({
    enableLogging: true,
    onEvent: (event) => {
      if (event === 'did-show') {
        // 对话框完全显示后，确保输入框聚焦
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      }
    }
  });

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }
    try {
      const searchResults = await debouncedSearch(searchQuery);
      setResults(searchResults);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      // setLoading(false);
    }
  }, []);

  const handleResultSelect = async (result: SearchResult) => {
    try {
      await openSearchResult(result);
      console.log('Opened:', result.title);
    } catch (error) {
      console.error('Failed to open result:', error);
    }
  };

  // 分组搜索结果
  const groupedResults = groupSearchResults(results);

  return (
      <CommandWrapper
        debounceMs={150}
        maxHeight={600} // 设置最大高度为 600px
        enableScrollCheck={true}
        className="rounded-lg border shadow-lg bg-white/95 backdrop-blur-sm w-full"
      >
        <Command className="w-full">
          <CommandInput
            ref={inputRef}
            onValueChange={performSearch} 
            placeholder="搜索书签、标签页和历史记录..." 
          />
          <SearchResultsList
            results={groupedResults}
            onSelectResult={handleResultSelect}
            maxResultsPerGroup={10}
            emptyMessage="没有找到匹配的结果"
          />
        </Command>
      </CommandWrapper>
  );
}

export default App;
