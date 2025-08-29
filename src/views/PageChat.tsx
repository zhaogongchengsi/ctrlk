import SearchResultsList from "@/components/search/SearchResultsList";
import { Command, CommandInput } from "@/components/ui/command";
import { groupSearchResults, openSearchResult } from "@/search/search-api";
import type { SearchResult } from "@/search/search-engine";
import { useCallback, useState } from "react";


 const mockResults: SearchResult[] = [
   // 书签类型的结果
   {
     id: "bookmark-1",
     type: "bookmark",
     title: "GitHub - React 官方文档",
     url: "https://github.com/facebook/react",
     favicon: "https://github.com/favicon.ico",
     snippet: "用于构建用户界面的 JavaScript 库",
     score: 95,
     highlights: {
       title: [{ indices: [0, 5], value: "GitHub" }],
     },
   },
   {
     id: "bookmark-2",
     type: "bookmark",
     title: "VS Code 扩展开发文档",
     url: "https://code.visualstudio.com/api",
     favicon: "https://code.visualstudio.com/favicon.ico",
     snippet: "Visual Studio Code 扩展开发指南",
     score: 88,
   },
   {
     id: "bookmark-3",
     type: "bookmark",
     title: "Tailwind CSS 官方文档",
     url: "https://tailwindcss.com/docs",
     favicon: "https://tailwindcss.com/favicon.ico",
     snippet: "实用优先的 CSS 框架",
     score: 82,
   },

   // 标签页类型的结果
   {
     id: "tab-1",
     type: "tab",
     title: "TypeScript 手册 - 基础类型",
     url: "https://www.typescriptlang.org/docs/handbook/basic-types.html",
     favicon: "https://www.typescriptlang.org/favicon.ico",
     snippet: "TypeScript 基础类型介绍",
     score: 90,
     highlights: {
       title: [{ indices: [0, 10], value: "TypeScript" }],
     },
   },
   {
     id: "tab-2",
     type: "tab",
     title: "Stack Overflow - React Hooks 问题",
     url: "https://stackoverflow.com/questions/tagged/react-hooks",
     favicon: "https://stackoverflow.com/favicon.ico",
     snippet: "React Hooks 相关问题讨论",
     score: 85,
   },
   {
     id: "tab-3",
     type: "tab",
     title: "npm 包管理器",
     url: "https://www.npmjs.com/",
     favicon: "https://www.npmjs.com/favicon.ico",
     snippet: "JavaScript 包管理器",
     score: 78,
   },

   // 历史记录类型的结果
   {
     id: "history-1",
     type: "history",
     title: "MDN Web Docs - JavaScript 指南",
     url: "https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide",
     favicon: "https://developer.mozilla.org/favicon.ico",
     snippet: "JavaScript 完整指南和参考文档",
     score: 92,
     lastVisitTime: Date.now() - 1000 * 60 * 30, // 30分钟前访问
     visitCount: 15,
     highlights: {
       title: [{ indices: [15, 25], value: "JavaScript" }],
     },
   },
   {
     id: "history-2",
     type: "history",
     title: "CSS Grid 布局完全指南",
     url: "https://css-tricks.com/snippets/css/complete-guide-grid/",
     favicon: "https://css-tricks.com/favicon.ico",
     snippet: "CSS Grid 布局的完整教程",
     score: 87,
     lastVisitTime: Date.now() - 1000 * 60 * 60 * 2, // 2小时前访问
     visitCount: 8,
   },
   {
     id: "history-3",
     type: "history",
     title: "Node.js 官方文档 - API 参考",
     url: "https://nodejs.org/api/",
     favicon: "https://nodejs.org/favicon.ico",
     snippet: "Node.js API 完整参考文档",
     score: 80,
     lastVisitTime: Date.now() - 1000 * 60 * 60 * 24, // 1天前访问
     visitCount: 25,
   },
   {
     id: "history-4",
     type: "history",
     title: "Figma 设计工具",
     url: "https://www.figma.com/",
     favicon: "https://www.figma.com/favicon.ico",
     snippet: "协作式界面设计工具",
     score: 75,
     lastVisitTime: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3天前访问
     visitCount: 5,
   },

   // 更多多样化的结果
   {
     id: "bookmark-4",
     type: "bookmark",
     title: "Chrome 扩展开发指南",
     url: "https://developer.chrome.com/docs/extensions/",
     favicon: "https://developer.chrome.com/favicon.ico",
     snippet: "Chrome 浏览器扩展开发文档",
     score: 89,
   },
   {
     id: "tab-4",
     type: "tab",
     title: "Vercel 部署平台",
     url: "https://vercel.com/dashboard",
     favicon: "https://vercel.com/favicon.ico",
     snippet: "前端应用部署和托管",
     score: 76,
   },
   {
     id: "history-5",
     type: "history",
     title: "Prettier 代码格式化工具",
     url: "https://prettier.io/docs/en/index.html",
     favicon: "https://prettier.io/favicon.ico",
     snippet: "代码自动格式化工具配置",
     score: 83,
     lastVisitTime: Date.now() - 1000 * 60 * 60 * 6, // 6小时前访问
     visitCount: 12,
   },
 ];


export default function PageChat() {
  const [results] = useState<SearchResult[]>(mockResults);

  const performSearch = useCallback((value: string) => {
    console.log("Searching for:", value);
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
    <div className="w-full md:w-200">
      <Command className="w-full">
        <CommandInput onValueChange={performSearch} placeholder="搜索书签、标签页和历史记录..." />
        <div className="ctrlk-raycast-loader" />
        <SearchResultsList
          results={groupedResults}
          onSelectResult={handleResultSelect}
          maxResultsPerGroup={10}
          emptyMessage="没有找到匹配的结果"
        />
      </Command>
    </div>
  );
}
