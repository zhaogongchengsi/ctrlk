import { useState, useEffect, useCallback } from 'react';
import { 
  openSearchResult,
  createDebouncedSearch,
  formatSearchResult,
  groupSearchResults
} from '../search/search-api';
import type { SearchResult } from '../search/search-api';

// 创建防抖搜索函数
const debouncedSearch = createDebouncedSearch(300);

export function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 执行搜索
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchResults = await debouncedSearch(searchQuery, 20);
      setResults(searchResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 处理查询变化
  useEffect(() => {
    performSearch(query);
  }, [query, performSearch]);

  // 处理键盘事件
  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          await handleResultSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setQuery('');
        setResults([]);
        break;
    }
  }, [results, selectedIndex]);

  // 处理结果选择
  const handleResultSelect = async (result: SearchResult) => {
    try {
      await openSearchResult(result);
      console.log('Opened:', result.title);
    } catch (error) {
      console.error('Failed to open result:', error);
    }
  };

  // 分组结果
  const groupedResults = groupSearchResults(results);

  return (
    <div className="search-container">
      {/* 搜索输入框 */}
      <div className="search-input-container">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索书签和标签页..."
          className="search-input"
          autoFocus
        />
        {loading && <div className="search-loading">🔍</div>}
      </div>

      {/* 搜索结果 */}
      {results.length > 0 && (
        <div className="search-results">
          {/* 标签页结果 */}
          {groupedResults.tabs.length > 0 && (
            <div className="result-group">
              <div className="result-group-title">🔗 标签页</div>
              {groupedResults.tabs.map((result, index) => {
                const globalIndex = index;
                return (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    selected={selectedIndex === globalIndex}
                    onClick={() => handleResultSelect(result)}
                  />
                );
              })}
            </div>
          )}

          {/* 书签结果 */}
          {groupedResults.bookmarks.length > 0 && (
            <div className="result-group">
              <div className="result-group-title">⭐ 书签</div>
              {groupedResults.bookmarks.map((result, index) => {
                const globalIndex = groupedResults.tabs.length + index;
                return (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    selected={selectedIndex === globalIndex}
                    onClick={() => handleResultSelect(result)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 无结果提示 */}
      {query.length >= 2 && results.length === 0 && !loading && (
        <div className="no-results">
          没有找到匹配的结果
        </div>
      )}
    </div>
  );
}

// 搜索结果项组件
function SearchResultItem({ 
  result, 
  selected, 
  onClick 
}: { 
  result: SearchResult; 
  selected: boolean;
  onClick: () => void;
}) {
  const formatted = formatSearchResult(result);
  
  return (
    <div
      className={`search-result-item ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="result-icon">
        {result.favicon ? (
          <img src={result.favicon} alt="" className="favicon" />
        ) : (
          <span>{formatted.icon}</span>
        )}
      </div>
      <div className="result-content">
        <div className="result-title">{formatted.title}</div>
        <div className="result-subtitle">{formatted.subtitle}</div>
      </div>
      {result.score && (
        <div className="result-score">{result.score.toFixed(0)}</div>
      )}
    </div>
  );
}
