import { Document } from 'flexsearch';

export interface SearchResult {
  id: string;
  type: "bookmark" | "tab";
  title: string;
  url: string;
  favicon?: string;
  snippet?: string;
  score?: number;
}

interface BookmarkData {
  id: string;
  title: string;
  url: string;
}

interface TabData {
  id: string;
  title: string;
  url: string;
  favIconUrl?: string;
}

export class SearchEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private index: Document<any>;
  private isInitialized = false;

  constructor() {
    this.index = new Document({
      tokenize: "forward",
      resolution: 9,
      context: {
        resolution: 5,
        depth: 3,
        bidirectional: true
      },
      document: {
        id: "id",
        index: [
          {
            field: "title",
            tokenize: "forward",
            resolution: 9
          },
          {
            field: "url", 
            tokenize: "strict",
            resolution: 5
          },
          {
            field: "searchText", // 组合搜索字段
            tokenize: "forward", 
            resolution: 7
          }
        ],
        store: ["title", "url", "type", "favicon", "searchText"]
      }
    });
  }

  async buildIndex(): Promise<void> {
    console.log('Building search index...');
    
    try {
      // 并行获取书签和标签页数据
      const [bookmarks, tabs] = await Promise.all([
        this.getBookmarks(),
        this.getTabs()
      ]);

      // 重新初始化索引
      this.index = new Document({
        tokenize: "forward",
        resolution: 9,
        context: {
          resolution: 5,
          depth: 3,
          bidirectional: true
        },
        document: {
          id: "id",
          index: [
            {
              field: "title",
              tokenize: "forward",
              resolution: 9
            },
            {
              field: "url", 
              tokenize: "strict",
              resolution: 5
            },
            {
              field: "searchText", // 组合搜索字段
              tokenize: "forward", 
              resolution: 7
            }
          ],
          store: ["title", "url", "type", "favicon", "searchText"]
        }
      });

      // 添加书签到索引
      for (const bookmark of bookmarks) {
        const searchText = this.createSearchText(bookmark.title, bookmark.url);
        const doc = {
          id: `bookmark-${bookmark.id}`,
          title: bookmark.title,
          url: bookmark.url,
          type: "bookmark",
          searchText
        };
        this.index.add(doc);
      }

      // 添加标签页到索引
      for (const tab of tabs) {
        const title = tab.title || 'Untitled';
        const url = tab.url || '';
        const searchText = this.createSearchText(title, url);
        const doc = {
          id: `tab-${tab.id}`,
          title,
          url,
          type: "tab",
          favicon: tab.favIconUrl || '',
          searchText
        };
        this.index.add(doc);
      }

      this.isInitialized = true;
      console.log(`Index built with ${bookmarks.length} bookmarks and ${tabs.length} tabs`);
    } catch (error) {
      console.error('Failed to build search index:', error);
      throw error;
    }
  }

  search(query: string, limit = 50): SearchResult[] {
    if (!this.isInitialized) {
      console.warn('Search index not initialized');
      return [];
    }

    if (!query.trim()) {
      return [];
    }

    try {
      const cleanQuery = query.trim().toLowerCase();
      
      // 多种搜索策略
      const searchStrategies = [
        // 1. 精确短语搜索
        { query: `"${cleanQuery}"`, boost: 100 },
        // 2. 普通搜索
        { query: cleanQuery, boost: 50 },
        // 3. 模糊搜索（通过部分匹配）
        { query: cleanQuery.split(' ').join(' '), boost: 30 },
        // 4. 单词搜索
        ...cleanQuery.split(' ').filter(word => word.length > 1).map(word => ({
          query: word,
          boost: 20
        }))
      ];

      const allResults = new Map<string, SearchResult>();

      for (const strategy of searchStrategies) {
        try {
          const results = this.index.search(strategy.query, {
            limit: limit * 2,
            enrich: true
          });

          if (Array.isArray(results)) {
            for (const fieldResult of results) {
              if (fieldResult && Array.isArray(fieldResult.result)) {
                for (const item of fieldResult.result) {
                  if (item && item.doc) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const doc = item.doc as any;
                    
                    const existingResult = allResults.get(doc.id);
                    const baseScore = this.calculateScore(cleanQuery, doc, strategy.boost);
                    
                    if (!existingResult || baseScore > (existingResult.score || 0)) {
                      const result: SearchResult = {
                        id: doc.id,
                        type: doc.type as "bookmark" | "tab",
                        title: doc.title,
                        url: doc.url,
                        favicon: doc.favicon,
                        score: baseScore,
                        snippet: this.generateSnippet(cleanQuery, doc)
                      };
                      
                      allResults.set(doc.id, result);
                    }
                  }
                }
              }
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
                id: `bookmark:${node.id}`,
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
			id: `tab:${tab.id!}`,
            title: tab.title || 'Untitled',
            url: tab.url!,
            favIconUrl: tab.favIconUrl
          }));
        
        resolve(tabData);
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private calculateScore(query: string, doc: any, boost = 1): number {
    const queryLower = query.toLowerCase();
    const titleLower = doc.title.toLowerCase();
    const urlLower = doc.url.toLowerCase();
    const searchTextLower = (doc.searchText || '').toLowerCase();

    let score = 0;

    // 精确匹配加分
    if (titleLower === queryLower) {
      score += 200;
    } else if (titleLower.includes(queryLower)) {
      score += 100;
    }

    if (urlLower.includes(queryLower)) {
      score += 50;
    }

    if (searchTextLower.includes(queryLower)) {
      score += 30;
    }

    // 开头匹配加分
    if (titleLower.startsWith(queryLower)) {
      score += 80;
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
        } else if (this.calculateLevenshteinDistance(queryWord, titleWord) <= 2) {
          score += 15; // 模糊匹配
        }
      }
    }

    // 类型加权
    if (doc.type === "tab") {
      score += 10; // 优先显示当前标签页
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private generateSnippet(query: string, doc: any, maxLength = 100): string {
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

  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str1.length;
    
    // 创建矩阵
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    // 填充矩阵
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // 替换
            matrix[i][j - 1] + 1,     // 插入
            matrix[i - 1][j] + 1      // 删除
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
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
      indexSize: this.isInitialized ? 'Available' : 'Not available'
    };
  }
}
