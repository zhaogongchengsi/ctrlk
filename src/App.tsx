// import { Calculator, Calendar, CreditCard, Settings, Smile, User } from "lucide-react";
import { Command, CommandEmpty, CommandInput, CommandList, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import { useState, useCallback } from "react";
import { createDebouncedSearch, openSearchResult, groupSearchResults, formatSearchResult } from "./search/search-api";
import type { SearchResult } from "./search/search-api";

const debouncedSearch = createDebouncedSearch(300);

function App() {
  const [results, setResults] = useState<SearchResult[]>([]);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }
    try {
      const searchResults = await debouncedSearch(searchQuery);
      console.log("Search results:", searchResults);
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
    <div className="w-full h-screen bg-transparent flex items-center justify-center">
      <Command className="rounded-lg border shadow-lg bg-white/95 backdrop-blur-sm md:min-w-[450px] max-w-[600px]">
        <CommandInput onValueChange={performSearch} placeholder="搜索书签和标签页..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {/* 标签页组 */}
          {groupedResults.tabs.length > 0 && (
            <CommandGroup heading={`🔗 打开的标签页 (${groupedResults.tabs.length})`}>
              {groupedResults.tabs.map((result) => {
                const formatted = formatSearchResult(result);
                return (
                  <CommandItem
                    key={result.id}
                    value={`${result.title} ${result.url}`}
                    onSelect={() => handleResultSelect(result)}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      {result.favicon ? (
                        <img 
                          src={result.favicon} 
                          alt="" 
                          className="w-4 h-4 rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-sm">
                          {formatted.icon}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {formatted.title}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {formatted.subtitle}
                      </div>
                    </div>
                    {result.score && (
                      <div className="text-xs text-gray-400 font-mono">
                        {result.score.toFixed(0)}
                      </div>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {/* 分隔符 */}
          {groupedResults.tabs.length > 0 && groupedResults.bookmarks.length > 0 && (
            <CommandSeparator />
          )}

          {/* 书签组 */}
          {groupedResults.bookmarks.length > 0 && (
            <CommandGroup heading={`⭐ 书签 (${groupedResults.bookmarks.length})`}>
              {groupedResults.bookmarks.map((result) => {
                const formatted = formatSearchResult(result);
                return (
                  <CommandItem
                    key={result.id}
                    value={`${result.title} ${result.url}`}
                    onSelect={() => handleResultSelect(result)}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      {result.favicon ? (
                        <img 
                          src={result.favicon} 
                          alt="" 
                          className="w-4 h-4 rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-sm">
                          {formatted.icon}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {formatted.title}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {formatted.subtitle}
                      </div>
                    </div>
                    {result.score && (
                      <div className="text-xs text-gray-400 font-mono">
                        {result.score.toFixed(0)}
                      </div>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  );
}

export default App;
