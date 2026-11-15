# @deepwhale-cn/dsh-release-kit

> **技能型插件 · 无面板**：安装后由 DSH 智能体按 skill 说明调用 CLI；无独立面板界面。

安装到 DSH：

```bash
dsh plugin --profile web add @deepwhale-cn/dsh-release-kit
```

插件发布工具箱：目录扫描与 npm pack 预检、版本号 bump（+CHANGELOG 骨架）、发布命令清单生成。**只生成，绝不自动 publish。**

```bash
npx @deepwhale-cn/dsh-release-kit scan --root <插件目录>
npx @deepwhale-cn/dsh-release-kit bump --dir <插件目录> --level minor --note "新增 X"
npx @deepwhale-cn/dsh-release-kit cmds --root <插件目录> --out 发布命令.md
```

退出码：scan 有 pack 失败 → 1（可挂 CI）。
