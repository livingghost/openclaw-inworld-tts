import {
  asObject,
  readResponseTextLimited,
  requireInRange,
  trimToUndefined,
  truncateErrorDetail,
} from "openclaw/plugin-sdk/speech";

const DEFAULT_INWORLD_BASE_URL = "https://api.inworld.ai";
const INWORLD_AUDIO_ENCODINGS = new Set([
  "LINEAR16",
  "MP3",
  "OGG_OPUS",
  "ALAW",
  "MULAW",
  "FLAC",
  "PCM",
  "WAV",
] as const);
const INWORLD_SAMPLE_RATES = new Set([8000, 16000, 22050, 24000, 32000, 44100, 48000]);

export type InworldAudioEncoding =
  | "LINEAR16"
  | "MP3"
  | "OGG_OPUS"
  | "ALAW"
  | "MULAW"
  | "FLAC"
  | "PCM"
  | "WAV";

export type InworldTimestampType = "TIMESTAMP_TYPE_UNSPECIFIED" | "WORD" | "CHARACTER";
export type InworldApplyTextNormalization = "APPLY_TEXT_NORMALIZATION_UNSPECIFIED" | "ON" | "OFF";

export type InworldAudioConfig = {
  audioEncoding: InworldAudioEncoding;
  sampleRateHertz?: number;
  bitRate?: number;
  speakingRate?: number;
};

export type InworldVoiceOption = {
  id: string;
  name?: string;
  category?: string;
  description?: string;
  locale?: string;
  personalities?: string[];
};

function normalizeTemperature(value: number | undefined): number | undefined {
  if (value == null || value === 0) {
    return undefined;
  }
  requireInRange(value, Number.EPSILON, 2, "temperature");
  return value;
}

function buildInworldAuthHeader(apiKey: string): string {
  const normalized = apiKey.trim();
  if (!normalized) {
    throw new Error("Inworld API key missing");
  }
  return /^basic\s+/i.test(normalized) ? normalized : `Basic ${normalized}`;
}

export function normalizeInworldBaseUrl(baseUrl?: string): string {
  const trimmed = baseUrl?.trim();
  return trimmed?.replace(/\/+$/, "") || DEFAULT_INWORLD_BASE_URL;
}

function normalizeInworldLocale(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed.replace(/-/g, "_").toUpperCase() : undefined;
}

function formatInworldErrorPayload(payload: unknown): string | undefined {
  const root = asObject(payload);
  if (!root) {
    return undefined;
  }
  const rpcStatus = asObject(root.rpcStatus);
  const error = asObject(root.error);
  const message =
    trimToUndefined(rpcStatus?.message) ??
    trimToUndefined(error?.message) ??
    trimToUndefined(root.message) ??
    trimToUndefined(root.details);
  const code =
    trimToUndefined(rpcStatus?.code) ??
    trimToUndefined(error?.code) ??
    trimToUndefined(root.code) ??
    trimToUndefined(root.status);
  if (message && code) {
    return `${truncateErrorDetail(message)} [code=${code}]`;
  }
  if (message) {
    return truncateErrorDetail(message);
  }
  if (code) {
    return `[code=${code}]`;
  }
  return undefined;
}

async function extractInworldErrorDetail(response: Response): Promise<string | undefined> {
  const rawBody = trimToUndefined(await readResponseTextLimited(response));
  if (!rawBody) {
    return undefined;
  }
  try {
    return formatInworldErrorPayload(JSON.parse(rawBody)) ?? truncateErrorDetail(rawBody);
  } catch {
    return truncateErrorDetail(rawBody);
  }
}

function assertInworldAudioConfig(config: InworldAudioConfig): void {
  if (!INWORLD_AUDIO_ENCODINGS.has(config.audioEncoding)) {
    throw new Error(`unsupported Inworld audioEncoding "${config.audioEncoding}"`);
  }
  if (config.sampleRateHertz != null && !INWORLD_SAMPLE_RATES.has(config.sampleRateHertz)) {
    throw new Error(
      `unsupported Inworld sampleRateHertz "${config.sampleRateHertz}" (allowed: ${[
        ...INWORLD_SAMPLE_RATES,
      ].join(", ")})`,
    );
  }
  if (config.bitRate != null) {
    requireInRange(config.bitRate, 1, Number.MAX_SAFE_INTEGER, "bitRate");
  }
  if (config.speakingRate != null) {
    requireInRange(config.speakingRate, 0.5, 1.5, "speakingRate");
  }
}

export async function listInworldVoices(params: {
  apiKey: string;
  baseUrl?: string;
  languages?: string[];
}): Promise<InworldVoiceOption[]> {
  const url = new URL(`${normalizeInworldBaseUrl(params.baseUrl)}/voices/v1/voices`);
  for (const language of params.languages ?? []) {
    const normalized = normalizeInworldLocale(language);
    if (normalized) {
      url.searchParams.append("languages", normalized);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: buildInworldAuthHeader(params.apiKey),
    },
  });

  if (!response.ok) {
    const detail = await extractInworldErrorDetail(response);
    throw new Error(`Inworld voices API error (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const payload = (await response.json()) as {
    voices?: Array<{
      name?: string;
      voiceId?: string;
      displayName?: string;
      description?: string;
      langCode?: string;
      source?: string;
      tags?: string[];
    }>;
  };

  return Array.isArray(payload.voices)
    ? payload.voices
        .map((voice) => ({
          id: voice.voiceId?.trim() ?? "",
          name:
            voice.displayName?.trim() || voice.name?.trim() || voice.voiceId?.trim() || undefined,
          description: voice.description?.trim() || undefined,
          locale: normalizeInworldLocale(voice.langCode),
          category: voice.source?.trim() || undefined,
          personalities: Array.isArray(voice.tags)
            ? voice.tags.map((tag) => tag.trim()).filter(Boolean)
            : undefined,
        }))
        .filter((voice) => voice.id.length > 0)
    : [];
}

export async function inworldTTS(params: {
  text: string;
  apiKey: string;
  baseUrl?: string;
  voiceId: string;
  modelId: string;
  audioConfig: InworldAudioConfig;
  temperature?: number;
  timestampType?: InworldTimestampType;
  applyTextNormalization?: InworldApplyTextNormalization;
  timeoutMs: number;
}): Promise<Buffer> {
  const text = params.text.trim();
  if (!text) {
    throw new Error("Inworld TTS text is empty");
  }
  if (text.length > 2000) {
    throw new Error("Inworld TTS text exceeds 2000 character limit");
  }
  const voiceId = params.voiceId.trim();
  if (!voiceId) {
    throw new Error("Inworld voiceId missing");
  }
  const modelId = params.modelId.trim();
  if (!modelId) {
    throw new Error("Inworld modelId missing");
  }
  assertInworldAudioConfig(params.audioConfig);
  const temperature = normalizeTemperature(params.temperature);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const response = await fetch(`${normalizeInworldBaseUrl(params.baseUrl)}/tts/v1/voice`, {
      method: "POST",
      headers: {
        Authorization: buildInworldAuthHeader(params.apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voiceId,
        modelId,
        audioConfig: {
          audioEncoding: params.audioConfig.audioEncoding,
          ...(params.audioConfig.sampleRateHertz == null
            ? {}
            : { sampleRateHertz: params.audioConfig.sampleRateHertz }),
          ...(params.audioConfig.bitRate == null ? {} : { bitRate: params.audioConfig.bitRate }),
          ...(params.audioConfig.speakingRate == null
            ? {}
            : { speakingRate: params.audioConfig.speakingRate }),
        },
        ...(temperature == null ? {} : { temperature }),
        ...(params.timestampType == null ? {} : { timestampType: params.timestampType }),
        ...(params.applyTextNormalization == null
          ? {}
          : { applyTextNormalization: params.applyTextNormalization }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await extractInworldErrorDetail(response);
      throw new Error(`Inworld TTS API error (${response.status})${detail ? `: ${detail}` : ""}`);
    }

    const payload = (await response.json()) as { audioContent?: string };
    const audioContent = trimToUndefined(payload.audioContent);
    if (!audioContent) {
      throw new Error("Inworld TTS response missing audioContent");
    }
    return Buffer.from(audioContent, "base64");
  } finally {
    clearTimeout(timeout);
  }
}
