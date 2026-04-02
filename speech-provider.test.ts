import { afterEach, describe, expect, it, vi } from "vitest";
import { buildInworldSpeechProvider } from "./speech-provider.js";

describe("Inworld speech provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reads nested provider config from messages.tts.providers", () => {
    const provider = buildInworldSpeechProvider();
    const config = provider.resolveConfig?.({
      cfg: {} as never,
      rawConfig: {
        providers: {
          inworld: {
            apiKey: "secret-token",
            baseUrl: "https://api.inworld.ai/",
            voiceId: "Alex",
            modelId: "inworld-tts-1.5-max",
            audioConfig: {
              speakingRate: 1.1,
            },
          },
        },
      },
      timeoutMs: 1000,
    });

    expect(config).toEqual({
      apiKey: "secret-token",
      baseUrl: "https://api.inworld.ai",
      voiceId: "Alex",
      modelId: "inworld-tts-1.5-max",
      audioConfig: {
        audioEncoding: undefined,
        sampleRateHertz: undefined,
        bitRate: undefined,
        speakingRate: 1.1,
      },
      temperature: undefined,
      timestampType: undefined,
      applyTextNormalization: undefined,
      languages: undefined,
    });
  });

  it("requires both API key and voiceId for auto-selection", () => {
    const provider = buildInworldSpeechProvider();
    expect(
      provider.isConfigured?.({
        cfg: undefined,
        providerConfig: { apiKey: "token" },
        timeoutMs: 1000,
      }),
    ).toBe(false);

    vi.stubEnv("INWORLD_API_KEY", "env-token");
    expect(
      provider.isConfigured?.({
        cfg: undefined,
        providerConfig: { voiceId: "Alex" },
        timeoutMs: 1000,
      }),
    ).toBe(true);
  });

  it("uses voice-note defaults for synthesis and LINEAR16 for telephony", async () => {
    const provider = buildInworldSpeechProvider();
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            audioContent: Buffer.from("audio").toString("base64"),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const synthesis = await provider.synthesize?.({
      text: "hello",
      cfg: {} as never,
      providerConfig: {
        apiKey: "token",
        voiceId: "Alex",
        modelId: "inworld-tts-1.5-max",
      },
      target: "voice-note",
      timeoutMs: 1000,
    });
    const telephony = await provider.synthesizeTelephony?.({
      text: "hello",
      cfg: {} as never,
      providerConfig: {
        apiKey: "token",
        voiceId: "Alex",
        modelId: "inworld-tts-1.5-max",
      },
      timeoutMs: 1000,
    });

    expect(synthesis).toMatchObject({
      outputFormat: "OGG_OPUS",
      fileExtension: ".ogg",
      voiceCompatible: true,
    });
    expect(telephony).toMatchObject({
      outputFormat: "LINEAR16",
      sampleRate: 8000,
    });

    const voiceNoteBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const telephonyBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(voiceNoteBody.audioConfig).toMatchObject({
      audioEncoding: "OGG_OPUS",
      sampleRateHertz: 48000,
    });
    expect(telephonyBody.audioConfig).toMatchObject({
      audioEncoding: "LINEAR16",
      sampleRateHertz: 8000,
    });
  });

  it("uses the actual encoding to determine file extension and voice compatibility", async () => {
    const provider = buildInworldSpeechProvider();
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            audioContent: Buffer.from("audio").toString("base64"),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const synthesis = await provider.synthesize?.({
      text: "hello",
      cfg: {} as never,
      providerConfig: {
        apiKey: "token",
        voiceId: "Alex",
        audioConfig: {
          audioEncoding: "LINEAR16",
        },
      },
      target: "voice-note",
      timeoutMs: 1000,
    });

    expect(synthesis).toMatchObject({
      outputFormat: "LINEAR16",
      fileExtension: ".wav",
      voiceCompatible: false,
    });
  });
});
