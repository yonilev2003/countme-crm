import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50" dir="ltr">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/countme-logo.svg" alt="CountMe" className="h-8 w-8" />
            <span className="font-display text-lg font-bold text-slate-900">
              הנהלת CountMe
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <Link href="/privacy" className="hover:text-slate-900">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-900">
              Terms
            </Link>
            <Link href="/login" className="hover:text-slate-900">
              Login
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <article className="legal-prose space-y-4 text-slate-700 leading-relaxed">
          {children}
        </article>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-4xl px-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} CountMe — Internal CRM for the management team
        </div>
      </footer>
    </div>
  );
}
