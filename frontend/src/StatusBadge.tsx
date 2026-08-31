export const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  assigned: "Assigned",
  picked_up: "Picked Up",
  delivered: "Delivered",
};

export const STATUS_COLORS: Record<string, string> = {
  requested: "#b45309",   // amber
  assigned: "#1d4ed8",    // blue
  picked_up: "#7c3aed",   // violet
  delivered: "#15803d",   // green
};

interface BadgeProps {
  status: string;
}

export function StatusBadge({ status }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        color: "#fff",
        background: STATUS_COLORS[status] ?? "#6b7280",
        letterSpacing: "0.02em",
      }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
