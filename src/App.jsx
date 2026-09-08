import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { loadDoc, saveDoc, watchDoc, loadCollection, saveItem, deleteItem, watchCollection, incrementCounter, watchCounters, auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "./firebase.js";

/* ---------- Design tokens ---------- */
const GOLD = "#E3B23C";
const GOLD_BRIGHT = "#F5CD5C";
const GOLD_DIM = "#7A5E22";
const EMBER = "#B5341E";
const EMBER_BRIGHT = "#D6431F";
const BG = "#0b0906";
const BG_RAISED = "#141009";
const CARD_BG = "#171208";
const CARD_BG_HOVER = "#1d1610";
const BORDER = "#332711";
const BORDER_STRONG = "#4a380f";
const TEXT = "#F2E7CE";
const TEXT_DIM = "#9C8F72";
const TEXT_FAINT = "#6B5F48";

const DEFAULT_SETTINGS = {
  metaLink: "https://facebook.com/",
  messengerUsername: "",
  whatsappLink: "",
  discordLink: "",
  instagramLink: "",
  lnbitsEnabled: false,
  cashtapEnabled: false,
  nowpaymentsEnabled: false,
  cashoutEnabled: true,
  cashoutMetaLink: "",
  cashoutMessageTemplate: "Hello, I would like to request a cash-out.\n\nGame: {game}\nGame Username: {username}\nCash-Out Amount: ${amount}\nPayment Method: {method}\nPayment Details: {details}\nRequest ID: {requestId}",
};

/* ---------- Editable site text (admin can change every label/heading) ---------- */
const DEFAULT_TEXT = {
  siteName: "Raizen Royale",
  navGames: "Games",
  navPayments: "Payment methods",
  navContact: "Contact support",
  navCashout: "Cash Out",
  homeEyebrow: "The arsenal",
  homeTitle: "Our games",
  homeSubtitle: "Pick a game to download, or reach out if you need an account.",
  searchPlaceholder: "Search games...",
  noGamesText: "No games added yet.",
  downloadBtn: "Download now",
  needAccountBtn: "Need account?",
  paymentsEyebrow: "The vault",
  paymentsTitle: "Payment methods",
  paymentsSubtitle: "Use any of the options below to send payment.",
  noPaymentsText: "No payment methods added yet.",
  openLinkBtn: "Open link",
  lightningTitle: "\u26A1 Pay with Lightning",
  lightningSubtitle: "Bitcoin Lightning Network, instant settlement.",
  lightningAmountPlaceholder: "Amount in USD (e.g. 5.00)",
  lightningGamePlaceholder: "For which game? (optional)",
  lightningGenerateBtn: "Generate invoice",
  lightningWaitingText: "Scan with your Lightning wallet, or copy the invoice below.",
  lightningCopyBtn: "Copy invoice",
  lightningWaitingStatus: "Waiting for payment...",
  lightningPaidText: "Payment received!",
  lightningDownloadReceiptBtn: "Download receipt",
  lightningReceiptNote: "Save this image and send it to us as proof of payment.",
  lightningExpiredTitle: "Invoice expired",
  lightningExpiredText: "This invoice is more than 30 minutes old and may no longer be valid. Please generate a new invoice before paying, or the payment may fail.",
  lightningNewInvoiceBtn: "Generate new invoice",
  cashtapTitle: "Pay with Card / Bank / CashApp",
  cashtapSubtitle: "Secure checkout via CashTap.",
  nowpaymentsTitle: "Pay with Card / Apple Pay",
  nowpaymentsSubtitle: "Opens a secure checkout in a new tab.",
  continueCheckoutBtn: "Continue to checkout",
  loginTitle: "Admin access",
  loginUsernamePlaceholder: "Admin email",
  loginPasswordPlaceholder: "Password",
  loginBtn: "Log in",
  footerConnectText: "Connect with us",
};

const TextContext = React.createContext(DEFAULT_TEXT);
function useText() {
  return React.useContext(TextContext);
}

const SAMPLE_GAMES = [
  { id: "sample-1", name: "Free Fire", flyer: "", downloadLink: "https://www.freefiremobile.com/" },
  { id: "sample-2", name: "PUBG Mobile", flyer: "", downloadLink: "https://www.pubgmobile.com/" },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- Global style injection (fonts, texture, keyframes) ---------- */
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

      .rr-root {
        font-family: 'Inter', system-ui, sans-serif;
        background:
          radial-gradient(ellipse 900px 500px at 50% -10%, rgba(227,178,60,0.10), transparent 60%),
          repeating-linear-gradient(135deg, rgba(255,255,255,0.008) 0px, rgba(255,255,255,0.008) 1px, transparent 1px, transparent 3px),
          ${BG};
        min-height: 100vh;
        color: ${TEXT};
      }
      .rr-display {
        font-family: 'Rajdhani', 'Inter', sans-serif;
        letter-spacing: 0.02em;
      }
      .rr-card {
        background: ${CARD_BG};
        border: 1px solid ${BORDER};
        position: relative;
        transition: border-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
        clip-path: polygon(0 10px, 10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%);
      }
      .rr-card:hover {
        border-color: ${BORDER_STRONG};
        background: ${CARD_BG_HOVER};
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      }
      .rr-btn-primary {
        background: linear-gradient(180deg, ${GOLD_BRIGHT}, ${GOLD});
        color: #1a1206;
        font-weight: 700;
        border: none;
        clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
        transition: filter 0.15s ease, transform 0.1s ease, box-shadow 0.2s ease;
        cursor: pointer;
      }
      .rr-btn-primary:hover {
        filter: brightness(1.12);
        box-shadow: 0 0 18px rgba(227,178,60,0.45);
      }
      .rr-btn-primary:active { transform: scale(0.98); }
      .rr-btn-ghost {
        background: transparent;
        border: 1px solid ${GOLD_DIM};
        color: ${GOLD};
        font-weight: 600;
        clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
        transition: all 0.15s ease;
        cursor: pointer;
      }
      .rr-btn-ghost:hover {
        border-color: ${GOLD};
        background: rgba(227,178,60,0.08);
        box-shadow: 0 0 12px rgba(227,178,60,0.2);
      }
      .rr-btn-danger {
        background: transparent;
        border: 1px solid #5c2418;
        color: ${EMBER_BRIGHT};
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .rr-btn-danger:hover {
        border-color: ${EMBER_BRIGHT};
        background: rgba(181,52,30,0.1);
      }
      .rr-input {
        background: ${BG_RAISED};
        border: 1px solid ${BORDER};
        color: ${TEXT};
        padding: 11px 14px;
        font-size: 14px;
        outline: none;
        width: 100%;
        box-sizing: border-box;
        font-family: 'Inter', sans-serif;
        transition: border-color 0.15s ease;
      }
      .rr-input:focus {
        border-color: ${GOLD};
      }
      .rr-nav-link {
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        padding-bottom: 4px;
        border-bottom: 2px solid transparent;
        transition: color 0.15s ease;
        letter-spacing: 0.02em;
      }
      .rr-glow-line {
        height: 2px;
        background: linear-gradient(90deg, transparent, ${GOLD}, transparent);
        opacity: 0.6;
      }
      @keyframes rr-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.55; }
      }
      .rr-crest-gem { animation: rr-pulse 2.4s ease-in-out infinite; }
      @keyframes rr-splash-glow {
        0%, 100% { filter: drop-shadow(0 0 4px rgba(227,178,60,0.3)); transform: scale(1); }
        50% { filter: drop-shadow(0 0 18px rgba(227,178,60,0.7)); transform: scale(1.06); }
      }
      .rr-splash-crest { animation: rr-splash-glow 1.8s ease-in-out infinite; }
      .rr-badge-new {
        display: inline-block;
        background: linear-gradient(180deg, #F5CD5C, #E3B23C);
        color: #1a1206;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        padding: 3px 8px;
        text-transform: uppercase;
        clip-path: polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px);
      }
      .rr-footer {
        position: relative;
        z-index: 1;
        padding: 28px 24px 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
      }
      .rr-social-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        border: 1px solid ${GOLD_DIM};
        color: ${GOLD};
        transition: all 0.15s ease;
        text-decoration: none;
      }
      .rr-social-icon:hover {
        border-color: ${GOLD};
        background: rgba(227,178,60,0.1);
        box-shadow: 0 0 12px rgba(227,178,60,0.3);
        transform: translateY(-2px);
      }
      .rr-bg-image {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        pointer-events: none;
        background-image: url('/bg-hero.jpg');
        background-size: cover;
        background-position: center 30%;
        background-repeat: no-repeat;
        filter: blur(3px) brightness(0.55) saturate(0.9);
        transform: scale(1.05);
      }
      .rr-bg-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        pointer-events: none;
        background:
          radial-gradient(ellipse 900px 500px at 50% 0%, rgba(227,178,60,0.08), transparent 60%),
          linear-gradient(180deg, rgba(11,9,6,0.55) 0%, rgba(11,9,6,0.75) 45%, rgba(11,9,6,0.92) 100%);
      }
      .rr-content {
        position: relative;
        z-index: 1;
      }
      .rr-page { padding: 32px 24px 48px; max-width: 1100px; margin: 0 auto; }
      .rr-cashout-shell { max-width: 720px; margin: 0 auto; }
      .rr-cashout-form { padding: 26px; display: flex; flex-direction: column; gap: 16px; }
      .rr-form-label { color: ${TEXT_DIM}; font-size: 12px; font-weight: 600; display: block; margin-bottom: 7px; letter-spacing: .03em; }
      .rr-required { color: ${EMBER_BRIGHT}; }
      .rr-method-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .rr-method-option { border: 1px solid ${BORDER}; background: ${BG_RAISED}; color: ${TEXT_DIM}; padding: 13px 10px; cursor: pointer; text-align: center; font-weight: 600; font-size: 13px; transition: all .15s ease; }
      .rr-method-option.active { border-color: ${GOLD}; color: ${GOLD_BRIGHT}; background: rgba(227,178,60,.08); box-shadow: 0 0 14px rgba(227,178,60,.12); }
      .rr-cashout-actions { display: flex; gap: 10px; }
      .rr-status-box { border: 1px solid ${BORDER}; background: ${BG_RAISED}; padding: 13px 14px; color: ${TEXT_DIM}; font-size: 13px; line-height: 1.5; }
      @media (max-width: 700px) {
        .rr-page { padding: 24px 14px 36px; }
        .rr-cashout-form { padding: 18px; }
        .rr-method-grid { grid-template-columns: 1fr; }
        .rr-cashout-actions { flex-direction: column; }
        .rr-cashout-actions > * { width: 100%; box-sizing: border-box; }
      }
      @media (max-width: 520px) {
        .rr-root { overflow-x: hidden; }
        .rr-card:hover { transform: none; }
      }
    `}</style>
  );
}

/* ---------- Dark fantasy background image (user-provided AI-generated artwork) ---------- */
function BackgroundSilhouette() {
  return (
    <>
      <div className="rr-bg-image" aria-hidden="true" />
      <div className="rr-bg-overlay" aria-hidden="true" />
    </>
  );
}

/* ---------- Crest / Logo ---------- */
function Crest({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 3 L43 13 V28 C43 37 35 43 24 45 C13 43 5 37 5 28 V13 Z" stroke={GOLD} strokeWidth="1.6" fill="rgba(227,178,60,0.06)" />
      <path d="M13 17 L17 25 L24 19 L31 25 L35 17" stroke={GOLD} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="none" />
      <circle cx="24" cy="30" r="2.4" fill={EMBER_BRIGHT} className="rr-crest-gem" />
    </svg>
  );
}

/* ---------- Nav ---------- */
function NavLink({ to, label, active }) {
  return (
    <Link
      to={to}
      className="rr-nav-link"
      style={{ color: active ? GOLD_BRIGHT : TEXT_DIM, borderBottomColor: active ? GOLD : "transparent" }}
    >
      {label}
    </Link>
  );
}

function Footer({ whatsappLink, discordLink, instagramLink }) {
  const t = useText();
  const links = [
    whatsappLink ? { href: whatsappLink, label: "WhatsApp", icon: "\u260E" } : null,
    discordLink ? { href: discordLink, label: "Discord", icon: "\u2694" } : null,
    instagramLink ? { href: instagramLink, label: "Instagram", icon: "\u25C9" } : null,
  ].filter(Boolean);

  if (links.length === 0) return null;

  return (
    <div className="rr-footer">
      <div style={{ color: TEXT_FAINT, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {t.footerConnectText}
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="rr-social-icon" title={l.label} aria-label={l.label}>
            {l.icon}
          </a>
        ))}
      </div>
    </div>
  );
}

function TopBar({ metaLink }) {
  const location = useLocation();
  const t = useText();
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          background: "rgba(11,9,6,0.45)",
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Crest size={30} />
          <span className="rr-display" style={{ fontSize: 21, fontWeight: 700, color: TEXT, textTransform: "uppercase" }}>
            {t.siteName}
          </span>
        </Link>
        <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
          <NavLink to="/" label={t.navGames} active={location.pathname === "/"} />
          <NavLink to="/payments" label={t.navPayments} active={location.pathname === "/payments"} />
          <Link
            to="/cashout"
            className="rr-btn-primary"
            style={{ textDecoration: "none", padding: "8px 14px", fontSize: 13, display: "inline-block" }}
          >
            {t.navCashout}
          </Link>
          <a
            href={metaLink || "https://facebook.com/"}
            target="_blank"
            rel="noopener noreferrer"
            className="rr-nav-link"
            style={{ color: TEXT_DIM }}
          >
            {t.navContact}
          </a>
        </div>
      </div>
      <div className="rr-glow-line" />
    </div>
  );
}

/* ---------- Game card ---------- */
function GameCard({ game, metaLink, messengerUsername }) {
  const t = useText();
  const accountLink = messengerUsername
    ? `https://m.me/${messengerUsername}?text=${encodeURIComponent(`Hey I would like to make an account for ${game.name}`)}`
    : (metaLink || "https://facebook.com/");
  return (
    <div className="rr-card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ width: "100%", aspectRatio: "16/10", background: BG_RAISED, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderBottom: `1px solid ${BORDER}`, position: "relative" }}>
        {game.badge && game.badge.trim() ? (
          <span className="rr-badge-new" style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}>{game.badge.trim()}</span>
        ) : null}
        {game.flyer ? (
          <img src={game.flyer} alt={game.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ color: TEXT_FAINT, fontSize: 13 }}>No flyer</span>
        )}
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div className="rr-display" style={{ color: TEXT, fontSize: 18, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>
          {game.name}
        </div>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 9 }}>
          <a
            href={game.downloadLink || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => incrementCounter("game_" + game.id)}
            className="rr-btn-primary"
            style={{ textAlign: "center", fontSize: 14, padding: "10px 0", textDecoration: "none", display: "block" }}
          >
            {t.downloadBtn}
          </a>
          <a
            href={accountLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rr-btn-ghost"
            style={{ textAlign: "center", fontSize: 13, padding: "9px 0", textDecoration: "none", display: "block" }}
          >
            {t.needAccountBtn}
          </a>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {eyebrow ? (
        <div style={{ color: EMBER_BRIGHT, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          {eyebrow}
        </div>
      ) : null}
      <h1 className="rr-display" style={{ color: TEXT, fontSize: 28, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.02em" }}>
        {title}
      </h1>
      {subtitle ? <p style={{ color: TEXT_DIM, fontSize: 14, marginTop: 6 }}>{subtitle}</p> : null}
    </div>
  );
}

function HomePage({ games, metaLink, messengerUsername }) {
  const t = useText();
  const [query, setQuery] = useState("");
  const sortedGames = [...games].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  const filteredGames = query.trim()
    ? sortedGames.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()))
    : sortedGames;

  useEffect(() => {
    if (!sessionStorage.getItem("rr_visit_counted")) {
      incrementCounter("site_visits");
      sessionStorage.setItem("rr_visit_counted", "1");
    }
  }, []);

  return (
    <div style={{ padding: "32px 24px 48px", maxWidth: 1100, margin: "0 auto" }}>
      <SectionHeading eyebrow={t.homeEyebrow} title={t.homeTitle} subtitle={t.homeSubtitle} />
      <div style={{ marginBottom: 24, maxWidth: 340 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="rr-input"
        />
      </div>
      {games.length === 0 ? (
        <div style={{ color: TEXT_FAINT, fontSize: 14 }}>{t.noGamesText}</div>
      ) : filteredGames.length === 0 ? (
        <div style={{ color: TEXT_FAINT, fontSize: 14 }}>No games match "{query}".</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 18 }}>
          {filteredGames.map((g) => (
            <GameCard key={g.id} game={g} metaLink={metaLink} messengerUsername={messengerUsername} />
          ))}
        </div>
      )}
    </div>
  );
}

function LightningPay({ games }) {
  const t = useText();
  const [amount, setAmount] = useState("");
  const [selectedGame, setSelectedGame] = useState("");
  const [invoice, setInvoice] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | creating | waiting | paid | error | timedout
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [satsPreview, setSatsPreview] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [paidUsd, setPaidUsd] = useState(null);
  const [paidAt, setPaidAt] = useState(null);
  const canvasRef = React.useRef(null);

  const INVOICE_LIFETIME = 30 * 60; // 30 minutes

  const getBtcPriceUsd = async () => {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
    if (!res.ok) throw new Error("Could not fetch BTC price.");
    const data = await res.json();
    const price = data.bitcoin && data.bitcoin.usd;
    if (!price) throw new Error("Could not fetch BTC price.");
    return price;
  };

  const createInvoice = async (e) => {
    e.preventDefault();
    const usd = parseFloat(amount);
    if (!usd || usd < 0.01) {
      setError("Enter a valid amount in USD.");
      return;
    }
    setError("");
    setStatus("creating");
    try {
      const btcPrice = await getBtcPriceUsd();
      const sats = Math.round((usd / btcPrice) * 100000000);
      if (sats < 1) throw new Error("Amount too small.");
      setSatsPreview(sats);
      setPaidUsd(usd);
      const res = await fetch("/api/create-lightning-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountSats: sats, usdAmount: usd, memo: `Raizen Royale payment ($${usd.toFixed(2)})` }),
      });
      if (!res.ok) throw new Error("Could not create invoice.");
      const data = await res.json();
      setInvoice({ bolt11: data.payment_request || data.bolt11, hash: data.payment_hash || data.checking_id });
      setSecondsLeft(INVOICE_LIFETIME);
      setStatus("waiting");
    } catch (err) {
      setError("Could not create invoice. Try again.");
      setStatus("error");
    }
  };

  useEffect(() => {
    if (status !== "waiting" || !invoice) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/lightning-status?payment_hash=${encodeURIComponent(invoice.hash)}`);
        const data = await res.json();
        if (data.paid) {
          setPaidAt(new Date());
          setStatus("paid");
          clearInterval(interval);
        }
      } catch (err) {
        // keep polling silently
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [status, invoice]);

  useEffect(() => {
    if (status !== "waiting") return;
    if (secondsLeft <= 0) {
      setStatus("timedout");
      return;
    }
    const tick = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(tick);
  }, [status, secondsLeft]);

  const drawReceipt = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = 600, H = 720;
    canvas.width = W;
    canvas.height = H;

    ctx.fillStyle = "#0b0906";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#4a380f";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, W - 32, H - 32);

    ctx.fillStyle = "#F5CD5C";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RAIZEN ROYALE", W / 2, 80);
    ctx.fillStyle = "#9C8F72";
    ctx.font = "13px sans-serif";
    ctx.fillText("PAYMENT RECEIPT", W / 2, 105);

    ctx.strokeStyle = "#332711";
    ctx.beginPath();
    ctx.moveTo(60, 130);
    ctx.lineTo(W - 60, 130);
    ctx.stroke();

    // Paid badge
    ctx.fillStyle = "#1a3d1a";
    ctx.fillRect(W / 2 - 70, 155, 140, 40);
    ctx.fillStyle = "#7fbf6a";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("\u2713 PAID", W / 2, 181);

    // Amount
    ctx.fillStyle = "#F2E7CE";
    ctx.font = "bold 44px sans-serif";
    ctx.fillText(`$${paidUsd ? paidUsd.toFixed(2) : "0.00"}`, W / 2, 260);
    ctx.fillStyle = "#E3B23C";
    ctx.font = "16px sans-serif";
    ctx.fillText(`${satsPreview ? satsPreview.toLocaleString() : 0} sats`, W / 2, 288);

    // Details box
    const details = [
      ["Game", selectedGame || "\u2014"],
      ["Method", "Bitcoin Lightning"],
      ["Date", (paidAt || new Date()).toLocaleString()],
      ["Payment ID", invoice ? invoice.hash.slice(0, 20) + "..." : "\u2014"],
    ];
    let y = 350;
    ctx.textAlign = "left";
    details.forEach(([label, value]) => {
      ctx.fillStyle = "#6B5F48";
      ctx.font = "13px sans-serif";
      ctx.fillText(label.toUpperCase(), 70, y);
      ctx.fillStyle = "#F2E7CE";
      ctx.font = "16px sans-serif";
      ctx.fillText(value, 70, y + 22);
      y += 60;
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "#6B5F48";
    ctx.font = "12px sans-serif";
    ctx.fillText("Keep this receipt as proof of payment", W / 2, H - 50);
    ctx.fillStyle = "#E3B23C";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("\u265B raizenroyale.shop", W / 2, H - 28);
  };

  useEffect(() => {
    if (status === "paid") {
      setTimeout(drawReceipt, 50);
    }
  }, [status]);

  const downloadReceipt = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `raizen-royale-receipt-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const copyInvoice = () => {
    navigator.clipboard.writeText(invoice.bolt11);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setAmount("");
    setSelectedGame("");
    setInvoice(null);
    setStatus("idle");
    setError("");
    setSatsPreview(null);
    setSecondsLeft(0);
    setPaidUsd(null);
    setPaidAt(null);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rr-card" style={{ padding: 24, marginBottom: 28, maxWidth: 420 }}>
      <div className="rr-display" style={{ color: TEXT, fontSize: 16, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
        {t.lightningTitle}
      </div>
      <div style={{ color: TEXT_DIM, fontSize: 13, marginBottom: 16 }}>{t.lightningSubtitle}</div>

      {status === "idle" || status === "error" || status === "creating" ? (
        <form onSubmit={createInvoice} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={t.lightningAmountPlaceholder}
            className="rr-input"
          />
          {games && games.length > 0 ? (
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              className="rr-input"
              style={{ cursor: "pointer" }}
            >
              <option value="">{t.lightningGamePlaceholder}</option>
              {games.map((g) => (
                <option key={g.id} value={g.name}>{g.name}</option>
              ))}
            </select>
          ) : null}
          {error ? <div style={{ color: EMBER_BRIGHT, fontSize: 13 }}>{error}</div> : null}
          <button type="submit" className="rr-btn-primary" style={{ padding: "10px 0", fontSize: 14 }} disabled={status === "creating"}>
            {status === "creating" ? "Generating invoice..." : t.lightningGenerateBtn}
          </button>
        </form>
      ) : null}

      {(status === "waiting" || status === "paid") && invoice ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          {status === "waiting" ? (
            <>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(invoice.bolt11)}`}
                alt="Lightning invoice QR code"
                style={{ width: 200, height: 200, background: "#fff", padding: 8 }}
              />
              <div style={{ color: TEXT_DIM, fontSize: 13, textAlign: "center" }}>
                {t.lightningWaitingText}
                {satsPreview ? <div style={{ color: GOLD, marginTop: 4 }}>{satsPreview.toLocaleString()} sats</div> : null}
              </div>
              <button type="button" onClick={copyInvoice} className="rr-btn-ghost" style={{ padding: "8px 16px", fontSize: 13, width: "100%" }}>
                {copied ? "Copied!" : t.lightningCopyBtn}
              </button>
              <div style={{ color: GOLD, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                <span className="rr-crest-gem" style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, display: "inline-block" }} />
                {t.lightningWaitingStatus}
              </div>
              <div style={{ color: secondsLeft <= 60 ? EMBER_BRIGHT : TEXT_FAINT, fontSize: 13 }}>
                Expires in {formatTime(secondsLeft)}
              </div>
            </>
          ) : (
            <>
              <div style={{ color: "#7fbf6a", fontSize: 32 }}>&#10003;</div>
              <div className="rr-display" style={{ color: TEXT, fontSize: 16, fontWeight: 700 }}>{t.lightningPaidText}</div>
              <canvas
                ref={canvasRef}
                style={{ width: "100%", maxWidth: 300, borderRadius: 6, border: `1px solid ${BORDER}` }}
              />
              <button type="button" onClick={downloadReceipt} className="rr-btn-primary" style={{ padding: "10px 20px", fontSize: 14, width: "100%" }}>
                {t.lightningDownloadReceiptBtn}
              </button>
              <div style={{ color: TEXT_FAINT, fontSize: 12, textAlign: "center" }}>
                {t.lightningReceiptNote}
              </div>
            </>
          )}
          <button type="button" onClick={reset} className="rr-btn-ghost" style={{ padding: "7px 14px", fontSize: 12 }}>
            {status === "paid" ? "Make another payment" : "Cancel"}
          </button>
        </div>
      ) : null}

      {status === "timedout" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
          <div style={{ color: EMBER_BRIGHT, fontSize: 32 }}>&#9888;</div>
          <div className="rr-display" style={{ color: TEXT, fontSize: 16, fontWeight: 700 }}>{t.lightningExpiredTitle}</div>
          <div style={{ color: TEXT_DIM, fontSize: 13 }}>
            {t.lightningExpiredText}
          </div>
          <button type="button" onClick={reset} className="rr-btn-primary" style={{ padding: "10px 20px", fontSize: 14 }}>
            {t.lightningNewInvoiceBtn}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CashTapPay({ enabled, games }) {
  const t = useText();
  const [amount, setAmount] = useState("");
  const [selectedGame, setSelectedGame] = useState("");
  const [status, setStatus] = useState("idle"); // idle | creating | redirecting | error
  const [error, setError] = useState("");

  if (!enabled) return null;

  const startCheckout = async (e) => {
    e.preventDefault();
    const usd = parseFloat(amount);
    if (!usd || usd < 0.5) {
      setError("Enter a valid amount (minimum $0.50).");
      return;
    }
    setError("");
    setStatus("creating");
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: usd,
          line_items: [{ name: selectedGame || "Raizen Royale payment", quantity: 1, unit_amount: usd }],
          metadata: selectedGame ? { game: selectedGame } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error((data.error && data.error.message) || "Could not start checkout.");
      }
      setStatus("redirecting");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Could not start checkout. Try again.");
      setStatus("error");
    }
  };

  return (
    <div className="rr-card" style={{ padding: 24, marginBottom: 28, maxWidth: 420 }}>
      <div className="rr-display" style={{ color: TEXT, fontSize: 16, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
        {t.cashtapTitle}
      </div>
      <div style={{ color: TEXT_DIM, fontSize: 13, marginBottom: 16 }}>{t.cashtapSubtitle}</div>
      <form onSubmit={startCheckout} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="Amount in USD (e.g. 5.00)"
          className="rr-input"
        />
        {games && games.length > 0 ? (
          <select value={selectedGame} onChange={(e) => setSelectedGame(e.target.value)} className="rr-input" style={{ cursor: "pointer" }}>
            <option value="">For which game? (optional)</option>
            {games.map((g) => (
              <option key={g.id} value={g.name}>{g.name}</option>
            ))}
          </select>
        ) : null}
        {error ? <div style={{ color: EMBER_BRIGHT, fontSize: 13 }}>{error}</div> : null}
        <button type="submit" className="rr-btn-primary" style={{ padding: "10px 0", fontSize: 14 }} disabled={status === "creating" || status === "redirecting"}>
          {status === "creating" ? "Preparing checkout..." : status === "redirecting" ? "Redirecting..." : t.continueCheckoutBtn}
        </button>
      </form>
    </div>
  );
}

function NOWPaymentsPay({ enabled, games }) {
  const t = useText();
  const [amount, setAmount] = useState("");
  const [selectedGame, setSelectedGame] = useState("");
  const [status, setStatus] = useState("idle"); // idle | creating | waiting | paid | error
  const [error, setError] = useState("");
  const [paymentId, setPaymentId] = useState(null);
  const [paidUsd, setPaidUsd] = useState(null);
  const [paidAt, setPaidAt] = useState(null);
  const canvasRef = React.useRef(null);

  if (!enabled) return null;

  const startPayment = async (e) => {
    e.preventDefault();
    const usd = parseFloat(amount);
    if (!usd || usd < 1) {
      setError("Enter a valid amount (minimum $1).");
      return;
    }
    setError("");
    setStatus("creating");
    try {
      const res = await fetch("/api/create-nowpayments-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: usd,
          orderDescription: selectedGame ? `Raizen Royale - ${selectedGame}` : "Raizen Royale payment",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.invoice_url) {
        throw new Error(data.error || "Could not create invoice.");
      }
      setPaidUsd(usd);
      setPaymentId(data.id);
      window.open(data.invoice_url, "_blank", "noopener,noreferrer");
      setStatus("waiting");
    } catch (err) {
      setError(err.message || "Could not start checkout. Try again.");
      setStatus("error");
    }
  };

  useEffect(() => {
    if (status !== "waiting" || !paymentId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/nowpayments-status?payment_id=${paymentId}`);
        const data = await res.json();
        if (data.payment_status === "finished" || data.payment_status === "confirmed") {
          setPaidAt(new Date());
          setStatus("paid");
          clearInterval(interval);
        }
      } catch (err) {
        // keep polling silently
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [status, paymentId]);

  const drawReceipt = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = 600, H = 680;
    canvas.width = W;
    canvas.height = H;

    ctx.fillStyle = "#0b0906";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#4a380f";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, W - 32, H - 32);

    ctx.fillStyle = "#F5CD5C";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RAIZEN ROYALE", W / 2, 80);
    ctx.fillStyle = "#9C8F72";
    ctx.font = "13px sans-serif";
    ctx.fillText("PAYMENT RECEIPT", W / 2, 105);

    ctx.strokeStyle = "#332711";
    ctx.beginPath();
    ctx.moveTo(60, 130);
    ctx.lineTo(W - 60, 130);
    ctx.stroke();

    ctx.fillStyle = "#1a3d1a";
    ctx.fillRect(W / 2 - 70, 155, 140, 40);
    ctx.fillStyle = "#7fbf6a";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("\u2713 PAID", W / 2, 181);

    ctx.fillStyle = "#F2E7CE";
    ctx.font = "bold 44px sans-serif";
    ctx.fillText(`$${paidUsd ? paidUsd.toFixed(2) : "0.00"}`, W / 2, 260);

    const details = [
      ["Game", selectedGame || "\u2014"],
      ["Method", "Card / Apple Pay / Google Pay"],
      ["Date", (paidAt || new Date()).toLocaleString()],
      ["Payment ID", paymentId ? String(paymentId) : "\u2014"],
    ];
    let y = 320;
    ctx.textAlign = "left";
    details.forEach(([label, value]) => {
      ctx.fillStyle = "#6B5F48";
      ctx.font = "13px sans-serif";
      ctx.fillText(label.toUpperCase(), 70, y);
      ctx.fillStyle = "#F2E7CE";
      ctx.font = "16px sans-serif";
      ctx.fillText(value, 70, y + 22);
      y += 60;
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "#6B5F48";
    ctx.font = "12px sans-serif";
    ctx.fillText("Keep this receipt as proof of payment", W / 2, H - 50);
    ctx.fillStyle = "#E3B23C";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("\u265B raizenroyale.shop", W / 2, H - 28);
  };

  useEffect(() => {
    if (status === "paid") {
      setTimeout(drawReceipt, 50);
    }
  }, [status]);

  const downloadReceipt = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `raizen-royale-receipt-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const reset = () => {
    setAmount("");
    setSelectedGame("");
    setStatus("idle");
    setError("");
    setPaymentId(null);
    setPaidUsd(null);
    setPaidAt(null);
  };

  return (
    <div className="rr-card" style={{ padding: 24, marginBottom: 28, maxWidth: 420 }}>
      <div className="rr-display" style={{ color: TEXT, fontSize: 16, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
        {t.nowpaymentsTitle}
      </div>
      <div style={{ color: TEXT_DIM, fontSize: 13, marginBottom: 16 }}>{t.nowpaymentsSubtitle}</div>

      {status === "idle" || status === "error" || status === "creating" ? (
        <form onSubmit={startPayment} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="Amount in USD (e.g. 5.00)"
            className="rr-input"
          />
          {games && games.length > 0 ? (
            <select value={selectedGame} onChange={(e) => setSelectedGame(e.target.value)} className="rr-input" style={{ cursor: "pointer" }}>
              <option value="">For which game? (optional)</option>
              {games.map((g) => (
                <option key={g.id} value={g.name}>{g.name}</option>
              ))}
            </select>
          ) : null}
          {error ? <div style={{ color: EMBER_BRIGHT, fontSize: 13 }}>{error}</div> : null}
          <button type="submit" className="rr-btn-primary" style={{ padding: "10px 0", fontSize: 14 }} disabled={status === "creating"}>
            {status === "creating" ? "Preparing checkout..." : t.continueCheckoutBtn}
          </button>
        </form>
      ) : null}

      {status === "waiting" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
          <div style={{ color: GOLD, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <span className="rr-crest-gem" style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, display: "inline-block" }} />
            Waiting for payment...
          </div>
          <div style={{ color: TEXT_DIM, fontSize: 13 }}>
            Complete your payment in the tab that opened. This page will update automatically once it's confirmed.
          </div>
          <button type="button" onClick={reset} className="rr-btn-ghost" style={{ padding: "7px 14px", fontSize: 12 }}>
            Cancel
          </button>
        </div>
      ) : null}

      {status === "paid" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ color: "#7fbf6a", fontSize: 32 }}>&#10003;</div>
          <div className="rr-display" style={{ color: TEXT, fontSize: 16, fontWeight: 700 }}>Payment received!</div>
          <canvas ref={canvasRef} style={{ width: "100%", maxWidth: 300, borderRadius: 6, border: `1px solid ${BORDER}` }} />
          <button type="button" onClick={downloadReceipt} className="rr-btn-primary" style={{ padding: "10px 20px", fontSize: 14, width: "100%" }}>
            Download receipt
          </button>
          <div style={{ color: TEXT_FAINT, fontSize: 12, textAlign: "center" }}>
            Save this image and send it to us as proof of payment.
          </div>
          <button type="button" onClick={reset} className="rr-btn-ghost" style={{ padding: "7px 14px", fontSize: 12 }}>
            Make another payment
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CashOutPage({ games, settings, cashoutFields, saveCashoutRequest }) {
  const [game, setGame] = useState("");
  const [customGame, setCustomGame] = useState("");
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [values, setValues] = useState({});
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const activeFields = (cashoutFields || []).filter(f => f.active !== false);
  const paymentFields = activeFields.filter(f => f.type === "payment");
  const selectedPayment = paymentFields.find(f => f.id === method);

  useEffect(() => {
    if (!selectedPayment && paymentFields.length) setMethod(paymentFields[0].id);
  }, [paymentFields.map(f => f.id).join(","), selectedPayment]);

  const setField = (id, value) => setValues(v => ({ ...v, [id]: value }));

  const submit = async (e) => {
    e.preventDefault(); setError("");
    if (!game) return setError("Please select a game.");
    if (game === "__custom" && !customGame.trim()) return setError("Enter the custom game name.");
    if (!username.trim()) return setError("Enter your game username.");
    const usd = Number(amount);
    if (!Number.isFinite(usd) || usd <= 0) return setError("Enter a valid cash-out amount.");
    if (!selectedPayment) return setError("Please select a payment method.");
    if (!String(values[selectedPayment.id] || "").trim()) return setError(`Enter your ${selectedPayment.name} details.`);
    for (const f of activeFields.filter(f => f.type === "text" && f.required)) {
      if (!String(values[f.id] || "").trim()) return setError(`Enter ${f.name}.`);
    }
    setStatus("submitting");
    try {
      const finalGame = game === "__custom" ? customGame.trim() : game;
      const request = {
        id: uid(), game: finalGame, gameId: game === "__custom" ? "custom" : game,
        gameUsername: username.trim(), amount: Number(usd.toFixed(2)),
        paymentMethod: selectedPayment.name, paymentDetails: String(values[selectedPayment.id]).trim(),
        extraFields: Object.fromEntries(activeFields.filter(f => f.type === "text").map(f => [f.name, String(values[f.id] || "").trim()])),
        status: "pending", createdAt: Date.now()
      };
      const saved = await saveCashoutRequest(request);
      if (!saved) throw new Error("save failed");
      const template = settings.cashoutMessageTemplate || "Hello, I would like to request a cash-out.\n\nGame: {game}\nGame Username: {username}\nCash-Out Amount: ${amount}\nPayment Method: {method}\nPayment Details: {details}\nRequest ID: {requestId}";
      const message = template.replaceAll("{game}", finalGame).replaceAll("{username}", username.trim()).replaceAll("{amount}", Number(usd).toFixed(2)).replaceAll("{method}", selectedPayment.name).replaceAll("{details}", String(values[selectedPayment.id]).trim()).replaceAll("{requestId}", request.id);
      const meta = settings.cashoutMetaLink || settings.metaLink || "https://facebook.com/";
      const target = settings.messengerUsername ? `https://m.me/${settings.messengerUsername}?text=${encodeURIComponent(message)}` : `${meta}${meta.includes("?") ? "&" : "?"}text=${encodeURIComponent(message)}`;
      setStatus("redirecting"); window.location.href = target;
    } catch (err) { console.error(err); setError("Could not submit the cash-out request. Please try again."); setStatus("idle"); }
  };

  if (settings.cashoutEnabled === false) return <div className="rr-page"><div className="rr-cashout-shell"><SectionHeading eyebrow="Cash out" title="Cash-Out unavailable" subtitle="Cash-out requests are currently disabled." /></div></div>;
  return <div className="rr-page"><div className="rr-cashout-shell">
    <SectionHeading eyebrow="Cash out" title="Request a Cash-Out" subtitle="Enter your game details and choose how you would like to receive your cash-out." />
    <form onSubmit={submit} className="rr-card rr-cashout-form">
      <div><label className="rr-form-label">Game <span className="rr-required">*</span></label><select value={game} onChange={e => setGame(e.target.value)} className="rr-input"><option value="">Select game</option>{games.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}<option value="__custom">Custom</option></select></div>
      {game === "__custom" ? <div><label className="rr-form-label">Custom Game Name <span className="rr-required">*</span></label><input value={customGame} onChange={e => setCustomGame(e.target.value)} className="rr-input" placeholder="Enter game name" /></div> : null}
      <div><label className="rr-form-label">Game Username <span className="rr-required">*</span></label><input value={username} onChange={e => setUsername(e.target.value)} className="rr-input" placeholder="Enter your game username" autoComplete="off" /></div>
      <div><label className="rr-form-label">Cash-Out Amount (USD) <span className="rr-required">*</span></label><input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="rr-input" placeholder="e.g. 100.00" inputMode="decimal" /></div>
      {paymentFields.length ? <div><label className="rr-form-label">Payment Method <span className="rr-required">*</span></label><div className="rr-method-grid">{paymentFields.map(f => <button type="button" key={f.id} onClick={() => setMethod(f.id)} className={`rr-method-option ${method === f.id ? "active" : ""}`}>{f.name}</button>)}</div>{selectedPayment ? <div style={{ marginTop: 12 }}><label className="rr-form-label">{selectedPayment.name} <span className="rr-required">*</span></label><input value={values[selectedPayment.id] || ""} onChange={e => setField(selectedPayment.id, e.target.value)} className="rr-input" placeholder={selectedPayment.placeholder || `Enter your ${selectedPayment.name} details`} autoComplete="off" /></div> : null}</div> : <div className="rr-status-box">Payment methods are not configured yet. Please contact support.</div>}
      {activeFields.filter(f => f.type === "text").map(f => <div key={f.id}><label className="rr-form-label">{f.name}{f.required ? <span className="rr-required"> *</span> : null}</label><input value={values[f.id] || ""} onChange={e => setField(f.id, e.target.value)} className="rr-input" placeholder={f.placeholder || "Enter details"} /></div>)}
      {error ? <div style={{ color: EMBER_BRIGHT, fontSize: 13 }}>{error}</div> : null}
      <div className="rr-cashout-actions"><button type="submit" className="rr-btn-primary" style={{ padding: "12px 18px", fontSize: 14, flex: 1 }} disabled={status !== "idle"}>{status === "submitting" ? "Submitting..." : status === "redirecting" ? "Opening Messenger..." : "Submit Cash-Out"}</button><Link to="/" className="rr-btn-ghost" style={{ padding: "12px 18px", fontSize: 14, textDecoration: "none", textAlign: "center" }}>Cancel</Link></div>
    </form>
  </div></div>;
}

function PaymentsPage({ payments, lnbitsEnabled, cashtapEnabled, nowpaymentsEnabled, games }) {
  const t = useText();
  return (
    <div style={{ padding: "32px 24px 48px", maxWidth: 1100, margin: "0 auto" }}>
      <SectionHeading eyebrow={t.paymentsEyebrow} title={t.paymentsTitle} subtitle={t.paymentsSubtitle} />
      {lnbitsEnabled ? <LightningPay games={games} /> : null}
      <NOWPaymentsPay enabled={nowpaymentsEnabled} games={games} />
      <CashTapPay enabled={cashtapEnabled} games={games} />
      {payments.length === 0 ? (
        <div style={{ color: TEXT_FAINT, fontSize: 14 }}>{t.noPaymentsText}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 18 }}>
          {payments.map((p) => (
            <div key={p.id} className="rr-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center" }}>
              <div className="rr-display" style={{ color: TEXT, fontSize: 16, fontWeight: 700, textTransform: "uppercase" }}>{p.name}</div>
              {p.qr ? (
                <img src={p.qr} alt={p.name + " QR code"} style={{ width: 140, height: 140, objectFit: "contain", background: "#fff", padding: 6 }} />
              ) : null}
              {p.link ? (
                <a href={p.link} target="_blank" rel="noopener noreferrer" className="rr-btn-primary" style={{ fontSize: 13, padding: "8px 18px", textDecoration: "none" }}>
                  {t.openLinkBtn}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoginPage({ onLogin }) {
  const t = useText();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!user.trim() || !pass) { setError("Enter email and password."); return; }
    setBusy(true); setError("");
    try {
      await signInWithEmailAndPassword(auth, user.trim(), pass);
      onLogin();
    } catch {
      setError("Incorrect email or password.");
    } finally { setBusy(false); }
  };

  return (
    <div style={{ padding: "70px 20px", display: "flex", justifyContent: "center" }}>
      <form onSubmit={submit} className="rr-card" style={{ padding: 32, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}><Crest size={40} /></div>
        <div className="rr-display" style={{ color: TEXT, fontSize: 20, fontWeight: 700, textAlign: "center", textTransform: "uppercase" }}>{t.loginTitle}</div>
        <input value={user} onChange={(e) => setUser(e.target.value)} type="email" autoComplete="username" placeholder="Admin email" className="rr-input" />
        <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" autoComplete="current-password" placeholder={t.loginPasswordPlaceholder} className="rr-input" />
        {error ? <div style={{ color: EMBER_BRIGHT, fontSize: 13 }}>{error}</div> : null}
        <button disabled={busy} type="submit" className="rr-btn-primary" style={{ padding: "11px 0", fontSize: 14, opacity: busy ? .6 : 1 }}>{busy ? "Signing in..." : t.loginBtn}</button>
      </form>
    </div>
  );
}

function GameForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial ? initial.name : "");
  const [downloadLink, setDownloadLink] = useState(initial ? initial.downloadLink : "");
  const [flyer, setFlyer] = useState(initial ? initial.flyer : "");
  const [badge, setBadge] = useState(initial ? (initial.badge || "") : "");
  const [order, setOrder] = useState(initial && initial.order != null ? String(initial.order) : "");
  const [error, setError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFlyer(await fileToDataUrl(file));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Enter a game name."); return; }
    if (!downloadLink.trim()) { setError("Enter a download link."); return; }
    setError("");
    onSave({
      id: initial ? initial.id : uid(),
      name: name.trim(),
      downloadLink: downloadLink.trim(),
      flyer,
      badge: badge.trim(),
      order: order.trim() === "" ? 9999 : Number(order.trim()),
      createdAt: initial ? (initial.createdAt || Date.now()) : Date.now(),
    });
  };

  return (
    <form onSubmit={submit} className="rr-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
      <div className="rr-display" style={{ color: TEXT, fontSize: 16, fontWeight: 700, textTransform: "uppercase" }}>{initial ? "Edit game" : "Add game"}</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Game name" className="rr-input" />
      <input value={downloadLink} onChange={(e) => setDownloadLink(e.target.value)} placeholder="Download link (https://...)" className="rr-input" />
      <input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Badge text (optional, e.g. New, Popular, Hot)" className="rr-input" />
      <input value={order} onChange={(e) => setOrder(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Position number (1 = first, 2 = second...) - optional" className="rr-input" />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input type="file" accept="image/*" onChange={handleFile} style={{ color: TEXT_DIM, fontSize: 13 }} />
        {flyer ? <img src={flyer} alt="Flyer preview" style={{ width: 60, height: 40, objectFit: "cover" }} /> : null}
      </div>
      {error ? <div style={{ color: EMBER_BRIGHT, fontSize: 13 }}>{error}</div> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="rr-btn-primary" style={{ padding: "9px 18px", fontSize: 13 }}>Save</button>
        <button type="button" onClick={onCancel} className="rr-btn-ghost" style={{ padding: "9px 18px", fontSize: 13 }}>Cancel</button>
      </div>
    </form>
  );
}

function PaymentForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial ? initial.name : "");
  const [link, setLink] = useState(initial ? initial.link : "");
  const [qr, setQr] = useState(initial ? initial.qr : "");
  const [error, setError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setQr(await fileToDataUrl(file));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Enter a payment method name."); return; }
    if (!link.trim() && !qr) { setError("Add a link or a QR code."); return; }
    setError("");
    onSave({ id: initial ? initial.id : uid(), name: name.trim(), link: link.trim(), qr });
  };

  return (
    <form onSubmit={submit} className="rr-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
      <div className="rr-display" style={{ color: TEXT, fontSize: 16, fontWeight: 700, textTransform: "uppercase" }}>{initial ? "Edit payment method" : "Add payment method"}</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Method name (e.g. Easypaisa)" className="rr-input" />
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Payment link (optional if using QR)" className="rr-input" />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input type="file" accept="image/*" onChange={handleFile} style={{ color: TEXT_DIM, fontSize: 13 }} />
        {qr ? <img src={qr} alt="QR preview" style={{ width: 50, height: 50, objectFit: "cover", background: "#fff" }} /> : null}
      </div>
      {error ? <div style={{ color: EMBER_BRIGHT, fontSize: 13 }}>{error}</div> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="rr-btn-primary" style={{ padding: "9px 18px", fontSize: 13 }}>Save</button>
        <button type="button" onClick={onCancel} className="rr-btn-ghost" style={{ padding: "9px 18px", fontSize: 13 }}>Cancel</button>
      </div>
    </form>
  );
}

function CashOutAdmin({ fields, onSave, cashouts, settings, setSettings, onUpdateRequest }) {
  const defaults = [
    { id: "cashapp", name: "Cash App", type: "payment", placeholder: "$cashtag", required: true, active: true },
    { id: "chime", name: "Chime", type: "payment", placeholder: "Chime username / phone / email", required: true, active: true },
    { id: "paypal", name: "PayPal", type: "payment", placeholder: "PayPal email", required: true, active: true },
  ];
  const [local, setLocal] = useState((fields && fields.length ? fields : defaults).map(f => ({...f})));
  const [newName, setNewName] = useState(""); const [newPlaceholder, setNewPlaceholder] = useState(""); const [newType, setNewType] = useState("payment"); const [newRequired, setNewRequired] = useState(false); const [msg, setMsg] = useState("");
  const [template, setTemplate] = useState(settings.cashoutMessageTemplate || defaultsMessage());
  function defaultsMessage(){ return "Hello, I would like to request a cash-out.\n\nGame: {game}\nGame Username: {username}\nCash-Out Amount: ${amount}\nPayment Method: {method}\nPayment Details: {details}\nRequest ID: {requestId}"; }
  useEffect(() => setLocal((fields && fields.length ? fields : defaults).map(f => ({...f}))), [fields]);
  const persist = next => { setLocal(next); onSave(next); setMsg("Saved."); setTimeout(() => setMsg(""), 1600); };
  const add = e => { e.preventDefault(); if (!newName.trim()) return; persist([...local, { id: uid(), name: newName.trim(), type: newType, placeholder: newPlaceholder.trim(), required: newRequired, active: true }]); setNewName(""); setNewPlaceholder(""); setNewRequired(false); };
  const update = (id, patch) => persist(local.map(f => f.id === id ? {...f, ...patch} : f));
  const remove = id => persist(local.filter(f => f.id !== id));
  const saveTemplate = () => { setSettings({...settings, cashoutMessageTemplate: template}); setMsg("Message template saved."); setTimeout(() => setMsg(""), 1600); };
  const toggleEnabled = e => setSettings({...settings, cashoutEnabled: e.target.checked});
  const sorted = [...(cashouts || [])].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  return <div style={{display:"flex",flexDirection:"column",gap:20}}>
    <div className="rr-card" style={{padding:20}}><div className="rr-display" style={{color:TEXT,fontSize:16,fontWeight:700,textTransform:"uppercase",marginBottom:5}}>Cash-Out settings</div><label style={{color:TEXT_DIM,fontSize:13,display:"flex",gap:8,alignItems:"center",marginBottom:14}}><input type="checkbox" checked={settings.cashoutEnabled !== false} onChange={toggleEnabled}/> Enable Cash-Out page</label><label style={{color:TEXT_DIM,fontSize:12,display:"block",marginBottom:6}}>Cash-Out Meta/Facebook fallback link</label><input className="rr-input" value={settings.cashoutMetaLink || ""} onChange={e=>setSettings({...settings,cashoutMetaLink:e.target.value})} placeholder="https://facebook.com/yourpage"/><div style={{color:TEXT_FAINT,fontSize:11,marginTop:7}}>If Messenger username is configured, the request opens Messenger with a prefilled message.</div></div>
    <div className="rr-card" style={{padding:20}}><div className="rr-display" style={{color:TEXT,fontSize:16,fontWeight:700,textTransform:"uppercase",marginBottom:5}}>Cash-Out fields</div><div style={{color:TEXT_DIM,fontSize:13,marginBottom:15}}>Add/remove payment methods or extra fields. Active payment methods appear as choices on the user form.</div>{local.map(f=><div key={f.id} className="rr-card" style={{padding:12,marginBottom:9,display:"grid",gridTemplateColumns:"1fr auto auto",gap:9,alignItems:"center"}}><div><div style={{color:TEXT,fontSize:14,fontWeight:600}}>{f.name}</div><div style={{color:TEXT_FAINT,fontSize:11}}>{f.type === "payment" ? "Payment method" : "Extra field"}</div></div><label style={{color:TEXT_DIM,fontSize:11}}><input type="checkbox" checked={f.active!==false} onChange={e=>update(f.id,{active:e.target.checked})}/> Active</label><button type="button" onClick={()=>remove(f.id)} className="rr-btn-danger" style={{padding:"6px 10px",fontSize:11}}>Remove</button><input value={f.name} onChange={e=>update(f.id,{name:e.target.value})} className="rr-input" style={{gridColumn:"1/-1"}}/><input value={f.placeholder||""} onChange={e=>update(f.id,{placeholder:e.target.value})} className="rr-input" style={{gridColumn:"1/-1"}} placeholder="Placeholder"/></div>)}</div>
    <form onSubmit={add} className="rr-card" style={{padding:20,display:"flex",flexDirection:"column",gap:10}}><div className="rr-display" style={{color:TEXT,fontSize:15,fontWeight:700,textTransform:"uppercase"}}>Add field</div><input value={newName} onChange={e=>setNewName(e.target.value)} className="rr-input" placeholder="Field name (e.g. Venmo)"/><input value={newPlaceholder} onChange={e=>setNewPlaceholder(e.target.value)} className="rr-input" placeholder="Placeholder / hint"/><select value={newType} onChange={e=>setNewType(e.target.value)} className="rr-input"><option value="payment">Payment method</option><option value="text">Extra text field</option></select><label style={{color:TEXT_DIM,fontSize:12}}><input type="checkbox" checked={newRequired} onChange={e=>setNewRequired(e.target.checked)}/> Required</label><button className="rr-btn-primary" style={{padding:"10px 16px",fontSize:13}}>Add field</button></form>
    <div className="rr-card" style={{padding:20,display:"flex",flexDirection:"column",gap:10}}><div className="rr-display" style={{color:TEXT,fontSize:15,fontWeight:700,textTransform:"uppercase"}}>Messenger message template</div><div style={{color:TEXT_FAINT,fontSize:12}}>Variables: {'{game}'}, {'{username}'}, {'{amount}'}, {'{method}'}, {'{details}'}, {'{requestId}'}</div><textarea value={template} onChange={e=>setTemplate(e.target.value)} className="rr-input" rows={8} style={{resize:"vertical"}}/><button type="button" className="rr-btn-primary" onClick={saveTemplate} style={{padding:"10px 16px",fontSize:13}}>Save message template</button></div>
    <div className="rr-card" style={{padding:20}}><div className="rr-display" style={{color:TEXT,fontSize:15,fontWeight:700,textTransform:"uppercase",marginBottom:12}}>Cash-Out requests</div>{sorted.length===0?<div style={{color:TEXT_FAINT,fontSize:13}}>No cash-out requests yet.</div>:<div style={{display:"flex",flexDirection:"column",gap:10}}>{sorted.map(r=>{ const status=(r.status||"pending").toLowerCase(); const pending=status==="pending"; return <div key={r.id} style={{border:`1px solid ${BORDER}`,padding:14,background:BG_RAISED,borderRadius:10}}><div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",alignItems:"center"}}><b style={{color:TEXT}}>{r.game}</b><b style={{color:GOLD}}>${Number(r.amount||0).toFixed(2)}</b></div><div style={{color:TEXT_DIM,fontSize:12,marginTop:6}}>Username: {r.gameUsername} · {r.paymentMethod}: {r.paymentDetails}</div><div style={{color:TEXT_FAINT,fontSize:11,marginTop:5}}>Request ID: {r.id} · {new Date(r.createdAt||Date.now()).toLocaleString()}</div><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginTop:12}}><span style={{display:"inline-flex",alignItems:"center",padding:"5px 9px",borderRadius:999,border:`1px solid ${BORDER}`,color:(status==="completed"||status==="approved")?"#7fbf6a":status==="rejected"?EMBER_BRIGHT:GOLD,fontSize:11,fontWeight:700,textTransform:"uppercase"}}>{status}</span>{pending?<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" className="rr-btn-primary" style={{padding:"8px 13px",fontSize:12}} onClick={()=>{if(window.confirm(`Approve cash-out ${r.id} for $${Number(r.amount||0).toFixed(2)}?`)) onUpdateRequest({...r,status:"approved",approvedAt:Date.now()});}}>Approve</button><button type="button" className="rr-btn-danger" style={{padding:"8px 13px",fontSize:12}} onClick={()=>{if(window.confirm(`Reject cash-out ${r.id}?`)) onUpdateRequest({...r,status:"rejected",rejectedAt:Date.now()});}}>Reject</button></div>:<div style={{color:TEXT_FAINT,fontSize:11}}>No action required</div>}</div></div>})}</div>}</div>
    {msg?<div style={{color:"#7fbf6a",fontSize:13}}>{msg}</div>:null}
  </div>;
}

function AdminPage({ games, saveGameItem, removeGameItem, payments, savePaymentItem, removePaymentItem, settings, setSettings, siteText, setSiteText, onLogout, stats, cashoutFields, saveCashoutFields, cashouts, onUpdateCashoutRequest }) {
  const [tab, setTab] = useState("games");
  const [editingGame, setEditingGame] = useState(null);
  const [showGameForm, setShowGameForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [metaLinkInput, setMetaLinkInput] = useState(settings.metaLink);
  const [messengerUsernameInput, setMessengerUsernameInput] = useState(settings.messengerUsername || "");
  const [whatsappLinkInput, setWhatsappLinkInput] = useState(settings.whatsappLink || "");
  const [discordLinkInput, setDiscordLinkInput] = useState(settings.discordLink || "");
  const [instagramLinkInput, setInstagramLinkInput] = useState(settings.instagramLink || "");
  const [lnbitsEnabledInput, setLnbitsEnabledInput] = useState(settings.lnbitsEnabled || false);
  const [cashtapEnabledInput, setCashtapEnabledInput] = useState(settings.cashtapEnabled || false);
  const [nowpaymentsEnabledInput, setNowpaymentsEnabledInput] = useState(settings.nowpaymentsEnabled || false);
  const [cashoutEnabledInput, setCashoutEnabledInput] = useState(settings.cashoutEnabled !== false);
  const [cashoutMetaLinkInput, setCashoutMetaLinkInput] = useState(settings.cashoutMetaLink || "");
  const [settingsMsg, setSettingsMsg] = useState("");
  const [textForm, setTextForm] = useState(siteText);
  const [textMsg, setTextMsg] = useState("");

  const saveGame = async (game) => {
    if (game.order != null && game.order !== 9999) {
      const others = games.filter((g) => g.id !== game.id);
      const conflicting = others
        .filter((g) => g.order != null && g.order >= game.order && g.order !== 9999)
        .sort((a, b) => a.order - b.order);
      let nextSlot = game.order + 1;
      for (const g of conflicting) {
        if (g.order < nextSlot) {
          await saveGameItem({ ...g, order: nextSlot });
          nextSlot += 1;
        } else {
          break;
        }
      }
    }
    await saveGameItem(game);
    setShowGameForm(false); setEditingGame(null);
  };
  const deleteGame = (id) => removeGameItem(id);

  const savePayment = (p) => {
    savePaymentItem(p);
    setShowPaymentForm(false); setEditingPayment(null);
  };
  const deletePayment = (id) => removePaymentItem(id);

  const saveSettings = (e) => {
    e.preventDefault();
    setSettings({
      ...settings,
      metaLink: metaLinkInput.trim() || settings.metaLink,
      messengerUsername: messengerUsernameInput.trim().replace(/^@/, ""),
      whatsappLink: whatsappLinkInput.trim(),
      discordLink: discordLinkInput.trim(),
      instagramLink: instagramLinkInput.trim(),
      lnbitsEnabled: lnbitsEnabledInput,
      cashtapEnabled: cashtapEnabledInput,
      nowpaymentsEnabled: nowpaymentsEnabledInput,
      cashoutEnabled: cashoutEnabledInput,
      cashoutMetaLink: cashoutMetaLinkInput.trim(),
    });
    setSettingsMsg("Settings saved.");
    setTimeout(() => setSettingsMsg(""), 2500);
  };

  const tabStyle = (t) => ({
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    color: tab === t ? GOLD_BRIGHT : TEXT_DIM,
    borderBottom: tab === t ? `2px solid ${GOLD}` : "2px solid transparent",
    paddingBottom: 6,
  });

  return (
    <div style={{ padding: "32px 24px 48px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <SectionHeading eyebrow="Command center" title="Admin panel" />
        <button onClick={onLogout} className="rr-btn-ghost" style={{ padding: "8px 16px", fontSize: 13 }}>
          Log out
        </button>
      </div>
      <div style={{ display: "flex", gap: 22, marginBottom: 24, flexWrap: "wrap" }}>
        <div onClick={() => setTab("games")} style={tabStyle("games")}>Games</div>
        <div onClick={() => setTab("payments")} style={tabStyle("payments")}>Payment methods</div>
        <div onClick={() => setTab("cashout")} style={tabStyle("cashout")}>Cash-Out</div>
        <div onClick={() => setTab("analytics")} style={tabStyle("analytics")}>Analytics</div>
        <div onClick={() => setTab("text")} style={tabStyle("text")}>Site Text</div>
        <div onClick={() => setTab("settings")} style={tabStyle("settings")}>Settings</div>
      </div>

      {tab === "games" && (
        <div>
          {showGameForm ? (
            <GameForm initial={editingGame} onSave={saveGame} onCancel={() => { setShowGameForm(false); setEditingGame(null); }} />
          ) : (
            <button onClick={() => setShowGameForm(true)} className="rr-btn-primary" style={{ padding: "10px 18px", fontSize: 13, marginBottom: 20 }}>
              Add game
            </button>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...games].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999)).map((g) => (
              <div key={g.id} className="rr-card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ width: 28, textAlign: "center", color: GOLD, fontWeight: 700, fontSize: 13 }}>
                  {g.order != null && g.order !== 9999 ? `#${g.order}` : "\u2013"}
                </div>
                {g.flyer ? (
                  <img src={g.flyer} alt={g.name} style={{ width: 64, height: 42, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 64, height: 42, background: BG_RAISED }} />
                )}
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{g.name}</div>
                  <div style={{ color: TEXT_FAINT, fontSize: 12, wordBreak: "break-all" }}>{g.downloadLink}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setEditingGame(g); setShowGameForm(true); }} className="rr-btn-ghost" style={{ padding: "7px 14px", fontSize: 12 }}>Edit</button>
                  <button onClick={() => deleteGame(g.id)} className="rr-btn-danger" style={{ padding: "7px 14px", fontSize: 12 }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div>
          {showPaymentForm ? (
            <PaymentForm initial={editingPayment} onSave={savePayment} onCancel={() => { setShowPaymentForm(false); setEditingPayment(null); }} />
          ) : (
            <button onClick={() => setShowPaymentForm(true)} className="rr-btn-primary" style={{ padding: "10px 18px", fontSize: 13, marginBottom: 20 }}>
              Add payment method
            </button>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {payments.map((p) => (
              <div key={p.id} className="rr-card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                {p.qr ? (
                  <img src={p.qr} alt={p.name} style={{ width: 42, height: 42, objectFit: "cover", background: "#fff" }} />
                ) : (
                  <div style={{ width: 42, height: 42, background: BG_RAISED }} />
                )}
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: TEXT_FAINT, fontSize: 12, wordBreak: "break-all" }}>{p.link}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setEditingPayment(p); setShowPaymentForm(true); }} className="rr-btn-ghost" style={{ padding: "7px 14px", fontSize: 12 }}>Edit</button>
                  <button onClick={() => deletePayment(p.id)} className="rr-btn-danger" style={{ padding: "7px 14px", fontSize: 12 }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "cashout" && <CashOutAdmin fields={cashoutFields} onSave={saveCashoutFields} cashouts={cashouts} settings={settings} setSettings={setSettings} onUpdateRequest={onUpdateCashoutRequest} />}

      {tab === "analytics" && (
        <div>
          <div className="rr-card" style={{ padding: 20, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: TEXT_DIM, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total site visits</div>
              <div className="rr-display" style={{ color: GOLD_BRIGHT, fontSize: 32, fontWeight: 700 }}>{stats.site_visits || 0}</div>
            </div>
          </div>
          <div style={{ color: TEXT_DIM, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            Downloads per game
          </div>
          {games.length === 0 ? (
            <div style={{ color: TEXT_FAINT, fontSize: 14 }}>No games added yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...games]
                .sort((a, b) => (stats["game_" + b.id] || 0) - (stats["game_" + a.id] || 0))
                .map((g) => (
                  <div key={g.id} className="rr-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{g.name}</div>
                    <div className="rr-display" style={{ color: GOLD, fontSize: 16, fontWeight: 700 }}>{stats["game_" + g.id] || 0}</div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {tab === "text" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSiteText(textForm);
            setTextMsg("Site text saved.");
            setTimeout(() => setTextMsg(""), 2500);
          }}
          className="rr-card"
          style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18, maxWidth: 480 }}
        >
          <div>
            <div className="rr-display" style={{ color: TEXT, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Brand</div>
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Site name</label>
            <input value={textForm.siteName} onChange={(e) => setTextForm({ ...textForm, siteName: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Nav: Games label</label>
            <input value={textForm.navGames} onChange={(e) => setTextForm({ ...textForm, navGames: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Nav: Payment methods label</label>
            <input value={textForm.navPayments} onChange={(e) => setTextForm({ ...textForm, navPayments: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Nav: Contact support label</label>
            <input value={textForm.navContact} onChange={(e) => setTextForm({ ...textForm, navContact: e.target.value })} className="rr-input" />
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <div className="rr-display" style={{ color: TEXT, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Games page</div>
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Eyebrow (small label above title)</label>
            <input value={textForm.homeEyebrow} onChange={(e) => setTextForm({ ...textForm, homeEyebrow: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Title</label>
            <input value={textForm.homeTitle} onChange={(e) => setTextForm({ ...textForm, homeTitle: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Subtitle</label>
            <input value={textForm.homeSubtitle} onChange={(e) => setTextForm({ ...textForm, homeSubtitle: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Search box placeholder</label>
            <input value={textForm.searchPlaceholder} onChange={(e) => setTextForm({ ...textForm, searchPlaceholder: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"No games" message</label>
            <input value={textForm.noGamesText} onChange={(e) => setTextForm({ ...textForm, noGamesText: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Download now" button</label>
            <input value={textForm.downloadBtn} onChange={(e) => setTextForm({ ...textForm, downloadBtn: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Need account?" button</label>
            <input value={textForm.needAccountBtn} onChange={(e) => setTextForm({ ...textForm, needAccountBtn: e.target.value })} className="rr-input" />
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <div className="rr-display" style={{ color: TEXT, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Payments page</div>
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Eyebrow</label>
            <input value={textForm.paymentsEyebrow} onChange={(e) => setTextForm({ ...textForm, paymentsEyebrow: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Title</label>
            <input value={textForm.paymentsTitle} onChange={(e) => setTextForm({ ...textForm, paymentsTitle: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Subtitle</label>
            <input value={textForm.paymentsSubtitle} onChange={(e) => setTextForm({ ...textForm, paymentsSubtitle: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"No payment methods" message</label>
            <input value={textForm.noPaymentsText} onChange={(e) => setTextForm({ ...textForm, noPaymentsText: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Open link" button</label>
            <input value={textForm.openLinkBtn} onChange={(e) => setTextForm({ ...textForm, openLinkBtn: e.target.value })} className="rr-input" />
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <div className="rr-display" style={{ color: TEXT, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Lightning payment</div>
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Title</label>
            <input value={textForm.lightningTitle} onChange={(e) => setTextForm({ ...textForm, lightningTitle: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Subtitle</label>
            <input value={textForm.lightningSubtitle} onChange={(e) => setTextForm({ ...textForm, lightningSubtitle: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Amount field placeholder</label>
            <input value={textForm.lightningAmountPlaceholder} onChange={(e) => setTextForm({ ...textForm, lightningAmountPlaceholder: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Game dropdown placeholder</label>
            <input value={textForm.lightningGamePlaceholder} onChange={(e) => setTextForm({ ...textForm, lightningGamePlaceholder: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Generate invoice" button</label>
            <input value={textForm.lightningGenerateBtn} onChange={(e) => setTextForm({ ...textForm, lightningGenerateBtn: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Waiting-for-scan text</label>
            <input value={textForm.lightningWaitingText} onChange={(e) => setTextForm({ ...textForm, lightningWaitingText: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Copy invoice" button</label>
            <input value={textForm.lightningCopyBtn} onChange={(e) => setTextForm({ ...textForm, lightningCopyBtn: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Waiting for payment..." status</label>
            <input value={textForm.lightningWaitingStatus} onChange={(e) => setTextForm({ ...textForm, lightningWaitingStatus: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Payment received!" text</label>
            <input value={textForm.lightningPaidText} onChange={(e) => setTextForm({ ...textForm, lightningPaidText: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Download receipt" button</label>
            <input value={textForm.lightningDownloadReceiptBtn} onChange={(e) => setTextForm({ ...textForm, lightningDownloadReceiptBtn: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Receipt reminder note</label>
            <input value={textForm.lightningReceiptNote} onChange={(e) => setTextForm({ ...textForm, lightningReceiptNote: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Invoice expired" title</label>
            <input value={textForm.lightningExpiredTitle} onChange={(e) => setTextForm({ ...textForm, lightningExpiredTitle: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Invoice expired" text</label>
            <input value={textForm.lightningExpiredText} onChange={(e) => setTextForm({ ...textForm, lightningExpiredText: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Generate new invoice" button</label>
            <input value={textForm.lightningNewInvoiceBtn} onChange={(e) => setTextForm({ ...textForm, lightningNewInvoiceBtn: e.target.value })} className="rr-input" />
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <div className="rr-display" style={{ color: TEXT, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Card / CashApp payments</div>
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>CashTap section title</label>
            <input value={textForm.cashtapTitle} onChange={(e) => setTextForm({ ...textForm, cashtapTitle: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>CashTap section subtitle</label>
            <input value={textForm.cashtapSubtitle} onChange={(e) => setTextForm({ ...textForm, cashtapSubtitle: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>NOWPayments section title</label>
            <input value={textForm.nowpaymentsTitle} onChange={(e) => setTextForm({ ...textForm, nowpaymentsTitle: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>NOWPayments section subtitle</label>
            <input value={textForm.nowpaymentsSubtitle} onChange={(e) => setTextForm({ ...textForm, nowpaymentsSubtitle: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Continue to checkout" button</label>
            <input value={textForm.continueCheckoutBtn} onChange={(e) => setTextForm({ ...textForm, continueCheckoutBtn: e.target.value })} className="rr-input" />
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <div className="rr-display" style={{ color: TEXT, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Login page</div>
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Title</label>
            <input value={textForm.loginTitle} onChange={(e) => setTextForm({ ...textForm, loginTitle: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Username field placeholder</label>
            <input value={textForm.loginUsernamePlaceholder} onChange={(e) => setTextForm({ ...textForm, loginUsernamePlaceholder: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>Password field placeholder</label>
            <input value={textForm.loginPasswordPlaceholder} onChange={(e) => setTextForm({ ...textForm, loginPasswordPlaceholder: e.target.value })} className="rr-input" style={{ marginBottom: 10 }} />
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Log in" button</label>
            <input value={textForm.loginBtn} onChange={(e) => setTextForm({ ...textForm, loginBtn: e.target.value })} className="rr-input" />
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <div className="rr-display" style={{ color: TEXT, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Footer</div>
            <label style={{ color: TEXT_DIM, fontSize: 12, display: "block", marginBottom: 4 }}>"Connect with us" text</label>
            <input value={textForm.footerConnectText} onChange={(e) => setTextForm({ ...textForm, footerConnectText: e.target.value })} className="rr-input" />
          </div>

          {textMsg ? <div style={{ color: "#7fbf6a", fontSize: 13 }}>{textMsg}</div> : null}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="rr-btn-primary" style={{ padding: "11px 0", fontSize: 14, flex: 1 }}>Save site text</button>
            <button type="button" onClick={() => setTextForm(DEFAULT_TEXT)} className="rr-btn-ghost" style={{ padding: "11px 16px", fontSize: 13 }}>Reset to defaults</button>
          </div>
        </form>
      )}

      {tab === "settings" && (
        <form onSubmit={saveSettings} className="rr-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
          <div>
            <label style={{ color: TEXT_DIM, fontSize: 13, display: "block", marginBottom: 6 }}>Meta page link</label>
            <input value={metaLinkInput} onChange={(e) => setMetaLinkInput(e.target.value)} placeholder="https://facebook.com/yourpage" className="rr-input" style={{ marginBottom: 12 }} />
            <label style={{ color: TEXT_DIM, fontSize: 13, display: "block", marginBottom: 6 }}>Messenger username (for "Need account?" pre-filled message)</label>
            <input value={messengerUsernameInput} onChange={(e) => setMessengerUsernameInput(e.target.value)} placeholder="yourpageusername (from m.me/username)" className="rr-input" />
            <div style={{ color: TEXT_FAINT, fontSize: 12, marginTop: 8 }}>If set, "Need account?" opens Messenger with a pre-filled message naming the game. If left blank, it opens your Meta page link above instead.</div>
          </div>
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <label style={{ color: TEXT_DIM, fontSize: 13, display: "block", marginBottom: 6 }}>WhatsApp link</label>
            <input value={whatsappLinkInput} onChange={(e) => setWhatsappLinkInput(e.target.value)} placeholder="https://wa.me/923001234567" className="rr-input" style={{ marginBottom: 12 }} />
            <label style={{ color: TEXT_DIM, fontSize: 13, display: "block", marginBottom: 6 }}>Discord link</label>
            <input value={discordLinkInput} onChange={(e) => setDiscordLinkInput(e.target.value)} placeholder="https://discord.gg/yourserver" className="rr-input" style={{ marginBottom: 12 }} />
            <label style={{ color: TEXT_DIM, fontSize: 13, display: "block", marginBottom: 6 }}>Instagram link</label>
            <input value={instagramLinkInput} onChange={(e) => setInstagramLinkInput(e.target.value)} placeholder="https://instagram.com/yourpage" className="rr-input" />
            <div style={{ color: TEXT_FAINT, fontSize: 12, marginTop: 8 }}>Leave any blank to hide that icon from the footer.</div>
          </div>
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: TEXT_DIM, fontSize: 13 }}>
              <input type="checkbox" checked={lnbitsEnabledInput} onChange={(e) => setLnbitsEnabledInput(e.target.checked)} />
              Enable "Pay with Lightning"
            </label>
            <div style={{ color: TEXT_FAINT, fontSize: 12, marginTop: 8 }}>Lightning credentials stay server-side in Vercel environment variables.</div>
          </div>
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: TEXT_DIM, fontSize: 13 }}>
              <input type="checkbox" checked={cashtapEnabledInput} onChange={(e) => setCashtapEnabledInput(e.target.checked)} />
              Enable "Pay with Card / Bank / CashApp" (CashTap checkout)
            </label>
            <div style={{ color: TEXT_FAINT, fontSize: 12, marginTop: 8 }}>Only turn this on once CashTap confirms their checkout API is live. Requires CASHTAP_SECRET_KEY to be set in Vercel.</div>
          </div>
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: TEXT_DIM, fontSize: 13 }}>
              <input type="checkbox" checked={nowpaymentsEnabledInput} onChange={(e) => setNowpaymentsEnabledInput(e.target.checked)} />
              Enable "Pay with Card / Apple Pay" (NOWPayments checkout)
            </label>
            <div style={{ color: TEXT_FAINT, fontSize: 12, marginTop: 8 }}>Requires NOWPAYMENTS_API_KEY to be set in Vercel.</div>
          </div>
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: TEXT_DIM, fontSize: 13 }}>
              <input type="checkbox" checked={cashoutEnabledInput} onChange={(e) => setCashoutEnabledInput(e.target.checked)} />
              Enable Cash-Out page
            </label>
            <label style={{ color: TEXT_DIM, fontSize: 13, display: "block", marginTop: 12, marginBottom: 6 }}>Cash-Out Meta/Facebook fallback link</label>
            <input value={cashoutMetaLinkInput} onChange={(e) => setCashoutMetaLinkInput(e.target.value)} placeholder="https://facebook.com/yourpage" className="rr-input" />
            <div style={{ color: TEXT_FAINT, fontSize: 12, marginTop: 8 }}>Messenger username above takes priority and opens a pre-filled Messenger message.</div>
          </div>
          {settingsMsg ? <div style={{ color: "#7fbf6a", fontSize: 13 }}>{settingsMsg}</div> : null}
          <button type="submit" className="rr-btn-primary" style={{ padding: "11px 0", fontSize: 14 }}>Save settings</button>
        </form>
      )}
    </div>
  );
}

function AdminRoute({ isAdmin, setIsAdmin, games, saveGameItem, removeGameItem, payments, savePaymentItem, removePaymentItem, settings, setSettings, siteText, setSiteText, stats, cashoutFields, saveCashoutFields, cashouts, onUpdateCashoutRequest }) {
  if (!isAdmin) {
    return <LoginPage onLogin={() => setIsAdmin(true)} />;
  }
  return (
    <AdminPage
      games={games}
      saveGameItem={saveGameItem}
      removeGameItem={removeGameItem}
      payments={payments}
      savePaymentItem={savePaymentItem}
      removePaymentItem={removePaymentItem}
      settings={settings}
      setSettings={setSettings}
      siteText={siteText}
      setSiteText={setSiteText}
      onLogout={() => signOut(auth)}
      stats={stats}
      cashoutFields={cashoutFields}
      saveCashoutFields={saveCashoutFields}
      cashouts={cashouts}
      onUpdateCashoutRequest={onUpdateCashoutRequest}
    />
  );
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [games, setGamesState] = useState(SAMPLE_GAMES);
  const [payments, setPaymentsState] = useState([]);
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS);
  const [siteText, setSiteTextState] = useState(DEFAULT_TEXT);
  const [stats, setStats] = useState({});
  const [cashoutFields, setCashoutFieldsState] = useState([
    { id: "cashapp", name: "Cash App", type: "payment", placeholder: "$cashtag", required: true, active: true },
    { id: "chime", name: "Chime", type: "payment", placeholder: "Chime username / phone / email", required: true, active: true },
    { id: "paypal", name: "PayPal", type: "payment", placeholder: "PayPal email", required: true, active: true },
  ]);
  const [cashouts, setCashouts] = useState([]);

  useEffect(() => {
    let mounted = true;
    const unsubAuth = onAuthStateChanged(auth, (user) => setIsAdmin(!!user));
    (async () => {
      const g = await loadCollection("games", SAMPLE_GAMES);
      const p = await loadCollection("payments", []);
      const s = await loadDoc("settings", DEFAULT_SETTINGS);
      const txt = await loadDoc("siteText", DEFAULT_TEXT);
      const cf = await loadDoc("cashoutFields", null);
      const co = await loadCollection("cashouts", []);
      if (mounted) {
        setGamesState(g);
        setPaymentsState(p);
        setSettingsState({ ...DEFAULT_SETTINGS, ...s });
        setSiteTextState({ ...DEFAULT_TEXT, ...txt });
        if (cf && Array.isArray(cf) && cf.length) setCashoutFieldsState(cf);
        setCashouts(co);
        setLoaded(true);
      }
    })();

    const unsubGames = watchCollection("games", (v) => setGamesState(v));
    const unsubPayments = watchCollection("payments", (v) => setPaymentsState(v));
    const unsubSettings = watchDoc("settings", (v) => setSettingsState({ ...DEFAULT_SETTINGS, ...v }));
    const unsubText = watchDoc("siteText", (v) => setSiteTextState({ ...DEFAULT_TEXT, ...v }));
    const unsubStats = watchCounters((v) => setStats(v));
    const unsubCashoutFields = watchDoc("cashoutFields", v => { if (Array.isArray(v) && v.length) setCashoutFieldsState(v); });
    const unsubCashouts = watchCollection("cashouts", v => setCashouts(v));

    return () => {
      mounted = false;
      unsubGames();
      unsubPayments();
      unsubSettings();
      unsubText();
      unsubStats();
      unsubCashoutFields();
      unsubCashouts();
      unsubAuth();
    };
  }, []);

  const saveGameItem = useCallback((item) => saveItem("games", item), []);
  const removeGameItem = useCallback((id) => { deleteItem("games", id); }, []);
  const savePaymentItem = useCallback((item) => { saveItem("payments", item); }, []);
  const removePaymentItem = useCallback((id) => { deleteItem("payments", id); }, []);
  const setSettings = useCallback((next) => { setSettingsState(next); saveDoc("settings", next); }, []);
  const setSiteText = useCallback((next) => { setSiteTextState(next); saveDoc("siteText", next); }, []);
  const saveCashoutFields = useCallback((next) => { setCashoutFieldsState(next); saveDoc("cashoutFields", next); }, []);
  const saveCashoutRequest = useCallback((item) => saveItem("cashouts", item), []);
  const updateCashoutRequest = useCallback((item) => saveItem("cashouts", item), []);

  if (!loaded) {
    return (
      <div className="rr-root" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <GlobalStyle />
        <div className="rr-splash-crest">
          <Crest size={64} />
        </div>
        <div className="rr-display" style={{ color: TEXT, fontSize: 18, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 18 }}>
          Raizen <span style={{ color: GOLD_BRIGHT }}>Royale</span>
        </div>
        <div style={{ color: TEXT_FAINT, fontSize: 13, marginTop: 8 }}>Loading...</div>
      </div>
    );
  }

  return (
    <TextContext.Provider value={siteText}>
      <div className="rr-root">
        <GlobalStyle />
        <BackgroundSilhouette />
        <div className="rr-content">
          <TopBar metaLink={settings.metaLink} />
          <Routes>
            <Route path="/" element={<HomePage games={games} metaLink={settings.metaLink} messengerUsername={settings.messengerUsername} />} />
            <Route path="/payments" element={<PaymentsPage payments={payments} lnbitsEnabled={settings.lnbitsEnabled || false} cashtapEnabled={settings.cashtapEnabled} nowpaymentsEnabled={settings.nowpaymentsEnabled} games={games} />} />
            <Route path="/cashout" element={<CashOutPage games={games} settings={settings} cashoutFields={cashoutFields} saveCashoutRequest={saveCashoutRequest} />} />
            <Route
              path="/admin"
              element={
                <AdminRoute
                  isAdmin={isAdmin}
                  setIsAdmin={setIsAdmin}
                  games={games}
                  saveGameItem={saveGameItem}
                  removeGameItem={removeGameItem}
                  payments={payments}
                  savePaymentItem={savePaymentItem}
                  removePaymentItem={removePaymentItem}
                  settings={settings}
                  setSettings={setSettings}
                  siteText={siteText}
                  setSiteText={setSiteText}
                  stats={stats}
                  cashoutFields={cashoutFields}
                  saveCashoutFields={saveCashoutFields}
                  cashouts={cashouts}
                  onUpdateCashoutRequest={updateCashoutRequest}
                />
              }
            />
          </Routes>
          <Footer whatsappLink={settings.whatsappLink} discordLink={settings.discordLink} instagramLink={settings.instagramLink} />
        </div>
      </div>
    </TextContext.Provider>
  );
}
