# Arklay

![discord bot](https://github.com/user-attachments/assets/98355e27-94c3-4dde-9129-cad3053cb86f)

A modular Discord bot built with TypeScript, discord.js v14, and Node.js. Arklay combines music playback, AI-powered commands (Claude + Gemini), image generation, server moderation, and utility tools into a single bot.

Built by [StealthyLabs](https://stealthylabs.eu).

## Features

**Music** (22 commands)
Play music from YouTube, Spotify, and SoundCloud with full queue management, audio filters, lyrics, persistent player UI with buttons, auto-resume on restart, AI-generated playlists, autoplay, and track history.

**AI** (10 commands + local AI management)
Chat with Claude (Anthropic), Gemini (Google), or a local model via Ollama (Gemma 4, Llama, Mistral, etc.). Generate images with Nano Banana 2, translate text, analyze images, catch up on conversations, summarize webpages. Bot owner can customize the local AI system prompt, knowledge base (RAG), and thinking mode.

**Moderation** (12 commands)
Ban, kick, timeout, warn, mute, lockdown, slowmode, clear messages, nuke channels, manage bot admin roles, and toggle roles.

**Utility** (23 commands)
Ping, user/server/role/channel info, avatar, banner, polls, reminders, math, dictionary, crypto prices, weather, AFK status, emoji info, steal emojis, snipe deleted/edited messages, color preview, timestamp converter, bot info, and invite link.

**Fun** (11 commands)
Magic 8-ball, random choice, coin flip, dice rolls, trivia (with AI category), Reddit memes (with search), GIF search (Giphy), guess the song, rock paper scissors, rate anything, and fun percentages.

**Configuration** (7 subcommands)
Auto-role, welcome messages, mod log channel, temporary voice channels, AI auto-moderation, and server language.

**Text Prefix Commands**
All commands work with text prefix (`.play`, `arklay ask`, etc.). Both prefix and bot name are configurable via `.env`. Reply to any AI message to continue the conversation.

**Context Menus**
Right-click a message to steal its sticker.

## Requirements

- Node.js 20+ (tested on Node 24)
- Java 17+ and [Lavalink](https://github.com/lavalink-devs/Lavalink) (for music playback — optional, bot runs without it but music is disabled)
- A Discord bot token and application
- Optional: Anthropic API key (Claude), Google AI API key (Gemini), Spotify client credentials

### Lavalink (required for music)

The music module uses Lavalink, a standalone audio server. Lavalink handles YouTube/SoundCloud streaming, audio filters, and seeking — the bot itself does no audio processing.

#### Install Java

**Ubuntu/Debian (OVH, Hetzner, etc.):**
```bash
sudo apt update
sudo apt install openjdk-17-jre-headless -y
java -version  # verify
```

**Fedora/RHEL:**
```bash
sudo dnf install java-17-openjdk-headless -y
```

**Windows:**
Download from [adoptium.net](https://adoptium.net/) (Temurin 21 LTS) and install. During installation, check **"Add to PATH"** and **"Set JAVA_HOME"**. Close and reopen your terminal after installing.

**macOS:**
```bash
brew install openjdk@17
```

#### Install & Run Lavalink

```bash
mkdir lavalink && cd lavalink
# Download latest Lavalink.jar
wget https://github.com/lavalink-devs/Lavalink/releases/latest/download/Lavalink.jar
# Copy the config template from the bot project
cp ../lavalink/application.yml .
# Run Lavalink
java -jar Lavalink.jar
```

For production, run Lavalink as a service:
```bash
# With PM2
pm2 start "java -jar Lavalink.jar" --name lavalink --cwd /path/to/lavalink
pm2 save

# Or with systemd
sudo tee /etc/systemd/system/lavalink.service << 'EOF'
[Unit]
Description=Lavalink Audio Server
After=network.target

[Service]
User=your-user
WorkingDirectory=/path/to/lavalink
ExecStart=/usr/bin/java -jar Lavalink.jar
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable lavalink --now
```

The bot connects to Lavalink via `LAVALINK_HOST` in `.env` (default: `localhost:2333`).

## Quick Start (for beginners)

```bash
# 1. Clone the project
git clone https://github.com/StealthyLabsHQ/arklay-bot.git
cd arklay-bot
npm install

# 2. Create your config file
cp .env.example .env
# Edit .env → add DISCORD_TOKEN and CLIENT_ID (minimum required)

# 3. Register slash commands with Discord
npm run deploy

# 4. Start the bot (without music)
npm run dev

# 5. (Optional) For music: install Java, download Lavalink.jar into lavalink/, then:
cd lavalink && java -jar Lavalink.jar   # in a separate terminal
cd .. && npm run dev                     # restart the bot
```

The bot works without Lavalink — music commands will simply show "Lavalink server is not running". All other features (AI, moderation, utility, fun) work independently.

## Setup (detailed)

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
| `LAVALINK_HOST` | No | Lavalink server address (default `localhost:2333`) |
| `LAVALINK_PASSWORD` | No | Lavalink password (default `youshallnotpass`) |
| `LAVALINK_SECURE` | No | Use WSS instead of WS (default `false`) |
| `BOT_OWNER_ID` | No | Your Discord user ID (gets boosted AI limits) |
| `BOT_OWNER_MULTIPLIER` | No | Owner limit multiplier 0-20 (default 5) |
| `BOT_PREFIX` | No | Text command prefix (default `.`) |
| `BOT_NAME` | No | Bot name prefix (default `arklay`) |
| `ANTHROPIC_API_KEY` | No | Enables Claude AI commands |
| `GOOGLE_AI_API_KEY` | No | Enables Gemini AI + image generation |
| `SPOTIFY_CLIENT_ID` | No | Enables Spotify link resolution |
| `SPOTIFY_CLIENT_SECRET` | No | Enables Spotify link resolution |
| `GIPHY_API_KEY` | No | Enables `/gif` command (free at [developers.giphy.com](https://developers.giphy.com/)) |
| `OLLAMA_HOST` | No | Ollama server address (default `http://localhost:11434`) |
| `OLLAMA_MODEL` | No | Local AI model (default `gemma4:26b`) |
| `OLLAMA_KEEP_ALIVE` | No | How long model stays in RAM after last request (default `5m`, use `-1` for permanent) |

At least one AI provider (Anthropic, Google, or Ollama) is needed for the AI module. If none is set, the AI module is disabled automatically.

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

The music player features a persistent Now Playing embed with interactive buttons (pause/resume, skip, stop, loop, shuffle, autoplay) and a dropdown menu for audio filters. The Now Playing also displays the upcoming queue. Queue state is saved to SQLite and auto-resumes after bot restart. The bot auto-disconnects after 5 minutes of inactivity. If Lavalink is not running, music commands are gracefully disabled with a clear message.

### AI

| Command | Description |
|---|---|
| `/ask <question> [provider]` | Ask Claude, Gemini, or local AI |
| `/summarize [messages] [provider]` | Summarize recent channel messages |
| `/nanobanana <prompt> [image]` | Generate an image with Gemini (Nano Banana 2) |
| `/setmodel cloud <model>` | Choose a cloud AI model (Claude or Gemini) |
| `/setmodel local` | Switch to local AI (Ollama) |
| `/setmodel show` | Show your current AI model |
| `/setmodel reset` | Reset to default model |
| `/translate <language> <text>` | AI-powered translation |
| `/roast <user>` | Contextual AI roast (uses target's recent messages) |
| `/vision <image> <prompt>` | Analyze an image with AI (Claude or Gemini) |
| `/catchup` | AI-powered summary of recent channel activity |
| `/tldr <url>` | Summarize a webpage with AI |
| `/localai prompt [text]` | View or set custom system prompt for local AI (owner only) |
| `/localai knowledge-add <topic> <content>` | Add to knowledge base — RAG (owner only) |
| `/localai knowledge-list` | List knowledge base entries (owner only) |
| `/localai thinking <enabled>` | Toggle thinking mode (owner only) |
| `/localai status` | Show local AI configuration (owner only) |

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
| `/botinfo` | About Arklay — developer, stats, and social links |
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
| `/gif <query> [mode]` | Search GIFs via Giphy (search, exact, random) |
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
├── index.ts                    Entry point
├── core/
│   ├── client.ts               Discord.js client
│   ├── loader.ts               Dynamic module loader
│   ├── handler.ts              Interaction router (slash + context menus + text prefix)
│   ├── deploy.ts               Slash command deployment
│   └── textAdapter.ts          Text message → interaction adapter
├── modules/
│   ├── music/                  Music player module (Lavalink + Shoukaku)
│   ├── ai/                     AI providers + commands
│   ├── moderation/             Mod tools + help
│   ├── utility/                Info + tools + context menus
│   ├── fun/                    Games + entertainment
│   └── configuration/          Server settings + event listeners
└── services/
    ├── lavalink.ts             Lavalink/Shoukaku connection manager
    ├── db.ts                   SQLite singleton (better-sqlite3, WAL mode)
    ├── logger.ts               Pino logger
    ├── config.ts               Zod env validation
    ├── permissions.ts          Bot admin role system
    ├── rateLimit.ts            Per-user cooldowns
    ├── usageLimit.ts           Daily request limits (owner gets configurable multiplier)
    ├── aiConfig.ts             Per-user AI model selection
    ├── imageConfig.ts          Per-user image generation settings
    ├── warnings.ts             Warning system
    ├── guildConfig.ts          Server configuration (autorole, welcome, logs, tempvc, automod, language)
    ├── database.ts             Conversation history
    ├── musicQueue.ts           Shared music queue map
    ├── musicResume.ts          Queue persistence for auto-resume
    ├── localaiConfig.ts        Local AI system prompt + knowledge base (RAG)
    ├── thinkingTimer.ts        "Thinking..." timer for AI commands
    └── ai/
        ├── anthropic.ts        Claude provider
        ├── google.ts           Gemini provider
        ├── ollama.ts           Ollama provider (local AI)
        └── router.ts           AI provider router
```

Each module is independent and can be enabled/disabled. Modules never import from each other, only from `services/`.

Data is persisted in SQLite (`data/bot.db`) with 10 tables: warnings, guild_config, ai_config, image_config, conversation_history, usage_limits, bot_admin_roles, music_resume, localai_config, and localai_knowledge.

## AI Models

### Claude (Anthropic)
- Claude Sonnet 4.6 (recommended)
- Claude Opus 4.6 (most powerful)
- Claude Haiku 4.5 (fastest)

### Gemini (Google)
- Gemini 3 Flash Preview (recommended)
- Gemini 3.1 Pro Preview (most powerful)
- Gemini 3.1 Flash Lite (cheapest)

### Local AI (Ollama)
- Any model supported by Ollama (Gemma 4, Llama, Mistral, Qwen, etc.)
- Model configured via `OLLAMA_MODEL` in `.env`
- No daily limits, no API costs
- Custom system prompt and knowledge base (RAG) via `/localai`
- Optional thinking mode for reasoning-heavy tasks

Each user can switch between cloud and local with `/setmodel cloud` or `/setmodel local`.

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
