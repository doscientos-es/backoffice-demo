'use client'

/**
 * ZipInput – Spanish postal code block with auto-fill for city + province.
 *
 * Renders zip + city + province fields as a self-contained block.
 * On blur of the ZIP field (5 digits, country ES), resolves province (always)
 * and city (when known) via offline server action. Fields remain editable.
 */

import { LoaderCircle as Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { lookupSpanishPostalCode } from '@/lib/address/actions'
import { cn } from '@/lib/utils'

import { Input } from './input'

interface ZipInputProps {
  /**
   * Prefix used for both ids and name attributes.
   * e.g. "billing_address" → ids: billing_address_zip / _city / _province
   *                        → names: billing_address_zip / _city / _province
   */
  namePrefix: string
  defaultZip?: string | null
  defaultCity?: string | null
  defaultProvince?: string | null
  /** ISO 3166-1 alpha-2 country code; auto-fill only runs when "ES". */
  country?: string
  /** Extra className on the wrapper div. */
  className?: string
  labels?: { zip?: string; city?: string; province?: string }
}

const LABEL_CLASS = 'text-xs font-medium'
const FIELD_CLASS = 'flex flex-col gap-1.5'

export function ZipInput({
  namePrefix,
  defaultZip = '',
  defaultCity = '',
  defaultProvince = '',
  country = 'ES',
  className,
  labels = {},
}: ZipInputProps) {
  const [city, setCity] = useState(defaultCity ?? '')
  const [province, setProvince] = useState(defaultProvince ?? '')
  const [resolving, setResolving] = useState(false)
  const cityRef = useRef<HTMLInputElement>(null)

  const zipId = `${namePrefix}_zip`
  const cityId = `${namePrefix}_city`
  const provinceId = `${namePrefix}_province`

  const zipLabel = labels.zip ?? 'Código postal'
  const cityLabel = labels.city ?? 'Ciudad'
  const provinceLabel = labels.province ?? 'Provincia'

  async function handleZipBlur(e: React.FocusEvent<HTMLInputElement>) {
    const zip = e.target.value.trim()
    if (zip.length !== 5 || !/^\d{5}$/.test(zip) || country !== 'ES') return
    setResolving(true)
    try {
      const result = await lookupSpanishPostalCode(zip)
      if (result.found) {
        if (result.city && !cityRef.current?.value) setCity(result.city)
        if (result.province) setProvince(result.province)
      }
    } catch {
      // silent – user can fill manually
    } finally {
      setResolving(false)
    }
  }

  return (
    <>
      <div className={cn(FIELD_CLASS, className)}>
        <label htmlFor={zipId} className={LABEL_CLASS}>
          {zipLabel}
        </label>
        <Input
          id={zipId}
          name={`${namePrefix}_zip`}
          maxLength={20}
          defaultValue={defaultZip ?? ''}
          placeholder="08001"
          autoComplete="postal-code"
          inputMode="numeric"
          onBlur={handleZipBlur}
        />
      </div>
      <div className={cn(FIELD_CLASS, className)}>
        <label htmlFor={cityId} className={cn(LABEL_CLASS, resolving && 'text-muted-foreground')}>
          {cityLabel}
          {resolving && <Loader2 className="ml-1 inline-block h-3 w-3 animate-spin" />}
        </label>
        <Input
          ref={cityRef}
          id={cityId}
          name={`${namePrefix}_city`}
          maxLength={100}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Barcelona"
          autoComplete="address-level2"
          disabled={resolving}
          className={cn(resolving && 'animate-pulse')}
        />
      </div>
      <div className={cn(FIELD_CLASS, className)}>
        <label
          htmlFor={provinceId}
          className={cn(LABEL_CLASS, resolving && 'text-muted-foreground')}
        >
          {provinceLabel}
          {resolving && <Loader2 className="ml-1 inline-block h-3 w-3 animate-spin" />}
        </label>
        <Input
          id={provinceId}
          name={`${namePrefix}_province`}
          maxLength={100}
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          placeholder="Barcelona"
          autoComplete="address-level1"
          disabled={resolving}
          className={cn(resolving && 'animate-pulse')}
        />
      </div>
    </>
  )
}
