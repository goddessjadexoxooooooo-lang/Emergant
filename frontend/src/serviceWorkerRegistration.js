const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1" ||
    /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/.test(window.location.hostname),
);

export function register() {
  if ("serviceWorker" in navigator) {
    const swUrl = `${process.env.PUBLIC_URL}/sw.js`;

    if (isLocalhost) {
      navigator.serviceWorker.ready.then(() => {
        console.log("This web app is being served cache-first by a service worker.");
      });
    }

    navigator.serviceWorker.register(swUrl).catch((error) => {
      console.error("Error during service worker registration:", error);
    });
  }
}

export function unregister() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch((error) => {
        console.error("Error during service worker unregistration:", error);
      });
  }
}
