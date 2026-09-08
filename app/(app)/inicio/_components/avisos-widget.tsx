import { getAvisos } from '@/lib/dashboard/queries'

import { AvisosPanel } from '../avisos-panel'

export async function AvisosWidget({ showFinance }: { showFinance: boolean }) {
  const data = await getAvisos()
  return <AvisosPanel {...data} showFinance={showFinance} />
}
