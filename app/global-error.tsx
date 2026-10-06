"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "#fbfbfa", color: "#050505" }}>
          <section style={{ width: "100%", maxWidth: 420, border: "1px solid #e4e4e7", borderRadius: 8, background: "#fff", padding: 24, textAlign: "center" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
            <p style={{ marginTop: 12, color: "#52525b", lineHeight: 1.6 }}>The app could not finish loading. Please retry.</p>
            <button style={{ marginTop: 20, height: 44, borderRadius: 12, border: 0, background: "#050505", color: "#fff", padding: "0 18px", fontWeight: 600 }} onClick={reset}>
              Retry
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
