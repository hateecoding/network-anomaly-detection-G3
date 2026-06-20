import { VisitorRequest } from "../data/presentationData";
import { DataColumn, DataTable } from "./DataTable";
import { StatusBadge } from "./StatusBadge";

type VisitorTableProps = {
  rows: VisitorRequest[];
};

const columns: DataColumn<VisitorRequest>[] = [
  {
    key: "ip",
    header: "IP / route",
    render: (row) => (
      <div>
        <strong>{row.ip}</strong>
        <span>{row.route}</span>
      </div>
    ),
  },
  {
    key: "method",
    header: "Method",
    render: (row) => row.method,
  },
  {
    key: "requests",
    header: "Requests",
    align: "right",
    render: (row) => row.requests,
  },
  {
    key: "reason",
    header: "Reason",
    render: (row) => row.reason,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge label={row.tone} tone={row.tone} />,
  },
  {
    key: "timestamp",
    header: "Time",
    render: (row) => row.timestamp,
  },
];

export function VisitorTable({ rows }: VisitorTableProps) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      rowClassName={(row) => `table-row-${row.tone}`}
    />
  );
}
