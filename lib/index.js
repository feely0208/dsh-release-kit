/**
 * dsh-release-kit —— 插件发布工具箱 · 内核
 * 只做「发布前的准备与检查」，绝不执行 npm publish（发布由人确认后手动/CI 执行）。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** 扫描目录下全部 dsh-* 插件包：版本 + pack 预检 + publish 命令 */
export function scan(root) {
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('dsh-') && existsSync(join(root, e.name, 'package.json')))
    .map((e) => join(root, e.name));
  const pkgs = dirs.map((dir) => {
    const name = dir.split('/').pop();
    let pkg = {};
    try { pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8')); } catch { /* 报告里标错误 */ }
    const pack = spawnSync('npm', ['pack', '--dry-run'], { cwd: dir, encoding: 'utf-8', timeout: 60_000 });
    const packOk = pack.status === 0;
    const files = (pack.stdout.match(/total files:\s*(\d+)/) || [])[1] || '?';
    return {
      dir: name, name: pkg.name || '(无 name)', version: pkg.version || '?',
      packOk, files, unpacked: (pack.stdout.match(/unpacked size:\s*([\d.]+\s*\w+B)/) || [])[1] || '?',
      isUpgrade: dir.includes('upgrades'),
      publishCmd: `cd ${dir.includes('upgrades') ? 'upgrades/' + name : name} && npm publish --access public`,
    };
  });
  return {
    pkgs,
    stats: { total: pkgs.length, packOk: pkgs.filter((p) => p.packOk).length, packFail: pkgs.filter((p) => !p.packOk).length },
  };
}

/** 生成发布命令清单（Markdown），按 isUpgrade 分组 */
export function commandsMd(scanResult, { registryNote = '发布由人工确认后执行；本工具只生成命令，绝不自动 publish' } = {}) {
  const fresh = scanResult.pkgs.filter((p) => !p.isUpgrade);
  const upgrades = scanResult.pkgs.filter((p) => p.isUpgrade);
  const L = ['# 发布命令清单', '', `> ${registryNote}`, '', '## 新插件', ''];
  for (const p of fresh) L.push(`- [ ] \`${p.publishCmd}\`   # ${p.name}@${p.version}（${p.files} files）`);
  if (upgrades.length) {
    L.push('', '## 已发布包升级', '');
    for (const p of upgrades) L.push(`- [ ] \`${p.publishCmd}\`   # ${p.name}@${p.version}`);
  }
  return L.join('\n') + '\n';
}

/** 版本号 bump（patch|minor|major），返回新版本 */
export function bumpVersion(dir, level = 'patch') {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) throw new Error(`${dir} 缺 package.json`);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const m = String(pkg.version || '0.0.0').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`版本号不是 semver：${pkg.version}`);
  let [maj, min, pat] = [+m[1], +m[2], +m[3]];
  if (level === 'major') { maj += 1; min = 0; pat = 0; }
  else if (level === 'minor') { min += 1; pat = 0; }
  else pat += 1;
  const next = `${maj}.${min}.${pat}`;
  pkg.version = next;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  return { from: pkg.version === next ? m[0] : m[0], old: m[0], next, name: pkg.name };
}

/** 追加变更说明到 CHANGELOG.md（骨架，人工润色） */
export function appendChangelog(dir, version, note) {
  const p = join(dir, 'CHANGELOG.md');
  const head = existsSync(p) ? readFileSync(p, 'utf-8') : '# Changelog\n';
  const entry = `\n## ${version}（${new Date().toISOString().slice(0, 10)}）\n\n- ${note || '（TODO：填写本版变更要点）'}\n`;
  writeFileSync(p, head.replace(/(# Changelog\n)/, '$1') + entry, 'utf-8');
  return p;
}

export { existsSync, readFileSync };

// ── DSH 插件接入（方案 A 薄壳：注册 skill 与 CLI 入口；业务逻辑仍在 lib/bin，不在此处）──
import { createPlugin, pkgRootFrom } from '@deepwhale-cn/dsh-guard-core/plugin';

export const { name, inject, apply } = createPlugin({
  name: 'release-kit',
  pkgRoot: pkgRootFrom(import.meta.url),
  skillFile: 'skill/release-kit.md',
  binFile: 'bin/cli.mjs',
  description: "插件目录的发布自动化准备：目录扫描与 pack 预检、版本号 bump、发布命令清单生成——只生成不执行 publish",
  whenToUse: "插件批次发布前的版本、打包与命令准备。用户会说：这批插件准备发布。",
});
