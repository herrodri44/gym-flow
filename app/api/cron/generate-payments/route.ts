import { generateMonthlyPayments } from '@/lib/domain/payments'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { created } = await generateMonthlyPayments()

  return Response.json({ ok: true, created })
}
