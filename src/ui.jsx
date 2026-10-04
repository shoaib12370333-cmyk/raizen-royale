import React, { useState, useEffect, useRef, useCallback, useContext, createContext, useId } from "react";

/* =========================================================
   Icons (24px stroke set)
   ========================================================= */
const ICONS = {
  gamepad: "M6 12h4M8 10v4M15 13h.01M18 11h.01M17.32 5H6.68a4 4 0 0 0-3.98 3.59C2.6 9.42 2 14.46 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 16h4.34a2 2 0 0 1 1.42.59L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.55-.6-6.58-.68-7.26A4 4 0 0 0 17.32 5z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  wallet: "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
  bolt: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
  card: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM2 10h20M6 15h4",
  cash: "M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 12h.01M18 12h.01",
  shield: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  search: "M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  arrow: "M5 12h14M12 5l7 7-7 7",
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18M6 6l12 12",
  copy: "M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2zM4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2",
  qr: "M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 15h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z",
  message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  whatsapp: "M7.9 20A9 9 0 1 0 4 16.1L2 22zM9 10a5 5 0 0 0 5 5l1.3-1.3a.6.6 0 0 0 0-.8l-1.5-1a.6.6 0 0 0-.7 0l-.6.5a4 4 0 0 1-1.7-1.7l.5-.6a.6.6 0 0 0 0-.7l-1-1.5a.6.6 0 0 0-.8 0z",
  instagram: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zM16 11.4a4 4 0 1 1-7.9 1.2A4 4 0 0 1 16 11.4zM17.5 6.5h.01",
  sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  chart: "M12 20V10M18 20V4M6 20v-4",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  trash: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  plus: "M12 5v14M5 12h14",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  crown: "M2 8l4 10h12l4-10-6 4-4-7-4 7zM6 21h12",
  spark: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 3v4M21 5h-4",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  lock: "M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4",
  type: "M4 7V4h16v3M9 20h6M12 4v16",
  image: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21",
  alert: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  down: "m6 9 6 6 6-6",
  external: "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
  receipt: "M4 2v20l3-2 2 2 3-2 3 2 2-2 3 2V2l-3 2-2-2-3 2-3-2-2 2zM8 8h8M8 12h8",
  dollar: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  refresh: "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5",
  save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
  diamond: "M12 2l5 10-5 10-5-10z",
  flame: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
};

export function Icon({ name, size = 20, stroke = 2, fill = false, className, style }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/* =========================================================
   Crest / logo
   ========================================================= */
export function Crest({ size = 34, glow = true }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={glow ? "crest-glow" : undefined} aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1c4" />
          <stop offset="0.5" stopColor="#f6d27a" />
          <stop offset="1" stopColor="#b9801f" />
        </linearGradient>
        <radialGradient id={`r${id}`} cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="#2a0d16" />
          <stop offset="1" stopColor="#0c0a0e" />
        </radialGradient>
      </defs>
      <path d="M24 2.5 43.5 13v15.2c0 9.3-8.2 15.3-19.5 17.3C12.7 43.5 4.5 37.5 4.5 28.2V13z" fill={`url(#r${id})`} stroke={`url(#g${id})`} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M24 7 39.5 15.3v12.4c0 7.4-6.5 12.2-15.5 13.9-9-1.7-15.5-6.5-15.5-13.9V15.3z" stroke="rgba(246,210,122,.28)" strokeWidth=".8" />
      <path d="M13 18.5 16.8 27 24 20.5 31.2 27 35 18.5" stroke={`url(#g${id})`} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="13" cy="18" r="1.6" fill="#f6d27a" />
      <circle cx="35" cy="18" r="1.6" fill="#f6d27a" />
      <circle cx="24" cy="15.4" r="1.6" fill="#f6d27a" />
      <path d="M24 28.4 27 32l-3 3.6L21 32z" fill="#e0183f" />
    </svg>
  );
}

/* =========================================================
   Hooks / helpers
   ========================================================= */
export function Reveal({ children, delay = 0, as: Tag = "div", className = "", style, ...rest }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { setShown(true); io.disconnect(); }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${shown ? "in" : ""} ${className}`} style={{ "--d": `${delay}ms`, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

export function CountUp({ value = 0, duration = 1400, prefix = "", suffix = "" }) {
  const ref = useRef(null);
  const [n, setN] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const run = () => {
      if (started.current) return;
      started.current = true;
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 4);
        setN(Math.round(value * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (typeof IntersectionObserver === "undefined") { run(); return; }
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { run(); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Keep the number in sync if the value changes after the first animation.
  useEffect(() => { if (started.current) setN(value); }, [value]);

  return <span ref={ref}>{prefix}{n.toLocaleString()}{suffix}</span>;
}

/* Mouse-follow spotlight for every .card (single global listener) */
export function useSpotlight() {
  useEffect(() => {
    const onMove = (e) => {
      const card = e.target && e.target.closest ? e.target.closest(".card") : null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);
}

/* =========================================================
   Toasts
   ========================================================= */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, message, type }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <Icon name={t.type === "bad" ? "alert" : "check"} size={20} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* =========================================================
   Small building blocks
   ========================================================= */
export function Switch({ checked, onChange, label }) {
  return (
    <span className="switch">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="track" />
      <span className="thumb" />
    </span>
  );
}

export function Field({ label, required, hint, children, className = "" }) {
  return (
    <label className={`field ${className}`}>
      {label ? (
        <span className="label">
          <span>{label}{required ? <span className="req"> *</span> : null}</span>
        </span>
      ) : null}
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SectionHead({ eyebrow, title, subtitle, center = false, as: Tag = "h2" }) {
  return (
    <div className={`section-head ${center ? "center" : ""}`}>
      {eyebrow ? <span className={`eyebrow ${center ? "" : "left"}`}>{eyebrow}</span> : null}
      <Tag>{title}</Tag>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
