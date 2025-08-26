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
  id: number;
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
      document: {
        id: "id",
        index: ["title", "url"],
        store: ["title", "url", "type", "favicon"]
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
        document: {
          id: "id",
          index: ["title", "url"],
          store: ["title", "url", "type", "favicon"]
        }
      });

      // 添加书签到索引
      for (const bookmark of bookmarks) {
        const doc = {
          id: `bookmark-${bookmark.id}`,
          title: bookmark.title,
          url: bookmark.url,
          type: "bookmark"
        };
        this.index.add(doc);
      }

      // 添加标签页到索引
      for (const tab of tabs) {
        const doc = {
          id: `tab-${tab.id}`,
          title: tab.title || 'Untitled',
          url: tab.url || '',
          type: "tab",
          favicon: tab.favIconUrl || ''
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

  search(query: string): SearchResult[] {
    if (!this.isInitialized) {
      console.warn('Search index not initialized');
      return [];
    }

    if (!query.trim()) {
      return [];
    }

    try {
      const results = this.index.search(query.trim(), {
        enrich: true
      });

      const searchResults: SearchResult[] = [];

      // 处理搜索结果
      if (Array.isArray(results)) {
        for (const fieldResult of results) {
          if (fieldResult && Array.isArray(fieldResult.result)) {
            for (const item of fieldResult.result) {
              if (item && item.doc) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const doc = item.doc as any;
                
                const result: SearchResult = {
                  id: doc.id,
                  type: doc.type as "bookmark" | "tab",
                  title: doc.title,
                  url: doc.url,
                  favicon: doc.favicon,
                  score: this.calculateScore(query, doc)
                };

                searchResults.push(result);
              }
            }
          }
        }
      }

      // 去重并按分数排序
      const uniqueResults = this.deduplicateResults(searchResults);
      return uniqueResults.sort((a, b) => (b.score || 0) - (a.score || 0));
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
            id: tab.id!,
            title: tab.title || 'Untitled',
            url: tab.url!,
            favIconUrl: tab.favIconUrl
          }));
        
        resolve(tabData);
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private calculateScore(query: string, doc: any): number {
    const queryLower = query.toLowerCase();
    const titleLower = doc.title.toLowerCase();
    const urlLower = doc.url.toLowerCase();

    let score = 0;

    // 精确匹配加分
    if (titleLower.includes(queryLower)) {
      score += titleLower === queryLower ? 100 : 50;
    }
    if (urlLower.includes(queryLower)) {
      score += 20;
    }

    // 开头匹配加分
    if (titleLower.startsWith(queryLower)) {
      score += 30;
    }

    // 类型加权
    if (doc.type === "tab") {
      score += 10; // 优先显示当前标签页
    }

    return score;
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
