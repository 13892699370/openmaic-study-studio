# Study studio

面向课堂教学的 AI 互动课堂与学习诊断系统。输入一个主题或上传教学材料，系统自动生成一堂包含讲解、测验、交互实验与项目任务的完整课程，并由 AI 教师与 AI 同学进行语音讲解和实时讨论；课后基于学生的答题记录生成学情诊断与个性化复习路径。

> 本项目基于开源项目 [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC)（MIT License，Copyright (c) THU-MAIC）二次开发，修改与新增内容见 [NOTICE](./NOTICE)。上游能力与本项目的差异在 NOTICE 中逐项列明。

---

## 功能

**课堂生成**
- 给一个主题或上传 PDF/PPTX/Word，自动生成完整课程（大纲 → 场景内容 → 讲稿 → 分镜动作）
- 场景类型：幻灯片、测验、交互式模拟、项目制学习（PBL）
- 生成在服务端运行，关闭页面或重启服务不中断

**多智能体授课**
- AI 教师与多个 AI 同学围绕同一堂课实时讨论，可语音讲解、白板绘图
- 课堂对话为 Agent 循环：可针对幻灯片元素、交互组件、白板内容提问
- 支持建议回复、沉浸模式

**深度交互**
- 3D 可视化、模拟实验、小游戏、思维导图、在线编程五种交互界面
- 学生可调整参数、观察变化，而非被动观看

**测验与导出**
- 单选/多选/简答题，简答题由 LLM 评分并给出评语
- 课堂可导出为保留全部场景的 `.pptx`、可离线播放的单个 `.html`、或 MP4 视频

**课后诊断**（本项目新增，开发中）
- 逐题错因分析、知识点掌握度、个性化复习路径、补救微课生成

---

## 快速开始

### 环境要求

| 组件 | 版本 |
|---|---|
| Node.js | ≥ 22.19.0 |
| pnpm | 10.x |
| PostgreSQL | 16（服务端持久化必需） |

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置

```bash
cp .env.example .env.local
```

在 `.env.local` 中至少填写：

```bash
# 课程数据存储
DATABASE_URL=postgres://user:password@127.0.0.1:5432/study_studio

# 模型服务（示例为阿里云百炼）
QWEN_API_KEY=sk-xxxxxxxx

# 单机单用户模式（个人演示用）
OWNER_SINGLE_USER=true
```

模型与语音、配图等能力在 `openmaic.yml` 中统一声明（provider 白名单 + 槽位绑定）。若该文件存在，模型授权只认其中的 `providers` 与 `slots`，不读取环境变量里的模型清单。

### 3. 启动数据库

```bash
pnpm db:up      # 使用 docker-compose.db.yml 启动 PostgreSQL
```

或使用本机已安装的 PostgreSQL 16，创建库后直接填写 `DATABASE_URL`。首次启动会自动建表。

### 4. 启动

```bash
pnpm dev        # 开发模式
```

生产模式：

```bash
pnpm build
pnpm start
```

默认监听 `http://localhost:3000`。

### 5. 共享部署（可选）

若要提供给他人访问，请在 `.env.local` 设置 `ACCESS_CODE`，否则任何拿到地址的人都能访问你的课程库。

---

## 运行说明（Windows 免安装 PostgreSQL，已实测）

适合没有 Docker 的环境：

1. 下载 PostgreSQL 16 免安装包，**解压到纯 ASCII 路径**（如 `C:\pg`）。中文路径会导致 `initdb` 报 `invalid byte sequence for encoding "UTF8"`。
2. `initdb -D C:\pg\data -U <user> -A trust`，然后 `pg_ctl -D C:\pg\data -o "-p 5432" start`。
3. 创建数据库，使其与 `.env.local` 中的 `DATABASE_URL` 对应。
4. `pnpm install && pnpm build && pnpm start`。
5. 首次生成课程后，确认 `/api/health` 返回 200。

> 注意：若修改了 `.env.local` 或 `openmaic.yml`，必须重启服务——配置只在进程启动时读取一次。

---

## 项目结构

```
app/            页面与 API 路由（Next.js App Router）
components/     UI 组件（课堂渲染器、编辑区、工作台）
lib/            领域逻辑：生成流水线、智能体运行时、测验判分、持久化、i18n
packages/       内部工作区包（DSL、渲染器、编辑器、生成器、存储）
skills/         内置智能体技能（教学法、课程标准、DSL 编写等）
tests/          单元与集成测试
e2e/            Playwright 端到端测试
```

技术栈：Next.js 16（App Router）、React 19、TypeScript 5、Tailwind CSS 4、PostgreSQL。

---

## 开源致谢

本项目的课堂生成引擎、场景渲染、智能体运行时与 UI 组件库来自开源项目 **OpenMAIC**：

- 项目地址：https://github.com/THU-MAIC/OpenMAIC
- 许可证：MIT License，Copyright (c) THU-MAIC
- 引用：THU-MAIC, OpenMAIC: Open Multi-Agent Interactive Classroom, JCST'26

按 MIT 协议要求，原始版权声明与许可证全文保留在 [LICENSE](./LICENSE) 中，不得移除。本项目的修改范围与新增模块见 [NOTICE](./NOTICE)。

内部工作区包名（`@openmaic/*`）沿用上游命名，未做重命名——重命名会破坏工作区构建，也会丢失来源归属。

---

## 许可证

MIT。详见 [LICENSE](./LICENSE)。
