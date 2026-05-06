import {
  useState,
  useRef,
  useEffect,
  lazy,
  Suspense,
  useCallback,
} from "react";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import SearchBar from "../components/SearchBar";
import AlertBanner from "../components/AlertBanner";
import FraudScoreCard from "../components/FraudScoreCard";
import StatCards from "../components/StatCards";
import LivePriceTicker from "../components/Livepriceticker";
import { analyzeCompany, getHistoryDetail, addToPortfolio } from "../utils/api";
import { useAuth } from "../context/AuthContext";

/* Lazy-load heavy sections */
const RevenueChart = lazy(() => import("../components/RevenueChart"));
const RiskRadar = lazy(() => import("../components/RiskRadar"));
const RedFlags = lazy(() => import("../components/RedFlags"));
const AISummary = lazy(() => import("../components/AISummary"));
const SentimentChart = lazy(() => import("../components/SentimentChart"));
const SimilarCompanies = lazy(() => import("../components/SimilarCompanies"));
const PeerComparison = lazy(() => import("../components/PeerComparison"));
const DownloadReportButton = lazy(
  () => import("../components/DownloadReportButton"),
);


/* ── API result cache (session-scoped) ───────────────────────────── */
const cache = new Map();

/* ── Framer Motion Config ────────────────────────────────────────── */
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const fadeUpItem = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

/* ── Section nav config ──────────────────────────────────────────── */
const SECTIONS = [
  { id: "fraud-score", label: "Fraud Score", icon: "🎯" },
  { id: "ai-summary", label: "AI Summary", icon: "🤖" },
  { id: "financials", label: "Financial Charts", icon: "📈" },
  { id: "red-flags", label: "Red Flags", icon: "🚩" },
  { id: "peers", label: "Peers", icon: "🏢" },
  { id: "comparison", label: "Comparison", icon: "⚖️" },
  { id: "sentiment", label: "Sentiment", icon: "📊" },
  { id: "portfolio", label: "Portfolio", icon: "💼" },
  { id: "report", label: "Report", icon: "📄" },
];

/* ── Skeleton loader ─────────────────────────────────────────────── */
function SkeletonCard({ height = 180 }) {
  return <div className="skeleton card" style={{ height, borderRadius: 12 }} />;
}

/* ── Section header ─────────────────────────────────────────────── */
function SH({ emoji, title, subtitle, accent = "#6366F1" }) {
  return (
    <div className="section-header">
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          flexShrink: 0,
          background: `${accent}14`,
          border: `1px solid ${accent}28`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.9rem",
        }}
      >
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2
          className="section-header-title"
          style={{
            fontFamily: "Poppins, sans-serif",
            fontWeight: 800,
            fontSize: "0.9rem",
            letterSpacing: "0.06em",
            color: "var(--text-primary)",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.65rem",
              fontFamily: "JetBrains Mono",
              margin: "2px 0 0",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div
        style={{
          flex: 1,
          height: 1,
          background: `linear-gradient(90deg, ${accent}28, transparent)`,
        }}
      />
    </div>
  );
}

/* ── Sticky side nav (desktop only) ─────────────────────────────── */
function SideNav({ activeSection, data }) {
  const available = SECTIONS.filter((s) => {
    if (s.id === "peers") return data?.similar_companies?.length > 0;
    if (s.id === "comparison") return !!data?.comparison;
    if (s.id === "sentiment")
      return data?.auditor_sentiment?.yearly?.length > 0;
    return true;
  });

  return (
    <aside
      className="dashboard-sidenav"
      style={{ position: "sticky", top: 80 }}
    >
      <p
        style={{
          color: "var(--text-muted)",
          fontSize: "0.58rem",
          fontFamily: "JetBrains Mono",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          margin: "0 0 8px 10px",
        }}
      >
        Sections
      </p>
      {available.map((s) => {
        const isActive = activeSection === s.id;
        return (
          <button
            key={s.id}
            onClick={() =>
              document
                .getElementById(s.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            aria-label={`Jump to ${s.label}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              width: "100%",
              padding: "6px 10px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              background: isActive ? "rgba(99,102,241,0.08)" : "transparent",
              color: isActive ? "#6366F1" : "var(--text-muted)",
              borderLeft: `2px solid ${isActive ? "#6366F1" : "transparent"}`,
              transition: "all 0.15s",
              marginBottom: 2,
            }}
          >
            <span style={{ fontSize: "0.72rem", flexShrink: 0 }}>{s.icon}</span>
            <span
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: "0.63rem",
                fontWeight: isActive ? 600 : 400,
                whiteSpace: "nowrap",
              }}
            >
              {s.label}
            </span>
          </button>
        );
      })}
      <div
        style={{ height: 1, background: "var(--border)", margin: "10px 0" }}
      />
      <Link
        to="/portfolio"
        aria-label="Open Portfolio mode"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 10px",
          borderRadius: 7,
          textDecoration: "none",
          background: "rgba(168,85,247,0.06)",
          border: "1px solid rgba(168,85,247,0.15)",
          color: "#a855f7",
          transition: "all 0.15s",
        }}
      >
        <span style={{ fontSize: "0.72rem" }}>📊</span>
        <span
          style={{
            fontFamily: "JetBrains Mono",
            fontSize: "0.63rem",
            fontWeight: 600,
          }}
        >
          Portfolio Mode
        </span>
      </Link>
    </aside>
  );
}

/* ── Error message ───────────────────────────────────────────────── */
function ErrorMsg({ error }) {
  if (!error) return null;
  const isNSE = error.includes("not listed on NSE");
  return (
    <div
      className={`error-card card ${isNSE ? "nse-error-card" : ""}`}
      role="alert"
      style={{
        background: isNSE ? "rgba(234,179,8,0.05)" : "rgba(239,68,68,0.05)",
        borderColor: isNSE ? "rgba(234,179,8,0.3)" : "rgba(239,68,68,0.3)",
      }}
    >
      {isNSE ? (
        <>
          <p
            style={{
              color: "#eab308",
              fontFamily: "JetBrains Mono",
              fontSize: "0.82rem",
              fontWeight: 600,
              margin: "0 0 6px",
            }}
          >
            ⚠ COMPANY NOT LISTED ON NSE
          </p>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.8rem",
              margin: 0,
            }}
          >
            Search by <span style={{ color: "#6366F1" }}>company name</span> or{" "}
            <span style={{ color: "#6366F1" }}>NSE symbol</span> — e.g.
            RELIANCE, TCS, HDFCBANK.
          </p>
        </>
      ) : (
        <>
          <p
            style={{
              color: "#ef4444",
              fontFamily: "JetBrains Mono",
              fontSize: "0.82rem",
              margin: "0 0 4px",
            }}
          >
            ⚠ {error}
          </p>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.78rem",
              margin: 0,
            }}
          >
            Ensure the FastAPI backend is running on port 8000.
          </p>
        </>
      )}
    </div>
  );
}

/* ── Loading state ───────────────────────────────────────────────── */
function LoadingView() {
  return (
    <motion.div
      className="dashboard-layout"
      style={{ marginTop: 28, opacity: 0.6 }}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Ghost SideNav */}
      <aside
        className="dashboard-sidenav"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <SkeletonCard height={20} />
        {[...Array(6)].map((_, i) => (
          <SkeletonCard key={i} height={32} />
        ))}
      </aside>

      {/* Ghost Main Column */}
      <div
        className="dashboard-main"
        style={{ display: "flex", flexDirection: "column", gap: 36 }}
      >
        <motion.section variants={fadeUpItem}>
          <SkeletonCard height={64} />
          <div className="score-stats-grid" style={{ marginTop: 14 }}>
            <SkeletonCard height={260} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "16px",
                alignContent: "start",
              }}
            >
              <SkeletonCard height={118} />
              <SkeletonCard height={118} />
              <SkeletonCard height={118} />
              <SkeletonCard height={118} />
            </div>
          </div>
        </motion.section>

        <motion.section variants={fadeUpItem}>
          <SkeletonCard height={200} />
        </motion.section>

        <motion.section variants={fadeUpItem}>
          <div className="chart-radar-grid">
            <SkeletonCard height={300} />
            <SkeletonCard height={300} />
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────── */
function EmptyView() {
  const FEATURES = [
    { icon: "🎯", label: "Fraud Score", desc: "AI 0–100 risk rating" },
    { icon: "🤖", label: "AI Summary", desc: "Natural language analysis" },
    { icon: "📈", label: "Financial Charts", desc: "10-year trend data" },
    { icon: "🚩", label: "Red Flags", desc: "Anomaly signal detection" },
    { icon: "⚖️", label: "Peer Comparison", desc: "Sector benchmarks" },
    { icon: "📊", label: "Auditor Sentiment", desc: "NLP on disclosures" },
  ];
  return (
    <motion.div
      style={{
        paddingTop: 32,
        paddingBottom: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div
        variants={fadeUpItem}
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.6rem",
          marginBottom: 18,
          boxShadow: "0 0 32px rgba(99,102,241,0.07)",
        }}
      >
        🛡️
      </motion.div>
      <motion.h2
        variants={fadeUpItem}
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: "1.25rem",
          color: "var(--text-primary)",
          margin: "0 0 8px",
          textAlign: "center",
        }}
      >
        Ready to Detect Fraud
      </motion.h2>
      <motion.p
        variants={fadeUpItem}
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.86rem",
          textAlign: "center",
          maxWidth: 420,
          margin: "0 0 24px",
          lineHeight: 1.65,
        }}
      >
        Enter any NSE-listed company name or symbol and click{" "}
        <strong style={{ color: "#6366F1" }}>Analyze</strong> to run AI-powered
        financial fraud detection.
      </motion.p>
      <motion.div
        variants={fadeUpItem}
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
          marginBottom: 28,
        }}
      >
        {[
          "RELIANCE",
          "TCS",
          "HDFCBANK",
          "TATAMOTORS",
          "COALINDIA",
          "WIPRO",
        ].map((s) => (
          <span
            key={s}
            style={{
              background: "rgba(99,102,241,0.06)",
              border: "1px solid rgba(99,102,241,0.15)",
              color: "var(--text-secondary)",
              padding: "4px 12px",
              borderRadius: 6,
              fontFamily: "JetBrains Mono",
              fontSize: "0.72rem",
            }}
          >
            {s}
          </span>
        ))}
      </motion.div>
      <motion.div variants={fadeUpItem} className="empty-feature-grid">
        {FEATURES.map((f, i) => (
          <div
            key={i}
            className="card"
            style={{
              padding: "14px 16px",
              textAlign: "center",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.borderColor = "var(--border-bright)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            <div style={{ fontSize: "1.1rem", marginBottom: 5 }}>{f.icon}</div>
            <p
              style={{
                fontFamily: "Poppins, sans-serif",
                fontWeight: 700,
                fontSize: "0.73rem",
                color: "var(--text-primary)",
                margin: "0 0 2px",
              }}
            >
              {f.label}
            </p>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.6rem",
                fontFamily: "JetBrains Mono",
                margin: 0,
              }}
            >
              {f.desc}
            </p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* ── Main Dashboard page ─────────────────────────────────────────── */
export default function Dashboard() {
  const [query, setQuery] = useState(() => {
    return sessionStorage.getItem("auditgpt_query") || "";
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(() => {
    const saved = sessionStorage.getItem("auditgpt_data");
    return saved ? JSON.parse(saved) : null;
  });
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState("fraud-score");
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useAuth();
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'

  /* Load from history if ?history=<id> is present */
  useEffect(() => {
    const historyId = searchParams.get("history");
    if (!historyId || !token) return;

    async function loadFromHistory() {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const record = await getHistoryDetail(token, historyId);
        const result = record.financial_data;
        // Ensure nse_symbol is set
        if (!result.nse_symbol && record.nse_symbol) {
          result.nse_symbol = record.nse_symbol;
        }
        setData(result);
        setQuery(record.company || "");
        // Clean the URL param so refreshing doesn't re-fetch
        setSearchParams({}, { replace: true });
        setTimeout(
          () =>
            document
              .getElementById("fraud-score")
              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
          150,
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadFromHistory();
  }, [searchParams, token]);

  /* Debounced analyze (avoids double-firing) */
  const analyzeRef = useRef(null);
  const handleAnalyze = useCallback(async (companyName) => {
    if (!companyName.trim()) return;
    clearTimeout(analyzeRef.current);
    analyzeRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setData(null);

      const cacheKey = companyName.trim().toUpperCase();
      if (cache.has(cacheKey)) {
        setData(cache.get(cacheKey));
        setLoading(false);
        setTimeout(
          () =>
            document
              .getElementById("fraud-score")
              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
          100,
        );
        return;
      }

      try {
        const result = await analyzeCompany(companyName);
        if (result?.success === false && !result?.live_only) {
          throw new Error(result?.message || "Data unavailable");
        }
        if (result?.success === false && result?.live_only) {
          const liveOnlyResult = {
            company_name: result.company_name || companyName.toUpperCase(),
            nse_symbol: result.nse_symbol || companyName.toUpperCase(),
            analyzed_at: new Date().toISOString(),
            fraud_score: 0,
            risk_level: "MODERATE",
            fraud_details: { reasons: [], score_breakdown: {} },
            score_explanations: [],
            years: [],
            revenue_10y: [],
            profit_10y: [],
            debt_10y: [],
            cashflow_10y: [],
            red_flags: [],
            risk_categories: [],
            summary: {
              tldr: "Financial history is unavailable for full fraud scoring.",
              body: "This company currently has insufficient structured annual statements in connected providers.",
              action: "Track live market behavior until financial history becomes available.",
              score: 0,
              level: "MODERATE",
            },
            company_info: {},
            live_only: true,
            data_warning: result.message || "Financial data unavailable. Showing live market data only.",
            live_price: result.live_price || null,
          };
          sessionStorage.setItem("auditgpt_data", JSON.stringify(liveOnlyResult));
          cache.set(cacheKey, liveOnlyResult);
          setData(liveOnlyResult);
          return;
        }
        sessionStorage.setItem("auditgpt_data", JSON.stringify(result));
        cache.set(cacheKey, result);
        setData(result);
        setTimeout(
          () =>
            document
              .getElementById("fraud-score")
              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
          150,
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 100);
  }, []);

  /* Intersection observer — track active section */
  useEffect(() => {
    if (!data) return;
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        }),
      { rootMargin: "-15% 0px -65% 0px", threshold: 0 },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [data]);

  return (
    <div
      className="min-h-screen grid-bg"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 700,
          height: 260,
          background:
            "radial-gradient(ellipse, rgba(99,102,241,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ── Navbar ── */}
      <Navbar />

      {/* ── Page content ── */}
      <main
        className="page-container"
        id="main-content"
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "32px 24px 64px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Subtitle */}
        <p
          className="header-subtitle"
          style={{
            color: "var(--text-muted)",
            fontSize: "0.78rem",
            fontFamily: "JetBrains Mono",
            marginBottom: 20,
          }}
        >
          AI-Powered Financial Fraud Detection &amp; Risk Intelligence
        </p>

        {/* Search */}
        <SearchBar
          value={query}
          onChange={setQuery}
          onAnalyze={handleAnalyze}
          loading={loading}
        />

        {/* Error */}
        <ErrorMsg error={error} />

        {/* Loading */}
        {loading && <LoadingView />}

        {/* Empty */}
        {!loading && !data && !error && <EmptyView />}

        {/* ── Results ─────────────────────────────────────────────── */}
        {data && !loading && data.live_only && (
          <div className="dashboard-layout" style={{ marginTop: 28 }}>
            <div className="dashboard-main" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: "0 0 8px", color: "var(--text-primary)" }}>
                  {data.company_name} ({data.nse_symbol})
                </h3>
                <p style={{ margin: 0, color: "var(--text-muted)", fontFamily: "JetBrains Mono", fontSize: "0.75rem" }}>
                  Financial statements are currently unavailable. Live market data is shown below.
                </p>
                <div
                  style={{
                    marginTop: 12,
                    background: "rgba(234,179,8,0.08)",
                    border: "1px solid rgba(234,179,8,0.25)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    color: "#eab308",
                    fontFamily: "JetBrains Mono",
                    fontSize: "0.68rem",
                  }}
                >
                  ⚠ {data.data_warning || "Limited history available. Fraud score and financial charts are hidden for accuracy."}
                </div>
              </div>
            </div>
          </div>
        )}

        {data && !loading && !data.live_only && (
          <div className="dashboard-layout" style={{ marginTop: 28 }}>
            {/* Side nav */}
            <SideNav activeSection={activeSection} data={data} />

            {/* Main column */}
            <motion.div
              className="dashboard-main"
              style={{ display: "flex", flexDirection: "column", gap: 36 }}
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {/* Alert banner */}
              {data.fraud_score > 70 && (
                <motion.div variants={fadeUpItem}>
                  <AlertBanner data={data} />
                </motion.div>
              )}

              {/* 1 ── FRAUD SCORE ──────────────────────────── */}
              <motion.section
                id="fraud-score"
                className="scroll-mt-20"
                variants={fadeUpItem}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <SH
                    emoji="🎯"
                    title="Fraud Score"
                    subtitle={`${data.company_name} · NSE: ${data.nse_symbol}`}
                    accent="#6366F1"
                  />
                  {data.nse_symbol && (
                    <button
                      onClick={async () => {
                        setSaveStatus("saving");
                        try {
                          await addToPortfolio(token, [data.nse_symbol]);
                          setSaveStatus("saved");
                          setTimeout(() => setSaveStatus(null), 3000);
                        } catch {
                          setSaveStatus("error");
                          setTimeout(() => setSaveStatus(null), 3000);
                        }
                      }}
                      disabled={saveStatus === "saving"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexShrink: 0,
                        padding: "7px 16px",
                        borderRadius: 8,
                        background:
                          saveStatus === "saved"
                            ? "rgba(34,197,94,0.1)"
                            : "rgba(234,179,8,0.08)",
                        border: `1px solid ${saveStatus === "saved" ? "rgba(34,197,94,0.3)" : saveStatus === "error" ? "rgba(239,68,68,0.3)" : "rgba(234,179,8,0.2)"}`,
                        color:
                          saveStatus === "saved"
                            ? "#22c55e"
                            : saveStatus === "error"
                              ? "#ef4444"
                              : "#eab308",
                        fontFamily: "JetBrains Mono",
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        cursor:
                          saveStatus === "saving" ? "not-allowed" : "pointer",
                        letterSpacing: "0.04em",
                        transition: "all 0.2s",
                      }}
                    >
                      {saveStatus === "saving"
                        ? "⏳ Saving…"
                        : saveStatus === "saved"
                          ? "✓ Saved to Watchlist"
                          : saveStatus === "error"
                            ? "✗ Failed"
                            : "⭐ Save to Watchlist"}
                    </button>
                  )}
                </div>

                {/* ─── Live Price strip (full-width, OUTSIDE the 2-col grid) ─── */}
                {data.nse_symbol && (
                  <LivePriceTicker symbol={data.nse_symbol} initialData={data.live_price} />
                )}

                {/* ─── Score + Stats: 2-col grid (matches CSS) ─── */}
                <div className="score-stats-grid">
                  <FraudScoreCard data={data} />
                  <StatCards data={data} />
                </div>

                {data.data_warning && (
                  <div
                    style={{
                      marginTop: "12px",
                      background: "rgba(234,179,8,0.06)",
                      border: "1px solid rgba(234,179,8,0.22)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        color: "#eab308",
                        fontSize: "0.85rem",
                        flexShrink: 0,
                      }}
                    >
                      ⚠
                    </span>
                    <div>
                      <p
                        style={{
                          color: "#eab308",
                          fontFamily: "JetBrains Mono",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          margin: "0 0 2px",
                        }}
                      >
                        Limited Data Available
                      </p>
                      <p
                        style={{
                          color: "rgba(234,179,8,0.8)",
                          fontSize: "0.68rem",
                          fontFamily: "JetBrains Mono",
                          margin: 0,
                          lineHeight: 1.5,
                        }}
                      >
                        {data.data_warning}
                      </p>
                    </div>
                  </div>
                )}
              </motion.section>

              {/* 2 ── AI SUMMARY ───────────────────────────── */}
              <motion.section
                id="ai-summary"
                className="scroll-mt-20"
                variants={fadeUpItem}
              >
                <SH
                  emoji="🤖"
                  title="AI Summary"
                  subtitle="AuditGPT intelligence engine"
                  accent="#a855f7"
                />
                <Suspense fallback={<SkeletonCard height={200} />}>
                  <AISummary data={data} />
                </Suspense>
              </motion.section>

              {/* 3 ── FINANCIAL CHARTS ─────────────────────── */}
              <motion.section
                id="financials"
                className="scroll-mt-20"
                variants={fadeUpItem}
              >
                <SH
                  emoji="📈"
                  title="Financial Charts"
                  subtitle={`${data.years?.length || 0} Years · ${(data.financial_data_sources || ["Yahoo"]).join(" + ").toUpperCase()}`}
                  accent="#22c55e"
                />
                <div className="chart-radar-grid">
                  <div className="chart-scroll-wrapper">
                    <div className="chart-min-width">
                      <Suspense fallback={<SkeletonCard height={280} />}>
                        <RevenueChart data={data} />
                      </Suspense>
                    </div>
                  </div>
                  <Suspense fallback={<SkeletonCard height={280} />}>
                    <RiskRadar data={data} />
                  </Suspense>
                </div>
              </motion.section>

              {/* 4 ── RED FLAGS ────────────────────────────── */}
              <motion.section
                id="red-flags"
                className="scroll-mt-20"
                variants={fadeUpItem}
              >
                <SH
                  emoji="🚩"
                  title="Red Flags & Anomalies"
                  subtitle="AI-scored fraud signal detection"
                  accent="#ef4444"
                />
                <Suspense fallback={<SkeletonCard height={200} />}>
                  <RedFlags data={data} />
                </Suspense>
              </motion.section>

              {/* 5 ── PEER COMPANIES ───────────────────────── */}
              {data.similar_companies?.length > 0 && (
                <motion.section
                  id="peers"
                  className="scroll-mt-20"
                  variants={fadeUpItem}
                >
                  <SH
                    emoji="🏢"
                    title="Peer Companies"
                    subtitle={`Same sector · ${data.company_info?.sector || "N/A"}`}
                    accent="#f97316"
                  />
                  <Suspense fallback={<SkeletonCard height={120} />}>
                    <SimilarCompanies
                      companies={data.similar_companies}
                      sector={data.company_info?.sector || "N/A"}
                      onAnalyze={(name) => {
                        setQuery(name);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        handleAnalyze(name);
                      }}
                    />
                  </Suspense>
                </motion.section>
              )}

              {/* 6 ── COMPANY COMPARISON ───────────────────── */}
              {data.comparison && (
                <motion.section
                  id="comparison"
                  className="scroll-mt-20"
                  variants={fadeUpItem}
                >
                  <SH
                    emoji="⚖️"
                    title="Company Comparison"
                    subtitle="Revenue · Profit · Debt · Risk vs peers"
                    accent="#6366F1"
                  />
                  <Suspense fallback={<SkeletonCard height={320} />}>
                    <PeerComparison comparison={data.comparison} />
                  </Suspense>
                </motion.section>
              )}

              {/* 7 ── AUDITOR SENTIMENT ────────────────────── */}
              {data.auditor_sentiment?.yearly?.length > 0 && (
                <motion.section
                  id="sentiment"
                  className="scroll-mt-20"
                  variants={fadeUpItem}
                >
                  <SH
                    emoji="📊"
                    title="Auditor Sentiment"
                    subtitle="NLP analysis of financial disclosures"
                    accent="#eab308"
                  />
                  <Suspense fallback={<SkeletonCard height={260} />}>
                    <SentimentChart data={data} />
                  </Suspense>
                </motion.section>
              )}

              {/* 8 ── PORTFOLIO CTA ────────────────────────── */}
              <motion.section
                id="portfolio"
                className="scroll-mt-20"
                variants={fadeUpItem}
              >
                <SH
                  emoji="💼"
                  title="Portfolio Analysis"
                  subtitle="Analyze multiple companies simultaneously"
                  accent="#a855f7"
                />
                <div
                  className="card"
                  style={{
                    padding: 24,
                    background:
                      "linear-gradient(135deg, rgba(168,85,247,0.06), rgba(99,102,241,0.04))",
                    border: "1px solid rgba(168,85,247,0.18)",
                  }}
                >
                  <div
                    className="portfolio-cta-inner"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 16,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3
                        style={{
                          fontFamily: "Poppins, sans-serif",
                          fontWeight: 800,
                          fontSize: "1rem",
                          color: "var(--text-primary)",
                          margin: "0 0 6px",
                        }}
                      >
                        Compare multiple companies at once
                      </h3>
                      <p
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "0.82rem",
                          margin: "0 0 12px",
                          lineHeight: 1.6,
                        }}
                      >
                        Portfolio mode lets you analyze up to 10 NSE companies —
                        risk scores, sector distribution, and peer benchmarks
                        side-by-side.
                      </p>
                      <div
                        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                      >
                        {["TCS", "INFY", "RELIANCE", "HDFCBANK", "WIPRO"].map(
                          (t) => (
                            <span
                              key={t}
                              style={{
                                background: "rgba(168,85,247,0.1)",
                                border: "1px solid rgba(168,85,247,0.2)",
                                color: "#a855f7",
                                padding: "2px 10px",
                                borderRadius: 4,
                                fontSize: "0.68rem",
                                fontFamily: "JetBrains Mono",
                              }}
                            >
                              {t}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                    <Link
                      to="/portfolio"
                      className="btn-primary"
                      aria-label="Open portfolio analysis"
                      style={{
                        flexShrink: 0,
                        padding: "10px 22px",
                        whiteSpace: "nowrap",
                        textDecoration: "none",
                      }}
                    >
                      Open Portfolio →
                    </Link>
                  </div>
                </div>
              </motion.section>

              {/* 9 ── DOWNLOAD REPORT ──────────────────────── */}
              <motion.section
                id="report"
                className="scroll-mt-20"
                variants={fadeUpItem}
              >
                <SH
                  emoji="📄"
                  title="Download Report"
                  subtitle="Full 2-page PDF — fraud score, charts, AI summary, peers"
                  accent="#22c55e"
                />
                <div
                  className="card"
                  style={{
                    padding: 24,
                    border: "1px solid rgba(34,197,94,0.15)",
                  }}
                >
                  <div
                    className="report-card-inner"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 16,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontFamily: "Poppins, sans-serif",
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          color: "var(--text-primary)",
                          margin: "0 0 4px",
                        }}
                      >
                        {data.company_name} — Analysis Report
                      </p>
                      <p
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.68rem",
                          fontFamily: "JetBrains Mono",
                          margin: "0 0 12px",
                        }}
                      >
                        {new Date(data.analyzed_at).toLocaleString()} ·{" "}
                        {data.years?.length || 0} years · Risk:{" "}
                        {data.risk_level}
                      </p>
                      <div
                        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                      >
                        {[
                          "Fraud Score",
                          "KPI Grid",
                          "Trend Charts",
                          "Peer Table",
                          "AI Summary",
                          "Sentiment",
                        ].map((tag) => (
                          <span
                            key={tag}
                            style={{
                              background: "rgba(34,197,94,0.08)",
                              border: "1px solid rgba(34,197,94,0.2)",
                              color: "#22c55e",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: "0.62rem",
                              fontFamily: "JetBrains Mono",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Suspense
                      fallback={
                        <div
                          style={{ width: 160, height: 40 }}
                          className="skeleton"
                        />
                      }
                    >
                      <DownloadReportButton data={data} />
                    </Suspense>
                  </div>
                </div>
              </motion.section>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
