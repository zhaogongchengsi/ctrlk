import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark';

/**
 * 主题检测 Hook
 * 检测系统主题、页面主题和背景色来确定当前主题
 */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>('light');

  // 检测颜色是否为深色
  const isColorDark = useCallback((color: string): boolean => {
    // 解析RGB颜色
    const rgb = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!rgb) return false;
    
    const r = parseInt(rgb[1]);
    const g = parseInt(rgb[2]);
    const b = parseInt(rgb[3]);
    
    // 计算亮度 (0-255)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // 亮度小于128认为是深色
    return brightness < 128;
  }, []);

  // 检测深色主题
  const detectDarkTheme = useCallback((): boolean => {
    // 1. 检查系统偏好
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // 2. 检查页面类名
    const htmlClasses = document.documentElement.className;
    const bodyClasses = document.body.className;
    const darkClassPatterns = /dark|night|black/i;
    
    const hasPageDarkClass = darkClassPatterns.test(htmlClasses) || darkClassPatterns.test(bodyClasses);
    
    // 3. 检查常见的主题属性
    const htmlTheme = document.documentElement.getAttribute('data-theme') || 
                      document.documentElement.getAttribute('data-color-scheme');
    const bodyTheme = document.body.getAttribute('data-theme') || 
                      document.body.getAttribute('data-color-scheme');
    
    const hasThemeAttr = darkClassPatterns.test(htmlTheme || '') || darkClassPatterns.test(bodyTheme || '');
    
    // 4. 检查背景色
    const bodyBgColor = getComputedStyle(document.body).backgroundColor;
    const htmlBgColor = getComputedStyle(document.documentElement).backgroundColor;
    
    // 简单的亮度检测（如果背景是深色）
    const isDarkBackground = isColorDark(bodyBgColor) || isColorDark(htmlBgColor);
    
    // 优先级：页面明确设置的主题 > 背景色检测 > 系统偏好
    return hasPageDarkClass || hasThemeAttr || isDarkBackground || prefersDark;
  }, [isColorDark]);

  useEffect(() => {
    // 更新主题
    const updateTheme = () => {
      const isDark = detectDarkTheme();
      setTheme(isDark ? 'dark' : 'light');
    };

    // 初始主题检测
    updateTheme();

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => updateTheme();
    
    mediaQuery.addEventListener('change', handleMediaChange);

    // 监听页面主题变化
    const observer = new MutationObserver(updateTheme);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-color-scheme']
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-color-scheme']
    });

    // 清理函数
    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      observer.disconnect();
    };
  }, [detectDarkTheme]);

  return theme;
}
