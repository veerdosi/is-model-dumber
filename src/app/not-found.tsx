import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <span className="eyebrow">404 / SIGNAL LOST</span>
      <h1>This page isn’t being monitored.</h1>
      <Link className="button button-default" href="/">
        Back to the overview →
      </Link>
    </main>
  );
}
