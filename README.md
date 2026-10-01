# jeff-lab

Jeff (github.com/firelex/jeff) 0.8B System-1 decision model test webapp.
Remote jeff-serve on the laptop GPU via tailscale; Cloudflare Workers static PWA.

- App: https://jeff-lab.dydtnsp.workers.dev
- Backend: jeff-serve (FastAPI, JEFF_CHECKPOINT=Jeff-Qwen3.5-0.8B, JEFF_ADAPTERS=adapters)
- Laptop: tailscale serve --bg --set-path /jeff http://127.0.0.1:8765
