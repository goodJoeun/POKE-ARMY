import type { Metadata, Viewport } from 'next';
import './fonts.css';
import './globals.css';
import './retro.css';

export const metadata: Metadata = {
  title: 'Poké Army — 별빛에 소원을 빌던 밤',
  description: '군대 가기 싫다던 주인공이 포켓몬이 되어 입대한다! 군 생활 시뮬레이션 프로토타입',
  // 아이폰 · 아이패드에서 "홈 화면에 추가"로 열면 사파리 탭 줄 · 주소창 없이 뜬다 (app/manifest.ts · app/apple-icon.png)
  appleWebApp: { capable: true, title: 'Poké Army', statusBarStyle: 'black' },
  // Next 15는 표준 이름(mobile-web-app-capable)만 넣는다. 예전 iOS가 읽는 이름도 함께
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#141214',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
