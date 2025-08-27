// 搜索配置常量
export const SEARCH_CONFIG = {
  // 防抖延迟
  DEBOUNCE_DELAY: 300,
  
  // 最小查询长度
  MIN_QUERY_LENGTH: 2,
  
  // 每组最大显示结果数
  MAX_RESULTS_PER_GROUP: 10,
  
  // 历史记录配置
  HISTORY: {
    MAX_RESULTS: 1000,
    MAX_DAYS: 30,
  },
  
  // 搜索权重
  SEARCH_WEIGHTS: {
    EXACT_MATCH: 500,
    TITLE_CONTAINS: 200,
    TITLE_STARTS_WITH: 150,
    URL_CONTAINS: 30,
    WORD_MATCH: 40,
    PARTIAL_WORD_MATCH: 20,
    TAB_BONUS: 15,
    BOOKMARK_BONUS: 10,
    HISTORY_BONUS: 5,
  },
  
  // 搜索结果类型
  RESULT_TYPES: {
    BOOKMARK: 'bookmark',
    TAB: 'tab',
    HISTORY: 'history',
  } as const,
  
  // 图标映射
  ICONS: {
    bookmark: '⭐',
    tab: '🔗',
    history: '📚',
    default: '📄',
  } as const,
  
  // 显示名称
  TYPE_NAMES: {
    bookmark: '书签',
    tab: '打开的标签页',
    history: '历史记录',
  } as const,
  
  // 高亮样式
  HIGHLIGHT: {
    className: 'bg-blue-50 text-blue-800 rounded-sm',
    tag: 'mark',
  },
} as const;

// 搜索结果类型
export type SearchResultType = typeof SEARCH_CONFIG.RESULT_TYPES[keyof typeof SEARCH_CONFIG.RESULT_TYPES];

// 搜索配置类型
export type SearchConfigType = typeof SEARCH_CONFIG;
