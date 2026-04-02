export type SpeechDirectiveTokenParseContext = {
  key: string;
  value: string;
  policy: {
    allowVoice?: boolean;
    allowModelId?: boolean;
    allowNormalization?: boolean;
  };
  currentOverrides?: Record<string, unknown>;
};

export type SpeechProviderConfig = Record<string, unknown>;
export type SpeechProviderOverrides = Record<string, unknown>;
export type SpeechVoiceOption = Record<string, unknown>;
export type SpeechProviderPlugin = Record<string, unknown>;

export function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export async function readResponseTextLimited(response: Response): Promise<string> {
  return response.text();
}

export function requireInRange(
  value: number,
  min: number,
  max: number,
  label: string,
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
}

export function trimToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function truncateErrorDetail(value: string, maxLength = 500): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

export function normalizeApplyTextNormalization(
  value: unknown,
): "auto" | "on" | "off" | undefined {
  const trimmed = trimToUndefined(value)?.toLowerCase();
  switch (trimmed) {
    case undefined:
      return undefined;
    case "auto":
    case "on":
    case "off":
      return trimmed;
    default:
      throw new Error(`invalid applyTextNormalization "${String(value)}"`);
  }
}
