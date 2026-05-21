import Link from 'next/link'
import { logoutAction } from '@/app/(auth)/login/actions'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface SuperadminNavbarProps {
  userName: string
  userEmail: string
}

export function SuperadminNavbar({ userName, userEmail }: SuperadminNavbarProps) {
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="sticky top-0 z-40 border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Main row */}
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/superadmin/gyms" className="font-semibold">
              GymDex
            </Link>
            <nav className="hidden gap-1 sm:flex">
              <Link
                href="/superadmin/gyms"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
              >
                Gimnasios
              </Link>
              <Link
                href="/superadmin/admins"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
              >
                Administradores
              </Link>
            </nav>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon' }),
                'rounded-full'
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-zinc-500">{userEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <form action={logoutAction} className="w-full">
                  <button type="submit" className="w-full text-left text-red-600 text-sm">
                    Cerrar sesión
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile nav row — only 2 links, no drawer needed */}
        <nav className="flex gap-1 border-t pb-2 sm:hidden">
          <Link
            href="/superadmin/gyms"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            Gimnasios
          </Link>
          <Link
            href="/superadmin/admins"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            Administradores
          </Link>
        </nav>
      </div>
    </header>
  )
}
