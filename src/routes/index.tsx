import { createFileRoute } from "@tanstack/react-router";

import { VoiceCore } from "@/components/riccos/voice-core";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RiccOS — Central de comando" },
      { name: "description", content: "Central de comando por voz do RiccOS." },
    ],
  }),
  component: VoiceCore,
});
