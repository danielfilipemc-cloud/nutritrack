import test from 'node:test';
import assert from 'node:assert/strict';
import {exercises} from '../app/demo/experiencia/training';
import {exerciseGroups,exerciseReferences,filterExercises,youtubeReferenceUrl} from '../app/demo/experiencia/exerciseMedia';
import {exerciseGuides} from '../app/demo/experiencia/exerciseGuides';

test('exercise discovery combines accent-insensitive terms, group and video without altering the catalogue',()=>{
 const before=JSON.stringify(exercises);
 assert.deepEqual(filterExercises('bíceps HALTERES','upper',true).map(e=>e.id),['biceps']);
 assert.equal(filterExercises('halteres bíceps','lower',false).length,0);
 assert.equal(filterExercises('not-an-exercise').length,0);
 assert.equal(filterExercises('', 'movement',true).length,0);
 assert.equal(filterExercises('','all',false).length,12);
 assert.equal(JSON.stringify(exercises),before);
});
test('every selectable exercise has a guide and a source; video URLs reject arbitrary hosts and tracking content',()=>{
 for(const e of exercises){
  assert.ok(exerciseGroups[e.id]);assert.ok(exerciseGuides[e.id].steps.length);
  const ref=exerciseReferences[e.id];const url=new URL(ref.sourceUrl);assert.equal(url.protocol,'https:');
  assert.ok(['projects.upei.ca','www.nhs.uk','www.southtees.nhs.uk','www.youtube.com'].includes(url.hostname));
  if(ref.videoId){const video=new URL(youtubeReferenceUrl(ref.videoId));assert.equal(video.origin,'https://www.youtube.com');assert.deepEqual([...video.searchParams.keys()],['v']);}
 }
 for(const invalid of ['javascript:alert(1)','https://evil.example/','db43OS-4ruY&student=Sofia','../../private',''])assert.throws(()=>youtubeReferenceUrl(invalid));
});
