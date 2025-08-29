import { Command, CommandInput } from "@/components/ui/command";
import CommandWrapper from "./components/CommandWrapper";
import SearchResultsList from "./components/search/SearchResultsList";
import { useState, useCallback, useRef, useEffect } from "react";
import { createDebouncedSearch, openSearchResult, groupSearchResults } from "./search/search-api";
import type { SearchResult } from "./search/search-api";
import { useInputFocus, useDialogLifecycle } from "./hooks/useDialogLifecycle";
import { useTheme } from "./hooks/useTheme";
import { cn } from "./lib/utils";

const debouncedSearch = createDebouncedSearch(300);

function App() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [forceTheme, setForceTheme] = useState<"dark" | "light" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const detectedTheme = useTheme();
  const theme = forceTheme || detectedTheme;

  // 监听来自父页面的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SET_THEME") {
        const receivedTheme = event.data.theme as "dark" | "light";
        console.log("Received theme from parent:", receivedTheme);

        // 设置强制主题
        setForceTheme(receivedTheme);

        // 立即应用主题到body
        if (receivedTheme === "dark") {
          document.body.classList.add("dark");
        } else {
          document.body.classList.remove("dark");
        }

        // 通知父页面主题设置完成
        setTimeout(() => {
          window.parent.postMessage(
            {
              type: "THEME_READY",
              theme: receivedTheme,
              timestamp: Date.now(),
            },
            "*",
          );
          console.log("Notified parent: theme ready");
        }, 50);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // 使用输入框聚焦 Hook
  useInputFocus(inputRef);

  // 使用生命周期 Hook 来处理对话框显示时的额外逻辑
  useDialogLifecycle({
    enableLogging: true,
    onEvent: (event) => {
      if (event === "did-show") {
        // 对话框完全显示后，确保输入框聚焦
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);

        // 设置主题class到body上，以便Tailwind的dark:类生效
        if (theme === "dark") {
          document.body.classList.add("dark");
        } else {
          document.body.classList.remove("dark");
        }
      }
    },
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
      console.log("Opened:", result.title);
    } catch (error) {
      console.error("Failed to open result:", error);
    }
  };

  // 分组搜索结果
  const groupedResults = groupSearchResults(results);

  // 根据主题选择样式
  const wrapperClassName =
    theme === "dark"
      ? "rounded-xl border border-gray-700/60 shadow-2xl bg-[var(--gray2)] backdrop-blur-md w-full overflow-hidden"
      : "rounded-xl border border-gray-200/60 shadow-2xl bg-white/98 backdrop-blur-md w-full overflow-hidden";

  return (
    <CommandWrapper
      debounceMs={150}
      maxHeight={600} // 设置最大高度为 600px
      enableScrollCheck={true}
      className={cn(wrapperClassName, "min-h-[400px]")}
    >
      <Command className="w-full h-full">
        <CommandInput ref={inputRef} onValueChange={performSearch} placeholder="搜索书签、标签页和历史记录..." />
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
