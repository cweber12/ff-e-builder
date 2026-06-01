import type { HTMLAttributes } from 'react';
import { cn } from '../../../lib/utils';

type SidebarFieldGroupProps = HTMLAttributes<HTMLDivElement>;

export function SidebarFieldGroup({ className, ...props }: SidebarFieldGroupProps) {
  return (
    <div className={cn('project-sidebar-slot project-sidebar-field-group', className)} {...props} />
  );
}
