import { type ReactNode } from 'react';

interface CompactRowGridProps {
  children: ReactNode;
}

interface GridCellProps {
  label: string;
  children: ReactNode;
}

export function CompactRowGrid({ children }: CompactRowGridProps) {
  return <div className="catalog-layout-compact-grid">{children}</div>;
}

export function GridCell({ label, children }: GridCellProps) {
  return (
    <div className="catalog-layout-option-row catalog-layout-option-row--stacked">
      <p className="catalog-layout-label">{label}</p>
      {children}
    </div>
  );
}
