import { useState, useEffect, useCallback, useRef } from 'react';
import type { RecommendationItem, RecommendationConfig } from './recommendation-engine';
import { openSearchResult } from '@/search/search-api';

interface UseRecommendationsOptions {
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  config?: Partial<RecommendationConfig>;
}

interface UseRecommendationsReturn {
  recommendations: RecommendationItem[];
  loading: boolean;
  error: string | null;
  refreshRecommendations: () => Promise<void>;
  handleRecommendationSelect: (value: string) => Promise<void>
}

export function useRecommendations(
  options: UseRecommendationsOptions = {}
): UseRecommendationsReturn {
  const {
    limit = 6,
    autoRefresh = false,
    refreshInterval = 5 * 60 * 1000, // 5分钟
    config
  } = options;

  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const fetchRecommendations = useCallback(async () => {
    if (loadingRef.current) return; // 防止重复加载

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // 通过Chrome消息API请求推荐数据
      const response = await chrome.runtime.sendMessage({
        type: 'GET_RECOMMENDATIONS',
        limit,
        config
      });

      console.log('Received recommendations response:', response);

      if (response.success) {
        setRecommendations(response.recommendations || []);
      } else {
        setError(response.error || 'Failed to get recommendations');
        setRecommendations([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setRecommendations([]);
      console.error('Failed to fetch recommendations:', err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [limit, config]);

  const handleRecommendationSelect = useCallback(async (value: string) => {
    console.log('handleCommandSelect called with value:', value);

    // 根据 value 查找对应的搜索结果
    const selectedResult = recommendations.find(result => result.id === value);

    if (selectedResult) {
      const searchResult = {
        id: selectedResult.id,
        type: selectedResult.type as "bookmark" | "tab" | "history",
        title: selectedResult.title,
        url: selectedResult.url,
        favicon: selectedResult.favicon,
        snippet: selectedResult.snippet
      };

      await openSearchResult(searchResult);
    } else {
      console.log('No matching result found and direct search is disabled');
    }
  }, [recommendations]);


  // 组件挂载时获取推荐
  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      if (!mounted || loadingRef.current) return;

      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_RECOMMENDATIONS',
          limit,
          config
        });

        console.log('Initial recommendations response:', response);

        if (mounted) {
          if (response.success) {
            setRecommendations(response.recommendations || []);
          } else {
            setError(response.error || 'Failed to get recommendations');
            setRecommendations([]);
          }
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
          setRecommendations([]);
          console.error('Failed to fetch initial recommendations:', err);
        }
      } finally {
        loadingRef.current = false;
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, [limit, config]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchRecommendations();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchRecommendations]);

  return {
    recommendations,
    loading,
    error,
    handleRecommendationSelect,
    refreshRecommendations: fetchRecommendations
  };
}
