export const PROVIDERS = {
  openrouter: {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'deepseek/deepseek-v4-flash:free',
    requiresKey: true,
    models: [
      'deepseek/deepseek-v4-flash:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'inclusionai/ring-2.6-1t:free',
      'openrouter/owl-alpha',
      'deepseek/deepseek-r1:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'openai/gpt-4o',
      'anthropic/claude-sonnet-4-6',
      'google/gemini-2.5-pro'
    ],
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://stowaway.app',
      'X-Title': 'Stowaway'
    }),
    body: (messages, model) => ({
      model: model || 'meta-llama/llama-3.3-70b-instruct:free',
      messages,
      stream: true
    }),
    parse: (line) => {
      if (line === '[DONE]') return null;
      try {
        const json = JSON.parse(line);
        return json.choices?.[0]?.delta?.content || '';
      } catch { return ''; }
    }
  },

  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    requiresKey: true,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    body: (messages, model) => ({
      model: model || 'gpt-4o',
      messages,
      stream: true,
      response_format: { type: 'json_object' }
    }),
    parse: (line) => {
      if (line === '[DONE]') return null;
      try {
        const json = JSON.parse(line);
        return json.choices?.[0]?.delta?.content || '';
      } catch { return ''; }
    }
  },

  anthropic: {
    name: 'Anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-6',
    requiresKey: true,
    models: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'],
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    }),
    body: (messages, model, system) => ({
      model: model || 'claude-sonnet-4-6',
      system: system || 'You are a helpful assistant. Always respond in JSON.',
      messages,
      stream: true,
      max_tokens: 4096
    }),
    parse: (line) => {
      try {
        const json = JSON.parse(line);
        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
          return json.delta.text || '';
        }
        if (json.type === 'message_stop') return null;
        return '';
      } catch { return ''; }
    }
  },

  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama3-70b-8192',
    requiresKey: true,
    models: ['llama3-70b-8192', 'mixtral-8x7b-32768', 'llama3-8b-8192'],
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    body: (messages, model) => ({
      model: model || 'llama3-70b-8192',
      messages,
      stream: true
    }),
    parse: (line) => {
      if (line === '[DONE]') return null;
      try {
        const json = JSON.parse(line);
        return json.choices?.[0]?.delta?.content || '';
      } catch { return ''; }
    }
  },

  ollama: {
    name: 'Ollama (Local)',
    url: 'http://localhost:11434/api/chat',
    defaultModel: 'llama3',
    requiresKey: false,
    models: ['llama3', 'mistral', 'phi3', 'gemma2'],
    headers: () => ({}),
    body: (messages, model) => ({
      model: model || 'llama3',
      messages,
      stream: true,
      format: 'json'
    }),
    parse: (line) => {
      try {
        const json = JSON.parse(line);
        if (json.done) return null;
        return json.message?.content || '';
      } catch { return ''; }
    }
  }
};
