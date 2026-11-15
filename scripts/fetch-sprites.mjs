// 포켓몬 이미지 다운로드 스크립트 (npm run sprites)
// 출처: PokeAPI sprites 저장소 (https://github.com/PokeAPI/sprites)
// 이미지 저작권은 Nintendo / Creatures / GAME FREAK에 있다. 저장소에는 커밋하지 않는다(.gitignore).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEX } from './pokemon-keys.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sprites');
const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

// 포켓몬 목록은 pokemon-keys.mjs 에서 함께 관리한다

const KINDS = {
  front: (id) => `${BASE}/${id}.png`,
  back: (id) => `${BASE}/back/${id}.png`,
  art: (id) => `${BASE}/other/official-artwork/${id}.png`,
  // 필드용 2등신 도트 아이콘 (7세대 파티 아이콘)
  icon: (id) => `${BASE}/versions/generation-vii/icons/${id}.png`,
};

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  // PNG 시그니처 확인
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return false;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, buf);
  return true;
}

// 기존 항목(예: npm run followers 로 가져온 follower)은 유지한다
let manifest = {};
try { manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8')); } catch { /* 처음 */ }
let ok = 0, miss = 0;
for (const [key, id] of Object.entries(DEX)) {
  const entry = typeof manifest[key] === 'object' && manifest[key] ? manifest[key] : {};
  await Promise.all(Object.entries(KINDS).map(async ([kind, url]) => {
    const rel = `${kind}/${key}.png`;
    if (await download(url(id), join(ROOT, rel))) { entry[kind] = rel; ok++; }
    else miss++;
  }));
  manifest[key] = entry;
  process.stdout.write(`${key}(${Object.keys(entry).join(',')}) `);
}
await writeFile(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n완료: ${ok}개 다운로드, ${miss}개 없음 → public/sprites/manifest.json`);
