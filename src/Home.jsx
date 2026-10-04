import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { incrementCounter } from "./firebase.js";
import { useText } from "./text.js";
import { Icon, Reveal, CountUp, SectionHead, Crest } from "./ui.jsx";

/* Deterministic ember particles for the hero */
const EMBERS = Array.from({ length: 22 }, (_, i) => {
  const r = (n) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    x: `${Math.round(r(1) * 100)}%`,
    s: `${(2 + r(2) * 3).toFixed(1)}px`,
    t: `${(7 + r(3) * 8).toFixed(1)}s`,
    dl: `${(-r(4) * 12).toFixed(1)}s`,
    dx: `${Math.round((r(5) - 0.5) * 120)}px`,
  };
});

function Embers() {
  return (
    <div className="embers" aria-hidden="true">
      {EMBERS.map((e, i) => (
        <i key={i} style={{ "--x": e.x, "--s": e.s, "--t": e.t, "--dl": e.dl, "--dx": e.dx }} />
      ))}
    </div>
  );
}

function Hero({ gamesCount, paymentOptions, cashoutOpen }) {
  const t = useText();
  const ref = useRef(null);

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };

  // "Play big. Win big." -> second sentence rendered in shimmering gold
  const words = String(t.heroTitle || "").trim().split(/(?<=[.!?])\s+/);
  const first = words[0];
  const rest = words.slice(1).join(" ");

  return (
    <section className="hero" ref={ref} onPointerMove={onMove}>
      <div className="hero-art" aria-hidden="true">
        <img src="/bg-hero.jpg" alt="" fetchpriority="high" />
      </div>
      <Embers />
      <div className="hero-copy">
        <div className="hero-badge"><span className="dot live" /> {t.heroBadge}</div>
        <h1>
          <span className="crimson-text">{first}</span>
          {rest ? <><br /><span className="shine">{rest}</span></> : null}
        </h1>
        <p className="lead">{t.heroSubtitle}</p>
        <div className="hero-cta">
          <a href="#games" className="btn btn-gold btn-lg" onClick={(e) => { e.preventDefault(); document.getElementById("games")?.scrollIntoView({ behavior: "smooth" }); }}>
            <Icon name="gamepad" size={20} /> {t.heroPrimaryBtn}
          </a>
          <Link to="/cashout" className="btn btn-ghost btn-lg">
            {t.heroSecondaryBtn} <Icon name="arrow" size={18} className="arrow" />
          </Link>
        </div>
      </div>
      <div className="hero-stats">
        <div className="hero-stat">
          <b className="gold-text"><CountUp value={gamesCount} /></b>
          <span>Games</span>
        </div>
        <div className="hero-stat">
          <b className="gold-text"><CountUp value={paymentOptions} /></b>
          <span>Ways to pay</span>
        </div>
        <div className="hero-stat">
          <b className={cashoutOpen ? "" : "crimson-text"} style={cashoutOpen ? { color: "var(--ok)" } : undefined}>{cashoutOpen ? "Open" : "Paused"}</b>
          <span><span className={`dot ${cashoutOpen ? "live" : "off"}`} /> Cash-outs</span>
        </div>
      </div>
    </section>
  );
}

function Marquee({ names }) {
  if (!names.length) return null;
  // Repeat enough times so the half-width loop always fills the screen.
  const base = [];
  while (base.length < 10) base.push(...names);
  const list = base.concat(base);
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {list.map((n, i) => (
          <span className="marquee-item" key={i}>
            {n}
            <Icon name="diamond" size={14} fill stroke={0} />
          </span>
        ))}
      </div>
    </div>
  );
}

function GameCard({ game, metaLink, messengerUsername }) {
  const t = useText();
  const ref = useRef(null);
  const accountLink = messengerUsername
    ? `https://m.me/${messengerUsername}?text=${encodeURIComponent(`Hey I would like to make an account for ${game.name}`)}`
    : (metaLink || "https://facebook.com/");

  const onMove = (e) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.classList.add("tilting");
    el.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-y * 9).toFixed(2)}deg`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("tilting");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
  };

  const badge = game.badge && game.badge.trim();

  return (
    <article ref={ref} className="card spot game-card" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="game-media">
        {badge ? <span className="ribbon"><Icon name="flame" size={12} fill stroke={0} /> {badge}</span> : null}
        {game.flyer ? (
          <img src={game.flyer} alt={game.name} loading="lazy" />
        ) : (
          <div className="game-ph">
            <b className="gold-text">{(game.name || "?").trim().charAt(0).toUpperCase()}</b>
            <Icon name="crown" size={72} stroke={1.2} />
          </div>
        )}
        <span className="shine-sweep" />
      </div>
      <div className="game-body">
        <h3 className="game-title">{game.name}</h3>
        <div className="game-actions">
          <a
            href={game.downloadLink || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => incrementCounter("game_" + game.id)}
            className="btn btn-gold btn-block"
          >
            <Icon name="download" size={18} /> {t.downloadBtn}
          </a>
          <a href={accountLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-block btn-sm" style={{ "--h": "42px" }}>
            <Icon name="message" size={16} /> {t.needAccountBtn}
          </a>
        </div>
      </div>
    </article>
  );
}

function Steps() {
  const t = useText();
  const items = [
    { icon: "gamepad", title: t.how1Title, text: t.how1Text },
    { icon: "user", title: t.how2Title, text: t.how2Text },
    { icon: "wallet", title: t.how3Title, text: t.how3Text },
  ];
  return (
    <section style={{ marginTop: 100 }}>
      <Reveal>
        <SectionHead center eyebrow={t.howEyebrow} title={t.howTitle} />
      </Reveal>
      <div className="steps">
        {items.map((s, i) => (
          <Reveal key={i} delay={i * 110}>
            <div className="card spot step">
              <span className="step-num">{i + 1}</span>
              <div className="ico"><Icon name={s.icon} size={26} /></div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export default function HomePage({ games, payments, settings }) {
  const t = useText();
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => [...games].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999)), [games]);
  const filtered = query.trim() ? sorted.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase())) : sorted;

  useEffect(() => {
    if (!sessionStorage.getItem("rr_visit_counted")) {
      incrementCounter("site_visits");
      sessionStorage.setItem("rr_visit_counted", "1");
    }
  }, []);

  const paymentOptions = payments.length + (settings.lnbitsEnabled ? 1 : 0) + (settings.cashtapEnabled ? 1 : 0) + (settings.nowpaymentsEnabled ? 1 : 0);

  return (
    <div className="container page">
      <Hero gamesCount={games.length} paymentOptions={paymentOptions} cashoutOpen={settings.cashoutEnabled !== false} />
      <Marquee names={sorted.map((g) => g.name)} />

      <section id="games" style={{ marginTop: 90, scrollMarginTop: 90 }}>
        <Reveal>
          <SectionHead eyebrow={t.homeEyebrow} title={t.homeTitle} subtitle={t.homeSubtitle} />
        </Reveal>
        <div className="toolbar">
          <div className="input-icon">
            <Icon name="search" size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="input" aria-label="Search games" />
          </div>
          {games.length > 0 ? <span className="result-count">{filtered.length} {filtered.length === 1 ? "game" : "games"}</span> : null}
        </div>

        {games.length === 0 ? (
          <div className="card empty">
            <div className="ico"><Icon name="gamepad" size={28} /></div>
            {t.noGamesText}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card empty">
            <div className="ico"><Icon name="search" size={28} /></div>
            No games match "{query}".
          </div>
        ) : (
          <div className="game-grid">
            {filtered.map((g, i) => (
              <Reveal key={g.id} delay={Math.min(i, 8) * 70}>
                <GameCard game={g} metaLink={settings.metaLink} messengerUsername={settings.messengerUsername} />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      <Steps />

      {settings.cashoutEnabled !== false ? (
        <Reveal style={{ marginTop: 100 }}>
          <div className="cta-band">
            <div style={{ display: "inline-block", marginBottom: 14 }}><Crest size={52} /></div>
            <h2 className="gold-text">{t.ctaTitle}</h2>
            <p>{t.ctaText}</p>
            <Link to="/cashout" className="btn btn-gold btn-lg">
              <Icon name="cash" size={20} /> {t.navCashout} <Icon name="arrow" size={18} className="arrow" />
            </Link>
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}
