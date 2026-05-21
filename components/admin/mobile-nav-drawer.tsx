'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/admin/dashboard', label: 'Inicio' },
  { href: '/admin/members', label: 'Socios' },
  { href: '/admin/check-in', label: 'Fichaje' },
  { href: '/admin/plans', label: 'Planes' },
  { href: '/admin/payments', label: 'Pagos' },
  { href: '/admin/analytics', label: 'Analíticas' },
  { href: '/admin/settings', label: 'Configuración' },
]

export function MobileNavDrawer({ gymName }: { gymName: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="sm:hidden">
      <button
        onClick={() => setOpen(true)}
        className="p-2 text-white rounded-md hover:bg-[#274060]"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-72 bg-[#1B2845] flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#274060]">
          <div>
            <img src="/logo-dark.svg" alt="GymDex" className="h-6 w-auto" />
            <p className="text-xs text-[#65AFFF]">{gymName}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 text-[#C8D8E8] hover:text-white rounded-md hover:bg-[#274060]"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="menu menu-lg p-3 flex-1 gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'text-[#C8D8E8] hover:bg-[#274060] hover:text-white rounded-lg',
                  pathname.startsWith(href) && 'bg-[#274060] text-white font-medium'
                )}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
