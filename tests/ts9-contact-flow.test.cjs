const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../time-square-9/en/index.html'),'utf8');
const code=html.slice(html.indexOf("const contactDialog=$('#contact-dialog');"),html.indexOf("const expertCard=$('#expert-card')"));
const siteContent=JSON.parse(html.match(/<script id="site-data" type="application\/json">(.*?)<\/script>/s)[1]);
const tourMessage=html.match(/const tourMessage='([^']*)';/)[1];

function setup({reject=false,clipboard=true,response}={}){
 const nodes=new Map(),requests=[],navigations=[],copies=[];
 function element(key){
  if(nodes.has(key))return nodes.get(key);
  const el={value:'',hidden:false,disabled:false,required:false,open:false,textContent:'',dataset:{},listeners:{},attributes:{},classList:{toggle(){},add(){},remove(){}},
   addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k];delete this[k]},
   setCustomValidity(message){this.validationMessage=message},reportValidity(){return !this.validationMessage},focus(){this.focused=true},select(){this.selected=true},click(){this.clicked=true},
   showModal(){this.open=true},close(){this.open=false;for(const fn of this.listeners.close||[])fn()},querySelector(selector){return element(key+' '+selector)}};
  nodes.set(key,el);return el;
 }
 const form=element('#contact-form'),submit=element('#contact-form [type=submit]');
 form.elements=Object.fromEntries(['name','contact','website','preferred_date','preferred_time'].map(n=>[n,element(`#contact-form [name=${n}]`)]));
 form.reportValidity=()=>Object.values(form.elements).every(el=>el.disabled||(!el.required||el.value)&&!el.validationMessage);
 form.reset=()=>{form.wasReset=true;Object.values(form.elements).forEach(el=>el.value='')};
 const channels=['whatsapp','telegram','max'].map(channel=>{const e=element('channel:'+channel);e.dataset.selectChannel=channel;return e});
 const context=vm.createContext({
  $:element,$$:selector=>selector==='#contact-channel-tabs button'||selector==='[data-select-channel]'?channels:[],
  siteContent,tourMessage,channelNames:{whatsapp:'WhatsApp',telegram:'Telegram',max:'MAX'},icon:()=>'',
  safeLink:value=>typeof value==='string'&&(/^(https?:\/\/|assets\/)/.test(value))?value:'',
  detailDialog:{open:false},document:{addEventListener(){},body:{classList:{add(){},remove(){}}},querySelector:()=>element('#contact-dialog').open?element('#contact-dialog'):null},
  window:{location:{assign:url=>navigations.push(url)}},location:{href:'https://plato.estate/time-square-9/en/'},
  navigator:{clipboard:{writeText:text=>{copies.push(text);return clipboard?Promise.resolve():Promise.reject(new Error('Clipboard unavailable'))}}},
  fetch:async(url,options)=>{requests.push({url,...Object.fromEntries(options.body)});if(response)return response();return{ok:!reject,status:reject?503:200,json:async()=>({success:!reject})}},
  Date,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,console:{warn(){}},
 });
 vm.runInContext(code,context);
 const run=source=>vm.runInContext(source,context);
 const fill=()=>{form.elements.name.value='TEST — not a client';form.elements.contact.value='+15555550199';form.elements.preferred_date.value='2099-11-13';form.elements.preferred_time.value='15:30'};
 return{run,element,form,submit,requests,navigations,copies,fill,send:()=>form.listeners.submit[0]({preventDefault(){},currentTarget:form})};
}

test('online viewing requires date/time and emails the requested time with its zone',async()=>{
 const h=setup();h.run("openContact('Online viewing','whatsapp','','viewing')");h.fill();
 assert.equal(h.form.elements.preferred_date.required,true);assert.equal(h.element('#contact-channel-tabs').hidden,true);
 await h.send();const p=h.requests[0];
 assert.equal(p.preferred_date,'2099-11-13');assert.equal(p.preferred_time,'15:30');assert.equal(p.time_zone,'Asia/Phnom_Penh (UTC+7)');assert.equal(p.preferred_start_utc,'2099-11-13T08:30:00.000Z');
 assert.match(h.element('#form-status').textContent,/confirm your appointment/);assert.equal(h.navigations.length,0);
});
test('missing schedule cannot submit; past times are rejected',async()=>{
 const h=setup();h.run("openContact('Online viewing','whatsapp','','viewing')");h.fill();h.form.elements.preferred_time.value='';await h.send();assert.equal(h.requests.length,0);
 assert.equal(h.run("viewingStart('2026-11-12','15:00',Date.parse('2026-11-12T09:00:00Z'))"),'');
 assert.equal(h.run("viewingStart('2026-11-13','15:30',Date.parse('2026-11-12T09:00:00Z'))"),'2026-11-13T08:30:00.000Z');
});
for(const channel of ['whatsapp','telegram'])test(`${channel} opens a draft only after the tour lead is accepted`,async()=>{
 const h=setup();h.run(`openContact('Investment tour','${channel}','','tour')`);h.fill();await h.send();
 assert.equal(h.requests.length,1);assert.equal(h.requests[0]._subject,'Time Square 9 — investment tour request (EN)');assert.equal(h.requests[0].preferred_date,undefined);
 const link=new URL(h.navigations[0]);assert.equal(link.searchParams.get('text'),h.requests[0].message);assert.match(link.searchParams.get('text'),/TEST — not a client/);assert.match(link.searchParams.get('text'),/\+15555550199/);
});
test('a failed email request retains the contacts and does not open a messenger',async()=>{
 const h=setup({reject:true});h.run("openContact('Investment tour','whatsapp','','tour')");h.fill();await h.send();
 assert.equal(h.navigations.length,0);assert.equal(h.form.elements.name.value,'TEST — not a client');assert.match(h.element('#form-status').textContent,/Could not send/);assert.equal(h.submit.disabled,false);
});
test('MAX copies the full message, with a manual fallback when copying is unavailable',async()=>{
 for(const clipboard of [true,false]){
  const h=setup({clipboard});h.run("openContact('Investment tour','max','','tour')");h.fill();await h.send();
  assert.equal(h.copies[0],h.requests[0].message);
  if(clipboard)assert.equal(h.navigations[0],siteContent.contacts.max);
  else{assert.equal(h.navigations.length,0);assert.equal(h.element('#tour-message-panel').hidden,false);assert.equal(h.element('#tour-message').value,h.requests[0].message)}
 }
});
test('closing a pending tour form does not redirect the visitor later',async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve);const h=setup({response:()=>pending});
 h.run("openContact('Investment tour','whatsapp','','tour')");h.fill();const sent=h.send();h.element('#contact-dialog').close();
 finish({ok:true,json:async()=>({success:true})});await sent;assert.equal(h.navigations.length,0);
});
test('switching to catalogue mode disables schedule requirements and keeps download delivery',async()=>{
 const h=setup();h.run("openContact('Online viewing','whatsapp','','viewing')");h.run("openContact('Presentation','whatsapp','assets/time-square-9-presentation-en.pdf')");h.fill();await h.send();
 assert.equal(h.form.elements.preferred_date.disabled,true);assert.equal(h.form.elements.preferred_time.required,false);assert.equal(h.requests[0].preferred_date,undefined);
 assert.equal(h.element('#presentation-download').clicked,true);assert.equal(h.element('#presentation-download').href,'assets/time-square-9-presentation-en.pdf');assert.equal(h.navigations.length,0);
});
test('changing the date clears a previous time error so a corrected request can submit',async()=>{
 const h=setup();h.run("openContact('Online viewing','whatsapp','','viewing')");h.fill();h.form.elements.preferred_time.setCustomValidity('Please choose a future date and time in Phnom Penh.');
 for(const listener of h.form.elements.preferred_date.listeners.input)listener();
 assert.equal(h.form.elements.preferred_time.validationMessage,'');await h.send();assert.equal(h.requests.length,1);
});
