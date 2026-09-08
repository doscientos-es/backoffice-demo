import { describe, expect, it } from 'vitest'

import { extractMetaCreativeDetails, extractMetaLeads, extractMetaTrafficMetrics } from './meta-marketing'
import { getMarketingSyncErrorMessage, mapMetaAdForStorage } from '../marketing-sync'

describe('Meta marketing funnel metrics', () => {
  it('keeps the message from structured Supabase errors', () => {
    expect(
      getMarketingSyncErrorMessage({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      }),
    ).toBe('duplicate key value violates unique constraint')
  })

  it('maps creative properties to the snake_case marketing ads columns', () => {
    expect(
      mapMetaAdForStorage(
        {
          id: 'ad',
          adset_id: 'adset',
          campaign_id: 'campaign',
          name: 'Anuncio',
          status: 'ACTIVE',
          creative: {
            id: 'creative',
            thumbnail_url: 'https://cdn.example/thumbnail.jpg',
            call_to_action_type: 'LEARN_MORE',
            url_tags: 'utm_source=facebook',
            object_url: 'https://doscientos.es/contacto',
            object_story_spec: {
              link_data: { call_to_action: { value: { lead_gen_form_id: 'form' } } },
            },
          },
        },
        '2026-08-31T00:00:00.000Z',
      ),
    ).toMatchObject({
      creative_id: 'creative',
      destination_url: 'https://doscientos.es/contacto',
      url_tags: 'utm_source=facebook',
      call_to_action_type: 'LEARN_MORE',
      lead_form_id: 'form',
    })
  })

  it('does not double-count legacy and grouped Meta lead actions', () => {
    expect(
      extractMetaLeads(
        [
          { action_type: 'lead', value: '3' },
          { action_type: 'onsite_conversion.lead_grouped', value: '3' },
        ],
        30,
      ),
    ).toEqual({ totalLeads: 3, costPerLead: 10 })
  })

  it('uses the legacy lead action only when Meta has no grouped action', () => {
    expect(extractMetaLeads([{ action_type: 'lead', value: '2' }], 10)).toEqual({
      totalLeads: 2,
      costPerLead: 5,
    })
  })

  it('drops an impossible per-ad lead count that exceeds clicks', () => {
    expect(extractMetaLeads([{ action_type: 'lead', value: '267' }], 20, 5)).toEqual({
      totalLeads: 0,
      costPerLead: 0,
    })
  })

  it("extracts link and landing metrics from Meta's mixed insight fields", () => {
    expect(
      extractMetaTrafficMetrics({
        date_start: '2026-08-09',
        date_stop: '2026-08-09',
        impressions: '1',
        reach: '1',
        clicks: '1',
        spend: '1',
        ctr: '1',
        inline_link_clicks: '8',
        outbound_clicks: [{ action_type: 'outbound_click', value: '6' }],
        unique_outbound_clicks: [{ action_type: 'outbound_click', value: '5' }],
        actions: [{ action_type: 'landing_page_view', value: '4' }],
      }),
    ).toEqual({
      inlineLinkClicks: 8,
      outboundClicks: 6,
      uniqueOutboundClicks: 5,
      landingPageViews: 4,
    })
  })

  it('extracts the destination and lead form from a creative', () => {
    expect(
      extractMetaCreativeDetails({
        id: 'ad',
        adset_id: 'set',
        campaign_id: 'campaign',
        name: 'Ad',
        status: 'ACTIVE',
        creative: {
          id: 'creative',
          object_url: 'https://doscientos.es/direct-destination',
          url_tags: 'utm_source=facebook',
          object_story_spec: {
            link_data: {
              link: 'https://doscientos.es/contact',
              call_to_action: { type: 'LEARN_MORE', value: { lead_gen_form_id: 'form' } },
            },
          },
        },
      }),
    ).toEqual({
      creativeId: 'creative',
      destinationUrl: 'https://doscientos.es/direct-destination',
      urlTags: 'utm_source=facebook',
      callToActionType: 'LEARN_MORE',
      leadFormId: 'form',
    })
  })
})
