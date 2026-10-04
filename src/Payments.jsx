import React, { useState, useEffect } from "react";
import { useText, cleanLabel } from "./text.js";
import { Icon, Reveal, SectionHead, Spinner, formatTime } from "./ui.jsx";
import { ReceiptView, SuccessMark } from "./Receipt.jsx";

const PRESETS = [5, 10, 25, 50, 100];

/* ---------- shared bits ---------- */
function PayShell({ icon, tone = "", title, subtitle, children, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <div className="card spot pay-card">
        <div className="pay-head">
          <div className={`pay-ico ${tone}`}><Icon name={icon} size={26} /></div>
          <div>
            <h3>{cleanLabel(title)}</h3>
            <p>{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </Reveal>
  );
}

function AmountInput({ value, onChange, placeholder }) {
  return (
    <div className="field">
      <span className="label">Amount (USD)</span>
      <div className="input-wrap">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder={placeholder || "0.00"}
          className="input big"
          inputMode="decimal"
          autoComplete="off"
        />
        <span className="prefix">$</span>
      </div>
      <div className="chips" style={{ marginTop: 2 }}>
        {PRESETS.map((p) => (
          <button type="button" key={p} className={`chip ${String(value) === String(p) ? "active" : ""}`} onClick={() => onChange(String(p))}>
            ${p}
          </button>
        ))}
      </div>
    </div>
  );
}

function GameSelect({ games, value, onChange, placeholder }) {
  if (!games || games.length === 0) return null;
  return (
    <div className="field">
      <span className="label">Game</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="select">
        <option value="">{placeholder || "For which game? (optional)"}</option>
        {games.map((g) => (
          <option key={g.id} value={g.name}>{g.name}</option>
        ))}
      </select>
    </div>
  );
}

function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div className="error-box" role="alert">
      <Icon name="alert" size={18} />
      <span>{children}</span>
    </div>
  );
}

function PaidState({ title, receipt, note, downloadLabel, onReset, resetLabel = "Make another payment" }) {
  return (
    <div className="pay-state">
      <SuccessMark />
      <h4 className="result-title">{title}</h4>
      <ReceiptView data={receipt} note={note} downloadLabel={downloadLabel} />
      <button type="button" onClick={onReset} className="btn btn-ghost btn-sm">
        <Icon name="refresh" size={15} /> {resetLabel}
      </button>
    </div>
  );
}

/* ---------- Lightning ---------- */
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

  const R = 32;
  const C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, secondsLeft / INVOICE_LIFETIME));

  return (
    <PayShell icon="bolt" tone="bolt" title={t.lightningTitle} subtitle={t.lightningSubtitle}>
      {status === "idle" || status === "error" || status === "creating" ? (
        <form onSubmit={createInvoice} className="pay-form">
          <AmountInput value={amount} onChange={setAmount} placeholder={t.lightningAmountPlaceholder} />
          <GameSelect games={games} value={selectedGame} onChange={setSelectedGame} placeholder={t.lightningGamePlaceholder} />
          <ErrorBox>{error}</ErrorBox>
          <button type="submit" className="btn btn-gold btn-lg btn-block" disabled={status === "creating"}>
            {status === "creating" ? <><Spinner /> Generating invoice...</> : <><Icon name="bolt" size={18} /> {t.lightningGenerateBtn}</>}
          </button>
        </form>
      ) : null}

      {status === "waiting" && invoice ? (
        <div className="pay-state">
          <div className="qr-frame">
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(invoice.bolt11)}`} alt="Lightning invoice QR code" />
            <span className="qr-scan" />
          </div>
          {satsPreview ? <div className="sats gold-text">{satsPreview.toLocaleString()} sats</div> : null}
          <div className="muted" style={{ fontSize: 13.5 }}>{t.lightningWaitingText}</div>
          <button type="button" onClick={copyInvoice} className="btn btn-ghost btn-block">
            <Icon name={copied ? "check" : "copy"} size={17} /> {copied ? "Copied!" : t.lightningCopyBtn}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div className={`ring ${secondsLeft <= 60 ? "low" : ""}`}>
              <svg width="74" height="74" viewBox="0 0 74 74">
                <defs>
                  <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#f6d27a" />
                    <stop offset="1" stopColor="#e0183f" />
                  </linearGradient>
                </defs>
                <circle className="bg" cx="37" cy="37" r={R} fill="none" strokeWidth="5" />
                <circle className="fg" cx="37" cy="37" r={R} fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
              </svg>
              <b>{formatTime(secondsLeft)}</b>
            </div>
            <div className="pulse-row"><span className="dot live" /> {t.lightningWaitingStatus}</div>
          </div>
          <button type="button" onClick={reset} className="btn btn-ghost btn-sm">Cancel</button>
        </div>
      ) : null}

      {status === "paid" && invoice ? (
        <PaidState
          title={t.lightningPaidText}
          note={t.lightningReceiptNote}
          downloadLabel={t.lightningDownloadReceiptBtn}
          onReset={reset}
          receipt={{ amount: paidUsd, sats: satsPreview, game: selectedGame, method: "Bitcoin Lightning", date: paidAt, idLabel: "Payment ID", idValue: invoice.hash ? invoice.hash.slice(0, 20) + "..." : "" }}
        />
      ) : null}

      {status === "timedout" ? (
        <div className="pay-state">
          <div className="pay-ico crimson"><Icon name="alert" size={28} /></div>
          <h4 className="result-title">{t.lightningExpiredTitle}</h4>
          <div className="muted" style={{ fontSize: 13.5 }}>{t.lightningExpiredText}</div>
          <button type="button" onClick={reset} className="btn btn-gold btn-block">{t.lightningNewInvoiceBtn}</button>
        </div>
      ) : null}
    </PayShell>
  );
}

/* ---------- CashTap (card / bank / CashApp) ---------- */
function CashTapPay({ enabled, games }) {
  const t = useText();
  const [amount, setAmount] = useState("");
  const [selectedGame, setSelectedGame] = useState("");
  const [status, setStatus] = useState("idle"); // idle | creating | redirecting | checking | paid | failed | error
  const [error, setError] = useState("");
  const [paidUsd, setPaidUsd] = useState(null);
  const [paidAt, setPaidAt] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  // On mount, if we've just come back from CashTap's hosted checkout,
  // pick up the pending session and confirm its real status via polling.
  // We never trust the success_url redirect alone — only a confirmed
  // "completed" status from checkout-status.js counts as paid.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedPaid = params.get("paid");
    const pending = sessionStorage.getItem("rr_cashtap_pending");
    if (returnedPaid && pending) {
      try {
        const parsed = JSON.parse(pending);
        setSessionId(parsed.id);
        setPaidUsd(parsed.amount);
        setSelectedGame(parsed.game || "");
        setStatus("checking");
      } catch (err) {
        sessionStorage.removeItem("rr_cashtap_pending");
      }
      // Clean the URL so refreshing doesn't re-trigger this.
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (status !== "checking" || !sessionId) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12; // ~60s at 5s intervals, matching CashTap's own polling guidance

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/checkout-status?session_id=${sessionId}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "completed") {
          setPaidAt(new Date());
          setStatus("paid");
          sessionStorage.removeItem("rr_cashtap_pending");
          return;
        }
        if (data.status === "expired" || data.status === "failed") {
          setStatus("failed");
          sessionStorage.removeItem("rr_cashtap_pending");
          return;
        }
      } catch (err) {
        // keep trying silently
      }
      if (attempts >= maxAttempts) {
        if (!cancelled) setStatus("failed");
        return;
      }
      if (!cancelled) setTimeout(poll, 5000);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [status, sessionId]);

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
      sessionStorage.setItem("rr_cashtap_pending", JSON.stringify({ id: data.id, amount: usd, game: selectedGame }));
      setStatus("redirecting");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Could not start checkout. Try again.");
      setStatus("error");
    }
  };

  const reset = () => {
    setAmount("");
    setSelectedGame("");
    setStatus("idle");
    setError("");
    setPaidUsd(null);
    setPaidAt(null);
    setSessionId(null);
    sessionStorage.removeItem("rr_cashtap_pending");
  };

  return (
    <PayShell icon="card" tone="crimson" title={t.cashtapTitle} subtitle={t.cashtapSubtitle} delay={80}>
      {status === "idle" || status === "error" || status === "creating" || status === "redirecting" ? (
        <form onSubmit={startCheckout} className="pay-form">
          <AmountInput value={amount} onChange={setAmount} />
          <GameSelect games={games} value={selectedGame} onChange={setSelectedGame} />
          <ErrorBox>{error}</ErrorBox>
          <button type="submit" className="btn btn-gold btn-lg btn-block" disabled={status === "creating" || status === "redirecting"}>
            {status === "creating" ? <><Spinner /> Preparing checkout...</> : status === "redirecting" ? <><Spinner /> Redirecting...</> : <><Icon name="lock" size={18} /> {t.continueCheckoutBtn}</>}
          </button>
          <div className="hint" style={{ textAlign: "center" }}>Secure, encrypted checkout. You'll be returned here to confirm.</div>
        </form>
      ) : null}

      {status === "checking" ? (
        <div className="pay-state">
          <Spinner />
          <div className="pulse-row"><span className="dot live" /> Confirming your payment...</div>
          <div className="muted" style={{ fontSize: 13.5 }}>This usually takes a few seconds.</div>
        </div>
      ) : null}

      {status === "paid" ? (
        <PaidState
          title="Payment received!"
          note="Save this image and send it to us as proof of payment."
          onReset={reset}
          receipt={{ amount: paidUsd, game: selectedGame, method: "Card / Bank / CashApp", date: paidAt, idLabel: "Session ID", idValue: sessionId }}
        />
      ) : null}

      {status === "failed" ? (
        <div className="pay-state">
          <div className="pay-ico crimson"><Icon name="alert" size={28} /></div>
          <h4 className="result-title">Payment not confirmed</h4>
          <div className="muted" style={{ fontSize: 13.5 }}>
            We couldn't confirm this payment. If money left your account, contact support with your session ID: <b style={{ color: "var(--text)", wordBreak: "break-all" }}>{sessionId}</b>
          </div>
          <button type="button" onClick={reset} className="btn btn-gold btn-block">Try again</button>
        </div>
      ) : null}
    </PayShell>
  );
}

/* ---------- NOWPayments (card / Apple Pay) ---------- */
function NOWPaymentsPay({ enabled, games }) {
  const t = useText();
  const [amount, setAmount] = useState("");
  const [selectedGame, setSelectedGame] = useState("");
  const [status, setStatus] = useState("idle"); // idle | creating | waiting | paid | error
  const [error, setError] = useState("");
  const [paymentId, setPaymentId] = useState(null);
  const [paidUsd, setPaidUsd] = useState(null);
  const [paidAt, setPaidAt] = useState(null);

  useEffect(() => {
    if (!enabled || status !== "waiting" || !paymentId) return;
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
  }, [enabled, status, paymentId]);

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
    <PayShell icon="wallet" tone="crimson" title={t.nowpaymentsTitle} subtitle={t.nowpaymentsSubtitle} delay={160}>
      {status === "idle" || status === "error" || status === "creating" ? (
        <form onSubmit={startPayment} className="pay-form">
          <AmountInput value={amount} onChange={setAmount} />
          <GameSelect games={games} value={selectedGame} onChange={setSelectedGame} />
          <ErrorBox>{error}</ErrorBox>
          <button type="submit" className="btn btn-gold btn-lg btn-block" disabled={status === "creating"}>
            {status === "creating" ? <><Spinner /> Preparing checkout...</> : <><Icon name="external" size={18} /> {t.continueCheckoutBtn}</>}
          </button>
        </form>
      ) : null}

      {status === "waiting" ? (
        <div className="pay-state">
          <Spinner />
          <div className="pulse-row"><span className="dot live" /> Waiting for payment...</div>
          <div className="muted" style={{ fontSize: 13.5 }}>
            Complete your payment in the tab that opened. This page will update automatically once it's confirmed.
          </div>
          <button type="button" onClick={reset} className="btn btn-ghost btn-sm">Cancel</button>
        </div>
      ) : null}

      {status === "paid" ? (
        <PaidState
          title="Payment received!"
          note="Save this image and send it to us as proof of payment."
          onReset={reset}
          receipt={{ amount: paidUsd, game: selectedGame, method: "Card / Apple Pay / Google Pay", date: paidAt, idLabel: "Payment ID", idValue: paymentId }}
        />
      ) : null}
    </PayShell>
  );
}

/* ---------- Page ---------- */
export default function PaymentsPage({ payments, lnbitsEnabled, cashtapEnabled, nowpaymentsEnabled, games }) {
  const t = useText();
  const hasGateways = lnbitsEnabled || cashtapEnabled || nowpaymentsEnabled;
  return (
    <div className="container page" style={{ paddingTop: 28 }}>
      <SectionHead as="h1" eyebrow={t.paymentsEyebrow} title={t.paymentsTitle} subtitle={t.paymentsSubtitle} />

      {hasGateways ? (
        <div className="pay-grid">
          {lnbitsEnabled ? <LightningPay games={games} /> : null}
          <NOWPaymentsPay enabled={nowpaymentsEnabled} games={games} />
          <CashTapPay enabled={cashtapEnabled} games={games} />
        </div>
      ) : null}

      {hasGateways && payments.length > 0 ? <div className="sub-head">Other ways to pay</div> : null}

      {payments.length === 0 ? (
        !hasGateways ? (
          <div className="card empty">
            <div className="ico"><Icon name="wallet" size={28} /></div>
            {t.noPaymentsText}
          </div>
        ) : null
      ) : (
        <div className="manual-grid">
          {payments.map((p, i) => (
            <Reveal key={p.id} delay={i * 70}>
              <div className="card spot manual-card">
                <h3>{p.name}</h3>
                {p.qr ? (
                  <div className="manual-qr"><img src={p.qr} alt={p.name + " QR code"} /></div>
                ) : (
                  <div className="pay-ico"><Icon name="wallet" size={26} /></div>
                )}
                {p.link ? (
                  <a href={p.link} target="_blank" rel="noopener noreferrer" className="btn btn-gold btn-block">
                    {t.openLinkBtn} <Icon name="external" size={16} />
                  </a>
                ) : null}
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
