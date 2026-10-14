(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,30446,e=>{"use strict";let t=(e,t,r)=>[e/255,t/255,r/255],r=t(201,168,76),a=t(212,182,92),o=t(232,213,163),i=t(176,146,63),n=1e3/30,l=/swiftshader|llvmpipe|softpipe|software|basic render/i;function u(e,t,r,a){let o=Math.max(1,t*r),i=Math.sqrt(e.pixelBudget/o);return Math.max(.25,Math.min(window.devicePixelRatio||1,e.maxPixelRatio,i)*a)}let f=`
  uniform vec2 uSize;
  uniform float uTime;
  uniform vec2 uParallax;
  uniform float uScroll;
  uniform vec2 uPoolCenter;
  uniform vec2 uPoolRadius;

  const float BEAM_ALPHA = 0.22;
  const float POOL_ALPHA = 0.10;
  const float BEAM_LENGTH = 820.0;

  // Light falling from a source just above the section: 1 on the axis, fading with the angle and the distance.
  float beamAt(vec2 px) {
    vec2 source = vec2(uSize.x * (0.5 + uParallax.x * 0.04), -80.0);
    vec2 d = px - source;
    float dist = length(d);
    float ang = atan(d.x, d.y);
    float cone = 1.0 - smoothstep(0.05, 0.85, abs(ang));
    float haze = 0.8 + 0.2 * sin(ang * 21.0 + uTime * 0.2 + sin(ang * 6.0 - uTime * 0.12) * 1.6);
    return cone * exp(-dist / BEAM_LENGTH) * haze;
  }

  // Where the light lands: a soft ellipse over the cards that breathes very slowly.
  float poolAt(vec2 px) {
    vec2 q = (px - uPoolCenter - uParallax * vec2(14.0, 8.0)) / uPoolRadius;
    float breathe = 1.0 + 0.05 * sin(uTime * 0.35);
    return exp(-dot(q, q) / (breathe * breathe));
  }

  // Nothing is ever cut at an edge: the light fades out before the section's left, right, top and bottom.
  float edgeFade(vec2 px) {
    float margin = min(120.0, uSize.x * 0.14);
    float across = smoothstep(0.0, margin, px.x) * (1.0 - smoothstep(uSize.x - margin, uSize.x, px.x));
    float top = smoothstep(0.0, 36.0, px.y);
    float bottom = 1.0 - smoothstep(uSize.y - 160.0, uSize.y, px.y);
    return across * top * bottom;
  }
`,s=`
  attribute vec2 aCorner;
  varying vec2 vUv;
  void main() {
    vUv = vec2(aCorner.x * 0.5 + 0.5, 0.5 - aCorner.y * 0.5);
    gl_Position = vec4(aCorner, 0.0, 1.0);
  }
`,h=`
  ${f}
  uniform vec3 uGold;
  uniform vec3 uGoldDark;
  uniform vec3 uGoldPale;
  varying vec2 vUv;

  void main() {
    vec2 px = vUv * uSize;
    float beam = beamAt(px);
    float light = beam * BEAM_ALPHA + poolAt(px) * POOL_ALPHA;

    vec3 colour = mix(uGoldDark, uGold, smoothstep(0.02, 0.22, light));
    colour = mix(colour, uGoldPale, smoothstep(0.55, 1.0, beam) * 0.5);

    // A little noise keeps the very soft gradient from banding in 8-bit.
    float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    float alpha = max(light * edgeFade(px) + noise / 255.0, 0.0);
    gl_FragColor = vec4(colour * alpha, alpha);
  }
`,d=`
  ${f}
  attribute vec4 aSeed;
  attribute float aDepth;
  uniform float uPointScale;
  uniform float uMoteSize;
  varying float vAlpha;
  varying float vGlint;

  const float DUST_ALPHA = 0.75;

  void main() {
    // motes rise 0.010..0.024 of the section's height a second: about ten to forty seconds to cross it
    float rise = uTime * (0.010 + 0.014 * aSeed.w);
    float y = fract(aSeed.y - rise);
    float x = aSeed.x
      + sin(uTime * (0.22 + 0.2 * aSeed.w) + aSeed.z * 6.2831853) * 0.016
      + sin(y * 9.0 + aSeed.z * 11.0) * 0.007;
    // nearer motes (depth 1) travel farther with the pointer and with the scroll
    x = fract(x + uParallax.x * 0.03 * aDepth + 1.0);
    y = y + uParallax.y * 0.015 * aDepth + uScroll * 0.04 * aDepth;

    vec2 px = vec2(x, y) * uSize;
    float lit = clamp(beamAt(px) * 2.2, 0.0, 1.0);
    float twinkle = 0.6 + 0.4 * sin(uTime * (0.8 + 1.2 * aSeed.w) + aSeed.z * 6.2831853);
    // a mote smaller than one buffer pixel is drawn one pixel wide and dimmed by the share of the pixel it covers
    float size = uMoteSize * uPointScale * (0.5 + aDepth);
    vAlpha = DUST_ALPHA * twinkle * (0.25 + 0.75 * lit) * (0.5 + 0.5 * aDepth) * edgeFade(px) * min(1.0, size);
    vGlint = lit;

    gl_Position = vec4(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
    gl_PointSize = max(1.0, size);
  }
`,m=`
  uniform vec3 uGoldLight;
  uniform vec3 uGoldPale;
  varying float vAlpha;
  varying float vGlint;

  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float soft = 1.0 - smoothstep(0.0, 1.0, r);
    float alpha = vAlpha * soft * soft;
    gl_FragColor = vec4(mix(uGoldLight, uGoldPale, vGlint) * alpha, alpha);
  }
`,c=`
  attribute vec2 aPosition;
  attribute vec3 aAlongPhaseBirth;
  uniform vec2 uSize;
  uniform vec2 uParallax;
  varying vec3 vAlongPhaseBirth;

  void main() {
    // the threads sway a few pixels with the pointer, like the light above them
    vec2 p = aPosition + uParallax * vec2(6.0, 4.0);
    vAlongPhaseBirth = aAlongPhaseBirth;
    gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
  }
`,g=`
  uniform float uTime;
  uniform float uGain;
  uniform vec3 uGold;
  uniform vec3 uGoldPale;
  varying vec3 vAlongPhaseBirth;

  const float THREAD_ALPHA = 0.12;

  void main() {
    float along = vAlongPhaseBirth.x;
    // a short glint travels along each thread, a different moment on each one
    float head = fract(uTime * 0.07 + vAlongPhaseBirth.y);
    float gap = abs(along - head);
    gap = min(gap, 1.0 - gap);
    float pulse = exp(-gap * gap * 90.0);
    float ends = smoothstep(0.0, 0.14, along) * (1.0 - smoothstep(0.86, 1.0, along));
    // a thread appears with its cards, over a second
    float arrival = smoothstep(0.0, 1.2, uTime - vAlongPhaseBirth.z);
    float alpha = (THREAD_ALPHA + 0.2 * pulse) * ends * arrival * uGain;
    gl_FragColor = vec4(mix(uGold, uGoldPale, pulse) * alpha, alpha);
  }
`;function p(e,t,r){let a=e.createShader(t);if(!a)throw Error("could not create a shader");if(e.shaderSource(a,r),e.compileShader(a),!e.getShaderParameter(a,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(a);throw e.deleteShader(a),Error(`shader failed to compile: ${t}`)}return a}function x(e,t,r,a,o){let i=(e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT)?.precision??0)>0,n=p(e,e.VERTEX_SHADER,`precision highp float;
${t}`),l=p(e,e.FRAGMENT_SHADER,`precision ${i?"highp":"mediump"} float;
${r}`),u=e.createProgram();if(!u)throw Error("could not create a program");if(e.attachShader(u,n),e.attachShader(u,l),e.linkProgram(u),e.deleteShader(n),e.deleteShader(l),!e.getProgramParameter(u,e.LINK_STATUS)){let t=e.getProgramInfoLog(u);throw e.deleteProgram(u),Error(`program failed to link: ${t}`)}return{handle:u,attributes:Object.fromEntries(a.map(t=>[t,e.getAttribLocation(u,t)])),uniforms:Object.fromEntries(o.map(t=>[t,e.getUniformLocation(u,t)]))}}let A=new Float32Array([-1,-1,3,-1,-1,3]),v=(e,t,r)=>Math.min(r,Math.max(t,e));e.s(["mountSponsorStage",0,function(e,t,f={}){let p,b=(p=navigator,window.innerWidth<1024||void 0!==p.deviceMemory&&p.deviceMemory<=4?{dustCount:36,pixelBudget:9e4,maxPixelRatio:1}:{dustCount:90,pixelBudget:2e5,maxPixelRatio:1}),P={antialias:!1,alpha:!0,premultipliedAlpha:!0,depth:!1,stencil:!1,powerPreference:"low-power"},y=e.getContext("webgl2",P)??e.getContext("webgl",P);if(!y)return null;let S=function(e){let t=new Float32Array(5*e);for(let r=0;r<e;r++)t[5*r]=Math.random(),t[5*r+1]=Math.random(),t[5*r+2]=Math.random(),t[5*r+3]=Math.random(),t[5*r+4]=.25+.75*Math.random();return t}(b.dustCount),w=new Float32Array(0),R=new Map,B=()=>{try{let e=y.createBuffer(),t=y.createBuffer(),r=y.createBuffer();if(!e||!t||!r)throw Error("could not create a buffer");y.bindBuffer(y.ARRAY_BUFFER,e),y.bufferData(y.ARRAY_BUFFER,A,y.STATIC_DRAW),y.bindBuffer(y.ARRAY_BUFFER,t),y.bufferData(y.ARRAY_BUFFER,S,y.STATIC_DRAW),y.bindBuffer(y.ARRAY_BUFFER,r),y.bufferData(y.ARRAY_BUFFER,w,y.DYNAMIC_DRAW);let a=["uSize","uTime","uParallax","uScroll","uPoolCenter","uPoolRadius"];return{light:x(y,s,h,["aCorner"],[...a,"uGold","uGoldDark","uGoldPale"]),dust:x(y,d,m,["aSeed","aDepth"],[...a,"uPointScale","uMoteSize","uGoldLight","uGoldPale"]),thread:x(y,c,g,["aPosition","aAlongPhaseBirth"],["uSize","uParallax","uTime","uGain","uGold","uGoldPale"]),cornerBuffer:e,dustBuffer:t,threadBuffer:r}}catch(e){return console.warn("[sponsors] stage renderer could not start",e),null}},E=B();if(!E)return null;let M=!function(e){let t=e.getExtension("WEBGL_debug_renderer_info");if(!t)return!1;let r=String(e.getParameter(t.UNMASKED_RENDERER_WEBGL)??"");return l.test(r)}(y)?1:.5,_=0,F=!1,L=1,G=1,T=1,C=!1,D={x:0,y:0},z={x:1,y:1},U=D,H=z,N=!1,O=!1,I=()=>{let e=(f.cardGroups?.()??[]).map(e=>e.map(e=>{let r=function(e,t){let r=0,a=0,o=e;for(;o&&o!==t;)r+=o.offsetLeft,a+=o.offsetTop,o=o.offsetParent;return{x:r,y:a}}(e,t);return{x:r.x+e.offsetWidth/2,y:r.y+e.offsetHeight/2}}));w=function(e,t,r){let a=[];for(let t of e)for(let[e,r]of function(e){let t=e.length,r=[];if(t<2)return r;let a=Array(t).fill(!1),o=Array(t).fill(1/0),i=Array(t).fill(-1);o[0]=0;for(let n=0;n<t;n++){let n=-1;for(let e=0;e<t;e++)!a[e]&&(-1===n||o[e]<o[n])&&(n=e);a[n]=!0,-1!==i[n]&&r.push([i[n],n]);for(let r=0;r<t;r++){if(a[r])continue;let t=(e[n].x-e[r].x)**2+(e[n].y-e[r].y)**2;t<o[r]&&(o[r]=t,i[r]=n)}}return r}(t))a.push([t[e],t[r]]);let o=new Set,i=new Float32Array(2*a.length*5);for(let e of(a.forEach(([e,a],n)=>{let l=`${Math.round(e.x)},${Math.round(e.y)}>${Math.round(a.x)},${Math.round(a.y)}`;o.add(l);let u=t.get(l)??r;t.set(l,u);let f=.381966*n%1;i.set([e.x,e.y,0,f,u,a.x,a.y,1,f,u],2*n*5)}),t.keys()))o.has(e)||t.delete(e);return i}(e,R,Y);let r=e.flat();if(r.length>0){let e=r.map(e=>e.x),t=r.map(e=>e.y),[a,o,i,n]=[Math.min(...e),Math.max(...e),Math.min(...t),Math.max(...t)];U={x:(a+o)/2,y:(i+n)/2},H={x:Math.max(160,(o-a)/2*1.2+140),y:Math.max(120,(n-i)/2*1.2+110)}}else U={x:L/2,y:.55*G},H={x:.34*L,y:.2*G};N&&er&&!O||(D=U,z=H,N=!0),O=!1,E&&!C&&(y.bindBuffer(y.ARRAY_BUFFER,E.threadBuffer),y.bufferData(y.ARRAY_BUFFER,w,y.DYNAMIC_DRAW))},Y=0,W=0,k=0,V=0,$=e=>{y.uniform2f(e.uniforms.uSize,L,G),y.uniform1f(e.uniforms.uTime,Y),y.uniform2f(e.uniforms.uParallax,W,k),y.uniform1f(e.uniforms.uScroll,V),y.uniform2f(e.uniforms.uPoolCenter,D.x,D.y),y.uniform2f(e.uniforms.uPoolRadius,z.x,z.y)},q=()=>{E&&!C&&(y.clearColor(0,0,0,0),y.clear(y.COLOR_BUFFER_BIT),y.enable(y.BLEND),y.blendFunc(y.ONE,y.ONE_MINUS_SRC_ALPHA),(e=>{let{light:t}=e;y.useProgram(t.handle),y.bindBuffer(y.ARRAY_BUFFER,e.cornerBuffer),y.enableVertexAttribArray(t.attributes.aCorner),y.vertexAttribPointer(t.attributes.aCorner,2,y.FLOAT,!1,0,0),$(t),y.uniform3f(t.uniforms.uGold,r[0],r[1],r[2]),y.uniform3f(t.uniforms.uGoldDark,i[0],i[1],i[2]),y.uniform3f(t.uniforms.uGoldPale,o[0],o[1],o[2]),y.drawArrays(y.TRIANGLES,0,3),y.disableVertexAttribArray(t.attributes.aCorner)})(E),(e=>{let t=w.length/5;if(0===t)return;let{thread:a}=e;y.useProgram(a.handle),y.bindBuffer(y.ARRAY_BUFFER,e.threadBuffer),y.enableVertexAttribArray(a.attributes.aPosition),y.vertexAttribPointer(a.attributes.aPosition,2,y.FLOAT,!1,20,0),y.enableVertexAttribArray(a.attributes.aAlongPhaseBirth),y.vertexAttribPointer(a.attributes.aAlongPhaseBirth,3,y.FLOAT,!1,20,8),y.uniform2f(a.uniforms.uSize,L,G),y.uniform2f(a.uniforms.uParallax,W,k),y.uniform1f(a.uniforms.uTime,Y),y.uniform1f(a.uniforms.uGain,Math.sqrt(Math.min(1,T))),y.uniform3f(a.uniforms.uGold,r[0],r[1],r[2]),y.uniform3f(a.uniforms.uGoldPale,o[0],o[1],o[2]),y.drawArrays(y.LINES,0,t),y.disableVertexAttribArray(a.attributes.aPosition),y.disableVertexAttribArray(a.attributes.aAlongPhaseBirth)})(E),(e=>{let{dust:t}=e;y.useProgram(t.handle),y.bindBuffer(y.ARRAY_BUFFER,e.dustBuffer),y.enableVertexAttribArray(t.attributes.aSeed),y.vertexAttribPointer(t.attributes.aSeed,4,y.FLOAT,!1,20,0),y.enableVertexAttribArray(t.attributes.aDepth),y.vertexAttribPointer(t.attributes.aDepth,1,y.FLOAT,!1,20,16),$(t),y.uniform1f(t.uniforms.uPointScale,T),y.uniform1f(t.uniforms.uMoteSize,2.8),y.uniform3f(t.uniforms.uGoldLight,a[0],a[1],a[2]),y.uniform3f(t.uniforms.uGoldPale,o[0],o[1],o[2]),y.drawArrays(y.POINTS,0,b.dustCount),y.disableVertexAttribArray(t.attributes.aSeed),y.disableVertexAttribArray(t.attributes.aDepth)})(E))},j=(t,r)=>{O=Math.max(1,Math.round(t))!==L||Math.max(1,Math.round(r))!==G,T=u(b,L=Math.max(1,Math.round(t)),G=Math.max(1,Math.round(r)),M),e.width=Math.floor(L*T),e.height=Math.floor(G*T),y.viewport(0,0,e.width,e.height),I(),(F||!er)&&q()},K=t.getBoundingClientRect(),X=!1,J=NaN,Q=NaN,Z=e=>{"touch"!==e.pointerType&&(J=e.clientX,Q=e.clientY)},ee=()=>{X=!0},et=0,er=!1,ea=!0,eo=0,ei=0,en=0,el=!1,eu=!1;j(t.clientWidth||window.innerWidth,t.clientHeight||window.innerHeight);let ef=e=>{et=requestAnimationFrame(ef);let r=e-eo;if(r<n-1)return;eo=e;let a=Math.min(r,100)/1e3,o=performance.now();Y+=a,X&&(K=t.getBoundingClientRect(),X=!1);let i=0,l=0;!Number.isNaN(J)&&J>K.left-160&&J<K.right+160&&Q>K.top-160&&Q<K.bottom+160&&(i=v(((J-K.left)/Math.max(1,K.width)-.5)*2,-1,1),l=v(((Q-K.top)/Math.max(1,K.height)-.5)*2,-1,1));let s=1-Math.exp(-(3.2*a));W+=(i-W)*s,k+=(l-k)*s;let h=(K.top+K.height/2-window.innerHeight/2)/(window.innerHeight/2+K.height/2);if(V+=(v(-h,-1,1)-V)*s,D={x:D.x+(U.x-D.x)*s,y:D.y+(U.y-D.y)*s},z={x:z.x+(H.x-z.x)*s,y:z.y+(H.y-z.y)*s},q(),eu||(eu=!0,f.onStateChange?.("live")),en+=performance.now()-o,++ei>=30){let e=en/ei;if(ei=0,en=0,e>5){let e=u(b,L,G,.7*M)<T-.005;_<3&&e?(_++,M*=.7,j(L,G)):(F=!0,es(),f.onStateChange?.("frozen"))}}},es=()=>{let e=ea&&!document.hidden&&!el&&!F;e&&!er?(er=!0,eo=performance.now(),X=!0,window.addEventListener("pointermove",Z,{passive:!0}),window.addEventListener("scroll",ee,{passive:!0}),et=requestAnimationFrame(ef)):!e&&er&&(er=!1,cancelAnimationFrame(et),window.removeEventListener("pointermove",Z),window.removeEventListener("scroll",ee))},eh=new ResizeObserver(()=>{let e=t.clientWidth,r=t.clientHeight;X=!0,(Math.abs(e-L)>=2||Math.abs(r-G)>=2)&&j(e,r)});eh.observe(t);let ed=e=>{e.preventDefault(),C=!0,f.onStateChange?.("lost")},em=()=>{(E=B())&&(C=!1,j(L,G),q(),f.onStateChange?.(F?"frozen":"live"))};e.addEventListener("webglcontextlost",ed),e.addEventListener("webglcontextrestored",em);let ec=new IntersectionObserver(e=>{let t=e[e.length-1];t&&(ea=t.isIntersecting,es())});return ec.observe(t),document.addEventListener("visibilitychange",es),es(),{refresh(){!el&&(I(),er||q())},dispose(){el||(el=!0,es(),ec.disconnect(),eh.disconnect(),document.removeEventListener("visibilitychange",es),e.removeEventListener("webglcontextlost",ed),e.removeEventListener("webglcontextrestored",em),E&&(y.deleteBuffer(E.cornerBuffer),y.deleteBuffer(E.dustBuffer),y.deleteBuffer(E.threadBuffer),y.deleteProgram(E.light.handle),y.deleteProgram(E.dust.handle),y.deleteProgram(E.thread.handle),E=null),y.getExtension("WEBGL_lose_context")?.loseContext())}}}])}]);