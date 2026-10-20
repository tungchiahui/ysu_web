# 燕鹰战队官网

Nuxt 4 + Nuxt Content。网站程序与战队资料分仓维护。

- 网站代码：本仓库。
- 内容仓库：默认 `https://github.com/tungchiahui/ysu_content`，由 `content-source.json` 配置，可改名、换账号或迁移至其他 Git 服务。

## 本地开发与构建

需要 Node.js 22.13 或以上版本。

```sh
npm ci
npm run dev
```

`dev`、`build`、`generate` 会先拉取内容；开发及生产构建先校验成员资料，生产构建再运行 Wiki 检查。本地生成的静态网站位于 `.output/public`，`dist` 是指向此目录的便捷链接。EO 的 Nuxt 适配器可能将实际输出目录改为 `.edgeone/assets`；Wiki 产物检查会读取 Nitro 最终的输出目录，不固定检查本地路径。

```sh
npm run generate
npm run preview
```

构建前必须能访问内容仓库。同步失败时构建停止，保留上次可用快照；不会悄悄发布旧内容。内容版本记录在 `.content-data/source.json`。

## 修改内容

请在内容仓库修改 Markdown、图片和 `data/*.json`。网站中的 `content/`、`public/`、`.content-data/` 都是自动生成的镜像，不提交到本仓库。同步会完整替换它们，因此请勿在这些镜像目录中直接维护资料。

本地同时维护两个仓库时，在本仓库创建 `.env`：

```dotenv
CONTENT_LOCAL_PATH=../ysu_content
```

此时使用内容仓库的本地工作文件，无需先提交或推送。修改资料后运行 `npm run content:sync`，开发服务器会读取同步后的文件。

## 更换内容仓库或固定版本

修改 `content-source.json` 的 `repository` 和 `ref` 即可。也可使用环境变量覆盖：

```dotenv
CONTENT_REPOSITORY=https://github.com/your-org/new-content.git
CONTENT_REF=main
```

`CONTENT_REF` 支持分支、标签或完整提交 SHA。发布时固定 SHA 可使网站与内容版本对应，便于回退。

## 私有内容仓库

网站逻辑无需修改，只需为构建环境增加读取凭据：

- HTTPS：在本地 `.env` 或 CI Secret 设置 `CONTENT_GIT_TOKEN`，使用仅对内容仓库具有 Contents 读取权限的 token。凭据通过临时 Git askpass 传入，不写进仓库地址或构建产物。
- SSH：将仓库地址改为 SSH 地址，并在构建环境配置对该内容仓库有只读权限的部署密钥。

GitHub Actions 自带的 `GITHUB_TOKEN` 通常只授权当前仓库，读取另一个私有仓库需额外配置凭据。私有仓库只保护源文件的访问；最终渲染到公开网站的资料仍公开可见。

## 部署到 EdgeOne Pages / Makers

本项目采用静态生成，仓库根目录的 `edgeone.json` 已配置构建命令 `npm run generate`、安装命令 `npm ci`、输出目录 `.output/public` 和 Node.js `22.17.1`。

在控制台导入 `tungchiahui/ysu_web`，生产分支选 `main`，根目录 `./`，框架预设选其他（Other），按静态网站部署。界面中的构建、安装和输出目录与上述配置保持一致。Node 版本由仓库配置指定，无需再设置环境变量。

公开内容仓库默认从 `content-source.json` 读取，不需要额外凭据，也不要在 EO 设置 `CONTENT_LOCAL_PATH`。如果以后迁移内容仓库，可改配置文件或设置 `CONTENT_REPOSITORY` / `CONTENT_REF`；改为私有时再配置只读 `CONTENT_GIT_TOKEN`。

首次部署前刷新仓库选择，确保使用包含本次改造和 `edgeone.json` 的最新 `main` 提交。部署成功后先验证首页、Wiki、成员页面和视频，再绑定自定义域名。

网站仓库 `main` 提交会触发 EO 的 Git 集成部署。内容仓库每次 push 到 `main`，由其 `notify-website.yml` 调用同一个 EO 项目的部署钩子；需在内容仓库配置 Repository Secret `EO_DEPLOY_HOOK_URL`，钩子目标为本仓库的 `main`。EO 构建时拉取内容仓库最新的 `main`，不要把 `CONTENT_REF` 固定为旧提交。本仓库的 Build 工作流只生成产物。

## 持续构建

`.github/workflows/build.yml` 在网站代码更新或手动触发时拉取内容、检查 Wiki、生成并上传静态产物，暂不部署到线上。

可选仓库变量 `CONTENT_REPOSITORY`、`CONTENT_REF` 与同名环境变量含义一致；私有仓库配置 Secret `CONTENT_GIT_TOKEN`。内容仓库通过 EO 部署钩子触发线上发布，配置方式见内容仓库 README，不需要跨仓库 Actions 写入 token。触发工作流成功仅表示 EO 接受部署请求，实际发布结果在 EO 控制台查看。

## 视觉设计

2026-10-20 按用户要求，布局与视觉风格均恢复至改版前版本，配色、字体、字重、阴影、渐变与响应式样式保持原样。保留 Wiki 展开列表的首页入口及简洁成果展示，维护约定见 [视觉规范](docs/视觉规范.md)。

## 新闻资料

新闻 frontmatter 仅写 `title` 与 `authors`（姓名列表，空作者用 `[]`）。日期从 `YYYY-MM-DD-短标题.md` 文件名生成，列表封面取正文首张图片，摘要取正文首段。原有页面布局与风格不变；详细约定见内容仓库 `docs/新闻资料规范.md`。开发和构建执行 `news:check`，辅助回归命令为 `npm run news:test`。

## 当前资料状态

已更新燕鹰名称、机械工程学院归属、简介和用户指定的微博头像。新闻已替换为 5 篇燕鹰战队新闻与公告，成果页展示简洁的 RoboMaster 历年获奖记录，出处保留在内容仓库供维护；招新群、报名表及邮箱、微信、地址已按燕鹰战队资料更新。成员档案为学生董佳辉与指导老师韩博，原站三位老师已删除；学生按赛季记录组别和职务，指导老师单独定义字段。首页轮播、栏目横幅及招新/联系配图已换为用户提供的战队照片。Wiki 已按用户指定的 `tungchiahui_content/content/wiki/` 工作目录整体更新，旧版独有文档已删除，不保留归档。随后按要求移除 OpenCV、Flutter、Nuxt.js、OpenWrt、ROS1 五套独立教程，当前保留 271 篇 Wiki。新闻和成果页均展示燕鹰资料，原站两篇新闻模板及其排球赛配图已删除；首页来源链接与顶部迁移提示已移除。

简介来源见内容仓库 `sources.md`。原域名备案与统计配置暂作为模板保存，上线新域名前须在 `data/site.json` 配置对应站点信息。

Wiki 的相对 Markdown 章节链接会在解析时转换为网站拼音地址，旧 `/zh-cn/wiki/` 前缀统一为 `/wiki/`；本地源码路径显示为文件标签，不会作为站内页面访问。上述适配只影响显示，不修改同步来的文档原文。

## 人员资料规范

人员字段与校验规则见 `docs/成员资料规范.md`；规范原文及填写模板维护于内容仓库的同名文档和 `member-submission-kit/`。学生组别限定为机械组、电控组、硬件组、算法组、运营组，职务限定为队长、副队长、组长、项管、成员。没有顾问或梯队字段。

同步内容后可执行 `npm run members:check`，字段与跨赛季筛选回归检查使用 `npm run members:test`；开发、构建和静态生成会自动执行此检查。任职历史按 `seasons` 记录，不混用入学年级与赛季。学生与指导老师都不使用学校字段 `university`；页面赛季值显示 `2027`，顶部筛选显示 `27赛季`，原始年份继续保存四位整数。

学生与指导老师均须填写至少一条赛季记录。当前资料和填写示例只写 `year: 2027`，教师赛季不再留空；填写教程、教师模板及运营组示例见内容仓库 `member-submission-kit/`。

## Wiki 作者

Wiki 的手写 frontmatter 使用 `title` 和可选姓名列表 `authors`，完整格式见 `docs/Wiki资料规范.md`。作者头像和姓名显示在文章标题下，有成员档案时可点击进入对应详情，没有成员档案时进入展示署名文章的作者页；章节未填写作者时继承教程首页，显式 `authors: []` 则不展示作者。Wiki 目录展开后首先显示“首页”入口，跳转到教程的 `index.md`；界面以教程标题显示，不使用文件名。路径、章节编号和目录日期继续自动生成。

`npm run wiki:check` 同时检查作者格式和原有章节/链接；`npm run wiki:test` 验证作者继承、覆盖和错误输入。
