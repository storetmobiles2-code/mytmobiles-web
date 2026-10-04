"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#000", color: "#fff" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>myT Mobiles is having trouble</h1>
          <p style={{ opacity: 0.7 }}>Please try again in a moment.{error.digest ? ` Reference: ${error.digest}` : ""}</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 10, border: 0, background: "#d10f68", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
