# Bug / 工程异常记录

> 所有会影响推进、质量、节奏或判断的异常都要记录，包括代码、环境、依赖、测试、打包和设计误判。

## 2026-05-21: worktree 删除被预览 EXE 占用

- 症状：`git worktree remove C:\Users\m1591\.config\superpowers\worktrees\Add-WhatsApp\codex-risk-workbench-warning` 解除 Git 登记后，Windows 删除目录失败，提示 `dist\Add WhatsApp 0.1.2.exe` 正在被另一个进程使用。
- 根因：之前打开的 worktree 预览 EXE 进程仍在运行，导致 `dist` 目录无法递归删除。
- 处理：确认占用进程为 `Add WhatsApp 0.1.2`，PID `18388`；停止该进程后，安全校验目标路径位于 worktree 根目录下，再删除残留目录。
- 预防：以后删除构建过 EXE 的 worktree 前，先关闭对应预览窗口或检查该 worktree `dist` 下的 EXE 是否仍在运行。
