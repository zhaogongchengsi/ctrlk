import { Command } from "@/components/command";
import SearchResultsList from "./components/search/SearchResultsList";
import { LoaderOne } from "@/components/ui/loader";
import { useState, useCallback, useRef, useEffect } from "react";
import { openSearchResult, groupSearchResults, RxSearchManager } from "./search/search-api";
import type { SearchResult } from "./search/search-api";
import { useInputFocus, useDialogLifecycle } from "./hooks/useDialogLifecycle";
import { useTheme } from "./hooks/useTheme";
import { cn } from "./lib/utils";

function App() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuery, setCurrentQuery] = useState("");
  const [forceTheme, setForceTheme] = useState<"dark" | "light" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchManagerRef = useRef<RxSearchManager | null>(null);
  const detectedTheme = useTheme();
  const theme = forceTheme || detectedTheme;

  // 监听来自父页面的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SET_THEME") {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const receivedTheme = mediaQuery.matches ? "dark" : ("light" as "dark" | "light");
        // 设置强制主题
        setForceTheme(receivedTheme);
        // 立即应用主题到body
        if (mediaQuery.matches) {
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
        console.error("Search error:", error);
        setResults([]);
        setLoading(false);
      },
    );

    // 清理函数
    return () => {
      subscription.unsubscribe();
      searchManager.destroy();
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

  const performSearch = useCallback((searchQuery: string) => {
    if (!searchManagerRef.current) return;

    // 更新当前查询状态（即使为空也要更新）
    setCurrentQuery(searchQuery);

    if (searchQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    // 只有在查询长度足够时才显示loading状态
    setLoading(true);
    searchManagerRef.current.search(searchQuery);
  }, []);

  const handleResultSelect = async (result: SearchResult) => {
    console.log("handleResultSelect called with:", result);
    try {
      console.log("About to call openSearchResult for:", result.title);
      await openSearchResult(result);
      console.log("Successfully opened:", result.title);
    } catch (error) {
      console.error("Failed to open result:", error);
    }
  };

  // 处理直接搜索（用于联想等情况）
  const handleDirectSearch = useCallback(async (query: string) => {
    try {
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

      // 在这里我们需要通过 chrome API 打开新标签页
      // 由于这是在 content script 中，我们需要发送消息给 background script
      const openRequest = {
        type: "OPEN_SEARCH_RESULT",
        result: {
          id: `direct-search-${Date.now()}`,
          type: "suggestion" as const,
          title: query,
          url: googleSearchUrl,
          suggestion: query,
        },
      };

      const response = await chrome.runtime.sendMessage(openRequest);
      if (response?.success) {
        console.log("Opened direct search for:", query);
      } else {
        console.error("Failed to open direct search:", response?.error);
      }
    } catch (error) {
      console.error("Failed to perform direct search:", error);
    }
  }, []);

  // 处理 Command 组件的选择事件（回车键触发）
  const handleCommandSelect = useCallback(
    async (value: string) => {
      console.log("handleCommandSelect called with value:", value);
      
      // 根据 value 查找对应的搜索结果
      const selectedResult = results.find((result) => result.id === value);

      console.log("Selected result:", { 
        value, 
        selectedResult, 
        resultsCount: results.length,
        allResultIds: results.map(r => r.id)
      });

      if (selectedResult) {
        console.log("Calling handleResultSelect for:", selectedResult.title);
        await handleResultSelect(selectedResult);
      } else {
        // 如果没有找到结果，检查是否是联想搜索
        if (currentQuery.trim()) {
          console.log("No result found, performing direct search for:", currentQuery.trim());
          // 直接在 Google 中搜索当前查询
          await handleDirectSearch(currentQuery.trim());
        } else {
          console.log("No query to search for");
        }
      }
    },
    [results, currentQuery, handleDirectSearch],
  );

  // 分组搜索结果
  const groupedResults = groupSearchResults(results);

  // 根据主题选择样式
  const wrapperClassName =
    theme === "dark"
      ? "rounded-xl border border-gray-700/60 shadow-2xl bg-[var(--gray2)] backdrop-blur-md w-full overflow-hidden"
      : "rounded-xl border border-gray-200/60 shadow-2xl bg-white/98 backdrop-blur-md w-full overflow-hidden";

  return (
    <div className={cn("w-full md:w-200 mx-auto min-h-[400px]", wrapperClassName)}>
      <Command.Root
        className="w-full h-full min-h-[400px]"
        onValueChange={performSearch}
        onSelect={handleCommandSelect}
      >
        <Command.Input ref={inputRef} placeholder="搜索书签、标签页、历史记录和建议..." />
        <div className="ctrlk-raycast-loader" />
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <LoaderOne />
          </div>
        ) : (
          <SearchResultsList
            className="max-h-[320px]"
            results={groupedResults}
            onSelectResult={handleResultSelect}
            maxResultsPerGroup={10}
            emptyMessage={currentQuery ? "没有找到匹配的结果" : "开始输入以搜索内容..."}
          />
        )}
      </Command.Root>
    </div>
  );
}

export default App;
