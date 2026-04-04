# Arklay

![discord bot](https://github.com/user-attachments/assets/98355e27-94c3-4dde-9129-cad3053cb86f)


A modular, open-source Discord bot built with TypeScript, discord.js v14, and Node.js. Arklay combines music playback, AI-powered commands (Claude + Gemini), image generation, server moderation, and utility tools into a single bot.

Built by [StealthyLabs](https://stealthylabs.eu).

## Features

**Music** (22 commands)
Play music from YouTube, Spotify, and SoundCloud with full queue management, audio filters, lyrics, persistent player UI with buttons, auto-resume on restart, AI-generated playlists, autoplay, and track history.

**AI** (9 commands)
Chat with Claude (Anthropic) or Gemini (Google), generate images with Nano Banana 2, translate text, analyze images, catch up on conversations, summarize webpages, and more.

**Moderation** (12 commands)
Ban, kick, timeout, warn, mute, lockdown, slowmode, clear messages, nuke channels, manage bot admin roles, and toggle roles.

**Utility** (23 commands)
Ping, user/server/role/channel info, avatar, banner, polls, reminders, math, dictionary, crypto prices, weather, AFK status, emoji info, steal emojis, snipe deleted/edited messages, color preview, timestamp converter, bot info, and invite link.

**Fun** (10 commands)
Magic 8-ball, random choice, coin flip, dice rolls, trivia (with AI category), Reddit memes (with search), guess the song, rock paper scissors, rate anything, and fun percentages.

**Configuration** (7 subcommands)
Auto-role, welcome messages, mod log channel, temporary voice channels, AI auto-moderation, and server language.

**Text Prefix Commands**
All commands work with text prefix (`.play`, `arklay ask`, etc.). Both prefix and bot name are configurable via `.env`.

**Context Menus**
Right-click a message to steal its sticker.

## Requirements

- Node.js 20+ (tested on Node 24)
- ffmpeg (for music playback)
- A Discord bot token and application
- Optional: Anthropic API key (Claude), Google AI API key (Gemini), Spotify client credentials

### ffmpeg

The bot needs ffmpeg for music playback. It checks for ffmpeg in this order:
1. System `ffmpeg` in your PATH (recommended)
2. `ffmpeg-static` npm package (bundled, but may not work on all platforms)

To install ffmpeg system-wide:
- **Windows**: Download from [gyan.dev/ffmpeg](https://www.gyan.dev/ffmpeg/builds/) (essentials build), extract, and add the `bin` folder to your PATH
- **Linux**: `sudo apt install ffmpeg` (Debian/Ubuntu) or `sudo dnf install ffmpeg` (Fedora)
- **macOS**: `brew install ffmpeg`

If `ffmpeg-static` works on your platform, no extra install is needed.

## Setup

### 1. Clone and install

```bash
git clone https://github.com/StealthyLabsHQ/arklay-bot.git
cd arklay-bot
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `CLIENT_ID` | Yes | Application ID from Discord Developer Portal |
| `GUILD_ID` | No | Dev server ID for instant command deployment |
| `BOT_OWNER_ID` | No | Your Discord user ID (gets boosted AI limits) |
| `BOT_OWNER_MULTIPLIER` | No | Owner limit multiplier 0-20 (default 5) |
| `BOT_PREFIX` | No | Text command prefix (default `.`) |
| `BOT_NAME` | No | Bot name prefix (default `arklay`) |
| `ANTHROPIC_API_KEY` | No | Enables Claude AI commands |
| `GOOGLE_AI_API_KEY` | No | Enables Gemini AI + image generation |
| `SPOTIFY_CLIENT_ID` | No | Enables Spotify link resolution |
| `SPOTIFY_CLIENT_SECRET` | No | Enables Spotify link resolution |

At least one AI key (Anthropic or Google) is needed for the AI module. If neither is set, the AI module is disabled automatically.

### 3. Discord Developer Portal

Go to [discord.com/developers/applications](https://discord.com/developers/applications) and configure your bot:

**Bot settings:**
- Enable `SERVER MEMBERS INTENT` (required for auto-role and welcome messages)
- Enable `MESSAGE CONTENT INTENT`
- Enable `PRESENCE INTENT` (required for user status in /userinfo)

**OAuth2 URL Generator:**
- Scopes: `bot`, `applications.commands`
- Bot Permissions: `Administrator` (or individual permissions listed below)

If not using Administrator, enable: Manage Roles, Manage Channels, Kick Members, Ban Members, Moderate Members, View Channels, Send Messages, Manage Messages, Embed Links, Attach Files, Read Message History, Use Slash Commands, Connect, Speak, Manage Guild Expressions.

### 4. Deploy commands and start

```bash
npm run deploy    # Register slash commands with Discord
npm run dev       # Start in development mode
```

For production:

```bash
npm run build
npm run start
```

### 5. YouTube cookies (optional, for music)

YouTube may block audio streaming without cookies. If music playback fails, export your YouTube cookies in Netscape format and save as `cookies.txt` in the project root.

## Commands

### Music

| Command | Description |
|---|---|
| `/play <query>` | Play from YouTube, Spotify, or SoundCloud (supports playlists, albums, and YouTube Mixes) |
| `/pause` | Pause playback |
| `/resume` | Resume playback |
| `/skip` | Skip current track |
| `/skipto <position>` | Skip to a specific position in the queue |
| `/previous` | Play the previous track again |
| `/stop` | Stop and clear queue |
| `/queue` | Show the queue (paginated with buttons) |
| `/nowplaying` | Show current track with interactive player buttons |
| `/replay` | Restart the current track from the beginning |
| `/loop <mode>` | Loop off, track, or queue |
| `/volume <0-100>` | Set volume (preserves playback position) |
| `/shuffle` | Shuffle the queue |
| `/move <from> <to>` | Move a track to a different position in the queue |
| `/remove <position>` | Remove a track |
| `/save` | DM yourself the current track |
| `/lyrics [search]` | Show lyrics with optional AI explain button |
| `/seek <timestamp>` | Jump to a position (e.g. 1:30) |
| `/filter <type>` | Apply audio filter (bassboost, nightcore, vaporwave, 8d, slowed_reverb, speed_reverb, treble, karaoke, deepbass, chipmunk) |
| `/ai-playlist <prompt>` | Generate a playlist with AI (e.g. "chill lo-fi for studying") |
| `/autoplay` | Toggle autoplay - automatically add similar tracks when queue ends |

The music player features a persistent Now Playing embed with interactive buttons (pause/resume, skip, stop, loop, shuffle). Queue state is saved to SQLite and auto-resumes after bot restart. The bot auto-disconnects after 5 minutes of inactivity.

### AI

| Command | Description |
|---|---|
| `/ask <question> [provider]` | Ask Claude or Gemini |
| `/summarize [messages] [provider]` | Summarize recent channel messages |
| `/nanobanana <prompt> [image]` | Generate an image with Gemini (Nano Banana 2) |
| `/setmodel [model]` | Choose your personal AI model |
| `/translate <language> <text>` | AI-powered translation |
| `/roast <user>` | Contextual AI roast (uses target's recent messages) |
| `/vision <image> <prompt>` | Analyze an image with AI (Claude or Gemini) |
| `/catchup` | AI-powered summary of recent channel activity |
| `/tldr <url>` | Summarize a webpage with AI |

### Moderation (admin only)

| Command | Description |
|---|---|
| `/timeout <user> <duration> [reason]` | Timeout a user |
| `/ban <user> [reason] [delete_history]` | Ban a user |
| `/unban <userid> [reason]` | Unban a user |
| `/kick <user> [reason]` | Kick a user |
| `/warn add/list/clear <user>` | Warning system |
| `/mute <user>` | Server mute/unmute in voice |
| `/clear <amount>` | Delete 1-100 messages |
| `/lockdown [channel]` | Toggle channel lockdown |
| `/slowmode <seconds>` | Set channel slowmode |
| `/nuke` | Delete and recreate a channel |
| `/botrole add/remove/list` | Manage bot admin roles |
| `/role <user> <role>` | Toggle a role on a user (add or remove) |

### Utility

| Command | Description |
|---|---|
| `/help [command]` | Interactive help center with dropdown categories and command details |
| `/botinfo` | About the bot — developer, stats, and social links |
| `/ping` | Bot latency |
| `/userinfo [user]` | User information (status, badges, roles, permissions, activity) |
| `/serverinfo` | Server statistics |
| `/avatar [user]` | Full-size avatar |
| `/banner [user]` | User banner |
| `/roleinfo <role>` | Role details |
| `/channelinfo [channel]` | Channel details |
| `/membercount` | Server member count |
| `/invite` | Bot invite link |
| `/math <expression>` | Calculator |
| `/define <word>` | Dictionary lookup |
| `/crypto [coin]` | Cryptocurrency prices |
| `/weather <city>` | Current weather |
| `/afk [reason]` | Set/remove AFK status |
| `/remindme <duration> <message>` | Set a reminder (max 24h) |
| `/poll <question> <options>` | Interactive button poll |
| `/emoji <emoji>` | Get info and full-size image of a custom emoji |
| `/steal <emoji> [name]` | Add an external emoji to this server |
| `/snipe` | Show the last deleted message in the channel |
| `/editsnipe` | Show the previous version of the last edited message |
| `/color <hex>` | Preview a color with hex, RGB values |
| `/timestamp <date>` | Convert a date to all Discord timestamp formats |

**Context Menu:** Right-click any message → Apps → **Steal Sticker** to add its sticker to your server.

### Fun

| Command | Description |
|---|---|
| `/8ball <question>` | Magic 8-ball |
| `/choose <options>` | Random pick from comma-separated options |
| `/coinflip` | Flip a coin |
| `/dice [count] [sides]` | Roll dice |
| `/trivia [category]` | Trivia question with buttons (includes AI-generated category) |
| `/meme [search]` | Random meme from Reddit (optional search across all subreddits) |
| `/guesssong` | Guess the song from a hint (requires active music queue) |
| `/rps <choice>` | Rock paper scissors vs the bot |
| `/rate <thing>` | Rate something 0-10 with progress bar |
| `/how <trait> <thing>` | Fun percentage (e.g. "how cool is @user") |

### Configuration (admin only)

| Command | Description |
|---|---|
| `/config autorole <role>` | Auto-assign role to new members (omit to disable) |
| `/config welcome <channel> <message>` | Set welcome message ({user} and {server} placeholders) |
| `/config logs <channel>` | Set mod log channel (tracks edits and deletions) |
| `/config tempvc <channel>` | Set temporary voice channel hub |
| `/config automod <on/off>` | Toggle AI auto-moderation (uses Gemini) |
| `/config language <lang>` | Set bot language (en, fr, es, de, pt, it, nl, ru, ja, ko, zh, ar, tr) |
| `/config show` | Show current configuration |

## Text Prefix Commands

All commands support text prefixes in addition to slash commands:

| Format | Example |
|---|---|
| `.<command> [args]` | `.play chill vibes` |
| `arklay <command> [args]` | `arklay ask what is TypeScript?` |

Both the prefix (`.`) and bot name (`arklay`) are configurable via `BOT_PREFIX` and `BOT_NAME` in `.env`.

## Architecture

```
src/
  index.ts              Entry point
  core/
    client.ts           Discord.js client
    loader.ts           Dynamic module loader
    handler.ts          Interaction router (slash + context menus + text prefix)
    deploy.ts           Slash command deployment
    textAdapter.ts      Text message → interaction adapter
  modules/
    music/              Music player module
    ai/                 AI providers + commands
    moderation/         Mod tools + help
    utility/            Info + tools + context menus
    fun/                Games + entertainment
    configuration/      Server settings + event listeners
  services/
    db.ts               SQLite singleton (better-sqlite3, WAL mode)
    logger.ts           Pino logger
    config.ts           Zod env validation
    permissions.ts      Bot admin role system
    rateLimit.ts        Per-user cooldowns
    usageLimit.ts       Daily request limits (owner gets configurable multiplier)
    aiConfig.ts         Per-user AI model selection
    imageConfig.ts      Per-user image generation settings
    warnings.ts         Warning system
    guildConfig.ts      Server configuration (autorole, welcome, logs, tempvc, automod, language)
    database.ts         Conversation history
    musicQueue.ts       Shared music queue map
    musicResume.ts      Queue persistence for auto-resume
    ai/
      anthropic.ts      Claude provider
      google.ts         Gemini provider
      router.ts         AI provider router
```

Each module is independent and can be enabled/disabled. Modules never import from each other, only from `services/`.

Data is persisted in SQLite (`data/bot.db`) with 8 tables: warnings, guild_config, ai_config, image_config, conversation_history, usage_limits, bot_admin_roles, and music_resume.

## AI Models

### Claude (Anthropic)
- Claude Sonnet 4.6 (recommended)
- Claude Opus 4.6 (most powerful)
- Claude Haiku 4.5 (fastest)

### Gemini (Google)
- Gemini 3 Flash Preview (recommended)
- Gemini 3.1 Pro Preview (most powerful)
- Gemini 3.1 Flash Lite (cheapest)

Each user can choose their preferred model with `/setmodel`.

## Image Generation

Nano Banana 2 uses Gemini's image generation API. Features:
- Multiple aspect ratios (1:1, 16:9, 9:16, 4:3, 3:4)
- Resolution tiers (512px, 1K, 2K, 4K) with per-tier daily limits
- Style presets (photorealistic, anime, cartoon, oil painting, sketch, pixel art, cinematic)
- Reference image support
- Per-user settings (temperature, default ratio, system instructions)
- AI prompt enhancement (enabled by default)
- Adaptive cooldown that increases when the API is busy

## Deployment

For production on a VPS:

```bash
npm run build
npm run deploy
pm2 start dist/index.js --name arklay-bot
pm2 save
```

## License

MIT

## Links

- [StealthyLabs](https://stealthylabs.eu)
- [Documentation](https://stealthylabs.eu/docs/arklay-bot)
- [GitHub](https://github.com/StealthyLabsHQ/arklay-bot)
- [X (ex-Twitter)](https://x.com/StealthyLabsHQ)
- [Instagram](https://www.instagram.com/stealthylabs.hq)
- [TikTok](https://tiktok.com/@stealthylabs)
