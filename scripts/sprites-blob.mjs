// public/sprites(저장소에 없는 포켓몬 그림)를 Vercel Blob 비공개 저장소에 묶어 두고,
// git 푸시로 빌드할 때 받아 온다.
//
//   npm run sprites:upload   그림을 바꾼 뒤 한 번 — public/sprites를 묶어 Blob에 올린다 (vercel CLI 로그인 필요)
//   node scripts/sprites-blob.mjs download   npm run build 직전(prebuild)에 자동 실행
//
// download는 public/sprites/manifest.json이 이미 있으면 아무것도 하지 않는다 (로컬, `vercel --prod` 업로드).
// Vercel 빌드에서 그림을 못 받으면 빌드를 실패시켜, 그림 없는 사이트가 배포되지 않게 한다.

import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BLOB_PATH = 'sprites/sprites.tar.gz';
// tar에 드라이브 문자(C:)가 들어가면 GNU tar가 원격 호스트로 읽으므로 상대 경로만 쓴다.
const ARCHIVE = 'node_modules/.cache/sprites.tar.gz';
const MANIFEST = 'public/sprites/manifest.json';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 실패 (exit ${r.status})`);
}

// Blob 저장소는 Production·Preview 환경에만 연결돼 있어, 로컬에서는 production 환경 변수의
// BLOB_READ_WRITE_TOKEN을 잠깐 받아 쓰고 파일은 바로 지운다.
function productionBlobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const file = 'node_modules/.cache/.env.production.tmp';
  try {
    run('vercel', ['env', 'pull', file, '--environment', 'production', '--yes'], {
      shell: process.platform === 'win32',
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('BLOB_READ_WRITE_TOKEN='));
    const token = line?.slice('BLOB_READ_WRITE_TOKEN='.length).replace(/^"|"$/g, '');
    if (!token) throw new Error('production 환경 변수에 BLOB_READ_WRITE_TOKEN이 없습니다.');
    return token;
  } finally {
    rmSync(file, { force: true });
  }
}

async function upload() {
  if (!existsSync(MANIFEST)) throw new Error(`${MANIFEST}가 없습니다. 그림을 먼저 받아 주세요.`);
  mkdirSync('node_modules/.cache', { recursive: true });
  run('tar', ['-czf', ARCHIVE, '--exclude', 'sprites/README.md', '-C', 'public', 'sprites']);
  const token = productionBlobToken();
  const { put } = await import('@vercel/blob');
  const res = await put(BLOB_PATH, readFileSync(ARCHIVE), {
    access: 'private',
    token,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/gzip',
  });
  console.log(`sprites → Blob ${res.pathname} 업로드 완료 (${(statSync(ARCHIVE).size / 1e6).toFixed(1)}MB)`);
}

async function download() {
  if (existsSync(MANIFEST)) {
    console.log('sprites: public/sprites가 이미 있어 Blob에서 받지 않습니다.');
    return;
  }
  const onVercel = Boolean(process.env.VERCEL);
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (onVercel) throw new Error('BLOB_READ_WRITE_TOKEN이 없어 포켓몬 그림을 받을 수 없습니다.');
    console.log('sprites: 그림이 없습니다. `npm run anotherred` 등으로 받거나 BLOB_READ_WRITE_TOKEN을 설정하세요.');
    return;
  }
  const { get } = await import('@vercel/blob');
  const res = await get(BLOB_PATH, { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200) throw new Error(`Blob에 ${BLOB_PATH}가 없습니다. npm run sprites:upload를 먼저 실행하세요.`);
  mkdirSync('node_modules/.cache', { recursive: true });
  await pipeline(Readable.fromWeb(res.stream), createWriteStream(ARCHIVE));
  run('tar', ['-xzf', ARCHIVE, '-C', 'public']);
  if (!existsSync(MANIFEST)) throw new Error('받은 묶음에 manifest.json이 없습니다.');
  console.log(`sprites: Blob에서 받았습니다 (${(res.blob.size / 1e6).toFixed(1)}MB, ${res.blob.uploadedAt.toISOString()} 업로드본).`);
}

const mode = process.argv[2];
try {
  if (mode === 'upload') await upload();
  else if (mode === 'download') await download();
  else throw new Error('사용법: node scripts/sprites-blob.mjs upload|download');
} catch (e) {
  console.error(`sprites: ${e.message}`);
  process.exit(1);
}
