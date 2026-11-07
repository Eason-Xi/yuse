const Q = Object.fromEntries(new URLSearchParams(location.search));
// 《余色》着色器。全部物理都在这里：
// 纸上用 Kubelka–Munk 减色模型，光里用加色模型，两者读的是同一份颜料数据。
const VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv=aPos*.5+.5; gl_Position=vec4(aPos,0.,1.); }`;

const VS_SPRITE = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
uniform vec4 uRect;
out vec2 vUv;
void main(){ vec2 q=aPos*.5+.5; vUv=vec2(q.x,1.-q.y); gl_Position=vec4(uRect.xy+q*uRect.zw,0.,1.); }`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
`;

const NOISE = `
float h21(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 h22(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return s;}
`;

const FS = {};

// ---------- 流体 ----------
FS.curl = HEAD + `
uniform sampler2D uVel; uniform vec2 uT;
void main(){
  float L=texture(uVel,vUv-vec2(uT.x,0)).y, R=texture(uVel,vUv+vec2(uT.x,0)).y;
  float B=texture(uVel,vUv-vec2(0,uT.y)).x, T=texture(uVel,vUv+vec2(0,uT.y)).x;
  o=vec4(.5*(R-L-T+B),0,0,1);
}`;

FS.vort = HEAD + `
uniform sampler2D uVel,uCurl; uniform vec2 uT; uniform float uK,uDt;
void main(){
  float L=texture(uCurl,vUv-vec2(uT.x,0)).x, R=texture(uCurl,vUv+vec2(uT.x,0)).x;
  float B=texture(uCurl,vUv-vec2(0,uT.y)).x, T=texture(uCurl,vUv+vec2(0,uT.y)).x;
  float C=texture(uCurl,vUv).x;
  vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));
  f/=length(f)+1e-4; f*=uK*C; f.y*=-1.;
  vec2 v=texture(uVel,vUv).xy+f*uDt;
  o=vec4(clamp(v,-1500.,1500.),0,1);
}`;

FS.div = HEAD + `
uniform sampler2D uVel; uniform vec2 uT;
void main(){
  vec2 c=texture(uVel,vUv).xy;
  float L=texture(uVel,vUv-vec2(uT.x,0)).x, R=texture(uVel,vUv+vec2(uT.x,0)).x;
  float B=texture(uVel,vUv-vec2(0,uT.y)).y, T=texture(uVel,vUv+vec2(0,uT.y)).y;
  if(vUv.x-uT.x<0.)L=-c.x; if(vUv.x+uT.x>1.)R=-c.x;
  if(vUv.y-uT.y<0.)B=-c.y; if(vUv.y+uT.y>1.)T=-c.y;
  o=vec4(.5*(R-L+T-B),0,0,1);
}`;

FS.prs = HEAD + `
uniform sampler2D uP,uDiv; uniform vec2 uT;
void main(){
  float L=texture(uP,vUv-vec2(uT.x,0)).x, R=texture(uP,vUv+vec2(uT.x,0)).x;
  float B=texture(uP,vUv-vec2(0,uT.y)).x, T=texture(uP,vUv+vec2(0,uT.y)).x;
  o=vec4((L+R+B+T-texture(uDiv,vUv).x)*.25,0,0,1);
}`;

FS.grad = HEAD + `
uniform sampler2D uP,uVel; uniform vec2 uT;
void main(){
  float L=texture(uP,vUv-vec2(uT.x,0)).x, R=texture(uP,vUv+vec2(uT.x,0)).x;
  float B=texture(uP,vUv-vec2(0,uT.y)).x, T=texture(uP,vUv+vec2(0,uT.y)).x;
  o=vec4(texture(uVel,vUv).xy-vec2(R-L,T-B),0,1);
}`;

FS.advV = HEAD + `
uniform sampler2D uVel; uniform vec2 uT; uniform float uDt,uDamp;
void main(){
  vec2 c=vUv-uDt*texture(uVel,vUv).xy*uT;
  o=vec4(texture(uVel,c).xy/(1.+uDamp*uDt),0,1);
}`;

FS.splat = HEAD + `
uniform sampler2D uBase; uniform vec2 uPt; uniform vec4 uCol; uniform float uR,uA;
void main(){
  vec2 p=vUv-uPt; p.x*=uA;
  o=texture(uBase,vUv)+exp(-dot(p,p)/uR)*uCol;
}`;

// 绕中心的慢旋，用于"全"一章
FS.swirl = HEAD + `
uniform sampler2D uVel; uniform float uK,uA,uDt,uTime;
${NOISE}
void main(){
  vec2 p=vUv-.5; p.x*=uA; float r=length(p)+1e-3;
  vec2 t=vec2(-p.y,p.x)/r;
  float n=fbm(vUv*3.+uTime*.05)-.5;
  vec2 v=texture(uVel,vUv).xy+t*uK*uDt*smoothstep(.0,.2,r)*(1.-smoothstep(.5,1.1,r))*(1.+n*2.);
  o=vec4(v,0,1);
}`;

// ---------- 颜料：平流 + 滴落 + 渗透 + 老化 ----------
// dye 四个通道：R 丹（朱砂） G 青（石青） B 岁月里长出来的黑 A 水
FS.dye = HEAD + `
uniform sampler2D uDye,uVel,uPaper;
uniform vec2 uT,uST;
uniform float uDt,uA,uDiff,uWetDiff,uShear,uAge,uSoil,uWetDecay,uFeather;
uniform int uN; uniform vec4 uD[12]; uniform vec4 uC[12];
${NOISE}
vec4 cat(vec2 uv){
  vec2 sz=1./uT; vec2 p=uv*sz; vec2 t1=floor(p-.5)+.5; vec2 f=p-t1;
  vec2 w0=f*(-.5+f*(1.-.5*f));
  vec2 w1=1.+f*f*(-2.5+1.5*f);
  vec2 w2=f*(.5+f*(2.-1.5*f));
  vec2 w3=f*f*(-.5+.5*f);
  vec2 w12=w1+w2; vec2 o12=w2/w12;
  vec2 a=(t1-1.)*uT, b=(t1+2.)*uT, c=(t1+o12)*uT;
  vec4 r=texture(uDye,vec2(a.x,a.y))*w0.x*w0.y + texture(uDye,vec2(c.x,a.y))*w12.x*w0.y + texture(uDye,vec2(b.x,a.y))*w3.x*w0.y;
  r+=texture(uDye,vec2(a.x,c.y))*w0.x*w12.y + texture(uDye,vec2(c.x,c.y))*w12.x*w12.y + texture(uDye,vec2(b.x,c.y))*w3.x*w12.y;
  r+=texture(uDye,vec2(a.x,b.y))*w0.x*w3.y + texture(uDye,vec2(c.x,b.y))*w12.x*w3.y + texture(uDye,vec2(b.x,b.y))*w3.x*w3.y;
  return r;
}
void main(){
  vec2 P=vec2(vUv.x*uA,vUv.y);
  // 每一滴都是面积守恒的径向位移（流墨 suminagashi 的解析解），旧的颜料被整圈推开
  for(int i=0;i<12;i++){
    if(i>=uN)break;
    vec2 q=P-uD[i].xy; float d2=dot(q,q)+1e-9;
    float an=atan(q.y,q.x);
    float wob=1.+.10*sin(an*3.+uD[i].w*6.283)+.06*sin(an*5.-uD[i].w*11.);
    float dl=uD[i].z*wob;
    if(d2<dl){ o=uC[i]; return; }
    P=uD[i].xy+q*sqrt((d2-dl)/d2);
  }
  vec2 u=vec2(P.x/uA,P.y);
  vec2 v=texture(uVel,vUv).xy; float sp=length(v);
  v*=smoothstep(.8,4.,sp);
  u-=uDt*v*uST;
  if(uFeather>0.){
    vec2 q=vec2(vUv.x*uA,vUv.y); float e=.0016;
    float n0=fbm(q*46.)+.35*vn(q*170.);
    float nx=fbm((q+vec2(e,0.))*46.)+.35*vn((q+vec2(e,0.))*170.);
    float ny=fbm((q+vec2(0.,e))*46.)+.35*vn((q+vec2(0.,e))*170.);
    vec2 cf=vec2(ny-n0,-(nx-n0))/e;
    u-=cf*uFeather*uT;
  }
  float disp=length((u-vUv)/uT);
  vec4 c;
  if(u.x<0.||u.x>1.||u.y<0.||u.y>1.) c=vec4(0.);
  else if(disp<.02) c=texture(uDye,vUv);
  else c=max(cat(u),0.);
  vec4 pp=texture(uPaper,vUv);
  float sh=min(sp*.012,.6)*uShear;
  float k=uDiff*(.3+.9*pp.b)+min(c.a,1.)*uWetDiff+sh;
  if(k>.0008){
    float an=pp.g*6.283+vn(vUv*40.)*6.283;
    vec2 e=vec2(cos(an),sin(an))*uT*(1.2+2.2*pp.a);
    vec2 e2=vec2(-e.y,e.x)*.6;
    vec4 n=(texture(uDye,u+e*2.)+texture(uDye,u-e*2.)+texture(uDye,u+e2)+texture(uDye,u-e2))*.25;
    c=mix(c,n,clamp(k,0.,.85));
  }
  float ov=min(c.r,c.g);
  c.b+=uAge*uDt*(ov*7.+c.r*.42+c.g*.22)*(.45+1.1*pp.b);
  c.b+=uSoil*uDt*min(sp*.02,1.)*(c.r+c.g)*(1.-smoothstep(.55,.95,c.b));
  c.b=min(c.b,1.5);
  c.a*=exp(-uDt*uWetDecay);
  o=c;
}`;

// 文字溶进水里：把字形直接印进颜料场
FS.stamp = HEAD + `
uniform sampler2D uTex; uniform vec4 uInk; uniform float uK;
void main(){ float c=texture(uTex,vUv).g; o=uInk*c*uK; }`;

// ---------- 文字层 ----------
FS.sprite = HEAD + `
uniform sampler2D uTex; uniform vec3 uInk; uniform float uAlpha,uRev,uSeed,uHalo; uniform int uDir;
${NOISE}
void main(){
  vec4 t=texture(uTex,vUv);
  float along=uDir==0?vUv.y:(uDir==1?1.-vUv.x:vUv.x);
  float n=vn(vUv*vec2(38.,24.)+uSeed);
  float m=smoothstep(0.,.1,uRev*1.14-along-n*.04);
  float cov=t.g*m*uAlpha;
  o=vec4(uInk*cov,t.r*m*uAlpha*uHalo);
}`;

// ---------- 一次性烘焙 ----------
FS.paper = HEAD + `
uniform sampler2D uFib; uniform float uA;
${NOISE}
void main(){
  vec2 p=vec2(vUv.x*uA,vUv.y);
  float f=texture(uFib,vUv).r;
  float h=.42*fbm(p*90.)+.28*fbm(p*260.+7.)+.3*vn(p*900.);
  h=mix(h,1.,f*.5);
  float cloud=fbm(p*5.+3.);
  float g=h21(floor(vUv*2048.*1.3));
  o=vec4(h,f,smoothstep(.25,.75,cloud),.55*g+.45*vn(p*520.));
}`;

FS.tear = HEAD + `
uniform float uA;
${NOISE}
void main(){
  float y=vUv.x;
  float x=.5*uA+.05*sin(y*2.3+.7)+.11*(fbm(vec2(y*2.1,3.1))-.5)+.028*(fbm(vec2(y*13.,7.7))-.5)+.008*(fbm(vec2(y*70.,1.3))-.5);
  o=vec4(x,fbm(vec2(y*46.,5.)),0,1);
}`;

FS.crack = HEAD + `
uniform float uA;
${NOISE}
vec3 voro(vec2 x){
  vec2 n=floor(x),f=fract(x),mg=vec2(0),mr=vec2(0); float md=8.,id=0.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    vec2 g=vec2(i,j),oo=h22(n+g),r=g+oo-f; float d=dot(r,r);
    if(d<md){md=d;mr=r;mg=g;id=h21(n+g);}
  }
  md=8.;
  for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){
    vec2 g=mg+vec2(i,j),oo=h22(n+g),r=g+oo-f;
    if(dot(mr-r,mr-r)>1e-5) md=min(md,dot(.5*(mr+r),normalize(r-mr)));
  }
  return vec3(md,id,0.);
}
void main(){
  vec2 p=vec2(vUv.x*uA,vUv.y);
  vec2 w=vec2(fbm(p*3.1+1.7),fbm(p*3.1+9.2))-.5;
  vec2 w2=vec2(fbm(p*11.+4.),fbm(p*11.+6.))-.5;
  vec2 q=p+w*.12+w2*.026;
  vec3 a=voro(q*8.5);
  vec3 b=voro(q*27.+3.);
  vec3 cc=voro(q*2.6+8.);
  float big=cc.x/2.6;
  float dC=min(a.x/8.5,big);
  float dF=b.x/27.;
  vec2 c0=vec2(.5*uA,.5);
  float dist=length(p-c0)/length(c0);
  float arrive=.02+.72*dist+.16*a.y;
  o=vec4(dC*40.,dF*40.,arrive,a.y);
}`;

FS.wipe = HEAD + `
uniform sampler2D uD; uniform vec3 uB; uniform float uA,uK;
void main(){
  vec2 p=vUv-uB.xy; p.x*=uA;
  float d=texture(uD,vUv).r-uK*exp(-dot(p,p)/uB.z);
  o=vec4(max(d,0.),0,0,1);
}`;

// ---------- 合成：同一份颜料，两种物理 ----------
FS.comp = HEAD + `
uniform sampler2D uDye,uPaper,uCrack,uText,uDust,uTear;
uniform vec2 uCover,uT,uRes;
uniform float uAf,uTime,uRoom,uFlip,uDry,uCrackT,uCrackVis,uCrackGlow,uGap,uTilt,uSeam,uDustA,uVoid,uGain,uZoom,uWet,uTxGlow,uPlain,uGran,uCrackBack;
uniform vec4 uBead; uniform vec3 uBeadKS;
uniform vec4 uLine; uniform vec4 uBrush; uniform vec4 uLens;
${NOISE}
vec3 ksOf(vec3 R){return (1.-R)*(1.-R)/(2.*R);}
vec3 km(vec3 K){return 1.+K-sqrt(K*K+2.*K);}
const vec3 PAPER=vec3(.885,.878,.852);
const vec3 R_DAN=vec3(.70,.017,.012);
const vec3 R_QING=vec3(.015,.088,.36);
const vec3 KS_B=vec3(9.,10.5,7.6);
const vec3 L_DAN=vec3(1.,.10,.02);
const vec3 L_QING=vec3(.0,.90,.98);
const vec3 L_W=vec3(1.,.98,.95);
float tx(float y){return texture(uTear,vec2(y,.5)).r;}
void main(){
  vec2 uv=vUv;
  vec2 f=(uv-.5)*uCover+.5;
  f=(f-.5)/uZoom+.5;
  float inL=0.;
  if(uLens.w>0.){
    vec2 lp=vec2(f.x*uAf,f.y), lc=uLens.xy*vec2(uAf,1.);
    float dl=length(lp-lc);
    inL=(1.-smoothstep(uLens.z*.985,uLens.z,dl))*uLens.w;
    vec2 fz=uLens.xy+(f-uLens.xy)/2.8;
    f=mix(f,fz,step(.5,inL));
  }
  f+=uWet*.0012*(vec2(vn(f*7.+uTime*.13),vn(f*7.-uTime*.11+9.))-.5);
  vec2 p=vec2(f.x*uAf,f.y);
  float plain=uPlain;
  // ---- 撕裂 ----
  float g=uGap*(1.-plain), th=uTilt*(1.-plain);
  vec2 pL=p+vec2(g,0.); pL.x+=th*(p.y-.5);
  vec2 pR=p-vec2(g,0.); pR.x-=th*(p.y-.5);
  float eL=tx(pL.y)-pL.x, eR=pR.x-tx(pR.y);
  float side=eL>0.?0.:(eR>0.?1.:2.);
  if(g<=.00001) side=eL>0.?0.:1.;
  vec2 q=side<.5?pL:(side<1.5?pR:p);
  float edge=side<.5?eL:eR;
  vec2 pu=q/vec2(uAf,1.);
  bool isVoid=side>1.5;
  vec4 d=isVoid?vec4(0.):texture(uDye,pu);
  d*=1.-plain;
  vec4 pa=texture(uPaper,pu);
  vec4 t=texture(uText,uv);
  // ---- 颜料颗粒与干燥边缘 ----
  vec3 c=d.rgb;
  c*=1.+uGran*((pa.a-.5)+(pa.r-.5)*.9);
  if(uDry>.001){
    vec3 a=texture(uDye,pu+vec2(uT.x*1.5,0)).rgb+texture(uDye,pu-vec2(uT.x*1.5,0)).rgb+texture(uDye,pu+vec2(0,uT.y*1.5)).rgb+texture(uDye,pu-vec2(0,uT.y*1.5)).rgb;
    float eg=length(a*.25-d.rgb);
    c*=1.+uDry*min(eg*5.,1.2);
  }
  // ---- 龟裂 ----
  vec4 ck=texture(uCrack,pu);
  float onC=smoothstep(ck.b,ck.b+.08,uCrackT);
  float onF=smoothstep(ck.b+.1,ck.b+.28,uCrackT);
  float lineC=onC*(1.-smoothstep(.0,.05+.05*ck.a,ck.r));
  float lineF=onF*(1.-smoothstep(.0,.03,ck.g))*.75;
  float line=max(lineC,lineF)*(1.-plain);
  float paint=clamp((c.r+c.g+c.b)*1.8,0.,1.);
  float vis=max(uCrackVis,inL);
  float lineP=line*paint*vis;
  float flake=(ck.a-.5)*.10*onC*paint*vis;
  float rim=onC*smoothstep(.05,.09,ck.r)*(1.-smoothstep(.09,.24,ck.r))*paint*vis;
  c*=1.-lineP*.97;
  // ---- 撕开的纸边 ----
  float seam=(1.-smoothstep(0.,.0016,abs(edge)))*max(uSeam,inL)*(1.-plain);
  float tornW=(.004+.016*texture(uTear,vec2(q.y,.5)).g)*smoothstep(0.,.02,g);
  float torn=isVoid?0.:(1.-smoothstep(tornW*.6,tornW,edge));
  c*=1.-torn;
  c*=1.-t.a*.93;
  // ---- 高度、法线 ----
  float h=pa.r*.010+(c.r+c.g+c.b)*.0035+min(d.a,1.)*.012-lineP*.012+torn*.004;
  vec2 gr=vec2(dFdx(h),dFdy(h))*uRes.y*.085;
  vec3 n=normalize(vec3(-gr,1.));
  vec3 Ldir=normalize(vec3(-.55,.62,.56));
  // ---- 纸：减色 ----
  vec3 KS=ksOf(PAPER)+c.r*ksOf(R_DAN)+c.g*ksOf(R_QING)+c.b*KS_B;
  KS+=t.r*ksOf(R_DAN)*1.7+t.g*ksOf(R_QING)*1.7+t.b*vec3(5.5,5.5,5.);
  vec3 refl=km(KS);
  refl*=1.-pa.g*.05;
  refl*=1.+flake;
  refl*=1.+.62*(dot(n,Ldir)-Ldir.z)+rim*.10;
  refl*=1.-lineP*.5-seam*.5;
  float wetness=clamp(min(d.a,1.)*.9+uWet*paint*.55,0.,1.)*(1.-uDry);
  vec3 hv=normalize(Ldir+vec3(0,0,1));
  float spec=pow(max(dot(n,hv),0.),70.)*wetness*.32;
  float lum0=dot(refl,vec3(.3,.6,.1));
  float dk=1.-clamp(lum0/.86,0.,1.);
  vec3 roomC=mix(vec3(.040,.058,.115),vec3(1.),uRoom);
  vec3 col=refl*roomC+spec*uRoom;
  // 灰
  float du=texture(uDust,pu).r*uDustA*(1.-plain);
  if(du>0.001){
    float ash=.34+.3*fbm(pu*vec2(uAf,1.)*26.)+.2*pa.a;
    float m=smoothstep(.1,.9,du)*(.74+.2*pa.b);
    col=mix(col,vec3(ash*.92,ash*.9,ash*.88)*roomC*.72,m);
  }
  // ---- 光：加色 ----
  float mixw=min(d.r,d.g); mixw=mixw*mixw*5.;
  vec3 Lc=(d.r*L_DAN+d.g*L_QING+L_W*(mixw+d.b*d.b*.26))*uGain;
  Lc=pow(max(Lc,0.),vec3(1.5))*1.35;
  Lc*=.93+.14*pa.a;
  Lc=max(mix(vec3(dot(Lc,vec3(.3,.6,.1))),Lc,1.3),0.);
  Lc*=1.-t.a*.8;
  Lc*=1.-uVoid;
  Lc+=line*uCrackGlow*vec3(1.,.97,.92)*(1.-uVoid);
  Lc+=seam*uCrackGlow*2.*vec3(1.,.98,.95);
  Lc*=1.-inL*line*.92;
  // ---- 翻转：最黑的地方最先亮 ----
  float nz=fbm(pu*vec2(uAf,1.)*5.)-.5;
  float thr=1.05-uFlip*1.6;
  float F=smoothstep(thr-.16,thr+.16,dk+nz*.12)*smoothstep(0.,.04,uFlip);
  if(isVoid) F=1.;
  F=mix(F,0.,plain);
  vec3 outc=mix(col,Lc,F);
  outc+=(max(lineC,lineF)*paint+seam)*(1.-plain)*uCrackBack*vec3(1.,.9,.74);
  // 文字在光里自己发亮，在夜里也发亮
  vec3 em=t.r*L_DAN*1.25+t.g*(L_QING+.06)*1.4+t.b*vec3(.86,.87,.9);
  outc+=em*max(F,uTxGlow);
  // ---- 水珠 ----
  if(uBead.w>0.){
    vec2 bq=(p-uBead.xy)/uBead.z; float br=length(bq);
    vec2 sq=(p-uBead.xy-vec2(.28,-.34)*uBead.z)/uBead.z;
    float sh=exp(-dot(sq,sq)*1.1)*.5*uBead.w;
    outc*=1.-sh*(1.-smoothstep(.9,1.,br));
    float ins=(1.-smoothstep(.975,1.,br))*uBead.w;
    float zc=sqrt(max(1.-br*br,0.));
    vec3 nb=normalize(vec3(bq,zc+.2));
    vec3 rb=km(ksOf(PAPER)+uBeadKS*(.25+zc*1.7));
    rb*=.62+.5*max(dot(nb,Ldir),0.)+.34*pow(1.-zc,3.)*(-bq.y*.5+.6);
    float sp=pow(max(dot(nb,hv),0.),160.)*1.5+pow(max(dot(nb,hv),0.),18.)*.14;
    outc=mix(outc,(rb+sp)*roomC,ins);
  }
  // ---- 穿过虚空的那条线 ----
  if(uLine.w>0.){
    float dy=abs(p.y-uLine.z);
    float dx=p.x-uLine.x;
    float head=exp(-(dx*dx+dy*dy)/.00045);
    float tl=clamp((uLine.y-p.x)/max(uLine.y-uLine.x,1e-3),0.,1.);
    float trail=step(uLine.x,p.x)*step(p.x,uLine.y)*exp(-dy*dy/.0000045)*(1.-tl*.6);
    outc+=(head*2.4*vec3(1.,.72,.5)+trail*vec3(1.,.42,.22)*.7)*uLine.w;
  }
  // ---- 指尖 ----
  if(uBrush.w>0.){
    float dd=length(p-uBrush.xy);
    float ring=exp(-pow((dd-uBrush.z)/(uBrush.z*.13),2.));
    outc=mix(outc,outc*.82+vec3(.05)+vec3(F)*.16,ring*uBrush.w*.5);
  }
  // 放大镜镜框
  if(uLens.w>0.){
    vec2 lp2=vec2(((uv-.5)*uCover+.5).x*uAf,((uv-.5)*uCover+.5).y);
    float rr=length(lp2-uLens.xy*vec2(uAf,1.));
    outc+=exp(-pow((rr-uLens.z)/.0012,2.))*.5*uLens.w;
  }
  o=vec4(outc,1.);
}`;

// ---------- 泛光 ----------
FS.bright = HEAD + `
uniform sampler2D uS; uniform vec2 uT;
void main(){
  vec3 c=texture(uS,vUv+uT*vec2(-.5,-.5)).rgb+texture(uS,vUv+uT*vec2(.5,-.5)).rgb+texture(uS,vUv+uT*vec2(-.5,.5)).rgb+texture(uS,vUv+uT*vec2(.5,.5)).rgb;
  c*=.25;
  c=max(c-.85,0.);
  o=vec4(min(c,vec3(8.)),1.);
}`;
FS.down = HEAD + `
uniform sampler2D uS; uniform vec2 uT;
void main(){
  vec3 c=texture(uS,vUv).rgb*4.;
  c+=texture(uS,vUv+uT*vec2(-1,-1)).rgb+texture(uS,vUv+uT*vec2(1,-1)).rgb+texture(uS,vUv+uT*vec2(-1,1)).rgb+texture(uS,vUv+uT*vec2(1,1)).rgb;
  o=vec4(c/8.,1.);
}`;
FS.up = HEAD + `
uniform sampler2D uS; uniform vec2 uT; uniform float uK;
void main(){
  vec3 c=texture(uS,vUv+uT*vec2(-1,0)).rgb+texture(uS,vUv+uT*vec2(1,0)).rgb+texture(uS,vUv+uT*vec2(0,-1)).rgb+texture(uS,vUv+uT*vec2(0,1)).rgb;
  c=c*2.+texture(uS,vUv+uT*vec2(-1,-1)).rgb+texture(uS,vUv+uT*vec2(1,-1)).rgb+texture(uS,vUv+uT*vec2(-1,1)).rgb+texture(uS,vUv+uT*vec2(1,1)).rgb;
  o=vec4(c/12.*uK,1.);
}`;

// ---------- 终合成 ----------
FS.final = HEAD + `
uniform sampler2D uS,uB,uStare;
uniform float uBloom,uStareA,uExp,uTime,uFade;
uniform vec4 uDot; uniform float uAsp;
${NOISE}
vec3 sh(vec3 c){ vec3 k=max(c-.82,0.); return min(c,vec3(.82))+.18*(1.-exp(-k/.18*.62)); }
void main(){
  vec3 c=texture(uS,vUv).rgb+texture(uB,vUv).rgb*uBloom;
  c*=uExp;
  c=sh(c);
  c=pow(max(c,0.),vec3(1./2.2));
  c+=(h21(gl_FragCoord.xy+fract(uTime)*91.)-.5)*(1.6/255.);
  float s=texture(uStare,vec2(vUv.x,1.-vUv.y)).r*uStareA;
  c=mix(c,vec3(1.,.11,.015),s);
  if(uDot.w>0.){
    vec2 q=(vUv-uDot.xy)*vec2(uAsp,1.);
    float dd=length(q);
    c=mix(c,vec3(.03),(1.-smoothstep(uDot.z*.8,uDot.z,dd))*uDot.w);
  }
  c*=1.-uFade;
  o=vec4(c,1.);
}`;
