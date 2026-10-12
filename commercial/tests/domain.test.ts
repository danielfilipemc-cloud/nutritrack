import {test} from "node:test";
import assert from "node:assert/strict";
import {measurement,validDate,validName} from "../lib/validation";
import {RequestScope} from "../lib/request-scope";
test("measurement bounds and precision",()=>{assert.equal(measurement("",500,2),null);assert.equal(measurement("75.25",500,2),75.25);for(const s of ["NaN","Infinity","0","-1","501","1.001"])assert.throws(()=>measurement(s,500,2));});
test("calendar and trimmed names",()=>{assert.ok(validDate("2024-02-29"));assert.ok(!validDate("2025-02-29"));assert.ok(!validDate("nonsense"));assert.ok(!validName("  a  "));});
test("tenant switch and late response invalidation",()=>{const scope=new RequestScope();const old=scope.begin();scope.invalidate();assert.ok(!old());const a=scope.begin();const b=scope.begin();assert.ok(!a());assert.ok(b());});

import {chartData,timePosition} from "../lib/chart";
test("chart uses elapsed dates and never mutates source",()=>{const input=[{date:"2026-10-11",value:80},{date:"2026-10-01",value:82},{date:"invalid",value:5},{date:"2026-10-02",value:null}];assert.equal(chartData(input).length,2);assert.equal(input[0].value,80);assert.equal(timePosition("2026-10-02","2026-10-01","2026-10-11"),108);assert.equal(timePosition("2026-10-01","2026-10-01","2026-10-01"),340);});
