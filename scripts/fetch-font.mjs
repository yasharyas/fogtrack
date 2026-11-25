// Downloads Satoshi (ITF Free Font License) from Fontshare at build time.
// The licence forbids redistributing it in this repo, so it is fetched, not committed.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const out = 'public/fonts/Satoshi-Variable.woff2';
if (existsSync(out)) process.exit(0);
try {
  const css = await (await fetch('https://api.fontshare.com/v2/css?f[]=satoshi@1,2&display=swap')).text();
  const url = 'https:' + css.match(/url\('(\/\/cdn\.fontshare\.com[^']+\.woff2)'\)/)[1];
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  mkdirSync('public/fonts', { recursive: true });
  writeFileSync(out, buf);
  console.log('Satoshi fetched', buf.length, 'bytes');
} catch (e) {
  console.warn('Satoshi not fetched, falling back to sans-serif:', e.message);
}
