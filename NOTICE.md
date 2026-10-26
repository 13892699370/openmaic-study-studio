# NOTICE — 来源声明与修改说明

本项目（Study studio）是基于开源项目的二次开发作品。按 MIT License 的要求，在此声明上游来源、许可证与本项目的修改范围。

---

## 一、上游项目

| 项目 | 内容 |
|---|---|
| 名称 | OpenMAIC（Open Multi-Agent Interactive Classroom） |
| 地址 | https://github.com/THU-MAIC/OpenMAIC |
| 版权 | Copyright (c) THU-MAIC |
| 许可证 | MIT License |
| 采用版本 | v1.3.0-rc.1 |
| 学术引用 | THU-MAIC, *OpenMAIC: Open Multi-Agent Interactive Classroom*, Journal of Computer Science and Technology (JCST), 2026 |

MIT 许可证全文保留于本仓库根目录 [LICENSE](./LICENSE)，未做任何修改。该版权声明与许可声明适用于本项目的全部副本与实质性部分，不得移除。

---

## 二、本项目保留使用上游的部分

以下模块来自上游，本项目未做功能性改动：

- 课堂生成流水线（大纲 → 场景内容 → 分镜动作 → 讲稿 → 语音合成）
- 多智能体课堂运行时（AI 教师与 AI 同学的对话编排、Agent 循环）
- 场景渲染器（幻灯片、测验、交互式模拟、PBL）与深度交互组件
- 内部工作区包：`@openmaic/dsl`、`@openmaic/editor`、`@openmaic/generation`、`@openmaic/renderer`、`@openmaic/storage`、`@openmaic/geometry`、`@openmaic/importer`
- 服务端持久化层（PostgreSQL 存储、所有权与访问控制）
- 课堂导出能力（PPTX / 离线 HTML / MP4）
- 国际化框架与语种资源
- UI 组件库与设计系统

内部工作区包名沿用上游的 `@openmaic/*` 命名，**刻意未做重命名**：重命名会破坏 pnpm workspace 的构建契约，也会使来源归属变得不可追溯。保留原名是出于技术必要性与合规透明，不代表本项目自称为 OpenMAIC 官方发行版。

---

## 三、本项目修改的部分

| 范围 | 修改内容 |
|---|---|
| 品牌标识 | 产品名称改为 Study studio；站点标题、页脚、Logo、favicon、应用图标 |
| 界面文案 | 12 个语种语言包中的品牌名词；时间轴空态提示中的智能体名称改为通用表述 |
| 首页 | 重构为视频背景 Hero 版式；精简入口（移除语言/主题切换、问候条、导入课堂、新建文件夹等非核心入口） |
| 课堂页 | 精简顶部控件（移除语言/主题切换）；左下角 Logo 改为文字标识；移除课堂主界面的语音输入入口（语音能力本身保留） |
| 设置面板 | 移除 Token Plan 与通用设置分区，保留模型服务、课程模型配置、技能 |
| 导出 | 视频封面默认跳转地址由上游站点改为本项目标识 |

以上修改不改变上游功能语义，仅涉及呈现层与入口层。

---

## 四、本项目新增的部分

> 说明：本节按实际开发进度更新。

**已完成**

- `components/hero/study-studio-hero.tsx` — 首页视频背景 Hero 组件（独立实现）
- 品牌配置与图标资源（`lib/brand/brand-config.ts`、`public/logo-horizontal.png`、`app/favicon.ico`、`app/apple-icon.png`）

**开发中**

- 课后学情诊断智能体：逐题错因分析、知识点掌握度、个性化复习路径、补救微课生成
- 计划新增文件：`lib/classroom/learning-diagnosis.ts`、`app/api/learning-diagnosis/route.ts`、`components/scene-renderers/learning-diagnosis.tsx`

---

## 五、第三方资源

| 资源 | 许可证 / 来源 |
|---|---|
| Next.js、React、Tailwind CSS | MIT / Apache-2.0 |
| PPTist 幻灯片数据结构 | AGPL-3.0（经上游引入，本项目未修改其源代码） |
| Lucide 图标 | ISC |
| motion | MIT |
| 字体（Noto Sans 系列） | SIL Open Font License 1.1 |
| 首页装饰视频 | 由项目作者提供/自制，不来自上游 |

如对上述声明有疑问，可对照 LICENSE 与 git 提交历史核实修改范围。

---

最后更新：2026-10-23
