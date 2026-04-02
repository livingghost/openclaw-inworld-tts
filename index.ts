import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { buildInworldSpeechProvider } from "./speech-provider.js";

export default definePluginEntry({
  id: "inworld-tts",
  name: "Inworld TTS",
  description: "OpenClaw extension that adds the Inworld text-to-speech provider.",
  register(api) {
    api.registerSpeechProvider(buildInworldSpeechProvider());
  },
});
