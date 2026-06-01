import type { HTMLAttributes } from 'react';
import { cn } from '../../../lib/utils';

type SidebarDividerProps = HTMLAttributes<HTMLDivElement>;

export function SidebarDivider({ className, ...props }: SidebarDividerProps) {
  return <div aria-hidden="true" className={cn('project-sidebar-divider', className)} {...props} />;
}
