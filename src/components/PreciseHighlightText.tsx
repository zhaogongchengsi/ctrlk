import React from 'react';
import type { HighlightMatch } from '@/search/search-engine';

interface PreciseHighlightTextProps {
  text: string;
  highlights?: HighlightMatch[];
  className?: string;
  highlightClassName?: string;
}

/**
 * 基于 Fuse.js 匹配信息的精确高亮组件
 * 使用 Fuse.js 返回的 indices 信息进行精确高亮
 */
export const PreciseHighlightText: React.FC<PreciseHighlightTextProps> = ({
  text,
  highlights,
  className = "",
  highlightClassName = "bg-blue-50 text-blue-800 rounded-sm"
}) => {
  // 如果没有高亮信息，直接返回原文本
  if (!highlights || highlights.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // 合并重叠的高亮区间
  const mergedRanges = mergeHighlightRanges(highlights);
  
  // 根据高亮区间分割文本
  const parts = splitTextByRanges(text, mergedRanges);

  return (
    <span className={className}>
      {parts.map((part, index) => (
        part.isHighlight ? (
          <mark 
            key={index} 
            className={highlightClassName}
            style={{ 
              padding: 0, 
              margin: 0, 
              lineHeight: 'inherit',
              verticalAlign: 'baseline',
              display: 'inline'
            }}
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      ))}
    </span>
  );
};

/**
 * 合并重叠的高亮区间
 */
function mergeHighlightRanges(highlights: HighlightMatch[]): Array<[number, number]> {
  if (highlights.length === 0) return [];

  // 按起始位置排序
  const sortedRanges = highlights
    .map(h => h.indices)
    .sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [sortedRanges[0]];

  for (let i = 1; i < sortedRanges.length; i++) {
    const current = sortedRanges[i];
    const lastMerged = merged[merged.length - 1];

    // 如果当前区间与上一个区间重叠或相邻
    if (current[0] <= lastMerged[1] + 1) {
      // 合并区间
      lastMerged[1] = Math.max(lastMerged[1], current[1]);
    } else {
      // 添加新的区间
      merged.push(current);
    }
  }

  return merged;
}

/**
 * 根据高亮区间分割文本
 */
function splitTextByRanges(text: string, ranges: Array<[number, number]>): Array<{text: string, isHighlight: boolean}> {
  if (ranges.length === 0) {
    return [{ text, isHighlight: false }];
  }

  const parts: Array<{text: string, isHighlight: boolean}> = [];
  let currentIndex = 0;

  for (const [start, end] of ranges) {
    // 添加高亮前的普通文本
    if (currentIndex < start) {
      parts.push({
        text: text.substring(currentIndex, start),
        isHighlight: false
      });
    }

    // 添加高亮文本
    parts.push({
      text: text.substring(start, end + 1),
      isHighlight: true
    });

    currentIndex = end + 1;
  }

  // 添加剩余的普通文本
  if (currentIndex < text.length) {
    parts.push({
      text: text.substring(currentIndex),
      isHighlight: false
    });
  }

  return parts.filter(part => part.text.length > 0);
}

export default PreciseHighlightText;
