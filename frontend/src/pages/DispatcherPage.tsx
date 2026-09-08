import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { Delivery, UserOut } from "../types";
import { StatusBadge } from "../StatusBadge";

type Tab = "open" | "inprogress" | "delivered" | "riders";

interface RiderCreated extends UserOut {
  temp_password: string;
}

export default function DispatcherPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // ── Deliveries state ───────────────────────────────────────────────────────
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [riders, setRiders] = useState<UserOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<Record<number, boolean>>({});
  const [selectedRider, setSelectedRider] = useState<Record<number, string>>({});
  const [assignError, setAssignError] = useState<Record<number, string>>({});

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("open");

  // ── Add Rider form state ───────────────────────────────────────────────────
  const [newRiderName, setNewRiderName] = useState("");
  const [newRiderPhone, setNewRiderPhone] = useState("");
  const [addingRider, setAddingRider] = useState(false);
  const [addRiderError, setAddRiderError] = useState<string | null>(null);
  const [addRiderSuccess, setAddRiderSuccess] = useState<{ name: string; temp_password: string } | null>(null);
  const [addRiderCopied, setAddRiderCopied] = useState(false);

  // ── Edit/Delete state ──────────────────────────────────────────────────────
  const [editingRiderId, setEditingRiderId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingRider, setSavingRider] = useState(false);
  const [resetPasswordResult, setResetPasswordResult] = useState<Record<number, string>>({});
  const [resettingPassword, setResettingPassword] = useState(false);
  const [riderActionError, setRiderActionError] = useState<Record<number, string>>({});
  const [deletingRiderId, setDeletingRiderId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
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

  // ── Delivery assignment ────────────────────────────────────────────────────
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

  // ── Add Rider ──────────────────────────────────────────────────────────────
  async function handleAddRider(e: FormEvent) {
    e.preventDefault();
    setAddRiderError(null);
    setAddRiderSuccess(null);
    setAddRiderCopied(false);
    setAddingRider(true);
    try {
      const result = await api.post<RiderCreated>("/users/riders", {
        name: newRiderName.trim(),
        phone: newRiderPhone.trim(),
      });
      setAddRiderSuccess({ name: result.name, temp_password: result.temp_password });
      setNewRiderName("");
      setNewRiderPhone("");
      await fetchRiders();
    } catch (err: unknown) {
      setAddRiderError(err instanceof Error ? err.message : "Failed to add rider");
    } finally {
      setAddingRider(false);
    }
  }

  // ── Open edit form ─────────────────────────────────────────────────────────
  function openEdit(rider: UserOut) {
    setEditingRiderId(rider.id);
    setEditName(rider.name);
    setEditPhone(rider.phone);
    setResetPasswordResult((prev) => { const n = { ...prev }; delete n[rider.id]; return n; });
    setRiderActionError((prev) => { const n = { ...prev }; delete n[rider.id]; return n; });
    setCopied(false);
  }

  function closeEdit() {
    setEditingRiderId(null);
    setCopied(false);
  }

  // ── Save edit ──────────────────────────────────────────────────────────────
  async function handleSaveRider(riderId: number) {
    setSavingRider(true);
    setRiderActionError((prev) => ({ ...prev, [riderId]: "" }));
    try {
      await api.patch<UserOut>(`/users/riders/${riderId}`, {
        name: editName.trim(),
        phone: editPhone.trim(),
      });
      await fetchRiders();
      closeEdit();
    } catch (err: unknown) {
      setRiderActionError((prev) => ({
        ...prev,
        [riderId]: err instanceof Error ? err.message : "Failed to save",
      }));
    } finally {
      setSavingRider(false);
    }
  }

  // ── Reset password ─────────────────────────────────────────────────────────
  async function handleResetPassword(riderId: number) {
    setResettingPassword(true);
    setRiderActionError((prev) => ({ ...prev, [riderId]: "" }));
    setCopied(false);
    try {
      const result = await api.patch<RiderCreated>(`/users/riders/${riderId}`, {
        reset_password: true,
      });
      setResetPasswordResult((prev) => ({ ...prev, [riderId]: result.temp_password }));
    } catch (err: unknown) {
      setRiderActionError((prev) => ({
        ...prev,
        [riderId]: err instanceof Error ? err.message : "Failed to reset password",
      }));
    } finally {
      setResettingPassword(false);
    }
  }

  // ── Copy to clipboard ──────────────────────────────────────────────────────
  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Delete rider ───────────────────────────────────────────────────────────
  async function handleDeleteRider(rider: UserOut) {
    if (!window.confirm(`Remove ${rider.name}? This cannot be undone.`)) return;
    setDeletingRiderId(rider.id);
    setRiderActionError((prev) => ({ ...prev, [rider.id]: "" }));
    try {
      await api.delete<void>(`/users/riders/${rider.id}`);
      await fetchRiders();
    } catch (err: unknown) {
      setRiderActionError((prev) => ({
        ...prev,
        [rider.id]: err instanceof Error ? err.message : "Failed to delete rider",
      }));
    } finally {
      setDeletingRiderId(null);
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

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "open",       label: "Open Requests", count: requested.length },
    { id: "inprogress", label: "In Progress",   count: inProgress.length },
    { id: "delivered",  label: "Delivered",     count: delivered.length },
    { id: "riders",     label: "Riders",        count: riders.length },
  ];

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.logo}>Reflex</span>
        <span style={styles.roleTag}>Dispatcher</span>
        <button onClick={handleLogout} style={styles.logoutBtn}>Sign out</button>
      </header>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            style={{ ...styles.tabBtn, ...(activeTab === tab.id ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{ ...styles.tabCount, ...(activeTab === tab.id ? styles.tabCountActive : {}) }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <main style={styles.main}>
        {error && <p style={styles.error}>{error}</p>}

        {/* ── Open Requests ── */}
        {activeTab === "open" && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Open Requests <span style={styles.count}>{requested.length}</span></h2>
            {requested.length === 0 ? <p style={styles.empty}>No open requests.</p> : (
              <div style={styles.list}>
                {requested.map((d) => (
                  <div key={d.id} style={styles.card}>
                    <div style={styles.cardTop}>
                      <div><strong>{d.customer_name}</strong><span style={styles.phone}>{d.customer_phone}</span></div>
                      <StatusBadge status={d.status} />
                    </div>
                    <p style={styles.detail}>{d.address}</p>
                    <p style={styles.detail}>{d.item_description}</p>
                    <div style={styles.assignRow}>
                      <select
                        style={styles.select}
                        value={selectedRider[d.id] ?? ""}
                        onChange={(e) => setSelectedRider((prev) => ({ ...prev, [d.id]: e.target.value }))}
                      >
                        <option value="">— Select rider —</option>
                        {riders.map((r) => (
                          <option key={r.id} value={r.id}>{r.name} ({r.phone})</option>
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
                    {assignError[d.id] && <p style={styles.error}>{assignError[d.id]}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── In Progress ── */}
        {activeTab === "inprogress" && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>In Progress <span style={styles.count}>{inProgress.length}</span></h2>
            {inProgress.length === 0 ? <p style={styles.empty}>None in progress.</p> : (
              <div style={styles.list}>
                {inProgress.map((d) => (
                  <div key={d.id} style={{ ...styles.card, opacity: 0.85 }}>
                    <div style={styles.cardTop}>
                      <div><strong>{d.customer_name}</strong><span style={styles.phone}>{d.customer_phone}</span></div>
                      <StatusBadge status={d.status} />
                    </div>
                    <p style={styles.detail}>{d.address}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Delivered ── */}
        {activeTab === "delivered" && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              Delivered <span style={{ ...styles.count, background: "#d1fae5", color: "#15803d" }}>{delivered.length}</span>
            </h2>
            {delivered.length === 0 ? <p style={styles.empty}>None yet.</p> : (
              <div style={styles.list}>
                {delivered.map((d) => (
                  <div key={d.id} style={{ ...styles.card, opacity: 0.6 }}>
                    <div style={styles.cardTop}>
                      <div><strong>{d.customer_name}</strong><span style={styles.phone}>{d.customer_phone}</span></div>
                      <StatusBadge status={d.status} />
                    </div>
                    <p style={styles.detail}>{d.address}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Riders ── */}
        {activeTab === "riders" && (
          <section style={styles.section}>

            {/* Add Rider form */}
            <div style={styles.card}>
              <h3 style={styles.formTitle}>Add New Rider</h3>
              <form onSubmit={handleAddRider} style={styles.riderForm}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Full name</label>
                  <input style={styles.input} type="text" placeholder="e.g. John Kamau"
                    value={newRiderName}
                    onChange={(e) => { setNewRiderName(e.target.value); setAddRiderSuccess(null); }}
                    required />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Phone number</label>
                  <input style={styles.input} type="tel" placeholder="e.g. 0712345678"
                    value={newRiderPhone}
                    onChange={(e) => { setNewRiderPhone(e.target.value); setAddRiderSuccess(null); }}
                    required />
                </div>
                <button style={{ ...styles.primaryBtn, marginTop: 4 }} type="submit" disabled={addingRider}>
                  {addingRider ? "Adding…" : "Add Rider"}
                </button>
              </form>
              {addRiderError && <p style={{ ...styles.error, marginTop: 10 }}>{addRiderError}</p>}
              {addRiderSuccess && (
                <div style={styles.successBox}>
                  <strong>✓ Rider added: {addRiderSuccess.name}</strong>
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    Share this password with the rider:
                    <span style={styles.tempPassword}>{addRiderSuccess.temp_password}</span>
                    <button
                      style={styles.copyBtn}
                      onClick={() => {
                        navigator.clipboard.writeText(addRiderSuccess.temp_password).then(() => {
                          setAddRiderCopied(true);
                          setTimeout(() => setAddRiderCopied(false), 2000);
                        });
                      }}
                    >
                      {addRiderCopied ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, marginTop: 6, color: "#166534", opacity: 0.8 }}>
                    This password is shown once. The rider logs in with their phone number and this password.
                  </div>
                </div>
              )}
            </div>

            {/* Rider list */}
            <h2 style={{ ...styles.sectionTitle, marginTop: 28 }}>
              All Riders <span style={styles.count}>{riders.length}</span>
            </h2>
            {riders.length === 0 ? (
              <p style={styles.empty}>No riders yet. Add one above.</p>
            ) : (
              <div style={styles.list}>
                {riders.map((r) => (
                  <div key={r.id} style={styles.card}>

                    {/* ── Read view ── */}
                    {editingRiderId !== r.id ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <strong style={{ fontSize: 14 }}>{r.name}</strong>
                          <span style={styles.phone}>{r.phone}</span>
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          {riderActionError[r.id] && (
                            <span style={{ color: "#dc2626", fontSize: 12 }}>{riderActionError[r.id]}</span>
                          )}
                          <button style={styles.editBtn} onClick={() => openEdit(r)}>Edit</button>
                          <button
                            style={styles.deleteBtn}
                            disabled={deletingRiderId === r.id}
                            onClick={() => handleDeleteRider(r)}
                          >
                            {deletingRiderId === r.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Edit view ── */
                      <div>
                        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                          <div style={{ ...styles.fieldGroup, flex: 1 }}>
                            <label style={styles.label}>Name</label>
                            <input style={styles.input} type="text" value={editName}
                              onChange={(e) => setEditName(e.target.value)} />
                          </div>
                          <div style={{ ...styles.fieldGroup, flex: 1 }}>
                            <label style={styles.label}>Phone</label>
                            <input style={styles.input} type="tel" value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)} />
                          </div>
                        </div>

                        {/* Reset password */}
                        <div style={{ marginBottom: 10 }}>
                          <button
                            style={styles.resetBtn}
                            type="button"
                            disabled={resettingPassword}
                            onClick={() => handleResetPassword(r.id)}
                          >
                            {resettingPassword ? "Resetting…" : "Reset Password"}
                          </button>
                          {resetPasswordResult[r.id] && (
                            <div style={{ ...styles.successBox, marginTop: 8 }}>
                              New password:
                              <span style={styles.tempPassword}>{resetPasswordResult[r.id]}</span>
                              <button
                                style={styles.copyBtn}
                                onClick={() => handleCopy(resetPasswordResult[r.id])}
                              >
                                {copied ? "Copied ✓" : "Copy"}
                              </button>
                            </div>
                          )}
                        </div>

                        {riderActionError[r.id] && (
                          <p style={{ ...styles.error, marginBottom: 8 }}>{riderActionError[r.id]}</p>
                        )}

                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            style={styles.primaryBtn}
                            disabled={savingRider}
                            onClick={() => handleSaveRider(r.id)}
                          >
                            {savingRider ? "Saving…" : "Save"}
                          </button>
                          <button style={styles.cancelBtn} onClick={closeEdit}>Cancel</button>
                        </div>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:       { minHeight: "100vh", background: "#f3f4f6", fontFamily: "system-ui, sans-serif" },
  header:     { background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 },
  logo:       { fontWeight: 700, fontSize: 18, color: "#111827" },
  roleTag:    { background: "#fef3c7", color: "#92400e", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 600 },
  logoutBtn:  { marginLeft: "auto", border: "none", background: "none", color: "#6b7280", cursor: "pointer", fontSize: 13 },

  tabBar:          { background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", padding: "0 24px" },
  tabBtn:          { background: "none", border: "none", borderBottom: "2px solid transparent", padding: "12px 18px", fontSize: 14, fontWeight: 500, color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", gap: 7 },
  tabBtnActive:    { color: "#1d4ed8", borderBottomColor: "#1d4ed8", fontWeight: 600 },
  tabCount:        { background: "#f3f4f6", color: "#6b7280", borderRadius: 10, padding: "1px 7px", fontSize: 12, fontWeight: 600 },
  tabCountActive:  { background: "#e0e7ff", color: "#3730a3" },

  main:         { maxWidth: 860, margin: "0 auto", padding: "28px 20px" },
  section:      { marginBottom: 36 },
  sectionTitle: { fontSize: 18, fontWeight: 700, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 },
  count:        { background: "#e0e7ff", color: "#3730a3", borderRadius: 10, padding: "1px 9px", fontSize: 13, fontWeight: 600 },
  empty:        { color: "#9ca3af", fontSize: 14 },
  list:         { display: "flex", flexDirection: "column", gap: 12 },
  card:         { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 18px" },
  cardTop:      { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  phone:        { color: "#6b7280", marginLeft: 8, fontSize: 13 },
  detail:       { margin: "2px 0", fontSize: 13, color: "#374151" },
  assignRow:    { display: "flex", gap: 10, marginTop: 12, alignItems: "center" },
  select:       { flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 },
  error:        { color: "#dc2626", fontSize: 13, margin: "4px 0 0" },

  // Riders tab
  formTitle:   { fontSize: 15, fontWeight: 700, margin: "0 0 14px", color: "#111827" },
  riderForm:   { display: "flex", flexDirection: "column", gap: 12 },
  fieldGroup:  { display: "flex", flexDirection: "column", gap: 4 },
  label:       { fontSize: 13, fontWeight: 600, color: "#374151" },
  input:       { padding: "8px 12px", borderRadius: 7, border: "1px solid #d1d5db", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" },
  successBox:  { background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", borderRadius: 7, padding: "10px 14px", fontSize: 13 },
  tempPassword:{ display: "inline-block", marginLeft: 8, fontFamily: "monospace", fontWeight: 700, fontSize: 15, background: "#dcfce7", borderRadius: 4, padding: "1px 8px", letterSpacing: "0.05em" },

  // Buttons
  primaryBtn: { background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, padding: "7px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  assignBtn:  { background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, padding: "7px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  editBtn:    { background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "2px 0" },
  deleteBtn:  { background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "2px 0" },
  cancelBtn:  { background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 14px", fontWeight: 500, cursor: "pointer", fontSize: 13 },
  resetBtn:   { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 6, padding: "6px 14px", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  copyBtn:    { marginLeft: 10, background: "#166534", color: "#fff", border: "none", borderRadius: 5, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
};
