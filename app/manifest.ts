import type { MetadataRoute } from 'next';

/**
 * 홈 화면에 추가해 앱처럼 띄울 때의 설정.
 * 브라우저 탭 줄 · 주소창 없이 열린다 → 폰을 가로로 눕혀도 화면 높이를 다 쓴다.
 * (아이폰 사파리는 웹 페이지의 전체 화면 기능을 막아 두었다. 아이폰에서 주소창 없이 하는 방법은 이것뿐이다.
 *  iOS는 fullscreen을 standalone으로 받아들여, 맨 위 상태 표시줄만 남는다)
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Poké Army — 별빛에 소원을 빌던 밤',
    short_name: 'Poké Army',
    description: '군대 가기 싫다던 주인공이 포켓몬이 되어 입대한다! 군 생활 시뮬레이션',
    lang: 'ko',
    start_url: '/',
    display: 'fullscreen',
    orientation: 'any',
    background_color: '#141214',
    theme_color: '#141214',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
