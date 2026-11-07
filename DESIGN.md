---
name: 燕鹰网站公共页面
description: 现有 Nuxt/Vue 官网公共页面视觉规范；看板不适用。
colors:
  paper: "#f8f9fa"
  surface: "#fff"
  surface-soft: "#f1f3f5"
  ink: "#1e2b35"
  ink-soft: "#3e4d59"
  muted: "#5f6d78"
  line: "#d5dce2"
  editorial-accent: "#245f98"
  editorial-hover: "#16436e"
  dark-paper: "#15181b"
  dark-surface: "#1c2024"
  dark-surface-soft: "#23292e"
  dark-ink: "#f0f2f4"
  dark-ink-soft: "#c4cbd1"
  dark-muted: "#a0abb5"
  dark-line: "#3c454d"
  dark-editorial-accent: "#8bb9e7"
  dark-editorial-hover: "#b7d6f4"
  footer-background: "#112c43"
  dark-footer-background: "#0c1b28"
  footer-ink: "#eaf1f7"
  footer-muted: "#adbfcd"
  footer-rule: "#3b5367"
  dark-footer-rule: "#2e4354"
  hero-action: "#266cba"
  hero-action-hover: "#1d548e"
typography:
  display:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "clamp(48px, 5.2vw, 72px)"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-.025em"
  headline:
    fontSize: "clamp(36px, 4vw, 52px)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-.025em"
  title:
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-.025em"
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "16px"
    lineHeight: 1.85
  navigation:
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontSize: "14px"
rounded:
  flat: "0"
  control: "3px"
  portrait: "50%"
spacing:
  inline-small: "8px"
  inline: "12px"
  compact: "16px"
  mobile-gutter: "20px"
  regular: "24px"
  medium-gutter: "32px"
  section-gap: "40px"
  desktop-gutter: "48px"
  section: "56px"
  section-large: "64px"
  section-end: "80px"
components:
  button-primary:
    backgroundColor: "{colors.editorial-accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.editorial-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.editorial-accent}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-soft}"
  search-member:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  season-filter:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    padding: "9px 0"
  season-filter-selected:
    textColor: "{colors.editorial-accent}"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.navigation}"
    rounded: "{rounded.flat}"
    padding: "12px 0"
  member-row:
    backgroundColor: "transparent"
    rounded: "{rounded.flat}"
    padding: "24px 0"
---

# Design System: 燕鹰网站公共页面

## Overview

本文件记录 2026-11-07 已实现、经桌面与移动端审阅的公共页面样式，供官网维护使用。视觉语言以克制的蓝色、浅深中性色、清晰文字导航、真实影像与平面列表为主。未另行确定品牌隐喻或新的品牌定位；这里不补写产品受众或宣传主张。

范围是除 `/dashboard` 及其后代路由以外的公共页面。`app/app.vue` 通过 `editorial-shell` 和导航、页脚的 `refined` 分支隔离此系统；看板保留原系统。本文件不构成提交、推送或上线授权。事实内容、照片、队徽、栏目数据及真实链接沿用现有来源。

**Key Characteristics:**
- 通栏视频首页，标题和行动入口叠加在影像上。
- 蓝色用于链接、操作与当前状态；正文采用中性色。
- 列表和阅读页以细分隔线、字号与留白建立层次。
- 深浅主题共用语义色槽，头像始终为正圆。

来源以 `app/assets/css/editorial.css`、`editorial-chrome.css`、`editorial-pages.css` 为主，字体与容器取自 `base.css`、`tokens.css`，视频遮罩取自 `home.css`。用户确认的约束见 `docs/视觉规范.md`。

## Colors

前置色值是当前实现的语义色，不另设第二套调色板。深色模式由根节点 `data-theme="dark"` 切换同名 CSS 变量。

### Primary

- **公共链接蓝**：`editorial-accent` 用于文字链接、主要操作、导航当前项、赛季选中项、Wiki 阅读进度与头像条目的职务文字；`editorial-hover` 用于对应悬停。
- **深色链接浅蓝**：`dark-editorial-accent` 与 `dark-editorial-hover` 对应深色背景下的相同角色。
- **视频操作蓝**：`hero-action` 及其悬停色只用于首页视频上的主要行动入口。

### Neutral

- **纸面与表面**：`paper` 为页面底色，`surface` 为输入框等表面，`surface-soft` 为轻微状态底色与媒体占位；`dark-` 对应深色主题。
- **文字层级**：`ink` 为正文与标题，`ink-soft` 为说明，`muted` 为日期、标签与次要信息；`line` 为细分隔线。
- **深蓝页脚**：独立的 `footer-` 色组承载分栏导航、联系方式及备案信息；深色主题只替换页脚背景和分隔线槽位。
- 视频标题与操作使用白色，队徽默认头像保留白底，均不随页面主题反转。

**The Semantic Theme Rule.** 公共页面组件引用当前主题语义变量；不能把浅色主题的固定文字色直接用于深色页面。

## Typography

**Display Font / Body Font:** 同一无衬线系统栈，依次使用 Inter、平台 UI 字体、苹方与微软雅黑等中文回退。项目未为本次调整引入独立展示字体；实际显示取决于设备已安装字体。

### Hierarchy

- **Display**：首页视频大标题采用前置 `display`；移动端保留（48px）。
- **Headline**：普通公共页标题采用 `headline`；成员目录的标题行高为（1.2），文章标题另缩至（30–44px）。
- **Title**：普通分区标题采用 `title`；首页分区为（28–36px），移动端普通分区为（26px）。
- **Body**：新闻摘要、介绍与 Wiki 正文通常为（16px），行高（1.85）；长文正文行高可至（1.9）。
- **Navigation / Label**：桌面导航为（15px / 500），移动导航为（16px）；次要标签通常为（13–14px）。

标题字距轻收，标题启用平衡换行，段落启用更均匀的换行。成员数量、年份和赛季数字使用等宽数字特性。新闻阅读容器最大（860px）；不把首页大标题尺寸复制到阅读正文。

## Layout

公共内容共享居中容器，最大宽度（1160px）。桌面左右留白（48px），宽度不超过（1100px）时缩为（32px），不超过（620px）时缩为（20px）。页面正文和导航、页脚对齐同一边缘，首页视频背景例外，铺满可用宽度。

首页视频高度至少（620px）或扣除导航后的视口高度；移动端至少（640px）。文字覆盖层仍遵循内容容器。新闻与特色内容使用不对称图文网格，移动端转为单列；首页概览由四列转为两列。

成员列表桌面两列，教师分组单列；移动端全部单列。成员头像宽度随断点调整为（112 / 88 / 80px），但比例不变。成员详情头像为（220px），不超过（920px）时为（180px）。

导航桌面高（88px）；不超过（1100px）时为（76px）并切换菜单，不超过（620px）时为（72px）。窄屏菜单采用三列，手机两列；最窄（380px）布局减少字标间距与附属文字。页脚由四栏逐步收为两栏，身份区和联系方式在手机上通栏。

Wiki 在不超过（860px）时改用可展开侧栏及移动阅读入口。其他公共图文双栏在（920px）或（620px）断点归并；使用已有页面断点，不统一为任意的新断点。

## Elevation & Depth

公共页默认平面化：列表、卡片、正文和导航取消盒阴影，通过纸面、细线、字号与留白区分层次。按钮按下只下移（1px）；普通内容列表悬停不整体浮起。首页保留为文字可读性服务的双层视频遮罩，不能据此为其他区块补装饰渐变。移动菜单的深色遮罩用于隔离当前交互区域。

**The Flat Content Rule.** 阅读与目录以层级和分隔线组织，不新增嵌套阴影卡片。

## Shapes

正文容器与列表保持平直边缘。按钮、搜索框、代码块、部分图像与阅读导航使用轻微圆角（3px）。成员头像裁切为（1:1）且圆角（50%）；默认队徽同样必须是正圆，内部保留白底和留白。其他摄影按内容使用横向画幅，不套用头像规则。

## Components

### Buttons

主要与次要操作共用轻圆角、最小高度（48px）、内边距（12px 20px）。主要操作使用主题蓝底，次要操作透明底与蓝色细边；悬停分别加深蓝色或填入轻表面色。深色主题主要操作使用深色文字以维持对比。首页视频上的按钮单独使用视频操作蓝与白字，次要按钮使用白色描边。

键盘聚焦采用主题蓝的（2px）轮廓并外移（5px）；视频上改为白色轮廓。按钮按下下移（1px）。常见状态过渡为（180ms ease-out）。

### Filters / Tags

成员赛季筛选是文字按钮，最小高度（44px）。选中项通过蓝色、字重（600）和底部（2px）线条表达，使用 `aria-pressed`。成员资料标签多为无底色的文字信息，不新增胶囊底色。目录默认赛季为 2027，保留全部赛季、关键词、身份、组别及职务筛选。

### Cards / Containers

成员、新闻、成果、Wiki 与联系条目主要采用透明底和平面细分隔线。成员条目包含圆头像、姓名、职务、资料字段及真实外链。姓名悬停转蓝并加下划线，头像或摄影最多轻放大（1.025），不移动整个条目。

### Inputs / Fields

成员搜索框使用表面底、（1px）细边、最小高度（44px）、内边距（10px 12px）。Wiki 搜索沿用最小高度（50px）与内边距（10px 14px），圆角统一为轻圆角。占位符使用次要文字色；聚焦采用主题强调色轮廓，Wiki 搜索不增加阴影。筛选下拉框保留原生选择交互。

### Navigation

桌面导航以中文文字为主，不使用胶囊分组；当前项与悬停为蓝色细下划线。中文队名字标与学校、学院附属信息保持现有层级；主题切换采用线描太阳和月亮。移动菜单支持遮罩关闭、Esc 关闭、焦点循环及关闭后的焦点返回；路由变化收起菜单。

页脚为深蓝分栏，以「战队」「学习与协作」「保持联系」组织现有真实链接，并保留邮箱、社交平台、版权及备案入口。页脚链接悬停加下划线，不增加无来源链接或宣传语。

### Homepage Video

首页使用原有通栏背景视频，自动播放、静音、循环；标题、介绍、按钮和社交链接叠加其上。按用户明确要求不显示播放或暂停按钮，不能改成窄幅左右分栏。系统减少动态偏好会关闭公共页的动画与过渡，并使背景视频在当前画面暂停；恢复该偏好后继续自动播放，不增加页面上的播放或暂停控件。

## Do's and Don'ts

### Do:

- **Do** 保持公共页面与看板的样式边界，看板继续使用原有导航、页脚和视觉。
- **Do** 使用当前主题的语义色与清晰的键盘聚焦状态。
- **Do** 保留真实影像、队徽、内容源与链接，修改视觉时同时保留功能。
- **Do** 让默认队徽和人物照片都保持 1:1 正圆。
- **Do** 在桌面、手机与深浅主题中核对内容换行和导航可用性。

### Don't:

- **Don't** 将首页视频改为窄幅左右分栏，或添加播放、暂停按钮。
- **Don't** 把成员头像改成矩形、椭圆，或裁掉默认队徽。
- **Don't** 把平面内容列表重新包进多层渐变、阴影和装饰卡片。
- **Don't** 将本文件当作品牌重做、看板改版或上线许可。
