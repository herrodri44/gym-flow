'use client'

import { useRef, useState, useTransition } from 'react'
import { bulkCreateMembersAction } from '../actions'
import { Button } from '@/components/ui/button'
import type { BulkMemberInput, BulkCreateResult } from '@/lib/domain/members-bulk'

type ParsedRow = BulkMemberInput & { error: string | null }

type Stage = 'idle' | 'preview' | 'result'

// ─── CSV parsing ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { fields.push(field.trim()); field = '' }
      else { field += ch }
    }
  }
  fields.push(field.trim())
  return fields
}

function parseCSVRows(text: string): { rows: ParsedRow[]; headerError: string | null } {
  const allLines = text.trim().split(/\r?\n/).filter(l => l.trim() !== '')
  if (allLines.length < 1) return { rows: [], headerError: 'El archivo está vacío.' }

  const header = parseCSVLine(allLines[0]).map(h => h.toLowerCase().replace(/['"]/g, '').trim())

  const idxOf = (name: string) => header.indexOf(name)
  const iFirstName = idxOf('primer_nombre')
  const iLastName = idxOf('apellido')
  const iDni = idxOf('dni')
  const iPhone = idxOf('telefono')
  const iEmail = idxOf('email')
  const iBirthDate = idxOf('fecha_nacimiento')
  const iJoinedAt = idxOf('fecha_ingreso')

  if (iFirstName < 0 || iLastName < 0 || iDni < 0) {
    return {
      rows: [],
      headerError: 'El archivo no tiene las columnas requeridas: primer_nombre, apellido, dni.',
    }
  }

  const dataLines = allLines.slice(1)
  if (dataLines.length === 0) return { rows: [], headerError: 'El archivo no tiene filas de datos.' }
  if (dataLines.length > 500) {
    return { rows: [], headerError: 'El archivo tiene más de 500 filas. Dividí la importación en partes.' }
  }

  const rows: ParsedRow[] = dataLines.map((line, i) => {
    const cols = parseCSVLine(line)
    const get = (idx: number) => (idx >= 0 ? (cols[idx] ?? '').trim() : '')

    const firstName = get(iFirstName)
    const lastName = get(iLastName)
    const documentNumber = get(iDni)
    const phone = get(iPhone) || null
    const email = get(iEmail) || null
    const birthDateRaw = get(iBirthDate)
    const joinedAtRaw = get(iJoinedAt)
    const fullName = [firstName, lastName].filter(Boolean).join(' ')

    let error: string | null = null
    if (!firstName) error = 'Falta primer_nombre'
    else if (!lastName) error = 'Falta apellido'
    else if (!documentNumber) error = 'Falta DNI'
    else if (birthDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(birthDateRaw))
      error = 'fecha_nacimiento debe ser YYYY-MM-DD'
    else if (joinedAtRaw && !/^\d{4}-\d{2}-\d{2}$/.test(joinedAtRaw))
      error = 'fecha_ingreso debe ser YYYY-MM-DD'

    return {
      row: i + 1,
      fullName,
      documentNumber,
      phone,
      email,
      birthDate: birthDateRaw || null,
      joinedAt: joinedAtRaw || null,
      error,
    }
  })

  return { rows, headerError: null }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BulkMemberUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<(BulkCreateResult & { error?: string }) | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { rows, headerError } = parseCSVRows(text)
      if (headerError) {
        setParseError(headerError)
        setParsedRows([])
        setStage('preview')
      } else {
        setParseError(null)
        setParsedRows(rows)
        setStage('preview')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleReset() {
    setStage('idle')
    setParsedRows([])
    setParseError(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleImport() {
    const validRows = parsedRows.filter((r) => r.error === null)
    startTransition(async () => {
      const res = await bulkCreateMembersAction(validRows)
      setResult(res)
      setStage('result')
    })
  }

  const validRows = parsedRows.filter((r) => r.error === null)
  const invalidRows = parsedRows.filter((r) => r.error !== null)

  // ── Result stage ──────────────────────────────────────────────────────────

  if (stage === 'result' && result) {
    return (
      <div className="space-y-4">
        {result.error ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</div>
        ) : (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border bg-green-50 px-4 py-3">
              <div className="text-2xl font-bold text-green-700">{result.created}</div>
              <div className="text-xs text-green-600 mt-0.5">creados</div>
            </div>
            <div className="rounded-lg border bg-zinc-50 px-4 py-3">
              <div className="text-2xl font-bold text-zinc-600">{result.skipped}</div>
              <div className="text-xs text-zinc-500 mt-0.5">omitidos (DNI existente)</div>
            </div>
            <div className="rounded-lg border bg-red-50 px-4 py-3">
              <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
              <div className="text-xs text-red-500 mt-0.5">con error</div>
            </div>
          </div>
        )}

        {result.errors.length > 0 && (
          <div className="rounded-md border border-red-200 divide-y text-sm">
            {result.errors.map((e) => (
              <div key={e.row} className="flex gap-3 px-3 py-2 text-red-700">
                <span className="shrink-0 text-red-400">Fila {e.row}</span>
                <span>{e.reason}</span>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={handleReset}>
          Cargar otro archivo
        </Button>
      </div>
    )
  }

  // ── Preview stage ─────────────────────────────────────────────────────────

  if (stage === 'preview') {
    return (
      <div className="space-y-4">
        {parseError ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{parseError}</div>
        ) : (
          <>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-700 font-medium">{validRows.length} válidos</span>
              {invalidRows.length > 0 && (
                <span className="text-red-600 font-medium">{invalidRows.length} con error</span>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border text-sm">
              <table className="w-full">
                <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Nombre</th>
                    <th className="px-3 py-2 text-left font-medium">DNI</th>
                    <th className="px-3 py-2 text-left font-medium">Teléfono</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {parsedRows.map((r) => (
                    <tr key={r.row} className={r.error ? 'bg-red-50' : ''}>
                      <td className="px-3 py-2 text-zinc-400">{r.row}</td>
                      <td className="px-3 py-2 font-medium">{r.fullName || '—'}</td>
                      <td className="px-3 py-2 text-zinc-600">{r.documentNumber || '—'}</td>
                      <td className="px-3 py-2 text-zinc-500">{r.phone ?? '—'}</td>
                      <td className="px-3 py-2 text-zinc-500">{r.email ?? '—'}</td>
                      <td className="px-3 py-2">
                        {r.error ? (
                          <span className="text-red-600">{r.error}</span>
                        ) : (
                          <span className="text-green-600">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            Cancelar
          </Button>
          {!parseError && validRows.length > 0 && (
            <Button size="sm" onClick={handleImport} disabled={isPending}>
              {isPending ? 'Importando…' : `Importar ${validRows.length} ${validRows.length === 1 ? 'socio' : 'socios'}`}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ── Idle stage ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Campos <span className="font-medium text-zinc-700">obligatorios</span>: primer_nombre,
        apellido, dni. Opcionales: telefono, email, fecha_nacimiento, fecha_ingreso
        (formato <span className="font-mono text-xs">YYYY-MM-DD</span>). Máximo 500 socios por
        archivo.
      </p>

      <ol className="text-sm text-zinc-500 space-y-1 list-decimal list-inside">
        <li>
          Abrí el{' '}
          <a
            href="https://docs.google.com/spreadsheets/d/1S8VmwNzpLvnesFn1HXKwjvyIiw6lVlchAVJBevvfkgo/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-800 underline underline-offset-2 hover:text-zinc-600"
          >
            template de Google Sheets
          </a>
          , completá los datos y exportalo como CSV: <span className="font-medium text-zinc-700">Archivo → Descargar → Valores separados por comas (.csv)</span>
        </li>
        <li>Seleccioná el archivo exportado acá abajo.</li>
      </ol>

      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 w-fit">
        Seleccionar archivo CSV
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={handleFileChange}
        />
      </label>
    </div>
  )
}
