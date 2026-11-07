# Third-party notices

This repository contains two different kinds of material.

## Code

All source code in this repository is licensed under the MIT License; see
[LICENSE](LICENSE). Copyright (c) 2026 GHSYES.

## Pixel art (the 22 whale-girl GIFs in `assets/gifs/`)

The animation frames are **not** MIT. They come from the pixel whale-girl set
published by lhh010 and are redistributed here under the BSD 3-Clause License.

- Original project: [lhh010/dsh-ui-whale](https://github.com/lhh010/dsh-ui-whale) — a whale-pet plugin for the DSH web UI by @lhh010.
- Asset page this set was collected from: [鲸娘像素表情集 — dshtui.com](https://dshtui.com/pets/whale-girl-emoji/)
- Acknowledgement chain: [ccch1mneyyy/dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI) credits the 22 hand-drawn frames and the idle behaviour to lhh010/dsh-ui-whale under BSD-3-Clause.

```text
BSD 3-Clause License

Copyright (c) 2026, lhh010
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

If you redistribute this plugin or a fork, keep this file and the BSD notice
with the GIFs. The MIT license on the code does not replace the art license.

## Electron runtime

The plugin can download an official Electron 44.0.0 win32-x64 runtime from
`electron/electron` releases (or the npmmirror binary mirror) on first use.
Electron is licensed under the MIT License; its full license ships inside the
downloaded runtime. The download is pinned by SHA-256:

```
e61aa3bcea8152bc0730abd015e47c032d778a0ef10e2a1c78ba3c4ea47942f9
```

## Inspiration and reference

- The status-to-animation mapping and idle behaviour were inspired by the
  Clawd-on-Desk-style hooks described on the asset page.
- The runtime download approach follows [dsh-orb](https://github.com/mini-yifan/dsh-orb) (MIT).
- Desktop window mechanics follow standard Electron transparent-window practice.
