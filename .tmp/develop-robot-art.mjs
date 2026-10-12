import { writeFileSync } from 'node:fs';
const assets = {
'cryo-bolt': `<title>크라이오 볼트 — 빙청색 전투 헬멧과 볼트 건틀릿</title>
<path fill="#263145" d="M20 60h10v15H16v-8h4zm14 0h10v7h4v8H34z"/>
<path fill="#547490" d="M22 62h6v8h-8v3h8v-3h-6zm14 0h6v8h4v3H36z"/>
<path fill="#b6c9d6" d="M22 62h6v4h-6zm14 0h6v4h-6z"/>
<path fill="#263145" d="M21 40h22v4h5v15h-4v5H20v-5h-4V44h5z"/>
<path fill="#73afc7" d="M22 43h20v4h4v10h-5v4H23v-4h-5V47h4z"/>
<path fill="#cfdee6" d="M22 43h20v4h-6v3h-8v-3h-6z"/>
<path fill="#3b678b" d="M18 50h6v9h17v-9h5v7h-5v4H23v-4h-5z"/>
<path fill="#263145" d="M27 49h10v9H27z"/>
<path fill="#b5e6ed" d="M32 50h4v2h-3v2h2v2h-6v-2h2v-2h1z"/>
<path fill="#d7e6e8" d="M22 59h4v2h-4zm16 0h4v2h-4z"/>
<path fill="#263145" d="M9 44h9v4h3v15H7V49h2zm37 0h9v5h2v14H43V48h3z"/>
<path fill="#c1d5df" d="M10 46h6v4h-6zm38 0h6v4h-6z"/>
<path fill="#3b678b" d="M9 51h10v10H9zm36 0h10v10H45z"/>
<path fill="#73afc7" d="M10 52h7v4h-7zm37 0h7v4h-7z"/>
<path fill="#b5e6ed" d="M10 57h7v2h-7zm37 0h7v2h-7z"/>
<path fill="#263145" d="M17 3h30v3h5v4h4v8h3v16h-4v6h-6v4H15v-4H9v-6H5V18h3v-8h4V6h5z"/>
<path fill="#94c9d9" d="M18 5h28v3h5v4h3v8h3v12h-4v6h-6v4H17v-4h-6v-6H7V20h3v-8h4V8h4z"/>
<path fill="#e1edf0" d="M18 5h28v3H18zM14 8h7v4h-7zM10 12h6v8h-6zM7 20h5v10H7z"/>
<path fill="#4d89ab" d="M48 10h3v4h3v6h3v12h-4v6h-6v4H17v-4h29v-5h4V18h-2z"/>
<path fill="#c8dfe7" d="M21 9h22v3H21zM15 34h5v4h24v2H18v-2h-3z"/>
<path fill="#263145" d="M19 14h27v4h4v13h-5v4H18v-4h-4V19h5z"/>
<path fill="#385373" d="M20 16h24v4h4v10h-5v3H20v-4h-4v-9h4z"/>
<path fill="#496d89" d="M20 16h24v3H20zM16 20h5v5h-5z"/>
<path fill="#1d2b42" d="M22 25h26v5h-5v3H20v-4h2z"/>
<path fill="#b5e6ed" d="M21 23h8v3h-8zm14 0h8v3h-8z"/>
<path fill="#72a8c2" d="M22 28h6v1h-6zm14 0h6v1h-6z"/>
<path fill="#547490" d="M8 23h4v8H8zm44 0h4v8h-4zM27 37h10v3H27z"/>`,
'thermal-shock': `<title>써멀 쇼크 — 냉열 이중 흉갑과 넓은 산업용 헬멧</title>
<path fill="#263145" d="M19 61h11v14H15v-7h4zm15 0h11v7h4v7H34z"/>
<path fill="#8d6553" d="M21 63h7v7H18v3h10v-3h-7z"/>
<path fill="#486d87" d="M36 63h7v7h3v3H36z"/>
<path fill="#cbd6da" d="M21 63h7v3h-7zm15 0h7v3h-7z"/>
<path fill="#263145" d="M20 41h24v4h5v14h-5v5H20v-5h-5V45h5z"/>
<path fill="#d69153" d="M21 43h11v18H22v-4h-5V47h4z"/>
<path fill="#78b6cb" d="M32 43h11v4h4v10h-5v4H32z"/>
<path fill="#d5dee0" d="M21 43h22v4h-7v4h-8v-4h-7z"/>
<path fill="#a8623f" d="M17 51h5v6h9v4h-9v-4h-5z"/>
<path fill="#486d87" d="M42 51h5v6h-5v4H33v-4h9z"/>
<path fill="#263145" d="M27 51h10v8H27z"/>
<path fill="#efbf7c" d="M29 53h3v4h-3z"/>
<path fill="#aedfe6" d="M33 53h2v4h-2z"/>
<path fill="#263145" d="M7 44h10v6h3v13H5V50h2zm40 0h10v6h2v13H44V50h3z"/>
<path fill="#d5dee0" d="M9 46h6v4H9zm40 0h6v4h-6z"/>
<path fill="#a8623f" d="M7 52h11v9H7z"/>
<path fill="#d69153" d="M8 53h8v5H8z"/>
<path fill="#efbf7c" d="M8 54h2v4H8zm4 0h2v4h-2z"/>
<path fill="#486d87" d="M46 52h11v9H46z"/>
<path fill="#78b6cb" d="M48 53h7v5h-7z"/>
<path fill="#aedfe6" d="M49 54h2v4h-2zm4 0h2v4h-2z"/>
<path fill="#263145" d="M19 4h26v3h7v4h5v7h4v15h-4v6h-7v5H14v-5H7v-6H3V18h4v-7h5V7h7z"/>
<path fill="#d69153" d="M19 6h26v3h6v4h4v7h4v11h-4v6h-7v5H16v-5H9v-6H5V20h4v-7h4V9h6z"/>
<path fill="#efbf7c" d="M19 6h26v3H19zM13 9h9v4h-9zM9 13h6v7H9z"/>
<path fill="#a8623f" d="M49 11h2v4h4v5h4v11h-4v6h-7v5H16v-4h30v-4h5V22h-2z"/>
<path fill="#d5dee0" d="M5 20h5v11H5zm49 0h5v11h-5zM14 35h5v4h26v-4h5v4h-4v3H18v-3h-4z"/>
<path fill="#263145" d="M18 15h28v3h5v13h-6v4H19v-4h-6V18h5z"/>
<path fill="#385373" d="M19 17h26v3h4v10h-5v3H20v-3h-5V20h4z"/>
<path fill="#496d89" d="M19 17h26v3H19zM15 20h7v4h-7z"/>
<path fill="#1d2b42" d="M19 27h30v3h-5v3H20v-3h-1z"/>
<path fill="#efbf7c" d="M21 24h8v3h-8z"/>
<path fill="#aedfe6" d="M35 24h8v3h-8zM29 7h6v6h-6z"/>
<path fill="#8d6553" d="M26 37h12v3H26z"/>
<path fill="#cbd6da" d="M28 37h2v2h-2zm4 0h2v2h-2z"/>`,
'plasma': `<title>플라즈마 — 돔 헬멧과 플라즈마 반응로 흉갑</title>
<path fill="#263145" d="M20 61h10v14H16v-7h4zm14 0h10v7h4v7H34z"/>
<path fill="#716294" d="M22 63h6v7h-9v3h9v-3h-6zm14 0h6v7h3v3H36z"/>
<path fill="#cecddd" d="M22 63h6v3h-6zm14 0h6v3h-6z"/>
<path fill="#263145" d="M22 39h20v4h5v4h3v11h-6v6H20v-6h-6V47h3v-4h5z"/>
<path fill="#a18abd" d="M23 42h18v3h5v4h2v7h-6v6H22v-6h-6v-7h2v-4h5z"/>
<path fill="#d4d9e5" d="M23 42h18v4H23zM19 46h5v5h-5zm21 0h5v5h-5z"/>
<path fill="#716294" d="M16 52h6v6h20v-6h6v4h-6v6H22v-6h-6z"/>
<path fill="#263145" d="M28 46h8v2h4v10h-4v2h-8v-2h-4V48h4z"/>
<path fill="#b975a1" d="M28 48h8v2h2v6h-2v2h-8v-2h-2v-6h2z"/>
<path fill="#edbad0" d="M30 49h4v2h2v4h-2v2h-4v-2h-2v-4h2z"/>
<path fill="#f2e4ee" d="M31 51h2v4h-2z"/>
<path fill="#263145" d="M8 44h10v6h2v12H6V50h2zm38 0h10v6h2v12H44V50h2z"/>
<path fill="#cecddd" d="M10 46h6v4h-6zm38 0h6v4h-6z"/>
<path fill="#716294" d="M8 52h10v8H8zm38 0h10v8H46z"/>
<path fill="#b975a1" d="M9 53h7v3H9zm39 0h7v3h-7z"/>
<path fill="#263145" d="M26 2h12v2h8v4h5v5h4v7h3v13h-4v5h-6v5H16v-5h-6v-5H6V20h3v-7h4V8h5V4h8z"/>
<path fill="#a18abd" d="M26 4h12v2h7v4h5v5h3v7h3v9h-4v5h-6v5H18v-5h-6v-5H8v-9h3v-7h4v-5h5V6h6z"/>
<path fill="#ded7eb" d="M26 4h12v2H26zM20 6h11v4H20zM15 10h9v5h-9zM11 15h7v7h-7z"/>
<path fill="#c4b3d8" d="M29 8h12v4H29zM8 22h5v8H8z"/>
<path fill="#716294" d="M46 11h4v6h3v5h3v9h-4v5h-6v5H18v-4h26v-5h5V22h-3z"/>
<path fill="#d4d9e5" d="M15 34h5v4h24v-4h5v4h-4v3H19v-3h-4z"/>
<path fill="#263145" d="M27 14h10v3h6v4h4v12h-6v3H23v-3h-6V21h4v-4h6z"/>
<path fill="#385373" d="M28 16h8v3h6v4h3v8h-5v3H24v-3h-5v-8h4v-4h5z"/>
<path fill="#496d89" d="M28 16h8v3h-8zM23 19h7v4h-7zM19 23h6v4h-6z"/>
<path fill="#1d2b42" d="M26 25h19v6h-5v3H24v-3h2z"/>
<path fill="#edbad0" d="M28 24h8v2h4v3H24v-3h4z"/>
<path fill="#f2e4ee" d="M30 23h4v4h-4z"/>
<path fill="#b975a1" d="M9 25h4v7H9zm42 0h4v7h-4z"/>`
};
for (const [name, shapes] of Object.entries(assets)) {
  writeFileSync(new URL(`../public/games/space/robots/${name}.svg`, import.meta.url),
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80" shape-rendering="crispEdges">\n${shapes}\n</svg>\n`);
}
