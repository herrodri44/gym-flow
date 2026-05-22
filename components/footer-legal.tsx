import Link from 'next/link'

export function FooterLegal() {
  return (
    <footer className="mt-auto border-t border-zinc-100 py-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-center text-xs text-zinc-400 space-x-3">
          <span>© {new Date().getFullYear()} GymDex</span>
          <span>·</span>
          <Link href="/legal/privacidad" className="hover:text-zinc-600 transition-colors">
            Política de Privacidad
          </Link>
          <span>·</span>
          <Link href="/legal/terminos" className="hover:text-zinc-600 transition-colors">
            Términos y Condiciones
          </Link>
        </p>
      </div>
    </footer>
  )
}
