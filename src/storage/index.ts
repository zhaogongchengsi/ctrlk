/**
 * 统一存储模块入口文件
 * 
 * 提供基于 RxJS 的浏览器插件数据永久存储解决方案
 * 
 * 主要特性：
 * - 防抖写入：多次频繁写入只执行最后一次
 * - 缓存机制：读取操作优先从缓存获取最新数据
 * - 响应式：数据变化时自动通知订阅者
 * - 类型安全：完整的 TypeScript 类型支持
 * - 统一管理：通过 StorageManager 统一管理所有存储实例
 */

// 核心存储类
export { RxStorage } from './rx-storage';
export type { StorageConfig } from './rx-storage';

// 存储管理器
export { StorageManager, storageManager } from './storage-manager';
export type { StorageManagerConfig } from './storage-manager';

// 预定义类型和工具函数
export {
  // 类型定义
  type UserSettings,
  type DialogState,
  type SearchHistory,
  type UsageStats,
  
  // 常量
  STORAGE_KEYS,
  DEFAULT_USER_SETTINGS,
  
  // 预定义存储获取函数
  getUserSettingsStorage,
  getDialogStatesStorage,
  getSearchHistoryStorage,
  getUsageStatsStorage,
  getCacheIndexStorage,
  
  // 工具类
  StorageUtils
} from './storage-types';

/**
 * 使用示例：
 * 
 * ```typescript
 * import { storageManager, getUserSettingsStorage, StorageUtils } from '@/storage';
 * 
 * // 1. 直接使用预定义的存储
 * const userSettings = getUserSettingsStorage();
 * userSettings.set({ theme: 'dark', language: 'zh-CN' });
 * 
 * // 2. 监听数据变化
 * userSettings.watch().subscribe(settings => {
 *   console.log('Settings changed:', settings);
 * });
 * 
 * // 3. 创建自定义存储
 * const customStorage = storageManager.getStorage<string>('my_key', 'default_value');
 * 
 * // 4. 使用工具函数
 * await StorageUtils.addSearchHistory('react', 10);
 * await StorageUtils.updateUsageStats('search', 'react');
 * 
 * // 5. 批量操作
 * storageManager.setBatch({
 *   key1: 'value1',
 *   key2: 'value2'
 * });
 * 
 * // 6. 监听多个存储
 * storageManager.watchMultiple(['key1', 'key2']).subscribe(data => {
 *   console.log('Multiple data changed:', data);
 * });
 * ```
 */
