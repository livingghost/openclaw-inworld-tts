import { normalizeResolvedSecretInputString } from "openclaw/plugin-sdk/secret-input";
import type {
  SpeechDirectiveTokenParseContext,
  SpeechProviderConfig,
  SpeechProviderOverrides,
  SpeechProviderPlugin,
  SpeechVoiceOption,
} from "openclaw/plugin-sdk/speech";
import { normalizeApplyTextNormalization, requireInRange } from "openclaw/plugin-sdk/speech";
import {
  type InworldApplyTextNormalization,
  type InworldAudioConfig,
  type InworldAudioEncoding,
  type InworldTimestampType,
  inworldTTS,
  listInworldVoices,
  normalizeInworldBaseUrl,
} from "./tts.js";

const DEFAULT_INWORLD_MODEL_ID = "inworld-tts-1.5-max";
const INWORLD_TTS_MODELS = [
  "inworld-tts-1",
  "inworld-tts-1-max",
  "inworld-tts-1.5-mini",
  "inworld-tts-1.5-max",
] as const;

type InworldProviderConfig = {
  apiKey?: string;
  baseUrl: string;
  voiceId?: string;
  modelId: string;
  temperature?: number;
  timestampType?: InworldTimestampType;
  applyTextNormalization?: "auto" | "on" | "off";
  languages?: string[];
  audioConfig: {
    audioEncoding?: InworldAudioEncoding;
    sampleRateHertz?: number;
    bitRate?: number;
    speakingRate?: number;
  };
};

type InworldProviderOverrides = {
  voiceId?: string;
  modelId?: string;
  temperature?: number;
  timestampType?: InworldTimestampType;
  applyTextNormalization?: "auto" | "on" | "off";
  audioConfig?: {
    audioEncoding?: InworldAudioEncoding;
    sampleRateHertz?: number;
    bitRate?: number;
    speakingRate?: number;
  };
};

function normalizeTemperature(value: number | undefined): number | undefined {
  if (value == null || value === 0) {
    return undefined;
  }
  requireInRange(value, Number.EPSILON, 2, "temperature");
  return value;
}

function fileExtensionForAudioEncoding(encoding: InworldAudioEncoding): string {
  switch (encoding) {
    case "OGG_OPUS":
      return ".ogg";
    case "MP3":
      return ".mp3";
    case "WAV":
    case "PCM":
    case "LINEAR16":
      return ".wav";
    case "FLAC":
      return ".flac";
    case "ALAW":
    case "MULAW":
      return ".pcm";
  }
}

function isVoiceCompatibleEncoding(encoding: InworldAudioEncoding): boolean {
  return encoding === "OGG_OPUS";
}

function trimToUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseNumberValue(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeTimestampType(value: string | undefined): InworldTimestampType | undefined {
  const normalized = value?.trim().toUpperCase();
  switch (normalized) {
    case undefined:
    case "":
      return undefined;
    case "WORD":
    case "CHARACTER":
    case "TIMESTAMP_TYPE_UNSPECIFIED":
    case "UNSPECIFIED":
    case "AUTO":
      return normalized === "WORD" || normalized === "CHARACTER"
        ? normalized
        : "TIMESTAMP_TYPE_UNSPECIFIED";
    default:
      throw new Error(`invalid Inworld timestampType "${value}"`);
  }
}

function normalizeAudioEncoding(value: string | undefined): InworldAudioEncoding | undefined {
  const normalized = value?.trim().toUpperCase() as InworldAudioEncoding | undefined;
  switch (normalized) {
    case undefined:
    case "":
      return undefined;
    case "LINEAR16":
    case "MP3":
    case "OGG_OPUS":
    case "ALAW":
    case "MULAW":
    case "FLAC":
    case "PCM":
    case "WAV":
      return normalized;
    default:
      throw new Error(`invalid Inworld audioEncoding "${value}"`);
  }
}

function normalizeInworldProviderConfig(rawConfig: Record<string, unknown>): InworldProviderConfig {
  const providers = asObject(rawConfig.providers);
  const raw = asObject(providers?.inworld) ?? asObject(rawConfig.inworld);
  const rawAudioConfig = asObject(raw?.audioConfig);
  return {
    apiKey: normalizeResolvedSecretInputString({
      value: raw?.apiKey,
      path: "messages.tts.providers.inworld.apiKey",
    }),
    baseUrl: normalizeInworldBaseUrl(trimToUndefined(raw?.baseUrl)),
    voiceId: trimToUndefined(raw?.voiceId),
    modelId: trimToUndefined(raw?.modelId) ?? DEFAULT_INWORLD_MODEL_ID,
    temperature: normalizeTemperature(asNumber(raw?.temperature)),
    timestampType: normalizeTimestampType(trimToUndefined(raw?.timestampType)),
    applyTextNormalization: trimToUndefined(raw?.applyTextNormalization) as
      | "auto"
      | "on"
      | "off"
      | undefined,
    languages: asStringArray(raw?.languages),
    audioConfig: {
      audioEncoding: normalizeAudioEncoding(trimToUndefined(rawAudioConfig?.audioEncoding)),
      sampleRateHertz: asNumber(rawAudioConfig?.sampleRateHertz),
      bitRate: asNumber(rawAudioConfig?.bitRate),
      speakingRate: asNumber(rawAudioConfig?.speakingRate),
    },
  };
}

function readInworldProviderConfig(config: SpeechProviderConfig): InworldProviderConfig {
  const defaults = normalizeInworldProviderConfig({});
  const audioConfig = asObject(config.audioConfig);
  return {
    apiKey: trimToUndefined(config.apiKey) ?? defaults.apiKey,
    baseUrl: normalizeInworldBaseUrl(trimToUndefined(config.baseUrl) ?? defaults.baseUrl),
    voiceId: trimToUndefined(config.voiceId) ?? defaults.voiceId,
    modelId: trimToUndefined(config.modelId) ?? defaults.modelId,
    temperature: normalizeTemperature(asNumber(config.temperature)) ?? defaults.temperature,
    timestampType:
      normalizeTimestampType(trimToUndefined(config.timestampType)) ?? defaults.timestampType,
    applyTextNormalization:
      (trimToUndefined(config.applyTextNormalization) as "auto" | "on" | "off" | undefined) ??
      defaults.applyTextNormalization,
    languages: asStringArray(config.languages) ?? defaults.languages,
    audioConfig: {
      audioEncoding:
        normalizeAudioEncoding(trimToUndefined(audioConfig?.audioEncoding)) ??
        defaults.audioConfig.audioEncoding,
      sampleRateHertz:
        asNumber(audioConfig?.sampleRateHertz) ?? defaults.audioConfig.sampleRateHertz,
      bitRate: asNumber(audioConfig?.bitRate) ?? defaults.audioConfig.bitRate,
      speakingRate: asNumber(audioConfig?.speakingRate) ?? defaults.audioConfig.speakingRate,
    },
  };
}

function readInworldOverrides(
  overrides: SpeechProviderOverrides | undefined,
): InworldProviderOverrides {
  if (!overrides) {
    return {};
  }
  const audioConfig = asObject(overrides.audioConfig);
  return {
    voiceId: trimToUndefined(overrides.voiceId),
    modelId: trimToUndefined(overrides.modelId),
    temperature: normalizeTemperature(asNumber(overrides.temperature)),
    timestampType: normalizeTimestampType(trimToUndefined(overrides.timestampType)),
    applyTextNormalization: trimToUndefined(overrides.applyTextNormalization) as
      | "auto"
      | "on"
      | "off"
      | undefined,
    audioConfig: audioConfig
      ? {
          audioEncoding: normalizeAudioEncoding(trimToUndefined(audioConfig.audioEncoding)),
          sampleRateHertz: asNumber(audioConfig.sampleRateHertz),
          bitRate: asNumber(audioConfig.bitRate),
          speakingRate: asNumber(audioConfig.speakingRate),
        }
      : undefined,
  };
}

function toApiTextNormalization(
  value: "auto" | "on" | "off" | undefined,
): InworldApplyTextNormalization | undefined {
  switch (normalizeApplyTextNormalization(value)) {
    case undefined:
      return undefined;
    case "auto":
      return "APPLY_TEXT_NORMALIZATION_UNSPECIFIED";
    case "on":
      return "ON";
    case "off":
      return "OFF";
  }
}

function mergeAudioConfig(
  base: InworldProviderConfig["audioConfig"],
  overrides: InworldProviderOverrides["audioConfig"] | undefined,
  defaults: InworldAudioConfig,
): InworldAudioConfig {
  return {
    audioEncoding: overrides?.audioEncoding ?? base.audioEncoding ?? defaults.audioEncoding,
    sampleRateHertz: overrides?.sampleRateHertz ?? base.sampleRateHertz ?? defaults.sampleRateHertz,
    bitRate: overrides?.bitRate ?? base.bitRate ?? defaults.bitRate,
    speakingRate: overrides?.speakingRate ?? base.speakingRate ?? defaults.speakingRate,
  };
}

function parseDirectiveToken(ctx: SpeechDirectiveTokenParseContext) {
  try {
    switch (ctx.key) {
      case "voice":
      case "voiceid":
      case "voice_id":
      case "inworld_voice":
      case "inworldvoice":
        if (!ctx.policy.allowVoice) {
          return { handled: true };
        }
        return {
          handled: true,
          overrides: { ...ctx.currentOverrides, voiceId: ctx.value.trim() },
        };
      case "model":
      case "modelid":
      case "model_id":
      case "inworld_model":
      case "inworldmodel":
        if (!ctx.policy.allowModelId) {
          return { handled: true };
        }
        return {
          handled: true,
          overrides: { ...ctx.currentOverrides, modelId: ctx.value.trim() },
        };
      case "temperature": {
        const value = parseNumberValue(ctx.value);
        if (value == null) {
          return { handled: true, warnings: ["invalid temperature value"] };
        }
        return {
          handled: true,
          overrides: { ...ctx.currentOverrides, temperature: normalizeTemperature(value) },
        };
      }
      case "speed":
      case "speakingrate":
      case "speaking_rate": {
        const value = parseNumberValue(ctx.value);
        if (value == null) {
          return { handled: true, warnings: ["invalid speakingRate value"] };
        }
        requireInRange(value, 0.5, 1.5, "speakingRate");
        const current = asObject(ctx.currentOverrides?.audioConfig) ?? {};
        return {
          handled: true,
          overrides: {
            ...ctx.currentOverrides,
            audioConfig: {
              ...current,
              speakingRate: value,
            },
          },
        };
      }
      case "normalize":
      case "applytextnormalization":
      case "apply_text_normalization":
        if (!ctx.policy.allowNormalization) {
          return { handled: true };
        }
        return {
          handled: true,
          overrides: {
            ...ctx.currentOverrides,
            applyTextNormalization: normalizeApplyTextNormalization(ctx.value),
          },
        };
      case "timestamp":
      case "timestamptype":
      case "timestamp_type":
        return {
          handled: true,
          overrides: {
            ...ctx.currentOverrides,
            timestampType: normalizeTimestampType(ctx.value),
          },
        };
      default:
        return { handled: false };
    }
  } catch (error) {
    return {
      handled: true,
      warnings: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export function buildInworldSpeechProvider(): SpeechProviderPlugin {
  return {
    id: "inworld",
    label: "Inworld",
    autoSelectOrder: 25,
    models: [...INWORLD_TTS_MODELS],
    resolveConfig: ({ rawConfig }) => normalizeInworldProviderConfig(rawConfig),
    parseDirectiveToken,
    resolveTalkConfig: ({ baseTtsConfig, talkProviderConfig }) => {
      const base = normalizeInworldProviderConfig(baseTtsConfig);
      const talkAudioConfig = asObject(talkProviderConfig.audioConfig);
      return {
        ...base,
        ...(talkProviderConfig.apiKey === undefined
          ? {}
          : {
              apiKey: normalizeResolvedSecretInputString({
                value: talkProviderConfig.apiKey,
                path: "talk.providers.inworld.apiKey",
              }),
            }),
        ...(trimToUndefined(talkProviderConfig.baseUrl) == null
          ? {}
          : { baseUrl: normalizeInworldBaseUrl(trimToUndefined(talkProviderConfig.baseUrl)) }),
        ...(trimToUndefined(talkProviderConfig.voiceId) == null
          ? {}
          : { voiceId: trimToUndefined(talkProviderConfig.voiceId) }),
        ...(trimToUndefined(talkProviderConfig.modelId) == null
          ? {}
          : { modelId: trimToUndefined(talkProviderConfig.modelId) }),
        ...(asNumber(talkProviderConfig.temperature) == null
          ? {}
          : { temperature: normalizeTemperature(asNumber(talkProviderConfig.temperature)) }),
        ...(trimToUndefined(talkProviderConfig.timestampType) == null
          ? {}
          : {
              timestampType: normalizeTimestampType(
                trimToUndefined(talkProviderConfig.timestampType),
              ),
            }),
        ...(trimToUndefined(talkProviderConfig.applyTextNormalization) == null
          ? {}
          : {
              applyTextNormalization: normalizeApplyTextNormalization(
                trimToUndefined(talkProviderConfig.applyTextNormalization),
              ),
            }),
        audioConfig: {
          ...base.audioConfig,
          ...(trimToUndefined(talkAudioConfig?.audioEncoding) == null
            ? {}
            : {
                audioEncoding: normalizeAudioEncoding(
                  trimToUndefined(talkAudioConfig?.audioEncoding),
                ),
              }),
          ...(asNumber(talkAudioConfig?.sampleRateHertz) == null
            ? {}
            : { sampleRateHertz: asNumber(talkAudioConfig?.sampleRateHertz) }),
          ...(asNumber(talkAudioConfig?.bitRate) == null
            ? {}
            : { bitRate: asNumber(talkAudioConfig?.bitRate) }),
          ...(asNumber(talkAudioConfig?.speakingRate) == null
            ? {}
            : { speakingRate: asNumber(talkAudioConfig?.speakingRate) }),
        },
      };
    },
    resolveTalkOverrides: ({ params }) => {
      const audioConfig = {
        ...(trimToUndefined(params.audioEncoding) == null
          ? {}
          : { audioEncoding: normalizeAudioEncoding(trimToUndefined(params.audioEncoding)) }),
        ...(asNumber(params.sampleRateHertz) == null
          ? {}
          : { sampleRateHertz: asNumber(params.sampleRateHertz) }),
        ...(asNumber(params.bitRate) == null ? {} : { bitRate: asNumber(params.bitRate) }),
        ...(asNumber(params.speed) == null ? {} : { speakingRate: asNumber(params.speed) }),
      };
      return {
        ...(trimToUndefined(params.voiceId) == null
          ? {}
          : { voiceId: trimToUndefined(params.voiceId) }),
        ...(trimToUndefined(params.modelId) == null
          ? {}
          : { modelId: trimToUndefined(params.modelId) }),
        ...(asNumber(params.temperature) == null
          ? {}
          : { temperature: normalizeTemperature(asNumber(params.temperature)) }),
        ...(trimToUndefined(params.timestampType) == null
          ? {}
          : { timestampType: normalizeTimestampType(trimToUndefined(params.timestampType)) }),
        ...(trimToUndefined(params.normalize) == null
          ? {}
          : {
              applyTextNormalization: normalizeApplyTextNormalization(
                trimToUndefined(params.normalize),
              ),
            }),
        ...(Object.keys(audioConfig).length === 0 ? {} : { audioConfig }),
      };
    },
    listVoices: async (req): Promise<SpeechVoiceOption[]> => {
      const config = req.providerConfig ? readInworldProviderConfig(req.providerConfig) : undefined;
      const apiKey = req.apiKey || config?.apiKey || process.env.INWORLD_API_KEY;
      if (!apiKey) {
        throw new Error("Inworld API key missing");
      }
      return listInworldVoices({
        apiKey,
        baseUrl: req.baseUrl ?? config?.baseUrl,
        languages: config?.languages,
      });
    },
    isConfigured: ({ providerConfig }) => {
      const config = readInworldProviderConfig(providerConfig);
      const apiKey = config.apiKey || process.env.INWORLD_API_KEY;
      return Boolean(apiKey && config.voiceId);
    },
    synthesize: async (req) => {
      const config = readInworldProviderConfig(req.providerConfig);
      const overrides = readInworldOverrides(req.providerOverrides);
      const apiKey = config.apiKey || process.env.INWORLD_API_KEY;
      if (!apiKey) {
        throw new Error("Inworld API key missing");
      }
      const audioConfig = mergeAudioConfig(
        config.audioConfig,
        overrides.audioConfig,
        req.target === "voice-note"
          ? { audioEncoding: "OGG_OPUS", sampleRateHertz: 48000 }
          : { audioEncoding: "MP3", sampleRateHertz: 44100, bitRate: 128000 },
      );
      const audioBuffer = await inworldTTS({
        text: req.text,
        apiKey,
        baseUrl: config.baseUrl,
        voiceId: overrides.voiceId ?? config.voiceId ?? "",
        modelId: overrides.modelId ?? config.modelId,
        audioConfig,
        temperature: overrides.temperature ?? config.temperature,
        timestampType: overrides.timestampType ?? config.timestampType,
        applyTextNormalization: toApiTextNormalization(
          overrides.applyTextNormalization ?? config.applyTextNormalization,
        ),
        timeoutMs: req.timeoutMs,
      });
      return {
        audioBuffer,
        outputFormat: audioConfig.audioEncoding,
        fileExtension: fileExtensionForAudioEncoding(audioConfig.audioEncoding),
        voiceCompatible:
          req.target === "voice-note" && isVoiceCompatibleEncoding(audioConfig.audioEncoding),
      };
    },
    synthesizeTelephony: async (req) => {
      const config = readInworldProviderConfig(req.providerConfig);
      const apiKey = config.apiKey || process.env.INWORLD_API_KEY;
      if (!apiKey) {
        throw new Error("Inworld API key missing");
      }
      const sampleRate = 8000;
      const outputFormat = "LINEAR16";
      const audioBuffer = await inworldTTS({
        text: req.text,
        apiKey,
        baseUrl: config.baseUrl,
        voiceId: config.voiceId ?? "",
        modelId: config.modelId,
        audioConfig: {
          ...config.audioConfig,
          audioEncoding: outputFormat,
          sampleRateHertz: sampleRate,
        },
        temperature: config.temperature,
        timestampType: config.timestampType,
        applyTextNormalization: toApiTextNormalization(config.applyTextNormalization),
        timeoutMs: req.timeoutMs,
      });
      return {
        audioBuffer,
        outputFormat,
        sampleRate,
      };
    },
  };
}
