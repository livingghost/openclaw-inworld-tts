# Inworld TTS for OpenClaw

Unofficial, community-maintained OpenClaw plugin that adds the Inworld TTS provider.
It is built for OpenClaw's extension loader and ClawHub publication, not as a generic Inworld SDK wrapper.

- Package name: `openclaw-inworld-tts`
- Extension/plugin id: `inworld-tts`
- Speech provider id: `inworld`
- License: `MIT`
- Required auth: `INWORLD_API_KEY` or `messages.tts.providers.inworld.apiKey`

The extension registers the `inworld` speech provider, so OpenClaw config still uses `messages.tts.provider: "inworld"` and `messages.tts.providers.inworld`.

## Requirements

- OpenClaw `>=2026.4.1`
- Inworld API key via `INWORLD_API_KEY` or `messages.tts.providers.inworld.apiKey`
- An Inworld `voiceId`

## Install

Once published, install it like any other external OpenClaw plugin:

```bash
openclaw plugins install openclaw-inworld-tts
```

OpenClaw checks ClawHub first for bare npm-safe package names and falls back to npm if needed.

## Minimal TTS config

```json5
{
  messages: {
    tts: {
      provider: "inworld",
      providers: {
        inworld: {
          voiceId: "your-inworld-voice-id",
        },
      },
    },
  },
}
```

## Example with all supported settings

```json5
{
  messages: {
    tts: {
      provider: "inworld",
      providers: {
        inworld: {
          apiKey: "optional-if-INWORLD_API_KEY-is-set",
          baseUrl: "https://api.inworld.ai",
          voiceId: "your-inworld-voice-id",
          modelId: "inworld-tts-1.5-max",
          temperature: 0.7,
          timestampType: "WORD",
          applyTextNormalization: "auto",
          languages: ["ja-JP", "en-US"],
          audioConfig: {
            audioEncoding: "MP3",
            sampleRateHertz: 44100,
            bitRate: 128000,
            speakingRate: 1,
          },
        },
      },
    },
  },
}
```

## Talk mode example

Talk mode uses `talk.provider` and `talk.providers.<provider>`.
For Inworld, keep the Talk provider name as `inworld`.

```json5
{
  talk: {
    provider: "inworld",
    providers: {
      inworld: {
        apiKey: "optional-if-INWORLD_API_KEY-is-set",
        baseUrl: "https://api.inworld.ai",
        voiceId: "your-inworld-voice-id",
        modelId: "inworld-tts-1.5-max",
        temperature: 0.7,
        applyTextNormalization: "auto",
        audioConfig: {
          audioEncoding: "MP3",
          sampleRateHertz: 44100,
          bitRate: 128000,
          speakingRate: 1,
        },
      },
    },
  },
}
```

### `talk.speak` override example

The public `talk.speak` gateway method accepts the generic Talk override fields.
For the Inworld provider, the useful per-request overrides are `voiceId`, `modelId`, `speed`, and `normalize`.

```json
{
  "method": "talk.speak",
  "params": {
    "text": "こんにちは、OpenClawです。",
    "voiceId": "alternate-voice-id",
    "modelId": "inworld-tts-1.5-max",
    "speed": 0.95,
    "normalize": "on"
  }
}
```

Provider-specific defaults still belong in `talk.providers.inworld`.

## Discord voice example

Discord voice playback can override the global `messages.tts` config with `channels.discord.voice.tts`.

```json5
{
  channels: {
    discord: {
      voice: {
        enabled: true,
        tts: {
          provider: "inworld",
          providers: {
            inworld: {
              voiceId: "your-inworld-voice-id",
              modelId: "inworld-tts-1.5-max",
              audioConfig: {
                audioEncoding: "OGG_OPUS",
                sampleRateHertz: 48000,
              },
            },
          },
        },
      },
    },
  },
}
```

You can also override per Discord account with `channels.discord.accounts.<account-id>.voice.tts` when you want one bot account to speak differently from the global Discord voice default.

## Config reference

| Key                           | Type       | Default                  | Notes                                                                                             |
| ----------------------------- | ---------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| `apiKey`                      | `string`   | unset                    | Falls back to `INWORLD_API_KEY`. Required for voice listing and synthesis if env is not set.      |
| `baseUrl`                     | `string`   | `https://api.inworld.ai` | Trailing slash is removed automatically.                                                          |
| `voiceId`                     | `string`   | unset                    | Required for synthesis.                                                                           |
| `modelId`                     | `string`   | `inworld-tts-1.5-max`    | Supported models are listed below.                                                                |
| `temperature`                 | `number`   | provider default         | Allowed range is `> 0` and `<= 2`. `0` is treated as unset and omitted from the API request.      |
| `timestampType`               | `string`   | unset                    | Allowed values are `TIMESTAMP_TYPE_UNSPECIFIED`, `WORD`, `CHARACTER`.                             |
| `applyTextNormalization`      | `string`   | unset                    | Allowed values are `auto`, `on`, `off`. `auto` maps to Inworld's unspecified/default behavior.    |
| `languages`                   | `string[]` | unset                    | Used when listing voices. Language values are normalized to Inworld locale style such as `JA_JP`. |
| `audioConfig.audioEncoding`   | `string`   | target-dependent         | Allowed values are listed below.                                                                  |
| `audioConfig.sampleRateHertz` | `number`   | target-dependent         | Allowed values are listed below.                                                                  |
| `audioConfig.bitRate`         | `number`   | target-dependent         | Must be a positive integer when set.                                                              |
| `audioConfig.speakingRate`    | `number`   | unset                    | Allowed range is `0.5` to `1.5`.                                                                  |

## Supported values

### `modelId`

- `inworld-tts-1`
- `inworld-tts-1-max`
- `inworld-tts-1.5-mini`
- `inworld-tts-1.5-max`

### `audioConfig.audioEncoding`

- `LINEAR16`
- `MP3`
- `OGG_OPUS`
- `ALAW`
- `MULAW`
- `FLAC`
- `PCM`
- `WAV`

### `audioConfig.sampleRateHertz`

- `8000`
- `16000`
- `22050`
- `24000`
- `32000`
- `44100`
- `48000`

## Target-specific defaults

When `audioConfig` is omitted, OpenClaw picks defaults based on the output target.

| Target                     | `audioEncoding` | `sampleRateHertz` | `bitRate` | Notes                                                                |
| -------------------------- | --------------- | ----------------- | --------- | -------------------------------------------------------------------- |
| Normal reply / file output | `MP3`           | `44100`           | `128000`  | Default for general outbound audio.                                  |
| Voice note                 | `OGG_OPUS`      | `48000`           | unset     | Marked as voice-compatible by the provider.                          |
| Telephony                  | `LINEAR16`      | `8000`            | unset     | Forced for telephony output regardless of the normal reply defaults. |

## OpenClaw behavior notes

- The extension registers only a speech provider. It does not add a new channel or realtime voice transport by itself.
- `messages.tts.provider` must remain `inworld`. The plugin name `inworld-tts` is only for OpenClaw's plugin loader.
- `messages.tts.providers.inworld.languages` affects `listVoices`, not the synthesis request.
- `talk.providers.inworld` can store provider-specific Talk defaults such as `baseUrl`, `temperature`, `applyTextNormalization`, and `audioConfig`.
- Public `talk.speak` requests use the generic Talk schema; for Inworld the practical per-request overrides are `voiceId`, `modelId`, `speed`, and `normalize`.
- `channels.discord.voice.tts` overrides `messages.tts` for Discord voice playback only.
- Telephony synthesis forces `LINEAR16` at `8000` Hz.

## Service docs

- [Inworld API introduction](https://docs.inworld.ai/api-reference/introduction)
- [Inworld TTS synthesize speech](https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech)
- [Inworld list voices](https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/list-voices)

## ClawHub packaging notes

- `package.json` includes `openclaw.compat` and `openclaw.build`, which are required for ClawHub-published external plugins.
- `package.json` keeps `openclaw` as a peer dependency because the host runtime provides it.
- The local test setup uses lightweight SDK shims so `pnpm test` and `pnpm check` can run without a sibling OpenClaw checkout.

## Validation

From this package directory, first install dependencies so `pnpm-lock.yaml` is generated locally:

```bash
pnpm install
```

Then run:

```bash
pnpm test
pnpm check
```

- `pnpm test` runs the local extension Vitest suite, including `readme.test.ts`.
- `pnpm check` runs the local formatting check, local lint, and then the local extension test suite.

## Support

[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub-pink?logo=github)](https://github.com/sponsors/livingghost)

If this plugin is useful, you can support development here:

- [Sponsor on GitHub](https://github.com/sponsors/livingghost)
