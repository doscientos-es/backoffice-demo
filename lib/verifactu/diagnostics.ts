export type VerifactuDiagnosticGate = { status: 'missing' | 'failed' | 'passed'; ranAt: string | null }

export async function getVerifactuDiagnosticGate(): Promise<VerifactuDiagnosticGate> {
  return { status: 'passed', ranAt: '2026-09-01T10:00:00.000Z' }
}

export async function runVerifactuAeatTestDiagnostic(_memberId: string): Promise<{ ok: boolean; detail: string }> {
  return { ok: true, detail: 'Diagnóstico simulado completado. La demo no contacta con AEAT.' }
}