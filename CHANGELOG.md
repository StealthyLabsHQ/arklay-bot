# Changelog

All notable changes to Arklay Bot will be documented in this file.

## [2.5.3] - 2026-04-09

### Fixes
- **`/meme`** — replaced Imgflip fallback with Giphy (topic-relevant results) and meme-api.com for random mode; Imgflip returned unrelated templates when Reddit was blocked on VPS IPs
- **`/roast`** — AI providers (Claude, Gemini, OpenAI) no longer refuse roast requests; added a comedy-roast system prompt override that bypasses generic content filters
- **`/roast`** — language instruction now placed after `<user_data>` block so the model doesn't respond in the target's message language instead of the requested one

### Refactor
- **Command compaction** — 100+ slash commands reduced to 6 parent commands with subcommands, staying well under Discord's 100-command limit:
  - `/fun` — 13 subcommands (eightball, meme, gif, trivia, rps, coinflip, dice, leaderboard, …)
  - `/mod` — 13 subcommands + `warn` / `botrole` / `antinuke` subcommand groups
  - `/info` — 9 subcommands + `userinfo` / `serverinfo` / `channelinfo` subcommand groups
  - `/tools` — 15 subcommands + `giveaway` / `tags` subcommand groups (tags autocomplete preserved)
  - `/music` — 16 subcommands (play, pause, skip, loop, filter, volume, seek, …)
  - `/queue` — 7 subcommands + `favorites` / `playlist` subcommand groups
- AI commands (`/ask`, `/code`, `/roast`, `/translate`, etc.) are unaffected
- Added optional `systemPromptOverride` parameter to `ask()`, `askClaude()`, `askGemini()`, `askOpenAI()` for per-command system prompt injection

---

## [2.5.2] - 2026-04-07

### Moderation
- **Anti-nuke system** — real-time protection against mass-ban, mass-kick, mass-channel-delete, and mass-role-delete
  - `/antinuke enable` — toggle protection on/off
  - `/antinuke config` — set thresholds, time window, and action (strip roles / kick / ban)
  - `/antinuke whitelist @user` — toggle trusted admins exempt from detection
  - `/antinuke status` — view current configuration
  - `/antinuke logs` — view recent trigger history
  - Alerts posted automatically in the server's system channel when triggered
- **Moderation case tracking** — all ban, kick, warn, timeout actions now logged to `mod_cases` DB table
  - `/modlogs @user` — full moderation history for a user (warns, bans, kicks, timeouts)
  - `/case <id>` — view a specific case by ID

### Utility
- `/giveaway start|end|reroll` — full giveaway system
  - Optional `description` field
  - Winners receive a DM notification
  - Long-duration fix: supports giveaways beyond 24.8 days (Node.js `setTimeout` overflow workaround)
- `/tags create|show|list|edit|delete` — custom server text snippets (admin only)
- `/twitch <username>` — check if a Twitch streamer is live (title, game, viewers, thumbnail)
- `/audit [limit]` — view recent Discord audit log entries (admin only)
- `/userinfo` now has subcommands: `info`, `permissions`, `joinposition`
- `/serverinfo` now has subcommands: `info`, `icon` (merged from standalone `/servericon`)
- `/channelinfo` now has subcommands: `info`, `firstmessage` (merged from standalone `/firstmessage`)
- `/botinfo` — added version field (v2.5.2) and OpenAI ChatGPT in AI Providers

### Fun
- `/leaderboard [period]` — top music listeners on the server (week / month / all time)

### Removed
- `/catchup` — removed (redundant with `/summarize`)
- `/editsnipe` — removed
- `/lyrics-translate` — removed
- `/recommend` — removed
- These removals keep the bot under Discord's 100 slash command limit

### Fixes
- Music auto-resume: filter and loop mode now correctly restored after bot restart
- Add `guildOnly: true` to all guild-specific modules and commands — prevents crashes when commands are used in DMs
- Add `safeFetch` service for safe HTTP requests with proper error handling
- `GOOGLE_APPLICATION_CREDENTIALS` placeholder detection in config validation

### Misc
- SQLite schema: added `guild_tags`, `giveaways`, `mod_cases`, `antinuke_config`, `antinuke_logs` tables (20 tables total)
- Updated `.env.example` with `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`
- New services: `modcases.ts`, `antinuke.ts`, `giveaway.ts`, `tags.ts`

---

## [2.5.1] - 2026-04-06

### AI
- **OpenAI provider** — full ChatGPT integration (GPT-5.4 Nano, GPT-5.4 Mini, o4 Mini)
  - Dynamic model switching: auto-upgrades to GPT-5.4 Mini for complex prompts, o4 Mini for reasoning tasks
  - Vision support: attach images to `/ask` with OpenAI models
  - `OPENAI_API_KEY` in `.env` — models appear in `/setmodel` when configured
- `/code` — new models: GPT-5.3 Codex (code-optimized), GPT-5.4, GPT-5.4 Long Context (16k tokens)
- `/persona set|custom|show|reset` — set AI personality (pirate, yoda, sarcastic, + 5 presets or custom)
- `/explain <topic> [level]` — explain at 4 levels: like I'm 5, beginner, intermediate, expert
- `/debate <topic>` — any 2 available providers debate (Claude, Gemini, ChatGPT, Ollama)
- `/llm` — show your current AI model, provider, usage limits, and available providers
- **Weekly usage limits** — all cloud models now have daily + weekly quotas
- Claude `askClaude()` now uses `resolveClaudeModel()` — no longer crashes when user has non-Claude model configured

### Music
- `/lyrics-translate <language>` — translate current track lyrics via AI
- `/stats` — server music statistics (top tracks, top listeners, total plays)
- `/recommend` — AI suggests 10 tracks based on your queue and history
- Play tracking: every track played is recorded in SQLite for `/stats`

### Utility
- `/screenshot <url>` — capture a website screenshot with multi-API fallback (thum.io → Microlink), image uploaded directly to Discord, blank page detection, clear error message for blocked sites
- `/qrcode <text> [size]` — generate a QR code (100-1000px)

### Fun
- `/quote` — random inspirational quote (zenquotes.io)

### Fixes
- `/help` — suppress Unknown interaction (10062) errors on slow networks
- `/help` — crash on unknown category fallback → shows overview instead
- `/help` — updated all category descriptions and command descriptions
- `/help` — added missing `/gif` command to help menu
- `/ask` — `deferReply` wrapped in try/catch to prevent double-acknowledge crash
- `/debate` — works with any 2+ providers (no longer requires specifically Claude + Gemini)
- Handler — suppresses 10062 errors globally instead of logging as ERROR
- OpenAI — uses `max_completion_tokens` instead of deprecated `max_tokens`
- OpenAI — better error logging with raw status and message

### Performance — Lazy Imports
- **AI SDKs loaded on first use only** — `@anthropic-ai/sdk`, `@google/generative-ai`, `openai` no longer imported at startup
- **Lightweight availability registry** (`availability.ts`) — 12 files now check provider availability via env vars only, no SDK imports
- **`isVertexMode()` inlined** — 8 files no longer import `anthropic.ts` just for Vertex check
- **`generateImage` lazy-loaded** in `/nanobanana` — Google SDK only loaded when image generation is actually used
- Estimated: ~40-60ms faster startup, ~5-10MB less RAM at boot

### Misc
- New dependency: `openai` ^6.33.0
- SQLite schema: added `user_persona`, `music_plays` tables (15 tables total)
- Updated `.env.example` with `OPENAI_API_KEY`

---

## [2.5.0] - 2026-04-06

### Music
- `/favorites add|list|play|remove|clear` — save, browse, and play your favorite tracks (SQLite, max 100)
- `/playlist create|save|load|show|list|delete` — personal playlists with queue save/load (max 10 playlists, 200 tracks each)
- `/history` — show the 20 most recently played tracks
- `/247` — 24/7 mode: bot stays connected to voice even when queue is empty
- Removed `/ai-playlist` (YouTube broken, SoundCloud limited catalogue)

### AI
- `/code <prompt> <model> [file] [lang]` — generate or analyze code with temp 0 and full reasoning
  - Model choice: Claude Sonnet 4.6, Claude Opus 4.6, Gemini 3.1 Pro Thinking
  - Supports code file upload (.ts, .py, .js, etc.) and image/screenshot analysis
  - 4096 max tokens, Gemini Pro with thinking budget 8192
  - Auto-splits long responses across multiple Discord messages
- `/ask` now supports optional image attachment for visual analysis (Claude vision + Gemini multimodal)
- `/cloudai prompt|reset-prompt|status` — new dedicated command for cloud AI prompt management (moved from `/localai`)
- `/localai` commands now conditional — hidden when `OLLAMA_ENABLED=false`
- `/setmodel local` hidden when Ollama is disabled
- `OLLAMA_ENABLED` env var — explicit on/off toggle for local AI (`true`/`false`)

### Security
- Prompt injection protection on `/roast`, `/catchup`, and automod — user data escaped and wrapped in `<user_data>` tags
- Automod: `message.content` HTML-escaped before XML tags to prevent `</user_message>` breakout
- Spotify pagination capped at 100 pages to prevent infinite loops
- `cloudai` and `localai` added to text prefix blacklist (prevents silent no-reply)
- Cooldown map cleanup: evicts entries >1h old when exceeding 50k entries

### Fixes
- `/meme` on VPS — realistic browser User-Agent (Chrome) instead of `DiscordBot/1.0` (blocked by Reddit on VPS IPs), 10s timeout, improved image detection
- Unsafe `JSON.parse` in music resume wrapped in try/catch (prevents crash on corrupted DB)
- Silent error swallowing in GuildQueue exception handler and button collector now logged
- `isBotOwner()` deduplicated — extracted to `config.ts` (was defined 3x)
- `readTextAttachment()` helper to reduce code duplication in file upload commands

### Misc
- `start.bat` reads `OLLAMA_ENABLED` from `.env` — skips Ollama launch when disabled
- Updated `.env.example` with `OLLAMA_ENABLED`
- SQLite schema: added `user_favorites`, `user_playlists`, `playlist_tracks` tables

---

## [2.4.0] - 2026-04-05

### AI
- `/localai cloud-prompt` — custom system prompt for Claude + Gemini (bot owner only)
- `/localai reset-cloud-prompt` — reset cloud prompt to default
- `/localai status` now shows both local and cloud prompt status
- Free-text language option on `/ask`, `/summarize`, `/roast`, `/vision` — type any language
- Auto-summarize long knowledge entries (>2000 chars) before storing for efficient RAG
- File upload support for `/localai prompt` and `/localai knowledge-add` (up to 25MB, .txt/.md)
- Improved AI playlist prompt to reduce hallucinations — prioritize real songs by mentioned artist
- Fix provider validation on text prefix `/ask` — no longer passes question as provider

### Music
- Volume buttons (🔉 Vol- / 🔊 Vol+) in Now Playing player UI (±10% per click)
- Fix "guild already has existing connection" crash — reuse existing Shoukaku player
- Fix track skipping loop — clear YouTube-encoded data on failure, re-resolve via SoundCloud
- SoundCloud-first streaming with YouTube fallback
- LavaSrc plugin for extended source support
- Auto-detect actual streaming source (SoundCloud/YouTube/Spotify) from Lavalink track info
- Correct source labels and colors in Now Playing embed

### Fun
- `/gif <query> [mode]` — search GIFs via Giphy (search, exact, random)

### Misc
- Fix Learn More links pointing to specter-bot → arklay-bot
- Fix BOT_NAME default to `arklay`
- Fix askGemini using Ollama model ID when user configured local AI
- Prevent bot crashes from unhandled promise rejections
- Fix OLLAMA_KEEP_ALIVE=-1 crash
- Updated `.env.example` with GIPHY_API_KEY, OLLAMA_KEEP_ALIVE

---

## [2.3.0] - 2026-04-05

### Music — SoundCloud-first streaming
- **SoundCloud as primary streaming source** — YouTube streaming is currently broken globally (login required), SoundCloud is used as the primary source with YouTube as fallback
- **LavaSrc plugin** added alongside youtube-plugin for extended source support
- Auto-detect actual streaming source (SoundCloud, YouTube, Spotify) from Lavalink track info
- Correct source labels and colors in Now Playing embed (orange for SoundCloud, green for Spotify, red for YouTube)
- Autoplay now searches SoundCloud first for similar tracks
- Spotify resolution uses SoundCloud streaming instead of YouTube
- `resolveSpotifyTrack` replaces deprecated `spotifyTrackToYT`
- Playlist resolution auto-detects source per track

### Misc
- Prevent bot crashes from unhandled promise rejections
- Fix OLLAMA_KEEP_ALIVE=-1 sending invalid duration string

---

## [2.2.2] - 2026-04-05

### Fun
- `/gif <query> [mode]` — search GIFs via Giphy API (search, exact match, random)

### Fixes
- Fixed `/ask` text prefix passing question text as provider — now validates provider value
- Fixed `askGemini` using Ollama model ID when user had local AI configured — falls back to default Gemini model
- Switched GIF API from Tenor (discontinued Jan 2026) to Giphy
- Updated `.env.example` with `GIPHY_API_KEY`, `OLLAMA_KEEP_ALIVE`, corrected default model

---

## [2.2.1] - 2026-04-05

### AI — Local AI (Ollama)
- **Reply-to-bot conversation**: reply to any AI message to continue the conversation naturally
- **Thinking mode**: per-command control — only `/ask` uses thinking when enabled, all other commands (roast, translate, catchup, etc.) always run in fast mode
- Fixed Gemma 4 "thinking" model returning empty content — fallback extracts answer from thinking field
- `think: false` sent by default to prevent empty responses on thinking-capable models

---

## [2.2.0] - 2026-04-05

### AI — Local AI (Ollama)
- **Ollama provider** for local AI models (Gemma 4, Llama, Mistral, etc.)
- `/setmodel cloud <model>` — choose between Claude and Gemini
- `/setmodel local` — switch to local AI (model from `OLLAMA_MODEL` env var)
- `/localai prompt` — custom system prompt for local AI (bot owner only)
- `/localai knowledge-add/list/remove/clear` — knowledge base (RAG) stored in SQLite, auto-injected when relevant
- `/localai thinking` — toggle thinking mode (shows reasoning in Discord spoiler tags)
- `/localai status` — view local AI configuration
- **Thinking timer** on all AI commands — shows "thinking... (Xs)" while waiting for response
- `OLLAMA_KEEP_ALIVE` env var — control how long model stays in RAM (default 5 min)
- No hardcoded model names — reads from `OLLAMA_MODEL` in `.env`
- No daily limits on local models
- `start.bat` launches Ollama + Lavalink + bot together

### Music — Lavalink Migration
- **Complete rewrite** of music backend from ffmpeg/yt-dlp to **Lavalink + Shoukaku**
- YouTube playback via `youtube-plugin` with `ytmsearch:` fallback
- **Now Playing queue display**: shows up to 10 upcoming tracks in the embed
- **Audio filter dropdown**: select menu with 11 filters (bassboost, nightcore, vaporwave, 8d, etc.)
- **Graceful Lavalink detection**: music commands disabled with clear message when Lavalink is offline
- Wait for Lavalink connection before auto-resume on restart

### Misc
- `.env.example` updated with Ollama and Lavalink variables
- README: Quick Start for beginners, tree-style architecture diagram, Windows Java instructions
- Fixed `specter` → `arklay` references in README and `.env.example`

---

## [2.0.1] - 2026-04-05

### Music
- **Now Playing revamp**: artist, album, release date, source fields in embed
- **Previous button** (⏮): go back to the previous track from history
- **Autoplay button** (♾): toggle autoplay directly from the player UI
- **Shuffle toggle**: button now shows active state (green) and can be unchecked
- **Two button rows**: ⏮ Previous, ⏸ Pause, ⏭ Skip, ⏹ Stop, 🔁 Loop | 🔀 Shuffle, ♾ Autoplay
- `/ai-playlist`: max 200 tracks (up from 25), paginated embed with navigation buttons
- `/ai-playlist`: multi-request AI for large playlists (>50 tracks), no duplicates
- `/filter`: fuzzy match for text prefix (e.g. "slowed" → "slowed_reverb")

### AI
- All AI commands now display the **exact model name** and **remaining daily quota** in footer
- Fixed model display: shows the actual model used, not the configured one (when auto-resolving)
- `AskResult` now includes the real model ID used by the router
- Default model changed to **Gemini 3.1 Flash Lite** (cheapest)

### Text Prefix
- **Missing argument handling**: shows usage hint instead of "An error occurred"
- `MissingArgError` for required args → `Usage: .filter <type>`
- Other errors → `Usage: .cmd <args> — Use /help cmd for details.`
- Smart number parsing: numbers >100 (years) kept as text, ≤100 treated as options

### Dependencies
- Updated `@google/generative-ai` to 0.24 (fixes punycode deprecation warning)
- Updated `yt-dlp-exec` to latest

### Misc
- Granular OAuth2 permissions (no more Administrator)
- Multi-guild deploy: comma-separated `GUILD_ID` support
- Invite URL with predefined permissions logged on bot startup
- Removed all hardcoded bot name references — fully dynamic via `client.user.username`

---

## [2.0.0] - 2026-04-05

### Architecture
- Modular architecture with 6 independent modules (music, ai, moderation, utility, fun, configuration)
- Dynamic module loader — enable/disable modules without touching code
- SQLite persistent storage (better-sqlite3, WAL mode) replacing all in-memory Maps
- AI service extraction to `services/ai/` for cross-module access
- Shared music queue service for cross-module access
- Text prefix command system with configurable prefix and bot name
- Context menu command support (right-click actions)
- Auto-resume: queue state saved to SQLite, restored on bot restart

### Music (22 commands)
- `/play` — YouTube, Spotify, SoundCloud, playlists, albums, YouTube Mixes
- `/pause`, `/resume`, `/skip`, `/stop`, `/queue` (paginated with buttons)
- `/nowplaying` — persistent player UI with interactive buttons (pause, skip, stop, loop, shuffle)
- `/replay` — restart current track from beginning
- `/previous` — play the previous track from history
- `/skipto` — jump to a specific position in the queue
- `/move` — reorder tracks in the queue
- `/loop` — off / track / queue modes
- `/volume` — 0-100, preserves playback position
- `/shuffle`, `/remove`, `/save`, `/lyrics` (with AI explain button)
- `/seek` — jump to timestamp
- `/filter` — 10 audio filters (bassboost, nightcore, vaporwave, 8d, slowed_reverb, speed_reverb, treble, karaoke, deepbass, chipmunk)
- `/ai-playlist` — generate playlists from natural language prompts
- `/autoplay` — automatically add similar tracks when queue ends
- Spotify oEmbed fallback (no API key needed for single tracks)
- Pre-fetch optimization: resolves next track's audio URL during playback
- 5-minute idle auto-disconnect

### AI (9 commands)
- `/ask` — chat with Claude or Gemini with conversation history
- `/summarize` — summarize recent channel messages
- `/nanobanana` — image generation with Gemini (multiple ratios, resolutions, styles, AI prompt enhancement)
- `/setmodel` — per-user model selection (Claude Opus/Sonnet/Haiku, Gemini Flash/Pro/Lite)
- `/translate` — AI-powered translation
- `/roast` — contextual roast using target's recent messages
- `/vision` — image analysis with Claude or Gemini
- `/catchup` — AI-powered conversation catch-up
- `/tldr` — summarize any webpage
- Daily usage limits per model with configurable owner multiplier (0-20x)
- Support for Claude via direct API or Google Cloud Vertex AI

### Moderation (12 commands)
- `/ban`, `/unban`, `/kick`, `/timeout`, `/mute`
- `/warn` — add/list/clear warning system
- `/clear` — bulk delete 1-100 messages
- `/lockdown` — toggle channel access
- `/slowmode` — set channel slowmode
- `/nuke` — delete and recreate channel
- `/botrole` — custom bot admin role system
- `/role` — toggle a role on a user

### Utility (23 commands)
- `/help` — interactive help center with dropdown categories, i18n (en/fr), command details with usage and supported models
- `/botinfo` — bot info with developer links and stats
- `/ping`, `/userinfo`, `/serverinfo`, `/avatar`, `/banner`
- `/roleinfo`, `/channelinfo`, `/membercount`, `/invite`
- `/math` — safe recursive descent parser (no eval)
- `/define`, `/crypto`, `/weather`
- `/afk`, `/remindme`, `/poll`
- `/emoji` — full-size emoji preview with metadata
- `/steal` — add external emojis to server
- `/snipe` — show last deleted message
- `/editsnipe` — show last edited message
- `/color` — hex color preview with RGB values
- `/timestamp` — convert dates to all Discord timestamp formats
- **Context Menu:** "Steal Sticker" — right-click any message to add its sticker

### Fun (10 commands)
- `/8ball`, `/choose`, `/coinflip`, `/dice`
- `/trivia` — with AI-generated category
- `/meme` — random memes with optional search across all of Reddit
- `/guesssong` — guess the song from the active music queue
- `/rps` — rock paper scissors vs the bot
- `/rate` — consistent 0-10 rating with progress bar
- `/how` — fun percentage generator

### Configuration (7 subcommands)
- `/config autorole` — auto-assign role to new members
- `/config welcome` — welcome messages with {user} and {server} placeholders
- `/config logs` — mod log channel for deletions and edits
- `/config tempvc` — dynamic temporary voice channels
- `/config automod` — AI auto-moderation with Gemini
- `/config language` — server language (13 languages supported)
- `/config show` — display current configuration

### Security
- No hardcoded bot name — all UI uses `client.user.username` dynamically
- Granular OAuth2 permissions (no Administrator)
- Safe math parser replacing `Function()` constructor
- XML-wrapped prompts for injection protection in `/translate`
- Invite URL with predefined permissions logged on startup

## [1.0.0] - 2025-12-01

### Initial Release
- Basic music playback with YouTube support
- Simple slash commands
- Monolithic architecture
