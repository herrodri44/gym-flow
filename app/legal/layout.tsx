import Link from 'next/link'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4 sm:px-6">
          <Link href="/" className="font-bold tracking-tight text-[#1B2845]">
            GymDex
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {children}
      </main>
      <footer className="border-t py-6 text-center text-xs text-zinc-400">
        © {new Date().getFullYear()} GymDex
      </footer>
    </div>
  )
}
