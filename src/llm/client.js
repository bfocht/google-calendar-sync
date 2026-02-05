const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { getLLMConfig, getAnthropicConfig } = require('../config');

let primaryClient = null;
let secondaryClient = null;
let config = null;

const FALLBACK_ERRORS = [
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'EAI_AGAIN'
];

const loadConfig = () => {
  if (config) return config;

  try {
    config = getLLMConfig();
  } catch (e) {
    // Fall back to legacy anthropic config
    const anthropicConfig = getAnthropicConfig();
    config = {
      primary: null,
      secondary: {
        type: 'anthropic',
        apiKey: anthropicConfig.apiKey,
        model: anthropicConfig.model || 'claude-3-haiku-20240307'
      },
      fallbackEnabled: false
    };
  }

  return config;
};

const getPrimaryClient = () => {
  if (primaryClient) return primaryClient;

  const cfg = loadConfig();
  if (!cfg.primary) return null;

  if (cfg.primary.type === 'openai-compatible') {
    primaryClient = new OpenAI({
      baseURL: cfg.primary.baseUrl,
      apiKey: cfg.primary.apiKey
    });
  }

  return primaryClient;
};

const getSecondaryClient = () => {
  if (secondaryClient) return secondaryClient;

  const cfg = loadConfig();
  if (!cfg.secondary) return null;

  if (cfg.secondary.type === 'anthropic') {
    secondaryClient = new Anthropic({ apiKey: cfg.secondary.apiKey });
  }

  return secondaryClient;
};

const shouldFallback = (error) => {
  // Network errors
  if (error.code && FALLBACK_ERRORS.includes(error.code)) {
    return true;
  }

  // HTTP 5xx errors
  if (error.status && error.status >= 500 && error.status < 600) {
    return true;
  }

  // Rate limiting
  if (error.status === 429) {
    return true;
  }

  // Connection errors in error message
  if (error.message) {
    for (const errCode of FALLBACK_ERRORS) {
      if (error.message.includes(errCode)) {
        return true;
      }
    }
  }

  return false;
};

const normalizeOpenAIResponse = (response) => {
  return {
    content: [{
      text: response.choices[0].message.content
    }],
    model: response.model,
    usage: {
      input_tokens: response.usage?.prompt_tokens,
      output_tokens: response.usage?.completion_tokens
    }
  };
};

const normalizeAnthropicResponse = (response) => {
  return {
    content: response.content,
    model: response.model,
    usage: response.usage
  };
};

const callPrimary = async ({ model, maxTokens, messages }) => {
  const client = getPrimaryClient();
  const cfg = loadConfig();

  const response = await client.chat.completions.create({
    model: model || cfg.primary.model,
    max_tokens: maxTokens,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  });

  return normalizeOpenAIResponse(response);
};

const callSecondary = async ({ model, maxTokens, messages }) => {
  const client = getSecondaryClient();
  const cfg = loadConfig();

  const response = await client.messages.create({
    model: model || cfg.secondary.model,
    max_tokens: maxTokens,
    messages
  });

  return normalizeAnthropicResponse(response);
};

const createMessage = async ({ model, maxTokens, messages }) => {
  const cfg = loadConfig();

  // If no primary configured, go straight to secondary
  if (!cfg.primary) {
    return callSecondary({ model, maxTokens, messages });
  }

  // Try primary first
  try {
    return await callPrimary({ model, maxTokens, messages });
  } catch (error) {
    // Check if we should fallback
    if (cfg.fallbackEnabled && cfg.secondary && shouldFallback(error)) {
      console.log(`Primary LLM failed (${error.code || error.status || error.message}), falling back to secondary`);
      return callSecondary({ model, maxTokens, messages });
    }

    // Re-throw if fallback not enabled or not a fallback-worthy error
    throw error;
  }
};

const getModel = () => {
  const cfg = loadConfig();
  if (cfg.primary) {
    return cfg.primary.model;
  }
  return cfg.secondary?.model || 'claude-3-haiku-20240307';
};

module.exports = {
  createMessage,
  getModel
};
