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
    MAX_PER_DOMAIN: 3, // 每个域名最多保留的历史记录数
  },

  // 域名去重配置
  DOMAIN_DEDUPLICATION: {
    HISTORY_MAX_PER_DOMAIN: 2,    // 历史记录搜索结果中每个域名最多显示数量
    BOOKMARK_MAX_PER_DOMAIN: 3,   // 书签搜索结果中每个域名最多显示数量
    ENABLED: true,                 // 是否启用域名去重
  },
  
  // Fuse.js 搜索配置
  FUSE_OPTIONS: {
    threshold: 0.4, // 模糊匹配阈值 (0-1，越小越严格)
    distance: 100, // 搜索距离
    minMatchCharLength: 2, // 最小匹配字符长度，避免单字符匹配
    includeScore: true, // 包含匹配分数
    includeMatches: true, // 包含匹配信息
    findAllMatches: true, // 查找所有匹配
    ignoreLocation: true, // 忽略位置
    shouldSort: true, // 按分数排序
    useExtendedSearch: true, // 启用扩展搜索语法
    // 搜索键配置
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
    ]
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
    suggestion: '🔍',
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
    className: 'bg-[var(--gray5)] text-[var(--gray12)] px-1 font-semibold rounded-md',
    tag: 'mark',
  },
} as const;

// 搜索结果类型
export type SearchResultType = typeof SEARCH_CONFIG.RESULT_TYPES[keyof typeof SEARCH_CONFIG.RESULT_TYPES];

// 搜索配置类型
export type SearchConfigType = typeof SEARCH_CONFIG;
