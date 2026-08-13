// Loaded by Node before the app server starts.
// Purpose: malformed bot URLs like `/r/%E0%A4` can throw `URIError: URI malformed`
// inside the HTTP/router stack before TanStack middleware is reached. If not swallowed,
// PM2 restarts the worker. We only swallow this known-safe URI decode error.

const INSTALL_KEY = Symbol.for("adspx.uriGuardInstalled");

function isMalformedUriError(error) {
  return error instanceof URIError || String(error?.message || error).includes("URI malformed");
}

if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;
  globalThis.__adspxUriGuardCount = 0;
  globalThis.__adspxUriGuardWindow = Date.now();

  const originalEmit = process.emit.bind(process);

  process.emit = function patchedEmit(eventName, error, ...args) {
    if (eventName === "uncaughtException" && isMalformedUriError(error)) {
      const now = Date.now();
      if (now - globalThis.__adspxUriGuardWindow > 60000) {
        globalThis.__adspxUriGuardWindow = now;
        globalThis.__adspxUriGuardCount = 0;
      }
      globalThis.__adspxUriGuardCount += 1;
      if (globalThis.__adspxUriGuardCount === 1 || globalThis.__adspxUriGuardCount % 500 === 0) {
        console.warn("[uri-guard] malformed bot URL swallowed", {
          countThisMinute: globalThis.__adspxUriGuardCount,
        });
      }
      return true;
    }

    return originalEmit(eventName, error, ...args);
  };
}