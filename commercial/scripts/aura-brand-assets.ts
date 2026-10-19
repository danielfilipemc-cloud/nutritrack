/** Deterministic vector artwork refined from the supplied AURA concept kit.
 * No fonts, bitmap tracing, remote references, animation or third-party assets.
 */
import {mkdir, writeFile} from 'node:fs/promises';
const svg = (box: string, content: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${box.split(' ')[2]}" height="${box.split(' ')[3]}" viewBox="${box}">${content}</svg>\n`;
const definitions = `<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#B9F4EE"/><stop offset=".38" stop-color="#279E98"/><stop offset="1" stop-color="#137F79"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#073E3B"/><stop offset=".55" stop-color="#137F79"/><stop offset="1" stop-color="#29ADA4"/></linearGradient><linearGradient id="c"><stop stop-color="#137F79"/><stop offset=".55" stop-color="#83DDD3"/><stop offset="1" stop-color="#37BDB2"/></linearGradient></defs>`;
const mark = `<g fill="none" stroke="url(#c)" stroke-width="1.5" transform="rotate(-20 66 70)"><path d="M8 70a58 21 0 0 1 116 0"/></g><path d="M61 18h16L120 106H99L64 39Z" fill="url(#b)"/><path d="M25 106 58 23q2-5 5-5h14L39 106Z" fill="url(#a)"/><path d="M44 85C60 65 76 66 96 86l7 16C79 80 57 76 36 105Z" fill="url(#c)"/><path d="M8 70a58 21 0 0 0 116 0" fill="none" stroke="url(#c)" stroke-width="1.7" transform="rotate(-20 66 70)"/><circle cx="120.5" cy="50.2" r="5.6" fill="#8CE7DC"/><circle cx="119" cy="48.5" r="1.7" fill="#E5FFFB"/>`;
// Custom geometric outline lettering: no installed-font dependency.
const word = `<path d="M0 48 20 2q2-4 4 0l22 46H34L22 20 10 48ZM56 0h11v28q0 12 11 12t11-12V0h11v29q0 21-22 21T56 29ZM112 0h27q23 0 23 16 0 12-12 16l16 16h-15l-18-17h-10v17h-11V21h27q12 0 12-5t-12-6h-27ZM176 48l20-46q2-4 4 0l22 46h-12l-12-28-12 28Z"/>`;
const glyphs = [
 'M0 0h4q4 0 4 3t-4 3H0m4 0q4 0 4 3t-4 3H0V0',
 'M0 0v8q0 4 4 4t4-4V0',
 'M8 1Q0-2 0 3q0 3 4 3t4 3q0 5-8 2',
 'M4 0v12',
 'M0 12V0l8 12V0',
 'M8 0H0v12h8M0 6h6',
 'M8 1Q0-2 0 3q0 3 4 3t4 3q0 5-8 2',
 'M8 1Q0-2 0 3q0 3 4 3t4 3q0 5-8 2',
];
const business = glyphs.map((d,i) => `<path d="${d}" transform="translate(${i*22} 0)"/>`).join('');
function logo(light = false) {
 return svg('0 0 390 112', definitions + `<g transform="translate(0 -8)">${mark}</g><g transform="translate(148 18)" fill="${light ? '#102C2A' : '#F2F7F6'}">${word}</g><g transform="translate(171 84)" fill="none" stroke="${light ? '#137F79' : '#79D4C6'}" stroke-width="1.65" stroke-linejoin="round">${business}</g>`);
}
const smallMark = `<path d="m7 26 7-20h4l8 20h-5l-5-13-5 13Z" fill="#4BBEB1"/><path d="M11 21q5-7 12 2" fill="none" stroke="#8CE7DC" stroke-width="2"/><ellipse cx="16" cy="18" rx="14" ry="5" transform="rotate(-20 16 18)" fill="none" stroke="#79D4C6" stroke-width="1.15"/><circle cx="29" cy="13" r="1.8" fill="#D0FFF5"/>`;
export const auraBrandAssets: Record<string,string> = {
 'aura-logo-on-dark.svg': logo(),
 'aura-logo-on-light.svg': logo(true),
 'aura-symbol.svg': svg('0 0 132 128', definitions + mark),
 'aura-symbol-small.svg': svg('0 0 32 32', smallMark),
 'aura-favicon.svg': svg('0 0 32 32', `<rect width="32" height="32" rx="7" fill="#0F1414"/>${smallMark}`),
 'aura-app-icon.svg': svg('0 0 128 128', definitions + `<defs><radialGradient id="bg"><stop stop-color="#13413E"/><stop offset="1" stop-color="#0F1414"/></radialGradient><filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2"/></filter></defs><rect x="1" y="1" width="126" height="126" rx="28" fill="url(#bg)" stroke="#137F79"/><g transform="translate(5 8) scale(.87)"><circle cx="120.5" cy="50.2" r="7" fill="#79D4C6" opacity=".45" filter="url(#glow)"/>${mark}</g>`),
};
export async function writeAuraBrandAssets() {
 const folder = new URL('../public/brand/', import.meta.url); await mkdir(folder, {recursive:true});
 for (const [name,content] of Object.entries(auraBrandAssets)) await writeFile(new URL(name,folder),content);
}
if (process.argv.includes('--write')) void writeAuraBrandAssets();
