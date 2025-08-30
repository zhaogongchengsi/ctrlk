// Command components export
export {
  CommandRoot,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  type CommandRootProps,
  type CommandGroupProps,
  type CommandItemProps,
} from './command';

// Compound component for convenience
export const Command = {
  Root: CommandRoot,
  Input: CommandInput,
  List: CommandList,
  Empty: CommandEmpty,
  Group: CommandGroup,
  Item: CommandItem,
  Separator: CommandSeparator,
} as const;

import {
  CommandRoot,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from './command';
