import { noise } from './noise.js';

// Tipos de transição entre cenas (mesma ordem usada no PostFXManager)
export const TRANSITION_TYPES = { fade: 0, clouds: 1, flash: 2, chromatic: 3, black: 4 };

/**
 * Passo 1 — mistura das duas cenas ativas com o efeito de transição.
 * Trabalha em espaço linear HDR (antes do bloom).
 */
export const BlendShader = {
  uniforms: {
    tA: { value: null },
    tB: { value: null },
    uMix: { value: 0 },
    uType: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tA; uniform sampler2D tB;
    uniform float uMix; uniform int uType; uniform float uTime; uniform float uAspect;
    varying vec2 vUv;
    ${noise}
    vec3 zoomSample(sampler2D t, vec2 uv, float z){ return texture2D(t,(uv-0.5)/z+0.5).rgb; }
    void main(){
      float m=uMix;
      vec3 a=texture2D(tA,vUv).rgb;
      if(m<=0.0001){
        if (any(isnan(a)) || any(isinf(a))) a = vec3(0.0);
        gl_FragColor=vec4(clamp(a, 0.0, 64.0),1.0); return;
      }
      vec3 b=texture2D(tB,vUv).rgb;
      vec3 col;
      if(uType==1){
        // CLOUDS — mergulho através de nuvens volumétricas
        vec2 p=vec2((vUv.x-0.5)*uAspect,vUv.y-0.5);
        float r=length(p);
        a=zoomSample(tA,vUv,1.0+m*0.6);
        b=zoomSample(tB,vUv,1.25-m*0.25);
        float cover=sin(3.14159*m);
        float n=fbm(vec3(p*2.2/(0.6+m*0.8),uTime*0.08+m*1.5))*0.5+0.5;
        float n2=fbm(vec3(p*5.0,uTime*0.1-m))*0.5+0.5;
        float dens=n*0.75+n2*0.35-r*0.25;
        float mask=smoothstep(1.05-cover*1.15,1.25-cover*1.15,dens);
        vec3 cloud=mix(vec3(0.55,0.62,0.72),vec3(1.25,1.28,1.35),smoothstep(0.3,0.9,n2));
        col=mix(a,b,smoothstep(0.42,0.58,m));
        col=mix(col,cloud,mask);
      } else if(uType==2){
        // FLASH — explosão de luz (HDR → bloom)
        col=mix(a,b,smoothstep(0.35,0.65,m));
        float f=pow(1.0-abs(2.0*m-1.0),2.0);
        col+=vec3(1.0,0.96,0.9)*f*3.5;
      } else if(uType==3){
        // CHROMATIC — separação RGB através do preto
        float s=sin(3.14159*m);
        vec2 dir=(vUv-0.5)*s*0.06;
        vec3 ca=vec3(texture2D(tA,vUv+dir).r,a.g,texture2D(tA,vUv-dir).b);
        vec3 cb=vec3(texture2D(tB,vUv+dir).r,b.g,texture2D(tB,vUv-dir).b);
        float lineN=hash12(vec2(floor(vUv.y*120.0),floor(uTime*24.0)));
        float glitch=step(1.0-s*0.25,lineN);
        col=mix(ca,cb,smoothstep(0.4,0.6,m));
        col*=1.0-s*0.85;
        col+=glitch*vec3(0.6,0.5,0.35)*s;
      } else if(uType==4){
        // BLACK — fade A → preto → B
        col=m<0.5?a*(1.0-m*2.0):b*(m*2.0-1.0);
      } else {
        col=mix(a,b,m);
      }
      // NaN/Inf nunca chegam ao bloom (um único pixel inválido apagaria a tela)
      if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
      col = clamp(col, 0.0, 64.0);
      gl_FragColor=vec4(col,1.0);
    }
  `,
};

/**
 * Passo final (após tone mapping / sRGB): aberração cromática, blur,
 * escurecimento, vinheta e granulação de filme.
 */
export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.06 },
    uVignette: { value: 0.3 },
    uCA: { value: 0.002 },
    uBlur: { value: 0 },
    uDarken: { value: 0 },
    uRes: { value: null },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uVignette;
    uniform float uCA; uniform float uBlur; uniform float uDarken; uniform vec2 uRes;
    varying vec2 vUv;
    float h(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    vec3 sampleCA(vec2 uv){
      vec2 d=(uv-0.5);
      float l=dot(d,d);
      vec2 o=d*l*uCA*8.0;
      return vec3(texture2D(tDiffuse,uv+o).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-o).b);
    }
    void main(){
      vec3 col=sampleCA(vUv);
      if(uBlur>0.001){
        vec2 px=uBlur*3.0/uRes;
        vec3 acc=col; float w=1.0;
        for(int i=0;i<12;i++){
          float a=float(i)*0.5236; vec2 o=vec2(cos(a),sin(a));
          acc+=texture2D(tDiffuse,vUv+o*px*2.0).rgb; acc+=texture2D(tDiffuse,vUv+o*px*4.5).rgb*0.7;
          w+=1.7;
        }
        col=mix(col,acc/w,clamp(uBlur,0.0,1.0));
      }
      col*=1.0-uDarken;
      vec2 v=vUv-0.5;
      col*=1.0-uVignette*smoothstep(0.15,0.85,dot(v,v)*2.2);
      float g=h(vUv*uRes+fract(uTime*7.13)*511.0)-0.5;
      float lum=dot(col,vec3(0.299,0.587,0.114));
      col+=g*uGrain*(1.0-lum*0.6);
      gl_FragColor=vec4(col,1.0);
    }
  `,
};
