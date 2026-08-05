# Intent 登录方式管理 Demo

Intent 编辑资料页中手机号与邮箱增绑、换绑的交互演示。当前版本已按人工修改后的《账号登录方式绑定与换绑 PRD》对齐，包括：

- 增绑和换绑均先验证当前账号，再验证新方式；
- 当前账号有两种登录方式时可切换验证渠道；
- 验证码用途隔离，以及错误、过期、次数上限状态；
- 新手机号或邮箱已占用、发送失败、状态已变化等异常反馈；
- Gmail 邮箱换绑提交前的二次确认；
- 换绑成功后旧方式失效、其他设备重新登录；增绑不影响其他设备；
- 手机号换绑后的搜索结果说明。

## Demo 测试数据

- `123456`：验证成功
- `000000`：验证码错误
- `111111`：验证码过期
- `999999`：尝试次数达到上限
- `used@intent.chat`：新邮箱已被其他账号占用
- `fail@intent.chat`：验证码发送失败
- `stale@intent.chat`：登录方式已发生变化

手机号可分别使用以 `0000`、`9999`、`7777` 结尾的号码模拟以上三类业务异常。

## GitHub Pages 发布

本项目已包含 GitHub Pages 自动部署文件。

1. 将压缩包内的所有内容上传到仓库 `main` 分支根目录。
2. 进入仓库的 `Settings → Pages`。
3. 将 `Source` 设置为 `GitHub Actions`。
4. 打开 `Actions`，等待 `Deploy GitHub Pages` 运行成功。
5. 访问：

   `https://zhanghaonanmaxx-del.github.io/intent-login-methods-demo/`

首次发布通常需要等待几分钟。之后每次更新 `main` 分支，网页都会自动重新部署。

## 本地验证

需要 Node.js 22 或更高版本。

```bash
npm install
npm run build:pages
```

构建结果位于 `dist-pages`。

## 本地预览

```bash
npm run dev:pages
```
