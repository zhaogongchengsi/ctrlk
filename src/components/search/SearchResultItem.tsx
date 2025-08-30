import React from 'react';
import { Command } from "@/components/command";
import { SEARCH_CONFIG } from '@/search/search-config';
import { PreciseHighlightText } from '../PreciseHighlightText';
import type { SearchResult } from '@/search/search-api';

interface SearchResultItemProps {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
  className?: string;
}

// 获取图标组件
const getResultIcon = (type: SearchResult['type']) => {
  return SEARCH_CONFIG.ICONS[type] || SEARCH_CONFIG.ICONS.default;
};

// 格式化最后访问时间
const formatLastVisitTime = (timestamp?: number): string => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return '今天';
  } else if (diffDays === 1) {
    return '昨天';
  } else if (diffDays < 7) {
    return `${diffDays} 天前`;
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });
  }
};

// 提取域名
const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
};

export const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onSelect,
  className = ""
}) => {
  const icon = getResultIcon(result.type);
  const domain = extractDomain(result.url);

  return (
    <Command.Item
      key={result.id}
      value={`${result.title} ${result.url}`}
      data-url={result.url}
      data-type={result.type}
      onSelect={() => onSelect(result)}
      className={`flex items-center gap-[8px] cursor-pointe ${className} first:mt-[8px] last:mb-1 min-h-[52px] group`}
    >
      {/* 图标或网站favicon */}
      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
        {result.favicon ? (
          <img
            src={result.favicon}
            alt=""
            className="w-[20px] h-[20px] rounded transition-transform duration-150"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              // 显示默认图标
              const iconSpan = document.createElement("span");
              iconSpan.textContent = icon;
              iconSpan.className = "text-base opacity-70";
              e.currentTarget.parentNode?.appendChild(iconSpan);
            }}
          />
        ) : (
          <span className="text-base opacity-70 transition-all duration-150 group-hover:opacity-90 dark:opacity-60 dark:group-hover:opacity-80">
            {icon}
          </span>
        )}
      </div>

      {/* 主要内容 */}
      <div className="flex-1 min-w-0 flex items-center justify-between">
        {/* 标题 */}
        <div className="text-sm text-[var(--gray12)] truncate leading-tight">
          <PreciseHighlightText
            text={result.title || "Untitled"}
            highlights={result.highlights?.title}
            highlightClassName={SEARCH_CONFIG.HIGHLIGHT.className}
          />
        </div>

        <div>
          {/* 副标题/URL */}
          <div className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
            <PreciseHighlightText
              text={domain || result.url}
              highlights={result.highlights?.url}
              highlightClassName={SEARCH_CONFIG.HIGHLIGHT.className}
            />
          </div>

          {/* 历史记录特有信息 */}
          {result.type === "history" && (result.lastVisitTime || result.visitCount) && (
            <div className="text-[12px] text-gray-400 dark:text-gray-500 truncate mt-1">
              {result.lastVisitTime && <span>{formatLastVisitTime(result.lastVisitTime)}</span>}
              {result.visitCount && result.visitCount > 1 && <span className="ml-2">• {result.visitCount} 次访问</span>}
            </div>
          )}
        </div>
      </div>

      {/* 分数显示（调试时可用） */}
      {result.score && process.env.NODE_ENV === "development" && (
        <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">{result.score.toFixed(0)}</div>
      )}
    </Command.Item>
  );
};

export default SearchResultItem;
