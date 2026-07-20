"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    const register = () => {
      const manifestHref = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href;
      const appBase = manifestHref
        ? new URL("./", manifestHref)
        : new URL("./", document.baseURI);
      const workerUrl = new URL("sw.js", appBase);

      navigator.serviceWorker.register(workerUrl.pathname, { scope: appBase.pathname }).then((registration) => {
        registration.update().catch(() => undefined);
      }).catch(() => undefined);
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
