/* ===== الأصوات (مولَّدة بالكود، بلا ملفات) ===== */
const AUD=(()=>{
  let c,m,on=true,mi,st=0,want=false;
  const g=()=>{if(!c){try{c=new(window.AudioContext||window.webkitAudioContext)();m=c.createGain();m.gain.value=.6;m.connect(c.destination)}catch(e){return null}}if(c.state=='suspended')c.resume();return c};
  const n=(f,t,d,v,at=0,f2)=>{const x=g();if(!x||!on)return;const o=x.createOscillator(),e=x.createGain(),s=x.currentTime+at;o.type=t;o.frequency.setValueAtTime(f,s);if(f2)o.frequency.exponentialRampToValueAtTime(f2,s+d);e.gain.setValueAtTime(v,s);e.gain.exponentialRampToValueAtTime(.001,s+d);o.connect(e);e.connect(m);o.start(s);o.stop(s+d)};
  const ns=(d,v,a,b)=>{const x=g();if(!x||!on)return;const l=x.sampleRate*d|0,B=x.createBuffer(1,l,x.sampleRate),D=B.getChannelData(0);for(let i=0;i<l;i++)D[i]=Math.random()*2-1;
    const s=x.createBufferSource(),f=x.createBiquadFilter(),e=x.createGain(),t=x.currentTime;s.buffer=B;f.type='bandpass';f.frequency.setValueAtTime(a,t);f.frequency.exponentialRampToValueAtTime(b,t+d);e.gain.setValueAtTime(v,t);e.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(f);f.connect(e);e.connect(m);s.start()};
  const S={start:()=>{n(660,'sine',.12,.25);n(990,'sine',.18,.25,.12)},ok:()=>{n(523,'triangle',.12,.3);n(784,'triangle',.25,.3,.1)},bad:()=>n(220,'sawtooth',.35,.2,0,90),
    nitro:()=>ns(.8,.5,300,3500),hit:()=>{ns(.4,.8,1500,100);n(100,'square',.3,.3,0,40)},
    win:()=>[523,659,784,1047,1319].forEach((f,i)=>n(f,'triangle',.3,.3,i*.14)),lose:()=>[392,330,262].forEach((f,i)=>n(f,'triangle',.5,.3,i*.28))};
  const bass=[55,55,82.4,55,65.4,65.4,98,65.4],arp=[220,262,330,262,196,247,294,247];
  const go=()=>{clearInterval(mi);if(want&&on)mi=setInterval(()=>{const i=st++%8;n(bass[i],'sawtooth',.22,.07);n(arp[i],'square',.14,.035)},240)};
  return{init:g,sfx:k=>S[k]&&S[k](),get on(){return on},mute:v=>{on=v;go()},music:v=>{want=v;go()}};
})();
addEventListener('pointerdown',()=>AUD.init());
document.body.insertAdjacentHTML('beforeend','<button id=mu class="b s g" style="position:fixed;left:8px;top:8px;z-index:9">🔊</button>');
$('#mu').onclick=e=>{AUD.mute(!AUD.on);e.target.textContent=AUD.on?'🔊':'🔇'};

/* ===== سباق السيارات: المضمارات + الرسم + المتجر + واجهة الطالب + شاشة المعلم ===== */
const TR=[
 {n:'صحراء الذهب',bg:'#d7b27a',ro:'#3b3b40',sc:'#a8743a',p:[[200,300],[300,120],[550,80],[800,150],[880,300],[780,470],[520,520],[300,470]]},
 {n:'مدينة النيون',bg:'#0a0f2a',ro:'#1c1f33',sc:'#e11d9c',p:[[150,150],[400,100],[500,250],[700,120],[880,220],[820,420],[600,500],[480,380],[300,520],[130,400]]},
 {n:'غابة الزمرد',bg:'#2f6b3a',ro:'#35353a',sc:'#14532d',p:[[120,300],[250,130],[450,200],[620,90],[850,160],[900,360],[700,420],[600,540],[380,470],[250,540]]},
 {n:'قمة الجليد',bg:'#e3eef8',ro:'#4a5160',sc:'#ffffff',p:[[100,200],[330,90],[560,190],[800,90],[920,260],[760,330],[900,480],[550,540],[320,430],[150,500]]}];
const CARS=[{n:'سبارك',pr:0,L:15,W:6.5},{n:'فالكون',pr:1500,L:16,W:7},{n:'فايبر',pr:4000,L:17,W:7.5},{n:'فانتوم',pr:9000,L:18,W:8},{n:'تيتان',pr:20000,L:19,W:8.5}];
const PARTS={e:'المحرك',t:'الإطارات',s:'عجلة القيادة',g:'الجير بوكس'};
const SW=['#ef4444','#f97316','#facc15','#22c55e','#06b6d4','#3b82f6','#a855f7','#ec4899','#f1f5f9','#111827'];
const sh=(h,p)=>{const n=parseInt(h.slice(1),16),f=v=>Math.max(0,Math.min(255,v+p));return`rgb(${f(n>>16)},${f(n>>8&255)},${f(n&255)})`};

/* فيزياء: نفس معادلة الخادم (ppos) حتى يرى الجميع الموضع نفسه */
const sp=(p,m)=>(p.spd+(m<p.bu?40:0))*(m<p.su?p.sf:1);
const pos=(p,t)=>{let a=p.t0;if(a==null)return p.d0||0;t=Math.max(t,a);let d=p.d0;const k=[p.bu,p.su].filter(x=>x>a&&x<t).sort((x,y)=>x-y);k.push(t);for(const b of k){d+=sp(p,(a+b)/2)*(b-a);a=b}return d};
let OFF=0;
const sync=async()=>{const a=Date.now(),{data}=await db.rpc('now_s');OFF=data*1000-(a+Date.now())/2};
const nowS=()=>(Date.now()+OFF)/1000;

function build(i){
  const T=TR[i]||TR[0]; if(T.pts)return T; const P=T.p.map(a=>[a[0]*1.3,a[1]*1.3]),n=P.length,pts=[];
  for(let k=0;k<n;k++){const a=P[(k+n-1)%n],b=P[k],c=P[(k+1)%n],e=P[(k+2)%n];
    for(let j=0;j<40;j++){const t=j/40,t2=t*t,t3=t2*t;
      pts.push([0,1].map(d=>.5*(2*b[d]+(-a[d]+c[d])*t+(2*a[d]-5*b[d]+4*c[d]-e[d])*t2+(-a[d]+3*b[d]-3*c[d]+e[d])*t3)))}}
  let L=0;const cum=[0];
  for(let k=1;k<=pts.length;k++){const a=pts[k-1],b=pts[k%pts.length];L+=Math.hypot(b[0]-a[0],b[1]-a[1]);cum.push(L)}
  T.pts=pts;T.cum=cum;T.L=L;T.kind=i;T.path=new Path2D();
  pts.forEach((p,k)=>k?T.path.lineTo(p[0],p[1]):T.path.moveTo(p[0],p[1]));T.path.closePath();
  T.sc2=[];let s=7;const r=()=>(s=s*16807%2147483647)/2147483647;
  for(let k=0;k<pts.length;k+=5){const a=pts[k],b=pts[(k+1)%pts.length],an=Math.atan2(b[1]-a[1],b[0]-a[0])+Math.PI/2,o=(r()<.5?-1:1)*(125+r()*150);T.sc2.push([a[0]+Math.cos(an)*o,a[1]+Math.sin(an)*o,3+r()*5])}
  return T;
}
function pt(T,s){
  s=((s%T.L)+T.L)%T.L;let lo=0,hi=T.cum.length-2;
  while(lo<hi){const m=(lo+hi+1)>>1;T.cum[m]<=s?lo=m:hi=m-1}
  const a=T.pts[lo],b=T.pts[(lo+1)%T.pts.length],f=(s-T.cum[lo])/((T.cum[lo+1]-T.cum[lo])||1);
  return[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,Math.atan2(b[1]-a[1],b[0]-a[0])];
}

function paint(c,T){
  c.fillStyle=T.bg;c.fillRect(0,0,1300,830);
  c.fillStyle=T.sc;c.globalAlpha=.8;T.sc2.forEach(z=>{c.beginPath();c.arc(z[0],z[1],z[2]*2,0,7);c.fill()});c.globalAlpha=1;c.lineJoin='round';
  c.strokeStyle='#f5f5f5';c.lineWidth=166;c.stroke(T.path);
  c.strokeStyle='#dc2626';c.setLineDash([26,26]);c.stroke(T.path);c.setLineDash([]);
  c.strokeStyle=T.ro;c.lineWidth=150;c.stroke(T.path);
  c.strokeStyle='#ffffff55';c.lineWidth=3;c.setLineDash([18,26]);c.stroke(T.path);c.setLineDash([]);
  const st=pt(T,0);c.save();c.translate(st[0],st[1]);c.rotate(st[2]);
  for(let i=0;i<8;i++)for(let j=0;j<2;j++){c.fillStyle=(i+j)%2?'#111':'#fff';c.fillRect(j*8-8,i*18.75-75,8,18.75)}c.restore();
}
function stat(T){if(T.cv)return;const S=1.5,cv=document.createElement('canvas');cv.width=1300*S;cv.height=830*S;const c=cv.getContext('2d');c.scale(S,S);paint(c,T);T.cv=cv}
function at(T,s){const q=pt(T,s),u=pt(T,s-14),v=pt(T,s+14);return[q[0],q[1],Math.atan2(v[1]-u[1],v[0]-u[0])]}
/* رسم السيارة (منظر علوي) */
function car(c,x,y,a,col,id,o={}){
  const M=CARS[id]||CARS[0],L=M.L,W=M.W;
  c.save();c.translate(x,y);c.rotate(a);
  c.fillStyle='#0006';c.beginPath();c.ellipse(1,2.5,L+2,W+3,0,0,7);c.fill();
  if(o.boost){c.fillStyle='#bae6fd55';c.beginPath();c.ellipse(0,0,L+7,W+7,0,0,7);c.fill();
    const g=c.createLinearGradient(-L,0,-L-30,0);g.addColorStop(0,'#fff');g.addColorStop(.3,'#38bdf8');g.addColorStop(1,'#0000');
    c.fillStyle=g;c.beginPath();c.moveTo(-L,-4.5);c.lineTo(-L-24-Math.random()*10,0);c.lineTo(-L,4.5);c.fill()}
  c.fillStyle='#0a0a0a';[[-L*.6,-W],[-L*.6,W],[L*.55,-W],[L*.55,W]].forEach(w=>c.fillRect(w[0]-4.5,w[1]-2.4,9,4.8));
  if(id==4){c.fillStyle='#22d3ee55';c.beginPath();c.ellipse(0,0,L+3,W+4,0,0,7);c.fill()}
  const g=c.createLinearGradient(0,-W,0,W);g.addColorStop(0,sh(col,55));g.addColorStop(.5,col);g.addColorStop(1,sh(col,-70));
  c.fillStyle=g;c.beginPath();c.roundRect(-L,-W,L*2,W*2,5);c.fill();
  if(id>=3){c.fillStyle='#ffffffaa';c.fillRect(-L,-1.2,L*2,2.4)}
  c.fillStyle='#0b1220dd';c.beginPath();c.roundRect(-L*.2,-W*.72,L*.62,W*1.44,3);c.fill();
  c.fillStyle='#ffffff30';c.fillRect(-L*.1,-W*.6,L*.25,W*.5);
  c.fillStyle='#fef08a';c.fillRect(L-2.5,-W+1,3,2.6);c.fillRect(L-2.5,W-3.6,3,2.6);
  c.fillStyle='#ef4444';c.fillRect(-L,-W+1,2,2.6);c.fillRect(-L,W-3.6,2,2.6);
  if(id>=2){c.fillStyle=sh(col,-90);c.fillRect(-L-2.5,-W-1,3.5,W*2+2)}
  if(o.me){c.strokeStyle='#facc15';c.lineWidth=1.6;c.beginPath();c.roundRect(-L-4,-W-4,L*2+8,W*2+8,8);c.stroke()}
  c.restore();
}

/* رسم المشهد كاملاً: o.follow = كاميرا تتبع سيارة الطالب، o.names = أسماء (شاشة المعلم) */
function render(c,W,H,T,P,t,o){
  const d=o.d||1;c.setTransform(1,0,0,1,0,0);c.fillStyle=T.bg;c.fillRect(0,0,W,H);
  const ps=[...P.values()].map(p=>({p,s:pos(p,t)})).sort((a,b)=>b.s-a.s),me=o.follow&&ps.find(z=>z.p.id==o.follow);
  let k;
  if(me){const q=at(T,me.s);k=W/400;c.translate(W/2,H*.7);c.rotate(-q[2]-Math.PI/2);c.scale(k,k);c.translate(-q[0],-q[1])}
  else{k=Math.min(W/1300,H/830);c.translate((W-1300*k)/2,(H-830*k)/2);c.scale(k,k)}
  stat(T);c.drawImage(T.cv,0,0,1300,830);
  ps.slice().reverse().forEach(z=>{
    const p=z.p,q=at(T,z.s),off=((p.lane??2)-2)*26,x=q[0]+Math.cos(q[2]+Math.PI/2)*off,y=q[1]+Math.sin(q[2]+Math.PI/2)*off,slow=t<p.su;
    if(slow){c.fillStyle='#ef444466';c.beginPath();c.arc(x,y,20+Math.sin(t*20)*4,0,7);c.fill()}
    c.globalAlpha=slow&&((t*12|0)%2)?.25:1;
    car(c,x,y,q[2],p.car?.c||'#888',p.car?.id||0,{boost:t<p.bu,me:p.id==o.follow});c.globalAlpha=1;
    if(o.names){c.fillStyle='#fff';c.strokeStyle='#000';c.lineWidth=3/k;c.font=`bold ${12/k}px Tahoma`;c.textAlign='center';c.strokeText(p.name,x,y-15);c.fillText(p.name,x,y-15)}
  });
  c.setTransform(1,0,0,1,0,0);c.direction='rtl';c.textAlign='right';
  if(me){
    const i=ps.indexOf(me);c.fillStyle='#000a';c.fillRect(W-172*d,8*d,164*d,62*d);
    c.fillStyle='#facc15';c.font=`bold ${22*d}px Tahoma`;c.fillText('المركز '+(i+1)+' / '+ps.length,W-16*d,36*d);
    c.fillStyle='#fff';c.font=`${16*d}px Tahoma`;c.fillText(Math.round(sp(me.p,t)*1.5)+' كم/س'+(t<me.p.bu?' 🔥':'')+(t<me.p.su?' 💥':''),W-16*d,60*d);
  }else if(ps.length){
    const n=Math.min(5,ps.length);c.fillStyle='#000a';c.fillRect(W-250*d,8*d,242*d,(14+n*26)*d);
    ps.slice(0,n).forEach((z,i)=>{c.fillStyle=['#facc15','#e2e8f0','#f59e0b','#fff','#fff'][i];c.font=`bold ${16*d}px Tahoma`;c.fillText((i+1)+'. '+z.p.name+' · '+Math.round(sp(z.p,t)*1.5),W-16*d,(34+i*26)*d)});
  }
}
function loop2(cv,getT,P,o){
  const f=()=>{if(!cv.isConnected||cv.style.display=='none')return;const d=Math.min(2,devicePixelRatio||1),w=cv.clientWidth*d|0,h=cv.clientHeight*d|0;
    if(cv.width!=w)cv.width=w;if(cv.height!=h)cv.height=h;const T=getT();if(T)render(cv.getContext('2d'),w,h,T,P,nowS(),{...o,d});requestAnimationFrame(f)};
  f();
}

/* ================= بوابة الطالب + المتجر ================= */
function student(){
  const sv=sessionStorage.getItem('pl');if(sv)return play(JSON.parse(sv));
  const c=new URLSearchParams(location.search).get('c')||'';
  view(`<div class="card c"><div class=big>🏎️</div><h1>سباق المعرفة</h1>
  <input id=nm placeholder="اسمك" maxlength=20><input id=pin placeholder="رمز سري من 4 أرقام (اخترعه أول مرة وتذكره)" inputmode=numeric maxlength=4>
  <input id=code placeholder="رمز اللعبة (للمسابقة الجماعية)" inputmode=numeric value="${esc(c)}">
  <button class=b id=go>ادخل السباق</button><button class="b g" id=so>🎯 تدريب فردي</button><button class="b g" id=sh>🏪 الكراج والمتجر</button><p id=er class=er></p><a class=sm href="#/t">دخول المعلم</a></div>`);
  const nm=()=>$('#nm').value.trim(),pn=()=>$('#pin').value.trim();
  $('#go').onclick=async()=>{const {data,error}=await db.rpc('join_session',{p_code:$('#code').value.trim(),p_name:nm(),p_pin:pn()});
    if(error||data?.error)return $('#er').textContent=error?.message||data.error;play(data)};
  $('#sh').onclick=async()=>{const {data,error}=await db.rpc('shop',{p_name:nm(),p_pin:pn(),p_act:'get',p_car:0,p_arg:''});
    error?$('#er').textContent=error.message:shopUI({name:nm(),pin:pn()},data)};
  $('#so').onclick=async()=>{
    const N=nm(),K=pn();if(!N||!/^\d{4}$/.test(K))return $('#er').textContent='اكتب اسمك ورمزك السري (4 أرقام) أولاً';
    const {data,error}=await db.rpc('practice_list');if(error)return $('#er').textContent=error.message;
    view(`<div class="card c"><h2>🎯 بنك الاختبارات</h2><p class=sm>اختر أي اختبار وتدرّب وحدك ضد منافسين آليين. تكسب 5 🪙 لكل إجابة صحيحة (حتى 100 يومياً)</p>${(data||[]).map(q=>`<div class=row><span>${esc(q.title)} (${q.n} سؤال)</span><button class="b s" data-a=go data-i=${q.id}>ابدأ</button></div>`).join('')||'<p>لا توجد اختبارات متاحة حالياً</p>'}<button class="b g" data-a=bk>رجوع</button></div>`);
    bind({go:async id=>{const {data:d,error:e}=await db.rpc('start_solo',{p_name:N,p_pin:K,p_quiz:id});if(e||d?.error)return alert(e?.message||d.error);play({...d,solo:true})},bk:student});
  };
}
function shopUI(u,f,msg){
  const g=f.garage[f.sel],act=async(a,car,arg)=>{const {data,error}=await db.rpc('shop',{p_name:u.name,p_pin:u.pin,p_act:a,p_car:car,p_arg:arg||''});error?shopUI(u,f,error.message):shopUI(u,data)};
  view(`<div class="card c"><h2>🏪 الكراج والمتجر</h2><h3>🪙 ${f.coins}</h3><p class=er>${esc(msg||'')}</p>
  <div class=g>${CARS.map((m,i)=>{const own=f.owned.includes(i);return`<div class=row style="flex-direction:column;${f.sel==i?'outline:3px solid #facc15':''}"><canvas data-c=${i} width=140 height=70></canvas><b>${m.n}</b>${own?`<button class="b s ${f.sel==i?'':'g'}" data-a=sel data-i=${i}>${f.sel==i?'✔ مختارة':'اختيار'}</button>`:`<button class="b s" data-a=buy data-i=${i}>شراء 🪙${m.pr}</button>`}</div>`}).join('')}</div>
  <h3>تعديل ${CARS[f.sel].n}</h3>${Object.entries(PARTS).map(([k,n])=>`<div class=row><span>${n}: ${'▰'.repeat(g[k])+'▱'.repeat(5-g[k])}</span>${g[k]<5?`<button class="b s" data-a=up data-i=${k}>+ 🪙${250*(g[k]+1)}</button>`:'<b>أقصى</b>'}</div>`).join('')}
  <p>اللون:</p><div>${SW.map(x=>`<button data-a=col data-i="${x}" style="background:${x};width:34px;height:34px;border-radius:50%;border:2px solid #fff;margin:3px"></button>`).join('')}<input type=color id=cc value="${g.c}" style="width:60px;padding:0"></div>
  <p class=sm>المحرك: سرعة أعلى · الإطارات: تقلل أثر الخطأ والضربات · عجلة القيادة: تخفف الإبطاء بعد الضربة · الجير بوكس: تسارع أكبر مع كل إجابة صحيحة</p>
  <button class=b data-a=bk>رجوع</button></div>`);
  document.querySelectorAll('[data-c]').forEach(cv=>{const i=+cv.dataset.c,c=cv.getContext('2d');c.translate(70,35);c.scale(2.3,2.3);car(c,0,0,0,f.garage[i]?.c||'#64748b',i,{})});
  $('#cc').onchange=e=>act('color',f.sel,e.target.value);
  bind({sel:i=>act('sel',+i),buy:i=>act('buy',+i),up:k=>act('up',f.sel,k),col:x=>act('color',f.sel,x),bk:student});
}

/* ================= لعب الطالب ================= */
async function play(p){
  sessionStorage.setItem('pl',JSON.stringify(p));clear();await sync();AUD.music(true);
  let S,answered=-1,cq=-1;const P=new Map();
  const leave=()=>{sessionStorage.removeItem('pl');clear();student()};
  view(`<canvas id=cv style="width:100%;height:42vh;border-radius:14px;display:block"></canvas><div id=q></div>`);
  const ui=h=>{const e=$('#q');if(e)e.innerHTML=h},wait=t=>ui(`<div class="card c"><h3>${esc(p.name)}</h3><p>${t}</p></div>`);
  const {data:ps}=await db.from('players').select('*').eq('session_id',p.sid);(ps||[]).forEach(x=>P.set(x.id,x));
  loop($('#cv'),()=>S&&build(S.track),P,{follow:p.pid});
  sub('players','session_id=eq.'+p.sid,e=>{const n=e.new;if(!n?.id)return;const o=P.get(n.id);if(o&&n.id==p.pid&&n.hit>o.hit)AUD.sfx('hit');P.set(n.id,n)});
  const send=async(q,ch,m)=>{
    answered=q.qi;clearInterval(tm);wait('تم إرسال إجابتك… 🏎️');
    const {data}=await db.rpc('submit_answer',{p_player:p.pid,p_choice:ch,p_qi:q.qi,p_map:m});
    if(data?.error){if(cq==q.qi)wait(esc(data.error))}else if(data){AUD.sfx(data.ok?'ok':'bad');if(data.boost)AUD.sfx('nitro');if(data.hit)AUD.sfx('hit');if(cq==q.qi)wait(data.ok?'✅ إجابة صحيحة!':'❌ إجابة خاطئة')}
    if(p.solo)await db.rpc('solo_next',{p_player:p.pid,p_qi:q.qi});
  };
  const showQ=async()=>{
    const {data:q}=await db.rpc('get_question',{p_session:p.sid});if(!q)return;
    if(cq!=q.qi)AUD.sfx('start');cq=q.qi;if(answered==q.qi)return wait('تم إرسال إجابتك… 🏎️');
    const t0=Date.now(),left=q.secs*1000-q.elapsed_ms,bar='<div class=bar><i id=tb></i></div>';
    clearInterval(tm);tm=setInterval(()=>{const r=left-(Date.now()-t0),b=$('#tb');if(b)b.style.width=Math.max(0,r/(q.secs*10))+'%';if(r<=0){clearInterval(tm);if(p.solo&&answered!=q.qi)db.rpc('solo_next',{p_player:p.pid,p_qi:q.qi})}},100);
    if(q.kind!='match'){
      ui(`<div class=card>${bar}<h3 class=c>${esc(q.q)}</h3><div class=g>${q.opts.map((o,i)=>`<button class=o data-i=${i} style="background:${COL[i]};padding:16px 6px;font-size:18px">${SH[i]} ${esc(o)}</button>`).join('')}</div></div>`);
      document.querySelectorAll('.o').forEach(b=>b.onclick=()=>{document.querySelectorAll('.o').forEach(x=>x.disabled=true);send(q,+b.dataset.i,null)});
    }else{
      const m=Array(q.lefts.length).fill(-1);let cur=-1;const st='width:100%;margin:4px 0;padding:12px 4px;font-size:16px;';
      const dr=()=>{
        ui(`<div class=card>${bar}<h3 class=c>${esc(q.q)}</h3><div class=g><div>${q.lefts.map((l,i)=>`<button class=o data-l=${i} style="${st}background:${m[i]>=0?COL[i%4]:'#475569'};${cur==i?'outline:4px solid #fff':''}">${esc(l)}</button>`).join('')}</div><div>${q.rights.map((r,j)=>{const o=m.indexOf(j);return`<button class=o data-r=${j} style="${st}background:${o>=0?COL[o%4]:'#475569'}">${esc(r)}</button>`}).join('')}</div></div><button class=b id=sb ${m.includes(-1)?'disabled':''}>إرسال ✔</button></div>`);
        document.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{cur=+b.dataset.l;dr()});
        document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{if(cur<0)return;const j=+b.dataset.r,o=m.indexOf(j);if(o>=0)m[o]=-1;m[cur]=j;cur=-1;dr()});
        $('#sb').onclick=()=>send(q,-1,m);
      };dr();
    }
  };
  const finish=async()=>{
    clearInterval(tm);
    const [{data:L},{data:R}]=await Promise.all([db.from('players').select('id').eq('session_id',p.sid).order('d0',{ascending:false}),db.rpc('my_review',{p_player:p.pid})]),rk=(L||[]).findIndex(x=>x.id==p.pid)+1;
    view(`<div class="card c"><div class=big>${['','🥇','🥈','🥉'][rk]||'🏁'}</div><h1>المركز ${rk}</h1>${rk&&rk<=3?`<h3>+${[300,200,100][rk-1]} 🪙 مكافأة</h3>`:''}<button class=b id=lv>خروج</button></div>
    <div class=card><h3 class=c>📝 مراجعة أخطائك</h3>${R?.length?R.map(x=>`<div class=row style="display:block"><b>${esc(x.q)}</b><br>${x.kind!='match'?`<span class=er>${x.mine?'إجابتك: '+esc(x.mine):'لم تجب'}</span><br>`:''}<span>✅ الصحيح: ${esc(x.right)}</span></div>`).join(''):'<p class=c>ما شاء الله، لا أخطاء! 🌟</p>'}</div>`);
    $('#lv').onclick=leave;AUD.sfx(rk&&rk<=3?'win':'lose');if(rk&&rk<=3)boom();
  };
  const upd=async()=>{
    const {data:s}=await db.from('sessions').select('*').eq('id',p.sid).maybeSingle();S=s;if(!s)return leave();
    if(s.state=='lobby'){if(p.solo)await db.rpc('solo_next',{p_player:p.pid,p_qi:-1});else wait('انتظر المعلم ليبدأ السباق 🏁 سيارتك على خط البداية')}
    else if(s.state=='question')await showQ();else await finish();
  };
  sub('sessions','id=eq.'+p.sid,upd);upd();
}

/* ================= المعلم: اختيار المضمار + شاشة السباق ================= */
async function run(id){
  const {data:qs}=await db.from('questions').select('*').eq('quiz_id',id).order('pos').order('id');
  if(!qs.length)return alert('أضف أسئلة أولاً');
  view(`<button class="b g s" id=bk>← رجوع</button><h2>🏁 اختر المضمار</h2><div class=g>${TR.map((t,i)=>`<div class=row style="flex-direction:column;cursor:pointer" data-a=t data-i=${i}><canvas width=300 height=190 data-t=${i} style="width:100%"></canvas><b>${t.n}</b></div>`).join('')}</div>`);
  document.querySelectorAll('[data-t]').forEach(cv=>render(cv.getContext('2d'),300,190,build(+cv.dataset.t),new Map,0,{}));
  $('#bk').onclick=teacher;
  bind({t:async i=>{
    const {data:s,error}=await db.from('sessions').insert({quiz_id:id,track:+i,code:String(100000+Math.random()*900000|0),total:qs.length}).select().single();
    error?alert(error.message):host(s,qs);
  }});
}
async function host(s,qs){
  clear();await sync();AUD.music(true);const P=new Map(),link=location.origin+location.pathname+'?c='+s.code;let ans=0;
  const {data:ps}=await db.from('players').select('*').eq('session_id',s.id);(ps||[]).forEach(p=>P.set(p.id,p));
  view(`<div id=top></div><canvas id=cv style="width:100%;height:60vh;border-radius:14px;display:block;margin-top:8px"></canvas>`);
  loop($('#cv'),()=>build(s.track),P,{names:1});
  const set=async(st,qi)=>{const {error}=await db.rpc('host_set',{p_session:s.id,p_state:st,p_qi:qi});if(error)return alert(error.message);s.state=st;s.qi=qi;ui()};
  let busy=false;
  const next=async()=>{
    if(busy)return;busy=true;clearInterval(tm);
    if(s.qi+1>=qs.length){await set('finished',s.qi);busy=false;return}
    ans=0;await set('question',s.qi+1);busy=false;AUD.sfx('start');const t0=Date.now(),q=qs[s.qi];
    tm=setInterval(()=>{const r=q.secs*1000-(Date.now()-t0),b=$('#tb'),tt=$('#tt');
      if(b)b.style.width=Math.max(0,r/(q.secs*10))+'%';if(tt)tt.textContent=Math.max(0,Math.ceil(r/1000));if(r<=0)next()},200);
  };
  const fin=()=>{if(confirm('إنهاء السباق الآن؟')){clearInterval(tm);set('finished',s.qi)}};
  const podium=async()=>{
    const {data:L}=await db.from('players').select('*').eq('session_id',s.id).order('d0',{ascending:false}),t=L.slice(0,3);
    view(`<div class=c><h1 style="font-size:44px">🏆 الفائزون 🏆</h1><div class=pod>${[1,0,2].map(i=>t[i]?`<div style="height:${[300,220,160][i]}px;background:${['#facc15','#cbd5e1','#d97706'][i]};color:#222"><canvas data-c=${i} width=120 height=60></canvas><br>${['🥇','🥈','🥉'][i]}<br>${esc(t[i].name)}<br>+${[300,200,100][i]} 🪙</div>`:'<div style="background:none"></div>').join('')}</div>
    <button class=b data-a=r>📊 التقرير</button><button class="b g" data-a=h>الرئيسية</button></div>`);
    document.querySelectorAll('[data-c]').forEach(cv=>{const i=+cv.dataset.c,c=cv.getContext('2d');c.translate(60,30);c.scale(2,2);car(c,0,0,0,t[i].car?.c||'#888',t[i].car?.id||0,{})});
    bind({r:()=>report(s.id),h:teacher});AUD.sfx('win');boom();
  };
  const ui=()=>{
    const q=qs[s.qi];let h;
    if(s.state=='finished')return podium();
    if(s.state=='lobby')h=`<div class="card w c"><div>ادخلوا من الرابط أو اكتبوا الرمز: <b dir=ltr>${esc(link)}</b></div><div class=code>${s.code}</div><b>👥 ${P.size} متسابق</b><div>${[...P.values()].map(p=>`<span class=row style="display:inline-flex">${esc(p.name)} <button class="b s r" data-a=k data-i=${p.id}>✖</button></span>`).join(' ')}</div><button class=b data-a=n>🚀 ابدأ السباق</button></div>`;
    else{const rt=a=>a.slice(1).concat(a.slice(0,1)),bx=x=>`<div class=o style="background:#475569;margin:4px">${esc(x)}</div>`;
      h=`<div class="card w"><div class=bar><i id=tb></i></div><div style="display:flex;justify-content:space-between"><b>سؤال ${s.qi+1} من ${qs.length}</b><b id=tt style="font-size:28px">${q.secs}</b><b>✋ <span id=an>0/${P.size}</span></b></div><h2 class=c>${esc(q.q)}</h2>${q.kind=='match'?`<div class=g><div>${q.opts.map(x=>bx(x[0])).join('')}</div><div>${rt(q.opts.map(x=>x[1])).map(bx).join('')}</div></div>`:`<div class=g>${q.opts.map((o,i)=>`<div class=o style="background:${COL[i]}">${SH[i]} ${esc(o)}</div>`).join('')}</div>`}<button class="b g" data-a=n>⏭ تخطي السؤال</button><button class="b r s" data-a=f>🏁 إنهاء السباق</button></div>`}
    $('#top').innerHTML=h;
    bind({k:id=>db.from('players').delete().eq('id',id).then(()=>{P.delete(id);ui()}),n:next,f:fin});
  };
  sub('players','session_id=eq.'+s.id,e=>{const p=e.new;if(!p?.id)return;const o=P.get(p.id);if(o&&p.hit>o.hit)AUD.sfx('hit');if(o&&p.bu>o.bu)AUD.sfx('nitro');P.set(p.id,p);if(s.state=='lobby')ui()});
  sub('answers','session_id=eq.'+s.id,e=>{
    if(e.new?.qi!=s.qi)return;ans++;const el=$('#an');if(el)el.textContent=ans+'/'+P.size;
    if(s.state=='question'&&P.size&&ans>=P.size)next();
  });
  ui();
}
addEventListener('hashchange',route);route();
