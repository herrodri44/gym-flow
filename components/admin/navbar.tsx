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
import { Badge } from '@/components/ui/badge'

interface AdminNavbarProps {
  userName: string
  userEmail: string
  gymName: string
  hasMultipleGyms: boolean
}

export function AdminNavbar({
  userName,
  userEmail,
  gymName,
  hasMultipleGyms,
}: AdminNavbarProps) {
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="sticky top-0 z-40 border-b border-[#274060] bg-[#1B2845]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard" className="font-bold tracking-tight text-white">
            Gym Flow
          </Link>
          <Badge className="hidden sm:inline-flex bg-[#274060] text-[#E4E4E4] border-[#335C81] hover:bg-[#274060]">
            {gymName}
          </Badge>
          <nav className="hidden gap-0.5 sm:flex">
            <Link
              href="/admin/dashboard"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-[#C8D8E8] hover:text-white hover:bg-[#274060]')}
            >
              Inicio
            </Link>
            <Link
              href="/admin/members"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-[#C8D8E8] hover:text-white hover:bg-[#274060]')}
            >
              Socios
            </Link>
            <Link
              href="/admin/check-in"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-[#C8D8E8] hover:text-white hover:bg-[#274060]')}
            >
              Fichaje
            </Link>
            <Link
              href="/admin/plans"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-[#C8D8E8] hover:text-white hover:bg-[#274060]')}
            >
              Planes
            </Link>
            <Link
              href="/admin/payments"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-[#C8D8E8] hover:text-white hover:bg-[#274060]')}
            >
              Pagos
            </Link>
            <Link
              href="/admin/analytics"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-[#C8D8E8] hover:text-white hover:bg-[#274060]')}
            >
              Analíticas
            </Link>
          </nav>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon' }),
              'rounded-full hover:bg-[#274060]'
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-[#335C81] text-white">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-zinc-500">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/admin/settings" />}>
              Configuración del gym
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {hasMultipleGyms && (
              <>
                <DropdownMenuItem render={<Link href="/admin/select-gym" />}>
                  Cambiar gimnasio
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
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
    </header>
  )
}
