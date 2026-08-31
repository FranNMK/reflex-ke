import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { Delivery, UserOut } from "../types";
import { StatusBadge } from "../StatusBadge";

export default function DispatcherPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [riders, setRiders] = useState<UserOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<Record<number, boolean>>({});
  const [selectedRider, setSelectedRider] = useState<Record<number, string>>({});
  const [assignError, setAssignError] = useState<Record<number, string>>({});

  async function fetchDeliveries() {
    try {
      const data = await api.get<Delivery[]>("/deliveries");
      setDeliveries(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load deliveries");
    }
  }

  async function fetchRiders() {
    try {
      const data = await api.get<UserOut[]>("/users?role=rider");
      setRiders(data);
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    fetchDeliveries();
    fetchRiders();
    const interval = setInterval(fetchDeliveries, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleAssign(deliveryId: number) {
    const riderId = selectedRider[deliveryId];
    if (!riderId) return;
    setAssigning((prev) => ({ ...prev, [deliveryId]: true }));
    setAssignError((prev) => ({ ...prev, [deliveryId]: "" }));
    try {
      await api.patch(`/deliveries/${deliveryId}/assign`, { rider_id: Number(riderId) });
      await fetchDeliveries();
    } catch (err: unknown) {
      setAssignError((prev) => ({
        ...prev,
        [deliveryId]: err instanceof Error ? err.message : "Assignment failed",
      }));
    } finally {
      setAssigning((prev) => ({ ...prev, [deliveryId]: false }));
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const requested = deliveries.filter((d) => d.status === "requested");
  const inProgress = deliveries.filter(
    (d) => d.status === "assigned" || d.status === "picked_up"
  );
  const delivered = deliveries.filter((d) => d.status === "delivered");

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.logo}>Reflex</span>
        <span style={styles.roleTag}>Dispatcher</span>
        <button onClick={handleLogout} style={styles.logoutBtn}>Sign out</button>
      </header>

      <main style={styles.main}>
        {error && <p style={styles.error}>{error}</p>}

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            Open Requests
            <span style={styles.count}>{requested.length}</span>
          </h2>
          {requested.length === 0 ? (
            <p style={styles.empty}>No open requests.</p>
          ) : (
            <div style={styles.list}>
              {requested.map((d) => (
                <div key={d.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div>
                      <strong>{d.customer_name}</strong>
                      <span style={styles.phone}>{d.customer_phone}</span>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <p style={styles.detail}>{d.address}</p>
                  <p style={styles.detail}>{d.item_description}</p>
                  <div style={styles.assignRow}>
                    <select
                      style={styles.select}
                      value={selectedRider[d.id] ?? ""}
                      onChange={(e) =>
                        setSelectedRider((prev) => ({ ...prev, [d.id]: e.target.value }))
                      }
                    >
                      <option value="">— Select rider —</option>
                      {riders.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.phone})
                        </option>
                      ))}
                    </select>
                    <button
                      style={styles.assignBtn}
                      disabled={!selectedRider[d.id] || assigning[d.id]}
                      onClick={() => handleAssign(d.id)}
                    >
                      {assigning[d.id] ? "Assigning…" : "Assign"}
                    </button>
                  </div>
                  {assignError[d.id] && (
                    <p style={styles.error}>{assignError[d.id]}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            In Progress
            <span style={styles.count}>{inProgress.length}</span>
          </h2>
          {inProgress.length === 0 ? (
            <p style={styles.empty}>None in progress.</p>
          ) : (
            <div style={styles.list}>
              {inProgress.map((d) => (
                <div key={d.id} style={{ ...styles.card, opacity: 0.85 }}>
                  <div style={styles.cardTop}>
                    <div>
                      <strong>{d.customer_name}</strong>
                      <span style={styles.phone}>{d.customer_phone}</span>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <p style={styles.detail}>{d.address}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            Delivered
            <span style={{ ...styles.count, background: "#d1fae5", color: "#15803d" }}>
              {delivered.length}
            </span>
          </h2>
          {delivered.length === 0 ? (
            <p style={styles.empty}>None yet.</p>
          ) : (
            <div style={styles.list}>
              {delivered.map((d) => (
                <div key={d.id} style={{ ...styles.card, opacity: 0.6 }}>
                  <div style={styles.cardTop}>
                    <div>
                      <strong>{d.customer_name}</strong>
                      <span style={styles.phone}>{d.customer_phone}</span>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <p style={styles.detail}>{d.address}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f3f4f6", fontFamily: "system-ui, sans-serif" },
  header: { background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 },
  logo: { fontWeight: 700, fontSize: 18, color: "#111827" },
  roleTag: { background: "#fef3c7", color: "#92400e", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 600 },
  logoutBtn: { marginLeft: "auto", border: "none", background: "none", color: "#6b7280", cursor: "pointer", fontSize: 13 },
  main: { maxWidth: 860, margin: "0 auto", padding: "28px 20px" },
  section: { marginBottom: 36 },
  sectionTitle: { fontSize: 18, fontWeight: 700, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 },
  count: { background: "#e0e7ff", color: "#3730a3", borderRadius: 10, padding: "1px 9px", fontSize: 13, fontWeight: 600 },
  empty: { color: "#9ca3af", fontSize: 14 },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 18px" },
  cardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  phone: { color: "#6b7280", marginLeft: 8, fontSize: 13 },
  detail: { margin: "2px 0", fontSize: 13, color: "#374151" },
  assignRow: { display: "flex", gap: 10, marginTop: 12, alignItems: "center" },
  select: { flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 },
  assignBtn: { background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, padding: "7px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  error: { color: "#dc2626", fontSize: 13, margin: "4px 0 0" },
};
