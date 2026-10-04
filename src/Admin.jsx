import React, { useState, useEffect, useMemo } from "react";
import { auth, signInWithEmailAndPassword } from "./firebase.js";
import { DEFAULT_TEXT, DEFAULT_CASHOUT_FIELDS, DEFAULT_SETTINGS, TEXT_GROUPS, useText } from "./text.js";
import { Icon, Crest, CountUp, Switch, Field, Modal, Spinner, useToast, uid, fileToDataUrl } from "./ui.jsx";

/* =========================================================
   Login
   ========================================================= */
export function LoginPage({ onLogin }) {
  const t = useText();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!user.trim() || !pass) { setError("Enter email and password."); return; }
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, user.trim(), pass);
      onLogin();
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page login-wrap">
      <div className="card card-pad login-card">
        <div className="crest-big"><Crest size={72} /></div>
        <div className="eyebrow" style={{ marginTop: 18 }}>Restricted area</div>
        <h1 className="display gold-text" style={{ fontSize: 28, margin: "8px 0 0", textTransform: "uppercase" }}>{t.loginTitle}</h1>
        <form onSubmit={submit}>
          <div className="input-icon">
            <Icon name="user" size={18} />
            <input value={user} onChange={(e) => setUser(e.target.value)} type="email" autoComplete="username" placeholder={t.loginUsernamePlaceholder} className="input" aria-label="Email" />
          </div>
          <div className="input-icon">
            <Icon name="lock" size={18} />
            <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" autoComplete="current-password" placeholder={t.loginPasswordPlaceholder} className="input" aria-label="Password" />
          </div>
          {error ? <div className="error-box" role="alert"><Icon name="alert" size={18} /><span>{error}</span></div> : null}
          <button disabled={busy} type="submit" className="btn btn-gold btn-lg btn-block">
            {busy ? <><Spinner /> Signing in...</> : <><Icon name="shield" size={19} /> {t.loginBtn}</>}
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   Forms (shown in modals)
   ========================================================= */
function Dropzone({ value, onChange, square = false, label = "Click to upload an image" }) {
  const handle = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    onChange(await fileToDataUrl(file));
  };
  return (
    <label className="dropzone">
      <input type="file" accept="image/*" onChange={handle} />
      {value ? <img src={value} alt="Preview" className={`preview ${square ? "sq" : ""}`} /> : <span className={`preview ${square ? "sq" : ""}`}><Icon name="image" size={24} /></span>}
      <span>
        <b style={{ display: "block" }}>{value ? "Replace image" : label}</b>
        <span className="hint">PNG, JPG or WebP</span>
      </span>
    </label>
  );
}

function GameForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial ? initial.name : "");
  const [downloadLink, setDownloadLink] = useState(initial ? initial.downloadLink : "");
  const [flyer, setFlyer] = useState(initial ? initial.flyer : "");
  const [badge, setBadge] = useState(initial ? (initial.badge || "") : "");
  const [order, setOrder] = useState(initial && initial.order != null && initial.order !== 9999 ? String(initial.order) : "");
  const [error, setError] = useState("");

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
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="Game name" required><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Free Fire" className="input" autoFocus /></Field>
      <Field label="Download link" required><input value={downloadLink} onChange={(e) => setDownloadLink(e.target.value)} placeholder="https://..." className="input" /></Field>
      <div className="form-grid">
        <Field label="Badge (optional)"><input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="New, Popular, Hot" className="input" /></Field>
        <Field label="Position (optional)"><input value={order} onChange={(e) => setOrder(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1 = first" className="input" inputMode="numeric" /></Field>
      </div>
      <div className="field">
        <span className="label">Flyer image</span>
        <Dropzone value={flyer} onChange={setFlyer} label="Click to upload a flyer" />
      </div>
      {error ? <div className="error-box" role="alert"><Icon name="alert" size={18} /><span>{error}</span></div> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="btn btn-gold" style={{ flex: 1 }}><Icon name="save" size={17} /> Save game</button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

function PaymentForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial ? initial.name : "");
  const [link, setLink] = useState(initial ? initial.link : "");
  const [qr, setQr] = useState(initial ? initial.qr : "");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Enter a payment method name."); return; }
    if (!link.trim() && !qr) { setError("Add a link or a QR code."); return; }
    setError("");
    onSave({ id: initial ? initial.id : uid(), name: name.trim(), link: link.trim(), qr });
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="Method name" required><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Easypaisa" className="input" autoFocus /></Field>
      <Field label="Payment link" hint="Optional if you upload a QR code."><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className="input" /></Field>
      <div className="field">
        <span className="label">QR code</span>
        <Dropzone value={qr} onChange={setQr} square label="Click to upload a QR code" />
      </div>
      {error ? <div className="error-box" role="alert"><Icon name="alert" size={18} /><span>{error}</span></div> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="btn btn-gold" style={{ flex: 1 }}><Icon name="save" size={17} /> Save method</button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

/* =========================================================
   Cash-out admin
   ========================================================= */
function CashOutAdmin({ fields, onSave, cashouts, settings, setSettings, onUpdateRequest }) {
  const toast = useToast();
  const [sub, setSub] = useState("requests");
  const [filter, setFilter] = useState("all");
  const [local, setLocal] = useState((fields && fields.length ? fields : DEFAULT_CASHOUT_FIELDS).map((f) => ({ ...f })));
  const [newName, setNewName] = useState("");
  const [newPlaceholder, setNewPlaceholder] = useState("");
  const [newType, setNewType] = useState("payment");
  const [newRequired, setNewRequired] = useState(false);
  const [template, setTemplate] = useState(settings.cashoutMessageTemplate || DEFAULT_SETTINGS.cashoutMessageTemplate);

  useEffect(() => setLocal((fields && fields.length ? fields : DEFAULT_CASHOUT_FIELDS).map((f) => ({ ...f }))), [fields]);

  const persist = (next, msg = "Saved") => { setLocal(next); onSave(next); toast(msg); };
  const add = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    persist([...local, { id: uid(), name: newName.trim(), type: newType, placeholder: newPlaceholder.trim(), required: newRequired, active: true }], "Field added");
    setNewName(""); setNewPlaceholder(""); setNewRequired(false);
  };
  // Typing edits local state only; it is saved when the input loses focus.
  const edit = (id, patch) => setLocal((l) => l.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const toggle = (id, patch) => persist(local.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = (id) => { if (window.confirm("Remove this field?")) persist(local.filter((f) => f.id !== id), "Field removed"); };
  const saveTemplate = () => { setSettings({ ...settings, cashoutMessageTemplate: template }); toast("Message template saved"); };

  const all = [...(cashouts || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const norm = (r) => (r.status || "pending").toLowerCase();
  const counts = {
    all: all.length,
    pending: all.filter((r) => norm(r) === "pending").length,
    approved: all.filter((r) => norm(r) === "approved" || norm(r) === "completed").length,
    rejected: all.filter((r) => norm(r) === "rejected").length,
  };
  const shown = all.filter((r) => {
    const s = norm(r);
    if (filter === "all") return true;
    if (filter === "approved") return s === "approved" || s === "completed";
    return s === filter;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div className="seg">
          <button className={sub === "requests" ? "active" : ""} onClick={() => setSub("requests")}>Requests {counts.pending ? <span className="n">{counts.pending}</span> : null}</button>
          <button className={sub === "fields" ? "active" : ""} onClick={() => setSub("fields")}>Fields</button>
          <button className={sub === "message" ? "active" : ""} onClick={() => setSub("message")}>Message</button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 12, fontWeight: 700 }}>
          <span className="muted">Cash-Out page</span>
          <Switch checked={settings.cashoutEnabled !== false} onChange={(v) => { setSettings({ ...settings, cashoutEnabled: v }); toast(v ? "Cash-Out enabled" : "Cash-Out disabled"); }} label="Enable Cash-Out page" />
        </label>
      </div>

      {sub === "requests" ? (
        <div className="card card-pad">
          <div className="panel-head">
            <div><h3>Cash-Out requests</h3><p>Review and approve incoming requests.</p></div>
            <div className="seg">
              {["all", "pending", "approved", "rejected"].map((k) => (
                <button key={k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)} style={{ textTransform: "capitalize" }}>{k} <span className="n">{counts[k]}</span></button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="empty" style={{ padding: "36px 10px" }}><div className="ico"><Icon name="receipt" size={28} /></div>No {filter === "all" ? "" : filter + " "}cash-out requests yet.</div>
          ) : (
            <div className="list">
              {shown.map((r) => {
                const status = norm(r);
                const pending = status === "pending";
                const tone = status === "completed" || status === "approved" ? "ok" : status === "rejected" ? "bad" : "warn";
                return (
                  <div key={r.id} className={`req-card ${pending ? "pending" : ""}`}>
                    <div className="req-top">
                      <div>
                        <div className="display" style={{ fontSize: 17, textTransform: "uppercase", letterSpacing: ".06em" }}>{r.game}</div>
                        <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>{new Date(r.createdAt || Date.now()).toLocaleString()}</div>
                      </div>
                      <div className="req-amount gold-text">${Number(r.amount || 0).toFixed(2)}</div>
                    </div>
                    <div className="req-meta">
                      <div><span>Username</span><b>{r.gameUsername}</b></div>
                      <div><span>{r.paymentMethod}</span><b>{r.paymentDetails}</b></div>
                      <div><span>Request ID</span><b style={{ fontSize: 12.5 }}>{r.id}</b></div>
                    </div>
                    <div className="req-foot">
                      <span className={`badge ${tone}`}><span className="dot" /> {status}</span>
                      {pending ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="btn btn-ok btn-sm" onClick={() => { if (window.confirm(`Approve cash-out ${r.id} for $${Number(r.amount || 0).toFixed(2)}?`)) { onUpdateRequest({ ...r, status: "approved", approvedAt: Date.now() }); toast("Request approved"); } }}><Icon name="check" size={15} /> Approve</button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => { if (window.confirm(`Reject cash-out ${r.id}?`)) { onUpdateRequest({ ...r, status: "rejected", rejectedAt: Date.now() }); toast("Request rejected", "bad"); } }}><Icon name="x" size={15} /> Reject</button>
                        </div>
                      ) : <span className="faint" style={{ fontSize: 12 }}>No action required</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {sub === "fields" ? (
        <>
          <div className="card card-pad">
            <div className="panel-head"><div><h3>Cash-Out fields</h3><p>Active payment methods appear as choices on the user form. Changes save when you click away from a field.</p></div></div>
            <div className="list">
              {local.map((f) => (
                <div key={f.id} className="req-card" style={{ gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span className={`badge ${f.type === "payment" ? "gold" : ""}`}>{f.type === "payment" ? "Payment method" : "Extra field"}</span>
                    <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700 }}>
                      <span className="muted">Active</span>
                      <Switch checked={f.active !== false} onChange={(v) => toggle(f.id, { active: v })} label={`${f.name} active`} />
                    </label>
                    <button type="button" onClick={() => remove(f.id)} className="btn btn-danger btn-sm btn-icon" aria-label="Remove field"><Icon name="trash" size={16} /></button>
                  </div>
                  <div className="form-grid">
                    <Field label="Name"><input value={f.name} onChange={(e) => edit(f.id, { name: e.target.value })} onBlur={() => persist(local)} className="input" /></Field>
                    <Field label="Placeholder"><input value={f.placeholder || ""} onChange={(e) => edit(f.id, { placeholder: e.target.value })} onBlur={() => persist(local)} className="input" placeholder="Placeholder" /></Field>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <form onSubmit={add} className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="panel-head" style={{ marginBottom: 0 }}><h3>Add field</h3></div>
            <div className="form-grid">
              <Field label="Field name"><input value={newName} onChange={(e) => setNewName(e.target.value)} className="input" placeholder="e.g. Venmo" /></Field>
              <Field label="Placeholder / hint"><input value={newPlaceholder} onChange={(e) => setNewPlaceholder(e.target.value)} className="input" placeholder="Shown inside the input" /></Field>
              <Field label="Type">
                <select value={newType} onChange={(e) => setNewType(e.target.value)} className="select">
                  <option value="payment">Payment method</option>
                  <option value="text">Extra text field</option>
                </select>
              </Field>
              <label style={{ display: "flex", alignItems: "center", gap: 12, fontWeight: 700, alignSelf: "end", minHeight: 48 }}>
                <Switch checked={newRequired} onChange={setNewRequired} label="Required" /> Required
              </label>
            </div>
            <button className="btn btn-gold" style={{ alignSelf: "flex-start" }}><Icon name="plus" size={17} /> Add field</button>
          </form>
        </>
      ) : null}

      {sub === "message" ? (
        <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="panel-head" style={{ marginBottom: 0 }}><div><h3>Messenger message template</h3><p>This text is pre-filled in Messenger when a customer submits a request.</p></div></div>
          <div className="chips">
            {["{game}", "{username}", "{amount}", "{method}", "{details}", "{requestId}"].map((v) => (
              <button type="button" key={v} className="chip" onClick={() => setTemplate((t) => t + v)}>{v}</button>
            ))}
          </div>
          <textarea value={template} onChange={(e) => setTemplate(e.target.value)} className="textarea" rows={9} />
          <button type="button" className="btn btn-gold" style={{ alignSelf: "flex-start" }} onClick={saveTemplate}><Icon name="save" size={17} /> Save template</button>
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================
   Site text editor (generated from TEXT_GROUPS)
   ========================================================= */
function SiteTextEditor({ siteText, setSiteText }) {
  const toast = useToast();
  const [form, setForm] = useState(siteText);
  const dirty = JSON.stringify(form) !== JSON.stringify(siteText);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setSiteText(form); toast("Site text saved"); }}
      style={{ display: "flex", flexDirection: "column", gap: 4 }}
    >
      {TEXT_GROUPS.map((g, gi) => (
        <details className="acc" key={g.title} open={gi === 0}>
          <summary>{g.title}<Icon name="down" size={18} /></summary>
          <div className="acc-body">
            <div className="form-grid">
              {g.fields.map(([key, label]) => {
                const long = String(DEFAULT_TEXT[key] || "").length > 70;
                return (
                  <Field key={key} label={label} className={long ? "full" : ""}>
                    {long ? (
                      <textarea value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="textarea" rows={3} style={{ minHeight: 80 }} />
                    ) : (
                      <input value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="input" />
                    )}
                  </Field>
                );
              })}
            </div>
          </div>
        </details>
      ))}
      <div className="savebar" style={{ marginTop: 16 }}>
        <span className="muted" style={{ fontSize: 13.5 }}>{dirty ? "You have unsaved changes" : "All changes saved"}</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => setForm(DEFAULT_TEXT)} className="btn btn-ghost btn-sm"><Icon name="refresh" size={15} /> Reset</button>
          <button type="submit" className="btn btn-gold btn-sm" disabled={!dirty}><Icon name="save" size={15} /> Save site text</button>
        </div>
      </div>
    </form>
  );
}

/* =========================================================
   Settings
   ========================================================= */
function SettingsEditor({ settings, setSettings }) {
  const toast = useToast();
  const pick = (s) => ({
    metaLink: s.metaLink || "",
    messengerUsername: s.messengerUsername || "",
    whatsappLink: s.whatsappLink || "",
    discordLink: s.discordLink || "",
    instagramLink: s.instagramLink || "",
    lnbitsEnabled: !!s.lnbitsEnabled,
    cashtapEnabled: !!s.cashtapEnabled,
    nowpaymentsEnabled: !!s.nowpaymentsEnabled,
    cashoutEnabled: s.cashoutEnabled !== false,
    cashoutMetaLink: s.cashoutMetaLink || "",
  });
  const [d, setD] = useState(pick(settings));
  const dirty = JSON.stringify(d) !== JSON.stringify(pick(settings));
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });

  const save = (e) => {
    e.preventDefault();
    setSettings({
      ...settings,
      metaLink: d.metaLink.trim() || settings.metaLink,
      messengerUsername: d.messengerUsername.trim().replace(/^@/, ""),
      whatsappLink: d.whatsappLink.trim(),
      discordLink: d.discordLink.trim(),
      instagramLink: d.instagramLink.trim(),
      lnbitsEnabled: d.lnbitsEnabled,
      cashtapEnabled: d.cashtapEnabled,
      nowpaymentsEnabled: d.nowpaymentsEnabled,
      cashoutEnabled: d.cashoutEnabled,
      cashoutMetaLink: d.cashoutMetaLink.trim(),
    });
    toast("Settings saved");
  };

  const Toggle = ({ k, title, desc }) => (
    <label className="setting" style={{ cursor: "pointer" }}>
      <span><b>{title}</b><small>{desc}</small></span>
      <Switch checked={d[k]} onChange={(v) => setD({ ...d, [k]: v })} label={title} />
    </label>
  );

  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card card-pad">
        <div className="panel-head"><div><h3>Contact &amp; social</h3><p>Where customers reach you.</p></div></div>
        <div className="form-grid">
          <Field label="Meta page link" className="full"><input value={d.metaLink} onChange={set("metaLink")} placeholder="https://facebook.com/yourpage" className="input" /></Field>
          <Field label="Messenger username" className="full" hint={'If set, "Need account?" opens Messenger with a pre-filled message naming the game. If blank, it opens your Meta page link instead.'}>
            <input value={d.messengerUsername} onChange={set("messengerUsername")} placeholder="yourpageusername (from m.me/username)" className="input" />
          </Field>
          <Field label="WhatsApp link"><input value={d.whatsappLink} onChange={set("whatsappLink")} placeholder="https://wa.me/923001234567" className="input" /></Field>
          <Field label="Discord link"><input value={d.discordLink} onChange={set("discordLink")} placeholder="https://discord.gg/yourserver" className="input" /></Field>
          <Field label="Instagram link" className="full" hint="Leave any blank to hide that icon from the footer."><input value={d.instagramLink} onChange={set("instagramLink")} placeholder="https://instagram.com/yourpage" className="input" /></Field>
        </div>
      </div>

      <div className="card card-pad">
        <div className="panel-head"><div><h3>Payment gateways</h3><p>Secrets stay server-side in Vercel environment variables.</p></div></div>
        <Toggle k="lnbitsEnabled" title='Pay with Lightning' desc="Lightning credentials stay server-side in Vercel environment variables." />
        <Toggle k="cashtapEnabled" title="Pay with Card / Bank / CashApp (CashTap)" desc="Only turn this on once CashTap confirms their checkout API is live. Requires CASHTAP_SECRET_KEY in Vercel." />
        <Toggle k="nowpaymentsEnabled" title="Pay with Card / Apple Pay (NOWPayments)" desc="Requires NOWPAYMENTS_API_KEY to be set in Vercel." />
      </div>

      <div className="card card-pad">
        <div className="panel-head"><div><h3>Cash-Out</h3><p>Messenger username above takes priority and opens a pre-filled message.</p></div></div>
        <Toggle k="cashoutEnabled" title="Enable Cash-Out page" desc="Customers can submit cash-out requests." />
        <Field label="Cash-Out Meta/Facebook fallback link" className="full"><input value={d.cashoutMetaLink} onChange={set("cashoutMetaLink")} placeholder="https://facebook.com/yourpage" className="input" /></Field>
      </div>

      <div className="savebar">
        <span className="muted" style={{ fontSize: 13.5 }}>{dirty ? "You have unsaved changes" : "All changes saved"}</span>
        <button type="submit" className="btn btn-gold" disabled={!dirty}><Icon name="save" size={17} /> Save settings</button>
      </div>
    </form>
  );
}

/* =========================================================
   Admin shell
   ========================================================= */
const TABS = [
  { id: "games", label: "Games", icon: "gamepad" },
  { id: "payments", label: "Payment methods", icon: "wallet" },
  { id: "cashout", label: "Cash-Out", icon: "cash" },
  { id: "analytics", label: "Analytics", icon: "chart" },
  { id: "text", label: "Site Text", icon: "type" },
  { id: "settings", label: "Settings", icon: "sliders" },
];

export function AdminPage({ games, saveGameItem, removeGameItem, payments, savePaymentItem, removePaymentItem, settings, setSettings, siteText, setSiteText, onLogout, stats, cashoutFields, saveCashoutFields, cashouts, onUpdateCashoutRequest }) {
  const toast = useToast();
  const [tab, setTab] = useState("games");
  const [gameModal, setGameModal] = useState(null); // null | "new" | game
  const [payModal, setPayModal] = useState(null);

  const sortedGames = useMemo(() => [...games].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999)), [games]);
  const totalDownloads = useMemo(() => Object.entries(stats).filter(([k]) => k.startsWith("game_")).reduce((n, [, v]) => n + (v || 0), 0), [stats]);
  const pendingCount = (cashouts || []).filter((r) => (r.status || "pending").toLowerCase() === "pending").length;

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
    setGameModal(null);
    toast("Game saved");
  };
  const deleteGame = (g) => { if (window.confirm(`Delete "${g.name}"?`)) { removeGameItem(g.id); toast("Game deleted", "bad"); } };
  const savePayment = (p) => { savePaymentItem(p); setPayModal(null); toast("Payment method saved"); };
  const deletePayment = (p) => { if (window.confirm(`Delete "${p.name}"?`)) { removePaymentItem(p.id); toast("Payment method deleted", "bad"); } };

  const maxDl = Math.max(1, ...games.map((g) => stats["game_" + g.id] || 0));
  const current = TABS.find((x) => x.id === tab);

  return (
    <div className="container page admin" style={{ paddingTop: 28 }}>
      <aside className="card admin-side">
        <div className="admin-side-head">
          <Crest size={38} />
          <div><b>Command center</b><span>Admin panel</span></div>
        </div>
        {TABS.map((x) => (
          <button key={x.id} className={`side-link ${tab === x.id ? "active" : ""}`} onClick={() => setTab(x.id)}>
            <Icon name={x.icon} size={19} /> {x.label}
            {x.id === "cashout" && pendingCount ? <span className="count">{pendingCount}</span> : null}
          </button>
        ))}
        <div className="side-foot">
          <button className="side-link" onClick={onLogout}><Icon name="logout" size={19} /> Log out</button>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-title">
          <div>
            <span className="eyebrow left">Command center</span>
            <h1>{current.label}</h1>
          </div>
        </div>

        <div className="kpis">
          <div className="card kpi"><div className="ico"><Icon name="users" size={20} /></div><b className="gold-text"><CountUp value={stats.site_visits || 0} /></b><span>Site visits</span></div>
          <div className="card kpi"><div className="ico"><Icon name="download" size={20} /></div><b className="gold-text"><CountUp value={totalDownloads} /></b><span>Downloads</span></div>
          <div className="card kpi"><div className="ico"><Icon name="gamepad" size={20} /></div><b className="gold-text"><CountUp value={games.length} /></b><span>Games</span></div>
          <div className="card kpi red"><div className="ico"><Icon name="clock" size={20} /></div><b className="crimson-text"><CountUp value={pendingCount} /></b><span>Pending cash-outs</span></div>
        </div>

        {tab === "games" && (
          <div className="card card-pad">
            <div className="panel-head">
              <div><h3>Games</h3><p>Manage the lineup shown on the home page.</p></div>
              <button onClick={() => setGameModal("new")} className="btn btn-gold btn-sm"><Icon name="plus" size={16} /> Add game</button>
            </div>
            {sortedGames.length === 0 ? (
              <div className="empty" style={{ padding: "30px 10px" }}><div className="ico"><Icon name="gamepad" size={28} /></div>No games yet.</div>
            ) : (
              <div className="list">
                {sortedGames.map((g) => (
                  <div key={g.id} className="row">
                    <div className="pos">{g.order != null && g.order !== 9999 ? `#${g.order}` : "–"}</div>
                    {g.flyer ? <img src={g.flyer} alt={g.name} className="thumb" /> : <div className="thumb" />}
                    <div className="grow"><b>{g.name}</b><small>{g.downloadLink}</small></div>
                    {g.badge ? <span className="badge gold">{g.badge}</span> : null}
                    <div className="row-actions">
                      <button onClick={() => setGameModal(g)} className="btn btn-ghost btn-sm"><Icon name="edit" size={15} /> Edit</button>
                      <button onClick={() => deleteGame(g)} className="btn btn-danger btn-sm"><Icon name="trash" size={15} /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "payments" && (
          <div className="card card-pad">
            <div className="panel-head">
              <div><h3>Payment methods</h3><p>Manual payment options with a link or QR code.</p></div>
              <button onClick={() => setPayModal("new")} className="btn btn-gold btn-sm"><Icon name="plus" size={16} /> Add method</button>
            </div>
            {payments.length === 0 ? (
              <div className="empty" style={{ padding: "30px 10px" }}><div className="ico"><Icon name="wallet" size={28} /></div>No payment methods yet.</div>
            ) : (
              <div className="list">
                {payments.map((p) => (
                  <div key={p.id} className="row">
                    {p.qr ? <img src={p.qr} alt={p.name} className="thumb sq" /> : <div className="thumb sq" style={{ background: "var(--bg-2)" }} />}
                    <div className="grow"><b>{p.name}</b><small>{p.link}</small></div>
                    <div className="row-actions">
                      <button onClick={() => setPayModal(p)} className="btn btn-ghost btn-sm"><Icon name="edit" size={15} /> Edit</button>
                      <button onClick={() => deletePayment(p)} className="btn btn-danger btn-sm"><Icon name="trash" size={15} /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "cashout" && <CashOutAdmin fields={cashoutFields} onSave={saveCashoutFields} cashouts={cashouts} settings={settings} setSettings={setSettings} onUpdateRequest={onUpdateCashoutRequest} />}

        {tab === "analytics" && (
          <div className="card card-pad">
            <div className="panel-head"><div><h3>Downloads per game</h3><p>Click-throughs on the "Download now" button.</p></div></div>
            {games.length === 0 ? (
              <div className="empty" style={{ padding: "30px 10px" }}>No games added yet.</div>
            ) : (
              <div className="bars">
                {[...games].sort((a, b) => (stats["game_" + b.id] || 0) - (stats["game_" + a.id] || 0)).map((g) => {
                  const n = stats["game_" + g.id] || 0;
                  return (
                    <div className="bar-row" key={g.id}>
                      <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${(n / maxDl) * 100}%` }} /></div>
                      <b>{n}</b>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "text" && <SiteTextEditor siteText={siteText} setSiteText={setSiteText} />}
        {tab === "settings" && <SettingsEditor settings={settings} setSettings={setSettings} />}
      </div>

      {gameModal ? (
        <Modal title={gameModal === "new" ? "Add game" : "Edit game"} onClose={() => setGameModal(null)}>
          <GameForm initial={gameModal === "new" ? null : gameModal} onSave={saveGame} onCancel={() => setGameModal(null)} />
        </Modal>
      ) : null}
      {payModal ? (
        <Modal title={payModal === "new" ? "Add payment method" : "Edit payment method"} onClose={() => setPayModal(null)}>
          <PaymentForm initial={payModal === "new" ? null : payModal} onSave={savePayment} onCancel={() => setPayModal(null)} />
        </Modal>
      ) : null}
    </div>
  );
}
