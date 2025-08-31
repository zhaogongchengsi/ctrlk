import { RxStorage } from '../rx-storage';
import { storageManager } from '../storage-manager';
import { Subject, Observable, timer } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

/**
 * 网页访问记录
 */
export interface WebsiteVisit {
  /** 网站域名 */
  domain: string;
  /** 完整URL */
  url: string;
  /** 页面标题 */
  title: string;
  /** 网站图标 */
  favicon?: string;
  /** 访问时间戳 */
  timestamp: number;
  /** 停留时长（毫秒） */
  duration: number;
  /** 访问来源类型 */
  source: 'direct' | 'bookmark' | 'history' | 'link' | 'search';
}

/**
 * 网站统计信息
 */
export interface WebsiteStats {
  /** 网站域名 */
  domain: string;
  /** 网站标题（最后访问的标题） */
  title: string;
  /** 网站图标 */
  favicon?: string;
  /** 总访问次数 */
  visitCount: number;
  /** 总停留时长（毫秒） */
  totalDuration: number;
  /** 平均停留时长（毫秒） */
  averageDuration: number;
  /** 首次访问时间 */
  firstVisit: number;
  /** 最后访问时间 */
  lastVisit: number;
  /** 访问频率评分 */
  frequencyScore: number;
  /** 最近7天访问次数 */
  recentVisits: number;
}

/**
 * 当前活动标签页信息
 */
export interface ActiveTab {
  tabId: number;
  url: string;
  title: string;
  domain: string;
  favicon?: string;
  startTime: number;
  lastActiveTime: number;
}

/**
 * 标签页分析器 - 跟踪网页访问和停留时长
 */
export class TabAnalytics {
  private visitsStorage: RxStorage<WebsiteVisit[]>;
  private statsStorage: RxStorage<Record<string, WebsiteStats>>;
  private activeTabsMap = new Map<number, ActiveTab>();
  private updateSubject = new Subject<WebsiteStats>();
  private destroyed = false;

  // 配置项
  private readonly MAX_VISITS_STORED = 10000; // 最多存储访问记录数
  private readonly MIN_DURATION_TO_RECORD = 3000; // 最小记录停留时长（3秒）
  private readonly STATS_UPDATE_INTERVAL = 30000; // 统计信息更新间隔（30秒）
  private readonly ACTIVITY_CHECK_INTERVAL = 5000; // 活动检查间隔（5秒）

  constructor() {
    this.visitsStorage = storageManager.getStorage<WebsiteVisit[]>('website_visits', []);
    this.statsStorage = storageManager.getStorage<Record<string, WebsiteStats>>('website_stats', {});

    this.setupEventListeners();
    this.startActivityTracking();

    console.log('[TabAnalytics] Initialized');
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!chrome.tabs) {
      console.warn('[TabAnalytics] Chrome tabs API not available');
      return;
    }

    // 监听标签页激活
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo.tabId);
    });

    // 监听标签页更新
    chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handleTabUpdated(tab);
      }
    });

    // 监听标签页移除
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });

    // 监听窗口焦点变化
    chrome.windows.onFocusChanged.addListener((windowId) => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // 窗口失去焦点，暂停所有标签页计时
        this.pauseAllTabs();
      } else {
        // 窗口获得焦点，恢复活动标签页计时
        this.resumeActiveTab(windowId);
      }
    });
  }

  /**
   * 开始活动跟踪
   */
  private startActivityTracking(): void {
    // 定期更新统计信息
    timer(0, this.STATS_UPDATE_INTERVAL).pipe(
      takeUntil(this.getDestroySignal())
    ).subscribe(() => {
      this.updateActiveTabsDuration();
    });

    // 定期检查标签页活动状态
    timer(0, this.ACTIVITY_CHECK_INTERVAL).pipe(
      takeUntil(this.getDestroySignal())
    ).subscribe(() => {
      this.checkTabActivity();
    });
  }

  /**
   * 处理标签页激活
   */
  private async handleTabActivated(tabId: number): Promise<void> {
    try {
      // 暂停之前活动的标签页
      this.pauseAllTabs();

      // 获取新激活的标签页信息
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && this.isValidUrl(tab.url)) {
        this.startTabTracking(tab);
      }
    } catch (error) {
      console.error('[TabAnalytics] Error handling tab activation:', error);
    }
  }

  /**
   * 处理标签页更新
   */
  private handleTabUpdated(tab: chrome.tabs.Tab): void {
    if (!tab.id || !tab.url || !this.isValidUrl(tab.url)) {
      return;
    }

    const existingTab = this.activeTabsMap.get(tab.id);
    if (existingTab && existingTab.url !== tab.url) {
      // URL 发生变化，记录之前的访问并开始新的跟踪
      this.stopTabTracking(tab.id);
      this.startTabTracking(tab);
    } else if (!existingTab) {
      // 新标签页
      this.startTabTracking(tab);
    } else {
      // 更新标签页信息（如标题变化）
      this.updateTabInfo(tab);
    }
  }

  /**
   * 处理标签页移除
   */
  private handleTabRemoved(tabId: number): void {
    this.stopTabTracking(tabId);
  }

  /**
   * 开始跟踪标签页
   */
  private startTabTracking(tab: chrome.tabs.Tab): void {
    if (!tab.id || !tab.url || !this.isValidUrl(tab.url)) {
      return;
    }

    const domain = this.extractDomain(tab.url);
    const now = Date.now();

    const activeTab: ActiveTab = {
      tabId: tab.id,
      url: tab.url,
      title: tab.title || 'Untitled',
      domain,
      favicon: tab.favIconUrl,
      startTime: now,
      lastActiveTime: now
    };

    this.activeTabsMap.set(tab.id, activeTab);
    console.log(`[TabAnalytics] Started tracking tab ${tab.id}: ${domain}`);
  }

  /**
   * 停止跟踪标签页
   */
  private stopTabTracking(tabId: number): void {
    const activeTab = this.activeTabsMap.get(tabId);
    if (!activeTab) {
      return;
    }

    const duration = Date.now() - activeTab.startTime;
    if (duration >= this.MIN_DURATION_TO_RECORD) {
      this.recordVisit(activeTab, duration);
    }

    this.activeTabsMap.delete(tabId);
    console.log(`[TabAnalytics] Stopped tracking tab ${tabId}, duration: ${duration}ms`);
  }

  /**
   * 更新标签页信息
   */
  private updateTabInfo(tab: chrome.tabs.Tab): void {
    if (!tab.id) return;

    const activeTab = this.activeTabsMap.get(tab.id);
    if (activeTab) {
      activeTab.title = tab.title || activeTab.title;
      activeTab.favicon = tab.favIconUrl || activeTab.favicon;
      activeTab.lastActiveTime = Date.now();
    }
  }

  /**
   * 暂停所有标签页计时
   */
  private pauseAllTabs(): void {
    this.activeTabsMap.forEach((activeTab) => {
      const duration = Date.now() - activeTab.startTime;
      if (duration >= this.MIN_DURATION_TO_RECORD) {
        this.recordVisit(activeTab, duration);
      }
      // 重置开始时间，为恢复时准备
      activeTab.startTime = Date.now();
    });
  }

  /**
   * 恢复活动标签页计时
   */
  private async resumeActiveTab(windowId: number): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, windowId });
      if (tabs.length > 0 && tabs[0].id) {
        const activeTab = this.activeTabsMap.get(tabs[0].id);
        if (activeTab) {
          activeTab.startTime = Date.now();
          activeTab.lastActiveTime = Date.now();
        }
      }
    } catch (error) {
      console.error('[TabAnalytics] Error resuming active tab:', error);
    }
  }

  /**
   * 检查标签页活动状态
   */
  private checkTabActivity(): void {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5分钟无活动认为不活跃

    this.activeTabsMap.forEach((activeTab) => {
      if (now - activeTab.lastActiveTime > inactiveThreshold) {
        // 标签页长时间无活动，暂停计时
        const duration = activeTab.lastActiveTime - activeTab.startTime;
        if (duration >= this.MIN_DURATION_TO_RECORD) {
          this.recordVisit(activeTab, duration);
          activeTab.startTime = now; // 重置开始时间
        }
      }
    });
  }

  /**
   * 更新活动标签页的停留时长
   */
  private updateActiveTabsDuration(): void {
    this.activeTabsMap.forEach((activeTab) => {
      activeTab.lastActiveTime = Date.now();
    });
  }

  /**
   * 记录网站访问
   */
  private async recordVisit(activeTab: ActiveTab, duration: number): Promise<void> {
    const visit: WebsiteVisit = {
      domain: activeTab.domain,
      url: activeTab.url,
      title: activeTab.title,
      favicon: activeTab.favicon,
      timestamp: activeTab.startTime,
      duration,
      source: this.determineVisitSource()
    };

    // 保存访问记录
    await this.saveVisit(visit);

    // 更新网站统计
    await this.updateWebsiteStats(visit);

    console.log(`[TabAnalytics] Recorded visit: ${activeTab.domain}, duration: ${duration}ms`);
  }

  /**
   * 保存访问记录
   */
  private async saveVisit(visit: WebsiteVisit): Promise<void> {
    try {
      const visits = await this.visitsStorage.get().toPromise() || [];
      visits.unshift(visit); // 最新的在前面

      // 限制存储的访问记录数量
      if (visits.length > this.MAX_VISITS_STORED) {
        visits.splice(this.MAX_VISITS_STORED);
      }

      this.visitsStorage.set(visits);
    } catch (error) {
      console.error('[TabAnalytics] Error saving visit:', error);
    }
  }

  /**
   * 更新网站统计
   */
  private async updateWebsiteStats(visit: WebsiteVisit): Promise<void> {
    try {
      const allStats = await this.statsStorage.get().toPromise() || {};
      const existingStats = allStats[visit.domain];

      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

      let newStats: WebsiteStats;

      if (existingStats) {
        // 更新现有统计
        const newVisitCount = existingStats.visitCount + 1;
        const newTotalDuration = existingStats.totalDuration + visit.duration;

        newStats = {
          ...existingStats,
          title: visit.title, // 使用最新的标题
          favicon: visit.favicon || existingStats.favicon,
          visitCount: newVisitCount,
          totalDuration: newTotalDuration,
          averageDuration: newTotalDuration / newVisitCount,
          lastVisit: visit.timestamp,
          frequencyScore: this.calculateFrequencyScore(newVisitCount, visit.timestamp - existingStats.firstVisit),
          recentVisits: await this.countRecentVisits(visit.domain, sevenDaysAgo)
        };
      } else {
        // 创建新统计
        newStats = {
          domain: visit.domain,
          title: visit.title,
          favicon: visit.favicon,
          visitCount: 1,
          totalDuration: visit.duration,
          averageDuration: visit.duration,
          firstVisit: visit.timestamp,
          lastVisit: visit.timestamp,
          frequencyScore: 1,
          recentVisits: 1
        };
      }

      allStats[visit.domain] = newStats;
      this.statsStorage.set(allStats);

      // 触发更新事件
      this.updateSubject.next(newStats);
    } catch (error) {
      console.error('[TabAnalytics] Error updating website stats:', error);
    }
  }

  /**
   * 计算访问频率评分
   */
  private calculateFrequencyScore(visitCount: number, timeSpan: number): number {
    if (timeSpan <= 0) return visitCount;
    
    const daysSpan = timeSpan / (24 * 60 * 60 * 1000);
    const visitsPerDay = visitCount / Math.max(daysSpan, 1);
    
    // 基于每日访问次数的评分算法
    return Math.round(Math.log10(visitsPerDay + 1) * 100);
  }

  /**
   * 统计最近访问次数
   */
  private async countRecentVisits(domain: string, sinceTimestamp: number): Promise<number> {
    try {
      const visits = await this.visitsStorage.get().toPromise() || [];
      return visits.filter(visit => 
        visit.domain === domain && visit.timestamp >= sinceTimestamp
      ).length;
    } catch (error) {
      console.error('[TabAnalytics] Error counting recent visits:', error);
      return 0;
    }
  }

  /**
   * 确定访问来源
   */
  private determineVisitSource(): WebsiteVisit['source'] {
    // 这里可以根据实际需要实现更复杂的逻辑
    // 暂时返回 'direct'
    return 'direct';
  }

  /**
   * 提取域名
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  /**
   * 检查URL是否有效
   */
  private isValidUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * 获取销毁信号
   */
  private getDestroySignal(): Observable<void> {
    return new Observable(observer => {
      const checkDestroyed = () => {
        if (this.destroyed) {
          observer.next();
          observer.complete();
        } else {
          setTimeout(checkDestroyed, 1000);
        }
      };
      checkDestroyed();
    });
  }

  // 公共API方法

  /**
   * 获取网站统计信息
   */
  getWebsiteStats(): Observable<Record<string, WebsiteStats>> {
    return this.statsStorage.watch().pipe(
      map(stats => stats || {})
    );
  }

  /**
   * 获取特定网站的统计信息
   */
  async getStatsForDomain(domain: string): Promise<WebsiteStats | null> {
    const allStats = await this.statsStorage.get().toPromise() || {};
    return allStats[domain] || null;
  }

  /**
   * 获取访问记录
   */
  getVisitHistory(limit?: number): Observable<WebsiteVisit[]> {
    return this.visitsStorage.watch().pipe(
      map(visits => {
        const validVisits = visits || [];
        return limit ? validVisits.slice(0, limit) : validVisits;
      })
    );
  }

  /**
   * 获取热门网站
   */
  async getPopularWebsites(limit = 10): Promise<WebsiteStats[]> {
    const allStats = await this.statsStorage.get().toPromise() || {};
    return Object.values(allStats)
      .sort((a, b) => b.frequencyScore - a.frequencyScore)
      .slice(0, limit);
  }

  /**
   * 获取最近访问的网站
   */
  async getRecentWebsites(limit = 10): Promise<WebsiteStats[]> {
    const allStats = await this.statsStorage.get().toPromise() || {};
    return Object.values(allStats)
      .sort((a, b) => b.lastVisit - a.lastVisit)
      .slice(0, limit);
  }

  /**
   * 监听统计更新
   */
  onStatsUpdate(): Observable<WebsiteStats> {
    return this.updateSubject.asObservable();
  }

  /**
   * 清除所有数据
   */
  async clearAllData(): Promise<void> {
    await this.visitsStorage.set([]);
    await this.statsStorage.set({});
    this.activeTabsMap.clear();
    console.log('[TabAnalytics] All data cleared');
  }

  /**
   * 清除指定域名的数据
   */
  async clearDomainData(domain: string): Promise<void> {
    // 清除访问记录
    const visits = await this.visitsStorage.get().toPromise() || [];
    const filteredVisits = visits.filter(visit => visit.domain !== domain);
    await this.visitsStorage.set(filteredVisits);

    // 清除统计信息
    const allStats = await this.statsStorage.get().toPromise() || {};
    delete allStats[domain];
    await this.statsStorage.set(allStats);

    console.log(`[TabAnalytics] Cleared data for domain: ${domain}`);
  }

  /**
   * 销毁分析器
   */
  destroy(): void {
    this.destroyed = true;
    
    // 保存当前活动标签页的访问记录
    this.activeTabsMap.forEach((activeTab) => {
      const duration = Date.now() - activeTab.startTime;
      if (duration >= this.MIN_DURATION_TO_RECORD) {
        this.recordVisit(activeTab, duration);
      }
    });

    this.activeTabsMap.clear();
    this.updateSubject.complete();
    
    console.log('[TabAnalytics] Destroyed');
  }
}

// 导出单例实例
export const tabAnalytics = new TabAnalytics();
