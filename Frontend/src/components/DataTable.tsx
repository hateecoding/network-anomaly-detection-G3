import { ReactNode } from "react";

export type DataColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "center" | "right";
};

type DataTableProps<T> = {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowClassName?: (row: T) => string;
  emptyState?: ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowClassName,
  emptyState,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <>{emptyState ?? null}</>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`table-align-${column.align ?? "left"}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={rowClassName ? rowClassName(row) : ""}>
              {columns.map((column) => (
                <td key={column.key} className={`table-align-${column.align ?? "left"}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
