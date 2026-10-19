import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auraBrandAssets} from '../scripts/aura-brand-assets';
test('institutional SVG assets are reproducible, local, bounded and free of executable markup or fonts',async()=>{
 for(const [name,source] of Object.entries(auraBrandAssets)) {
  assert.equal((await readFile(new URL(`../public/brand/${name}`,import.meta.url),'utf8')).replace(/\r\n/g,'\n'),source);
  assert.ok(Buffer.byteLength(source)<6000,name);assert.match(source,/viewBox="0 0 \d+ \d+"/);
  assert.doesNotMatch(source,/<(?:script|foreignObject|image|text|animate|set)\b|\bon\w+\s*=|(?:href|xlink:href)\s*=|@import|font-family|<!DOCTYPE/i,name);
  if(name!=='aura-app-icon.svg') assert.doesNotMatch(source,/<filter|filter=/,name);
 }
 assert.match(auraBrandAssets['aura-app-icon.svg'],/stdDeviation="2"/);
 assert.match(auraBrandAssets['aura-logo-on-dark.svg'],/#F2F7F6/);
 assert.match(auraBrandAssets['aura-logo-on-light.svg'],/#102C2A/);
});
