import * as React from "react";
import { Primitive } from "@radix-ui/react-primitive";
import { cn } from "@/lib/utils";

// ===========================================
// Context for managing command state
// ===========================================

interface CommandContextValue {
  // Selection state
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;

  // Items management
  items: Array<{
    ref: React.RefObject<HTMLElement | null>;
    value: string;
    disabled: boolean;
  }>;
  registerItem: (ref: React.RefObject<HTMLElement | null>, value: string, disabled: boolean) => number;
  unregisterItem: (ref: React.RefObject<HTMLElement | null>) => void;

  // Search state
  search: string;
  setSearch: (search: string) => void;

  // Selection handlers
  onSelect?: (value: string) => void;
  onValueChange?: (value: string) => void;
}

const CommandContext = React.createContext<CommandContextValue | null>(null);

const useCommandContext = () => {
  const context = React.useContext(CommandContext);
  if (!context) {
    throw new Error("Command components must be used within CommandRoot");
  }
  return context;
};

// ===========================================
// Command Root Component
// ===========================================

export interface CommandRootProps {
  value?: string;
  onValueChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  children?: React.ReactNode;
}

export const CommandRoot = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  Omit<React.ComponentPropsWithoutRef<typeof Primitive.div>, "onSelect"> & CommandRootProps
>(({ value = "", onValueChange, onSelect, children, className, ...props }, ref) => {
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const [search, setSearch] = React.useState(value);
  const [items, setItems] = React.useState<
    Array<{
      ref: React.RefObject<HTMLElement | null>;
      value: string;
      disabled: boolean;
    }>
  >([]);

  // Sync external value changes
  React.useEffect(() => {
    setSearch(value);
  }, [value]);

  // Notify external value changes
  React.useEffect(() => {
    onValueChange?.(search);
  }, [search, onValueChange]);

  // Register item
  const registerItem = React.useCallback(
    (ref: React.RefObject<HTMLElement | null>, value: string, disabled: boolean) => {
      const index = items.length;
      setItems((prev) => [...prev, { ref, value, disabled }]);
      return index;
    },
    [items.length],
  );

  // Unregister item
  const unregisterItem = React.useCallback(
    (ref: React.RefObject<HTMLElement | null>) => {
      setItems((prev) => {
        const newItems = prev.filter((item) => item.ref !== ref);
        // Adjust selected index if needed
        const newIndex = prev.findIndex((item) => item.ref === ref);
        if (newIndex !== -1 && newIndex <= selectedIndex) {
          setSelectedIndex((current) => Math.max(-1, current - 1));
        }
        return newItems;
      });
    },
    [selectedIndex],
  );

  // Keyboard navigation
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      const enabledItems = items.filter((item) => !item.disabled);

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          if (enabledItems.length === 0) return;

          const currentEnabledIndex = enabledItems.findIndex((item) => items.indexOf(item) === selectedIndex);
          const nextEnabledIndex = currentEnabledIndex < enabledItems.length - 1 ? currentEnabledIndex + 1 : 0;
          const nextIndex = items.indexOf(enabledItems[nextEnabledIndex]);
          setSelectedIndex(nextIndex);
          break;
        }

        case "ArrowUp": {
          event.preventDefault();
          if (enabledItems.length === 0) return;

          const currentEnabledIndex = enabledItems.findIndex((item) => items.indexOf(item) === selectedIndex);
          const prevEnabledIndex = currentEnabledIndex > 0 ? currentEnabledIndex - 1 : enabledItems.length - 1;
          const prevIndex = items.indexOf(enabledItems[prevEnabledIndex]);
          setSelectedIndex(prevIndex);
          break;
        }

        case "Enter": {
          event.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < items.length) {
            const selectedItem = items[selectedIndex];
            if (!selectedItem.disabled) {
              onSelect?.(selectedItem.value);
            }
          }
          break;
        }

        case "Escape": {
          event.preventDefault();
          setSelectedIndex(-1);
          break;
        }
      }
    },
    [items, selectedIndex, onSelect],
  );

  const contextValue: CommandContextValue = React.useMemo(
    () => ({
      selectedIndex,
      setSelectedIndex,
      items,
      registerItem,
      unregisterItem,
      search,
      setSearch,
      onSelect,
      onValueChange,
    }),
    [selectedIndex, items, registerItem, unregisterItem, search, onSelect, onValueChange],
  );

  return (
    <CommandContext.Provider value={contextValue}>
      <Primitive.div
        ref={ref}
        role="combobox"
        aria-expanded="true"
        aria-haspopup="listbox"
        onKeyDown={handleKeyDown}
        {...props}
        data-slot="command"
        className={cn("bg-[var(--gray2)] flex h-full w-full flex-col rounded-md ctrl-k-command", className)}
        {...props}
      >
        {children}
      </Primitive.div>
    </CommandContext.Provider>
  );
});

CommandRoot.displayName = "CommandRoot";

// ===========================================
// Command Input Component
// ===========================================

export const CommandInput = React.forwardRef<
  React.ElementRef<typeof Primitive.input>,
  React.ComponentPropsWithoutRef<typeof Primitive.input>
>(({ className, ...props }, ref) => {
  const { search, setSearch } = useCommandContext();

  return (
    <Primitive.input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      ref={ref}
      data-slot="command-input"
      className={cn("ctrlk-command-input", className)}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded="true"
      {...props}
    />
  );
});

CommandInput.displayName = "CommandInput";

// ===========================================
// Command List Component
// ===========================================

export const CommandList = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  React.ComponentPropsWithoutRef<typeof Primitive.div>
>(({ className, ...props }, ref) => {
  return (
    <Primitive.div
      data-slot="cmdk-command-list"
      className={cn("ctrlk-command-list", className)}
      ref={ref}
      role="listbox"
      {...props}
    />
  );
});

CommandList.displayName = "CommandList";

// ===========================================
// Command Empty Component
// ===========================================

export const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  React.ComponentPropsWithoutRef<typeof Primitive.div>
>(({ ...props }, ref) => {
  return (
    <Primitive.div
      ref={ref}
      data-slot="command-empty"
      className="py-12 text-center text-base text-gray-500 dark:text-gray-400 font-medium"
      {...props}
    />
  );
});

CommandEmpty.displayName = "CommandEmpty";

// ===========================================
// Command Group Component
// ===========================================

export interface CommandGroupProps {
  children?: React.ReactNode;
}

export const CommandGroup = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  React.ComponentPropsWithoutRef<typeof Primitive.div> & CommandGroupProps
>(({ className, children, ...props }, ref) => {
  return (
    <Primitive.div
      ref={ref}
      role="group"
      data-slot="command-group"
      className={cn(
        "text-foreground overflow-hidden [&_[cmdk-group-heading]]:px-[8px] [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:text-[var(--gray11)]",
        className,
      )}
      {...props}
    >
      {children}
    </Primitive.div>
  );
});

CommandGroup.displayName = "CommandGroup";

// ===========================================
// Command Item Component
// ===========================================

export interface CommandItemProps {
  value?: string;
  disabled?: boolean;
  onSelect?: (value: string) => void;
  children?: React.ReactNode;
}

export const CommandItem = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  Omit<React.ComponentPropsWithoutRef<typeof Primitive.div>, "onSelect"> & CommandItemProps
>(({ value = "", className, disabled = false, onSelect, children, ...props }, ref) => {
  const { selectedIndex, registerItem, unregisterItem, onSelect: contextOnSelect } = useCommandContext();

  const itemRef = React.useRef<HTMLDivElement>(null);
  const [itemIndex, setItemIndex] = React.useState(-1);

  // Combine refs
  React.useImperativeHandle(ref, () => itemRef.current!);

  // Register/unregister this item
  React.useEffect(() => {
    const index = registerItem(itemRef, value, disabled);
    setItemIndex(index);

    return () => {
      unregisterItem(itemRef);
    };
  }, [registerItem, unregisterItem, value, disabled]);

  const isSelected = selectedIndex === itemIndex;

  const handleClick = React.useCallback(() => {
    if (!disabled) {
      onSelect?.(value);
      contextOnSelect?.(value);
    }
  }, [disabled, value, onSelect, contextOnSelect]);

  const handleMouseEnter = React.useCallback(() => {
    if (!disabled) {
      // Optional: Update selection on mouse enter
      // setSelectedIndex(itemIndex);
    }
  }, [disabled]);

  return (
    <Primitive.div
      data-slot="command-item"
      className={cn(
        "data-[selected=true]:bg-[var(--gray4)] data-[selected=true]:text-[var(--gray12)] [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
      ref={itemRef}
      role="option"
      aria-disabled={Boolean(disabled)}
      aria-selected={Boolean(isSelected)}
      data-disabled={Boolean(disabled)}
      data-selected={Boolean(isSelected)}
      data-value={value}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {children}
    </Primitive.div>
  );
});

CommandItem.displayName = "CommandItem";

// ===========================================
// Command Separator Component
// ===========================================

export const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  React.ComponentPropsWithoutRef<typeof Primitive.div>
>(({ ...props }, ref) => {
  return <Primitive.div ref={ref} role="separator" {...props} />;
});

CommandSeparator.displayName = "CommandSeparator";
