import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="shell stack-xl">
      <section className="panel stack-md">
        <p className="eyebrow">404</p>
        <h1 className="title-lg">Страница не найдена</h1>
        <p className="muted">Такой страницы нет в этой игровой коробке.</p>
        <Link href="/" className="text-link">
          На главную
        </Link>
      </section>
    </main>
  );
}
