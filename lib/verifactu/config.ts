export type LocalFiscalConfig = {
  environment: 'demo'
  certificate: { p12Base64: string; password: string }
  software: { producerName: string; producerNif: string; name: string; id: string; version: string; installationNumber: string; onlyVerifactu: boolean; multipleTaxpayers: boolean }
  appUrl: string
}

const config: LocalFiscalConfig = {
  environment: 'demo',
  certificate: { p12Base64: '', password: '' },
  software: { producerName: 'Doscientos Demo', producerNif: '', name: 'Backoffice Demo', id: 'DM', version: '0.1.0', installationNumber: '00000000', onlyVerifactu: false, multipleTaxpayers: false },
  appUrl: '',
}

export function verifactuSoftwareSnapshotFromEnv() { return config.software }
export function verifactuInvoiceConfigFromEnv(): LocalFiscalConfig { return config }
export function verifactuDiagnosticConfigFromEnv(): LocalFiscalConfig { return config }