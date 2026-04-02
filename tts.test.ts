import { afterEach, describe, expect, it, vi } from "vitest";
import { inworldTTS, listInworldVoices } from "./tts.js";

describe("Inworld TTS client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists voices from the workspace voices endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          voices: [
            {
              voiceId: "Alex",
              displayName: "Alex",
              description: "Energetic and expressive",
              langCode: "EN_US",
              source: "SYSTEM",
              tags: ["friendly", "expressive"],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const voices = await listInworldVoices({
      apiKey: "test-token",
      languages: ["en-US"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toContain("/voices/v1/voices");
    expect(String(requestUrl)).toContain("languages=EN_US");
    expect((requestInit as RequestInit).headers).toMatchObject({
      Authorization: "Basic test-token",
    });
    expect(voices).toEqual([
      {
        id: "Alex",
        name: "Alex",
        description: "Energetic and expressive",
        locale: "EN_US",
        category: "SYSTEM",
        personalities: ["friendly", "expressive"],
      },
    ]);
  });

  it("synthesizes audio with camelCase request fields", async () => {
    const audioContent = Buffer.from("hello world").toString("base64");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ audioContent }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const audioBuffer = await inworldTTS({
      text: "Hello from OpenClaw",
      apiKey: "Basic prebuilt-token",
      voiceId: "Alex",
      modelId: "inworld-tts-1.5-max",
      audioConfig: {
        audioEncoding: "OGG_OPUS",
        sampleRateHertz: 48000,
        speakingRate: 1,
      },
      applyTextNormalization: "ON",
      timestampType: "WORD",
      timeoutMs: 1000,
    });

    expect(audioBuffer.equals(Buffer.from("hello world"))).toBe(true);
    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect((requestInit as RequestInit).headers).toMatchObject({
      Authorization: "Basic prebuilt-token",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String((requestInit as RequestInit).body))).toEqual({
      text: "Hello from OpenClaw",
      voiceId: "Alex",
      modelId: "inworld-tts-1.5-max",
      audioConfig: {
        audioEncoding: "OGG_OPUS",
        sampleRateHertz: 48000,
        speakingRate: 1,
      },
      timestampType: "WORD",
      applyTextNormalization: "ON",
    });
  });

  it("rejects text over the documented 2000 character limit", async () => {
    await expect(
      inworldTTS({
        text: "a".repeat(2001),
        apiKey: "test-token",
        voiceId: "Alex",
        modelId: "inworld-tts-1.5-max",
        audioConfig: {
          audioEncoding: "MP3",
        },
        timeoutMs: 1000,
      }),
    ).rejects.toThrow("2000 character limit");
  });

  it("treats temperature 0 as provider default and omits the field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ audioContent: Buffer.from("ok").toString("base64") }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await inworldTTS({
      text: "Hello",
      apiKey: "test-token",
      voiceId: "Alex",
      modelId: "inworld-tts-1.5-max",
      audioConfig: {
        audioEncoding: "MP3",
      },
      temperature: 0,
      timeoutMs: 1000,
    });

    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String((requestInit as RequestInit).body))).toEqual({
      text: "Hello",
      voiceId: "Alex",
      modelId: "inworld-tts-1.5-max",
      audioConfig: {
        audioEncoding: "MP3",
      },
    });
  });
});
