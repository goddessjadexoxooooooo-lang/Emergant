// Master registry of every payment method key used across the app.
export const MASTER = {
  stripe: { label: "Stripe", symbol: "S", color: "#635BFF" },
  paypal: { label: "PayPal", symbol: "P", color: "#003087", handle: "@drippinmami", link: (a) => `https://www.paypal.me/drippinmami${a ? "/" + a : ""}` },
  paypal_general: { label: "PayPal", symbol: "P", color: "#003087", handle: "@drippinmami", link: (a) => `https://www.paypal.me/drippinmami${a ? "/" + a : ""}` },
  paypal_recurring: { label: "PayPal", symbol: "P", color: "#003087", handle: "@drippinmami", link: (a) => `https://www.paypal.me/drippinmami${a ? "/" + a : ""}` },
  venmo: { label: "Venmo", symbol: "V", color: "#3D95CE", handle: "@princessJade_", link: (a) => `https://venmo.com/princessJade_?txn=pay&amount=${a}&note=${encodeURIComponent("Tribute for Goddess Jade")}` },
  cashapp: { label: "Cash App", symbol: "$", color: "#00D632", handle: "$drippinmami18", link: (a) => `https://cash.app/$drippinmami18${a ? "/" + a : ""}` },
  throne: { label: "Throne", symbol: "♦", color: "#7C3AED", handle: "throne.com/princessjade24", link: () => "https://throne.com/princessjade24" },
  youpay: { label: "YouPay", symbol: "♥", color: "#FF4E88", handle: "youpay.me/GoodessJade462", link: () => "https://youpay.me/GoodessJade462" },
  applepay: { label: "Apple Pay", symbol: "", color: "#111111", handle: "thesafari18@gmail.com", link: null },
};

export const getMethodInfo = (key) => MASTER[key] || MASTER.venmo;

// Checkout screen payment options (exact order + sublabels from design)
export const CHECKOUT_METHODS = [
  { key: "stripe", sub: "Recurring" },
  { key: "paypal_general", sub: "General" },
  { key: "paypal_recurring", sub: "Recurring" },
  { key: "venmo", sub: "External" },
  { key: "cashapp", sub: "Also accepts Stripe" },
  { key: "throne", sub: "Wishlist" },
  { key: "youpay", sub: "External" },
];

// Creator Profile quick links
export const QUICK_LINKS = ["paypal", "cashapp", "venmo", "throne", "youpay", "applepay"];

// Amount presets for checkout
export const AMOUNT_PRESETS = [25, 50, 100, 150, 200, 300, 500, 1000];

export const TIER_MIN = 25;
export const TIER_MAX = 1000;

export function tierForAmount(a) {
  if (a >= 250) return "Diamond";
  if (a >= 100) return "Gold";
  if (a >= 50) return "Silver";
  if (a >= 25) return "Bronze";
  return "Initiate";
}

// Legacy helpers kept for existing imports
export const PAYMENT_METHODS = ["venmo", "cashapp", "paypal", "throne", "youpay"].map((k) => ({ key: k, ...MASTER[k] }));
export const getMethod = (key) => ({ key, ...getMethodInfo(key) });
