import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const BRAND = {
  navy: "#1a2235",
  blue: "#1a8cff",
  blueLight: "#e8f4ff",
  blueMid: "#0a6cd6",
  text: "#1a2235",
  muted: "#5a6a85",
  white: "#ffffff",
  bg: "#f5f8ff",
  border: "#dce8f7",
};

const features = [
  {
    icon: "📋",
    title: "Log Deliveries Instantly",
    desc: "Retailer staff capture customer name, phone, address and item description in seconds — no more WhatsApp threads.",
  },
  {
    icon: "🎯",
    title: "Dispatch with Precision",
    desc: "Dispatchers see every open request on one dashboard and assign riders in a single click. Status updates automatically.",
  },
  {
    icon: "🛵",
    title: "Riders Stay Focused",
    desc: "Riders only see their own deliveries. Mark picked up, then scan the customer's QR code to prove delivery — no ambiguity.",
  },
  {
    icon: "📡",
    title: "Live Status Visibility",
    desc: "The dashboard refreshes every 5 seconds. Retailers and dispatchers see Requested → Assigned → Picked Up → Delivered in real time.",
  },
  {
    icon: "🔐",
    title: "Proof of Delivery",
    desc: "Every completed delivery generates a server-verified confirmation record — scanned at the customer's door.",
  },
  {
    icon: "👥",
    title: "Role-Based Access",
    desc: "Staff, dispatchers and riders each see only what they need. JWT-secured, no password sharing.",
  },
];

const steps = [
  { role: "Retailer Staff", color: BRAND.blue, step: "1", action: "Logs delivery request → status: Requested" },
  { role: "Dispatcher", color: "#7c3aed", step: "2", action: "Assigns a rider → status: Assigned" },
  { role: "Rider", color: "#15803d", step: "3", action: "Collects parcel → status: Picked Up" },
  { role: "Rider", color: "#15803d", step: "4", action: "Scans QR at door → status: Delivered ✓" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { token, role } = useAuth();

  function handleGetStarted() {
    if (token) {
      if (role === "dispatcher") navigate("/dispatcher");
      else if (role === "rider") navigate("/rider");
      else navigate("/retailer");
    } else {
      navigate("/login");
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: BRAND.white, minHeight: "100vh", color: BRAND.text }}>

      {/* ── Nav ── */}
      <nav style={{ background: BRAND.navy, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>
        <img src="/logo.png" alt="Reflex" style={{ height: 38 }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {token ? (
            <button onClick={handleGetStarted} style={navBtn(BRAND.blue)}>
              Go to Dashboard →
            </button>
          ) : (
            <>
              <button onClick={() => navigate("/login")} style={navBtn("transparent", BRAND.white, true)}>
                Sign in
              </button>
              <button onClick={() => navigate("/login")} style={navBtn(BRAND.blue)}>
                Get Started
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ background: `linear-gradient(135deg, ${BRAND.navy} 0%, #1e3a6e 100%)`, padding: "80px 24px 90px", textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <img src="/logo.png" alt="Reflex" style={{ height: 90, marginBottom: 28 }} />
          <h1 style={{ color: BRAND.white, fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, margin: "0 0 18px", lineHeight: 1.15 }}>
            Delivery coordination,<br />
            <span style={{ color: BRAND.blue }}>built for Kenyan retailers.</span>
          </h1>
          <p style={{ color: "#a8c0e0", fontSize: "clamp(15px, 2.5vw, 19px)", margin: "0 auto 36px", maxWidth: 560, lineHeight: 1.7 }}>
            Replace WhatsApp chaos with a structured dispatch system. Log deliveries, assign riders, track status — all in one place.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={handleGetStarted} style={{ background: BRAND.blue, color: BRAND.white, border: "none", borderRadius: 8, padding: "14px 32px", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 18px rgba(26,140,255,0.4)" }}>
              {token ? "Go to Dashboard →" : "Start Now — It's Free"}
            </button>
            <a href="#how-it-works" style={{ background: "rgba(255,255,255,0.1)", color: BRAND.white, border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "14px 32px", fontSize: 16, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div style={{ background: BRAND.blue, padding: "18px 24px", display: "flex", justifyContent: "center", gap: "clamp(24px, 6vw, 80px)", flexWrap: "wrap" }}>
        {[["3 Roles", "Staff · Dispatcher · Rider"], ["5s Refresh", "Live status polling"], ["QR Verified", "Proof of delivery"], ["JWT Secured", "Role-based access"]].map(([val, label]) => (
          <div key={val} style={{ textAlign: "center" }}>
            <div style={{ color: BRAND.white, fontWeight: 800, fontSize: 20 }}>{val}</div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Features ── */}
      <section style={{ padding: "72px 24px", background: BRAND.bg }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 800, margin: "0 0 8px" }}>Everything your team needs</h2>
          <p style={{ textAlign: "center", color: BRAND.muted, marginBottom: 48, fontSize: 16 }}>Purpose-built for small shops running last-mile deliveries.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            {features.map((f) => (
              <div key={f.title} style={{ background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: "28px 24px", boxShadow: "0 2px 8px rgba(26,34,53,0.06)" }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700 }}>{f.title}</h3>
                <p style={{ margin: 0, color: BRAND.muted, fontSize: 14, lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" style={{ padding: "72px 24px", background: BRAND.white }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 800, margin: "0 0 8px" }}>How a delivery works</h2>
          <p style={{ textAlign: "center", color: BRAND.muted, marginBottom: 48, fontSize: 16 }}>Four steps. Three roles. Zero WhatsApp threads.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {steps.map((s) => (
              <div key={s.step} style={{ display: "flex", alignItems: "flex-start", gap: 18, background: BRAND.bg, border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: s.color, color: BRAND.white, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>{s.step}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: s.color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{s.role}</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{s.action}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: `linear-gradient(135deg, ${BRAND.navy} 0%, #1e3a6e 100%)`, padding: "72px 24px", textAlign: "center" }}>
        <img src="/logo.png" alt="Reflex" style={{ height: 60, marginBottom: 24 }} />
        <h2 style={{ color: BRAND.white, fontSize: "clamp(22px, 4vw, 36px)", fontWeight: 800, margin: "0 0 14px" }}>Ready to bring order to your deliveries?</h2>
        <p style={{ color: "#a8c0e0", fontSize: 17, margin: "0 auto 32px", maxWidth: 480, lineHeight: 1.65 }}>
          Sign in and start coordinating deliveries in minutes.
        </p>
        <button onClick={handleGetStarted} style={{ background: BRAND.blue, color: BRAND.white, border: "none", borderRadius: 8, padding: "15px 36px", fontSize: 17, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 18px rgba(26,140,255,0.4)" }}>
          {token ? "Go to Dashboard →" : "Get Started →"}
        </button>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: BRAND.navy, padding: "28px 24px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <img src="/logo.png" alt="Reflex" style={{ height: 32, marginBottom: 10 }} />
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: 0 }}>
          © {new Date().getFullYear()} Reflex · Delivery coordination for Kenyan retailers · FastAPI · React · TiDB Cloud
        </p>
      </footer>

    </div>
  );
}

function navBtn(bg: string, color = "#fff", outline = false): React.CSSProperties {
  return {
    background: bg,
    color,
    border: outline ? `1px solid rgba(255,255,255,0.35)` : "none",
    borderRadius: 7,
    padding: "8px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };
}
