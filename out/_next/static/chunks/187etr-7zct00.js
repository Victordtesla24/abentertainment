(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,21618,e=>{"use strict";let t,r=1e3/30,o=/swiftshader|llvmpipe|softpipe|software|basic render/i,i=[(t=e=>{let t=e/255;return t<.04045?.0773993808*t:Math.pow(.9478672986*t+.0521327014,2.4)})(201),t(168),t(76)],a=[201/255,168/255,76/255];function n(e){let t=1/Math.tan(60*Math.PI/360),r=Array(16).fill(0);return r[0]=t/e,r[5]=t,r[10]=-1.0040080160320641,r[11]=-1,r[14]=-.20040080160320642,r}function l(e,t,r,o,i,a){let n=Math.cos(o),l=Math.sin(o),u=Math.cos(i),f=Math.sin(i);return[u*a,n*f*a,l*f*a,0,-f*a,n*u*a,l*u*a,0,0,-l*a,n*a,0,e,t,r-5,1]}let u=`
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  varying vec2 vUv;
  varying float vY;
  void main() {
    vUv = uv;
    vY = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,f=`
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vY;

  void main() {
    // Gradient from tip (bright) to base (transparent)
    float gradient = smoothstep(-4.0, 4.0, vY);
    float alpha = gradient * uOpacity;

    // Edge falloff
    float dist = distance(vUv, vec2(0.5, vUv.y));
    alpha *= smoothstep(0.5, 0.2, dist);

    // Animated shimmer
    float shimmer = sin(vUv.y * 20.0 + uTime * 2.0) * 0.15 + 0.85;
    alpha *= shimmer;

    // Dust particles effect
    float dust = sin(vUv.x * 40.0 + uTime) * sin(vUv.y * 30.0 - uTime * 0.5);
    dust = smoothstep(0.7, 1.0, dust) * 0.3;
    alpha += dust * gradient;

    gl_FragColor = vec4(uColor, alpha);
  }
`,s=`
  attribute vec3 position;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uSize;
  uniform float uScale;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Motes shrink with distance: pixels per world unit at that depth.
    gl_PointSize = uSize * (uScale / -mvPosition.z);
  }
`,d=`
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
  }
`;function c(e,t,r){let o=e.createShader(t);if(!o)throw Error("could not create a shader");if(e.shaderSource(o,r),e.compileShader(o),!e.getShaderParameter(o,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(o);throw e.deleteShader(o),Error(`shader failed to compile: ${t}`)}return o}function m(e,t,r){let o=(e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT)?.precision??0)>0,i=c(e,e.VERTEX_SHADER,`precision highp float;
${t}`),a=c(e,e.FRAGMENT_SHADER,`precision ${o?"highp":"mediump"} float;
${r}`),n=e.createProgram();if(!n)throw Error("could not create a program");if(e.attachShader(n,i),e.attachShader(n,a),e.linkProgram(n),e.deleteShader(i),e.deleteShader(a),!e.getProgramParameter(n,e.LINK_STATUS)){let t=e.getProgramInfoLog(n);throw e.deleteProgram(n),Error(`program failed to link: ${t}`)}return{handle:n,attribute:t=>e.getAttribLocation(n,t),uniform:t=>e.getUniformLocation(n,t)}}e.s(["mountHeroSpotlight",0,function(e,t){let c,h=(c=navigator,window.innerWidth<1024||void 0!==c.deviceMemory&&c.deviceMemory<=4?{dustCount:48,coneSegments:20,pixelBudget:33e4,maxPixelRatio:1}:{dustCount:120,coneSegments:32,pixelBudget:7e5,maxPixelRatio:1.5}),v={antialias:!1,alpha:!0,depth:!1,stencil:!1,powerPreference:"low-power"},g=e.getContext("webgl2",v)??e.getContext("webgl",v);if(!g)return null;let p=h.dustCount,A=new Float32Array(3*p),M=new Float32Array(3*p);for(let e=0;e<p;e++)A[3*e]=(Math.random()-.5)*8,A[3*e+1]=(Math.random()-.5)*6,A[3*e+2]=(Math.random()-.5)*4-1,M[3*e]=(Math.random()-.5)*.003,M[3*e+1]=.004*Math.random()+.001,M[3*e+2]=(Math.random()-.5)*.002;let b=function(e){let t=new Float32Array(3*e*5),r=0,o=(e,o,i,a,n)=>{t[r++]=e,t[r++]=o,t[r++]=i,t[r++]=a,t[r++]=n},i=t=>{let r=t/e,i=r*Math.PI*2;o(3*Math.sin(i),-4,3*Math.cos(i),r,0)},a=t=>o(0,4,0,t/e,1);for(let t=0;t<e;t++)i(t),i(t+1),a(t+1);return t}(h.coneSegments),x=3*h.coneSegments,R=()=>{try{let e=g.createBuffer(),t=g.createBuffer();if(!e||!t)throw Error("could not create a buffer");return g.bindBuffer(g.ARRAY_BUFFER,e),g.bufferData(g.ARRAY_BUFFER,b,g.STATIC_DRAW),g.bindBuffer(g.ARRAY_BUFFER,t),g.bufferData(g.ARRAY_BUFFER,A,g.DYNAMIC_DRAW),{cone:m(g,u,f),dust:m(g,s,d),coneBuffer:e,dustBuffer:t}}catch(e){return console.warn("[hero] spotlight renderer could not start",e),null}},w=R();if(!w)return null;let E=function(e){let t=e.getExtension("WEBGL_debug_renderer_info");if(!t)return!1;let r=String(e.getParameter(t.UNMASKED_RENDERER_WEBGL)??"");return o.test(r)}(g),S={x:0,y:2,z:-2,rotationX:0,scale:1,opacity:.08,timeOffset:0},y={x:-1.5,y:2.5,z:-3,rotationX:.15,scale:.7,opacity:.04,timeOffset:1},_={x:1.5,y:2.5,z:-3,rotationX:-.15,scale:.7,opacity:.04,timeOffset:2},F=[y,_,S],P=E?.5:1,C=0,B=!1,L=0,O=0,T=1,U=n(1),I=!1,N=0,D=()=>{if(w&&!I){let o;g.clearColor(0,0,0,0),g.clear(g.COLOR_BUFFER_BIT),g.enable(g.BLEND);var e,t=w,r=N;g.useProgram(t.cone.handle),g.bindBuffer(g.ARRAY_BUFFER,t.coneBuffer);let n=t.cone.attribute("position"),u=t.cone.attribute("uv");for(let e of(g.enableVertexAttribArray(n),g.vertexAttribPointer(n,3,g.FLOAT,!1,20,0),g.enableVertexAttribArray(u),g.vertexAttribPointer(u,2,g.FLOAT,!1,20,12),g.uniformMatrix4fv(t.cone.uniform("projectionMatrix"),!1,U),g.uniform3f(t.cone.uniform("uColor"),i[0],i[1],i[2]),g.enable(g.CULL_FACE),g.cullFace(g.BACK),g.blendFuncSeparate(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA,g.ONE,g.ONE_MINUS_SRC_ALPHA),F))g.uniformMatrix4fv(t.cone.uniform("modelViewMatrix"),!1,l(e.x,e.y,e.z,e.rotationX,Math.PI,e.scale)),g.uniform1f(t.cone.uniform("uTime"),r+e.timeOffset),g.uniform1f(t.cone.uniform("uOpacity"),e.opacity),g.frontFace(g.CW),g.drawArrays(g.TRIANGLES,0,x),g.frontFace(g.CCW),g.drawArrays(g.TRIANGLES,0,x);g.disableVertexAttribArray(n),g.disableVertexAttribArray(u),e=w,g.useProgram(e.dust.handle),g.bindBuffer(g.ARRAY_BUFFER,e.dustBuffer),g.bufferSubData(g.ARRAY_BUFFER,0,A),o=e.dust.attribute("position"),g.enableVertexAttribArray(o),g.vertexAttribPointer(o,3,g.FLOAT,!1,0,0),g.uniformMatrix4fv(e.dust.uniform("projectionMatrix"),!1,U),g.uniformMatrix4fv(e.dust.uniform("modelViewMatrix"),!1,l(0,0,0,0,0,1)),g.uniform1f(e.dust.uniform("uSize"),.025*T),g.uniform1f(e.dust.uniform("uScale"),.5*O),g.uniform3f(e.dust.uniform("uColor"),a[0],a[1],a[2]),g.uniform1f(e.dust.uniform("uOpacity"),.5),g.disable(g.CULL_FACE),g.blendFuncSeparate(g.SRC_ALPHA,g.ONE,g.ONE,g.ONE),g.drawArrays(g.POINTS,0,p),g.disableVertexAttribArray(o)}},V=(t,r)=>{var o,i,a;let l,u;L=Math.max(1,Math.round(t)),O=Math.max(1,Math.round(r)),o=L,i=O,a=P,l=Math.max(1,o*i),u=Math.sqrt(h.pixelBudget/l),T=Math.max(.3,Math.min(window.devicePixelRatio||1,h.maxPixelRatio,u)*a),e.width=Math.floor(L*T),e.height=Math.floor(O*T),g.viewport(0,0,Math.round(L*T),Math.round(O*T)),U=n(L/O),B&&D()},Y=t.getBoundingClientRect();V(Y.width||window.innerWidth,Y.height||window.innerHeight);let H=new ResizeObserver(e=>{let t=e[e.length-1];if(!t)return;let{width:r,height:o}=t.contentRect,i=Math.abs(o-O)>Math.max(120,.2*O);(Math.abs(r-L)>=2||i)&&V(r,o)});H.observe(t);let z=0,G=!1,W=!0,X=0,j=0,K=0,$=!1,k=e=>{z=requestAnimationFrame(k);let t=e-X;if(t<r-1)return;X=e;let o=Math.min(t,100)/1e3,i=performance.now();S.rotationX=.08*Math.sin(.3*(N+=.6*o)),S.x=.3*Math.sin(.2*N),y.rotationX=.1*Math.sin(.25*N+1)+.15,_.rotationX=.1*Math.sin(.25*N+2)-.15;let a=60*o;for(let e=0;e<p;e++){let t=A[3*e]+M[3*e]*a,r=A[3*e+1]+M[3*e+1]*a,o=A[3*e+2]+M[3*e+2]*a;r>4&&(r=-3),t>5&&(t=-5),t<-5&&(t=5),A[3*e]=t,A[3*e+1]=r,A[3*e+2]=o}if(D(),K+=performance.now()-i,++j>=30){let e=K/j;j=0,K=0,e>5&&(C<3?(C++,P*=.7,V(L,O)):(B=!0,q()))}},q=()=>{let e=W&&!document.hidden&&!$&&!B;e&&!G?(G=!0,X=performance.now(),z=requestAnimationFrame(k)):!e&&G&&(G=!1,cancelAnimationFrame(z))},J=e=>{e.preventDefault(),I=!0},Q=()=>{w=R(),I=!1,V(L,O),D()};e.addEventListener("webglcontextlost",J),e.addEventListener("webglcontextrestored",Q);let Z=new IntersectionObserver(e=>{let t=e[e.length-1];t&&(W=t.isIntersecting,q())});return Z.observe(t),document.addEventListener("visibilitychange",q),q(),{dispose(){$||($=!0,q(),Z.disconnect(),H.disconnect(),document.removeEventListener("visibilitychange",q),e.removeEventListener("webglcontextlost",J),e.removeEventListener("webglcontextrestored",Q),w&&(g.deleteBuffer(w.coneBuffer),g.deleteBuffer(w.dustBuffer),g.deleteProgram(w.cone.handle),g.deleteProgram(w.dust.handle),w=null),g.getExtension("WEBGL_lose_context")?.loseContext())}}}])}]);