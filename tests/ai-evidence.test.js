import test from 'node:test';import assert from 'node:assert/strict';import {analyzeCase} from '../src/ai.js';import {makeSource} from '../src/evidence.js';
const c={title:'Delayed degree certificate',description:'I have waited for eight months without a certificate',category:'certificate',institution:'Example University',jurisdiction:'Andhra Pradesh'};
test('without model credentials AI output defaults to labelled offline guidance',async()=>{const p=await analyzeCase(c,[],{endpoint:'',key:''});assert.equal(p.mode,'offline');assert.equal(p.steps.length,3);});
test('AI may cite only moderator reviewed official links',async()=>{const source={type:'official',title:'Official process',url:'https://example.edu/process',reviewStatus:'reviewed'};const fake=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({summary:'Check requirements',questions:['When did you submit?'],steps:[{text:'Follow official process',basis:'Claims official evidence',sourceUrl:source.url},{text:'Contact someone',basis:'Claims other source',sourceUrl:'https://false.example'}]})}}]})});const p=await analyzeCase(c,[source],{endpoint:'https://example.com/v1/chat/completions',key:'secret',fetcher:fake});assert.equal(p.mode,'ai');assert.equal(p.steps[0].sourceUrl,source.url);assert.equal(p.steps[1].sourceUrl,'');assert.match(p.steps[1].basis,/General guidance/);});
test('invalid model output fails closed',async()=>{const fake=async()=>({ok:true,json:async()=>({choices:[{message:{content:'not JSON'}}]})});await assert.rejects(()=>analyzeCase(c,[],{endpoint:'https://example.com',key:'secret',fetcher:fake}));});
test('model gateway must use HTTPS or loopback',async()=>{await assert.rejects(()=>analyzeCase(c,[],{endpoint:'http://evil.example/model',key:'secret'}),/HTTPS/);});
test('source input must be public HTTPS, never implicit verification',()=>{assert.throws(()=>makeSource('u','c',{type:'official',title:'Bad url',url:'http://localhost'}));assert.throws(()=>makeSource('u','c',{type:'official',title:'Bad url',url:'https://127.0.0.1/x'}));const s=makeSource('u','c',{type:'official',title:'Sample university policy',url:'https://university.example/policy',notes:'Office procedure'});assert.equal(s.reviewStatus,'unreviewed');});

test('model requests refuse redirects that could forward case data',async()=>{
  let options;
  await assert.rejects(()=>analyzeCase(c,[],{endpoint:'https://provider.example/model',key:'secret',fetcher:async(url,opts)=>{options=opts;throw Error('redirect refused');}}));
  assert.equal(options.redirect,'error');
});
