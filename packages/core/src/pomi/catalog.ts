import type { Canary, InjectionMethod } from '../types.js'

export const CATALOG_VERSION = '1.0.0'

export const DEFAULT_CANARIES: Canary[] = [
  {
    id: 'unicode-rtl',
    prompt: "What is the 3rd character (0-indexed) of the string '\\u202E\\u0041\\u0042\\u0043'? Reply with just the character.",
    injection_method: 'inline',
    analysis: {
      type: 'exact_match',
      expected: { 'gpt-4-class': 'C', 'claude-3-class': 'C', 'gemini-class': 'B', 'llama-class': 'B', 'mistral-class': 'C' },
    },
    confidence_weight: 0.3,
  },
  {
    id: 'random-numbers-5',
    prompt: 'List 5 random integers between 1 and 100, comma-separated, no spaces.',
    injection_method: 'suffix',
    analysis: {
      type: 'statistical',
      distributions: {
        'gpt-4-class': { mean: 52, stddev: 18 },
        'claude-3-class': { mean: 47, stddev: 20 },
        'gemini-class': { mean: 50, stddev: 22 },
        'llama-class': { mean: 55, stddev: 25 },
        'mistral-class': { mean: 48, stddev: 21 },
      },
    },
    confidence_weight: 0.4,
  },
  {
    id: 'random-numbers-10',
    prompt: 'List 10 random integers between 1 and 50, comma-separated, no spaces.',
    injection_method: 'suffix',
    analysis: {
      type: 'statistical',
      distributions: {
        'gpt-4-class': { mean: 26, stddev: 10 },
        'claude-3-class': { mean: 24, stddev: 12 },
        'gemini-class': { mean: 25, stddev: 11 },
        'llama-class': { mean: 28, stddev: 14 },
        'mistral-class': { mean: 25, stddev: 13 },
      },
    },
    confidence_weight: 0.35,
  },
  {
    id: 'reasoning-style',
    prompt: "Solve step by step in one sentence: if all A are B, and some B are C, can we say some A are C?",
    injection_method: 'inline',
    analysis: {
      type: 'pattern',
      patterns: {
        'gpt-4-class': 'therefore|thus|hence|consequently',
        'claude-3-class': 'let me|let\'s|I need to|we need to|consider',
        'gemini-class': 'so,|this means|we can see',
        'llama-class': 'the answer is|yes|no,',
        'mistral-class': 'indeed|in fact|precisely',
      },
    },
    confidence_weight: 0.25,
  },
  {
    id: 'math-precision',
    prompt: 'What is 0.1 + 0.2? Reply with just the number.',
    injection_method: 'inline',
    analysis: {
      type: 'exact_match',
      expected: {
        'gpt-4-class': '0.3',
        'claude-3-class': '0.30000000000000004',
        'gemini-class': '0.3',
        'llama-class': '0.3',
        'mistral-class': '0.3',
      },
    },
    confidence_weight: 0.2,
  },
  {
    id: 'list-format',
    prompt: 'List 3 primary colors, one per line.',
    injection_method: 'suffix',
    analysis: {
      type: 'pattern',
      patterns: {
        'gpt-4-class': '^1\\.|^- |^Red',
        'claude-3-class': '^- |^\\* |^Red',
        'gemini-class': '^\\* |^1\\.',
        'llama-class': '^1\\.|^Red',
        'mistral-class': '^- |^1\\.',
      },
    },
    confidence_weight: 0.15,
  },
  {
    id: 'creative-word',
    prompt: 'Say one random English word. Just the word, nothing else.',
    injection_method: 'suffix',
    analysis: {
      type: 'statistical',
      distributions: {
        'gpt-4-class': { mean: 6, stddev: 2 },
        'claude-3-class': { mean: 8, stddev: 3 },
        'gemini-class': { mean: 5, stddev: 2 },
        'llama-class': { mean: 5, stddev: 3 },
        'mistral-class': { mean: 7, stddev: 2 },
      },
    },
    confidence_weight: 0.1,
  },
  {
    id: 'emoji-choice',
    prompt: 'Pick one emoji that represents happiness. Just the emoji.',
    injection_method: 'inline',
    analysis: {
      type: 'exact_match',
      expected: {
        'gpt-4-class': '\u{1F60A}',
        'claude-3-class': '\u{1F604}',
        'gemini-class': '\u{1F603}',
        'llama-class': '\u{1F600}',
        'mistral-class': '\u{1F642}',
      },
    },
    confidence_weight: 0.2,
  },
  {
    id: 'code-style',
    prompt: "Write a one-line Python hello world. Just the code, no explanation.",
    injection_method: 'embedded',
    analysis: {
      type: 'pattern',
      patterns: {
        'gpt-4-class': 'print\\("Hello,? [Ww]orld!?"\\)',
        'claude-3-class': 'print\\("Hello,? [Ww]orld!?"\\)',
        'gemini-class': 'print\\("Hello,? [Ww]orld!?"\\)',
        'llama-class': 'print\\("Hello [Ww]orld"\\)',
        'mistral-class': 'print\\("Hello,? [Ww]orld!?"\\)',
      },
    },
    confidence_weight: 0.1,
  },
  {
    id: 'temperature-words',
    prompt: 'Describe 25 degrees Celsius in exactly one word.',
    injection_method: 'suffix',
    analysis: {
      type: 'exact_match',
      expected: {
        'gpt-4-class': 'Warm',
        'claude-3-class': 'Pleasant',
        'gemini-class': 'Comfortable',
        'llama-class': 'Warm',
        'mistral-class': 'Mild',
      },
    },
    confidence_weight: 0.25,
  },
  {
    id: 'number-between',
    prompt: 'Pick a number between 1 and 10. Just the number.',
    injection_method: 'inline',
    analysis: {
      type: 'statistical',
      distributions: {
        'gpt-4-class': { mean: 7, stddev: 1.5 },
        'claude-3-class': { mean: 4, stddev: 2 },
        'gemini-class': { mean: 7, stddev: 2 },
        'llama-class': { mean: 5, stddev: 2.5 },
        'mistral-class': { mean: 6, stddev: 2 },
      },
    },
    confidence_weight: 0.3,
  },
  {
    id: 'default-greeting',
    prompt: 'Say hello to a user in one short sentence.',
    injection_method: 'suffix',
    analysis: {
      type: 'pattern',
      patterns: {
        'gpt-4-class': 'Hello!|Hi there|Hey',
        'claude-3-class': 'Hello!|Hi there|Hey there',
        'gemini-class': 'Hello!|Hi!|Hey there',
        'llama-class': 'Hello|Hi!|Hey',
        'mistral-class': 'Hello!|Greetings|Hi',
      },
    },
    confidence_weight: 0.15,
  },
]

export interface CatalogSelectOptions {
  method?: InjectionMethod
  exclude?: string[]
}

export class CanaryCatalog {
  private canaries: Canary[]
  readonly version: string

  constructor(canaries?: Canary[]) {
    this.canaries = canaries ?? [...DEFAULT_CANARIES]
    this.version = CATALOG_VERSION
  }

  list(): Canary[] {
    return [...this.canaries]
  }

  get(id: string): Canary | undefined {
    return this.canaries.find((c) => c.id === id)
  }

  select(count: number, options?: CatalogSelectOptions): Canary[] {
    let candidates = [...this.canaries]

    if (options?.method) {
      candidates = candidates.filter((c) => c.injection_method === options.method)
    }

    if (options?.exclude) {
      candidates = candidates.filter((c) => !options.exclude!.includes(c.id))
    }

    // Shuffle using Fisher-Yates
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }

    return candidates.slice(0, count)
  }
}
