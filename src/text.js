import React from "react";

export const DEFAULT_SETTINGS = {
  metaLink: "https://facebook.com/",
  messengerUsername: "",
  whatsappLink: "",
  discordLink: "",
  instagramLink: "",
  lnbitsEnabled: false,
  cashtapEnabled: false,
  nowpaymentsEnabled: false,
  cashoutEnabled: true,
  cashoutMetaLink: "",
  cashoutMessageTemplate: "Hello, I would like to request a cash-out.\n\nGame: {game}\nGame Username: {username}\nCash-Out Amount: ${amount}\nPayment Method: {method}\nPayment Details: {details}\nRequest ID: {requestId}",
};

/* Editable site text (admin can change every label/heading) */
export const DEFAULT_TEXT = {
  siteName: "Raizen Royale",
  navGames: "Games",
  navPayments: "Payment methods",
  navContact: "Contact support",
  navCashout: "Cash Out",

  heroBadge: "Now live",
  heroTitle: "Play big. Win big.",
  heroSubtitle: "Download your favourite games, add funds in seconds and cash out whenever you win.",
  heroPrimaryBtn: "Browse games",
  heroSecondaryBtn: "Cash out",

  homeEyebrow: "The arsenal",
  homeTitle: "Our games",
  homeSubtitle: "Pick a game to download, or reach out if you need an account.",
  searchPlaceholder: "Search games...",
  noGamesText: "No games added yet.",
  downloadBtn: "Download now",
  needAccountBtn: "Need account?",

  howEyebrow: "How it works",
  howTitle: "Three steps to the table",
  how1Title: "Pick a game",
  how1Text: "Browse the lineup and download the game that fits your style.",
  how2Title: "Get your account",
  how2Text: "Tap \"Need account?\" and we set you up on Messenger in minutes.",
  how3Title: "Play & cash out",
  how3Text: "Add funds any time and request your cash-out when you're ready.",
  ctaTitle: "Ready to cash out?",
  ctaText: "Submit your request in under a minute and we'll take it from there.",

  paymentsEyebrow: "The vault",
  paymentsTitle: "Payment methods",
  paymentsSubtitle: "Use any of the options below to send payment.",
  noPaymentsText: "No payment methods added yet.",
  openLinkBtn: "Open link",

  lightningTitle: "Pay with Lightning",
  lightningSubtitle: "Bitcoin Lightning Network, instant settlement.",
  lightningAmountPlaceholder: "Amount in USD (e.g. 5.00)",
  lightningGamePlaceholder: "For which game? (optional)",
  lightningGenerateBtn: "Generate invoice",
  lightningWaitingText: "Scan with your Lightning wallet, or copy the invoice below.",
  lightningCopyBtn: "Copy invoice",
  lightningWaitingStatus: "Waiting for payment...",
  lightningPaidText: "Payment received!",
  lightningDownloadReceiptBtn: "Download receipt",
  lightningReceiptNote: "Save this image and send it to us as proof of payment.",
  lightningExpiredTitle: "Invoice expired",
  lightningExpiredText: "This invoice is more than 30 minutes old and may no longer be valid. Please generate a new invoice before paying, or the payment may fail.",
  lightningNewInvoiceBtn: "Generate new invoice",

  cashtapTitle: "Pay with Card / Bank / CashApp",
  cashtapSubtitle: "Secure checkout via CashTap.",
  nowpaymentsTitle: "Pay with Card / Apple Pay",
  nowpaymentsSubtitle: "Opens a secure checkout in a new tab.",
  continueCheckoutBtn: "Continue to checkout",

  loginTitle: "Admin access",
  loginUsernamePlaceholder: "Admin email",
  loginPasswordPlaceholder: "Password",
  loginBtn: "Log in",
  footerConnectText: "Connect with us",
};

/* Admin "Site Text" editor is generated from this list. [key, label] */
export const TEXT_GROUPS = [
  { title: "Brand & navigation", fields: [["siteName", "Site name"], ["navGames", "Nav: Games label"], ["navPayments", "Nav: Payment methods label"], ["navContact", "Nav: Contact support label"], ["navCashout", "Nav: Cash Out button"]] },
  { title: "Home hero", fields: [["heroBadge", "Badge"], ["heroTitle", "Headline"], ["heroSubtitle", "Subtitle"], ["heroPrimaryBtn", "Primary button"], ["heroSecondaryBtn", "Secondary button"]] },
  { title: "Games section", fields: [["homeEyebrow", "Eyebrow (small label above title)"], ["homeTitle", "Title"], ["homeSubtitle", "Subtitle"], ["searchPlaceholder", "Search box placeholder"], ["noGamesText", "\"No games\" message"], ["downloadBtn", "\"Download now\" button"], ["needAccountBtn", "\"Need account?\" button"]] },
  { title: "How it works", fields: [["howEyebrow", "Eyebrow"], ["howTitle", "Title"], ["how1Title", "Step 1 title"], ["how1Text", "Step 1 text"], ["how2Title", "Step 2 title"], ["how2Text", "Step 2 text"], ["how3Title", "Step 3 title"], ["how3Text", "Step 3 text"], ["ctaTitle", "Bottom banner title"], ["ctaText", "Bottom banner text"]] },
  { title: "Payments page", fields: [["paymentsEyebrow", "Eyebrow"], ["paymentsTitle", "Title"], ["paymentsSubtitle", "Subtitle"], ["noPaymentsText", "\"No payment methods\" message"], ["openLinkBtn", "\"Open link\" button"]] },
  { title: "Lightning payment", fields: [["lightningTitle", "Title"], ["lightningSubtitle", "Subtitle"], ["lightningAmountPlaceholder", "Amount field placeholder"], ["lightningGamePlaceholder", "Game dropdown placeholder"], ["lightningGenerateBtn", "\"Generate invoice\" button"], ["lightningWaitingText", "Waiting-for-scan text"], ["lightningCopyBtn", "\"Copy invoice\" button"], ["lightningWaitingStatus", "\"Waiting for payment...\" status"], ["lightningPaidText", "\"Payment received!\" text"], ["lightningDownloadReceiptBtn", "\"Download receipt\" button"], ["lightningReceiptNote", "Receipt reminder note"], ["lightningExpiredTitle", "\"Invoice expired\" title"], ["lightningExpiredText", "\"Invoice expired\" text"], ["lightningNewInvoiceBtn", "\"Generate new invoice\" button"]] },
  { title: "Card / CashApp payments", fields: [["cashtapTitle", "CashTap section title"], ["cashtapSubtitle", "CashTap section subtitle"], ["nowpaymentsTitle", "NOWPayments section title"], ["nowpaymentsSubtitle", "NOWPayments section subtitle"], ["continueCheckoutBtn", "\"Continue to checkout\" button"]] },
  { title: "Login page", fields: [["loginTitle", "Title"], ["loginUsernamePlaceholder", "Username field placeholder"], ["loginPasswordPlaceholder", "Password field placeholder"], ["loginBtn", "\"Log in\" button"]] },
  { title: "Footer", fields: [["footerConnectText", "\"Connect with us\" text"]] },
];

export const SAMPLE_GAMES = [
  { id: "sample-1", name: "Free Fire", flyer: "", downloadLink: "https://www.freefiremobile.com/" },
  { id: "sample-2", name: "PUBG Mobile", flyer: "", downloadLink: "https://www.pubgmobile.com/" },
];

export const DEFAULT_CASHOUT_FIELDS = [
  { id: "cashapp", name: "Cash App", type: "payment", placeholder: "$cashtag", required: true, active: true },
  { id: "chime", name: "Chime", type: "payment", placeholder: "Chime username / phone / email", required: true, active: true },
  { id: "paypal", name: "PayPal", type: "payment", placeholder: "PayPal email", required: true, active: true },
];

export const TextContext = React.createContext(DEFAULT_TEXT);
export function useText() {
  return React.useContext(TextContext);
}

/* Strip leading emoji/symbols that older saved text may contain (icons are drawn instead). */
export function cleanLabel(s) {
  return String(s || "").replace(/^[^\p{L}\p{N}]+/u, "");
}
