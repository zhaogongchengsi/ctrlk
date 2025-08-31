import { SearchEngine, type SearchResult } from './search-engine';

export interface SearchRequest {
  type: 'SEARCH_BOOKMARKS_TABS';
  query: string;
  limit?: number;
}

export interface SearchResponse {
  type: 'SEARCH_RESULTS';
  results: SearchResult[];
  error?: string;
}

export interface OpenResultRequest {
  type: 'OPEN_SEARCH_RESULT';
  result: SearchResult;
}

export interface StatsRequest {
  type: 'GET_SEARCH_STATS';
}

export class SearchManager {
  private searchEngine: SearchEngine;
  private isInitializing = false;

  constructor() {
    this.searchEngine = new SearchEngine();
    this.setupMessageListeners();
    this.setupEventListeners();
  }

  async initialize(): Promise<void> {
    if (this.isInitializing) {
      console.log('Search engine already initializing...');
      return;
    }

    this.isInitializing = true;
    
    try {
      await this.searchEngine.buildIndex();
      console.log('Search manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize search manager:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((
      message: SearchRequest | OpenResultRequest | StatsRequest,
      _sender,
      sendResponse
    ) => {
      try {
        if (message.type === 'SEARCH_BOOKMARKS_TABS') {
          this.handleSearchRequest(message as SearchRequest, sendResponse);
          return true; // 表示异步响应
        } else if (message.type === 'OPEN_SEARCH_RESULT') {
          this.handleOpenResult(message as OpenResultRequest, sendResponse);
          return true; // 表示异步响应
        } else if (message.type === 'GET_SEARCH_STATS') {
          // 同步响应
          try {
            const stats = this.getStats();
            sendResponse(stats);
          } catch (error) {
            console.error('Failed to get stats:', error);
            sendResponse({ error: 'Failed to get stats' });
          }
          return false; // 表示同步响应
        }
      } catch (error) {
        console.error('Message listener error:', error);
        sendResponse({ error: 'Message processing failed' });
        return false;
      }
      
      // 未知消息类型
      return false;
    });
  }

  private setupEventListeners(): void {
    // 监听书签变化
    if (chrome.bookmarks) {
      chrome.bookmarks.onCreated.addListener(() => {
        this.refreshIndex();
      });

      chrome.bookmarks.onRemoved.addListener(() => {
        this.refreshIndex();
      });

      chrome.bookmarks.onChanged.addListener(() => {
        this.refreshIndex();
      });

      chrome.bookmarks.onMoved.addListener(() => {
        this.refreshIndex();
      });
    }

    // 监听标签页变化
    if (chrome.tabs) {
      chrome.tabs.onCreated.addListener(() => {
        this.refreshIndex();
      });

      chrome.tabs.onRemoved.addListener(() => {
        this.refreshIndex();
      });

      chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
        // 只在标题或URL变化时刷新
        if (changeInfo.title || changeInfo.url) {
          this.refreshIndex();
        }
      });
    }

    // 监听历史记录变化
    if (chrome.history) {
      chrome.history.onVisited.addListener(() => {
        // 延迟刷新，避免频繁更新
        this.debouncedRefreshIndex();
      });

      chrome.history.onVisitRemoved.addListener(() => {
        this.refreshIndex();
      });
    }

    // 定期刷新索引（每5分钟）
    setInterval(() => {
      this.refreshIndex();
    }, 5 * 60 * 1000);
  }

  private debouncedRefreshIndex = this.debounce(() => {
    this.refreshIndex();
  }, 2000); // 2秒防抖

  private debounce<T extends (...args: unknown[]) => void>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  private async handleSearchRequest(
    request: SearchRequest,
    sendResponse: (response: SearchResponse) => void
  ): Promise<void> {
    try {
      const results = await this.searchEngine.search(request.query);
      sendResponse({
        type: 'SEARCH_RESULTS',
        results
      });
    } catch (error) {
      console.error('Search request failed:', error);
      sendResponse({
        type: 'SEARCH_RESULTS',
        results: [],
        error: error instanceof Error ? error.message : 'Search failed'
      });
    }
  }

  private async handleOpenResult(
    request: OpenResultRequest,
    sendResponse: (response: { success: boolean; error?: string }) => void
  ): Promise<void> {
    console.log("handleOpenResult called in SearchManager for:", request.result.title);
    
    try {
      // 直接处理，不再使用双重处理
      const result = await this.processOpenResult(request);
      console.log("processOpenResult completed, sending response:", result);
      sendResponse(result);
    } catch (error) {
      console.error('Failed to open search result:', error);
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open result'
      };
      console.log("Sending error response:", errorResponse);
      sendResponse(errorResponse);
    }
  }

  private async processOpenResult(
    request: OpenResultRequest
  ): Promise<{ success: boolean; error?: string }> {
    const result = request.result;
    console.log("processOpenResult - processing result:", result.title, "type:", result.type);
    
    try {
      if (result.type === 'suggestion') {
        // 处理搜索联想：打开 Google 搜索
        const searchQuery = result.suggestion || result.title;
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        
        console.log("Opening Google search for suggestion:", searchQuery);
        await chrome.tabs.create({
          url: googleSearchUrl,
          active: true
        });
        
        console.log('Opened Google search for suggestion:', searchQuery);
        return { success: true };
      }
      
      if (result.type === 'bookmark') {
        // 打开书签在新标签页
        console.log("Opening bookmark:", result.url);
        await chrome.tabs.create({
          url: result.url,
          active: true
        });
      } else if (result.type === 'tab') {
        // 切换到现有标签页
        const tabId = parseInt(result.id.replace('tab-', ''));
        console.log("Switching to tab:", tabId);
        
        // 先检查标签页是否还存在
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab) {
            await chrome.tabs.update(tabId, { active: true });
            if (tab.windowId) {
              await chrome.windows.update(tab.windowId, { focused: true });
            }
          }
        } catch {
          // 标签页不存在，在新标签页中打开URL
          console.log("Tab not found, opening in new tab:", result.url);
          await chrome.tabs.create({
            url: result.url,
            active: true
          });
        }
      } else if (result.type === 'history') {
        // 打开历史记录在新标签页
        console.log("Opening history item:", result.url);
        await chrome.tabs.create({
          url: result.url,
          active: true
        });
      }

      console.log("Successfully processed open result for:", result.title);
      return { success: true };
    } catch (error) {
      console.error('Failed to process open result:', error);
      throw error;
    }
  }

  private async refreshIndex(): Promise<void> {
    // 防止频繁刷新
    if (this.isInitializing) {
      return;
    }

    try {
      await this.searchEngine.buildIndex();
      console.log('Search index refreshed');
    } catch (error) {
      console.error('Failed to refresh search index:', error);
    }
  }

  public getStats() {
    return this.searchEngine.getStats();
  }

  public destroy(): void {
    // 清理资源，目前没有需要特别清理的资源
    console.log('SearchManager destroyed');
  }
}

// 导出单例实例
export const searchManager = new SearchManager();
