# 插件发布工具箱（dsh-release-kit）

**什么时候用**：一批插件写完要发布时；日常升版本时。
用户会说：「这批插件都打包正常吗」「帮我 bump 版本」「发布命令列一下」。

## 怎么用

```bash
<cli 路径> scan  --root <插件目录>                # 版本 + npm pack 预检（不产出 tarball）
<cli 路径> cmds  --root <插件目录> --out 发布命令.md   # 生成 Markdown 发布清单
<cli 路径> bump  --dir <插件目录> [--level patch] [--note 变更要点]   # 版本号 + CHANGELOG 骨架
```

## 设计红线

**绝不执行 npm publish**——只生成命令与检查结果，发布由人工确认后执行。
