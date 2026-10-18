// Classic studio: smart building generator + clean UV atlas
import * as THREE from 'three';
import { clamp } from '../core/dom.js';
import { D, PAL, rgb } from './params.js';

let OPN = [], Q, F, LV, R = 2048, dens = 0, nIsl = 0, ISL = [];
const FS=[[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]];
const AX=[[2,1],[2,1],[0,2],[0,2],[0,1],[0,1]];let bid=0;
let GP={};const LBL={f:'FRONT FACADE',b:'BACK FACADE',r:'RIGHT FACADE',l:'LEFT FACADE',Rf:'ROOF SLOPE FRONT',Rb:'ROOF SLOPE BACK',Rr:'ROOF SLOPE RIGHT',Rl:'ROOF SLOPE LEFT',T:'ROOF TOP',Bf:'BALCONY RAILS FRONT',Bb:'BALCONY RAILS BACK',Br:'BALCONY RAILS RIGHT',Bl:'BALCONY RAILS LEFT',C:'CORNICE',D:'DORMERS',H:'CHIMNEYS'};
function box(c,h,ty,tag){const g=GP[tag]=GP[tag]||{x:0,y:0,r:0};FS.forEach((f,i)=>{if(i==3)return;const a=h[AX[i][0]]*2,b=h[AX[i][1]]*2;if(g.x+a>8){g.x=0;g.y+=g.r+.1;g.r=0}const X=g.x,Y=g.y;g.x+=a+.1;g.r=Math.max(g.r,b);Q.push({p:f.map(v=>[c[0]+v[0]*h[0],c[1]+v[1]*h[1],c[2]+v[2]*h[2]]),u:[[X,Y],[X+a,Y],[X+a,Y+b],[X,Y+b]],isl:tag,type:Array.isArray(ty)?ty[i]:ty,side:''})})}
const fKey=(i)=>{const x=Math.sin((i+1)*12.9898+D.seed*78.233)*43758.5453;return x-Math.floor(x)};
const fMode=(i,nF)=>!D.prog?null:i==0?'arch':((i==1&&nF>3)||(i==nF-1&&nF>2))?'cont':(i%2&&D.bal?'bal':'plain');
function gen(){Q=[];F={};LV=[];bid=0;GP={};OPN=[];let s=D.seed;const rnd=()=>(s=s*16807%2147483647)/2147483647;
const {w,d,fh,gh,mh}=D,nF=D.floors,Ht=gh+(nF-1)*fh,hip=D.roof=='hip',ms=D.roof=='mansard'||hip;
for(const [sd,n,L,hn] of [['f',[0,0,1],w,d/2],['b',[0,0,-1],w,d/2],['r',[1,0,0],d,w/2],['l',[-1,0,0],d,w/2]]){
const dir=[n[2],0,-n[0]],o=[n[0]*hn-dir[0]*L/2,0,n[2]*hn-dir[2]*L/2];F[sd]={o,dir,L,n};
const pt=(u,v)=>[o[0]+dir[0]*u,v,o[2]+dir[2]*u];
const q=(u0,v0,u1,v1,t)=>{if(u1-u0>.02&&v1-v0>.02)Q.push({p:[pt(u0,v0),pt(u1,v0),pt(u1,v1),pt(u0,v1)],u:[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],isl:sd,type:t,side:sd})};
const nb=Math.max(2,Math.round(L/D.bay));let y=0;
for(let i=0;i<nF;i++){const y0=y,y1=y+(i?fh:gh);y=y1;if(sd=='f')LV[i]=[y0,y1];const gr=!i,top=i==nF-1,pm=fMode(i,nF);let ops=[];
for(let k=0;k<nb;k++){const c=(k+.5)*L/nb,bw=L/nb;ops.push(gr&&sd=='f'&&k==nb-1?{c,w:1.5,a:y0,b:y0+2.8,t:'door'}:{c,w:Math.min(gr?1.7:1.15,bw*.5),a:gr||top?y0+.9:y0+.15,b:gr?y0+2.9:top?y0+2.2:y0+2.75,t:'win'})}
for(const m of D.custom)if(m.s==sd&&m.l==i){let nr=null,dm=9;ops.forEach(p=>{const e=Math.abs(p.c-m.c);if(e<dm){dm=e;nr=p}});
if(m.t=='del'){if(nr&&dm<1)ops=ops.filter(p=>p!=nr)}else if(m.t=='bal'){if(nr&&dm<1.4)nr.bal=1}
else if(!nr||dm>(nr.w+1.3)/2+.1){const c=clamp(m.c,.9,L-.9);ops.push(m.t=='door'&&gr?{c,w:1.5,a:y0,b:y0+2.8,t:'door'}:{c,w:1.15,a:y0+.15,b:y0+2.75,t:'win'})}}
ops.sort((a,b)=>a.c-b.c);const wt=gr?'stone':'wall';
if(!ops.length){q(0,y0,L,y1,wt);continue}
const lo=Math.min(...ops.map(p=>p.a)),hi=Math.max(...ops.map(p=>p.b));q(0,y0,L,lo,wt);q(0,hi,L,y1,wt);let x=0;
for(const p of ops){const l=p.c-p.w/2,r=p.c+p.w/2;q(x,lo,l,hi,wt);q(l,lo,r,p.a,wt);q(l,p.b,r,hi,wt);q(l,p.a,r,p.b,p.t);x=r;const hb=D.prog?((pm=='bal'&&p.t=='win')||p.bal):((D.bal&&i>0&&!top&&p.t=='win')||p.bal);OPN.push({n,dir,p:pt(p.c,p.a),w:p.w,h:p.b-p.a,t:p.t,bal:hb?1:0,fk:fKey(i),m:p.t=='win'?(hb?'bal':(pm||'plain')):null});
if(hb){const bh=(p.w+.5)/2,m=pt(p.c,p.a+.45),z=n[2]!=0;box([m[0]+n[0]*.18,m[1],m[2]+n[2]*.18],[z?bh:.18,.45,z?.18:bh],'bal','B'+sd)}}
q(x,lo,L,hi,wt)}}
box([0,Ht-.1,d/2+.05],[w/2+.25,.25,.25],'cor','C');box([0,Ht-.1,-d/2-.05],[w/2+.25,.25,.25],'cor','C');box([w/2+.05,Ht-.1,0],[.25,.25,d/2+.25],'cor','C');box([-w/2-.05,Ht-.1,0],[.25,.25,d/2+.25],'cor','C');
const ins=ms?(hip?Math.min(w,d)/2:Math.min(1.8,w/4,d/4)):0,H=ms?Ht+mh:Ht;
if(ms){for(const sd in F){const {o,dir,L,n}=F[sd],A=[o[0],Ht,o[2]],B=[o[0]+dir[0]*L,Ht,o[2]+dir[2]*L],C=[B[0]-dir[0]*ins-n[0]*ins,H,B[2]-dir[2]*ins-n[2]*ins],E=[A[0]+dir[0]*ins-n[0]*ins,H,A[2]+dir[2]*ins-n[2]*ins],sl=Math.hypot(mh,ins);
Q.push({p:[A,B,C,E],u:[[0,0],[L,0],[L-ins,sl],[ins,sl]],isl:'R'+sd,type:'roof',side:'roof'});
if(!hip&&(sd=='f'||sd=='b')){const nd=Math.max(1,Math.floor(L/4.2));for(let j=0;j<nd;j++){if(rnd()<.12)continue;const c=(j+.5)*L/nd,ty=Array(6).fill('dorm');ty[sd=='f'?4:5]='win';
box([o[0]+dir[0]*c-n[0]*ins*.4,Ht+mh*.4-.1,o[2]+dir[2]*c-n[2]*ins*.4],[.65,1,.5],ty,'D')}}}}
const hx=w/2-ins,hz=d/2-ins;if(!hip)Q.push({p:[[-hx,H,hz],[hx,H,hz],[hx,H,-hz],[-hx,H,-hz]],u:[[0,0],[2*hx,0],[2*hx,2*hz],[0,2*hz]],isl:'T',type:'roof',side:'roof'});
const nc=2+(rnd()>.6?1:0);for(let j=0;j<nc;j++)box([(rnd()-.5)*(w-2*ins-2),H+1.2,(j%2?1:-1)*(d/2-ins-.7)],[.7,1.6,.45],'chim','H')}
function pack(){const I={};Q.forEach(q=>{const o=I[q.isl]=I[q.isl]||{q:[],a:1e9,b:1e9,c:-1e9,d:-1e9};o.q.push(q);q.u.forEach(([u,v])=>{o.a=Math.min(o.a,u);o.b=Math.min(o.b,v);o.c=Math.max(o.c,u);o.d=Math.max(o.d,v)})});
const L=Object.values(I).sort((x,y)=>(y.d-y.b)-(x.d-x.b)),pad=8;let ar=0;L.forEach(o=>ar+=(o.c-o.a+.1)*(o.d-o.b+.1));let s=Math.sqrt(R*R*.72/ar);
for(;;){let x=pad,y=pad,rh=0,ok=true;for(const o of L){const W=(o.c-o.a)*s+pad,Hh=(o.d-o.b)*s+pad;if(x+W>R){x=pad;y+=rh;rh=0}o.x=x;o.y=y;x+=W;rh=Math.max(rh,Hh);if(y+Hh>R){ok=false;break}}if(ok)break;s*=.96}
Q.forEach(q=>{const o=I[q.isl];q.a=q.u.map(([u,v])=>[o.x+(u-o.a)*s,o.y+(o.d-v)*s])});dens=s;nIsl=L.length;ISL=L}
function cvs(){const c=document.createElement('canvas');c.width=c.height=R;return c}
function drawGuide(){const c=cvs(),x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,R,R);for(const q of Q){x.fillStyle=x.strokeStyle=PAL[q.type];x.beginPath();q.a.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fill();x.lineWidth=2;x.stroke()}return c}
function drawUV(){const c=cvs(),x=c.getContext('2d');x.fillStyle='#101014';x.fillRect(0,0,R,R);x.lineWidth=1;for(const q of Q){x.fillStyle=PAL[q.type]+'66';x.strokeStyle='#8fd3ff44';x.beginPath();q.a.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fill();x.stroke()}
x.lineWidth=3;x.strokeStyle='#fff';x.font='bold '+Math.round(R/64)+'px sans-serif';const fs=R/50;for(const o of ISL){const X=o.x,Y=o.y,W=(o.c-o.a)*dens,H=(o.d-o.b)*dens,t=LBL[o.k]||o.k;x.strokeRect(X,Y,W,H);x.fillStyle='#000c';x.fillRect(X+3,Y+3,Math.min(x.measureText(t).width+14,W-6),fs);x.fillStyle='#fff';x.fillText(t,X+9,Y+3+fs*.75)}return c}

function makeGeo() {
  gen(); pack(); const P = [], Uv = [], C = [], WU = [], WS = [], cnt = [0, 0, 0, 0];
  const MI = { win: D.fxGlass ? 1 : 0, wall: D.fxConc ? 2 : 0, stone: D.fxConc ? 2 : 0, cor: D.fxConc ? 2 : 0, roof: D.fxRoof && D.roof != 'flat' ? 3 : 0 };
  const S2 = [...Q].filter((q) => !(D.models && ((q.side && (q.type == 'win' || q.type == 'door')) || q.type == 'bal'))).sort((a, b) => (MI[a.type] || 0) - (MI[b.type] || 0));
  for (const q of S2) {
    const m = MI[q.type] || 0; cnt[m] += 6; const c = rgb(PAL[q.type]);
    const cx = (q.p[0][0] + q.p[2][0]) / 2, cy = (q.p[0][1] + q.p[2][1]) / 2, cz = (q.p[0][2] + q.p[2][2]) / 2;
    const id = (Math.sin(cx * 12.9898 + cz * 78.233 + cy * 37.719) * 43758.5453) % 1, sw = q.u[2][0] - q.u[0][0], sh = q.u[2][1] - q.u[0][1];
    for (const i of [0,1,2,0,2,3]) { P.push(...q.p[i]); Uv.push(q.a[i][0]/R, 1 - q.a[i][1]/R); C.push(...c); WU.push(q.u[i][0] - q.u[0][0], q.u[i][1] - q.u[0][1]); WS.push(sw, sh, Math.abs(id)); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(Uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('wuv', new THREE.Float32BufferAttribute(WU, 2)); g.setAttribute('wsz', new THREE.Float32BufferAttribute(WS, 3)); g.computeVertexNormals();
  let st = 0; cnt.forEach((n, i) => { if (n) { g.addGroup(st, n, i); st += n; } }); return g;
}

export { OPN, Q, F, LV, R, dens, nIsl, ISL, FS, AX, bid, GP, LBL, box, fKey, fMode, gen, pack, cvs, drawGuide, drawUV, makeGeo };
