/* =========================================================
   Live chat, visitor side.
   Mounted once in App.jsx on public pages. All Firebase access goes through ./chat.js.
   Styling lives in chat-widget.css (every class is prefixed "cw-").
   ========================================================= */
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useId } from "react";
import "./chat-widget.css";
import { useText } from "./text.js";
import { Icon, Crest, Field, Spinner } from "./ui.jsx";
import { ChatImage, AttachButton, DraftPreview, handlePasteImage, handleDragOverImage, handleDropImage } from "./ChatImage.jsx";
import { useImageDraft, firstImageFile, imageErrorMessage } from "./imageTools.js";
import {
  useChatIdentity,
  useOwnChat,
  useChatMessages,
  continueAsGuest,
  registerAccount,
  loginAccount,
  logoutChat,
  sendUserMessage,
  openChat,
  heartbeat,
  markReadByUser,
  chatErrorMessage,
  validateUsername,
  normalizeUsername,
  MAX_MESSAGE_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "./chat.js";

const HEARTBEAT_MS = 45000; // "online" refresh while the box is open and visible
const CLOSE_MS = 200; // must match the cw-out animation
const STICK_PX = 90; // closer than this to the bottom counts as "reading the latest"
const PIN_MS = 1500; // after scrolling to a new message, a picture that finishes loading may still re-pin the bottom
const GROUP_MS = 4 * 60 * 1000; // same sender within this window shares one timestamp
const COUNTER_FROM = Math.floor(MAX_MESSAGE_LENGTH * 0.8);
const MAX_AREA_PX = 122; // five lines of the composer (keep in sync with .cw-area in the css)
const MOBILE_Q = "(max-width: 760px)";

const noop = () => {};
const isDenied = (err) => !!err && (err.code === "permission-denied" || err.code === "firestore/permission-denied");
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
// Auto-focus is for mouse and keyboard users. On a phone it would pop the keyboard over the thread the moment the sheet opens.
const focusSoft = (el) => {
  if (el && !coarsePointer()) el.focus({ preventScroll: true });
};

const USERNAME_RULE = "3-20 characters: a-z, 0-9 and underscore";

function friendlyError(err) {
  const code = err && err.code;
  if (code === "app/bad-username") return "Username must be 3-20 characters: letters a-z, numbers or underscore, no spaces.";
  if (code === "app/slow-down") return "You are sending messages very quickly. Wait a second and try again.";
  return chatErrorMessage(err);
}

/* ---------- time helpers ---------- */
const dayKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
function dayLabel(ms) {
  const d = new Date(ms);
  const now = new Date();
  const k = dayKey(ms);
  if (k === dayKey(now.getTime())) return "Today";
  if (k === dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime())) return "Yesterday";
  const opts = { weekday: "short", day: "numeric", month: "short" };
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString([], opts);
}
const timeLabel = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Flat render list: day separators + messages tagged with first/last of their group. */
function buildItems(messages) {
  const items = [];
  let prevDay = "";
  messages.forEach((m, i) => {
    const k = dayKey(m.createdAt);
    if (k !== prevDay) {
      items.push({ type: "day", key: `d-${m.id}`, label: dayLabel(m.createdAt) });
      prevDay = k;
    }
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const joinsPrev = !!prev && prev.sender === m.sender && dayKey(prev.createdAt) === k && m.createdAt - prev.createdAt < GROUP_MS;
    const joinsNext = !!next && next.sender === m.sender && dayKey(next.createdAt) === k && next.createdAt - m.createdAt < GROUP_MS;
    items.push({ type: "msg", key: m.id, m, first: !joinsPrev, last: !joinsNext });
  });
  return items;
}

/* ---------- tiny local icons (not in the shared set) ---------- */
function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5h.01M12 12h.01M12 19h.01" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
    </svg>
  );
}
function EyeIcon({ off }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

/* ---------- hooks ---------- */
function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
}

/**
 * The picture a visitor is about to send. It lives in the widget root (not in the thread) so, like the text
 * draft, it survives closing and reopening the panel, and it is dropped when the visitor logs out or changes.
 * `sending` is true while a picture message is on its way: the picture stays in the draft until the send
 * succeeded, so a failure loses nothing. `begin()` / `finish(token, ok)` bracket one send; the token (bumped
 * whenever the visitor changes) makes a late answer for a previous visitor harmless.
 */
function usePictureDraft(uid) {
  const image = useImageDraft();
  const { clear } = image;
  const [sending, setSending] = useState(false);
  const epoch = useRef(0);
  const owner = useRef(uid);

  // Layout effect: the next visitor never gets to paint a frame of the previous visitor's picture.
  useLayoutEffect(() => {
    if (owner.current === uid) return;
    owner.current = uid;
    epoch.current += 1;
    setSending(false);
    clear();
  }, [uid, clear]);

  const begin = useCallback(() => {
    setSending(true);
    return epoch.current;
  }, []);
  const finish = useCallback((token, ok) => {
    if (token !== epoch.current) return;
    setSending(false);
    if (ok) clear();
  }, [clear]);

  return { ...image, sending, begin, finish };
}

const hasFiles = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");

/* Keeps the full-screen mobile sheet inside the visible area when the on-screen keyboard is up. */
function useVisualViewportVars(ref, active) {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const el = ref.current;
    if (!active || !vv || !el) return undefined;
    const apply = () => {
      el.style.setProperty("--cw-vvh", `${Math.round(vv.height)}px`);
      el.style.setProperty("--cw-vvt", `${Math.round(vv.offsetTop)}px`);
      // Keyboard up: the home-indicator inset is no longer at the bottom of the sheet, so the css drops that padding.
      if (window.innerHeight - vv.height > 140) el.setAttribute("data-kb", "");
      else el.removeAttribute("data-kb");
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      el.style.removeProperty("--cw-vvh");
      el.style.removeProperty("--cw-vvt");
      el.removeAttribute("data-kb");
    };
  }, [active, ref]);
}

/**
 * Everything the admin sees about this visitor: "opened the chat", "online" and read receipts.
 * - openChat: once per open (the ref guard also covers React StrictMode's double effect run)
 * - heartbeat: every 45s, only while open and the tab is visible
 * - markReadByUser: while open and visible, whenever admin messages are unread
 * `paused` is true while a sign-in is in flight so we never write with a half-finished identity.
 * Errors are swallowed; a permission-denied on openChat flips the UI to the "not available" state.
 */
function usePresence({ open, identity, paused, unread, nonce, onBlocked }) {
  const visible = usePageVisible();
  const openedKey = useRef("");
  const lastBeat = useRef(0);
  const uid = identity ? identity.uid : "";
  const name = identity ? identity.name : "";
  const isGuest = identity ? identity.isGuest : false;

  useEffect(() => {
    if (!open || !identity) {
      openedKey.current = "";
      return;
    }
    if (paused) return;
    const key = `${uid}|${name}|${isGuest ? 1 : 0}|${nonce}`;
    if (openedKey.current === key) return;
    openedKey.current = key;
    lastBeat.current = Date.now();
    openChat(identity).catch((err) => {
      if (isDenied(err)) onBlocked(true);
    });
  }, [open, paused, uid, name, isGuest, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !identity || paused || !visible) return undefined;
    const beat = () => {
      lastBeat.current = Date.now();
      heartbeat(identity).catch(noop);
    };
    if (Date.now() - lastBeat.current > 20000) beat(); // came back to the tab after a while
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [open, paused, visible, uid, name, isGuest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !identity || paused || !visible || !(unread > 0)) return;
    markReadByUser(identity).catch(noop);
  }, [open, paused, visible, uid, unread]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* =========================================================
   Header menu (log out / upgrade a guest)
   ========================================================= */
function HeaderMenu({ canUpgrade, isGuest, onUpgrade, onLogout }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      setConfirm(false);
      return undefined;
    }
    const first = menuRef.current && menuRef.current.querySelector("[role='menuitem']");
    if (first) first.focus();
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === "Escape") {
      // Close the menu first, not the whole panel. preventDefault also tells the panel-level Esc listener to stand down.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      if (btnRef.current) btnRef.current.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && menuRef.current) {
      const items = Array.from(menuRef.current.querySelectorAll("[role='menuitem']"));
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next].focus();
    }
  };

  const logoutClick = () => {
    // A guest has no password, so leaving is permanent. Ask once.
    if (isGuest && !confirm) {
      setConfirm(true);
      return;
    }
    setOpen(false);
    onLogout();
  };

  return (
    <div className="cw-menu-wrap" ref={wrapRef} onKeyDown={onKeyDown}>
      <button
        ref={btnRef}
        type="button"
        className="cw-iconbtn"
        aria-label="Chat menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreIcon />
      </button>
      {open ? (
        <div className="cw-menu" role="menu" id={menuId} ref={menuRef} aria-label="Chat options">
          {canUpgrade ? (
            <button type="button" role="menuitem" className="cw-menu-item" onClick={() => { setOpen(false); onUpgrade(); }}>
              <Icon name="user" size={17} />
              <span>Create account to save your history</span>
            </button>
          ) : null}
          <button type="button" role="menuitem" className={`cw-menu-item danger ${confirm ? "confirm" : ""}`} onClick={logoutClick}>
            <Icon name="logout" size={17} />
            <span>
              {confirm ? "Tap again to log out" : "Log out"}
              {confirm ? <small>A guest chat cannot be reopened once you leave.</small> : null}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================
   Signed out: Guest | Log in | Sign up   (also the "upgrade guest" form)
   ========================================================= */
const MODES = [["guest", "Guest"], ["login", "Log in"], ["signup", "Sign up"]];
const HERO = {
  guest: ["Chat with our team", "No sign-up needed. Add a name if you like."],
  login: ["Welcome back", "Log in to pick up where you left off."],
  signup: ["Create your account", "Keep your chat history every time you visit."],
};

function Submit({ busy, children }) {
  return (
    <button type="submit" className="btn btn-gold btn-block" disabled={busy}>
      {busy ? (
        <>
          <Spinner /> Please wait...
        </>
      ) : (
        <>
          {children}
          <Icon name="arrow" size={17} className="arrow" />
        </>
      )}
    </button>
  );
}

function PasswordField({ label, value, onChange, onBlur, show, onToggle, autoComplete, hint, placeholder }) {
  return (
    <Field label={label} className="cw-field" hint={hint}>
      <span className="input-icon cw-pass">
        <Icon name="lock" size={17} />
        <input
          className="input"
          aria-label={label}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        {onToggle ? (
          <button type="button" className="cw-eye" onClick={onToggle} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
            <EyeIcon off={show} />
          </button>
        ) : null}
      </span>
    </Field>
  );
}

function AuthScreen({ upgrade, busy, setBusy, onDone, onBack }) {
  const [mode, setMode] = useState(upgrade ? "signup" : "guest");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [seen, setSeen] = useState({ u: false, p: false, c: false });
  const [error, setError] = useState(null);
  const firstRef = useRef(null);

  useEffect(() => {
    focusSoft(firstRef.current);
  }, [mode]);

  const fail = (msg) => setError({ msg, n: Date.now() });
  const mark = (k) => setSeen((s) => (s[k] ? s : { ...s, [k]: true }));
  const go = (m) => {
    if (busy) return;
    setMode(m);
    setError(null);
    setPassword("");
    setConfirm("");
    setShowPw(false);
    setSeen({ u: false, p: false, c: false });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const u = normalizeUsername(username);
    let problem = "";
    if (mode === "login" && (!u || !password)) {
      problem = "Enter your username and password.";
    } else if (mode === "signup") {
      if (!validateUsername(u)) problem = "Username must be 3-20 characters: letters a-z, numbers or underscore, no spaces.";
      else if (password.length < MIN_PASSWORD_LENGTH) problem = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
      else if (password !== confirm) problem = "The two passwords do not match.";
    }
    if (problem) {
      setSeen({ u: true, p: true, c: true });
      fail(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (mode === "guest") await continueAsGuest(name);
      else if (mode === "login") await loginAccount(u, password);
      else await registerAccount(u, password);
      setPassword("");
      setConfirm("");
      onDone();
    } catch (err) {
      fail(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const onUser = (e) => setUsername(e.target.value.replace(/\s/g, "").toLowerCase());
  const uOk = validateUsername(username);
  const userHint = !username ? USERNAME_RULE : uOk ? <span className="cw-ok">Looks good</span> : seen.u ? <span className="cw-bad">Only a-z, 0-9 and _ , 3 to 20 characters, no spaces.</span> : USERNAME_RULE;
  const pwHint = password.length >= MIN_PASSWORD_LENGTH ? <span className="cw-ok">Looks good</span> : seen.p && password ? <span className="cw-bad">At least {MIN_PASSWORD_LENGTH} characters.</span> : `At least ${MIN_PASSWORD_LENGTH} characters`;
  const confirmHint = !confirm ? null : confirm === password ? <span className="cw-ok">Passwords match</span> : seen.c ? <span className="cw-bad">Passwords do not match yet.</span> : null;

  const [headline, sub] = upgrade
    ? ["Keep your chat history", "Pick a username and password. This conversation moves over to your new account."]
    : HERO[mode];

  return (
    <div className="cw-auth">
      <div className="cw-hero">
        <span className="cw-hero-crest"><Crest size={40} /></span>
        <h3 className="cw-hero-line">{headline}</h3>
        <p className="cw-hero-sub">{sub}</p>
      </div>

      {upgrade ? null : (
        <div className="seg cw-seg" role="group" aria-label="How would you like to chat?">
          {MODES.map(([id, label]) => (
            <button key={id} type="button" className={mode === id ? "active" : ""} aria-pressed={mode === id} onClick={() => go(id)} disabled={busy}>
              {label}
            </button>
          ))}
        </div>
      )}

      <form className="cw-form" onSubmit={submit} noValidate>
        {mode === "guest" ? (
          <Field label="Display name" className="cw-field" hint="Optional. Lets us greet you by name.">
            <span className="input-icon">
              <Icon name="user" size={17} />
              <input
                ref={firstRef}
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                maxLength={30}
                autoComplete="nickname"
              />
            </span>
          </Field>
        ) : (
          <>
            <Field label="Username" className="cw-field" hint={mode === "signup" ? userHint : null}>
              <span className="input-icon">
                <Icon name="user" size={17} />
                <input
                  ref={firstRef}
                  className="input"
                  value={username}
                  onChange={onUser}
                  onBlur={() => mark("u")}
                  placeholder={mode === "signup" ? "Choose a username" : "Your username"}
                  maxLength={20}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={mode === "signup" && seen.u && !uOk}
                />
              </span>
            </Field>
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              onBlur={() => mark("p")}
              show={showPw}
              onToggle={() => setShowPw((v) => !v)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={mode === "signup" ? `At least ${MIN_PASSWORD_LENGTH} characters` : "Your password"}
              hint={mode === "signup" ? pwHint : null}
            />
            {mode === "signup" ? (
              <>
                <PasswordField
                  label="Confirm password"
                  value={confirm}
                  onChange={setConfirm}
                  onBlur={() => mark("c")}
                  show={showPw}
                  autoComplete="new-password"
                  placeholder="Type it again"
                  hint={confirmHint}
                />
                <div className="info-box cw-note">
                  <Icon name="lock" size={16} />
                  <span>There is no password reset. Please remember your password, because we cannot recover it for you.</span>
                </div>
              </>
            ) : null}
          </>
        )}

        {error ? (
          <div className="error-box cw-err" role="alert" key={error.n}>
            <Icon name="alert" size={17} />
            <span>{error.msg}</span>
          </div>
        ) : null}

        <Submit busy={busy}>{mode === "guest" ? "Start chat" : mode === "login" ? "Log in" : upgrade ? "Save my history" : "Create account"}</Submit>
      </form>

      {upgrade ? (
        <button type="button" className="cw-link" onClick={onBack} disabled={busy}>
          Back to <b>chat</b>
        </button>
      ) : mode === "guest" ? (
        <p className="cw-fine">You can create an account later to keep your history.</p>
      ) : mode === "login" ? (
        <button type="button" className="cw-link" onClick={() => go("signup")}>
          New here? <b>Create an account</b>
        </button>
      ) : (
        <button type="button" className="cw-link" onClick={() => go("login")}>
          Already have an account? <b>Log in</b>
        </button>
      )}
    </div>
  );
}

/* =========================================================
   Conversation
   ========================================================= */
const Row = React.memo(function Row({ item, fresh, chatId, onImage }) {
  const { m, first, last } = item;
  const mine = m.sender === "user";
  const hasPic = !!(m.imageId && m.thumb);
  // A picture whose thumbnail is missing (should not happen) still gets a line, never an empty bubble.
  const caption = m.text || (m.imageId && !m.thumb ? "Picture" : "");
  return (
    <div className={`cw-row ${mine ? "me" : "them"} ${first ? "first" : ""} ${last ? "last" : ""} ${fresh ? "is-new" : ""}`}>
      {mine ? null : <span className="cw-av-slot">{last ? <span className="cw-mini"><Crest size={17} glow={false} /></span> : null}</span>}
      <div className="cw-stack">
        <div className={`cw-bubble ${hasPic ? "has-pic" : ""} ${m.pending ? "is-pending" : ""}`}>
          <span className="sr-only">{mine ? "You: " : "Support: "}</span>
          {hasPic ? <ChatImage chatId={chatId} msg={m} onLoad={onImage} /> : null}
          {hasPic ? (caption ? <span className="cw-cap">{caption}</span> : null) : caption}
        </div>
        {last ? (
          <div className={`cw-meta ${m.pending ? "pending" : ""}`}>
            {m.pending ? (
              <>
                <Spinner /> Sending
              </>
            ) : (
              timeLabel(m.createdAt)
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
});

function StateCard({ icon, title, text, action }) {
  return (
    <div className="cw-state">
      <div className="cw-state-ico"><Icon name={icon} size={26} /></div>
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
}

function Conversation({ identity, t, blocked, onRetry, draftRef, pic }) {
  const { messages, loading, error } = useChatMessages(identity.uid);
  const denied = blocked || isDenied(error);
  // The draft belongs to one visitor: never hand one person's unsent text to whoever signs in next.
  const [text, setText] = useState(() => (draftRef.current.uid === identity.uid ? draftRef.current.text : ""));
  const [sendError, setSendError] = useState(null);
  const [pill, setPill] = useState(false);
  const [dragging, setDragging] = useState(false); // a file is being dragged over the thread

  const listRef = useRef(null);
  const areaRef = useRef(null);
  const textRef = useRef(text);
  const mountedRef = useRef(true);
  const dragDepth = useRef(0);
  const pinUntil = useRef(0); // until then a loading picture re-pins the list to the bottom
  const stickRef = useRef(true);
  const lastIdRef = useRef(null);
  const loadedRef = useRef(false);
  const seenRef = useRef(null);
  const freshRef = useRef(null);
  if (!seenRef.current) {
    seenRef.current = new Set();
    freshRef.current = new Set();
  }
  textRef.current = text;

  const items = useMemo(() => buildItems(messages), [messages]);

  // Messages that appear after the first load get the pop-in. Once fresh, always fresh,
  // so the pending -> confirmed re-render does not cancel the animation half way.
  if (loadedRef.current) {
    messages.forEach((m) => {
      if (!seenRef.current.has(m.id)) freshRef.current.add(m.id);
    });
  }
  useEffect(() => {
    messages.forEach((m) => seenRef.current.add(m.id));
  }, [messages]);

  // Keep an unsent draft when the panel is closed and reopened.
  const chatUid = identity.uid;
  useEffect(() => () => { draftRef.current = { uid: chatUid, text: textRef.current }; }, [draftRef, chatUid]);

  // A send can finish after the panel was closed; then there is no thread left to put a failed text back into.
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!denied) focusSoft(areaRef.current);
  }, [denied]);

  // Picture is ready: put the cursor in the composer so a caption can be typed straight away (not on phones, see focusSoft).
  const hasDraft = !!pic.draft;
  useEffect(() => {
    if (hasDraft && !denied) focusSoft(areaRef.current);
  }, [hasDraft, denied]);

  // Auto-growing composer (max five lines, then it scrolls).
  useLayoutEffect(() => {
    const ta = areaRef.current;
    if (!ta) return;
    // Empty box: let the CSS min-height decide. While the panel is animating in, the textarea can be
    // measured at a tiny width, and a wrapping placeholder would otherwise inflate scrollHeight.
    if (!text) {
      ta.style.height = "";
      return;
    }
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_AREA_PX)}px`;
  }, [text, denied]);

  const scrollToBottom = useCallback((smooth) => {
    const el = listRef.current;
    if (!el) return;
    if (smooth && !reducedMotion() && el.scrollTo) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  }, []);

  // First load: jump to the bottom. After that: follow new messages unless the visitor scrolled up.
  useLayoutEffect(() => {
    if (loading) return;
    const el = listRef.current;
    if (!el) return;
    const last = messages.length ? messages[messages.length - 1] : null;
    const lastId = last ? last.id : null;
    if (!loadedRef.current) {
      loadedRef.current = true;
      lastIdRef.current = lastId;
      stickRef.current = true;
      pinUntil.current = Date.now() + PIN_MS;
      el.scrollTop = el.scrollHeight;
      return;
    }
    if (lastId === lastIdRef.current) return; // only an edit (pending -> sent), nothing new
    lastIdRef.current = lastId;
    if (!last) return;
    if (last.sender === "user" || stickRef.current) {
      stickRef.current = true;
      pinUntil.current = Date.now() + PIN_MS;
      scrollToBottom(true);
      setPill(false);
    } else {
      setPill(true);
    }
  }, [messages, loading, scrollToBottom]);

  // The list shrinks when the composer grows or the mobile keyboard opens; keep the latest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => {
      if (stickRef.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [denied]);

  // A thumbnail gets its size only after it has loaded, i.e. after its message was appended and scrolled to.
  // If the visitor was following the latest messages, pin the bottom again (stable identity keeps Row memoized).
  // The grace window covers the smooth scroll to a new message: while it runs, onScroll can briefly decide the visitor
  // is no longer at the bottom, which must not stop the picture from being scrolled into view.
  const onImage = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    if (stickRef.current || Date.now() < pinUntil.current) {
      stickRef.current = true;
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
    stickRef.current = near;
    if (near) setPill(false);
  };

  const jumpToLatest = () => {
    stickRef.current = true;
    setPill(false);
    scrollToBottom(true);
    if (areaRef.current) areaRef.current.focus({ preventScroll: true });
  };

  // The text of a message that failed goes back into the composer (or, if the thread was closed meanwhile, into the saved draft).
  const restoreText = (body) => {
    if (!body) return;
    if (!mountedRef.current) {
      const d = draftRef.current;
      if (d.uid === identity.uid && !d.text.trim()) draftRef.current = { uid: identity.uid, text: body };
      return;
    }
    setText((cur) => (cur.trim() ? `${body}\n${cur}`.slice(0, MAX_MESSAGE_LENGTH) : body));
  };

  const send = () => {
    if (pic.busy || pic.sending) return; // the picture is still being prepared, or the previous one is still on its way
    const body = text.trim();
    const img = pic.draft;
    if (!body && !img) return;
    setSendError(null);
    setText(""); // the message shows up immediately as "sending"; the text comes back if it fails
    stickRef.current = true;
    // Keep the cursor in the composer. On a touch screen only if it is already there: a picture-only send (gallery -> Send)
    // would otherwise pop the keyboard up over the photo that was just sent.
    if (areaRef.current && (!coarsePointer() || document.activeElement === areaRef.current)) areaRef.current.focus({ preventScroll: true });
    // The picture stays in the draft until the send succeeded; a failure keeps it (and the text) for another try.
    const token = img ? pic.begin() : 0;
    if (!img && pic.error) pic.clear(); // a text message also dismisses a leftover "could not read that picture" note
    sendUserMessage(identity, body, img || null).then(
      () => {
        if (img) pic.finish(token, true);
      },
      (err) => {
        if (img) pic.finish(token, false);
        if (err && err.code === "app/empty") return;
        restoreText(body);
        if (mountedRef.current) setSendError({ msg: friendlyError(err), n: Date.now() });
      }
    );
  };

  // A picture can come from the attach button, a paste or a drop. Nothing new is accepted while one is being sent.
  const pickImage = (input) => {
    if (pic.sending) return;
    // Not a picture, while a picture is already waiting: say so here. The draft's own error row has a dismiss button that
    // also throws the waiting picture away.
    if (pic.draft && input && typeof input.length === "number" && !input.type && !firstImageFile(input)) {
      setSendError({ msg: imageErrorMessage({ code: "app/not-image" }), n: Date.now() });
      return;
    }
    pic.pick(input);
  };

  // A screenshot or a copied picture is attached. Cells copied from Excel or Word also bring a picture of themselves,
  // but they bring text too: whenever the clipboard has text, paste the text as usual.
  const onPaste = (e) => {
    const cd = e.clipboardData;
    if (cd && cd.getData && cd.getData("text/plain").trim()) return;
    handlePasteImage(e, pickImage);
  };

  const dragEnd = () => {
    dragDepth.current = 0;
    setDragging(false);
  };
  const onDragEnter = (e) => {
    if (!hasFiles(e)) return;
    dragDepth.current += 1;
    if (!pic.sending) setDragging(true);
  };
  const onDragLeave = (e) => {
    if (!hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDragOver = (e) => handleDragOverImage(e);
  const onDrop = (e) => {
    dragEnd();
    if (!hasFiles(e)) return; // dropped text or a link: leave it to the browser
    handleDropImage(e, pickImage);
    if (!e.defaultPrevented) {
      // Not a picture. Swallow the drop anyway (the browser would otherwise open the file and leave the site) and let the hook say so.
      e.preventDefault();
      pickImage(e.dataTransfer.files);
    }
  };

  const onKeyDown = (e) => {
    // keyCode 229 is Safari's Enter that confirms an IME composition (isComposing is already false there).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      send();
    }
  };

  const onChange = (e) => {
    setText(e.target.value);
    if (sendError) setSendError(null);
  };

  if (denied) {
    return (
      <StateCard
        icon="alert"
        title="Chat is not available right now"
        text="Please try again in a little while."
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
            <Icon name="refresh" size={15} /> Try again
          </button>
        }
      />
    );
  }

  const len = text.length;
  const showCount = len >= COUNTER_FROM;
  const canSend = !pic.busy && !pic.sending && (!!text.trim() || !!pic.draft);

  // The welcome bubble stays until the team has replied once ("shown before the first reply").
  // With no messages it stands alone; otherwise it sits right under the first day separator.
  const welcome =
    !loading && !error && !messages.some((m) => m.sender === "admin") ? (
      <div key="welcome" className="cw-row them first last cw-welcome">
        <span className="cw-av-slot"><span className="cw-mini"><Crest size={17} glow={false} /></span></span>
        <div className="cw-stack">
          <div className="cw-bubble">{t.chatWelcome}</div>
        </div>
      </div>
    ) : null;

  return (
    <div
      className={`cw-convo ${dragging ? "is-drop" : ""}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="cw-listwrap">
        <div className="cw-list" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-label="Conversation with support" tabIndex={0}>
          {loading ? (
            <div className="cw-skel" aria-hidden="true"><i /><i /><i /></div>
          ) : error ? (
            <div className="info-box cw-note">
              <Icon name="alert" size={16} />
              <span>We could not load your messages. You can still send a new one.</span>
            </div>
          ) : null}
          {messages.length === 0 ? welcome : null}
          {items.map((it, i) => (
            <React.Fragment key={it.key}>
              {it.type === "day" ? (
                <div className="cw-day"><span>{it.label}</span></div>
              ) : (
                <Row item={it} fresh={freshRef.current.has(it.m.id)} chatId={identity.uid} onImage={onImage} />
              )}
              {i === 0 ? welcome : null}
            </React.Fragment>
          ))}
        </div>
        {pill ? (
          <button type="button" className="cw-pill" onClick={jumpToLatest}>
            <Icon name="down" size={15} stroke={2.6} /> New messages
          </button>
        ) : null}
      </div>

      {dragging ? (
        <div className="cw-drop" aria-hidden="true">
          <Icon name="image" size={28} />
          <span>Drop a picture to attach it</span>
        </div>
      ) : null}

      <div className="cw-composer">
        {sendError ? (
          <div className="error-box cw-err" role="alert" key={sendError.n}>
            <Icon name="alert" size={16} />
            <span>{sendError.msg}</span>
          </div>
        ) : null}
        {pic.sending ? (
          <div className="ci-draft" role="status">
            <div className="ci-draft-row"><Spinner /> <span>Sending picture...</span></div>
          </div>
        ) : (
          <DraftPreview draft={pic.draft} busy={pic.busy} error={pic.error} onClear={pic.clear} />
        )}
        <div className="cw-compose">
          <AttachButton onPick={pickImage} disabled={pic.sending} />
          <textarea
            ref={areaRef}
            className="cw-area"
            rows={1}
            value={text}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={t.chatPlaceholder}
            aria-label={pic.draft ? "Add a caption (optional)" : "Type your message"}
            maxLength={MAX_MESSAGE_LENGTH}
            enterKeyHint="send"
            autoComplete="off"
          />
          <button type="button" className="cw-send" onMouseDown={(e) => e.preventDefault()} onClick={send} disabled={!canSend} aria-label="Send message">
            <SendIcon />
          </button>
        </div>
        <div className={`cw-foot ${showCount ? "has-count" : ""}`}>
          <span className="cw-hint">Enter to send &middot; Shift+Enter for a new line</span>
          {showCount ? (
            <span className={`cw-count ${len >= MAX_MESSAGE_LENGTH ? "max" : len >= MAX_MESSAGE_LENGTH * 0.95 ? "warn" : ""}`}>
              {len}/{MAX_MESSAGE_LENGTH}
            </span>
          ) : null}
          {len >= MAX_MESSAGE_LENGTH ? <span className="sr-only" role="status">Character limit reached</span> : null}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Widget root: launcher + panel
   ========================================================= */
export default function ChatWidget() {
  const t = useText();
  const { identity: rawIdentity, ready } = useChatIdentity();

  // useChatIdentity hands out a new object on every auth event; keep ours stable by value.
  const uid = rawIdentity ? rawIdentity.uid : "";
  const name = rawIdentity ? rawIdentity.name : "";
  const isGuest = rawIdentity ? rawIdentity.isGuest : false;
  const identity = useMemo(() => (uid ? { uid, name, isGuest } : null), [uid, name, isGuest]);
  const pic = usePictureDraft(uid); // the picture waiting to be sent: kept while the panel is closed, dropped when the visitor changes

  const [phase, setPhase] = useState("closed"); // closed | open | closing
  const [busy, setBusy] = useState(false); // a sign-in / sign-up is in flight
  const [upgrading, setUpgrading] = useState(false); // a guest is creating an account
  const [blocked, setBlocked] = useState(false); // firestore said permission-denied
  const [nonce, setNonce] = useState(0); // bumped by "Try again"

  const launcherRef = useRef(null);
  const panelRef = useRef(null);
  const closeTimer = useRef(null);
  const draftRef = useRef({ uid: "", text: "" });
  const panelId = useId();

  const own = useOwnChat(identity);
  const unread = own ? own.unreadUser : 0;
  const isOpen = phase === "open";
  const mounted = phase !== "closed";
  const live = busy ? null : identity; // what the UI shows; null while an auth action is running
  // Only count messages as read while the thread is actually on screen (not the sign-in / upgrade form or the error card).
  const viewing = !!live && !upgrading && !blocked;

  usePresence({ open: isOpen, identity, paused: busy, unread: viewing ? unread : 0, nonce, onBlocked: setBlocked });
  useVisualViewportVars(panelRef, mounted);

  const openPanel = useCallback(() => {
    clearTimeout(closeTimer.current);
    setBlocked(false);
    setPhase("open");
  }, []);

  const closePanel = useCallback((returnFocus) => {
    clearTimeout(closeTimer.current);
    setPhase((p) => (p === "open" ? "closing" : p));
    closeTimer.current = setTimeout(() => {
      setPhase("closed");
      // The launcher is hidden on phones while the sheet is open, so hand focus back once it is visible again.
      if (returnFocus && launcherRef.current) launcherRef.current.focus();
    }, CLOSE_MS);
  }, []);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Full-screen sheet on phones: stop the page behind it from scrolling.
  useEffect(() => {
    if (!mounted || typeof window === "undefined" || !window.matchMedia || !window.matchMedia(MOBILE_Q).matches) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  // Esc closes the panel from anywhere (focus can sit on the launcher or on nothing after a log out).
  // The header menu preventDefaults its own Esc, so that one only closes the menu.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !e.defaultPrevented && !e.isComposing) closePanel(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closePanel]);

  // Touch screens skip the text-field auto-focus (keyboard), so put focus on the dialog itself for screen readers.
  useEffect(() => {
    if (!isOpen || !coarsePointer()) return;
    const el = panelRef.current;
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [isOpen]);

  // Signed out: forget any unsent draft. Runs after the thread unmounted and saved it, so it always wins.
  useEffect(() => {
    if (ready && !identity) draftRef.current = { uid: "", text: "" };
  }, [ready, identity]);

  const onLogout = async () => {
    try {
      await logoutChat();
    } catch (err) {
      /* signing out of a guest/chat account should never crash the page */
    }
    setUpgrading(false);
    setBlocked(false);
  };

  const onRetry = () => {
    setBlocked(false);
    setNonce((n) => n + 1);
  };

  let body;
  if (!identity && !ready) {
    body = (
      <div className="cw-state" role="status">
        <Spinner />
        <span className="sr-only">Loading chat</span>
      </div>
    );
  } else if (!live || upgrading) {
    body = (
      <AuthScreen
        key={upgrading ? "upgrade" : "signin"}
        upgrade={upgrading}
        busy={busy}
        setBusy={setBusy}
        onDone={() => setUpgrading(false)}
        onBack={() => setUpgrading(false)}
      />
    );
  } else {
    body = <Conversation key={`${live.uid}:${nonce}`} identity={live} t={t} blocked={blocked} onRetry={onRetry} draftRef={draftRef} pic={pic} />;
  }

  const badge = unread > 99 ? "99+" : String(unread);
  const launcherLabel = isOpen ? "Close live chat" : unread > 0 ? `Open live chat, ${unread} unread ${unread === 1 ? "message" : "messages"}` : "Open live chat";

  return (
    <div className="cw-root">
      <button
        ref={launcherRef}
        type="button"
        className={`cw-launcher ${isOpen ? "is-open" : ""} ${unread > 0 && !isOpen ? "has-unread" : ""}`}
        onClick={() => (isOpen ? closePanel(false) : openPanel())}
        aria-label={launcherLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={mounted ? panelId : undefined}
      >
        <span className="cw-ring" aria-hidden="true" />
        <span className="cw-ico cw-ico-chat"><Icon name="message" size={27} stroke={1.8} fill /></span>
        <span className="cw-ico cw-ico-close"><Icon name="x" size={24} stroke={2.4} /></span>
        {unread > 0 && !isOpen ? <span className="cw-badge" key={unread} aria-hidden="true">{badge}</span> : null}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {unread > 0 && !isOpen ? `${unread} new ${unread === 1 ? "message" : "messages"} from support` : ""}
      </span>

      {mounted ? (
        <section id={panelId} ref={panelRef} className="cw-panel" data-state={phase} role="dialog" aria-label={t.chatTitle} tabIndex={-1}>
          <header className="cw-head">
            <span className="cw-head-av"><Crest size={30} glow={false} /></span>
            <div className="cw-head-txt">
              <h2 className="cw-title gold-text">{t.chatTitle}</h2>
              <p className="cw-sub">
                <span className="dot live" aria-hidden="true" />
                <span>{t.chatSubtitle}</span>
              </p>
            </div>
            {live ? (
              <HeaderMenu canUpgrade={live.isGuest && !upgrading} isGuest={live.isGuest} onUpgrade={() => setUpgrading(true)} onLogout={onLogout} />
            ) : null}
            <button type="button" className="cw-iconbtn" onClick={() => closePanel(true)} aria-label="Close chat">
              <Icon name="x" size={18} />
            </button>
          </header>
          <div className="cw-body">{body}</div>
        </section>
      ) : null}
    </div>
  );
}
