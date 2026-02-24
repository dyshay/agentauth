import type { Canary, ChallengePayload } from '../types.js'
import { CanaryCatalog, type CatalogSelectOptions } from './catalog.js'

export interface InjectionResult {
  payload: ChallengePayload
  injected: Canary[]
}

export interface InjectOptions {
  exclude?: string[]
}

export class CanaryInjector {
  private catalog: CanaryCatalog

  constructor(catalog: CanaryCatalog) {
    this.catalog = catalog
  }

  inject(payload: ChallengePayload, count: number, options?: InjectOptions): InjectionResult {
    if (count <= 0) {
      return { payload: { ...payload }, injected: [] }
    }

    const selected = this.catalog.select(count, { exclude: options?.exclude })
    if (selected.length === 0) {
      return { payload: { ...payload }, injected: [] }
    }

    // Group canaries by injection method
    const prefixCanaries = selected.filter((c) => c.injection_method === 'prefix')
    const inlineCanaries = selected.filter((c) => c.injection_method === 'inline')
    const suffixCanaries = selected.filter((c) => c.injection_method === 'suffix')
    const embeddedCanaries = selected.filter((c) => c.injection_method === 'embedded')

    let instructions = payload.instructions

    // Prefix: add before main instructions
    if (prefixCanaries.length > 0) {
      const prefixText = prefixCanaries
        .map((c) => `- ${c.id}: ${c.prompt}`)
        .join('\n')
      instructions = `Before starting, answer these briefly (include in canary_responses):\n${prefixText}\n\n${instructions}`
    }

    // Inline & Suffix & Embedded: add as "Side tasks" after main instructions
    const sideTaskCanaries = [...inlineCanaries, ...suffixCanaries, ...embeddedCanaries]
    if (sideTaskCanaries.length > 0) {
      const sideText = sideTaskCanaries
        .map((c) => `- ${c.id}: ${c.prompt}`)
        .join('\n')
      instructions = `${instructions}\n\nAlso, complete these side tasks (include answers in canary_responses field):\n${sideText}`
    }

    const newPayload: ChallengePayload = {
      ...payload,
      instructions,
      context: {
        ...payload.context,
        canary_ids: selected.map((c) => c.id),
      },
    }

    return { payload: newPayload, injected: selected }
  }
}
