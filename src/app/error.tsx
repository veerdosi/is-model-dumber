"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="not-found">
      <span className="eyebrow">VIEW UNAVAILABLE</span>
      <h1>We couldn’t load this view.</h1>
      <p>No conclusions can be drawn from a loading failure.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
