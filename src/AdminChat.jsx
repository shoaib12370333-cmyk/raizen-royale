import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import "./admin-chat.css";
import { auth, onAuthStateChanged } from "./firebase.js";
import { Icon, Spinner, Switch, useToast } from "./ui.jsx";
import {
  useChatMessages,
  sendAdminMessage,
  markReadByAdmin,
  deleteChat,
  isOnline,
  isChatUser,
  chatErrorMessage,
  MAX_MESSAGE_LENGTH,
} from "./chat.js";
import { useImageDraft, firstImageFile } from "./imageTools.js";
import { ChatImage, AttachButton, DraftPreview, handlePasteImage, handleDragOverImage, handleDropImage } from "./ChatImage.jsx";

/* =========================================================
   Constants + small helpers
   ========================================================= */
const QUICK_REPLIES = [
  "Hi! How can I help you?",
  "Please share your game username.",
  "One moment, checking this for you.",
  "Thanks! Your request is done.",
];
const FILTERS = [
  ["all", "All"],
  ["unread", "Unread"],
  ["online", "Online"],
];
const GROUP_MS = 5 * 60 * 1000; // messages from one sender closer than this share a group
const NEAR_BOTTOM_PX = 80;
const MAX_TEXTAREA_PX = 140;
const MIN = 60000;
const HOUR = 3600000;
const DAY = 86400000;

// Inline glyphs that are not in the shared icon set.
const GLYPHS = {
  send: "M22 2 11 13M22 2 15 22l-4-9-9-4z",
  volOn: "M11 5 6 9H2v6h4l5 4zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07",
  volOff: "M11 5 6 9H2v6h4l5 4zM23 9l-6 6M17 9l6 6",
};
function Glyph({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={GLYPHS[name]} />
    </svg>
  );
}

// chat.lastMessage is "Photo" or "Photo: caption" for a picture message (see previewFor in chat.js).
const isPhotoPreview = (s) => /^Photo(?::|$)/.test(String(s || ""));
// True while a drag carries files (as opposed to text or a link being dragged around the page).
const dragHasFiles = (e) => !!(e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files"));

const isTabVisible = () => typeof document === "undefined" || document.visibilityState !== "hidden";
const isCoarsePointer = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

const shortDate = (ts, now) => {
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
};

/** "just now", "5m", "2h", "yesterday", "3d", "12 Oct". With long=true: "5m ago", "on 12 Oct". */
function relTime(ts, now, long = false) {
  if (!ts) return "";
  const diff = Math.max(0, now - ts);
  if (diff < 45000) return "just now";
  if (diff < HOUR) return Math.max(1, Math.floor(diff / MIN)) + (long ? "m ago" : "m");
  if (diff < DAY) return Math.floor(diff / HOUR) + (long ? "h ago" : "h");
  if (diff < 2 * DAY) return "yesterday";
  if (diff < 7 * DAY) return Math.floor(diff / DAY) + (long ? "d ago" : "d");
  return (long ? "on " : "") + shortDate(ts, now);
}

function dayLabel(ts, now) {
  const diff = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / DAY);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const timeOf = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fullStamp = (ts) => new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

function errText(err) {
  const code = (err && err.code) || "";
  if (code === "app/slow-down") return "You are sending too fast. Wait a moment and try again.";
  if (code === "app/empty") return "Type a message first.";
  if (code === "permission-denied" || code === "firestore/permission-denied") return "Permission denied. Make sure this account is set up as the admin (see the setup steps on the Live Chat tab).";
  if (code === "not-found") return "This conversation no longer exists.";
  if (code === "unavailable" || (typeof navigator !== "undefined" && navigator.onLine === false)) return "You seem to be offline. Check your connection and try again.";
  return "Something went wrong" + (err && err.message ? ` (${err.message})` : "") + ". Please try again.";
}

const isPermissionError = (e) =>
  !!e && (e.code === "permission-denied" || e.code === "firestore/permission-denied" || /missing or insufficient permissions|insufficient permissions/i.test(String(e.message || "")));

/** Like errText, with picture-specific wording (a refused picture usually means the rules were not republished). */
function pictureErrText(err) {
  const code = (err && err.code) || "";
  if (code === "app/not-image" || code === "app/image-too-big" || code === "app/bad-image" || code === "app/image-gone") return chatErrorMessage(err);
  if (isPermissionError(err)) return "Permission denied while sending the picture. Publish the latest firestore.rules (they now allow pictures) and try again.";
  return errText(err);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Ticking "now" so online dots and relative times expire without a data change. */
function useNow(ms) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, ms);
    const onVis = () => { if (isTabVisible()) tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms]);
  return now;
}

/* =========================================================
   Small building blocks
   ========================================================= */
function Avatar({ chat, online }) {
  const letter = Array.from(String(chat.name || "?").trim())[0] || "?";
  return (
    <span className={`ac-avatar${chat.isGuest ? "" : " acct"}`} aria-hidden="true">
      {letter}
      {online ? <span className="ac-pdot" /> : null}
    </span>
  );
}

function Tag({ chat }) {
  return <span className={`badge ac-tag${chat.isGuest ? "" : " gold"}`}>{chat.isGuest ? "Guest" : "Account"}</span>;
}

function CopyField({ label, value, emptyText = "Not available" }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const doCopy = async () => {
    if (!value) return;
    if (await copyText(value)) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
      toast("Copied to clipboard");
    } else {
      toast("Could not copy automatically. Select the text and copy it by hand.", "bad");
    }
  };
  return (
    <div className="ac-copy">
      <div className="ac-copy-main">
        <span className="ac-copy-k">{label}</span>
        <code>{value || emptyText}</code>
      </div>
      <button type="button" className={`btn btn-sm ${copied ? "btn-ok" : "btn-gold"}`} onClick={doCopy} disabled={!value} aria-label={`Copy ${label}`}>
        <Icon name={copied ? "check" : "copy"} size={15} /> {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/**
 * A picture thumbnail that re-renders only when the picture itself changes. ChatImage gives its full-size viewer a
 * fresh onClose on every render, and the viewer re-focuses its Close button whenever that changes, so without this the
 * 15 s clock tick or any incoming message would pull focus back to Close while someone is using the open viewer.
 */
const Thumb = React.memo(function Thumb({ chatId, thumb, imageId, onLoad }) {
  const msg = useMemo(() => ({ thumb, imageId }), [thumb, imageId]);
  return <ChatImage chatId={chatId} msg={msg} onLoad={onLoad} />;
});

/* =========================================================
   Setup / error states
   ========================================================= */
function ConsoleLink({ href, children }) {
  return (
    <a className="btn btn-ghost btn-sm" href={href} target="_blank" rel="noopener noreferrer">
      {children} <Icon name="external" size={14} />
    </a>
  );
}

function SetupCard() {
  const [user, setUser] = useState(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);
  const uid = user ? user.uid : "";
  const asVisitor = !!user && isChatUser(user);
  const pid = (auth.app && auth.app.options && auth.app.options.projectId) || "";
  const consoleLink = (path) => (pid ? `https://console.firebase.google.com/project/${encodeURIComponent(pid)}${path}` : "https://console.firebase.google.com/");

  return (
    <section className="card ac-setup" aria-labelledby="ac-setup-title">
      <div className="ac-setup-hero">
        <div className="ac-setup-ico"><Icon name="shield" size={28} /></div>
        <div>
          <h3 id="ac-setup-title">Live chat needs a one-time setup</h3>
          <p>Firebase is blocking the inbox until your account is marked as the admin. It takes about two minutes and you only do it once.</p>
        </div>
      </div>

      <div className="ac-setup-body">
        {asVisitor ? (
          <div className="error-box" role="alert">
            <Icon name="alert" size={18} />
            <span>You are signed in as a chat visitor, not as the admin. Log out, then log in again with your admin email and password before following the steps below.</span>
          </div>
        ) : null}

        <ol className="ac-steps" role="list">
          <li className="ac-step">
            <span className="ac-num" aria-hidden="true">1</span>
            <div className="ac-step-body">
              <h4>Publish the updated Firestore rules</h4>
              <p>
                In the Firebase console open <span className="ac-path"><b>Firestore Database</b><i>&rsaquo;</i><b>Rules</b></span>, replace the rules with the contents of <code className="ac-code">firestore.rules</code> from this project, then press <b>Publish</b>.
              </p>
              <div className="ac-step-actions"><ConsoleLink href={consoleLink("/firestore/databases/-default-/rules")}>Open Rules</ConsoleLink></div>
            </div>
          </li>

          <li className="ac-step">
            <span className="ac-num" aria-hidden="true">2</span>
            <div className="ac-step-body">
              <h4>Turn on Anonymous sign-in (for guests)</h4>
              <p>
                Open <span className="ac-path"><b>Authentication</b><i>&rsaquo;</i><b>Sign-in method</b><i>&rsaquo;</i><b>Anonymous</b></span>, switch it on and Save. Leave Email/Password enabled too, it is used for visitor accounts and for your own login.
              </p>
              <div className="ac-step-actions"><ConsoleLink href={consoleLink("/authentication/providers")}>Open Sign-in method</ConsoleLink></div>
            </div>
          </li>

          <li className="ac-step">
            <span className="ac-num" aria-hidden="true">3</span>
            <div className="ac-step-body">
              <h4>Mark yourself as the admin</h4>
              <p>
                Open <span className="ac-path"><b>Firestore Database</b><i>&rsaquo;</i><b>Data</b><i>&rsaquo;</i><b>Start collection</b></span>. Use the collection ID below, paste your UID as the Document ID, add any field (for example <code className="ac-code">enabled</code> = <code className="ac-code">true</code>) and Save.
              </p>
              <CopyField label="Collection ID" value="raizenRoyale_admins" />
              <CopyField label="Document ID (your UID)" value={uid} emptyText="Not signed in" />
              <div className="ac-step-actions"><ConsoleLink href={consoleLink("/firestore/databases/-default-/data")}>Open Data</ConsoleLink></div>
              <p className="hint">Why? Chat visitors are signed in to Firebase too, so this small marker document is how the database tells you apart from them.</p>
            </div>
          </li>

          <li className="ac-step">
            <span className="ac-num" aria-hidden="true">4</span>
            <div className="ac-step-body">
              <h4>Reload this page</h4>
              <p>Come back here and reload. The inbox appears on its own once the rules and the marker are in place.</p>
              <div className="ac-step-actions">
                <button type="button" className="btn btn-gold btn-sm" onClick={() => window.location.reload()}><Icon name="refresh" size={15} /> Reload page</button>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}

function GenericError({ error }) {
  const detail = [error && error.code, error && error.message].filter(Boolean).join(": ");
  return (
    <section className="card ac-setup" role="alert">
      <div className="ac-setup-hero">
        <div className="ac-setup-ico bad"><Icon name="alert" size={28} /></div>
        <div>
          <h3>Live chat could not load</h3>
          <p>Something went wrong while talking to Firebase. Check your internet connection and reload the page to try again. If it keeps happening, the message below tells you what Firebase said.</p>
        </div>
      </div>
      <div className="ac-setup-body">
        {detail ? <div className="ac-code-block">{detail}</div> : null}
        <div className="ac-step-actions">
          <button type="button" className="btn btn-gold btn-sm" onClick={() => window.location.reload()}><Icon name="refresh" size={15} /> Reload page</button>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   Conversation list
   ========================================================= */
function ChatRow({ chat, active, now, onSelect }) {
  const online = isOnline(chat, now);
  const unread = chat.unreadAdmin;
  const stamp = chat.lastMessageAt || chat.lastActivityAt || chat.lastOpenedAt;
  return (
    <li>
      <button
        type="button"
        className={`ac-row${unread ? " unread" : ""}${active ? " active" : ""}`}
        onClick={() => onSelect(chat.id)}
        data-chat={chat.id}
        aria-current={active ? "true" : undefined}
      >
        <Avatar chat={chat} online={online} />
        <span className="ac-body">
          <span className="ac-name-line">
            <span className="ac-name">{chat.name}</span>
            <Tag chat={chat} />
            <span className="sr-only">{online ? ", online" : ""}{unread ? `, ${unread} unread` : ""}</span>
          </span>
          <span className="ac-preview">
            {chat.lastMessage ? (
              <>
                {chat.lastSender === "admin" ? <span className="you">You: </span> : null}
                {isPhotoPreview(chat.lastMessage) ? <span className="ac-pic-ico" aria-hidden="true"><Icon name="image" size={14} /></span> : null}
                {chat.lastMessage}
              </>
            ) : (
              <i>Opened the chat</i>
            )}
          </span>
        </span>
        <span className="ac-side">
          {stamp ? <time className="ac-time" dateTime={new Date(stamp).toISOString()} title={fullStamp(stamp)}>{relTime(stamp, now)}</time> : null}
          {unread ? <span className="ac-unread" aria-hidden="true">{unread > 99 ? "99+" : unread}</span> : null}
        </span>
      </button>
    </li>
  );
}

/* =========================================================
   One open conversation (mounted per chat id, so the message hook starts fresh)
   ========================================================= */
function Conversation({ chat, now, drafts, onBack, onDeleted }) {
  const toast = useToast();
  const { messages, loading, error } = useChatMessages(chat.id);
  const online = isOnline(chat, now);
  const [coarse] = useState(isCoarsePointer);

  /* ----- keep "unread" honest: mark as read while the conversation is open and the tab is visible ----- */
  const [visible, setVisible] = useState(isTabVisible);
  const [deleting, setDeleting] = useState(false);
  const [marking, setMarking] = useState(false);
  const [recheck, setRecheck] = useState(0);
  const inflight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const on = () => setVisible(isTabVisible());
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  useEffect(() => {
    if (!visible || deleting || chat.unreadAdmin <= 0 || inflight.current) return;
    inflight.current = true;
    let ok = false;
    markReadByAdmin(chat.id)
      .then(() => { ok = true; }, () => {})
      .then(() => {
        inflight.current = false;
        // Only re-check after a success (a new message may have landed meanwhile). A failure never retries on its own.
        if (ok) setRecheck((n) => n + 1);
      });
  }, [chat.id, chat.unreadAdmin, visible, deleting, recheck]);

  const markNow = async () => {
    if (marking) return;
    setMarking(true);
    try {
      await markReadByAdmin(chat.id);
    } catch (err) {
      toast(errText(err), "bad");
    } finally {
      setMarking(false);
    }
  };

  const remove = async () => {
    if (deleting) return;
    if (!window.confirm(`Delete the conversation with ${chat.name}?\n\nAll of its messages will be permanently removed. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteChat(chat.id);
      delete drafts.current[chat.id];
      toast("Conversation deleted");
      onDeleted(chat.id);
    } catch (err) {
      setDeleting(false);
      toast(errText(err), "bad");
    }
  };

  /* ----- message list: day separators + grouping ----- */
  const items = useMemo(() => {
    const out = [];
    const days = messages.map((m) => new Date(m.createdAt).toDateString());
    let lastDay = "";
    messages.forEach((m, i) => {
      if (days[i] !== lastDay) {
        out.push({ type: "day", key: "day-" + days[i], ts: m.createdAt });
        lastDay = days[i];
      }
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const joinsPrev = !!prev && prev.sender === m.sender && days[i - 1] === days[i] && m.createdAt - prev.createdAt < GROUP_MS;
      const joinsNext = !!next && next.sender === m.sender && days[i + 1] === days[i] && next.createdAt - m.createdAt < GROUP_MS;
      out.push({ type: "msg", key: m.id, m, first: !joinsPrev, last: !joinsNext });
    });
    return out;
  }, [messages]);

  /* ----- scrolling: stick to the bottom unless the admin scrolled up ----- */
  const scrollRef = useRef(null);
  const stickRef = useRef(true);
  const prevRef = useRef({ init: false, lastId: null });
  const [newBelow, setNewBelow] = useState(false);
  const [live, setLive] = useState(false);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    stickRef.current = near;
    if (near) setNewBelow(false);
  };
  const jumpToBottom = () => {
    stickRef.current = true;
    setNewBelow(false);
    scrollToBottom();
  };
  // A picture lays out after its message is appended (the list was already scrolled by then), so each
  // thumbnail re-pins the bottom when the admin had not scrolled up. Stable, so the memoized thumbnails keep still.
  const repin = useCallback(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    if (loading) return;
    const last = messages.length ? messages[messages.length - 1] : null;
    const lastId = last ? last.id : null;
    const prev = prevRef.current;
    if (!prev.init) {
      prevRef.current = { init: true, lastId };
      stickRef.current = true;
      scrollToBottom();
      return;
    }
    if (lastId !== prev.lastId) {
      if (stickRef.current || (last && last.sender === "admin")) {
        stickRef.current = true;
        setNewBelow(false);
        scrollToBottom();
      } else if (last && last.sender === "user") {
        setNewBelow(true);
      }
    }
    prevRef.current = { init: true, lastId };
  }, [messages, loading]);

  // When the composer grows or shrinks the list gets shorter or taller; keep the bottom pinned.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => { if (stickRef.current) el.scrollTop = el.scrollHeight; });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Do not read the whole backlog out to screen readers on open; announce only what arrives afterwards.
  useEffect(() => {
    if (loading) return undefined;
    const t = setTimeout(() => setLive(true), 400);
    return () => clearTimeout(t);
  }, [loading]);

  /* ----- composer ----- */
  const taRef = useRef(null);
  const [text, setText] = useState(() => drafts.current[chat.id] || "");
  const [inflightSends, setInflightSends] = useState(0);
  const sending = inflightSends > 0;
  const [sendError, setSendError] = useState("");

  // One picture can wait in the composer. This component is mounted per chat id, so it resets on its own
  // when the admin opens another conversation.
  const pic = useImageDraft();
  const picRef = useRef(pic);
  picRef.current = pic;
  const picInflight = useRef(false); // the waiting picture is being sent: do not send it twice
  const [picSending, setPicSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    if (text) drafts.current[chat.id] = text;
    else delete drafts.current[chat.id];
  }, [text, chat.id, drafts]);

  useEffect(() => {
    if (!coarse && taRef.current) taRef.current.focus({ preventScroll: true });
  }, [coarse]);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    // Empty box: let the CSS min-height decide (a wrapping placeholder would otherwise inflate scrollHeight).
    if (!text) {
      el.style.height = "";
      return;
    }
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight + 2, MAX_TEXTAREA_PX) + "px";
  }, [text]);

  // Text, or a picture that is ready (and not already on its way), can be sent. Not while compressing or deleting.
  const canSend = !!(text.trim() || (pic.draft && !picSending)) && !pic.busy && !deleting;

  const submit = async () => {
    const draft = text.trim();
    // With a picture the text is just its caption. A waiting picture goes out once: while it is on its way only plain text can follow.
    const image = pic.draft && !picInflight.current ? pic.draft : null;
    if ((!draft && !image) || pic.busy || deleting) return;
    setInflightSends((n) => n + 1);
    setSendError("");
    setText("");
    stickRef.current = true;
    if (image) {
      picInflight.current = true;
      setPicSending(true);
    }
    try {
      await sendAdminMessage(chat.id, draft, image);
      // The picture leaves the composer only once it is saved (unless the admin already swapped it for another one).
      if (image && mounted.current && picRef.current.draft === image) picRef.current.clear();
    } catch (err) {
      if (!mounted.current) {
        // The admin already moved to another conversation: park the text as this conversation's draft.
        if (draft) {
          const kept = drafts.current[chat.id];
          drafts.current[chat.id] = (kept ? `${draft}\n${kept}` : draft).slice(0, MAX_MESSAGE_LENGTH);
        }
        if (image) toast(`The picture for ${chat.name} was not sent. ${pictureErrText(err)}`, "bad");
        return;
      }
      // Give the text back so nothing is lost (the picture never left the composer).
      if (draft) setText((cur) => (cur ? `${draft}\n${cur}` : draft).slice(0, MAX_MESSAGE_LENGTH));
      setSendError(image ? pictureErrText(err) : errText(err));
    } finally {
      if (image) {
        picInflight.current = false;
        setPicSending(false);
      }
      setInflightSends((n) => n - 1);
      if (!coarse && taRef.current) taRef.current.focus({ preventScroll: true });
    }
  };

  /* ----- paste (Ctrl+V a screenshot) and drag-and-drop onto the conversation ----- */
  const onPaste = (e) => {
    if (deleting) return;
    // Copying from a spreadsheet or Word also puts a rendered picture of the text on the clipboard: keep pasting the text.
    const cd = e.clipboardData;
    if (cd && cd.getData("text/plain") && cd.getData("text/html")) return;
    handlePasteImage(e, pic.pick);
  };
  const onDragEnter = (e) => {
    if (!dragHasFiles(e) || deleting) return;
    dragDepth.current += 1; // enter/leave also fire for every child element, so count them
    setDragging(true);
  };
  const onDragOver = (e) => handleDragOverImage(e);
  const onDragLeave = () => {
    // No types check here: some browsers hide them on dragleave, and the depth is only above 0 during a file drag.
    if (dragDepth.current === 0) return;
    dragDepth.current -= 1;
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e) => {
    if (!dragHasFiles(e)) return; // dragged text or a link: leave it to the browser
    dragDepth.current = 0;
    setDragging(false);
    e.preventDefault(); // never let the browser open a dropped file in this tab
    if (deleting) return;
    if (firstImageFile(e.dataTransfer.files)) handleDropImage(e, pic.pick);
    else pic.pick(e.dataTransfer.files); // not a picture: shows the friendly "only pictures" message
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !coarse) {
      e.preventDefault();
      submit();
    }
  };

  const insertQuick = (q) => {
    setSendError("");
    setText((cur) => {
      const base = cur && !/\s$/.test(cur) ? cur + " " : cur;
      return (base + q).slice(0, MAX_MESSAGE_LENGTH);
    });
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      const n = el.value.length;
      el.setSelectionRange(n, n);
    });
  };

  const seen = chat.lastSeenAt > 0;
  const count = text.length;

  return (
    <section
      className={`ac-convo${dragging ? " dragging" : ""}`}
      aria-label={`Conversation with ${chat.name}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="ac-head">
        <button type="button" className="btn btn-ghost btn-icon ac-back" onClick={onBack} aria-label="Back to conversations">
          <Icon name="arrow" size={18} />
        </button>
        <Avatar chat={chat} online={online} />
        <div className="ac-head-main">
          <div className="ac-head-name">
            <span className="ac-name">{chat.name}</span>
            <Tag chat={chat} />
          </div>
          <div className={`ac-status${online ? " on" : ""}`}>
            {online ? (
              <><span className="dot live" /> Online now</>
            ) : (
              <><Icon name="clock" size={13} /> {seen ? `Last seen ${relTime(chat.lastSeenAt, now, true)}` : "Offline"}</>
            )}
          </div>
        </div>
        <div className="ac-head-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={markNow} disabled={!chat.unreadAdmin || marking} aria-label="Mark as read" title="Mark as read">
            {marking ? <Spinner /> : <Icon name="check" size={15} />}
            <span className="ac-lbl">Mark as read</span>
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={remove} disabled={deleting} aria-label="Delete conversation" title="Delete conversation">
            {deleting ? <Spinner /> : <Icon name="trash" size={15} />}
            <span className="ac-lbl">Delete</span>
          </button>
        </div>
      </header>

      <div className="ac-msgs-wrap">
        <div
          className="ac-msgs"
          ref={scrollRef}
          onScroll={onScroll}
          role="log"
          aria-live={live ? "polite" : "off"}
          aria-relevant="additions"
          aria-label={`Messages with ${chat.name}`}
          tabIndex={0}
        >
          {loading ? (
            <div className="ac-state"><Spinner /> Loading messages...</div>
          ) : deleting ? (
            <div className="ac-state"><Spinner /> Deleting conversation...</div>
          ) : error ? (
            <div className="error-box ac-state-box" role="alert">
              <Icon name="alert" size={18} />
              <span>Could not load this conversation. {errText(error)}</span>
            </div>
          ) : items.length === 0 ? (
            <div className="ac-state ac-state-empty">
              <div className="ico"><Icon name="message" size={26} /></div>
              <b>No messages yet</b>
              <span>{chat.name} opened the chat but has not written anything. Say hello with a quick reply below.</span>
            </div>
          ) : (
            items.map((it) => {
              if (it.type === "day") {
                return <div key={it.key} className="ac-day"><span>{dayLabel(it.ts, now)}</span></div>;
              }
              const m = it.m;
              const mine = m.sender === "admin";
              const hasPic = !!(m.imageId && m.thumb);
              // A message that points at a picture we cannot show should not render as an empty bubble.
              const body = m.text || (!hasPic && (m.imageId || m.thumb) ? "Picture unavailable" : "");
              return (
                <div key={it.key} className={`ac-msg ${mine ? "mine" : "theirs"}${it.first ? " first" : ""}${it.last ? " last" : ""}${m.pending ? " pending" : ""}`}>
                  <div className={`ac-bubble${hasPic ? (body ? " has-pic" : " has-pic pic-only") : ""}`} title={fullStamp(m.createdAt)}>
                    <span className="sr-only">{mine ? "You: " : `${chat.name}: `}</span>
                    {hasPic ? <Thumb chatId={chat.id} thumb={m.thumb} imageId={m.imageId} onLoad={repin} /> : null}
                    {hasPic ? (body ? <span className="ac-cap">{body}</span> : null) : body}
                  </div>
                  {it.last || (mine && m.pending) ? (
                    <div className="ac-meta">
                      {mine && m.pending ? (
                        <><Spinner /> Sending...</>
                      ) : (
                        <>{timeOf(m.createdAt)}{mine ? <Icon name="check" size={12} /> : null}</>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        {newBelow ? (
          <button type="button" className="ac-newpill" onClick={jumpToBottom}>
            New messages <Icon name="down" size={15} />
          </button>
        ) : null}
      </div>

      <div className="ac-composer">
        <div className="ac-quick" role="group" aria-label="Quick replies">
          {QUICK_REPLIES.map((q) => (
            <button type="button" key={q} className="chip ac-chip" onClick={() => insertQuick(q)} disabled={deleting} title={q}>
              <span>{q}</span>
            </button>
          ))}
        </div>
        {sendError ? (
          <div className="error-box ac-send-error" role="alert">
            <Icon name="alert" size={18} />
            <span>{sendError}</span>
          </div>
        ) : null}
        {picSending ? (
          <div className="ci-draft" role="status">
            <div className="ci-draft-row"><Spinner /> <span>Sending picture...</span></div>
          </div>
        ) : (
          <DraftPreview draft={pic.draft} busy={pic.busy} error={pic.error} onClear={pic.clear} />
        )}
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="ac-compose-row">
            <AttachButton onPick={pic.pick} disabled={deleting || picSending} className="ac-attach" />
            <textarea
              ref={taRef}
              className="textarea ac-textarea"
              value={text}
              onChange={(e) => { setText(e.target.value); if (sendError) setSendError(""); }}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              placeholder={pic.draft ? "Add a caption (optional)..." : `Reply to ${chat.name}...`}
              aria-label={pic.draft ? `Add a caption (optional) for the picture to ${chat.name}` : `Reply to ${chat.name}`}
              rows={1}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={deleting}
            />
            <button type="submit" className="btn btn-gold ac-send" disabled={!canSend} aria-label="Send message" title="Send message">
              {sending ? <Spinner /> : <Glyph name="send" size={19} />}
            </button>
          </div>
          <div className="ac-compose-foot">
            <span className="hint">{coarse ? "Tap send to reply" : "Enter to send, Shift+Enter for a new line. Paste or drop a picture to attach it."}</span>
            <span className={`ac-count${count >= MAX_MESSAGE_LENGTH ? " bad" : count >= MAX_MESSAGE_LENGTH * 0.9 ? " warn" : ""}`}>
              {count}/{MAX_MESSAGE_LENGTH}<span className="sr-only"> characters used</span>
            </span>
          </div>
        </form>
      </div>

      {dragging ? (
        <div className="ac-drop" aria-hidden="true">
          <span><Icon name="image" size={20} /> Drop a picture to attach it</span>
        </div>
      ) : null}
    </section>
  );
}

/* =========================================================
   Admin "Live Chat" tab
   ========================================================= */
export default function AdminChat({ chats = [], loading = false, error = null, soundEnabled = false, onToggleSound }) {
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const now = useNow(15000);
  const drafts = useRef({}); // unsent text per conversation, kept while switching between chats
  const listRef = useRef(null);
  const rootRef = useRef(null);

  const selected = selectedId ? chats.find((c) => c.id === selectedId) || null : null;

  // The open conversation vanished (deleted elsewhere): drop the selection.
  useEffect(() => {
    if (selectedId && !loading && !error && !selected) setSelectedId(null);
  }, [selectedId, selected, loading, error]);

  const unreadTotal = useMemo(() => chats.reduce((n, c) => n + (c.unreadAdmin || 0), 0), [chats]);
  const counts = useMemo(
    () => ({
      all: chats.length,
      unread: chats.filter((c) => c.unreadAdmin > 0).length,
      online: chats.filter((c) => isOnline(c, now)).length,
    }),
    [chats, now]
  );
  const q = query.trim().toLowerCase();
  const visibleChats = useMemo(
    () =>
      chats.filter((c) => {
        if (q && !String(c.name).toLowerCase().includes(q)) return false;
        if (filter === "all" || c.id === selectedId) return true; // the open chat stays listed even after it is marked read
        return filter === "unread" ? c.unreadAdmin > 0 : isOnline(c, now);
      }),
    [chats, q, filter, selectedId, now]
  );

  if (error) return isPermissionError(error) ? <SetupCard /> : <GenericError error={error} />;

  const openConversation = (id) => {
    setSelectedId(id);
    // On a phone the card can sit partly under the nav or the bottom dock: bring it fully into view.
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 860px)").matches) {
      requestAnimationFrame(() => {
        if (rootRef.current) rootRef.current.scrollIntoView({ block: "nearest" });
      });
    }
  };

  const closeConversation = (id) => {
    setSelectedId(null);
    // Hand keyboard focus back to the row that was open.
    requestAnimationFrame(() => {
      const root = listRef.current;
      const el = root && window.CSS && CSS.escape ? root.querySelector(`[data-chat="${CSS.escape(id)}"]`) : null;
      const target = el || (root ? root.querySelector(".ac-row") : null);
      if (target) target.focus({ preventScroll: true });
    });
  };

  const onListKey = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = Array.from(listRef.current ? listRef.current.querySelectorAll(".ac-row") : []);
    const i = rows.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = rows[e.key === "ArrowDown" ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1)];
    if (next) next.focus();
  };

  const clearFilters = () => { setQuery(""); setFilter("all"); };
  const filtering = !!q || filter !== "all";

  let empty = null;
  if (!loading && chats.length === 0) {
    empty = { icon: "message", title: "No conversations yet", text: "When a visitor opens the chat box they show up here instantly." };
  } else if (!loading && visibleChats.length === 0) {
    if (q) empty = { icon: "search", title: "No matches", text: `Nobody called "${query.trim()}" in this view.` };
    else if (filter === "unread") empty = { icon: "check", title: "All caught up", text: "There are no unread conversations." };
    else empty = { icon: "users", title: "Nobody online", text: "Visitors appear here while their chat box is open." };
  }

  return (
    <section ref={rootRef} className={`card ac-root${selected ? " is-open" : ""}`} aria-label="Live chat">
      <div className="ac-toolbar">
        <div className="ac-title">
          <span className="ico"><Icon name="message" size={19} /></span>
          <div>
            <b>Live chat</b>
            <small>{counts.all} {counts.all === 1 ? "conversation" : "conversations"}{counts.online ? `, ${counts.online} online` : ""}</small>
          </div>
        </div>
        <span className={`ac-total${unreadTotal ? " has" : ""}`} role="status">
          <Icon name={unreadTotal ? "spark" : "check"} size={14} />
          {unreadTotal ? <><b>{unreadTotal}</b> unread</> : "All read"}
        </span>
        <label className="ac-sound">
          <Glyph name={soundEnabled ? "volOn" : "volOff"} size={18} />
          <span>Sound alerts</span>
          <Switch checked={!!soundEnabled} onChange={() => { if (onToggleSound) onToggleSound(); }} label="Play a sound for new chat messages" />
        </label>
      </div>

      <div className="ac-panes">
        <aside className="ac-list" aria-label="Conversations">
          <div className="ac-list-head">
            <div className="input-icon ac-search">
              <Icon name="search" size={17} />
              <input
                type="search"
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name"
                aria-label="Search conversations by name"
                autoComplete="off"
              />
            </div>
            <div className="seg ac-filter" role="group" aria-label="Filter conversations">
              {FILTERS.map(([key, label]) => (
                <button type="button" key={key} className={filter === key ? "active" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                  {label} <span className="n">{counts[key]}</span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="ac-skels" aria-busy="true" aria-label="Loading conversations">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton ac-skel" />)}
            </div>
          ) : empty ? (
            <div className="empty ac-empty">
              <div className="ico"><Icon name={empty.icon} size={26} /></div>
              <b>{empty.title}</b>
              <span>{empty.text}</span>
              {filtering && chats.length > 0 ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}><Icon name="x" size={14} /> Clear filters</button>
              ) : null}
            </div>
          ) : (
            <ul className="ac-rows" ref={listRef} onKeyDown={onListKey}>
              {visibleChats.map((c) => (
                <ChatRow key={c.id} chat={c} active={c.id === selectedId} now={now} onSelect={openConversation} />
              ))}
            </ul>
          )}
        </aside>

        {selected ? (
          <Conversation
            key={selected.id}
            chat={selected}
            now={now}
            drafts={drafts}
            onBack={() => closeConversation(selected.id)}
            onDeleted={closeConversation}
          />
        ) : (
          <div className="ac-convo ac-placeholder">
            <div className="empty">
              <div className="ico"><Icon name="message" size={28} /></div>
              <b>Select a conversation</b>
              <span>Pick a visitor on the left to read their messages and reply in real time.</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
