// 포켓몬 이미지 다운로드 스크립트 (npm run sprites)
// 출처: PokeAPI sprites 저장소 (https://github.com/PokeAPI/sprites)
// 이미지 저작권은 Nintendo / Creatures / GAME FREAK에 있다. 저장소에는 커밋하지 않는다(.gitignore).
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sprites');
const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

/** 게임 키 → 전국도감 번호 */
const DEX = {
  // 플레이어
  charmander: 4, cyndaquil: 155, torchic: 255, chimchar: 390,
  squirtle: 7, totodile: 158, mudkip: 258, piplup: 393,
  pidgey: 16, starly: 396, fletchling: 661,
  // 육군 NPC
  growlithe: 58, diglett: 50, psyduck: 54, eevee: 133, togepi: 175, arcanine: 59, machamp: 68, charizard: 6,
  // 해군 NPC
  lapras: 131, tentacool: 72, magikarp: 129, marill: 183, horsea: 116, dewgong: 87, slowbro: 80, gyarados: 130,
  // 공군 NPC
  swablu: 333, delibird: 225, zubat: 41, taillow: 276, emolga: 587, swellow: 277, fearow: 22, pidgeot: 18,
  // 경계근무 야생 포켓몬
  rattata: 19, wingull: 278, meowth: 52,
  // 경계근무 수상한 접근자
  ekans: 23, koffing: 109,
};

const KINDS = {
  front: (id) => `${BASE}/${id}.png`,
  back: (id) => `${BASE}/back/${id}.png`,
  art: (id) => `${BASE}/other/official-artwork/${id}.png`,
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

const manifest = {};
let ok = 0, miss = 0;
for (const [key, id] of Object.entries(DEX)) {
  const entry = {};
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
