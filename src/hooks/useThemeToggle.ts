import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ActualTheme = 'light' | 'dark';

const STORAGE_KEY = 'ctrlk-theme-mode';

/**
 * 主题切换 Hook
 * 支持 light、dark、system 三种模式
 * 不影响原有的 useTheme hook
 */
export function useThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('system');
  const [actualTheme, setActualTheme] = useState<ActualTheme>('light');

  // 获取系统主题偏好
  const getSystemTheme = useCallback((): ActualTheme => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  // 应用主题到文档
  const applyTheme = useCallback((theme: ActualTheme) => {
    const root = document.documentElement;
    
    // 移除之前的主题类
    root.classList.remove('light', 'dark');
    
    // 添加新的主题类
    root.classList.add(theme);
    
    // 设置 data 属性，方便其他组件使用
    root.setAttribute('data-theme', theme);
    
    setActualTheme(theme);
  }, []);

  // 切换到指定模式
  const switchToMode = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    
    // 保存到本地存储
    localStorage.setItem(STORAGE_KEY, newMode);
    
    // 计算实际应用的主题
    let themeToApply: ActualTheme;
    
    if (newMode === 'system') {
      themeToApply = getSystemTheme();
    } else {
      themeToApply = newMode;
    }
    
    applyTheme(themeToApply);
  }, [getSystemTheme, applyTheme]);

  // 在 light 和 dark 之间快速切换（忽略 system）
  const toggleTheme = useCallback(() => {
    const newMode: ThemeMode = actualTheme === 'light' ? 'dark' : 'light';
    switchToMode(newMode);
  }, [actualTheme, switchToMode]);

  // 初始化主题
  useEffect(() => {
    // 从本地存储读取保存的模式
    const savedMode = localStorage.getItem(STORAGE_KEY) as ThemeMode;
    const initialMode = savedMode && ['light', 'dark', 'system'].includes(savedMode) 
      ? savedMode 
      : 'system';
    
    // 计算初始主题
    let initialTheme: ActualTheme;
    if (initialMode === 'system') {
      initialTheme = getSystemTheme();
    } else {
      initialTheme = initialMode;
    }
    
    setMode(initialMode);
    applyTheme(initialTheme);
  }, [getSystemTheme, applyTheme]);

  // 监听系统主题变化（仅在 system 模式下生效）
  useEffect(() => {
    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = () => {
      if (mode === 'system') {
        const systemTheme = getSystemTheme();
        applyTheme(systemTheme);
      }
    };
    
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [mode, getSystemTheme, applyTheme]);

  return {
    mode,
    actualTheme,
    switchToMode,
    toggleTheme,
    isSystemMode: mode === 'system',
    isDark: actualTheme === 'dark'
  };
}
