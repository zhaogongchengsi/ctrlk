import { Command } from "@/components/command";
import SearchResultsList from "./components/search/SearchResultsList";
import { RecommendationsList } from "./recommendations/RecommendationsList";
import { LoaderOne } from "@/components/ui/loader";
import { useState, useRef, useEffect } from "react";
import { useInputFocus, useDialogLifecycle } from "./hooks/useDialogLifecycle";
import { useTheme } from "./hooks/useTheme";
import { useSearch } from "./hooks/useSearch";
import { cn } from "./lib/utils";

function App() {
  const [forceTheme, setForceTheme] = useState<"dark" | "light" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const detectedTheme = useTheme();
  const theme = forceTheme || detectedTheme;

  // 使用统一的搜索 hook，启用直接搜索功能
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
    minQueryLength: 2, 
    enableDirectSearch: true 
  });

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
        <Command.Input 
          ref={inputRef} 
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
            className="max-h-[320px]"
            limit={8}
            title="基于使用习惯的推荐"
            emptyMessage="开始使用浏览器后，这里会显示个性化推荐"
          />
        ) : (
          // 有搜索查询时显示搜索结果
          <SearchResultsList
            className="max-h-[320px]"
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

export default App;
