import { Command } from "@/components/command";
import { LoaderOne } from "@/components/ui/loader";
import type { RecommendationItem } from "./recommendation-engine";
import { cn } from "@/lib/utils";

interface RecommendationsListProps {
  className?: string;
  title?: string;
  loading?: boolean;
  error: string | null;
  recommendations: RecommendationItem[];
}

export function RecommendationsList({
  className = "",
  recommendations = [],
  loading,
  error,
}: RecommendationsListProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "tab":
        return "🔗";
      case "bookmark":
        return "⭐";
      case "history":
        return "🕒";
      default:
        return "📄";
    }
  };

  // 按类型分组推荐
  const groupedRecommendations = {
    tabs: recommendations.filter((item) => item.type === "tab"),
    bookmarks: recommendations.filter((item) => item.type === "bookmark"),
    history: recommendations.filter((item) => item.type === "history"),
  };

  if (loading) {
    return (
      <Command.List className={cn(className, "recommendations-list")}>
        <div className="flex items-center justify-center py-8">
          <LoaderOne />
        </div>
      </Command.List>
    );
  }

  if (error) {
    return (
      <Command.List className={cn(className, "recommendations-list")}>
        <Command.Empty className="py-6 text-center text-sm">获取推荐内容时出错: {error}</Command.Empty>
      </Command.List>
    );
  }

  // if (recommendations.length === 0) {
  //   return (
  //     <Command.List className={cn(className, "recommendations-list")}>
  //       <Command.Empty className="py-6 text-center text-sm">{emptyMessage}</Command.Empty>
  //     </Command.List>
  //   );
  // }

  return (
    <Command.List className={cn(className, "recommendations-list")}>
      {/* 推荐标签页组 */}
      {groupedRecommendations.tabs.length > 0 && (
        <Command.Group heading="推荐的标签页">
          {groupedRecommendations.tabs.map((item) => (
            <Command.Item
              key={item.id}
              value={item.id}
              type="recommendation"
              className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer first:mt-[8px] last:mb-1"
            >
              <div className="flex-shrink-0">
                {item.favicon ? (
                  <img
                    src={item.favicon}
                    alt=""
                    className="w-4 h-4"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = getTypeIcon(item.type);
                      }
                    }}
                  />
                ) : (
                  <span className="text-sm">{getTypeIcon(item.type)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.title}</div>
                {item.reason && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.reason}</div>}
                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.url}</div>
              </div>
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {/* 推荐书签组 */}
      {groupedRecommendations.bookmarks.length > 0 && (
        <Command.Group heading="推荐的书签">
          {groupedRecommendations.bookmarks.map((item) => (
            <Command.Item
              key={item.id}
              value={item.id}
              type="recommendation"
              className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer first:mt-[8px] last:mb-1"
            >
              <div className="flex-shrink-0">
                {item.favicon ? (
                  <img
                    src={item.favicon}
                    alt=""
                    className="w-4 h-4"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = getTypeIcon(item.type);
                      }
                    }}
                  />
                ) : (
                  <span className="text-sm">{getTypeIcon(item.type)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.title}</div>
                {item.reason && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.reason}</div>}
                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.url}</div>
              </div>
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {/* 推荐历史记录组 */}
      {groupedRecommendations.history.length > 0 && (
        <Command.Group heading="推荐的历史记录">
          {groupedRecommendations.history.map((item) => (
            <Command.Item
              key={item.id}
              value={item.id}
              type="recommendation"
              className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer first:mt-[8px] last:mb-1"
            >
              <div className="flex-shrink-0">
                {item.favicon ? (
                  <img
                    src={item.favicon}
                    alt=""
                    className="w-4 h-4"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = getTypeIcon(item.type);
                      }
                    }}
                  />
                ) : (
                  <span className="text-sm">{getTypeIcon(item.type)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.title}</div>
                {item.reason && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.reason}</div>}
                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.url}</div>
              </div>
            </Command.Item>
          ))}
        </Command.Group>
      )}
    </Command.List>
  );
}
