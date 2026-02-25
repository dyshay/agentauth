export interface ModelScore {
  rank: number
  family: string
  provider: string
  overall: number
  reasoning: number
  execution: number
  autonomy: number
  speed: number
  consistency: number
  challenges: number
  lastSeen: string
}

export const leaderboardData: ModelScore[] = [
  {
    rank: 1,
    family: 'claude-4-class',
    provider: 'Anthropic',
    overall: 0.96,
    reasoning: 0.98,
    execution: 0.97,
    autonomy: 0.95,
    speed: 0.92,
    consistency: 0.97,
    challenges: 14832,
    lastSeen: '2 min ago',
  },
  {
    rank: 2,
    family: 'gpt-4o-class',
    provider: 'OpenAI',
    overall: 0.94,
    reasoning: 0.96,
    execution: 0.95,
    autonomy: 0.93,
    speed: 0.90,
    consistency: 0.95,
    challenges: 21047,
    lastSeen: '1 min ago',
  },
  {
    rank: 3,
    family: 'gemini-2-class',
    provider: 'Google',
    overall: 0.93,
    reasoning: 0.95,
    execution: 0.94,
    autonomy: 0.91,
    speed: 0.91,
    consistency: 0.93,
    challenges: 9541,
    lastSeen: '5 min ago',
  },
  {
    rank: 4,
    family: 'llama-4-class',
    provider: 'Meta',
    overall: 0.89,
    reasoning: 0.91,
    execution: 0.90,
    autonomy: 0.87,
    speed: 0.88,
    consistency: 0.89,
    challenges: 6218,
    lastSeen: '12 min ago',
  },
  {
    rank: 5,
    family: 'mistral-large-class',
    provider: 'Mistral',
    overall: 0.88,
    reasoning: 0.90,
    execution: 0.89,
    autonomy: 0.85,
    speed: 0.89,
    consistency: 0.87,
    challenges: 4102,
    lastSeen: '8 min ago',
  },
  {
    rank: 6,
    family: 'command-r-class',
    provider: 'Cohere',
    overall: 0.85,
    reasoning: 0.87,
    execution: 0.86,
    autonomy: 0.82,
    speed: 0.86,
    consistency: 0.84,
    challenges: 2876,
    lastSeen: '23 min ago',
  },
  {
    rank: 7,
    family: 'grok-3-class',
    provider: 'xAI',
    overall: 0.84,
    reasoning: 0.88,
    execution: 0.85,
    autonomy: 0.80,
    speed: 0.83,
    consistency: 0.83,
    challenges: 1934,
    lastSeen: '15 min ago',
  },
  {
    rank: 8,
    family: 'deepseek-v3-class',
    provider: 'DeepSeek',
    overall: 0.82,
    reasoning: 0.86,
    execution: 0.84,
    autonomy: 0.78,
    speed: 0.81,
    consistency: 0.80,
    challenges: 1201,
    lastSeen: '31 min ago',
  },
]
