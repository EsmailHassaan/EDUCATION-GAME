/* ===== العرض ثلاثي الأبعاد (three.js + نماذج Kenney) — يعود تلقائياً للرسم القديم عند أي مشكلة ===== */
const MF=['kart-oobi','hatchback-sports','sedan-sports','race','race-future']; // السيارات حسب رقمها في المتجر
const FLIP=new URLSearchParams(location.search).get('flip')=='1';             // إذا ظهرت السيارات تمشي للخلف افتح الرابط مع &flip=1
const LOW=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
let M3=null,G3=null;
const SK={};

const rgb2hsv=(r,g,b)=>{r/=255;g/=255;b/=255;const M=Math.max(r,g,b),m=Math.min(r,g,b),d=M-m;let h=0;if(d){h=M==r?((g-b)/d+6)%6:M==g?(b-r)/d+2:(r-g)/d+4;h/=6}return[h,M?d/M:0,M]};
const hsv2rgb=(h,s,v)=>{const f=n=>{const k=(n+h*6)%6;return(v-v*s*Math.max(0,Math.min(k,4-k,1)))*255};return[f(5),f(3),f(1)]};

function prep(sc,len){
  const b=new THREE.Box3().setFromObject(sc),z=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3()),g=new THREE.Group(),inn=new THREE.Group();
  sc.position.set(-c.x,-b.min.y,-c.z);inn.add(sc);inn.scale.setScalar(len/Math.max(z.x,z.z));
  inn.rotation.y=(z.z>z.x?Math.PI/2:0)+(FLIP?Math.PI:0);g.add(inn);return g;
}
/* لون الطلاء الأصلي للنموذج (لتغييره حسب اختيار الطالب في المتجر) */
function baseHue(sc){
  try{
    let best=null,n=0;sc.traverse(o=>{if(o.isMesh&&o.geometry.attributes.uv&&!/wheel|tire/i.test(o.name)){const c=o.geometry.attributes.uv.count;if(c>n){n=c;best=o}}});
    const im=best?.material.map?.image;if(!im)return null;
    const cv=document.createElement('canvas'),w=cv.width=im.width,h=cv.height=im.height,x=cv.getContext('2d');x.drawImage(im,0,0);
    const d=x.getImageData(0,0,w,h).data,uv=best.geometry.attributes.uv,H=new Array(36).fill(0);
    for(let i=0;i<uv.count;i++){const px=Math.min(w-1,Math.max(0,uv.getX(i)*w|0)),py=Math.min(h-1,Math.max(0,uv.getY(i)*h|0)),o=(py*w+px)*4,q=rgb2hsv(d[o],d[o+1],d[o+2]);if(q[1]>.3&&q[2]>.25)H[q[0]*36|0]++}
    const mx=Math.max(...H);return mx?(H.indexOf(mx)+.5)/36:null;
  }catch(e){return null}
}
function skin(nm,col,base){
  if(!base.map)return base;const key=nm+col+base.uuid;if(SK[key])return SK[key];
  const m=base.clone(),hue=M3[nm].userData.hue,im=base.map.image;
  if(hue!=null&&im){try{
    const cv=document.createElement('canvas'),w=cv.width=im.width,h=cv.height=im.height,x=cv.getContext('2d');x.drawImage(im,0,0);
    const id=x.getImageData(0,0,w,h),d=id.data,n=parseInt(col.slice(1),16),T=rgb2hsv(n>>16,n>>8&255,n&255),k=Math.max(.15,Math.min(1.25,T[2]/.85));
    for(let i=0;i<d.length;i+=4){const q=rgb2hsv(d[i],d[i+1],d[i+2]);if(q[1]>.3&&q[2]>.2){const dh=Math.abs(q[0]-hue);if(Math.min(dh,1-dh)<.06){const r=hsv2rgb(T[0],T[1],Math.min(1,q[2]*k));d[i]=r[0];d[i+1]=r[1];d[i+2]=r[2]}}}
    x.putImageData(id,0,0);const t=new THREE.CanvasTexture(cv);t.flipY=false;t.encoding=THREE.sRGBEncoding;t.anisotropy=4;m.map=t;
  }catch(e){}}
  return SK[key]=m;
}
function load3(){
  if(G3)return G3;
  return G3=new Promise(res=>{
    if(!window.THREE||!THREE.GLTFLoader)return res(null);
    const ld=new THREE.GLTFLoader(),M={};
    Promise.all(MF.concat(['cone']).map(n=>new Promise(r=>ld.load('models/'+n+'.glb',g=>{M[n]=prep(g.scene,n=='cone'?14:38);r()},undefined,()=>r())))).then(()=>{
      if(!MF.every(n=>M[n]))return res(null);MF.forEach(n=>M[n].userData.hue=baseHue(M[n]));M3=M;res(M);
    });
  });
}

function ribbon(T,w0,w1,y,col){
  const P=T.pts,N=P.length,pos=[],cl=[],idx=[];
  for(let i=0;i<N;i++){const a=P[(i+N-1)%N],b=P[(i+1)%N],tx=b[0]-a[0],ty=b[1]-a[1],l=Math.hypot(tx,ty)||1,nx=-ty/l,ny=tx/l;
    pos.push(P[i][0]+nx*w0,y,P[i][1]+ny*w0,P[i][0]+nx*w1,y,P[i][1]+ny*w1);
    if(col){const c=col(i);cl.push(c.r,c.g,c.b,c.r,c.g,c.b)}}
  for(let i=0;i<N;i++){const a=i*2,b=((i+1)%N)*2;idx.push(a,b,a+1,a+1,b,b+1)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  if(col)g.setAttribute('color',new THREE.Float32BufferAttribute(cl,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function scenery(T,sc){
  const A=T.sc2,K=T.kind,n=A.length,d=new THREE.Object3D(),std=c=>new THREE.MeshStandardMaterial({color:c,roughness:1,flatShading:true});
  const mk=(geo,mat,fn)=>{const im=new THREE.InstancedMesh(geo,mat,n);A.forEach((z,i)=>{d.rotation.set(0,0,0);d.scale.set(1,1,1);fn(z);d.updateMatrix();im.setMatrixAt(i,d.matrix)});im.castShadow=!LOW;sc.add(im)};
  if(K==0)mk(new THREE.DodecahedronGeometry(1),std(0x9a6b3c),z=>{d.position.set(z[0],z[2],z[1]);d.scale.set(z[2]*2.4,z[2]*1.6,z[2]*2)});
  else if(K==1){mk(new THREE.CylinderGeometry(1.2,1.6,80,6),std(0x20243a),z=>d.position.set(z[0],40,z[1]));
    mk(new THREE.SphereGeometry(8,8,8),new THREE.MeshBasicMaterial({color:0xff2bd6}),z=>d.position.set(z[0],84,z[1]))}
  else{const s=z=>z[2]/5;
    mk(new THREE.CylinderGeometry(2,3,18,6),std(0x6b4423),z=>{d.position.set(z[0],9*s(z),z[1]);d.scale.setScalar(s(z))});
    mk(new THREE.ConeGeometry(14,44,8),std(K==2?0x1f7a3a:0xeaf4ff),z=>{d.position.set(z[0],(18+22)*s(z),z[1]);d.scale.setScalar(s(z))})}
}
function setup(sc,R,T,M){
  const K=T.kind,S=[['#5fb4f0','#d7e9f7'],['#05081c','#222a66'],['#5aa9e6','#cfe8f7'],['#a9c9e8','#f1f7fc']][K];
  const bc=document.createElement('canvas');bc.width=2;bc.height=256;const bx=bc.getContext('2d'),gr=bx.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,S[0]);gr.addColorStop(1,S[1]);bx.fillStyle=gr;bx.fillRect(0,0,2,256);
  const bt=new THREE.CanvasTexture(bc);bt.encoding=THREE.sRGBEncoding;sc.background=bt;sc.fog=new THREE.Fog(S[1],1100,4500);
  sc.add(new THREE.HemisphereLight(K==1?0x6677cc:0xffffff,0x555555,K==1?.55:.85));
  const sun=new THREE.DirectionalLight(K==1?0x9fb0ff:0xfff4e0,K==1?.6:1.1);sun.position.set(950,900,800);sun.target.position.set(650,0,415);sc.add(sun,sun.target);
  const gm=new THREE.Mesh(new THREE.PlaneGeometry(7000,7000).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:T.bg,roughness:1}));gm.position.set(650,0,415);
  const rm=new THREE.Mesh(ribbon(T,-75,75,.6),new THREE.MeshStandardMaterial({color:T.ro,roughness:.85,side:THREE.DoubleSide}));
  const km=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7,side:THREE.DoubleSide}),RED=new THREE.Color(0xdc2626),WH=new THREE.Color(0xf5f5f5),RC=new THREE.Color(T.ro);
  const kc=i=>(i/3|0)%2?RED:WH,dc=i=>i%8<4?WH:RC;
  sc.add(gm,rm,new THREE.Mesh(ribbon(T,75,88,.9,kc),km),new THREE.Mesh(ribbon(T,-88,-75,.9,kc),km),new THREE.Mesh(ribbon(T,-2,2,1.2,dc),km));
  if(!LOW){R.shadowMap.enabled=true;sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);const c=sun.shadow.camera;c.left=-850;c.right=850;c.top=700;c.bottom=-700;c.near=100;c.far=3000;gm.receiveShadow=rm.receiveShadow=true}
  /* خط البداية وبوابة */
  const st=pt(T,0),sa=at(T,0)[2],gp=new THREE.Group();gp.position.set(st[0],0,st[1]);gp.rotation.y=-sa;
  const ck=document.createElement('canvas');ck.width=2;ck.height=8;const cx=ck.getContext('2d');
  for(let i=0;i<8;i++)for(let j=0;j<2;j++){cx.fillStyle=(i+j)%2?'#111':'#fff';cx.fillRect(j,i,1,1)}
  const ct=new THREE.CanvasTexture(ck);ct.magFilter=THREE.NearestFilter;ct.encoding=THREE.sRGBEncoding;
  const sl=new THREE.Mesh(new THREE.PlaneGeometry(16,150).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:ct}));sl.position.y=1.5;gp.add(sl);
  const pm=new THREE.MeshStandardMaterial({color:0x222222});
  [-92,92].forEach(z=>{const p=new THREE.Mesh(new THREE.BoxGeometry(6,60,6),pm);p.position.set(0,30,z);gp.add(p)});
  const bn=new THREE.Mesh(new THREE.BoxGeometry(10,14,190),new THREE.MeshStandardMaterial({color:0xdc2626,emissive:0x550000}));bn.position.y=62;gp.add(bn);sc.add(gp);
  scenery(T,sc);
  if(M.cone)for(let i=0;i<T.pts.length;i+=12)[-1,1].forEach(sd=>{const a=T.pts[i],b=T.pts[(i+1)%T.pts.length],tx=b[0]-a[0],ty=b[1]-a[1],l=Math.hypot(tx,ty)||1,c=M.cone.clone(true);c.position.set(a[0]-ty/l*98*sd,0,a[1]+tx/l*98*sd);sc.add(c)});
}
function label(txt){
  const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.font='bold 34px Tahoma';x.textAlign='center';x.lineWidth=6;x.strokeStyle='#000';x.fillStyle='#fff';x.strokeText(txt,128,44);x.fillText(txt,128,44);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));s.scale.set(70,17.5,1);s.position.y=32;return s;
}
function mkCar(p,o){
  const id=Math.min(4,p.car?.id||0),nm=MF[id],g=new THREE.Group(),m=M3[nm].clone(true),col=p.car?.c||'#ef4444';
  m.traverse(x=>{if(x.isMesh){x.material=skin(nm,col,x.material);x.castShadow=!LOW}});g.add(m);
  const fl=new THREE.Mesh(new THREE.ConeGeometry(4.5,24,10),new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.85}));fl.rotation.z=Math.PI/2;fl.position.set(-30,7,0);fl.visible=false;g.add(fl);
  const ring=new THREE.Mesh(new THREE.RingGeometry(27,33,32),new THREE.MeshBasicMaterial({color:0xfacc15,side:THREE.DoubleSide,transparent:true,opacity:.8}));ring.rotation.x=-Math.PI/2;ring.position.y=.3;ring.visible=false;g.add(ring);
  if(o.names)g.add(label(p.name));
  return{g,fl,ring};
}

function loop3(cv,M,getT,P,o){
  const c3=document.createElement('canvas');c3.style.cssText=cv.style.cssText;
  const wrap=document.createElement('div'),hud=document.createElement('div');wrap.style.position='relative';
  hud.style.cssText='position:absolute;top:8px;right:8px;background:#000a;color:#fff;padding:8px 12px;border-radius:10px;font:bold 15px Tahoma;direction:rtl;text-align:right;pointer-events:none;line-height:1.6';
  wrap.append(c3,hud);cv.after(wrap);
  let R;try{R=new THREE.WebGLRenderer({canvas:c3,antialias:!LOW})}catch(e){wrap.remove();throw e}
  R.outputEncoding=THREE.sRGBEncoding;R.setPixelRatio(Math.min(LOW?1.5:2,devicePixelRatio||1));
  const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(50,1,1,7000),obj=new Map(),look=new THREE.Vector3(),cp=new THREE.Vector3();
  let T0=null,shown=false,tick=0,W=0,H=0,init=false;
  const fail=e=>{console.warn('3D off',e);try{R.dispose()}catch(_){}wrap.remove();cv.style.display='';loop2(cv,getT,P,o)};
  const f=()=>{
    if(!c3.isConnected){R.dispose();R.forceContextLoss();return}
    try{
      const T=getT();
      if(T){
        if(T!==T0){T0=T;setup(sc,R,T,M)}
        const w=c3.clientWidth,h=c3.clientHeight;if(w!=W||h!=H){W=w;H=h;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
        const t=nowS(),ps=[...P.values()].map(p=>({p,s:pos(p,t)})).sort((a,b)=>b.s-a.s);let me=null;
        obj.forEach((ob,id)=>{if(!P.has(id)){sc.remove(ob.g);obj.delete(id)}});
        ps.forEach(z=>{
          const p=z.p;let ob=obj.get(p.id);if(!ob){ob=mkCar(p,o);obj.set(p.id,ob);sc.add(ob.g)}
          const q=at(T,z.s),off=((p.lane??2)-2)*26,x=q[0]+Math.cos(q[2]+Math.PI/2)*off,y=q[1]+Math.sin(q[2]+Math.PI/2)*off,slow=t<p.su,isMe=p.id==o.follow;
          ob.g.position.set(x,1,y);ob.g.rotation.y=-q[2];ob.g.visible=!(slow&&((t*12|0)%2));
          ob.fl.visible=t<p.bu;ob.fl.scale.x=.8+Math.random()*.5;
          ob.ring.visible=slow||isMe;ob.ring.material.color.set(slow?0xef4444:0xfacc15);
          if(isMe)me={x,y,q,z,p};
        });
        if(me){
          const fx=Math.cos(me.q[2]),fz=Math.sin(me.q[2]);cp.set(me.x-fx*135,62,me.y-fz*135);look.set(me.x+fx*70,6,me.y+fz*70);
          if(!init){cam.position.copy(cp);init=true}cam.position.lerp(cp,.25);cam.lookAt(look);
          cam.fov=60+Math.min(14,Math.max(0,(sp(me.p,t)-60)*.1));cam.updateProjectionMatrix();
        }else{cam.fov=50;cam.updateProjectionMatrix();cam.position.set(650,830,1010);cam.lookAt(650,0,380)}
        if(tick++%8==0)hud.innerHTML=me?`<span style="color:#facc15;font-size:20px">المركز ${ps.indexOf(me.z)+1} / ${ps.length}</span><br>${Math.round(sp(me.p,t)*1.5)} كم/س${t<me.p.bu?' 🔥':''}${t<me.p.su?' 💥':''}`
          :ps.slice(0,5).map((z,i)=>`${i+1}. ${esc(z.p.name)} · ${Math.round(sp(z.p,t)*1.5)}`).join('<br>');
        R.render(sc,cam);
        if(!shown){shown=true;cv.style.display='none'}
      }
    }catch(e){return fail(e)}
    requestAnimationFrame(f);
  };
  f();
}
/* نقطة الدخول: يبدأ الرسم القديم فوراً ثم يستبدله بالثلاثي الأبعاد إذا نجح التحميل */
function loop(cv,getT,P,o){
  loop2(cv,getT,P,o);
  if(typeof load3=='function')load3().then(M=>{if(M&&cv.isConnected)try{loop3(cv,M,getT,P,o)}catch(e){console.warn('3D off',e)}});
}
