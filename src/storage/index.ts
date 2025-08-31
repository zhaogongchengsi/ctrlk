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
 * - 兼容性：自动检测Chrome API可用性，提供备用方案
 */

// 核心存储类
export { RxStorage } from './rx-storage';
export type { StorageConfig } from './rx-storage';

// 存储工厂
export { StorageFactory } from './storage-factory';
export type { IStorage } from './storage-factory';

// 存储管理器
export { StorageManager, storageManager } from './storage-manager';
export type { StorageManagerConfig } from './storage-manager';
