import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeToggle, type ThemeMode } from '../hooks/useThemeToggle';
import Button from './ui/button';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

// 主题选项配置 - 按照切换顺序
const themeOptions = [
  { mode: 'light' as ThemeMode, icon: Sun, label: '浅色模式' },
  { mode: 'dark' as ThemeMode, icon: Moon, label: '深色模式' },
  { mode: 'system' as ThemeMode, icon: Monitor, label: '跟随系统' }
] as const;

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mode, switchToMode } = useThemeToggle();

  // 获取当前模式的配置
  const currentOption = themeOptions.find(option => option.mode === mode) || themeOptions[0];
  const CurrentIcon = currentOption.icon;

  // 循环切换到下一个模式
  const handleToggle = () => {
    const currentIndex = themeOptions.findIndex(option => option.mode === mode);
    const nextIndex = (currentIndex + 1) % themeOptions.length;
    const nextMode = themeOptions[nextIndex].mode;
    switchToMode(nextMode);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleToggle}
      className={cn("transition-all duration-200 hover:bg-accent", className)}
      title={currentOption.label}
    >
      <CurrentIcon className="h-4 w-4" />
    </Button>
  );
}

// 简单的主题状态指示器
export function ThemeIndicator({ className }: { className?: string }) {
  const { mode, actualTheme } = useThemeToggle();
  
  const getStatusText = () => {
    if (mode === 'system') {
      return `系统 (${actualTheme === 'dark' ? '深色' : '浅色'})`;
    }
    return actualTheme === 'dark' ? '深色' : '浅色';
  };

  const Icon = actualTheme === 'dark' ? Moon : Sun;
  
  return (
    <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Icon className="h-3.5 w-3.5" />
      <span>{getStatusText()}</span>
    </div>
  );
}
