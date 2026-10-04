import React, { useEffect, useRef } from "react";
import { Icon } from "./ui.jsx";

/* One shared receipt painter for every payment method. */
async function paintReceipt(canvas, { amount, sats, game, method, date, idLabel, idValue }) {
  try {
    await Promise.all([
      document.fonts.load("800 34px Cinzel"),
      document.fonts.load("700 22px Cinzel"),
      document.fonts.load("600 16px Manrope"),
    ]);
  } catch {
    /* fonts are optional */
  }
  const W = 720, H = 960;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const DISPLAY = '"Cinzel", Georgia, serif';
  const BODY = '"Manrope", system-ui, sans-serif';

  // Background
  ctx.fillStyle = "#07050a";
  ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(W / 2, 0, 10, W / 2, 0, 520);
  g.addColorStop(0, "rgba(224,24,63,0.45)");
  g.addColorStop(1, "rgba(224,24,63,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W / 2, H, 10, W / 2, H, 480);
  g.addColorStop(0, "rgba(246,210,122,0.22)");
  g.addColorStop(1, "rgba(246,210,122,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Gold frame
  const frame = ctx.createLinearGradient(0, 0, W, H);
  frame.addColorStop(0, "#fff1c4");
  frame.addColorStop(0.5, "#b9801f");
  frame.addColorStop(1, "#f6d27a");
  ctx.strokeStyle = frame;
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.globalAlpha = 1;

  // Crown
  ctx.strokeStyle = "#f6d27a";
  ctx.fillStyle = "#f6d27a";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 34, 128);
  ctx.lineTo(W / 2 - 24, 96);
  ctx.lineTo(W / 2 - 8, 114);
  ctx.lineTo(W / 2, 90);
  ctx.lineTo(W / 2 + 8, 114);
  ctx.lineTo(W / 2 + 24, 96);
  ctx.lineTo(W / 2 + 34, 128);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = "#e0183f";
  ctx.arc(W / 2, 112, 4, 0, Math.PI * 2);
  ctx.fill();

  // Title
  ctx.textAlign = "center";
  const t = ctx.createLinearGradient(0, 150, 0, 195);
  t.addColorStop(0, "#fff6d8");
  t.addColorStop(1, "#d9a441");
  ctx.fillStyle = t;
  ctx.font = `800 40px ${DISPLAY}`;
  ctx.fillText("RAIZEN ROYALE", W / 2, 184);
  ctx.fillStyle = "#9d9281";
  ctx.font = `700 13px ${BODY}`;
  ctx.fillText("P A Y M E N T   R E C E I P T", W / 2, 214);

  // Paid stamp
  ctx.fillStyle = "rgba(94,224,143,0.12)";
  ctx.strokeStyle = "rgba(94,224,143,0.55)";
  ctx.lineWidth = 2;
  const sx = W / 2 - 78, sy = 250, sw = 156, sh = 44, sr = 22;
  ctx.beginPath();
  ctx.moveTo(sx + sr, sy);
  ctx.arcTo(sx + sw, sy, sx + sw, sy + sh, sr);
  ctx.arcTo(sx + sw, sy + sh, sx, sy + sh, sr);
  ctx.arcTo(sx, sy + sh, sx, sy, sr);
  ctx.arcTo(sx, sy, sx + sw, sy, sr);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#5ee08f";
  ctx.font = `800 17px ${BODY}`;
  ctx.fillText("✓  PAID", W / 2, sy + 29);

  // Amount
  const a = ctx.createLinearGradient(0, 330, 0, 400);
  a.addColorStop(0, "#fff6d8");
  a.addColorStop(1, "#f6d27a");
  ctx.fillStyle = a;
  ctx.font = `800 82px ${DISPLAY}`;
  ctx.fillText(`$${amount ? Number(amount).toFixed(2) : "0.00"}`, W / 2, 392);
  if (sats) {
    ctx.fillStyle = "#bcb09c";
    ctx.font = `700 18px ${BODY}`;
    ctx.fillText(`${Number(sats).toLocaleString()} sats`, W / 2, 428);
  }

  // Dashed divider
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 468);
  ctx.lineTo(W - 80, 468);
  ctx.stroke();
  ctx.setLineDash([]);

  // Details
  const rows = [
    ["Game", game || "—"],
    ["Method", method],
    ["Date", (date || new Date()).toLocaleString()],
    [idLabel, idValue ? String(idValue) : "—"],
  ];
  let y = 520;
  rows.forEach(([label, value]) => {
    ctx.textAlign = "left";
    ctx.fillStyle = "#7d7364";
    ctx.font = `800 13px ${BODY}`;
    ctx.fillText(String(label).toUpperCase(), 84, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#f6efe2";
    ctx.font = `700 19px ${BODY}`;
    let v = String(value);
    while (ctx.measureText(v).width > 400 && v.length > 4) v = v.slice(0, -2);
    if (v !== String(value)) v += "…";
    ctx.fillText(v, W - 84, y);
    y += 62;
  });

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = "#7d7364";
  ctx.font = `600 14px ${BODY}`;
  ctx.fillText("Keep this receipt as proof of payment", W / 2, H - 92);
  ctx.fillStyle = "#f6d27a";
  ctx.font = `800 18px ${DISPLAY}`;
  ctx.fillText("raizenroyale.shop", W / 2, H - 62);
}

export function ReceiptView({ data, downloadLabel = "Download receipt", note }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current) paintReceipt(canvasRef.current, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `raizen-royale-receipt-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <>
      <canvas ref={canvasRef} className="receipt-canvas" />
      <button type="button" onClick={download} className="btn btn-gold btn-block">
        <Icon name="download" size={18} /> {downloadLabel}
      </button>
      {note ? <div className="hint" style={{ textAlign: "center" }}>{note}</div> : null}
    </>
  );
}

export function SuccessMark() {
  return (
    <svg className="check-anim" viewBox="0 0 84 84" aria-hidden="true">
      <circle cx="42" cy="42" r="38" />
      <path d="M26 43l11 11 21-23" />
    </svg>
  );
}
