# Marketplace entry

The DSH catalog is generated from [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin). **dshmarket is a client for that same catalog** — do not open a plugin PR against `dsh-market/dsh-market`.

Submissions are **one YAML file per plugin**, not a line in a README. Add:

`data/plugins/GHSYES__dsh-whale-girl-pet.yml`

```yaml
url: https://github.com/GHSYES/dsh-whale-girl-pet
name: GHSYES/dsh-whale-girl-pet
category: fun
description:
  en: 'A pixel whale-girl desktop pet for DSH on Windows: live agent state, poke and tickle, Ctrl-drag, and 72-480 px resize.'
  zh: '把 DSH 会话状态变成 Windows 桌面上的像素鲸娘：实时动作、戳脸/挠痒、Ctrl 拖动、72–480 px 缩放。'
```

Checklist before opening the PR:

- The GitHub repo is public, at least 24 hours old, and has the `dsh-plugin` topic.
- `package.json` declares `dsh.bundle.patch` and the repo contains `cordis.patch.yml`.
- A clean install works with `dsh plugin --profile desktop add github:GHSYES/dsh-whale-girl-pet`.
- The repo contains the files the code needs at runtime: `desktop/main.js`, `desktop/preload.js`, `assets/catalog.json`, and all 22 `assets/gifs/*.gif` files.
- Only `description.en` is required; keep the description factual and quote any value containing a colon followed by a space.
- Do not edit `README.md` or `README.zh.md` by hand — they are generated from the YAML files.

After merge, the website and dshmarket index usually refresh within about a day.