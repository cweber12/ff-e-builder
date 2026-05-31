import type { HTMLAttributes } from 'react';
import { cn } from '../../../lib/utils';

type SidebarButtonGroupProps = HTMLAttributes<HTMLDivElement>;

export function SidebarButtonGroup({ className, ...props }: SidebarButtonGroupProps) {
  return <div className={cn('sidebar-button-group', className)} {...props} />;
}
