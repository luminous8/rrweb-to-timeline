# expect

[![version](https://img.shields.io/npm/v/expect-cli?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/expect-cli)
[![downloads](https://img.shields.io/npm/dt/expect-cli.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/expect-cli)

Let agents test your code in a real browser. One command scans your unstaged changes or branch diff, generates a test plan, and runs it against a live browser.

**[Website](https://expect.dev)** | **[See it in action](https://expect.dev)**

## Install

```bash
npx -y expect-cli@latest init
```

## Add skill

```bash
npx skills add https://github.com/millionco/expect --skill expect-cli
```

## Commands

```
Usage: expect [command] [options]

Commands:
  unstaged          test current unstaged changes (default)
  branch            test full branch diff vs main
```

## Options

```
Options:
  -m, --message <instruction>   natural language instruction for what to test
  -f, --flow <slug>             reuse a saved flow by slug
  -y, --yes                     skip plan review, run immediately
  --base-url <url>              browser base URL
  --headed                      run browser visibly instead of headless
  --cookies                     sync cookies from your browser profile
  --no-cookies                  disable cookie sync
  -v, --version                 print version
  -h, --help                    display help
```

## License

FSL-1.1-MIT © [Million Software, Inc.](https://million.dev)
