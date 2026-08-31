import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { Delivery } from "../types";
import { StatusBadge } from "../StatusBadge";

export default function RiderPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Per-delivery action state
  const [pickingUp, setPickingUp] = useState<Record<number, boolean>>({});
  const [pickupError, setPickupError] = useState<Record<number, string>>({});
  const [confirming, setConfirming] = useState<Record<number, boolean>>({});
  const [confirmCode, setConfirmCode] = useState<Record<number, string>>({});
  const [confirmError, setConfirmError] = useState<Record<number, string>>({});
  const [confirmSuccess, setConfirmSuccess] = useState<Record<number, boolean>>({});

  // QR scanner
  const [scanningFor, setScanningFor] = useState<number | null>(null);
  const scannerRef = useRef<unknown>(null);
  const scannerDivRef = useRef<HTMLDivElement | null>(null);

  async function fetchDeliveries() {
    try {
      const data = await api.get<Delivery[]>("/deliveries/mine");
      setDeliveries(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load deliveries");
    }
  }

  useEffect(() => {
    fetchDeliveries();
    const interval = setInterval(fetchDeliveries, 5000);
    return () => clearInterval(interval);
  }, []);

  // Start QR scanner for a delivery
  useEffect(() => {
    if (scanningFor === null) return;

    let html5QrCode: unknown = null;

    async function startScanner() {
      try {
        // Dynamically import html5-qrcode to avoid SSR issues
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("qr-reader");
        html5QrCode = scanner;
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (decodedText: string) => {
            setConfirmCode((prev) => ({ ...prev, [scanningFor]: decodedText }));
            scanner.stop().catch(() => {});
            setScanningFor(null);
          },
          undefined
        );
      } catch {
        // Camera not available — fall back to manual entry silently
        setScanningFor(null);
      }
    }

    startScanner();

    return () => {
      if (html5QrCode) {
        (html5QrCode as { stop: () => Promise<void> }).stop().catch(() => {});
      }
    };
  }, [scanningFor]);

  async function handlePickUp(deliveryId: number) {
    setPickingUp((prev) => ({ ...prev, [deliveryId]: true }));
    setPickupError((prev) => ({ ...prev, [deliveryId]: "" }));
    try {
      await api.patch(`/deliveries/${deliveryId}/status`, { status: "picked_up" });
      await fetchDeliveries();
    } catch (err: unknown) {
      setPickupError((prev) => ({
        ...prev,
        [deliveryId]: err instanceof Error ? err.message : "Failed to update status",
      }));
    } finally {
      setPickingUp((prev) => ({ ...prev, [deliveryId]: false }));
    }
  }

  async function handleConfirm(deliveryId: number) {
    const code = confirmCode[deliveryId]?.trim();
    if (!code) return;
    setConfirming((prev) => ({ ...prev, [deliveryId]: true }));
    setConfirmError((prev) => ({ ...prev, [deliveryId]: "" }));
    try {
      await api.post(`/deliveries/${deliveryId}/confirm`, { scanned_code: code });
      setConfirmSuccess((prev) => ({ ...prev, [deliveryId]: true }));
      await fetchDeliveries();
    } catch (err: unknown) {
      setConfirmError((prev) => ({
        ...prev,
        [deliveryId]: err instanceof Error ? err.message : "Confirmation failed",
      }));
    } finally {
      setConfirming((prev) => ({ ...prev, [deliveryId]: false }));
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.logo}>Reflex</span>
        <span style={styles.roleTag}>Rider</span>
        <button onClick={handleLogout} style={styles.logoutBtn}>Sign out</button>
      </header>

      <main style={styles.main}>
        <h2 style={styles.heading}>My Deliveries</h2>
        {error && <p style={styles.error}>{error}</p>}

        {deliveries.length === 0 ? (
          <p style={styles.empty}>No deliveries assigned to you.</p>
        ) : (
          <div style={styles.list}>
            {deliveries.map((d) => (
              <div key={d.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <div>
                    <strong>{d.customer_name}</strong>
                    <span style={styles.phone}>{d.customer_phone}</span>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
                <p style={styles.detail}><strong>Address:</strong> {d.address}</p>
                <p style={styles.detail}><strong>Item:</strong> {d.item_description}</p>

                {/* Mark Picked Up */}
                {d.status === "assigned" && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      style={styles.actionBtn}
                      onClick={() => handlePickUp(d.id)}
                      disabled={pickingUp[d.id]}
                    >
                      {pickingUp[d.id] ? "Updating…" : "Mark Picked Up"}
                    </button>
                    {pickupError[d.id] && <p style={styles.error}>{pickupError[d.id]}</p>}
                  </div>
                )}

                {/* Confirm delivery */}
                {d.status === "picked_up" && !confirmSuccess[d.id] && (
                  <div style={{ marginTop: 14 }}>
                    {/* QR scanner target */}
                    {scanningFor === d.id && (
                      <div
                        id="qr-reader"
                        ref={scannerDivRef}
                        style={{ width: "100%", maxWidth: 300, marginBottom: 10 }}
                      />
                    )}

                    <div style={styles.scanRow}>
                      <input
                        style={styles.codeInput}
                        placeholder="Enter confirmation code"
                        value={confirmCode[d.id] ?? ""}
                        onChange={(e) =>
                          setConfirmCode((prev) => ({ ...prev, [d.id]: e.target.value }))
                        }
                      />
                      <button
                        style={styles.scanBtn}
                        onClick={() => setScanningFor(scanningFor === d.id ? null : d.id)}
                      >
                        {scanningFor === d.id ? "Stop Scan" : "Scan QR"}
                      </button>
                    </div>

                    <button
                      style={{ ...styles.actionBtn, background: "#15803d", marginTop: 8 }}
                      onClick={() => handleConfirm(d.id)}
                      disabled={confirming[d.id] || !confirmCode[d.id]?.trim()}
                    >
                      {confirming[d.id] ? "Confirming…" : "Confirm Delivery"}
                    </button>
                    {confirmError[d.id] && <p style={styles.error}>{confirmError[d.id]}</p>}
                  </div>
                )}

                {confirmSuccess[d.id] && (
                  <p style={{ color: "#15803d", fontWeight: 600, marginTop: 10 }}>
                    ✓ Delivery confirmed
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f3f4f6", fontFamily: "system-ui, sans-serif" },
  header: { background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 },
  logo: { fontWeight: 700, fontSize: 18, color: "#111827" },
  roleTag: { background: "#f0fdf4", color: "#15803d", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 600 },
  logoutBtn: { marginLeft: "auto", border: "none", background: "none", color: "#6b7280", cursor: "pointer", fontSize: 13 },
  main: { maxWidth: 600, margin: "0 auto", padding: "28px 20px" },
  heading: { margin: "0 0 20px", fontSize: 22, fontWeight: 700 },
  empty: { color: "#9ca3af", fontSize: 14 },
  list: { display: "flex", flexDirection: "column", gap: 14 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 18px" },
  cardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  phone: { color: "#6b7280", marginLeft: 8, fontSize: 13 },
  detail: { margin: "2px 0", fontSize: 13, color: "#374151" },
  actionBtn: { background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, padding: "9px 20px", fontWeight: 600, cursor: "pointer", fontSize: 14 },
  scanRow: { display: "flex", gap: 8, alignItems: "center" },
  codeInput: { flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14 },
  scanBtn: { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  error: { color: "#dc2626", fontSize: 13, margin: "4px 0 0" },
};
