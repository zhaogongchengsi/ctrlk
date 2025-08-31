import { useState, useCallback, useRef, useEffect } from 'react';
import { openSearchResult, groupSearchResults, RxSearchManager } from '@/search/search-api';
import type { SearchResult } from '@/search/search-engine';

interface UseSearchOptions {
  debounceDelay?: number;
  minQueryLength?: number;
  enableDirectSearch?: boolean; // 是否启用直接搜索功能（用于没有匹配结果时的 Google 搜索）
}

interface UseSearchReturn {
  results: SearchResult[];
  loading: boolean;
  currentQuery: string;
  groupedResults: ReturnType<typeof groupSearchResults>;
  performSearch: (query: string) => void;
  handleResultSelect: (result: SearchResult) => Promise<void>;
  handleCommandSelect: (value: string) => Promise<void>;
  clearResults: () => void;
  inputProps: {
    onCompositionStart: () => void;
    onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement>) => void;
  };
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const {
    debounceDelay = 300,
    minQueryLength = 2,
    enableDirectSearch = false
  } = options;

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const searchManagerRef = useRef<RxSearchManager | null>(null);
  
  // 用于跟踪最新的查询状态，避免异步竞争条件
  const latestQueryRef = useRef('');

  // 初始化搜索管理器
  useEffect(() => {
    const searchManager = new RxSearchManager(debounceDelay);
    searchManagerRef.current = searchManager;

    // 订阅搜索结果
    const subscription = searchManager.subscribe(
      (searchResults, query) => {
        // 检查这个结果是否仍然有效（没有被更新的查询覆盖）
        if (latestQueryRef.current !== query) {
          console.log('Ignoring outdated search result:', { 
            resultQuery: query, 
            currentQuery: latestQueryRef.current 
          });
          return;
        }
        
        // 检查当前输入框的实际值，防止异步结果覆盖空输入状态
        // 使用 setTimeout 确保在下一个事件循环中检查最新的DOM状态
        setTimeout(() => {
          // 再次检查查询是否仍然有效
          if (latestQueryRef.current !== query) {
            console.log('Query changed during async check, ignoring result');
            return;
          }
          
          // 获取当前输入框的实际值
          const currentInputValue = document.querySelector('[cmdk-input]') as HTMLInputElement;
          const actualCurrentValue = currentInputValue?.value || '';
          
          // 如果当前输入框为空，但搜索结果不是针对空查询的，则忽略这个结果
          if (actualCurrentValue.trim() === '' && query.trim() !== '') {
            console.log('Ignoring search result because input is now empty:', { query, actualCurrentValue });
            setResults([]);
            setCurrentQuery('');
            setLoading(false);
            return;
          }
          
          // 如果查询匹配，正常更新结果
          setResults(searchResults);
          setCurrentQuery(query);
          setLoading(false);
        }, 0);
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
  }, [debounceDelay]);

  // 处理搜索逻辑，考虑组合输入状态
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchManagerRef.current) return;

    // 更新最新查询引用
    latestQueryRef.current = searchQuery;
    
    // 更新当前查询状态（即使为空也要更新）
    setCurrentQuery(searchQuery);

    // 如果正在组合输入，暂停搜索
    if (isComposing) {
      console.log('Composition in progress, pausing search');
      return;
    }

    // 如果查询为空，直接清空结果并停止loading
    if (searchQuery.trim() === '') {
      setResults([]);
      setLoading(false);
      return;
    }

    // 如果查询长度不足，清空结果并停止loading
    if (searchQuery.length < minQueryLength) {
      setResults([]);
      setLoading(false);
      return;
    }

    // 只有在查询长度足够时才显示loading状态
    setLoading(true);
    searchManagerRef.current.search(searchQuery);
  }, [isComposing, minQueryLength]);

  // 处理组合输入开始
  const handleCompositionStart = useCallback(() => {
    console.log('Composition started - pausing search');
    setIsComposing(true);
  }, []);

  // 处理搜索结果选择
  const handleResultSelect = useCallback(async (result: SearchResult) => {
    console.log('handleResultSelect called with:', result);
    try {
      console.log('About to call openSearchResult for:', result.title);
      await openSearchResult(result);
      console.log('Successfully opened:', result.title);
    } catch (error) {
      console.error('Failed to open result:', error);
    }
  }, []);

  // 处理直接搜索（用于联想等情况）
  const handleDirectSearch = useCallback(async (query: string) => {
    if (!enableDirectSearch) {
      console.log('Direct search disabled');
      return;
    }

    try {
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      
      const openRequest = {
        type: 'OPEN_SEARCH_RESULT',
        result: {
          id: `direct-search-${Date.now()}`,
          type: 'suggestion' as const,
          title: query,
          url: googleSearchUrl,
          suggestion: query
        }
      };
      
      const response = await chrome.runtime.sendMessage(openRequest);
      if (response?.success) {
        console.log('Opened direct search for:', query);
      } else {
        console.error('Failed to open direct search:', response?.error);
      }
    } catch (error) {
      console.error('Failed to perform direct search:', error);
    }
  }, [enableDirectSearch]);

  // 处理 Command 组件的选择事件（回车键触发）
  const handleCommandSelect = useCallback(async (value: string) => {
    console.log('handleCommandSelect called with value:', value);
    
    // 根据 value 查找对应的搜索结果
    const selectedResult = results.find(result => result.id === value);

    console.log('Selected result:', { 
      value, 
      selectedResult, 
      resultsCount: results.length,
      allResultIds: results.map(r => r.id)
    });

    if (selectedResult) {
      console.log('Calling handleResultSelect for:', selectedResult.title);
      await handleResultSelect(selectedResult);
    } else if (enableDirectSearch) {
      // 如果没有找到结果，检查是否是联想搜索
      if (currentQuery.trim()) {
        console.log('No result found, performing direct search for:', currentQuery.trim());
        await handleDirectSearch(currentQuery.trim());
      } else {
        console.log('No query to search for');
      }
    } else {
      console.log('No matching result found and direct search is disabled');
    }
  }, [results, currentQuery, handleResultSelect, handleDirectSearch, enableDirectSearch]);

  // 清空搜索结果
  const clearResults = useCallback(() => {
    latestQueryRef.current = '';
    setResults([]);
    setCurrentQuery('');
    setLoading(false);
  }, []);

  // 处理组合输入结束
  const handleCompositionEndWrapper = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    const query = e.currentTarget.value;
    console.log('Composition ended - resuming search');
    setIsComposing(false);
    
    // 更新最新查询引用
    latestQueryRef.current = query;
    
    // 组合输入结束后，立即执行搜索
    if (query && query.length >= minQueryLength) {
      setLoading(true);
      if (searchManagerRef.current) {
        searchManagerRef.current.search(query);
      }
    } else if (query.trim() === '') {
      // 如果组合输入结束后输入框为空，清空结果
      setResults([]);
      setCurrentQuery('');
      setLoading(false);
    }
  }, [minQueryLength]);

  // 分组搜索结果
  const groupedResults = groupSearchResults(results);

  return {
    results,
    loading,
    currentQuery,
    groupedResults,
    performSearch,
    handleResultSelect,
    handleCommandSelect,
    clearResults,
    inputProps: {
      onCompositionStart: handleCompositionStart,
      onCompositionEnd: handleCompositionEndWrapper
    }
  };
}
