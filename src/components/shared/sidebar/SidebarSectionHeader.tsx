import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../../lib/utils';

type SidebarSectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  meta?: ReactNode;
};

export function SidebarSectionHeader({
  label,
  meta = null,
  className,
  ...props
}: SidebarSectionHeaderProps) {
  return (
    <div className={cn('project-sidebar-section-header', className)} {...props}>
      <p className="project-sidebar-title">{label}</p>
      {meta ? <span className="project-sidebar-section-meta">{meta}</span> : null}
    </div>
  );
}
