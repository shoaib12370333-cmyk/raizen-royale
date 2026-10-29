// Client-side image preparation for chat attachments.
//
// Every picked image is decoded and RE-ENCODED to JPEG on a canvas. That shrinks it to fit in
// Firestore, applies the camera's EXIF rotation, and throws away everything that is not pixels
// (EXIF/GPS data, embedded scripts in SVG, animation, odd formats). The result is two data URLs:
//   thumb  small preview that is stored inside the message document
//   full   the viewable image, stored in a separate raizenRoyale_chats/{uid}/images/{id} document
//          and only downloaded when somebody opens it.

import { useState, useRef, useCallback } from "react";

export const MAX_INPUT_BYTES = 20 * 1024 * 1024; // refuse to even decode anything bigger
export const MAX_FULL_CHARS = 600000; // data-URL length cap for the full image (rules allow 700000)
export const MAX_THUMB_CHARS = 25000; // data-URL length cap for the thumbnail (rules allow 60000); small, because up to 200 are downloaded per conversation
export const JPEG_PREFIX = "data:image/jpeg;base64,";

// (longest side in px, JPEG quality) - tried in order until the result fits MAX_FULL_CHARS
const FULL_STEPS = [[1600, 0.82], [1400, 0.76], [1200, 0.7], [1024, 0.65], [800, 0.6], [640, 0.55]];
const THUMB_STEPS = [[240, 0.62], [200, 0.55], [160, 0.5]];

const err = (code, message) => Object.assign(new Error(message || code), { code });

export function imageErrorMessage(e) {
  switch (e && e.code) {
    case "app/not-image":
      return "Only pictures can be sent (JPG, PNG, WebP or GIF).";
    case "app/image-too-big":
      return "That picture is too large. Try a smaller one or a screenshot.";
    case "app/bad-image":
      return "That picture could not be read. Try a JPG or PNG instead.";
    default:
      return "Could not prepare that picture. Please try again.";
  }
}

const looksLikeImage = (file) =>
  !!file && (/^image\//i.test(file.type || "") || (!file.type && /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i.test(file.name || "")));

/** Decode to something drawable. createImageBitmap applies EXIF orientation; <img> is the fallback. */
async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close && bmp.close() };
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(err("app/bad-image"));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth || 1024, height: img.naturalHeight || 1024, release: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function encode(dec, maxSide, quality) {
  // Bound by area too, so a very tall screenshot keeps a readable width instead of shrinking to a sliver.
  const scale = Math.min(1, (maxSide * 2) / Math.max(dec.width, dec.height), Math.sqrt((maxSide * maxSide * 0.75) / (dec.width * dec.height)));
  const w = Math.max(1, Math.round(dec.width * scale));
  const h = Math.max(1, Math.round(dec.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw err("app/bad-image");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high"; // big photos are shrunk a lot in one step
  ctx.fillStyle = "#ffffff"; // JPEG has no alpha: flatten transparent PNGs onto white
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(dec.source, 0, 0, w, h);
  const url = canvas.toDataURL("image/jpeg", quality);
  canvas.width = canvas.height = 0; // free the pixel buffer right away
  if (!url.startsWith(JPEG_PREFIX)) throw err("app/bad-image");
  return { url, w, h };
}

/** @returns {Promise<{full: string, thumb: string, width: number, height: number}>} */
export async function prepareImage(file) {
  if (!looksLikeImage(file)) throw err("app/not-image");
  if (file.size > MAX_INPUT_BYTES) throw err("app/image-too-big");
  const dec = await decode(file);
  try {
    let full = null;
    for (const [side, q] of FULL_STEPS) {
      const out = encode(dec, side, q);
      if (out.url.length <= MAX_FULL_CHARS) { full = out; break; }
    }
    if (!full) throw err("app/image-too-big");
    let thumb = null;
    for (const [side, q] of THUMB_STEPS) {
      const out = encode(dec, side, q);
      if (out.url.length <= MAX_THUMB_CHARS) { thumb = out; break; }
    }
    if (!thumb) throw err("app/image-too-big");
    return { full: full.url, thumb: thumb.url, width: full.w, height: full.h };
  } finally {
    dec.release();
  }
}

/** Anything that looks like a picture in a file list / clipboard / drop (first one wins). */
export function firstImageFile(fileList) {
  const files = Array.from(fileList || []);
  return files.find(looksLikeImage) || null;
}

/**
 * Hook for the composer: one pending attachment at a time.
 *   draft  {full, thumb, width, height} | null
 *   busy   true while compressing
 *   error  friendly message | ""
 *   pick(fileOrFileList)  prepare an image (ignores non-images with an error)
 *   clear()
 */
export function useImageDraft() {
  const [state, setState] = useState({ draft: null, busy: false, error: "" });
  const ticket = useRef(0);

  const pick = useCallback(async (input) => {
    const file = input && typeof input.length === "number" && !input.type ? firstImageFile(input) : input;
    if (!file) {
      // A non-image changes nothing about a picture that is already compressing or waiting.
      setState((s) => ({ ...s, error: imageErrorMessage({ code: "app/not-image" }) }));
      return;
    }
    const mine = ++ticket.current;
    setState({ draft: null, busy: true, error: "" });
    try {
      const draft = await prepareImage(file);
      if (mine === ticket.current) setState({ draft, busy: false, error: "" });
    } catch (e) {
      if (mine === ticket.current) setState({ draft: null, busy: false, error: imageErrorMessage(e) });
    }
  }, []);

  const clear = useCallback(() => {
    ticket.current += 1; // abandon any compression still running
    setState({ draft: null, busy: false, error: "" });
  }, []);

  return { ...state, pick, clear };
}
