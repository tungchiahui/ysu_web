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

`dev`、`build`、`generate` 会先拉取内容；生产构建随后运行 Wiki 检查。生成的静态网站位于 `.output/public`，`dist` 是指向此目录的便捷链接。

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

## 持续构建

`.github/workflows/build.yml` 在网站代码更新或手动触发时拉取内容、检查 Wiki、生成并上传静态产物，暂不部署到线上。

可选仓库变量 `CONTENT_REPOSITORY`、`CONTENT_REF` 与同名环境变量含义一致；私有仓库配置 Secret `CONTENT_GIT_TOKEN`。内容仓库提供可选的跨仓库触发工作流，配置方式见内容仓库 README。没有配置触发凭据时，可手动运行本仓库的 Build 工作流。

## 当前资料状态

已更新燕鹰名称、机械工程学院归属、简介和用户指定的微博头像。现有成员、Wiki、新闻、成绩、轮播、配图及招新联系方式均保留作模板；原文、作者和外链不作替换。页面上的资料迁移说明由内容仓库 `data/site.json` 的 `templateMode` 控制，待正式资料替换完成后再关闭。

简介来源见内容仓库 `sources.md`。原域名备案与统计配置暂作为模板保存，上线新域名前须在 `data/site.json` 配置对应站点信息。
