import Fuse from 'fuse.js';
import { SEARCH_CONFIG } from './search-config';

export interface SearchResult {
  id: string;
  type: "bookmark" | "tab" | "history" | "suggestion";
  title: string;
  url: string;
  favicon?: string;
  snippet?: string;
  score?: number;
  lastVisitTime?: number;
  visitCount?: number;
  suggestion?: string; // 用于存储搜索建议
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

interface AnalyticsData {
  visitCount?: number;
  lastVisit?: number;
  averageDuration?: number;
}

export class SearchEngine {
  private fuse: Fuse<IndexDocument> | null = null;
  private documents: IndexDocument[] = [];
  private isInitialized = false;
  
  // 分析缓存相关属性
  private analyticsCache: Record<string, AnalyticsData> = {};

  constructor() {
    // 初始化时创建空的Fuse实例
    this.initializeFuse();
  }

  private initializeFuse(): void {
    // 使用配置文件中的 Fuse.js 选项，处理类型兼容性
    const fuseOptions = {
      ...SEARCH_CONFIG.FUSE_OPTIONS,
      keys: [
        {
          name: 'title' as keyof IndexDocument,
          weight: 0.6
        },
        {
          name: 'searchText' as keyof IndexDocument,
          weight: 0.3
        },
        {
          name: 'url' as keyof IndexDocument,
          weight: 0.1
        }
      ]
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

  async search(query: string, limit = 50): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const cleanQuery = query.trim();
    
    // 应用最小查询长度限制
    if (cleanQuery.length < SEARCH_CONFIG.MIN_QUERY_LENGTH) {
      return [];
    }

    try {
      // 并行执行本地搜索和 Google 搜索建议
      const [localResults, googleSuggestions] = await Promise.all([
        this.searchLocal(cleanQuery, limit),
        this.getGoogleSuggestions(cleanQuery)
      ]);

      // 合并结果
      const allResults = [...localResults];

      // 添加 Google 搜索建议，给予较低的分数
      googleSuggestions.forEach((suggestion: string, index: number) => {
        if (suggestion !== cleanQuery) { // 不包含原始查询
          allResults.push({
            id: `suggestion-${index}`,
            type: "suggestion",
            title: suggestion,
            url: `https://www.google.com/search?q=${encodeURIComponent(suggestion)}`,
            suggestion: suggestion,
            score: 10 + (googleSuggestions.length - index), // 基础分数较低
            snippet: `搜索建议: ${suggestion}`,
            favicon: "https://www.google.com/favicon.ico"
          });
        }
      });

      return allResults
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit);
    } catch (error) {
      console.error('Search failed:', error);
      // 如果出错，至少返回本地搜索结果
      return this.searchLocal(cleanQuery, limit);
    }
  }

  private searchLocal(query: string, limit: number): SearchResult[] {
    if (!this.isInitialized || !this.fuse) {
      console.warn('Search index not initialized');
      return [];
    }

    const cleanQuery = query.toLowerCase();
    
    // 应用最小查询长度限制
    if (cleanQuery.length < SEARCH_CONFIG.MIN_QUERY_LENGTH) {
      return [];
    }

    try {
      
      // 使用Fuse.js进行多种搜索策略
      const searchStrategies = [
        // 1. 精确搜索
        { query: `="${cleanQuery}"`, boost: 100, description: 'exact' },
        // 2. 普通模糊搜索
        { query: cleanQuery, boost: 80, description: 'normal' },
        // 3. 单词分解搜索（只搜索长度大于等于最小长度的单词）
        ...cleanQuery.split(/\s+/).filter(word => word.length >= SEARCH_CONFIG.MIN_QUERY_LENGTH).map(word => ({
          query: word,
          boost: 60,
          description: 'word'
        })),
        // 4. 前缀搜索（只对长度大于等于3的单词进行前缀搜索）
        ...cleanQuery.split(/\s+/).filter(word => word.length >= 3).map(word => ({
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

      // 转换为数组并应用智能排序
      const searchResults = Array.from(allResults.values());
      const uniqueResults = this.deduplicateResults(searchResults);
      
      // 应用增强的排序算法
      return this.applySortingOptimization(uniqueResults, cleanQuery, limit);
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  /**
   * 应用排序优化算法
   */
  private applySortingOptimization(results: SearchResult[], query: string, limit: number): SearchResult[] {
    const queryLower = query.toLowerCase();
    
    // 1. 先进行基础分组和优先级调整
    const optimizedResults = results.map(result => {
      let adjustedScore = result.score || 0;
      const titleLower = result.title.toLowerCase();
      
      // 精确匹配获得最高优先级
      if (titleLower === queryLower) {
        adjustedScore += 1000;
      }
      
      // 标题开头匹配获得高优先级
      else if (titleLower.startsWith(queryLower)) {
        adjustedScore += 500;
      }
      
      // 包含完整查询词的优先级
      else if (titleLower.includes(queryLower)) {
        adjustedScore += 200;
      }
      
      // URL域名匹配加分
      try {
        const domain = new URL(result.url).hostname.toLowerCase();
        if (domain.includes(queryLower)) {
          adjustedScore += 100;
        }
      } catch {
        // 忽略URL解析错误
      }
      
      // 类型优先级调整
      switch (result.type) {
        case 'tab':
          adjustedScore += 150; // 当前标签页最高优先级
          break;
        case 'bookmark':
          adjustedScore += 100; // 书签次高优先级
          break;
        case 'history':
          adjustedScore += 50; // 历史记录中等优先级
          break;
        case 'suggestion':
          adjustedScore -= 50; // 搜索建议较低优先级
          break;
      }
      
      // 用户习惯优化（异步但不阻塞）
      this.applyUserHabitOptimization(result).then(habitBoost => {
        if (habitBoost > 0) {
          // 这里可以触发结果重新排序的事件，但为了简单起见，我们在初始排序中应用
        }
      }).catch(() => {
        // 静默失败，不影响基础搜索
      });
      
      // 尝试同步获取用户习惯加成（使用缓存）
      const habitBoost = this.getQuickUserHabitBoost(result);
      adjustedScore += habitBoost;
      
      // 历史记录特殊处理
      if (result.type === 'history') {
        // 访问频率加分
        if (result.visitCount && result.visitCount > 1) {
          adjustedScore += Math.min(result.visitCount * 5, 100);
        }
        
        // 最近访问时间加分
        if (result.lastVisitTime) {
          const daysSinceVisit = (Date.now() - result.lastVisitTime) / (24 * 60 * 60 * 1000);
          if (daysSinceVisit < 1) {
            adjustedScore += 80; // 今天访问过
          } else if (daysSinceVisit < 7) {
            adjustedScore += 40; // 一周内访问过
          } else if (daysSinceVisit < 30) {
            adjustedScore += 20; // 一个月内访问过
          }
        }
      }
      
      // 标题长度优化（较短的标题通常更相关）
      const titleLength = result.title.length;
      if (titleLength < 30) {
        adjustedScore += 20;
      } else if (titleLength > 80) {
        adjustedScore -= 10;
      }
      
      return {
        ...result,
        score: adjustedScore,
        originalScore: result.score || 0
      };
    });
    
    // 2. 多层级排序
    const sortedResults = optimizedResults.sort((a, b) => {
      // 首先按调整后的分数排序
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (Math.abs(scoreDiff) > 10) {
        return scoreDiff;
      }
      
      // 分数相近时，应用细致的排序规则
      
      // 精确匹配优先
      const aExactMatch = a.title.toLowerCase() === queryLower;
      const bExactMatch = b.title.toLowerCase() === queryLower;
      if (aExactMatch !== bExactMatch) {
        return aExactMatch ? -1 : 1;
      }
      
      // 开头匹配优先
      const aStartsWithQuery = a.title.toLowerCase().startsWith(queryLower);
      const bStartsWithQuery = b.title.toLowerCase().startsWith(queryLower);
      if (aStartsWithQuery !== bStartsWithQuery) {
        return aStartsWithQuery ? -1 : 1;
      }
      
      // 类型优先级
      const typeOrder = { tab: 0, bookmark: 1, history: 2, suggestion: 3 };
      const aTypeOrder = typeOrder[a.type] || 999;
      const bTypeOrder = typeOrder[b.type] || 999;
      if (aTypeOrder !== bTypeOrder) {
        return aTypeOrder - bTypeOrder;
      }
      
      // 对于历史记录，按访问时间和频率排序
      if (a.type === 'history' && b.type === 'history') {
        // 优先按访问频率
        const aVisitCount = a.visitCount || 0;
        const bVisitCount = b.visitCount || 0;
        if (aVisitCount !== bVisitCount) {
          return bVisitCount - aVisitCount;
        }
        
        // 然后按最近访问时间
        const aLastVisit = a.lastVisitTime || 0;
        const bLastVisit = b.lastVisitTime || 0;
        if (aLastVisit !== bLastVisit) {
          return bLastVisit - aLastVisit;
        }
      }
      
      // 最后按标题长度排序（短标题优先）
      return a.title.length - b.title.length;
    });
    
    // 3. 返回限制数量的结果
    return sortedResults.slice(0, limit);
  }

  private async getGoogleSuggestions(query: string): Promise<string[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodedQuery}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.warn('Failed to fetch Google suggestions:', response.statusText);
        return [];
      }

      const data = await response.json() as [string, string[]];
      const suggestions = data[1] || [];
      
      // 过滤和限制建议数量
      return suggestions
        .filter((suggestion: string) => suggestion && suggestion.trim().toLowerCase() !== query.toLowerCase())
        .slice(0, 5); // 最多返回5个建议
    } catch (error) {
      console.warn('Error fetching Google suggestions:', error);
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
        
        // 对历史记录进行域名去重
        const deduplicatedHistory = this.deduplicateHistoryByDomain(
          historyData, 
          SEARCH_CONFIG.HISTORY.MAX_PER_DOMAIN
        );
        
        resolve(deduplicatedHistory);
      });
    });
  }

  /**
   * 根据域名对历史记录进行去重，每个域名最多保留指定数量的记录
   */
  private deduplicateHistoryByDomain(historyData: HistoryData[], maxPerDomain = SEARCH_CONFIG.HISTORY.MAX_PER_DOMAIN): HistoryData[] {
    const domainCounts = new Map<string, number>();
    const result: HistoryData[] = [];
    
    for (const item of historyData) {
      const domain = this.extractMainDomain(item.url);
      const currentCount = domainCounts.get(domain) || 0;
      
      if (currentCount < maxPerDomain) {
        result.push(item);
        domainCounts.set(domain, currentCount + 1);
      }
    }
    
    return result;
  }

  /**
   * 提取主域名（去除子域名）
   */
  private extractMainDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // 移除常见的子域名前缀
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        // 对于常见的顶级域名组合，保留主域名 + 顶级域名
        const tld = parts[parts.length - 1];
        const domain = parts[parts.length - 2];
        
        // 处理二级域名的情况（如 .co.uk, .com.cn 等）
        const commonSecondLevelDomains = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'];
        if (parts.length >= 3 && commonSecondLevelDomains.includes(domain)) {
          return `${parts[parts.length - 3]}.${domain}.${tld}`;
        }
        
        return `${domain}.${tld}`;
      }
      
      return hostname;
    } catch {
      // 如果URL解析失败，返回原始URL作为域名
      return url;
    }
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
    // 如果禁用了域名去重，使用简单去重
    if (!SEARCH_CONFIG.DOMAIN_DEDUPLICATION.ENABLED) {
      const seen = new Set<string>();
      return results.filter(result => {
        if (seen.has(result.id)) {
          return false;
        }
        seen.add(result.id);
        return true;
      });
    }

    // 先按类型分组
    const byType = new Map<string, SearchResult[]>();
    results.forEach(result => {
      const type = result.type;
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push(result);
    });

    const deduplicatedResults: SearchResult[] = [];

    // 对每种类型分别处理
    byType.forEach((typeResults, type) => {
      if (type === 'history') {
        // 历史记录按域名去重
        deduplicatedResults.push(...this.deduplicateResultsByDomain(
          typeResults, 
          SEARCH_CONFIG.DOMAIN_DEDUPLICATION.HISTORY_MAX_PER_DOMAIN
        ));
      } else if (type === 'bookmark') {
        // 书签按域名去重，但允许更多
        deduplicatedResults.push(...this.deduplicateResultsByDomain(
          typeResults, 
          SEARCH_CONFIG.DOMAIN_DEDUPLICATION.BOOKMARK_MAX_PER_DOMAIN
        ));
      } else {
        // 其他类型（标签页、建议）使用普通去重
        const seen = new Set<string>();
        typeResults.forEach(result => {
          if (!seen.has(result.id)) {
            seen.add(result.id);
            deduplicatedResults.push(result);
          }
        });
      }
    });

    return deduplicatedResults;
  }

  /**
   * 根据域名对搜索结果进行去重
   */
  private deduplicateResultsByDomain(results: SearchResult[], maxPerDomain = 2): SearchResult[] {
    const domainCounts = new Map<string, number>();
    const seen = new Set<string>();
    const deduplicatedResults: SearchResult[] = [];
    
    // 按分数排序，确保高分结果优先
    const sortedResults = results.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    for (const result of sortedResults) {
      // 跳过重复的ID
      if (seen.has(result.id)) {
        continue;
      }
      
      const domain = this.extractMainDomain(result.url);
      const currentCount = domainCounts.get(domain) || 0;
      
      if (currentCount < maxPerDomain) {
        deduplicatedResults.push(result);
        domainCounts.set(domain, currentCount + 1);
        seen.add(result.id);
      }
    }
    
    return deduplicatedResults;
  }

  public getStats() {
    return {
      isInitialized: this.isInitialized,
      indexSize: this.isInitialized ? `${this.documents.length} documents` : 'Not available'
    };
  }

  /**
   * 快速获取用户习惯加成（基于缓存）
   */
  private getQuickUserHabitBoost(result: SearchResult): number {
    try {
      const domain = this.extractMainDomain(result.url);
      const analytics = this.analyticsCache[domain];
      
      if (!analytics) {
        return 0;
      }
      
      let boost = 0;
      
      // 基于访问频率的快速加成
      if (analytics.visitCount && analytics.visitCount > 0) {
        boost += Math.min(Math.log(analytics.visitCount + 1) * 2, 20);
      }
      
      // 基于最近访问的快速加成
      if (analytics.lastVisit) {
        const daysSinceVisit = (Date.now() - analytics.lastVisit) / (24 * 60 * 60 * 1000);
        if (daysSinceVisit < 1) {
          boost += 30; // 今天访问过
        } else if (daysSinceVisit < 7) {
          boost += 15; // 一周内访问过
        } else if (daysSinceVisit < 30) {
          boost += 5; // 一个月内访问过
        }
      }
      
      return Math.floor(boost);
    } catch {
      return 0;
    }
  }

  /**
   * 异步应用用户习惯优化（简化版本）
   */
  private async applyUserHabitOptimization(result: SearchResult): Promise<number> {
    try {
      // 目前返回基础值，可以后续扩展
      return this.getQuickUserHabitBoost(result);
    } catch {
      return 0;
    }
  }

}
