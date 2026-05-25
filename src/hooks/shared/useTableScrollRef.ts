import { createContext, useContext, type RefObject } from 'react';

type TableScrollRef = RefObject<HTMLDivElement>;

const TableScrollContext = createContext<TableScrollRef | null>(null);

export function useTableScrollRef(): TableScrollRef | null {
  return useContext(TableScrollContext);
}

export { TableScrollContext, type TableScrollRef };
