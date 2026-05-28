import { type ReactNode } from 'react';

interface CompactRowGridProps {
  children: ReactNode;
}

interface GridCellProps {
  label: string;
  children: ReactNode;
}

export function CompactRowGrid({ children }: CompactRowGridProps) {
  return <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">{children}</div>;
}

export function GridCell({ label, children }: GridCellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="catalog-layout-label">{label}</p>
      {children}
    </div>
  );
}
