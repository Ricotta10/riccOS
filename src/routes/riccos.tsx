import { createFileRoute } from "@tanstack/react-router";

import { VoiceCore } from "@/components/riccos/voice-core";

export const Route = createFileRoute("/riccos")({
  head: () => ({
    meta: [
      { title: "RiccOS — Central de comando" },
      { name: "description", content: "Central de comando por voz do RiccOS." },
    ],
  }),
  component: VoiceCore,
});
