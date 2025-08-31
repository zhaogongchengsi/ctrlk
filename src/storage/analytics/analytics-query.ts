import { tabAnalytics } from './tab-analytics';
import type { WebsiteStats, WebsiteVisit } from './tab-analytics';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 时间范围
 */
export type TimeRange = 'today' | 'week' | 'month' | 'year' | 'all';

/**
 * 排序方式
 */
export type SortBy = 'frequency' | 'duration' | 'recent' | 'visits';

/**
 * 分析查询结果
 */
export interface AnalyticsQueryResult {
  websites: WebsiteStats[];
  totalWebsites: number;
  totalVisits: number;
  totalDuration: number;
  averageDuration: number;
  mostVisited: WebsiteStats | null;
  longestSession: WebsiteStats | null;
}

/**
 * 时间段统计
 */
export interface TimePeriodStats {
  period: string;
  visits: number;
  duration: number;
  uniqueWebsites: number;
}

/**
 * 分析查询工具类
 */
export class AnalyticsQuery {
  constructor() {}

  /**
   * 获取指定时间范围的网站统计
   */
  getWebsitesByTimeRange(
    timeRange: TimeRange = 'all',
    sortBy: SortBy = 'frequency',
    limit = 50
  ): Observable<AnalyticsQueryResult> {
    return combineLatest([
      tabAnalytics.getWebsiteStats(),
      tabAnalytics.getVisitHistory()
    ]).pipe(
      map(([allStats, allVisits]) => {
        const timeFilter = this.getTimeFilter(timeRange);
        
        // 过滤访问记录
        const filteredVisits = allVisits.filter(visit => timeFilter(visit.timestamp));
        
        // 计算时间范围内的网站统计
        const websiteStats = this.calculateStatsForPeriod(filteredVisits, allStats);
        
        // 排序
        const sortedStats = this.sortWebsites(websiteStats, sortBy);
        
        // 限制结果数量
        const limitedStats = sortedStats.slice(0, limit);
        
        // 计算总体统计
        const totalVisits = filteredVisits.length;
        const totalDuration = filteredVisits.reduce((sum, visit) => sum + visit.duration, 0);
        const averageDuration = totalVisits > 0 ? totalDuration / totalVisits : 0;
        const mostVisited = sortedStats.length > 0 ? sortedStats[0] : null;
        const longestSession = this.getLongestSessionWebsite(sortedStats);
        
        return {
          websites: limitedStats,
          totalWebsites: websiteStats.length,
          totalVisits,
          totalDuration,
          averageDuration,
          mostVisited,
          longestSession
        };
      })
    );
  }

  /**
   * 获取每日统计
   */
  getDailyStats(days = 7): Observable<TimePeriodStats[]> {
    return tabAnalytics.getVisitHistory().pipe(
      map(visits => {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const stats: TimePeriodStats[] = [];

        for (let i = 0; i < days; i++) {
          const dayStart = now - (i + 1) * dayMs;
          const dayEnd = now - i * dayMs;
          
          const dayVisits = visits.filter(visit => 
            visit.timestamp >= dayStart && visit.timestamp < dayEnd
          );

          const uniqueWebsites = new Set(dayVisits.map(visit => visit.domain));
          
          stats.unshift({
            period: this.formatDate(dayStart),
            visits: dayVisits.length,
            duration: dayVisits.reduce((sum, visit) => sum + visit.duration, 0),
            uniqueWebsites: uniqueWebsites.size
          });
        }

        return stats;
      })
    );
  }

  /**
   * 获取每小时统计（今天）
   */
  getHourlyStats(): Observable<TimePeriodStats[]> {
    return tabAnalytics.getVisitHistory().pipe(
      map(visits => {
        const now = Date.now();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const todayStart = today.getTime();
        
        const todayVisits = visits.filter(visit => visit.timestamp >= todayStart);
        const stats: TimePeriodStats[] = [];

        for (let hour = 0; hour < 24; hour++) {
          const hourStart = todayStart + hour * 60 * 60 * 1000;
          const hourEnd = hourStart + 60 * 60 * 1000;
          
          const hourVisits = todayVisits.filter(visit => 
            visit.timestamp >= hourStart && visit.timestamp < hourEnd
          );

          const uniqueWebsites = new Set(hourVisits.map(visit => visit.domain));
          
          stats.push({
            period: `${hour.toString().padStart(2, '0')}:00`,
            visits: hourVisits.length,
            duration: hourVisits.reduce((sum, visit) => sum + visit.duration, 0),
            uniqueWebsites: uniqueWebsites.size
          });
        }

        return stats;
      })
    );
  }

  /**
   * 搜索网站
   */
  searchWebsites(query: string, limit = 20): Observable<WebsiteStats[]> {
    return tabAnalytics.getWebsiteStats().pipe(
      map(allStats => {
        const lowerQuery = query.toLowerCase();
        const matchingStats = Object.values(allStats).filter(stats => 
          stats.domain.toLowerCase().includes(lowerQuery) ||
          stats.title.toLowerCase().includes(lowerQuery)
        );

        return matchingStats
          .sort((a, b) => b.frequencyScore - a.frequencyScore)
          .slice(0, limit);
      })
    );
  }

  /**
   * 获取网站分类统计
   */
  getCategoryStats(): Observable<Record<string, { count: number; duration: number }>> {
    return tabAnalytics.getWebsiteStats().pipe(
      map(allStats => {
        const categories: Record<string, { count: number; duration: number }> = {};
        
        Object.values(allStats).forEach(stats => {
          const category = this.categorizeWebsite(stats.domain);
          
          if (!categories[category]) {
            categories[category] = { count: 0, duration: 0 };
          }
          
          categories[category].count += stats.visitCount;
          categories[category].duration += stats.totalDuration;
        });

        return categories;
      })
    );
  }

  /**
   * 获取访问模式分析
   */
  getAccessPatterns(): Observable<{
    peakHours: number[];
    peakDays: string[];
    averageSessionDuration: number;
    mostActiveTimeSlot: string;
  }> {
    return tabAnalytics.getVisitHistory().pipe(
      map(visits => {
        const hourCounts = new Array(24).fill(0);
        const dayCounts: Record<string, number> = {};
        let totalDuration = 0;

        visits.forEach(visit => {
          const date = new Date(visit.timestamp);
          const hour = date.getHours();
          const dayKey = date.toLocaleDateString();

          hourCounts[hour]++;
          dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1;
          totalDuration += visit.duration;
        });

        // 找出访问量最高的3个小时
        const peakHours = hourCounts
          .map((count, hour) => ({ hour, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map(item => item.hour);

        // 找出访问量最高的3天
        const peakDays = Object.entries(dayCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([day]) => day);

        // 计算平均会话时长
        const averageSessionDuration = visits.length > 0 ? totalDuration / visits.length : 0;

        // 找出最活跃的时间段
        const maxHourIndex = hourCounts.indexOf(Math.max(...hourCounts));
        const mostActiveTimeSlot = `${maxHourIndex.toString().padStart(2, '0')}:00-${(maxHourIndex + 1).toString().padStart(2, '0')}:00`;

        return {
          peakHours,
          peakDays,
          averageSessionDuration,
          mostActiveTimeSlot
        };
      })
    );
  }

  /**
   * 导出数据
   */
  async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
    const [stats, visits] = await Promise.all([
      tabAnalytics.getWebsiteStats().toPromise(),
      tabAnalytics.getVisitHistory().toPromise()
    ]);

    const data = {
      exportTime: new Date().toISOString(),
      websiteStats: stats,
      visitHistory: visits,
      summary: {
        totalWebsites: Object.keys(stats || {}).length,
        totalVisits: visits?.length || 0,
        totalDuration: visits?.reduce((sum, visit) => sum + visit.duration, 0) || 0
      }
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // 简单的CSV格式
      const csvLines = [
        'Domain,Title,Visit Count,Total Duration,Average Duration,Last Visit',
        ...Object.values(stats || {}).map(stat =>
          `"${stat.domain}","${stat.title}",${stat.visitCount},${stat.totalDuration},${stat.averageDuration},"${new Date(stat.lastVisit).toISOString()}"`
        )
      ];
      return csvLines.join('\n');
    }
  }

  // 私有辅助方法

  private getTimeFilter(timeRange: TimeRange): (timestamp: number) => boolean {
    const now = Date.now();
    
    switch (timeRange) {
      case 'today': {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        return (timestamp) => timestamp >= today.getTime();
      }
      
      case 'week': {
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
        return (timestamp) => timestamp >= weekAgo;
      }
      
      case 'month': {
        const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
        return (timestamp) => timestamp >= monthAgo;
      }
      
      case 'year': {
        const yearAgo = now - 365 * 24 * 60 * 60 * 1000;
        return (timestamp) => timestamp >= yearAgo;
      }
      
      case 'all':
      default:
        return () => true;
    }
  }

  private calculateStatsForPeriod(
    visits: WebsiteVisit[], 
    allStats: Record<string, WebsiteStats>
  ): WebsiteStats[] {
    const domainVisits: Record<string, WebsiteVisit[]> = {};
    
    // 按域名分组访问记录
    visits.forEach(visit => {
      if (!domainVisits[visit.domain]) {
        domainVisits[visit.domain] = [];
      }
      domainVisits[visit.domain].push(visit);
    });

    // 计算每个域名在该时间段的统计
    return Object.entries(domainVisits).map(([domain, domainVisitList]) => {
      const originalStats = allStats[domain];
      const visitCount = domainVisitList.length;
      const totalDuration = domainVisitList.reduce((sum, visit) => sum + visit.duration, 0);
      const latestVisit = domainVisitList.reduce((latest, visit) => 
        visit.timestamp > latest.timestamp ? visit : latest
      );

      return {
        domain,
        title: latestVisit.title,
        favicon: latestVisit.favicon,
        visitCount,
        totalDuration,
        averageDuration: totalDuration / visitCount,
        firstVisit: Math.min(...domainVisitList.map(v => v.timestamp)),
        lastVisit: Math.max(...domainVisitList.map(v => v.timestamp)),
        frequencyScore: originalStats?.frequencyScore || visitCount,
        recentVisits: visitCount
      };
    });
  }

  private sortWebsites(websites: WebsiteStats[], sortBy: SortBy): WebsiteStats[] {
    return websites.sort((a, b) => {
      switch (sortBy) {
        case 'frequency':
          return b.frequencyScore - a.frequencyScore;
        case 'duration':
          return b.totalDuration - a.totalDuration;
        case 'recent':
          return b.lastVisit - a.lastVisit;
        case 'visits':
          return b.visitCount - a.visitCount;
        default:
          return b.frequencyScore - a.frequencyScore;
      }
    });
  }

  private getLongestSessionWebsite(websites: WebsiteStats[]): WebsiteStats | null {
    if (websites.length === 0) return null;
    
    return websites.reduce((longest, current) => 
      current.averageDuration > longest.averageDuration ? current : longest
    );
  }

  private formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }

  private categorizeWebsite(domain: string): string {
    // 简单的网站分类逻辑
    const categories = {
      'social': ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'reddit.com'],
      'development': ['github.com', 'stackoverflow.com', 'developer.mozilla.org', 'npmjs.com'],
      'search': ['google.com', 'bing.com', 'baidu.com', 'duckduckgo.com'],
      'entertainment': ['youtube.com', 'netflix.com', 'twitch.tv', 'spotify.com'],
      'news': ['cnn.com', 'bbc.com', 'reuters.com', 'news.ycombinator.com'],
      'shopping': ['amazon.com', 'ebay.com', 'alibaba.com', 'taobao.com']
    };

    for (const [category, domains] of Object.entries(categories)) {
      if (domains.some(d => domain.includes(d))) {
        return category;
      }
    }

    return 'other';
  }
}

// 导出单例实例
export const analyticsQuery = new AnalyticsQuery();
