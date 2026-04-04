# Changelog

All notable changes to Arklay Bot will be documented in this file.

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
