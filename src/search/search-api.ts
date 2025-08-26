import type { SearchResult } from './search-engine';
import type { SearchRequest, SearchResponse, OpenResultRequest } from './search-manager';

export type { SearchResult };

export interface SearchStats {
  isInitialized: boolean;
  indexSize: string;
}

/**
 * 搜索书签和标签页
 */
export async function searchBookmarksAndTabs(
  query: string,
  limit = 50
): Promise<SearchResult[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    const request: SearchRequest = {
      type: 'SEARCH_BOOKMARKS_TABS',
      query: query.trim(),
      limit
    };

    const response = await chrome.runtime.sendMessage(request) as SearchResponse;
    
    if (response.error) {
      throw new Error(response.error);
    }

    return response.results || [];
  } catch (error) {
    console.error('Search failed:', error);
    throw error;
  }
}

/**
 * 打开搜索结果
 */
export async function openSearchResult(result: SearchResult): Promise<void> {
  try {
    const request: OpenResultRequest = {
      type: 'OPEN_SEARCH_RESULT',
      result
    };

    const response = await chrome.runtime.sendMessage(request) as { success: boolean; error?: string };
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to open result');
    }
  } catch (error) {
    console.error('Failed to open result:', error);
    throw error;
  }
}

/**
 * 创建防抖搜索函数
 */
export function createDebouncedSearch(delay = 300) {
  let timeoutId: NodeJS.Timeout;
  
  return (query: string, limit?: number): Promise<SearchResult[]> => {
    return new Promise((resolve, reject) => {
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(async () => {
        try {
          const results = await searchBookmarksAndTabs(query, limit);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
}

/**
 * 格式化搜索结果用于显示
 */
export function formatSearchResult(result: SearchResult) {
  const domain = extractDomain(result.url);
  
  return {
    icon: result.type === 'bookmark' ? '⭐' : '🔗',
    title: result.title || 'Untitled',
    subtitle: domain || result.url,
    favicon: result.favicon
  };
}

/**
 * 分组搜索结果
 */
export function groupSearchResults(results: SearchResult[]) {
  const bookmarks = results.filter(r => r.type === 'bookmark');
  const tabs = results.filter(r => r.type === 'tab');
  
  return { bookmarks, tabs };
}

/**
 * 获取搜索引擎统计信息
 */
export async function getSearchStats(): Promise<SearchStats> {
  try {
    // 发送一个空查询来获取统计信息
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SEARCH_STATS'
    });
    
    return response || { isInitialized: false, indexSize: 'Unknown' };
  } catch (error) {
    console.error('Failed to get search stats:', error);
    return { isInitialized: false, indexSize: 'Error' };
  }
}

/**
 * 搜索建议类
 */
export class SearchSuggestions {
  private recentQueries: string[] = [];
  private maxQueries = 10;

  addQuery(query: string): void {
    if (!query.trim()) return;
    
    // 移除重复项
    this.recentQueries = this.recentQueries.filter(q => q !== query);
    
    // 添加到开头
    this.recentQueries.unshift(query);
    
    // 限制数量
    if (this.recentQueries.length > this.maxQueries) {
      this.recentQueries = this.recentQueries.slice(0, this.maxQueries);
    }
  }

  getRecentQueries(): string[] {
    return [...this.recentQueries];
  }

  getSuggestions(query: string): string[] {
    if (!query.trim()) {
      return this.recentQueries;
    }
    
    const lowerQuery = query.toLowerCase();
    return this.recentQueries.filter(q => 
      q.toLowerCase().includes(lowerQuery) && q !== query
    );
  }

  clear(): void {
    this.recentQueries = [];
  }
}

// 辅助函数
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}
