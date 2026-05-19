import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formats an integer amount in ARS centavos as "$ 30.000"
export function formatARS(centavos: number): string {
  const pesos = Math.round(centavos / 100)
  return '$ ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(pesos)
}

// Converts a peso string entered by the user (e.g. "30000") to centavos integer
export function pesosTocentavos(pesos: number): number {
  return Math.round(pesos * 100)
}
