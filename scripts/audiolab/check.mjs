// 합성한 음원의 길이·음량·루프 이음매를 숫자로 확인한다:  node scripts/audiolab/check.mjs [id ...]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
vm.runInThisContext(readFileSync(join(here, 'synth.js'), 'utf8'));
const { TRACKS, render, SR } = globalThis.AudioLab;

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TRACKS);
for (const id of ids) {
  const t0 = Date.now();
  const o = render(id);
  const n = o.L.length;
  // 루프 이음매: 끝 → 처음으로 넘어갈 때의 단차를, 곡 안의 평범한 샘플 간 변화와 견준다
  let seam = '';
  if (o.loop) {
    let avg = 0;
    for (let i = 1; i < n; i += 97) avg += Math.abs(o.L[i] - o.L[i - 1]);
    avg /= Math.floor((n - 1) / 97) + 1;
    seam = ` seam=${(Math.abs(o.L[0] - o.L[n - 1]) / (avg || 1)).toFixed(2)}x`;
  }
  let nan = 0;
  for (let i = 0; i < n; i++) if (!Number.isFinite(o.L[i]) || !Number.isFinite(o.R[i])) nan++;
  // 처음 · 끝 20ms의 크기 (툭 끊기지 않는지)
  const edge = (a, b) => { let m = 0; for (let i = a; i < b; i++) m = Math.max(m, Math.abs(o.L[i]), Math.abs(o.R[i])); return m.toFixed(3); };
  console.log(
    `${id.padEnd(24)} ${(n / SR).toFixed(2).padStart(6)}s peak=${o.stats.peak.toFixed(2)} rms=${o.stats.rmsDb.toFixed(1)}dB` +
    ` head=${edge(0, 960)} tail=${edge(n - 960, n)}${seam}${nan ? ` NaN=${nan}` : ''} (${Date.now() - t0}ms)`,
  );
}
