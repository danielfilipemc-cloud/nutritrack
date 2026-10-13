import {test} from "node:test";
import assert from "node:assert/strict";
import {brandForeground,contrastRatio} from "../lib/branding";

test("tenant foreground meets WCAG AA across the sRGB cube and boundary colours",()=>{
 for(let r=0;r<=255;r+=17)for(let g=0;g<=255;g+=17)for(let b=0;b<=255;b+=17){
  const color="#"+[r,g,b].map(v=>v.toString(16).padStart(2,"0")).join("");
  assert.ok(contrastRatio(color,brandForeground(color))>=4.5,color);
 }
 for(const color of ["#137F79","#777777","#767676","#00FF00","#FF0000"])
  assert.ok(contrastRatio(color,brandForeground(color))>=4.5,color);
 assert.equal(brandForeground("#FFFFFF"),"#000000");
 assert.equal(brandForeground("#000000"),"#FFFFFF");
 assert.equal(brandForeground("invalid"),brandForeground("#137F79"));
});
