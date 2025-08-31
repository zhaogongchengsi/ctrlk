/**
 * 分析系统导出模块
 * 统一导出所有分析相关的类和工具
 */

// 核心分析类
export { TabAnalytics, tabAnalytics } from './tab-analytics';
export { AnalyticsQuery, analyticsQuery } from './analytics-query';

// 类型定义
export type { 
  WebsiteVisit, 
  WebsiteStats,
  ActiveTab 
} from './tab-analytics';

export type { 
  TimeRange, 
  SortBy, 
  AnalyticsQueryResult,
  TimePeriodStats 
} from './analytics-query';

// 工具和演示
export { AnalyticsDemo } from './analytics-demo';

// 常用预设功能
export {
  initializeAnalytics,
  getWebsiteOverview,
  analyzeAccessPatterns,
  getDailyTrends,
  getCategoryBreakdown,
  searchWebsite,
  startRealTimeMonitoring,
  exportAnalyticsData,
  generateReport,
  cleanupOldData,
  runAnalyticsDemo
} from './analytics-demo';
