type LogContext = Record<string, unknown> & {
  gymId?: string
  memberId?: string
  durationMs?: number
}

function emit(
  level: 'info' | 'warn' | 'error',
  event: string,
  ctx?: LogContext,
  err?: Error,
) {
  const entry = {
    level,
    event,
    ts: new Date().toISOString(),
    ...(err && { err: { message: err.message, stack: err.stack } }),
    ...ctx,
  }

  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(entry))
    return
  }

  const { level: _l, event: _e, ts: _t, err: _err, ...rest } = entry
  const tag = `[${level.toUpperCase()}] ${event}`
  const extras: unknown[] = Object.keys(rest).length > 0 ? [rest] : []
  if (err?.stack) extras.push(err.stack)

  if (level === 'error') console.error(tag, ...extras)
  else if (level === 'warn') console.warn(tag, ...extras)
  else console.log(tag, ...extras)
}

export const logger = {
  info(event: string, ctx?: LogContext) {
    emit('info', event, ctx)
  },
  warn(event: string, ctx?: LogContext) {
    emit('warn', event, ctx)
  },
  error(err: Error | string, ctx?: LogContext) {
    if (err instanceof Error) {
      emit('error', err.message, ctx, err)
    } else {
      emit('error', err, ctx)
    }
  },
}
