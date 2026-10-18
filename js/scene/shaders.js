// PBR concrete / glass / roof shader injections
import * as THREE from 'three';
import { ll } from './scene.js';

/* ---- PBR concrete wall + glass shaders (injected into MeshStandardMaterial; LevelLighting.patch() then adds GI/AO on top) ---- */
const UC = { uGrime: { value: 0.5 }, uPanelW: { value: 2.4 }, uPanelH: { value: 1.2 }, uTileW: { value: 0.23 }, uNightG: ll.uniforms.uNight };
const VARY = 'varying vec3 vGP;varying vec3 vGN;varying vec2 vW;varying vec3 vS;uniform float uGrime,uPanelW,uPanelH,uTileW,uNightG;';
const NOISE = `float fxh(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float fxn(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(fxh(i),fxh(i+vec2(1.,0.)),f.x),mix(fxh(i+vec2(0.,1.)),fxh(i+vec2(1.,1.)),f.x),f.y);}
float fxf(vec2 q){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*fxn(q);q=q*2.03+vec2(1.7,9.2);a*=.5;}return s;}`;
function fx(m, key, frag) {
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, UC);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 wuv;attribute vec3 wsz;' + VARY)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGP=(modelMatrix*vec4(transformed,1.)).xyz;vGN=normalize(mat3(modelMatrix)*objectNormal);vW=wuv;vS=wsz;');
    let f = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + VARY + NOISE + (frag.common || ''));
    for (const [tag, code] of [['#include <color_fragment>', frag.color], ['#include <roughnessmap_fragment>', frag.rough], ['#include <metalnessmap_fragment>', frag.metal], ['#include <normal_fragment_maps>', frag.normal], ['#include <emissivemap_fragment>', frag.emis]]) if (code) f = f.replace(tag, tag + '\n' + code);
    sh.fragmentShader = f;
  };
}
// concrete: formwork panels with V-grooves + tie holes + pores, mottled tone, rain streaks, per-pixel bump and roughness (world space, no tiling seams)
const matC = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0 });
fx(matC, 'fx-concrete', {
  common: `vec2 fxUV(vec3 p,vec3 n){return abs(n.y)>.7?p.xz:vec2(p.x*n.z-p.z*n.x,p.y);}
float fxH(vec2 q){vec2 P=vec2(uPanelW,uPanelH);vec2 g=abs(fract(q/P+.5)-.5)*P;float groove=1.-smoothstep(.004,.014,min(g.x,g.y));
  vec2 c=fract(q/P)*P;float hole=1.-smoothstep(.02,.032,min(length(c-vec2(P.x*.25,P.y*.5)),length(c-vec2(P.x*.75,P.y*.5))));
  return fxf(q*3.)*.5+fxf(q*28.)*.25+fxn(q*160.)*.08-groove*.9-hole*.8-smoothstep(.72,.8,fxn(q*95.))*.2;}`,
  color: `vec3 gN=normalize(vGN);vec2 cq=fxUV(vGP,gN);float ch0=fxH(cq);
float tone=fxf(cq*.7+7.)*.5+fxf(cq*5.)*.25;float cpn=floor(cq.x/uPanelW)*7.+floor(cq.y/uPanelH)*13.;float pan=fxh(vec2(cpn,cpn*.37));
vec3 cc=vec3(.52,.51,.48)*(.74+.55*tone)*(.93+.14*pan);
float streak=fxn(vec2(cq.x*9.,cq.y*.35))*fxn(vec2(cq.x*31.,cq.y*.9));
float gr=clamp(uGrime*(smoothstep(.45,.9,streak)*.7+smoothstep(7.,0.,vGP.y)*.4+smoothstep(.55,.2,tone)*.25),0.,1.);
cc=mix(cc,cc*vec3(.42,.41,.38),gr);cc*=1.+(ch0-.25)*.22;
diffuseColor.rgb=cc;`,
  rough: 'roughnessFactor=clamp(.8+.18*fxn(cq*40.)+gr*.12-ch0*.06,.5,1.);',
  normal: `{float e=.012;bool top=abs(gN.y)>.7;vec3 Tw=top?vec3(1.,0.,0.):normalize(vec3(gN.z,0.,-gN.x)),Bw=top?vec3(0.,0.,1.):vec3(0.,1.,0.);
float h0=fxH(cq),hx=fxH(cq+vec2(e,0.)),hy=fxH(cq+vec2(0.,e));
vec3 Tv=normalize((viewMatrix*vec4(Tw,0.)).xyz),Bv=normalize((viewMatrix*vec4(Bw,0.)).xyz);
normal=normalize(normal-(Tv*(hx-h0)+Bv*(hy-h0))/e*.018);}`,
});
// glass: mirror-like pane (fresnel/IBL/SSR via the stack) + painted frame, mullion and transom, interior glow at night
const matG = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0.9 });
fx(matG, 'fx-glass', {
  color: `vec2 gwz=vS.xy,gpl=vW;float gfr=1.-smoothstep(.055,.067,min(min(gpl.x,gwz.x-gpl.x),min(gpl.y,gwz.y-gpl.y)));
gfr=max(gfr,1.-smoothstep(.022,.034,abs(gpl.x-gwz.x*.5)));if(gwz.y>1.8)gfr=max(gfr,1.-smoothstep(.02,.032,abs(gpl.y-gwz.y*.72)));
diffuseColor.rgb=mix(vec3(.5,.66,.78)*(.8+.2*fxn(vGP.xy*2.)),vec3(.82,.8,.76),gfr);`,
  rough: 'roughnessFactor=mix(.035+.03*fxn(vGP.xy*3.),.55,gfr);',
  metal: 'metalnessFactor=mix(.92,0.,gfr);',
  emis: `float glit=step(.58,vS.z)*(1.-gfr);vec3 gwm=mix(vec3(1.,.74,.42),vec3(.7,.85,1.),step(.9,vS.z));
totalEmissiveRadiance+=gwm*glit*uNightG*2.2*(.75+.25*fxn(vec2(vS.z*50.,gpl.y*2.)))*(.6+.4*smoothstep(0.,gwz.y,gpl.y));`,
});
/* ---- terracotta roof tiles: staggered courses, barrel profile, per-tile tone, lichen, gap shadows, tangent-frame bump from slope-local metres (vW), distance fade to avoid moire ---- */
const matR = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0 });
fx(matR, 'fx-roof', {
  common: `float rfH(vec2 q){float tw=uTileW,rh=uTileW*1.3;float r=floor(q.y/rh),fy=fract(q.y/rh);float xo=q.x+mod(r,2.)*tw*.5;float fx=fract(xo/tw);
  return sin(fx*3.14159)*.32+fy*.45-smoothstep(.86,1.,fy)*.55-(1.-smoothstep(0.,.05,min(fx,1.-fx)))*.25;}`,
  color: `vec2 rq=vW;float rTw=uTileW,rRh=uTileW*1.3;
float rr=floor(rq.y/rRh),rfy=fract(rq.y/rRh);float rxo=rq.x+mod(rr,2.)*rTw*.5;float rc=floor(rxo/rTw),rfx=fract(rxo/rTw);
float rth=fxh(vec2(rc*1.7+rr*.31,rr*2.3+rc*.11));float rpat=fxf(rq*.9+3.)*.6+fxf(rq*7.)*.25;
vec3 rcol=mix(vec3(.5,.17,.09),vec3(.72,.31,.17),rth)*(.85+.3*rpat);
rcol=mix(rcol,vec3(.3,.27,.24),smoothstep(.62,.9,fxf(rq*1.3+9.))*.45);
float rgap=smoothstep(.84,1.,rfy),rgrv=1.-smoothstep(0.,.07,min(rfx,1.-rfx));
rcol*=(1.-rgap*.55)*(1.-rgrv*.5)*(.8+.28*sin(rfx*3.14159));
float rfade=smoothstep(.12,.5,max(fwidth(rq.x),fwidth(rq.y))/rTw);
diffuseColor.rgb=mix(rcol,vec3(.5,.2,.11)*(.8+.3*rpat),rfade);`,
  rough: 'roughnessFactor=clamp(.62+.25*rpat+.1*rgap,.45,.95);',
  normal: `{float e=.01;vec3 dp1=dFdx(-vViewPosition),dp2=dFdy(-vViewPosition);vec2 d1=dFdx(vW),d2=dFdy(vW);
vec3 N0=normalize(normal);vec3 p2=cross(dp2,N0),p1=cross(N0,dp1);vec3 Tt=p2*d1.x+p1*d2.x,Bt=p2*d1.y+p1*d2.y;
float inv=inversesqrt(max(dot(Tt,Tt),dot(Bt,Bt))+1e-12);Tt*=inv;Bt*=inv;
float h0=rfH(vW),hx=rfH(vW+vec2(e,0.)),hy=rfH(vW+vec2(0.,e));
normal=normalize(N0-(Tt*(hx-h0)+Bt*(hy-h0))/e*.03*(1.-rfade));}`,
});

export { UC, VARY, NOISE, fx, matC, matG, matR };
