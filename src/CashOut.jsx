import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Icon, Reveal, SectionHead, Field, Spinner, uid } from "./ui.jsx";

const PRESETS = [20, 50, 100, 250, 500];

function methodIcon(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("cash")) return "cash";
  if (n.includes("paypal") || n.includes("card")) return "card";
  if (n.includes("bolt") || n.includes("lightning") || n.includes("btc") || n.includes("bitcoin")) return "bolt";
  return "wallet";
}

function TicketRow({ label, value }) {
  return (
    <div className="ticket-row">
      <span>{label}</span>
      {value ? <span>{value}</span> : <span className="empty-v">—</span>}
    </div>
  );
}

export default function CashOutPage({ games, settings, cashoutFields, saveCashoutRequest }) {
  const [game, setGame] = useState("");
  const [customGame, setCustomGame] = useState("");
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [values, setValues] = useState({});
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const activeFields = (cashoutFields || []).filter((f) => f.active !== false);
  const paymentFields = activeFields.filter((f) => f.type === "payment");
  const textFields = activeFields.filter((f) => f.type === "text");
  const selectedPayment = paymentFields.find((f) => f.id === method);

  useEffect(() => {
    if (!selectedPayment && paymentFields.length) setMethod(paymentFields[0].id);
  }, [paymentFields.map((f) => f.id).join(","), selectedPayment]);

  const setField = (id, value) => setValues((v) => ({ ...v, [id]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!game) return setError("Please select a game.");
    if (game === "__custom" && !customGame.trim()) return setError("Enter the custom game name.");
    if (!username.trim()) return setError("Enter your game username.");
    const usd = Number(amount);
    if (!Number.isFinite(usd) || usd <= 0) return setError("Enter a valid cash-out amount.");
    if (!selectedPayment) return setError("Please select a payment method.");
    if (!String(values[selectedPayment.id] || "").trim()) return setError(`Enter your ${selectedPayment.name} details.`);
    for (const f of activeFields.filter((f) => f.type === "text" && f.required)) {
      if (!String(values[f.id] || "").trim()) return setError(`Enter ${f.name}.`);
    }
    setStatus("submitting");
    try {
      const finalGame = game === "__custom" ? customGame.trim() : game;
      const request = {
        id: uid(),
        game: finalGame,
        gameId: game === "__custom" ? "custom" : game,
        gameUsername: username.trim(),
        amount: Number(usd.toFixed(2)),
        paymentMethod: selectedPayment.name,
        paymentDetails: String(values[selectedPayment.id]).trim(),
        extraFields: Object.fromEntries(activeFields.filter((f) => f.type === "text").map((f) => [f.name, String(values[f.id] || "").trim()])),
        status: "pending",
        createdAt: Date.now(),
      };
      const saved = await saveCashoutRequest(request);
      if (!saved) throw new Error("save failed");
      const template = settings.cashoutMessageTemplate || "Hello, I would like to request a cash-out.\n\nGame: {game}\nGame Username: {username}\nCash-Out Amount: ${amount}\nPayment Method: {method}\nPayment Details: {details}\nRequest ID: {requestId}";
      const message = template
        .replaceAll("{game}", finalGame)
        .replaceAll("{username}", username.trim())
        .replaceAll("{amount}", Number(usd).toFixed(2))
        .replaceAll("{method}", selectedPayment.name)
        .replaceAll("{details}", String(values[selectedPayment.id]).trim())
        .replaceAll("{requestId}", request.id);
      const meta = settings.cashoutMetaLink || settings.metaLink || "https://facebook.com/";
      const target = settings.messengerUsername
        ? `https://m.me/${settings.messengerUsername}?text=${encodeURIComponent(message)}`
        : `${meta}${meta.includes("?") ? "&" : "?"}text=${encodeURIComponent(message)}`;
      setStatus("redirecting");
      window.location.href = target;
    } catch (err) {
      console.error(err);
      setError("Could not submit the cash-out request. Please try again.");
      setStatus("idle");
    }
  };

  if (settings.cashoutEnabled === false) {
    return (
      <div className="container page" style={{ paddingTop: 28 }}>
        <div className="card card-pad empty" style={{ maxWidth: 620, margin: "40px auto" }}>
          <div className="ico"><Icon name="lock" size={28} /></div>
          <SectionHead center as="h1" eyebrow="Cash out" title="Cash-Out unavailable" subtitle="Cash-out requests are currently disabled." />
          <Link to="/" className="btn btn-ghost">Back to games</Link>
        </div>
      </div>
    );
  }

  const finalGameName = game === "__custom" ? customGame : game;
  const usdNum = Number(amount);

  return (
    <div className="container page" style={{ paddingTop: 28 }}>
      <SectionHead as="h1" eyebrow="Cash out" title="Request a Cash-Out" subtitle="Enter your game details and choose how you would like to receive your cash-out." />

      <div className="cashout-layout">
        <Reveal>
          <form onSubmit={submit} className="card card-pad" noValidate>
            {/* 1 — Game */}
            <div className="form-section">
              <div className="form-section-head"><span className="n">1</span><h3>Your game</h3></div>
              <Field label="Game" required>
                <select value={game} onChange={(e) => setGame(e.target.value)} className="select">
                  <option value="">Select game</option>
                  {games.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
                  <option value="__custom">Custom</option>
                </select>
              </Field>
              {game === "__custom" ? (
                <Field label="Custom game name" required>
                  <input value={customGame} onChange={(e) => setCustomGame(e.target.value)} className="input" placeholder="Enter game name" />
                </Field>
              ) : null}
              <Field label="Game username" required>
                <div className="input-icon">
                  <Icon name="user" size={18} />
                  <input value={username} onChange={(e) => setUsername(e.target.value)} className="input" placeholder="Enter your game username" autoComplete="off" />
                </div>
              </Field>
            </div>

            {/* 2 — Amount */}
            <div className="form-section">
              <div className="form-section-head"><span className="n">2</span><h3>Amount</h3></div>
              <div className="field">
                <span className="label"><span>Cash-out amount (USD) <span className="req">*</span></span></span>
                <div className="input-wrap">
                  <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="input big" placeholder="0.00" inputMode="decimal" autoComplete="off" />
                  <span className="prefix">$</span>
                </div>
                <div className="chips" style={{ marginTop: 4 }}>
                  {PRESETS.map((p) => (
                    <button type="button" key={p} className={`chip ${String(amount) === String(p) ? "active" : ""}`} onClick={() => setAmount(String(p))}>${p}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3 — Payout */}
            <div className="form-section">
              <div className="form-section-head"><span className="n">3</span><h3>Payout method</h3></div>
              {paymentFields.length ? (
                <>
                  <div className="method-grid" role="radiogroup" aria-label="Payment method">
                    {paymentFields.map((f) => (
                      <button type="button" role="radio" aria-checked={method === f.id} key={f.id} onClick={() => setMethod(f.id)} className={`method ${method === f.id ? "active" : ""}`}>
                        <span className="tick"><Icon name="check" size={12} stroke={3.5} /></span>
                        <span className="ico"><Icon name={methodIcon(f.name)} size={22} /></span>
                        {f.name}
                      </button>
                    ))}
                  </div>
                  {selectedPayment ? (
                    <Field label={`${selectedPayment.name} details`} required>
                      <input value={values[selectedPayment.id] || ""} onChange={(e) => setField(selectedPayment.id, e.target.value)} className="input" placeholder={selectedPayment.placeholder || `Enter your ${selectedPayment.name} details`} autoComplete="off" />
                    </Field>
                  ) : null}
                </>
              ) : (
                <div className="info-box"><Icon name="alert" size={18} /> Payment methods are not configured yet. Please contact support.</div>
              )}
              {textFields.map((f) => (
                <Field key={f.id} label={f.name} required={f.required}>
                  <input value={values[f.id] || ""} onChange={(e) => setField(f.id, e.target.value)} className="input" placeholder={f.placeholder || "Enter details"} />
                </Field>
              ))}
            </div>

            {error ? <div className="error-box" role="alert" style={{ marginTop: 24 }}><Icon name="alert" size={18} /><span>{error}</span></div> : null}

            <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
              <button type="submit" className="btn btn-gold btn-lg" style={{ flex: "1 1 220px" }} disabled={status !== "idle"}>
                {status === "submitting" ? <><Spinner /> Submitting...</> : status === "redirecting" ? <><Spinner /> Opening Messenger...</> : <><Icon name="shield" size={19} /> Submit Cash-Out</>}
              </button>
              <Link to="/" className="btn btn-ghost btn-lg">Cancel</Link>
            </div>
          </form>
        </Reveal>

        {/* Live ticket preview */}
        <Reveal delay={120}>
          <aside className="card ticket" aria-label="Cash-out summary">
            <div className="ticket-top">
              <span className="eyebrow">Your request</span>
              <div className="ticket-amount gold-text">${Number.isFinite(usdNum) && usdNum > 0 ? usdNum.toFixed(2) : "0.00"}</div>
              <span className="badge warn"><span className="dot" /> Pending</span>
            </div>
            <div className="ticket-rip"><i /></div>
            <div className="ticket-rows">
              <TicketRow label="Game" value={finalGameName} />
              <TicketRow label="Username" value={username.trim()} />
              <TicketRow label="Method" value={selectedPayment ? selectedPayment.name : ""} />
              <TicketRow label="Details" value={selectedPayment ? String(values[selectedPayment.id] || "").trim() : ""} />
              <div className="info-box" style={{ marginTop: 6 }}>
                <Icon name="message" size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>After you submit, Messenger opens with this request pre-filled so our team can approve it.</span>
              </div>
            </div>
          </aside>
        </Reveal>
      </div>
    </div>
  );
}
