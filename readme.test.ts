import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSON5 from "json5";
import { describe, expect, it } from "vitest";
import { buildInworldSpeechProvider } from "./speech-provider.js";

const extensionRoot = path.dirname(fileURLToPath(import.meta.url));
const readmePath = path.join(extensionRoot, "README.md");
const readme = fs.readFileSync(readmePath, "utf8");
const provider = buildInworldSpeechProvider();

function extractFenceAfterHeading(readmeText: string, heading: string): string {
  const headingIndex = readmeText.indexOf(heading);
  if (headingIndex < 0) {
    throw new Error(`missing heading: ${heading}`);
  }
  const fenceStart = readmeText.indexOf("```", headingIndex);
  if (fenceStart < 0) {
    throw new Error(`missing code fence after heading: ${heading}`);
  }
  const bodyStart = readmeText.indexOf("\n", fenceStart);
  if (bodyStart < 0) {
    throw new Error(`missing code fence body after heading: ${heading}`);
  }
  const fenceEnd = readmeText.indexOf("\n```", bodyStart);
  if (fenceEnd < 0) {
    throw new Error(`missing fence terminator after heading: ${heading}`);
  }
  return readmeText.slice(bodyStart + 1, fenceEnd).trim();
}

function parseJson5Fence<T>(heading: string): T {
  return JSON5.parse(extractFenceAfterHeading(readme, heading)) as T;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

describe("inworld README examples", () => {
  it("keeps the minimal messages.tts example parseable and provider-normalizable", () => {
    const example = parseJson5Fence<{ messages?: { tts?: Record<string, unknown> } }>(
      "## Minimal TTS config",
    );
    expect(example.messages?.tts?.provider).toBe("inworld");

    const resolved = provider.resolveConfig({
      rawConfig: example.messages?.tts ?? {},
    }) as {
      voiceId?: string;
      modelId?: string;
      baseUrl?: string;
    };
    expect(resolved.voiceId).toBe("your-inworld-voice-id");
    expect(resolved.modelId).toBe("inworld-tts-1.5-max");
    expect(resolved.baseUrl).toBe("https://api.inworld.ai");
  });

  it("keeps the full messages.tts example parseable and provider-normalizable", () => {
    const example = parseJson5Fence<{ messages?: { tts?: Record<string, unknown> } }>(
      "## Example with all supported settings",
    );
    expect(example.messages?.tts?.provider).toBe("inworld");

    const resolved = provider.resolveConfig({
      rawConfig: example.messages?.tts ?? {},
    }) as {
      voiceId?: string;
      modelId?: string;
      temperature?: number;
      timestampType?: string;
      applyTextNormalization?: string;
      languages?: string[];
      audioConfig?: {
        audioEncoding?: string;
        sampleRateHertz?: number;
        bitRate?: number;
        speakingRate?: number;
      };
    };
    expect(resolved.voiceId).toBe("your-inworld-voice-id");
    expect(resolved.modelId).toBe("inworld-tts-1.5-max");
    expect(resolved.temperature).toBe(0.7);
    expect(resolved.timestampType).toBe("WORD");
    expect(resolved.applyTextNormalization).toBe("auto");
    expect(resolved.languages).toEqual(["ja-JP", "en-US"]);
    expect(resolved.audioConfig).toMatchObject({
      audioEncoding: "MP3",
      sampleRateHertz: 44100,
      bitRate: 128000,
      speakingRate: 1,
    });
  });

  it("keeps the talk provider example parseable and normalizable", () => {
    const example = parseJson5Fence<{
      talk?: {
        provider?: string;
        providers?: Record<string, Record<string, unknown>>;
      };
    }>("## Talk mode example");
    expect(example.talk?.provider).toBe("inworld");
    const resolved = provider.resolveTalkConfig?.({
      baseTtsConfig: {},
      talkProviderConfig: example.talk?.providers?.inworld ?? {},
    }) as
      | {
          voiceId?: string;
          modelId?: string;
          baseUrl?: string;
          temperature?: number;
          applyTextNormalization?: string;
          audioConfig?: {
            audioEncoding?: string;
            sampleRateHertz?: number;
            bitRate?: number;
            speakingRate?: number;
          };
        }
      | undefined;

    expect(resolved?.voiceId).toBe("your-inworld-voice-id");
    expect(resolved?.modelId).toBe("inworld-tts-1.5-max");
    expect(resolved?.baseUrl).toBe("https://api.inworld.ai");
    expect(resolved?.temperature).toBe(0.7);
    expect(resolved?.applyTextNormalization).toBe("auto");
    expect(resolved?.audioConfig).toMatchObject({
      audioEncoding: "MP3",
      sampleRateHertz: 44100,
      bitRate: 128000,
      speakingRate: 1,
    });
  });

  it("keeps the talk.speak payload example parseable and provider-normalizable", () => {
    const example = parseJson5Fence<Record<string, unknown>>("### `talk.speak` override example");
    const params = asObject(example.params);

    expect(example.method).toBe("talk.speak");
    expect(params?.text).toBe("こんにちは、OpenClawです。");
    expect(params?.voiceId).toBe("alternate-voice-id");
    expect(params?.modelId).toBe("inworld-tts-1.5-max");
    expect(params?.speed).toBe(0.95);
    expect(params?.normalize).toBe("on");

    const overrides = provider.resolveTalkOverrides?.({
      params: params ?? {},
    }) as
      | {
          voiceId?: string;
          modelId?: string;
          applyTextNormalization?: string;
          audioConfig?: {
            speakingRate?: number;
          };
        }
      | undefined;
    expect(overrides).toMatchObject({
      voiceId: "alternate-voice-id",
      modelId: "inworld-tts-1.5-max",
      applyTextNormalization: "on",
      audioConfig: {
        speakingRate: 0.95,
      },
    });
  });

  it("keeps the Discord voice override example parseable and provider-normalizable", () => {
    const example = parseJson5Fence<{
      channels?: {
        discord?: {
          voice?: {
            tts?: Record<string, unknown>;
          };
        };
      };
    }>("## Discord voice example");
    expect(example.channels?.discord?.voice?.enabled).toBe(true);
    expect(example.channels?.discord?.voice?.tts?.provider).toBe("inworld");

    const resolved = provider.resolveConfig({
      rawConfig: example.channels?.discord?.voice?.tts ?? {},
    }) as {
      voiceId?: string;
      modelId?: string;
      audioConfig?: {
        audioEncoding?: string;
        sampleRateHertz?: number;
      };
    };
    expect(resolved.voiceId).toBe("your-inworld-voice-id");
    expect(resolved.modelId).toBe("inworld-tts-1.5-max");
    expect(resolved.audioConfig).toMatchObject({
      audioEncoding: "OGG_OPUS",
      sampleRateHertz: 48000,
    });
  });
});
