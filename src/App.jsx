import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, Link, NavLink, useLocation } from "react-router-dom";
import { loadDoc, saveDoc, watchDoc, loadCollection, saveItem, deleteItem, watchCollection, watchCounters, auth, signOut, onAuthStateChanged } from "./firebase.js";
import { DEFAULT_SETTINGS, DEFAULT_TEXT, DEFAULT_CASHOUT_FIELDS, SAMPLE_GAMES, TextContext, useText } from "./text.js";
import { Icon, Crest, ToastProvider, useSpotlight } from "./ui.jsx";
import HomePage from "./Home.jsx";
import PaymentsPage from "./Payments.jsx";
import CashOutPage from "./CashOut.jsx";
import { LoginPage, AdminPage } from "./Admin.jsx";
import "./styles.css";

/* ---------- Background ---------- */
function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="orb o1" />
      <div className="orb o2" />
      <div className="orb o3" />
      <div className="grid-lines" />
      <div className="noise" />
      <div className="vignette" />
    </div>
  );
}

/* ---------- Nav ---------- */
function TopBar({ metaLink }) {
  const t = useText();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 12);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        document.documentElement.style.setProperty("--p", max > 0 ? (window.scrollY / max).toFixed(4) : "0");
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const support = metaLink || "https://facebook.com/";

  return (
    <>
      <div className="scroll-progress" aria-hidden="true" />
      <header className={`nav ${scrolled ? "scrolled" : ""}`}>
        <div className="nav-inner">
          <Link to="/" className="brand" aria-label={t.siteName}>
            <Crest size={36} />
            <span className="brand-name">{t.siteName}<small>CASINO</small></span>
          </Link>
          <nav className="nav-links" aria-label="Main">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}><Icon name="gamepad" size={17} /> {t.navGames}</NavLink>
            <NavLink to="/payments" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}><Icon name="wallet" size={17} /> {t.navPayments}</NavLink>
            <a href={support} target="_blank" rel="noopener noreferrer" className="nav-link support-link"><Icon name="message" size={17} /> {t.navContact}</a>
            <Link to="/cashout" className="btn btn-gold btn-sm nav-cta"><Icon name="cash" size={16} /> {t.navCashout}</Link>
          </nav>
        </div>
      </header>
    </>
  );
}

function Dock({ metaLink }) {
  const t = useText();
  return (
    <nav className="dock" aria-label="Quick navigation">
      <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}><Icon name="gamepad" size={22} />Games</NavLink>
      <NavLink to="/payments" className={({ isActive }) => (isActive ? "active" : "")}><Icon name="wallet" size={22} />Pay</NavLink>
      <NavLink to="/cashout" className={({ isActive }) => `primary ${isActive ? "active" : ""}`}><Icon name="cash" size={24} />Cash</NavLink>
      <a href={metaLink || "https://facebook.com/"} target="_blank" rel="noopener noreferrer"><Icon name="message" size={22} />Support</a>
    </nav>
  );
}

/* ---------- Footer ---------- */
function Footer({ settings }) {
  const t = useText();
  const { whatsappLink, discordLink, instagramLink, metaLink, messengerUsername } = settings;
  const support = messengerUsername ? `https://m.me/${messengerUsername}` : metaLink;
  const socials = [
    whatsappLink ? { href: whatsappLink, label: "WhatsApp", icon: "whatsapp" } : null,
    discordLink ? { href: discordLink, label: "Discord", icon: "users" } : null,
    instagramLink ? { href: instagramLink, label: "Instagram", icon: "instagram" } : null,
    support ? { href: support, label: "Messenger", icon: "message" } : null,
  ].filter(Boolean);

  return (
    <footer className="footer">
      <div className="footer-glow" />
      <div className="container">
        <div className="footer-inner">
          <div>
            <Link to="/" className="brand" style={{ marginBottom: 16 }}>
              <Crest size={40} />
              <span className="brand-name">{t.siteName}<small>CASINO</small></span>
            </Link>
            <p className="muted" style={{ maxWidth: 38 + "ch", margin: 0 }}>{t.heroSubtitle}</p>
          </div>
          <div>
            <h4>Explore</h4>
            <div className="footer-links">
              <Link to="/">{t.navGames}</Link>
              <Link to="/payments">{t.navPayments}</Link>
              {settings.cashoutEnabled !== false ? <Link to="/cashout">{t.navCashout}</Link> : null}
            </div>
          </div>
          <div>
            <h4>{t.footerConnectText}</h4>
            <div className="socials">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="social" title={s.label} aria-label={s.label}>
                  <Icon name={s.icon} size={20} />
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} {t.siteName}. All rights reserved.</span>
          <span>Crafted with <span style={{ color: "var(--crimson-1)" }}>&hearts;</span> for the table.</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Admin route guard ---------- */
function AdminRoute({ isAdmin, setIsAdmin, ...rest }) {
  if (!isAdmin) {
    return <LoginPage onLogin={() => setIsAdmin(true)} />;
  }
  return <AdminPage {...rest} onLogout={() => signOut(auth)} />;
}

/* ---------- App ---------- */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [games, setGamesState] = useState(SAMPLE_GAMES);
  const [payments, setPaymentsState] = useState([]);
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS);
  const [siteText, setSiteTextState] = useState(DEFAULT_TEXT);
  const [stats, setStats] = useState({});
  const [cashoutFields, setCashoutFieldsState] = useState(DEFAULT_CASHOUT_FIELDS);
  const [cashouts, setCashouts] = useState([]);
  const location = useLocation();

  useSpotlight();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    const unsubAuth = onAuthStateChanged(auth, (user) => setIsAdmin(!!user));
    (async () => {
      const [g, p, s, txt, cf, co] = await Promise.all([
        loadCollection("games", SAMPLE_GAMES),
        loadCollection("payments", []),
        loadDoc("settings", DEFAULT_SETTINGS),
        loadDoc("siteText", DEFAULT_TEXT),
        loadDoc("cashoutFields", null),
        loadCollection("cashouts", []),
      ]);
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
    const unsubCashoutFields = watchDoc("cashoutFields", (v) => { if (Array.isArray(v) && v.length) setCashoutFieldsState(v); });
    const unsubCashouts = watchCollection("cashouts", (v) => setCashouts(v));

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
      <>
        <Ambient />
        <div className="splash" style={{ background: "transparent" }}>
          <div className="splash-inner">
            <div className="splash-crest"><Crest size={84} /></div>
            <div className="display" style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Raizen <span className="gold-text">Royale</span>
            </div>
            <div className="splash-bar" />
          </div>
        </div>
      </>
    );
  }

  return (
    <TextContext.Provider value={siteText}>
      <ToastProvider>
        <Ambient />
        <div className="app">
          <TopBar metaLink={settings.metaLink} />
          <main className="main" key={location.pathname}>
            <Routes>
              <Route path="/" element={<HomePage games={games} payments={payments} settings={settings} />} />
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
              <Route path="*" element={<HomePage games={games} payments={payments} settings={settings} />} />
            </Routes>
          </main>
          <Footer settings={settings} />
        </div>
        <Dock metaLink={settings.metaLink} />
      </ToastProvider>
    </TextContext.Provider>
  );
}
