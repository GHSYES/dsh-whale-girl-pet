# 鲸娘桌宠 · dsh-whale-girl-pet

把 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）的会话状态，变成一只真正浮在 Windows 桌面上的像素鲸娘。

A pixel whale-girl desktop pet for DSH on Windows — live agent status, poke, drag and resize.

![鲸娘桌宠](preview.png)

## 它会做什么

- **只显示在电脑桌面上**：独立 Electron 透明置顶窗口，无边框、不占任务栏；DSH 页面里不会再浮一层。
- **实时跟随会话状态**：监听 DSH 的会话、子代理、工具调用、审批与归档事件，自动切换 22 个动作。
- **可以戳、可以拎、可以缩放**：单击左右脸挨戳，1 秒内连点 3 下挠痒，按住 Ctrl 拖动搬家；右键原生菜单可放大、缩小、恢复默认大小或收起。
- **任务完成会一直提醒**：主会话正常结束或工作台验收通过后，「任务完成」会循环播放，直到你单击一次桌宠；单击后播「举大拇指」，再回到正常待机。
- **设置里有交互面板**：DSH 设置 → 鲸娘桌宠，可开关桌面显示、调大小（72–480px）、不透明度、点击穿透、待机轮换，并预览全部动作。
- **位置和大小会记住**：窗口位置、尺寸写入 `%DSH_HOME%\whale-pet\desktop\window-state.json`，下次原地复原。

## 动作与触发

状态按优先级推导，高优先级会盖住低优先级：

```text
预览 > 互动反应 > 等待确认 > 出错 > 上下文清理 > 抱书搬运 > 小鲸鱼分身（≥2 子代理）
> 施工中（≥3 会话有工具）> 听歌（2）> 敲代码（1）> 思考（回合未结束）
> 任务完成（循环，点击确认）> 呼呼大睡（60 秒无事件）> 待机池（每 30 秒轮换）
```

待机池包含：待机眨眼、东张西望、开心喷水、游来游去、戴耳机听歌、小鲸鱼分身、施工中。

归档会话时会播一次「上下文清理」。接入了 `@dely0/dsh-personal-workbench` 时，任务验收通过（变成 done）也会进入「任务完成」循环。

## 安装

### 1. 准备素材

本仓库**不附带角色 GIF**（版权归原作者，见下方「素材与授权」）。请把 22 张 GIF 放到：

```text
%DSH_HOME%\pets\whale-girl-emoji\
  catalog.json        # 可选；没有就按内置文件名查找
  gifs\
    01-idle.gif
    02-idle-look.gif
    ...
    22-thumbs-up.gif
```

完整文件名、动作含义和 `catalog.json` 格式见 [docs/ASSETS.md](docs/ASSETS.md)。

`%DSH_HOME%` 默认是 `C:\Users\<你的用户名>\.dsh`。

### 2. 安装插件

把仓库克隆进桌面 profile 的 `node_modules`（目录名必须是 `dsh-whale-pet`，与包名一致）：

```bash
git clone https://github.com/GHSYES/dsh-whale-girl-pet.git "%DSH_HOME%\profiles\desktop\node_modules\dsh-whale-pet"
```

编辑 `%DSH_HOME%\profiles\desktop\package.json`：

```json
{
  "dependencies": {
    "dsh-whale-pet": "file:C:/Users/<你的用户名>/.dsh/profiles/desktop/node_modules/dsh-whale-pet"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "...",
        "dsh-whale-pet"
      ]
    }
  }
}
```

### 3. 准备 Electron 运行时

桌面窗需要独立的 Electron。插件按顺序查找：

1. 环境变量 `WHALE_PET_ELECTRON` 指向的 `electron.exe`
2. `%DSH_HOME%\dsh-orb\electron-runtime\electron.exe`（安装了 [dsh-orb](https://www.npmjs.com/package/dsh-orb) 就有）
3. `%DSH_HOME%\pets\.runtime\electron.exe`

最省事的是安装 `dsh-orb`，或者自己下一份 Electron 并把 `WHALE_PET_ELECTRON` 指过去。

### 4. 重启 DSH Desktop

宿主代码只在启动时加载。重启后桌宠会自动出现在桌面右下角；不想看就在设置里取消「显示在桌面上」。

## 设置面板

DSH 设置 → 鲸娘桌宠：

| 项目 | 说明 |
| --- | --- |
| 显示在桌面上 | 勾选后启动透明置顶桌面窗；取消后收起来 |
| 大小 | 72–480px，拖动即时生效 |
| 不透明度 | 20%–100% |
| 点击穿透 | 开启后鼠标事件透传给下层窗口，只能从设置里关掉 |
| 待机轮换 | 安静时是否轮播待机池；关闭后停在「待机眨眼」 |
| 状态预览 | 22 个动作各点一下，桌宠立刻预览 3 秒 |

## 路由

插件挂在 DSH Web 服务的 `/whale-pet` 前缀下：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/state` | 当前动作、GIF 地址、设置、会话统计 |
| GET | `/api/catalog` | 素材清单与 Electron 就绪状态 |
| POST | `/api/hello` | 前端上报 origin；端口变化时桌面窗会自动重启 |
| GET/POST | `/api/settings` | 读取 / 合并写入设置 |
| POST | `/api/interaction` | 戳脸、挠痒、拖动、确认任务完成 |
| POST | `/api/desktop` | 显示 / 收起桌面窗 |
| POST | `/api/preview` | 强制预览某个动作 3 秒 |
| GET | `/standalone` | 桌面窗加载的透明页 |
| GET | `/standalone.js` | 桌面窗交互脚本 |
| GET | `/assets/<file.gif>` | 只发送素材库 `gifs/` 下的文件 |

## 实现要点

- `index.js`：ESM 宿主插件。状态机 + HTTP 路由 + Electron 进程管理；用 `ctx.inject(['webServer'], ...)` 挂路由，用 `webServer.getOrigin()` 校正端口；每 10 秒自愈一次桌面窗，宿主退出时收掉子进程。
- `client.js`：只负责设置分区，不渲染页内悬浮层。
- `desktop/main.js`：透明、无边框、置顶、跳过任务栏、单实例锁；处理移动/缩放和原生右键菜单。
- `standalone.js`：桌面页的显示与交互。Ctrl+拖动移动窗口，普通单击戳脸，右键请求原生菜单。
- `desktop/preload.js`：通过 `contextBridge` 暴露最小 IPC 面。

## 常见问题

**桌面什么都没有？**

先看 `%DSH_HOME%\whale-pet\desktop.log` 和 `spawn.log`。最常见的是没找到 Electron（装 `dsh-orb` 或设置 `WHALE_PET_ELECTRON`），其次是 DSH 端口变了导致桌面窗加载旧地址（插件会自动重启，必要时在设置里取消再勾选一次）。

**桌宠是空白 / 不显示图片？**

素材没放对。确认 `%DSH_HOME%\pets\whale-girl-emoji\gifs\` 下有 22 张 GIF，文件名见 [docs/ASSETS.md](docs/ASSETS.md)。

**改了代码不生效？**

改 `index.js` 或 `desktop/*` 要重启 DSH Desktop；只改 `standalone.js` 重启桌宠窗口即可；改 `client.js` 刷新页面。

## 素材与授权

- **代码**以 MIT 许可证开源，见 [LICENSE](LICENSE)。
- **角色 GIF 不随仓库分发**。它们来自「鲸娘像素表情集」：<https://dshtui.com/pets/whale-girl-emoji/>，版权归原作者所有；请自行确认使用与再分发权限。
- README 中的截图仅用于展示插件效果，截图内的角色形象同样归原作者。
- DSH 插件 API 归 DeepSeek Harness 项目所有。

## 开发

仓库就是可直接加载的插件目录，没有构建步骤：

```bash
node --check index.js
node --check client.js
node --check standalone.js
node --check desktop/main.js
```

欢迎提 Issue / PR，尤其是其他桌面环境的适配和素材库格式的改进。
