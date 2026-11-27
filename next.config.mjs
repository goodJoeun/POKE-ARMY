import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 그림 · 음원(public/sprites · audio · tiles)의 버전: 파일 이름과 크기를 모아 만든 짧은 해시.
 * 파일이 그대로면 배포를 새로 해도 값이 같고, 하나라도 바뀌면 달라진다.
 * 게임은 이 값을 주소 뒤에 붙여(?v=…) 요청하므로, 아래에서 1년 동안 캐시하게 해도 바뀐 파일은 곧바로 새로 받는다.
 * (스프라이트는 빌드 직전(prebuild)에 Blob에서 받아 오므로, 이 설정을 읽는 시점에는 이미 폴더에 있다)
 */
function assetVersion() {
  const hash = createHash('sha1');
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const st = statSync(path);
      if (st.isDirectory()) walk(path);
      else hash.update(`${path.replaceAll('\\', '/')}:${st.size}\n`);
    }
  };
  for (const dir of ['public/sprites', 'public/audio', 'public/tiles']) walk(dir);
  return hash.digest('hex').slice(0, 10);
}

const LONG_CACHE = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  env: { NEXT_PUBLIC_ASSET_V: assetVersion() },
  /**
   * 그림 · 음원은 브라우저가 오래 캐시한다: 다시 접속하거나 새로 고칠 때 파일마다 재확인 요청(CDN 요청)을 보내지 않는다.
   * 개발 서버에서는 걸지 않는다 (파일을 바꿔 가며 볼 수 있게).
   */
  async headers() {
    if (process.env.NODE_ENV !== 'production') return [];
    return ['/sprites/:path*', '/audio/:path*', '/tiles/:path*'].map((source) => ({ source, headers: LONG_CACHE }));
  },
};

export default nextConfig;
