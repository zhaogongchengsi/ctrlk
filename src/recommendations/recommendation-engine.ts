import { tabAnalytics, type WebsiteStats } from '@/storage/analytics';
import { firstValueFrom } from 'rxjs';

export interface RecommendationItem {
  id: string;
  type: 'tab' | 'history' | 'bookmark';
  title: string;
  url: string;
  favicon?: string;
  snippet?: string;
  score: number;
  reason: string;
}

export interface RecommendationConfig {
  maxRecommendations: number;
  includeCurrentTabs: boolean;
  includeHistory: boolean;
  includeBookmarks: boolean;
  minVisitCount: number;
  recentDaysThreshold: number;
}

const DEFAULT_CONFIG: RecommendationConfig = {
  maxRecommendations: 6,
  includeCurrentTabs: true,
  includeHistory: true,
  includeBookmarks: true,
  minVisitCount: 3,
  recentDaysThreshold: 30
};

export class RecommendationEngine {
  private config: RecommendationConfig;

  constructor(config: Partial<RecommendationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 生成推荐数据
   */
  async generateRecommendations(): Promise<RecommendationItem[]> {
    const recommendations: RecommendationItem[] = [];

    try {
      // 获取analytics数据
      const websiteStats = await firstValueFrom(tabAnalytics.getWebsiteStats());

      // 获取当前标签页
      if (this.config.includeCurrentTabs) {
        const tabRecommendations = await this.generateTabRecommendations();
        recommendations.push(...tabRecommendations);
      }

      // 基于analytics生成历史推荐
      if (this.config.includeHistory) {
        const historyRecommendations = await this.generateHistoryRecommendations(websiteStats);
        recommendations.push(...historyRecommendations);
      }

      // 生成书签推荐
      if (this.config.includeBookmarks) {
        const bookmarkRecommendations = await this.generateBookmarkRecommendations();
        recommendations.push(...bookmarkRecommendations);
      }

      // 按分数排序并限制数量
      return this.sortAndLimitRecommendations(recommendations);
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      return [];
    }
  }

  /**
   * 生成标签页推荐
   */
  private async generateTabRecommendations(): Promise<RecommendationItem[]> {
    try {
      const tabs = await chrome.tabs.query({ 
        currentWindow: true, 
        url: ["http://*/*", "https://*/*"] 
      });

      const currentTab = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentUrl = currentTab[0]?.url;

      return tabs
        .filter(tab => tab.url && tab.url !== currentUrl && tab.title)
        .slice(0, 2) // 最多2个标签页推荐
        .map(tab => ({
          id: `tab-rec-${tab.id}`,
          type: 'tab' as const,
          title: tab.title!,
          url: tab.url!,
          favicon: tab.favIconUrl,
          score: 100,
          reason: '当前打开的标签页'
        }));
    } catch (error) {
      console.error('Failed to get tab recommendations:', error);
      return [];
    }
  }

  /**
   * 基于analytics生成历史推荐
   */
  private async generateHistoryRecommendations(websiteStats: Record<string, WebsiteStats>): Promise<RecommendationItem[]> {
    const recommendations: RecommendationItem[] = [];
    const now = Date.now();
    const recentThreshold = now - (this.config.recentDaysThreshold * 24 * 60 * 60 * 1000);

    // 从analytics数据中筛选符合条件的网站
    const eligibleSites = Object.values(websiteStats)
      .filter(stats => 
        stats.visitCount >= this.config.minVisitCount &&
        stats.lastVisit >= recentThreshold
      )
      .sort((a, b) => this.calculateHistoryScore(b) - this.calculateHistoryScore(a))
      .slice(0, 3);

    for (const stats of eligibleSites) {
      // 尝试从浏览器历史记录中获取更详细的信息
      try {
        const historyItems = await chrome.history.search({
          text: stats.domain,
          maxResults: 1
        });

        if (historyItems.length > 0) {
          const item = historyItems[0];
          recommendations.push({
            id: `history-rec-${stats.domain}`,
            type: 'history',
            title: item.title || stats.title,
            url: item.url || `https://${stats.domain}`,
            score: this.calculateHistoryScore(stats),
            reason: this.generateHistoryReason(stats)
          });
        } else {
          // 如果历史记录中没有找到，使用analytics数据
          recommendations.push({
            id: `analytics-rec-${stats.domain}`,
            type: 'history',
            title: stats.title,
            url: `https://${stats.domain}`,
            favicon: stats.favicon,
            score: this.calculateHistoryScore(stats),
            reason: this.generateHistoryReason(stats)
          });
        }
      } catch (error) {
        console.error(`Failed to get history for ${stats.domain}:`, error);
      }
    }

    return recommendations;
  }

  /**
   * 生成书签推荐
   */
  private async generateBookmarkRecommendations(): Promise<RecommendationItem[]> {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const bookmarks = this.extractBookmarks(bookmarkTree);

      // 按添加时间排序，获取最近的书签
      const recentBookmarks = bookmarks
        .filter(bookmark => bookmark.url && bookmark.title)
        .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
        .slice(0, 2);

      return recentBookmarks.map(bookmark => ({
        id: `bookmark-rec-${bookmark.id}`,
        type: 'bookmark' as const,
        title: bookmark.title,
        url: bookmark.url!,
        score: 80,
        reason: '最近添加的书签'
      }));
    } catch (error) {
      console.error('Failed to get bookmark recommendations:', error);
      return [];
    }
  }

  /**
   * 计算历史记录推荐分数
   */
  private calculateHistoryScore(stats: WebsiteStats): number {
    const now = Date.now();
    const daysSinceLastVisit = (now - stats.lastVisit) / (24 * 60 * 60 * 1000);
    
    // 基础分数：访问频率评分
    let score = stats.frequencyScore;
    
    // 访问次数加分
    score += Math.min(stats.visitCount * 2, 50);
    
    // 平均停留时长加分
    const avgDurationMinutes = stats.averageDuration / (60 * 1000);
    score += Math.min(avgDurationMinutes, 30);
    
    // 最近访问时间加分
    if (daysSinceLastVisit < 1) {
      score += 40; // 今天访问过
    } else if (daysSinceLastVisit < 7) {
      score += 20; // 一周内访问过
    } else if (daysSinceLastVisit < 30) {
      score += 10; // 一个月内访问过
    }
    
    // 最近访问频率加分
    score += Math.min(stats.recentVisits * 3, 30);
    
    return Math.round(score);
  }

  /**
   * 生成历史记录推荐原因
   */
  private generateHistoryReason(stats: WebsiteStats): string {
    const now = Date.now();
    const daysSinceLastVisit = (now - stats.lastVisit) / (24 * 60 * 60 * 1000);
    
    if (daysSinceLastVisit < 1) {
      return `今天访问过 • ${stats.visitCount} 次访问`;
    } else if (daysSinceLastVisit < 7) {
      return `最近访问过 • ${stats.visitCount} 次访问`;
    } else if (stats.visitCount > 10) {
      return `经常访问 • ${stats.visitCount} 次访问`;
    } else {
      return `访问过 ${stats.visitCount} 次`;
    }
  }

  /**
   * 提取所有书签
   */
  private extractBookmarks(bookmarkTree: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] {
    const bookmarks: chrome.bookmarks.BookmarkTreeNode[] = [];
    
    const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
      for (const node of nodes) {
        if (node.url) {
          bookmarks.push(node);
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    };
    
    traverse(bookmarkTree);
    return bookmarks;
  }

  /**
   * 排序并限制推荐数量
   */
  private sortAndLimitRecommendations(recommendations: RecommendationItem[]): RecommendationItem[] {
    // 按分数排序
    const sorted = recommendations.sort((a, b) => b.score - a.score);
    
    // 去重（基于URL）
    const urlSet = new Set<string>();
    const deduped = sorted.filter(item => {
      if (urlSet.has(item.url)) {
        return false;
      }
      urlSet.add(item.url);
      return true;
    });
    
    // 限制数量
    return deduped.slice(0, this.config.maxRecommendations);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RecommendationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): RecommendationConfig {
    return { ...this.config };
  }
}

// 导出默认实例
export const recommendationEngine = new RecommendationEngine();
