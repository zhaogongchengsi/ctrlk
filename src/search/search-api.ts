import type { SearchResult } from './search-engine';
import type { SearchRequest, SearchResponse, OpenResultRequest } from './search-manager';
import { Subject, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export type { SearchResult };

export interface SearchStats {
  isInitialized: boolean;
  indexSize: string;
}

/**
 * 搜索书签、标签页和历史记录
 */
export async function searchBookmarksTabsAndHistory(
  query: string
): Promise<SearchResult[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    const request: SearchRequest = {
      type: 'SEARCH_BOOKMARKS_TABS',
      query: query.trim()
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
 * 搜索书签和标签页（保持向后兼容）
 * @deprecated 使用 searchBookmarksTabsAndHistory 代替
 */
export const searchBookmarksAndTabs = searchBookmarksTabsAndHistory;

/**
 * 打开搜索结果
 */
export async function openSearchResult(result: SearchResult): Promise<void> {
  console.log("openSearchResult called for:", result.title, "type:", result.type);
  
  try {
    const request: OpenResultRequest = {
      type: 'OPEN_SEARCH_RESULT',
      result
    };

    console.log("Sending message to background script:", request);
    const response = await chrome.runtime.sendMessage(request) as { success: boolean; error?: string };
    console.log("Received response from background script:", response);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to open result');
    }
    
    console.log("Successfully processed open result for:", result.title);
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
  
  return (query: string): Promise<SearchResult[]> => {
    return new Promise((resolve, reject) => {
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(async () => {
        try {
          const results = await searchBookmarksTabsAndHistory(query);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
}

/**
 * 创建基于 RxJS 的搜索管理器
 */
export class RxSearchManager {
  private searchSubject = new Subject<string>();
  private currentQuery = '';
  private searchSequence = 0;
  private delay: number;
  private searchStream$: Observable<{ query: string; results: SearchResult[]; sequence: number }>;

  constructor(delay = 300) {
    this.delay = delay;
    this.searchStream$ = this.setupSearchStream();
  }

  private setupSearchStream(): Observable<{ query: string; results: SearchResult[]; sequence: number }> {
    return this.searchSubject.pipe(
      debounceTime(this.delay),
      distinctUntilChanged(),
      switchMap(async (query) => {
        const sequence = ++this.searchSequence;
        this.currentQuery = query;
        
        if (!query.trim()) {
          return { query, results: [], sequence };
        }

        try {
          const results = await searchBookmarksTabsAndHistory(query);
          
          // 确保只返回最新查询的结果，避免竞争条件
          if (this.currentQuery === query && sequence === this.searchSequence) {
            return { query, results, sequence };
          } else {
            // 查询已过期，返回空结果
            return { query: this.currentQuery, results: [], sequence: this.searchSequence };
          }
        } catch (error) {
          console.error('Search failed:', error);
          // 错误情况下也要返回当前查询状态
          return { query: this.currentQuery, results: [], sequence: this.searchSequence };
        }
      }),
      catchError((error) => {
        console.error('Search stream error:', error);
        return of({ query: this.currentQuery, results: [], sequence: this.searchSequence });
      })
    );
  }

  /**
   * 搜索方法
   */
  search(query: string): void {
    // 过滤掉连续的相同查询
    if (query !== this.currentQuery) {
      this.searchSubject.next(query);
    }
  }

  /**
   * 获取搜索结果流
   */
  getSearchStream(): Observable<{ query: string; results: SearchResult[]; sequence: number }> {
    return this.searchStream$;
  }

  /**
   * 订阅搜索结果
   */
  subscribe(
    callback: (results: SearchResult[], query: string) => void,
    errorCallback?: (error: unknown) => void
  ) {
    return this.searchStream$.subscribe({
      next: ({ query, results }) => callback(results, query),
      error: errorCallback || ((error) => console.error('Search subscription error:', error))
    });
  }

  /**
   * 立即清空结果
   */
  clearResults(): void {
    this.currentQuery = '';
    this.searchSubject.next('');
  }

  /**
   * 获取当前查询
   */
  getCurrentQuery(): string {
    return this.currentQuery;
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.searchSubject.complete();
  }
}

/**
 * 格式化搜索结果用于显示
 */
export function formatSearchResult(result: SearchResult) {
  const domain = extractDomain(result.url);
  
  let icon = '🔗';
  if (result.type === 'bookmark') {
    icon = '⭐';
  } else if (result.type === 'history') {
    icon = '📚';
  } else if (result.type === 'tab') {
    icon = '🔗';
  } else if (result.type === 'suggestion') {
    icon = '🔍';
  }
  
  return {
    icon,
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
  const history = results.filter(r => r.type === 'history');
  const suggestions = results.filter(r => r.type === 'suggestion');
  
  return { bookmarks, tabs, history, suggestions };
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
