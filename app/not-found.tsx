import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="shell stack-xl">
      <section className="panel stack-md">
        <p className="eyebrow">404</p>
        <h1 className="title-lg">Page not found</h1>
        <p className="muted">The page you opened does not exist in this game box.</p>
        <Link href="/" className="text-link">
          Back to home
        </Link>
      </section>
    </main>
  );
}
