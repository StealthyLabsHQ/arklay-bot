# Changelog

All notable changes to Arklay Bot will be documented in this file.

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
