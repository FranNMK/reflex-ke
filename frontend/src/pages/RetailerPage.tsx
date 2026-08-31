import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { Delivery, Product } from "../types";
import { StatusBadge } from "../StatusBadge";

// ── Confirmation code display ─────────────────────────────────────────────────
function ConfirmationCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginTop: 4 }}>
      <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, letterSpacing: 2, color: "#1d4ed8" }}>
        {code}
      </span>{" "}
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid #d1d5db", cursor: "pointer", background: "#f9fafb" }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

// ── Category badge ────────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  Electronics: "#1d4ed8", Pharmacy: "#15803d", Hardware: "#b45309",
  Grocery: "#7c3aed", Clothing: "#be185d", General: "#6b7280",
};
function CatBadge({ cat }: { cat: string }) {
  return (
    <span style={{ background: CAT_COLORS[cat] ?? "#6b7280", color: "#fff", borderRadius: 10, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>
      {cat}
    </span>
  );
}

// ── Stock tab ─────────────────────────────────────────────────────────────────
function StockTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("0");
  const [saving, setSaving] = useState(false);

  async function fetchProducts() {
    try {
      const data = await api.get<Product[]>("/products");
      setProducts(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load stock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchProducts(); }, []);

  function openAdd() {
    setEditId(null); setName(""); setCategory("General");
    setDescription(""); setPrice(""); setQty("0"); setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditId(p.id); setName(p.name); setCategory(p.category);
    setDescription(p.description ?? ""); setPrice(p.price?.toString() ?? "");
    setQty(p.stock_qty.toString()); setShowForm(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    const body = { name, category, description, price: price ? parseFloat(price) : null, stock_qty: parseInt(qty) || 0 };
    try {
      if (editId) {
        await api.patch(`/products/${editId}`, body);
      } else {
        await api.post("/products", body);
      }
      setShowForm(false); fetchProducts();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Remove this product from stock?")) return;
    try {
      await api.patch(`/products/${id}`, { stock_qty: 0 }); // soft-zero or hard delete
      // Hard delete — call DELETE endpoint
      await fetch(`/api/products/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("reflex_token")}` } });
      fetchProducts();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Delete failed"); }
  }

  const categories = ["Electronics", "Pharmacy", "Hardware", "Grocery", "Clothing", "General"];

  // Group by category
  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p); return acc;
  }, {});

  return (
    <div>
      <div style={S.topRow}>
        <h2 style={S.heading}>Stock Catalogue</h2>
        <button onClick={openAdd} style={S.primaryBtn}>+ Add Product</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} style={S.form}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>{editId ? "Edit Product" : "Add Product to Stock"}</h3>
          <div style={S.fieldRow}>
            <div style={S.field}>
              <label style={S.label}>Product name *</label>
              <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Samsung Galaxy A15" required />
            </div>
            <div style={S.field}>
              <label style={S.label}>Category</label>
              <select style={S.input} value={category} onChange={e => setCategory(e.target.value)}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <label style={S.label}>Description (optional)</label>
          <input style={S.input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief product details…" />
          <div style={S.fieldRow}>
            <div style={S.field}>
              <label style={S.label}>Price (KES)</label>
              <input style={S.input} type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 5999" />
            </div>
            <div style={S.field}>
              <label style={S.label}>Stock quantity *</label>
              <input style={S.input} type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} required />
            </div>
          </div>
          {error && <p style={S.error}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={saving} style={S.primaryBtn}>{saving ? "Saving…" : editId ? "Save Changes" : "Add to Stock"}</button>
            <button type="button" onClick={() => setShowForm(false)} style={S.ghostBtn}>Cancel</button>
          </div>
        </form>
      )}

      {!showForm && error && <p style={S.error}>{error}</p>}

      {loading ? <p style={{ color: "#6b7280", marginTop: 20 }}>Loading stock…</p>
        : products.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
            <div style={{ fontSize: 40 }}>📦</div>
            <p style={{ marginTop: 12 }}>No products in stock yet.<br />Click <strong>+ Add Product</strong> to get started.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <CatBadge cat={cat} />
                <span style={{ color: "#6b7280", fontSize: 13 }}>{items.length} item{items.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 12 }}>
                {items.map(p => (
                  <div key={p.id} style={{ ...S.card, position: "relative" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{p.description}</div>}
                    <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 6 }}>
                      {p.price != null && (
                        <span style={{ fontWeight: 700, color: "#1d4ed8", fontSize: 14 }}>KES {Number(p.price).toLocaleString()}</span>
                      )}
                      <span style={{ fontSize: 12, background: p.stock_qty === 0 ? "#fef2f2" : "#f0fdf4", color: p.stock_qty === 0 ? "#dc2626" : "#15803d", borderRadius: 8, padding: "2px 8px", fontWeight: 600 }}>
                        {p.stock_qty === 0 ? "Out of stock" : `Qty: ${p.stock_qty}`}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={() => openEdit(p)} style={{ ...S.ghostBtn, fontSize: 12, padding: "4px 12px" }}>Edit</button>
                      <button onClick={() => handleDelete(p.id)} style={{ ...S.ghostBtn, fontSize: 12, padding: "4px 12px", color: "#dc2626", borderColor: "#fca5a5" }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
    </div>
  );
}

// ── Deliveries tab ────────────────────────────────────────────────────────────
function DeliveriesTab() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [deliveryQty, setDeliveryQty] = useState<number>(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function fetchDeliveries() {
    try { setDeliveries(await api.get<Delivery[]>("/deliveries")); setError(null); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load deliveries"); }
  }

  async function fetchProducts() {
    try { setProducts(await api.get<Product[]>("/products")); }
    catch { /* non-critical */ }
  }

  useEffect(() => {
    fetchDeliveries(); fetchProducts();
    const iv = setInterval(fetchDeliveries, 5000);
    return () => clearInterval(iv);
  }, []);

  // When a product is picked, pre-fill description and reset qty to 1
  function handleProductSelect(id: string) {
    setSelectedProductId(id);
    if (id) {
      const p = products.find(p => p.id === parseInt(id));
      if (p) {
        setSelectedProduct(p);
        setDeliveryQty(1);
        buildDescription(p, 1);
      }
    } else {
      setSelectedProduct(null);
      setDeliveryQty(1);
    }
  }

  function buildDescription(p: Product, qty: number) {
    const qtyLabel = qty > 1 ? `x${qty} ` : "";
    const priceLabel = p.price ? ` — KES ${Number(p.price * qty).toLocaleString()}` : "";
    setItemDescription(`${qtyLabel}${p.name}${p.description ? " — " + p.description : ""}${priceLabel}`);
  }

  function handleQtyChange(val: number) {
    const max = selectedProduct?.stock_qty ?? 999;
    const clamped = Math.max(1, Math.min(val, max));
    setDeliveryQty(clamped);
    if (selectedProduct) buildDescription(selectedProduct, clamped);
  }

  async function handleNewDelivery(e: FormEvent) {
    e.preventDefault(); setFormError(null); setSubmitting(true);
    try {
      await api.post("/deliveries", { customer_name: customerName, customer_phone: customerPhone, address, item_description: itemDescription });
      setCustomerName(""); setCustomerPhone(""); setAddress(""); setItemDescription("");
      setSelectedProductId(""); setSelectedProduct(null); setDeliveryQty(1); setShowForm(false);
      fetchDeliveries();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to create delivery");
    } finally { setSubmitting(false); }
  }

  return (
    <div>
      <div style={S.topRow}>
        <h2 style={S.heading}>Deliveries</h2>
        <button onClick={() => setShowForm(v => !v)} style={S.primaryBtn}>{showForm ? "Cancel" : "+ New Delivery"}</button>
      </div>

      {showForm && (
        <form onSubmit={handleNewDelivery} style={S.form}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>New Delivery Request</h3>

          {/* Product picker */}
          <label style={S.label}>Pick from stock (optional)</label>
          <select style={{ ...S.input, marginBottom: 2 }} value={selectedProductId} onChange={e => handleProductSelect(e.target.value)}>
            <option value="">— Select a product from stock —</option>
            {products.filter(p => p.stock_qty > 0).map(p => (
              <option key={p.id} value={p.id}>
                [{p.category}] {p.name}{p.price ? ` — KES ${Number(p.price).toLocaleString()}` : ""} (Qty: {p.stock_qty})
              </option>
            ))}
          </select>

          {/* Quantity selector — only shown when a product is selected */}
          {selectedProduct && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "10px 14px", marginBottom: 2 }}>
              <span style={{ fontSize: 13, color: "#0369a1", fontWeight: 600 }}>📦 {selectedProduct.name}</span>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Qty:</label>
                <button type="button" onClick={() => handleQtyChange(deliveryQty - 1)}
                  style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", lineHeight: 1 }}>−</button>
                <input
                  type="number" min={1} max={selectedProduct.stock_qty}
                  value={deliveryQty}
                  onChange={e => handleQtyChange(parseInt(e.target.value) || 1)}
                  style={{ width: 56, textAlign: "center", padding: "5px 4px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 15, fontWeight: 700 }}
                />
                <button type="button" onClick={() => handleQtyChange(deliveryQty + 1)}
                  style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", lineHeight: 1 }}>+</button>
                <span style={{ fontSize: 12, color: "#6b7280" }}>/ {selectedProduct.stock_qty} in stock</span>
              </div>
              {selectedProduct.price && (
                <span style={{ fontWeight: 700, color: "#1d4ed8", fontSize: 14, marginLeft: 8 }}>
                  KES {Number(selectedProduct.price * deliveryQty).toLocaleString()}
                </span>
              )}
            </div>
          )}

          <p style={{ margin: "0 0 10px", fontSize: 11, color: "#9ca3af" }}>Choosing a product fills the description automatically. You can still edit it below.</p>

          <div style={S.fieldRow}>
            <div style={S.field}>
              <label style={S.label}>Customer name *</label>
              <input style={S.input} value={customerName} onChange={e => setCustomerName(e.target.value)} required />
            </div>
            <div style={S.field}>
              <label style={S.label}>Customer phone *</label>
              <input style={S.input} type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} required />
            </div>
          </div>
          <label style={S.label}>Delivery address *</label>
          <input style={S.input} value={address} onChange={e => setAddress(e.target.value)} required />
          <label style={S.label}>Item description *</label>
          <textarea style={{ ...S.input, resize: "vertical", minHeight: 58 }} value={itemDescription} onChange={e => setItemDescription(e.target.value)} required />
          {formError && <p style={S.error}>{formError}</p>}
          <button type="submit" disabled={submitting} style={S.primaryBtn}>{submitting ? "Submitting…" : "Submit Delivery Request"}</button>
        </form>
      )}

      {error && <p style={S.error}>{error}</p>}

      {deliveries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
          <div style={{ fontSize: 40 }}>🚚</div>
          <p style={{ marginTop: 12 }}>No deliveries yet. Click <strong>+ New Delivery</strong> to log one.</p>
        </div>
      ) : (
        <div style={S.list}>
          {deliveries.map(d => (
            <div key={d.id} style={S.card}>
              <div style={S.cardTop}>
                <div>
                  <strong>{d.customer_name}</strong>
                  <span style={{ color: "#6b7280", marginLeft: 8, fontSize: 13 }}>{d.customer_phone}</span>
                </div>
                <StatusBadge status={d.status} />
              </div>
              <p style={S.cardDetail}>📍 {d.address}</p>
              <p style={S.cardDetail}>📦 {d.item_description}</p>
              <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                Confirmation code (share with customer):
                <ConfirmationCodeDisplay code={d.confirmation_code} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main RetailerPage ─────────────────────────────────────────────────────────
export default function RetailerPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"stock" | "deliveries">("stock");

  return (
    <div style={S.page}>
      <header style={S.header}>
        <img src="/logo.png" alt="Reflex" style={{ height: 34 }} />
        <span style={S.roleTag}>Retailer Staff</span>
        <button onClick={() => { logout(); navigate("/login"); }} style={S.logoutBtn}>Sign out</button>
      </header>

      {/* Tab bar */}
      <div style={S.tabBar}>
        <button onClick={() => setTab("stock")} style={tab === "stock" ? S.tabActive : S.tabInactive}>
          📦 Stock
        </button>
        <button onClick={() => setTab("deliveries")} style={tab === "deliveries" ? S.tabActive : S.tabInactive}>
          🚚 Deliveries
        </button>
      </div>

      <main style={S.main}>
        {tab === "stock" ? <StockTab /> : <DeliveriesTab />}
      </main>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f3f4f6", fontFamily: "system-ui, sans-serif" },
  header: { background: "#1a2235", padding: "10px 24px", display: "flex", alignItems: "center", gap: 12 },
  roleTag: { background: "#eff6ff", color: "#1d4ed8", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 600 },
  logoutBtn: { marginLeft: "auto", border: "none", background: "none", color: "#a8c0e0", cursor: "pointer", fontSize: 13 },
  tabBar: { background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px", display: "flex", gap: 4 },
  tabActive: { padding: "12px 20px", border: "none", borderBottom: "3px solid #1d4ed8", background: "none", fontWeight: 700, fontSize: 14, color: "#1d4ed8", cursor: "pointer" },
  tabInactive: { padding: "12px 20px", border: "none", borderBottom: "3px solid transparent", background: "none", fontWeight: 500, fontSize: 14, color: "#6b7280", cursor: "pointer" },
  main: { maxWidth: 900, margin: "0 auto", padding: "28px 20px" },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  heading: { margin: 0, fontSize: 22, fontWeight: 700 },
  primaryBtn: { background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 7, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 14 },
  ghostBtn: { background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 7, padding: "9px 14px", fontWeight: 500, cursor: "pointer", fontSize: 14 },
  form: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 10 },
  fieldRow: { display: "flex", gap: 12 },
  field: { flex: 1, display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: "#374151" },
  input: { padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box", width: "100%" },
  error: { color: "#dc2626", fontSize: 13 },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 18px" },
  cardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardDetail: { margin: "2px 0", fontSize: 13, color: "#374151" },
};
