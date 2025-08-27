import React from 'react';
import { CommandItem } from "@/components/ui/command";
import { SEARCH_CONFIG } from '@/search/search-config';
import type { SearchResult } from '@/search/search-api';

interface SearchResultItemProps {
  result: SearchResult;
  query?: string;
  onSelect: (result: SearchResult) => void;
  className?: string;
}

interface HighlightTextProps {
  text: string;
  query?: string;
  className?: string;
}

// 高亮搜索关键词的组件
const HighlightText: React.FC<HighlightTextProps> = ({ text, query, className = "" }) => {
  if (!query || !query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
  
  // 创建正则表达式来匹配所有搜索词
  const regex = new RegExp(`(${searchTerms.map(term => 
    term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  ).join('|')})`, 'gi');

  const parts = text.split(regex);
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isMatch = searchTerms.some(term => 
          part.toLowerCase() === term.toLowerCase()
        );
        
        return isMatch ? (
          <mark 
            key={index} 
            className={SEARCH_CONFIG.HIGHLIGHT.className}
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </span>
  );
};

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
  query,
  onSelect,
  className = ""
}) => {
  const icon = getResultIcon(result.type);
  const domain = extractDomain(result.url);

  return (
    <CommandItem
      key={result.id}
      value={`${result.title} ${result.url}`}
      onSelect={() => onSelect(result)}
      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100 ${className}`}
    >
      {/* 图标或网站favicon */}
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {result.favicon ? (
          <img 
            src={result.favicon} 
            alt="" 
            className="w-4 h-4 rounded"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              // 显示默认图标
              const iconSpan = document.createElement('span');
              iconSpan.textContent = icon;
              iconSpan.className = 'text-sm';
              e.currentTarget.parentNode?.appendChild(iconSpan);
            }}
          />
        ) : (
          <span className="text-sm">
            {icon}
          </span>
        )}
      </div>

      {/* 主要内容 */}
      <div className="flex-1 min-w-0">
        {/* 标题 */}
        <div className="font-medium text-sm truncate">
          <HighlightText 
            text={result.title || 'Untitled'} 
            query={query}
          />
        </div>
        
        {/* 副标题/URL */}
        <div className="text-xs text-gray-500 truncate">
          <HighlightText 
            text={domain || result.url} 
            query={query}
          />
        </div>

        {/* 历史记录特有信息 */}
        {result.type === 'history' && (result.lastVisitTime || result.visitCount) && (
          <div className="text-xs text-gray-400 truncate mt-1">
            {result.lastVisitTime && (
              <span>{formatLastVisitTime(result.lastVisitTime)}</span>
            )}
            {result.visitCount && result.visitCount > 1 && (
              <span className="ml-2">• {result.visitCount} 次访问</span>
            )}
          </div>
        )}
      </div>

      {/* 分数显示（调试时可用） */}
      {result.score && process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-400 font-mono">
          {result.score.toFixed(0)}
        </div>
      )}
    </CommandItem>
  );
};

export default SearchResultItem;
