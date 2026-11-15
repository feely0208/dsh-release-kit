#!/usr/bin/env node
/**
 * dsh-release-kit —— 插件发布工具箱（只准备、不执行 publish）
 *
 * 用法：
 *   dsh-release-kit scan  --root <插件目录> [--json]              # 版本 + pack 预检 + 发布命令
 *   dsh-release-kit cmds  --root <插件目录> [--out 发布命令.md]    # 生成发布命令清单（Markdown）
 *   dsh-release-kit bump  --dir <插件目录> [--level patch|minor|major] [--note 变更要点]
 *
 * 设计红线：本工具**绝不执行 npm publish**——发布由人工确认后手动/CI 执行。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { scan, commandsMd, bumpVersion, appendChangelog } from '../lib/index.js';

const args = process.argv.slice(2);
const cmd = args[0];
const has = (k) => args.includes('--' + k);
const val = (k, d = '') => {
  const i = args.indexOf('--' + k);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

if (!cmd || has('help')) {
  console.log(`dsh-release-kit —— 插件发布工具箱（只生成，不执行 publish）

用法：
  scan  --root <插件目录> [--json]                 # 版本 + pack 预检 + 发布命令
  cmds  --root <插件目录> [--out 发布命令.md]       # 生成 Markdown 发布清单
  bump  --dir <插件目录> [--level patch] [--note 要点]  # 版本号 + CHANGELOG 骨架`);
  process.exit(0);
}

if (cmd === 'scan') {
  const r = scan(resolve(val('root', process.cwd())));
  if (has('json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  console.log(`\n  深鲸 · 发布预检 —— ${r.stats.total} 个插件\n  ${'─'.repeat(64)}`);
  for (const p of r.pkgs) {
    console.log(`  ${p.packOk ? '✅' : '❌'} ${p.dir}  ${p.name}@${p.version}  ${p.files} files / ${p.unpacked}`);
  }
  console.log(`\n  pack 通过 ${r.stats.packOk}/${r.stats.total}${r.stats.packFail ? ' —— 失败包先修 files 白名单再发布' : ''}`);
  console.log('  本工具绝不自动执行 publish；命令见 cmds 子命令输出。\n');
  process.exit(r.stats.packFail ? 1 : 0);
}

if (cmd === 'cmds') {
  const r = scan(resolve(val('root', process.cwd())));
  const md = commandsMd(r);
  if (has('out')) {
    writeFileSync(resolve(val('out')), md, 'utf-8');
    console.log(`发布命令清单已写入：${resolve(val('out'))}（${r.stats.total} 个包）`);
    console.log('提醒：发布前把各包 repository 字段改成实际仓库地址。');
  } else console.log(md);
  process.exit(0);
}

if (cmd === 'bump') {
  // P0-3 修复：没有显式目标时不该动任何东西——--dir 必填；默认 dry-run，--apply 才落盘
  if (!has('dir')) {
    console.error('❌ 缺少 --dir <插件目录>。发布工具在没有显式目标时不做任何修改。');
    process.exit(2);
  }
  const dir = resolve(val('dir'));
  if (!existsSync(dir)) { console.error('❌ 目录不存在：' + dir); process.exit(2); }
  const level = val('level', 'patch');
  if (!['patch', 'minor', 'major'].includes(level)) { console.error('❌ --level 只能是 patch|minor|major'); process.exit(2); }
  const note = val('note', '');
  // 预演：计算将发生什么（不落盘）
  const pkgPath = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const m = String(pkg.version || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) { console.error(`❌ 版本号不是 semver：${pkg.version}`); process.exit(2); }
  let [maj, min, pat] = [+m[1], +m[2], +m[3]];
  if (level === 'major') { maj += 1; min = 0; pat = 0; }
  else if (level === 'minor') { min += 1; pat = 0; }
  else pat += 1;
  const next = `${maj}.${min}.${pat}`;
  console.log(`\n  将修改（${has('apply') ? 'apply 模式' : 'dry-run，未落盘'}）：`);
  console.log(`    1. ${pkgPath}`);
  console.log(`       ${pkg.name}  ${pkg.version} → ${next}`);
  console.log(`    2. ${join(dir, 'CHANGELOG.md')}`);
  console.log(`       追加 ## ${next} 条目${note ? `：${note}` : '（骨架，需人工润色）'}`);
  if (!has('apply')) {
    console.log(`\n  确认无误后加 --apply 落盘。`);
    process.exit(0);
  }
  const r = bumpVersion(dir, level);
  const changelog = appendChangelog(dir, r.next, note);
  console.log(`✅ ${r.name}  ${r.old} → ${r.next}\n   CHANGELOG 骨架：${changelog}`);
  process.exit(0);
}
console.error('未知子命令：' + cmd);
process.exit(2);
