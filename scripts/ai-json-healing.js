/**
 * TwojaStronaWWW Enterprise — OpenRouter / LLM Structured Outputs & JSON Response Healing
 *
 * Moduł warstwy Platform Core zapewniający:
 * 1. Budowanie kontraktów `response_format: { type: 'json_schema', strict: true }`
 *    wymuszających na modelach (OpenRouter, OpenAI, Gemini, Anthropic) zwracanie
 *    odpowiedzi ściśle zgodnych ze schematem JSON (`additionalProperties: false`).
 * 2. Deterministyczny mechanizm `parseJsonWithHealing(rawInput)` naprawiający
 *    uszkodzony JSON z odpowiedzi modeli lub zewnętrznych źródeł JSON-LD
 *    (usuwanie bloków Markdown ```json, wycinanie tekstu konwersacyjnego,
 *    usuwanie wiszących przecinków przed `}` i `]`, domykanie uciętych nawiasów).
 */

/**
 * Tworzy obiekt `response_format` zgodny ze standardem OpenRouter / OpenAI Structured Outputs (`strict: true`).
 *
 * @param {string} schemaName Nazwa schematu (np. 'lead_extraction' lub 'events_extraction')
 * @param {object} jsonSchema Definicja obiektu JSON Schema
 * @returns {{ type: 'json_schema', json_schema: { name: string, strict: true, schema: object } }}
 */
export function createStrictJsonSchemaFormat(schemaName, jsonSchema) {
  if (!schemaName || typeof schemaName !== 'string') {
    throw new Error('Parametr schemaName musi być niepustym ciągiem znaków.');
  }
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    throw new Error('Parametr jsonSchema musi być obiektem JSON Schema.');
  }
  return {
    type: 'json_schema',
    json_schema: {
      name: schemaName.trim(),
      strict: true,
      schema: {
        additionalProperties: false,
        ...jsonSchema
      }
    }
  };
}

/**
 * Domyślny schemat ekstrakcji ustrukturyzowanych leadów B2B / B2C z konwersacji AI.
 */
export const LEAD_EXTRACTION_RESPONSE_FORMAT = createStrictJsonSchemaFormat('tsw_lead_extraction', {
  type: 'object',
  properties: {
    hasLead: { type: 'boolean' },
    name: { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string' },
    intentSummary: { type: 'string' }
  },
  required: ['hasLead', 'name', 'phone', 'email', 'intentSummary'],
  additionalProperties: false
});

/**
 * Naprawia i parsuje potencjalnie uszkodzony JSON (OpenRouter Response Healing pattern):
 * 1. Usuwa znaczniki Markdown (```json ... ```),
 * 2. Wycina zewnętrzny obiekt `{...}` lub tablicę `[...]`,
 * 3. Usuwa wiszące przecinki (trailing commas) przed `}` i `]`,
 * 4. Domyka niezamknięte nawiasy w przypadku ucięcia odpowiedzi (max_tokens truncation).
 *
 * @param {string} rawInput Surowy ciąg znaków JSON lub odpowiedź modelu LLM
 * @returns {any|null} Sparsowany obiekt/tablica lub null w przypadku nienaprawialnego wejścia
 */
export function parseJsonWithHealing(rawInput) {
  const raw = String(rawInput || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
    // Przejście do procedury Response Healing
  }

  let healed = raw
    .replace(/^```(?:json|ld\+json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = healed.indexOf('{');
  const firstBracket = healed.indexOf('[');
  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else {
    startIdx = Math.max(firstBrace, firstBracket);
  }
  if (startIdx > 0) {
    healed = healed.slice(startIdx);
  }

  const lastBrace = healed.lastIndexOf('}');
  const lastBracket = healed.lastIndexOf(']');
  const endIdx = Math.max(lastBrace, lastBracket);
  if (endIdx > 0 && endIdx < healed.length - 1) {
    healed = healed.slice(0, endIdx + 1);
  }

  // Usunięcie wiszących przecinków przed zamknięciem obiektu lub tablicy
  healed = healed.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(healed);
  } catch (_) {
    // Próba domknięcia niezamkniętych nawiasów (np. ucięty strumień modelu)
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < healed.length; i++) {
      const ch = healed[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === '{') openBraces++;
        else if (ch === '}') openBraces = Math.max(0, openBraces - 1);
        else if (ch === '[') openBrackets++;
        else if (ch === ']') openBrackets = Math.max(0, openBrackets - 1);
      }
    }

    let balanced = healed.replace(/,\s*$/, '');
    if (inString) balanced += '"';
    while (openBrackets > 0) {
      balanced += ']';
      openBrackets--;
    }
    while (openBraces > 0) {
      balanced += '}';
      openBraces--;
    }

    try {
      return JSON.parse(balanced);
    } catch (__) {
      return null;
    }
  }
}
