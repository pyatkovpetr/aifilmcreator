# AI Film Creator

Standalone AI режиссёр extracted from the Localsuno/PesneGen director feature.

The product creates five concepts, analyses the source text, generates a 10-second storyboard with timecodes, ready prompts and negative prompts, keeps a production bible, supports clip and film modes, saves projects, unlocks the full pack, edits/reorders scenes, and produces a Cyrillic PDF production pack.

## Local run

```bash
pnpm install
pnpm build
pnpm exec next start -p 4310
```

Open `http://127.0.0.1:4310`.

Without `AI_DIRECTOR_LLM_URL`, the app uses the grounded deterministic generator and remains fully usable. An OpenAI-compatible endpoint can be configured through `.env` for richer generation; the fallback remains the safety net if the endpoint is unavailable.

## API surface

- `POST /api/tools/ai-video-director/ideas` — five ideas and analysis
- `POST /api/tools/ai-video-director/storyboard` — first two preview scenes
- `POST /api/tools/ai-video-director/unlock` — opens the local production pack
- `POST /api/tools/ai-video-director/full` — complete storyboard
- `GET/PATCH /api/tools/ai-video-director/projects` — saved projects and scene edits
- `POST /api/tools/ai-video-director/pdf` — PDF production pack

## Server deployment

The systemd unit in `deploy/ai-film-creator.service` binds to `127.0.0.1:4310`, keeps project data in `/var/lib/ai-film-creator`, and is intended to sit behind an existing reverse proxy if a public hostname is added later.

```bash
pnpm install --frozen-lockfile
pnpm build
systemctl enable --now ai-film-creator.service
systemctl status ai-film-creator.service
curl http://127.0.0.1:4310/
```
