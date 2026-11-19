import type { Metadata, Viewport } from 'next';
import './fonts.css';
import './globals.css';
import './retro.css';

export const metadata: Metadata = {
  title: 'Poké Army — 별빛을 찾아서',
  description: '군대 가기 싫다던 주인공이 포켓몬이 되어 입대한다! 군 생활 시뮬레이션 프로토타입',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
