// 필드 걷기 스프라이트(팔로워 시트) 가져오기
// 사용법: npm run followers -- "<...\Graphics\Characters\Followers 폴더 경로>"
//
// - 폴더 안에서 게임에 등장하는 포켓몬의 영문 이름(대문자, 예: CHARMANDER.png)과 같은 파일만 복사한다.
// - 시트 형식: 4x4 칸 (행: 앞·왼쪽·오른쪽·뒤 / 열: 걷기 4프레임)
// - public/sprites/follower/ 로 복사하고 manifest.json 에 follower 항목을 추가한다.
// - 다른 게임의 그래픽 파일이므로 저장소에는 올리지 않는다(.gitignore).
import { copyFile, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEX } from './pokemon-keys.mjs';

const src = process.argv[2];
if (!src) {
  console.error('사용법: npm run followers -- "<Followers 폴더 경로>"');
  process.exit(1);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sprites');
const OUT = join(ROOT, 'follower');

/** 게임 키 (pokemon-keys.mjs) → 팔로워 파일 이름은 영문 대문자 */
const KEYS = Object.keys(DEX);

const exists = async (p) => access(p).then(() => true, () => false);

await mkdir(OUT, { recursive: true });
let manifest = {};
try { manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8')); } catch { /* 새로 만든다 */ }

let ok = 0;
const missing = [];
for (const key of KEYS) {
  const file = join(src, `${key.toUpperCase()}.png`);
  if (!(await exists(file))) { missing.push(key); continue; }
  await copyFile(file, join(OUT, `${key}.png`));
  const entry = typeof manifest[key] === 'string' ? { front: manifest[key] } : (manifest[key] ?? {});
  entry.follower = `follower/${key}.png`;
  manifest[key] = entry;
  ok++;
}
await writeFile(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`완료: ${ok}개 복사${missing.length ? `, 없음: ${missing.join(', ')}` : ''} → public/sprites/follower/`);
