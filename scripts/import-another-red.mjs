// 포켓몬스터 어나더 레드 그래픽 가져오기 (정면·뒷모습·아이콘·필드 걷기 시트)
// 사용법: npm run anotherred -- "<...\Pokemon Another Red_PWT_...\Graphics 폴더 경로>"
//         (Graphics\Pokemon 이나 Graphics\Characters\Followers 경로를 줘도 된다)
//
// - 게임에 등장하는 포켓몬의 영문 이름(대문자, 예: CHARMANDER.png)으로 파일을 찾는다.
//   Graphics/Pokemon/Front  → public/sprites/ar/front/<key>.png  (애니메이션 가로 띠: 정사각형 프레임 여러 장)
//   Graphics/Pokemon/Back   → public/sprites/ar/back/<key>.png
//   Graphics/Pokemon/Icons  → public/sprites/ar/icon/<key>.png   (64x64 프레임 2장)
//   Graphics/Characters/Followers → public/sprites/follower/<key>.png (4x4 걷기 시트)
// - manifest.json의 front/back/icon/follower 항목을 어나더 레드 파일로 바꾼다 (공식 일러스트 art는 그대로).
// - 다른 게임의 그래픽 파일이므로 저장소에는 올리지 않는다(.gitignore).
import { copyFile, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEX } from './pokemon-keys.mjs';

let src = process.argv[2];
if (!src) {
  console.error('사용법: npm run anotherred -- "<Another Red의 Graphics 폴더 경로>"');
  process.exit(1);
}
// Followers 경로를 줬으면 Graphics 폴더로 올라간다
if (basename(src).toLowerCase() === 'followers') src = join(src, '..', '..');
// Graphics\Pokemon 경로를 줘도 Graphics 폴더로 올라간다
else if (basename(src).toLowerCase() === 'pokemon') src = join(src, '..');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sprites');
const exists = async (p) => access(p).then(() => true, () => false);

const KINDS = [
  { kind: 'front', from: join(src, 'Pokemon', 'Front'), to: 'ar/front' },
  { kind: 'back', from: join(src, 'Pokemon', 'Back'), to: 'ar/back' },
  { kind: 'icon', from: join(src, 'Pokemon', 'Icons'), to: 'ar/icon' },
  { kind: 'follower', from: join(src, 'Characters', 'Followers'), to: 'follower' },
];

let manifest = {};
try { manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8')); } catch { /* 새로 만든다 */ }
for (const k of KINDS) await mkdir(join(ROOT, k.to), { recursive: true });

const count = Object.fromEntries(KINDS.map((k) => [k.kind, 0]));
const missing = [];
for (const key of Object.keys(DEX)) {
  const entry = typeof manifest[key] === 'string' ? { front: manifest[key] } : (manifest[key] ?? {});
  for (const k of KINDS) {
    const file = join(k.from, `${key.toUpperCase()}.png`);
    if (!(await exists(file))) { missing.push(`${key}(${k.kind})`); continue; }
    await copyFile(file, join(ROOT, k.to, `${key}.png`));
    entry[k.kind] = `${k.to}/${key}.png`;
    count[k.kind]++;
  }
  manifest[key] = entry;
}
await writeFile(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`완료: 정면 ${count.front} · 뒷모습 ${count.back} · 아이콘 ${count.icon} · 걷기 ${count.follower}${missing.length ? ` / 없음: ${missing.join(', ')}` : ''}`);
