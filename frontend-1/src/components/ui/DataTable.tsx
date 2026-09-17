import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  emptyMessage?: string;
  dense?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  isRowSelected,
  emptyMessage = 'No data available',
  dense,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.align !== 'right' && col.align !== 'center' && 'text-left',
                  col.width
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center text-text-muted text-sm"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => {
              const isSelected = isRowSelected?.(row);
              return (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-border-subtle transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-bg-hover',
                    isSelected && 'bg-accent/20 border-l-4 border-l-accent',
                    dense ? 'px-2 py-1.5' : 'px-3 py-2.5'
                  )}
                >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      dense ? 'px-2 py-1.5' : 'px-3 py-2.5',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      'text-text-secondary'
                    )}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? 'N/A')}
                  </td>
                ))}
              </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
