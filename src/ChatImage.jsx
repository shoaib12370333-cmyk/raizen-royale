// Shared picture pieces for the visitor chat widget and the admin Live Chat tab, so both look and
// behave the same: the thumbnail inside a bubble, the full-size viewer, the attach button, the
// "picture ready to send" preview, and paste / drag-and-drop helpers.

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./chat-image.css";
import { Icon, Spinner } from "./ui.jsx";
import { loadChatImage, chatErrorMessage } from "./chat.js";
import { firstImageFile } from "./imageTools.js";

/* ---------- inside a message bubble ---------- */
/** msg: {thumb, imageId}. onLoad fires when the thumbnail has laid out (use it to keep the list pinned to the bottom). */
export function ChatImage({ chatId, msg, onLoad }) {
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  if (!msg || !msg.thumb) return null;
  return (
    <>
      <button ref={btn} type="button" className="ci-thumb" onClick={() => setOpen(true)} aria-label="Open picture" aria-haspopup="dialog">
        <img src={msg.thumb} alt="Picture sent in the chat" onLoad={onLoad} onError={onLoad} draggable={false} />
      </button>
      {open ? (
        <ImageLightbox
          chatId={chatId}
          imageId={msg.imageId}
          thumb={msg.thumb}
          onClose={() => {
            setOpen(false);
            // hand focus back to the thumbnail that opened the viewer
            requestAnimationFrame(() => btn.current && btn.current.focus({ preventScroll: true }));
          }}
        />
      ) : null}
    </>
  );
}

/* ---------- full-size viewer ---------- */
function ImageLightbox({ chatId, imageId, thumb, onClose }) {
  const [state, setState] = useState({ full: "", error: "", loading: !!imageId });
  const closeRef = useRef(null);
  // The parent re-renders often (every snapshot); keep the latest onClose in a ref so the effect below runs once.
  const closeFn = useRef(onClose);
  closeFn.current = onClose;

  useEffect(() => {
    let cancelled = false;
    if (!imageId) { setState({ full: "", error: "", loading: false }); return undefined; }
    setState({ full: "", error: "", loading: true });
    loadChatImage(chatId, imageId)
      .then((full) => { if (!cancelled) setState({ full, error: "", loading: false }); })
      .catch((e) => { if (!cancelled) setState({ full: "", error: chatErrorMessage(e), loading: false }); });
    return () => { cancelled = true; };
  }, [chatId, imageId]);

  useEffect(() => {
    // Capture phase + stopPropagation: Esc closes only the viewer, not the chat panel behind it.
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); closeFn.current(); }
    };
    document.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (closeRef.current) closeRef.current.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, []);

  // Clicking the dark area (the bar or the stage background, not the picture) closes the viewer.
  const backdropClose = (e) => { if (e.target === e.currentTarget) closeFn.current(); };

  // Portal to <body>: the chat panel is transformed, which would otherwise trap position:fixed inside it.
  return createPortal(
    <div className="ci-lightbox" role="dialog" aria-modal="true" aria-label="Picture" onMouseDown={backdropClose}>
      <div className="ci-bar" onMouseDown={backdropClose}>
        {state.full ? (
          <a className="btn btn-ghost btn-sm" href={state.full} download="raizen-royale-picture.jpg">
            <Icon name="download" size={16} /> Save
          </a>
        ) : null}
        <button ref={closeRef} type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close picture">
          <Icon name="x" size={18} />
        </button>
      </div>
      <div className="ci-stage" onMouseDown={backdropClose}>
        {state.error ? (
          <div className="error-box" role="alert"><Icon name="alert" size={18} /><span>{state.error}</span></div>
        ) : (
          <>
            <img className={`ci-full${state.full ? " ready" : ""}`} src={state.full || thumb} alt="Full size picture" draggable={false} />
            {state.loading ? <div className="ci-loading"><Spinner /> Loading picture...</div> : null}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ---------- composer pieces ---------- */
/** A picture button with a hidden file input. onPick receives the FileList (hand it to useImageDraft().pick). */
export function AttachButton({ onPick, disabled = false, className = "" }) {
  const input = useRef(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="ci-file"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length) onPick(files);
          e.target.value = ""; // allow picking the same file again
        }}
      />
      <button
        type="button"
        className={`ci-attach ${className}`}
        onClick={() => input.current && input.current.click()}
        disabled={disabled}
        aria-label="Attach a picture"
        title="Attach a picture"
      >
        <Icon name="image" size={20} />
      </button>
    </>
  );
}

/** Shows the picture that is waiting to be sent, a "preparing" state, or a friendly error. */
export function DraftPreview({ draft, busy, error, onClear }) {
  if (!draft && !busy && !error) return null;
  return (
    <div className="ci-draft" role="group" aria-label="Picture to send">
      {busy ? (
        <div className="ci-draft-row"><Spinner /> <span>Preparing picture...</span></div>
      ) : null}
      {draft ? (
        <div className="ci-draft-row">
          <img src={draft.thumb} alt="Picture ready to send" />
          <span className="ci-draft-text">Picture ready. Add a caption if you like, then send.</span>
          <button type="button" className="ci-draft-x" onClick={onClear} aria-label="Remove picture" title="Remove picture"><Icon name="x" size={16} /></button>
        </div>
      ) : null}
      {error ? (
        <div className="error-box ci-draft-error" role="alert">
          <Icon name="alert" size={18} />
          <span>{error}</span>
          <button type="button" className="ci-draft-x" onClick={onClear} aria-label="Dismiss" title="Dismiss"><Icon name="x" size={16} /></button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- paste / drag and drop ---------- */
/** onPaste handler: if the clipboard holds a picture (e.g. a screenshot), attach it instead of pasting text. */
export function handlePasteImage(e, pick) {
  // Copying cells from Excel/Word puts a picture of them on the clipboard next to the text: keep the text.
  const text = e.clipboardData && e.clipboardData.getData ? e.clipboardData.getData("text/plain") : "";
  if (text) return;
  const files = e.clipboardData && e.clipboardData.files;
  const file = firstImageFile(files);
  if (file) {
    e.preventDefault();
    pick([file]);
  }
}
/** onDragOver handler: lets a picture be dropped on the composer. */
export function handleDragOverImage(e) {
  const types = e.dataTransfer && e.dataTransfer.types ? Array.from(e.dataTransfer.types) : [];
  if (types.includes("Files")) e.preventDefault();
}
/** onDrop handler. */
export function handleDropImage(e, pick) {
  const file = firstImageFile(e.dataTransfer && e.dataTransfer.files);
  if (file) {
    e.preventDefault();
    pick([file]);
  }
}
