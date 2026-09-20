// Goddess Jade's external payment handles (self-reported model)
export const PAYMENT_METHODS = [
  {
    key: "venmo", label: "Venmo", handle: "@princessJade_", color: "#3D95CE", symbol: "V", supportsAmount: true,
    link: (a) => `https://venmo.com/princessJade_?txn=pay&amount=${a}&note=${encodeURIComponent("Tribute for Goddess Jade")}`,
  },
  {
    key: "cashapp", label: "Cash App", handle: "$drippinmami18", color: "#00D632", symbol: "$", supportsAmount: true,
    link: (a) => `https://cash.app/$drippinmami18/${a}`,
  },
  {
    key: "paypal", label: "PayPal", handle: "paypal.me/drippinmami", color: "#003087", symbol: "P", supportsAmount: true,
    link: (a) => `https://www.paypal.me/drippinmami/${a}`,
  },
  {
    key: "throne", label: "Throne", handle: "princessjade24", color: "#7C3AED", symbol: "♦", supportsAmount: false,
    link: () => "https://throne.com/princessjade24",
  },
  {
    key: "youpay", label: "YouPay", handle: "GoodessJade462", color: "#FF4E88", symbol: "♥", supportsAmount: false,
    link: () => "https://youpay.me/GoodessJade462",
  },
];

export const getMethod = (key) => PAYMENT_METHODS.find((m) => m.key === key) || PAYMENT_METHODS[0];
