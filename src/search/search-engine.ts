import Fuse from 'fuse.js';

export interface SearchResult {
  id: string;
  type: "bookmark" | "tab" | "history";
  title: string;
  url: string;
  favicon?: string;
  snippet?: string;
  score?: number;
  lastVisitTime?: number;
  visitCount?: number;
  highlights?: {
    title?: HighlightMatch[];
    url?: HighlightMatch[];
    searchText?: HighlightMatch[];
  };
}

export interface HighlightMatch {
  indices: [number, number];
  value: string;
}

interface BookmarkData {
  id: string;
  title: string;
  url: string;
}

interface HistoryData {
  id: string;
  title: string;
  url: string;
  lastVisitTime: number;
  visitCount: number;
}

interface TabData {
  id: string;
  title: string;
  url: string;
  favIconUrl?: string;
}

interface IndexDocument {
  id: string;
  title: string;
  url: string;
  type: "bookmark" | "tab" | "history";
  favicon?: string;
  searchText: string;
  lastVisitTime?: number;
  visitCount?: number;
}

export class SearchEngine {
  private fuse: Fuse<IndexDocument> | null = null;
  private documents: IndexDocument[] = [];
  private isInitialized = false;

  constructor() {
    // 初始化时创建空的Fuse实例
    this.initializeFuse();
  }

  private initializeFuse(): void {
    // Fuse.js 配置，优化模糊搜索
    const fuseOptions = {
      keys: [
        {
          name: 'title',
          weight: 0.6 // 标题最重要
        },
        {
          name: 'searchText',
          weight: 0.3 // 组合搜索文本
        },
        {
          name: 'url',
          weight: 0.1 // URL权重最低
        }
      ],
      threshold: 0.6, // 模糊匹配阈值 (0-1，越小越严格)
      distance: 100, // 搜索距离
      minMatchCharLength: 1, // 最小匹配字符长度
      includeScore: true, // 包含匹配分数
      includeMatches: true, // 包含匹配信息
      findAllMatches: true, // 查找所有匹配
      ignoreLocation: true, // 忽略位置
      shouldSort: true, // 按分数排序
      useExtendedSearch: true // 启用扩展搜索语法
    };

    this.fuse = new Fuse(this.documents, fuseOptions);
  }

  async buildIndex(): Promise<void> {
    console.log('Building search index...');
    
    try {
      // 并行获取书签、标签页和历史记录数据
      const [bookmarks, tabs, history] = await Promise.all([
        this.getBookmarks(),
        this.getTabs(),
        this.getHistory()
      ]);

      // 清空现有文档
      this.documents = [];

      // 添加书签到文档
      for (const bookmark of bookmarks) {
        const searchText = this.createSearchText(bookmark.title, bookmark.url);
        const doc: IndexDocument = {
          id: `bookmark-${bookmark.id}`,
          title: bookmark.title,
          url: bookmark.url,
          type: "bookmark",
          searchText
        };
        this.documents.push(doc);
      }

      // 添加标签页到文档
      for (const tab of tabs) {
        const title = tab.title || 'Untitled';
        const url = tab.url || '';
        const searchText = this.createSearchText(title, url);
        const doc: IndexDocument = {
          id: `tab-${tab.id}`,
          title,
          url,
          type: "tab",
          favicon: tab.favIconUrl || '',
          searchText
        };
        this.documents.push(doc);
      }

      // 添加历史记录到文档
      for (const historyItem of history) {
        const title = historyItem.title || 'Untitled';
        const url = historyItem.url || '';
        const searchText = this.createSearchText(title, url);
        const doc: IndexDocument = {
          id: `history-${historyItem.id}`,
          title,
          url,
          type: "history",
          searchText,
          lastVisitTime: historyItem.lastVisitTime,
          visitCount: historyItem.visitCount
        };
        this.documents.push(doc);
      }

      // 重新初始化Fuse索引
      this.initializeFuse();

      this.isInitialized = true;
      console.log(`Index built with ${bookmarks.length} bookmarks, ${tabs.length} tabs, and ${history.length} history items`);
    } catch (error) {
      console.error('Failed to build search index:', error);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractHighlights(fuseResult: any): SearchResult['highlights'] {
    if (!fuseResult.matches) {
      return undefined;
    }

    const highlights: SearchResult['highlights'] = {};

    for (const match of fuseResult.matches) {
      const key = match.key as 'title' | 'url' | 'searchText';
      if (match.indices && match.indices.length > 0) {
        highlights[key] = match.indices.map((indice: [number, number]) => ({
          indices: indice,
          value: match.value?.substring(indice[0], indice[1] + 1) || ''
        }));
      }
    }

    return Object.keys(highlights).length > 0 ? highlights : undefined;
  }

  search(query: string, limit = 50): SearchResult[] {
    if (!this.isInitialized || !this.fuse) {
      console.warn('Search index not initialized');
      return [];
    }

    if (!query.trim()) {
      return [];
    }

    try {
      const cleanQuery = query.trim().toLowerCase();
      
      // 使用Fuse.js进行多种搜索策略
      const searchStrategies = [
        // 1. 精确搜索
        { query: `="${cleanQuery}"`, boost: 100, description: 'exact' },
        // 2. 普通模糊搜索
        { query: cleanQuery, boost: 80, description: 'normal' },
        // 3. 单词分解搜索
        ...cleanQuery.split(/\s+/).filter(word => word.length > 1).map(word => ({
          query: word,
          boost: 60,
          description: 'word'
        })),
        // 4. 前缀搜索（Fuse.js扩展语法）
        ...cleanQuery.split(/\s+/).filter(word => word.length > 2).map(word => ({
          query: `^${word}`,
          boost: 70,
          description: 'prefix'
        }))
      ];

      const allResults = new Map<string, SearchResult>();

      for (const strategy of searchStrategies) {
        try {
          const fuseResults = this.fuse.search(strategy.query, { limit: limit * 2 });

          for (const fuseResult of fuseResults) {
            const doc = fuseResult.item;
            const fuseScore = fuseResult.score || 0;
            
            const existingResult = allResults.get(doc.id);
            
            // 计算综合分数（结合Fuse分数和自定义分数）
            const customScore = this.calculateScore(cleanQuery, doc, strategy.boost);
            const fuseWeight = (1 - fuseScore) * 100; // Fuse分数越低越好，转换为越高越好
            const finalScore = customScore + fuseWeight;
            
            if (!existingResult || finalScore > (existingResult.score || 0)) {
              const highlights = this.extractHighlights(fuseResult);
              const result: SearchResult = {
                id: doc.id,
                type: doc.type,
                title: doc.title,
                url: doc.url,
                favicon: doc.favicon,
                score: finalScore,
                snippet: this.generateSnippet(cleanQuery, doc),
                highlights,
                ...(doc.type === "history" && {
                  lastVisitTime: doc.lastVisitTime,
                  visitCount: doc.visitCount
                })
              };
              
              allResults.set(doc.id, result);
            }
          }
        } catch (strategyError) {
          console.warn('Search strategy failed:', strategy.query, strategyError);
        }
      }

      // 转换为数组并排序
      const searchResults = Array.from(allResults.values());
      const uniqueResults = this.deduplicateResults(searchResults);
      
      return uniqueResults
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit);
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  private async getBookmarks(): Promise<BookmarkData[]> {
    return new Promise((resolve) => {
      chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        const bookmarks: BookmarkData[] = [];
        
        const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
          for (const node of nodes) {
            if (node.url) {
              bookmarks.push({
				id: node.id,
                title: node.title || 'Untitled',
                url: node.url
              });
            }
            if (node.children) {
              traverse(node.children);
            }
          }
        };

        traverse(bookmarkTreeNodes);
        resolve(bookmarks);
      });
    });
  }

  private async getTabs(): Promise<TabData[]> {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        const tabData: TabData[] = tabs
          .filter(tab => tab.id !== undefined && tab.url)
          .map(tab => ({
			id: `${tab.id!}`,
            title: tab.title || 'Untitled',
            url: tab.url!,
            favIconUrl: tab.favIconUrl
          }));
        
        resolve(tabData);
      });
    });
  }

  private async getHistory(): Promise<HistoryData[]> {
    return new Promise((resolve) => {
      // 获取最近 1000 条历史记录，最多30天内的
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      chrome.history.search({
        text: '',
        startTime: thirtyDaysAgo,
        maxResults: 1000
      }, (historyItems) => {
        const historyData: HistoryData[] = historyItems
          .filter(item => item.url && item.title)
          .map((item, index) => ({
            id: `${index}-${item.id || Date.now()}`,
            title: item.title || 'Untitled',
            url: item.url!,
            lastVisitTime: item.lastVisitTime || 0,
            visitCount: item.visitCount || 0
          }))
          // 按访问时间排序，最新的在前
          .sort((a, b) => b.lastVisitTime - a.lastVisitTime);
        
        resolve(historyData);
      });
    });
  }

    private calculateScore(query: string, doc: IndexDocument, boost = 1): number {
    const queryLower = query.toLowerCase();
    const titleLower = doc.title.toLowerCase();
    const urlLower = doc.url.toLowerCase();
    const searchTextLower = (doc.searchText || '').toLowerCase();

    let score = 0;

    // 标题精确匹配（最高优先级）
    if (titleLower === queryLower) {
      score += 500;
    } else if (titleLower.includes(queryLower)) {
      score += 200;
    }

    // 标题开头匹配（高优先级）
    if (titleLower.startsWith(queryLower)) {
      score += 150;
    }

    // 单词匹配加分
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
    const titleWords = titleLower.split(/\s+/);
    
    for (const queryWord of queryWords) {
      for (const titleWord of titleWords) {
        if (titleWord === queryWord) {
          score += 40;
        } else if (titleWord.includes(queryWord)) {
          score += 20;
        }
      }
    }

    // URL匹配（较低优先级）
    if (urlLower.includes(queryLower)) {
      score += 30;
    }

    if (searchTextLower.includes(queryLower)) {
      score += 20;
    }

    // 类型加权
    if (doc.type === "tab") {
      score += 15; // 优先显示当前标签页
    } else if (doc.type === "history") {
      // 历史记录根据访问频率和时间加权
      if (doc.visitCount && doc.visitCount > 1) {
        score += Math.min(doc.visitCount * 2, 20); // 访问次数加分，最多20分
      }
      
      if (doc.lastVisitTime) {
        const daysSinceVisit = (Date.now() - doc.lastVisitTime) / (24 * 60 * 60 * 1000);
        if (daysSinceVisit < 1) {
          score += 10; // 今天访问过
        } else if (daysSinceVisit < 7) {
          score += 5; // 一周内访问过
        }
      }
      
      score += 5; // 历史记录基础分
    } else if (doc.type === "bookmark") {
      score += 10; // 书签中等优先级
    }

    // URL域名匹配
    try {
      const domain = new URL(doc.url).hostname.toLowerCase();
      if (domain.includes(queryLower)) {
        score += 25;
      }
    } catch {
      // 忽略URL解析错误
    }

    return Math.floor(score * boost);
  }

  private createSearchText(title: string, url: string): string {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const path = urlObj.pathname.replace(/[/\-_]/g, ' ');
      
      return `${title} ${domain} ${path}`.toLowerCase().trim();
    } catch {
      return `${title} ${url}`.toLowerCase().trim();
    }
  }

  private generateSnippet(query: string, doc: IndexDocument, maxLength = 100): string {
    const text = `${doc.title} ${doc.url}`.toLowerCase();
    const queryLower = query.toLowerCase();
    
    const index = text.indexOf(queryLower);
    if (index === -1) {
      return doc.title.substring(0, maxLength);
    }
    
    const start = Math.max(0, index - 20);
    const end = Math.min(text.length, index + queryLower.length + 20);
    
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    return snippet.substring(0, maxLength);
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.id)) {
        return false;
      }
      seen.add(result.id);
      return true;
    });
  }

  public getStats() {
    return {
      isInitialized: this.isInitialized,
      indexSize: this.isInitialized ? `${this.documents.length} documents` : 'Not available'
    };
  }
}
