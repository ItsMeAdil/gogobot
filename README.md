<div align="center">
  <img align="center" src="https://bot.undo.club/logo-small.png" width="100" />
  <center>
    <a href="https://bot.undo.club"><h1 align="center">GoGoBot</h1></a>
  </center>
</div>

## About

The official [Gogoanime](https://anitaku.so) Discord Robot.

Features:

- Clans
- Economy
- Anime
- And much more!

## Installation

> GoGoBot no longer supports Node, get Bun or don't run

Install [Bun](https://bun.sh)

```sh
git clone https://github.com/TheUndo/gogobot.git # download repo
cd gogobot                                       # enter directory
cp .env.example .env                             # copy environment variables
bun install                                      # install dependencies
bunx prisma db push                              # install prisma
```

After installing open `.env` in your IDE and edit it.

## Usage

### Development

```sh
bun dev
```

### Gogoanime (Episodes, Anime, News)

Only run these if you want to work on the anime parts

```sh
bun gogo/scraper/scrapeEverything.ts  # Scrape anime (optional)
bun gogo/scraper/scrapeRecents.ts     # Scrape recents and notify (optional)
bun gogo/scraper/scrapeNews.ts        # Scrape news (optional)
```

### Production

```sh
bunx pm2 start ecosystem.config.cjs
```

## Technical Information

- Runtime: [Bun](https://bun.sh)
- Database: [sqlite (Prisma)](https://www.prisma.io/)
- Primary language: [TypeScript](https://www.typescriptlang.org/)
- Discord API SDK: [Discord.js](https://discord.js.org)
- Process manager: [pm2](https://pm2.io/)
- Frontend framework: [Qwik](https://qwik.dev)
- PaaS: [Cloudflare pages](https://pages.dev)
- Linter: [Biome](https://biomejs.dev/)
- Git hooks: [Husky](https://typicode.github.io/husky/)

## Contributing

All PRs are welcome!

- Make sure to run pre-push and pre-commit scripts (should be automatic)
- Fork and make a PR!
- Use common sense commit messages not "bruh123"
- `any` type is banned except for very specific circumstances (comments required)
- NO memory leaks allowed

Need help? Join support server and contact `undo__`.
