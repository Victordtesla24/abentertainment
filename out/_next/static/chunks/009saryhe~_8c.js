(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,88262,e=>{"use strict";let t;var r=e.i(18050),i=e.i(71645),s=e.i(18566),o=e.i(90072),a=e.i(8560);let n={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};var l=o;class h{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}let c=new l.OrthographicCamera(-1,1,1,-1,0,1);class d extends l.BufferGeometry{constructor(){super(),this.setAttribute("position",new l.Float32BufferAttribute([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new l.Float32BufferAttribute([0,2,0,0,2,0],2))}}let u=new d;class f{constructor(e){this._mesh=new l.Mesh(u,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,c)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class p extends h{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof o.ShaderMaterial?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=o.UniformsUtils.clone(e.uniforms),this.material=new o.ShaderMaterial({name:void 0!==e.name?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new f(this.material)}render(e,t,r){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=r.texture),this._fsQuad.material=this.material,this.renderToScreen?e.setRenderTarget(null):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil)),this._fsQuad.render(e)}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class m extends h{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,r){let i,s,o=e.getContext(),a=e.state;a.buffers.color.setMask(!1),a.buffers.depth.setMask(!1),a.buffers.color.setLocked(!0),a.buffers.depth.setLocked(!0),this.inverse?(i=0,s=1):(i=1,s=0),a.buffers.stencil.setTest(!0),a.buffers.stencil.setOp(o.REPLACE,o.REPLACE,o.REPLACE),a.buffers.stencil.setFunc(o.ALWAYS,i,0xffffffff),a.buffers.stencil.setClear(s),a.buffers.stencil.setLocked(!0),e.setRenderTarget(r),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),a.buffers.color.setLocked(!1),a.buffers.depth.setLocked(!1),a.buffers.color.setMask(!0),a.buffers.depth.setMask(!0),a.buffers.stencil.setLocked(!1),a.buffers.stencil.setFunc(o.EQUAL,1,0xffffffff),a.buffers.stencil.setOp(o.KEEP,o.KEEP,o.KEEP),a.buffers.stencil.setLocked(!0)}}class v extends h{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class g{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),void 0===t){const r=e.getSize(new o.Vector2);this._width=r.width,this._height=r.height,(t=new o.WebGLRenderTarget(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:o.HalfFloatType})).texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new p(n),this.copyPass.material.blending=o.NoBlending,this.timer=new o.Timer}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);-1!==t&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),void 0===e&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),r=!1;for(let t=0,i=this.passes.length;t<i;t++){let i=this.passes[t];if(!1!==i.enabled){if(i.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(t),i.render(this.renderer,this.writeBuffer,this.readBuffer,e,r),i.needsSwap){if(r){let t=this.renderer.getContext(),r=this.renderer.state.buffers.stencil;r.setFunc(t.NOTEQUAL,1,0xffffffff),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),r.setFunc(t.EQUAL,1,0xffffffff)}this.swapBuffers()}void 0!==m&&(i instanceof m?r=!0:i instanceof v&&(r=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(void 0===e){let t=this.renderer.getSize(new o.Vector2);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,(e=this.renderTarget1.clone()).setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let r=this._width*this._pixelRatio,i=this._height*this._pixelRatio;this.renderTarget1.setSize(r,i),this.renderTarget2.setSize(r,i);for(let e=0;e<this.passes.length;e++)this.passes[e].setSize(r,i)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class x extends h{constructor(e,t,r=null,i=null,s=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=r,this.clearColor=i,this.clearAlpha=s,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new o.Color}render(e,t,r){let i,s,o=e.autoClear;e.autoClear=!1,null!==this.overrideMaterial&&(s=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),null!==this.clearColor&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),null!==this.clearAlpha&&(i=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),!0==this.clearDepth&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:r),!0===this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),null!==this.clearColor&&e.setClearColor(this._oldClearColor),null!==this.clearAlpha&&e.setClearAlpha(i),null!==this.overrideMaterial&&(this.scene.overrideMaterial=s),e.autoClear=o}}let b={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new o.Color(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class w extends h{constructor(e,t=1,r,i){super(),this.strength=t,this.radius=r,this.threshold=i,this.resolution=void 0!==e?new o.Vector2(e.x,e.y):new o.Vector2(256,256),this.clearColor=new o.Color(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let s=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new o.WebGLRenderTarget(s,a,{type:o.HalfFloatType}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let e=0;e<this.nMips;e++){const t=new o.WebGLRenderTarget(s,a,{type:o.HalfFloatType});t.texture.name="UnrealBloomPass.h"+e,t.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(t);const r=new o.WebGLRenderTarget(s,a,{type:o.HalfFloatType});r.texture.name="UnrealBloomPass.v"+e,r.texture.generateMipmaps=!1,this.renderTargetsVertical.push(r),s=Math.round(s/2),a=Math.round(a/2)}this.highPassUniforms=o.UniformsUtils.clone(b.uniforms),this.highPassUniforms.luminosityThreshold.value=i,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new o.ShaderMaterial({uniforms:this.highPassUniforms,vertexShader:b.vertexShader,fragmentShader:b.fragmentShader}),this.separableBlurMaterials=[];const l=[6,10,14,18,22];s=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let e=0;e<this.nMips;e++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(l[e])),this.separableBlurMaterials[e].uniforms.invSize.value=new o.Vector2(1/s,1/a),s=Math.round(s/2),a=Math.round(a/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1,this.compositeMaterial.uniforms.bloomFactors.value=[1,.8,.6,.4,.2],this.bloomTintColors=[new o.Vector3(1,1,1),new o.Vector3(1,1,1),new o.Vector3(1,1,1),new o.Vector3(1,1,1),new o.Vector3(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=o.UniformsUtils.clone(n.uniforms),this.blendMaterial=new o.ShaderMaterial({uniforms:this.copyUniforms,vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,premultipliedAlpha:!0,blending:o.AdditiveBlending,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new o.Color,this._oldClearAlpha=1,this._basic=new o.MeshBasicMaterial,this._fsQuad=new f(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let r=Math.round(e/2),i=Math.round(t/2);this.renderTargetBright.setSize(r,i);for(let e=0;e<this.nMips;e++)this.renderTargetsHorizontal[e].setSize(r,i),this.renderTargetsVertical[e].setSize(r,i),this.separableBlurMaterials[e].uniforms.invSize.value=new o.Vector2(1/r,1/i),r=Math.round(r/2),i=Math.round(i/2)}render(e,t,r,i,s){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();let o=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),s&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=r.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=r.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let a=this.renderTargetBright;for(let t=0;t<this.nMips;t++)this._fsQuad.material=this.separableBlurMaterials[t],this.separableBlurMaterials[t].uniforms.colorTexture.value=a.texture,this.separableBlurMaterials[t].uniforms.direction.value=w.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[t]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[t].uniforms.colorTexture.value=this.renderTargetsHorizontal[t].texture,this.separableBlurMaterials[t].uniforms.direction.value=w.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[t]),e.clear(),this._fsQuad.render(e),a=this.renderTargetsVertical[t];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,s&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?e.setRenderTarget(null):e.setRenderTarget(r),this._fsQuad.render(e),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=o}_getSeparableBlurMaterial(e){let t=[],r=e/3;for(let i=0;i<e;i++)t.push(.39894*Math.exp(-.5*i*i/(r*r))/r);return new o.ShaderMaterial({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new o.Vector2(.5,.5)},direction:{value:new o.Vector2(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {

					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;

					for ( int i = 1; i < KERNEL_RADIUS; i ++ ) {

						float x = float( i );
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * w;

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new o.ShaderMaterial({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}}w.BlurDirectionX=new o.Vector2(1,0),w.BlurDirectionY=new o.Vector2(0,1);let C={name:"BokehShader",defines:{DEPTH_PACKING:1,PERSPECTIVE_CAMERA:1},uniforms:{tColor:{value:null},tDepth:{value:null},focus:{value:1},aspect:{value:1},aperture:{value:.025},maxblur:{value:.01},nearClip:{value:1},farClip:{value:1e3}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		#include <common>

		varying vec2 vUv;

		uniform sampler2D tColor;
		uniform sampler2D tDepth;

		uniform float maxblur; // max blur amount
		uniform float aperture; // aperture - bigger values for shallower depth of field

		uniform float nearClip;
		uniform float farClip;

		uniform float focus;
		uniform float aspect;

		#include <packing>

		float getDepth( const in vec2 screenPosition ) {
			#if DEPTH_PACKING == 1
			return unpackRGBAToDepth( texture2D( tDepth, screenPosition ) );
			#else
			return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		float getViewZ( const in float depth ) {
			#if PERSPECTIVE_CAMERA == 1
			return perspectiveDepthToViewZ( depth, nearClip, farClip );
			#else
			return orthographicDepthToViewZ( depth, nearClip, farClip );
			#endif
		}


		void main() {

			vec2 aspectcorrect = vec2( 1.0, aspect );

			float viewZ = getViewZ( getDepth( vUv ) );

			float factor = ( focus + viewZ ); // viewZ is <= 0, so this is a difference equation

			vec2 dofblur = vec2 ( clamp( factor * aperture, -maxblur, maxblur ) );

			vec2 dofblur9 = dofblur * 0.9;
			vec2 dofblur7 = dofblur * 0.7;
			vec2 dofblur4 = dofblur * 0.4;

			vec4 col = vec4( 0.0 );

			col += texture2D( tColor, vUv.xy );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,   0.4  ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.15,  0.37 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.29,  0.29 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.37,  0.15 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.40,  0.0  ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.37, -0.15 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.29, -0.29 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.15, -0.37 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,  -0.4  ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.15,  0.37 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29,  0.29 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.37,  0.15 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.4,   0.0  ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.37, -0.15 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29, -0.29 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.15, -0.37 ) * aspectcorrect ) * dofblur );

			col += texture2D( tColor, vUv.xy + ( vec2(  0.15,  0.37 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.37,  0.15 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.37, -0.15 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.15, -0.37 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.15,  0.37 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.37,  0.15 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.37, -0.15 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.15, -0.37 ) * aspectcorrect ) * dofblur9 );

			col += texture2D( tColor, vUv.xy + ( vec2(  0.29,  0.29 ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.40,  0.0  ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.29, -0.29 ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,  -0.4  ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29,  0.29 ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.4,   0.0  ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29, -0.29 ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,   0.4  ) * aspectcorrect ) * dofblur7 );

			col += texture2D( tColor, vUv.xy + ( vec2(  0.29,  0.29 ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.4,   0.0  ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.29, -0.29 ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,  -0.4  ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29,  0.29 ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.4,   0.0  ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29, -0.29 ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,   0.4  ) * aspectcorrect ) * dofblur4 );

			gl_FragColor = col / 41.0;
			gl_FragColor.a = 1.0;

		}`};class T extends h{constructor(e,t,r){super(),this.scene=e,this.camera=t;const i=void 0!==r.focus?r.focus:1,s=void 0!==r.aperture?r.aperture:.025,a=void 0!==r.maxblur?r.maxblur:1;this._renderTargetDepth=new o.WebGLRenderTarget(1,1,{minFilter:o.NearestFilter,magFilter:o.NearestFilter,type:o.HalfFloatType}),this._renderTargetDepth.texture.name="BokehPass.depth",this._materialDepth=new o.MeshDepthMaterial,this._materialDepth.depthPacking=o.RGBADepthPacking,this._materialDepth.blending=o.NoBlending;const n=o.UniformsUtils.clone(C.uniforms);n.tDepth.value=this._renderTargetDepth.texture,n.focus.value=i,n.aspect.value=t.aspect,n.aperture.value=s,n.maxblur.value=a,n.nearClip.value=t.near,n.farClip.value=t.far,this.materialBokeh=new o.ShaderMaterial({defines:Object.assign({},C.defines),uniforms:n,vertexShader:C.vertexShader,fragmentShader:C.fragmentShader}),this.uniforms=n,this._fsQuad=new f(this.materialBokeh),this._oldClearColor=new o.Color}render(e,t,r){this.scene.overrideMaterial=this._materialDepth,e.getClearColor(this._oldClearColor);let i=e.getClearAlpha(),s=e.autoClear;e.autoClear=!1,e.setClearColor(0xffffff),e.setClearAlpha(1),e.setRenderTarget(this._renderTargetDepth),e.clear(),e.render(this.scene,this.camera),this.uniforms.tColor.value=r.texture,this.uniforms.nearClip.value=this.camera.near,this.uniforms.farClip.value=this.camera.far,this.renderToScreen?e.setRenderTarget(null):(e.setRenderTarget(t),e.clear()),this._fsQuad.render(e),this.scene.overrideMaterial=null,e.setClearColor(this._oldClearColor),e.setClearAlpha(i),e.autoClear=s}setSize(e,t){this.materialBokeh.uniforms.aspect.value=e/t,this._renderTargetDepth.setSize(e,t)}dispose(){this._renderTargetDepth.dispose(),this._materialDepth.dispose(),this.materialBokeh.dispose(),this._fsQuad.dispose()}}let M={name:"FilmShader",uniforms:{tDiffuse:{value:null},time:{value:0},intensity:{value:.5},grayscale:{value:!1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		#include <common>

		uniform float intensity;
		uniform bool grayscale;
		uniform float time;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 base = texture2D( tDiffuse, vUv );

			float noise = rand( fract( vUv + time ) );

			vec3 color = base.rgb + base.rgb * clamp( 0.1 + noise, 0.0, 1.0 );

			color = mix( base.rgb, color, intensity );

			if ( grayscale ) {

				color = vec3( luminance( color ) ); // assuming linear-srgb

			}

			gl_FragColor = vec4( color, base.a );

		}`};class y extends h{constructor(e=.5,t=!1){super(),this.uniforms=o.UniformsUtils.clone(M.uniforms),this.material=new o.ShaderMaterial({name:M.name,uniforms:this.uniforms,vertexShader:M.vertexShader,fragmentShader:M.fragmentShader}),this.uniforms.intensity.value=e,this.uniforms.grayscale.value=t,this._fsQuad=new f(this.material)}render(e,t,r,i){this.uniforms.tDiffuse.value=r.texture,this.uniforms.time.value+=i,this.renderToScreen?e.setRenderTarget(null):(e.setRenderTarget(t),this.clear&&e.clear()),this._fsQuad.render(e)}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class S{composer;bloomPass;bokehPass;filmPass;constructor(e,t,r){this.composer=new g(e);const i=new x(t,r);this.composer.addPass(i),this.bloomPass=new w(new o.Vector2(window.innerWidth,window.innerHeight),.8,.4,.85),this.composer.addPass(this.bloomPass),this.bokehPass=new T(t,r,{focus:10,aperture:5e-5,maxblur:.01}),this.composer.addPass(this.bokehPass),this.filmPass=new y(.15,!1),this.composer.addPass(this.filmPass)}resize(e,t){this.composer.setSize(e,t),this.bloomPass&&this.bloomPass.resolution.set(e,t)}render(e){this.composer.render(e)}dispose(){for(let e of(this.composer.renderTarget1?.dispose(),this.composer.renderTarget2?.dispose(),this.composer.passes))"dispose"in e&&"function"==typeof e.dispose&&e.dispose()}}let D=["full","reduced","minimal","fallback"];class P{frameTimes=[];maxFramesToTrack=60;criticalFpsThreshold=30;recoveryFpsThreshold=50;timeBelowThreshold=0;degradationTimeLimit=2;currentTierIndex=0;reportedToSentry=!1;hysteresisCount=3;declineStreak=0;inclineStreak=0;windowSampleCount=0;checkHealth(e){return 0===e||e>.5||(this.frameTimes.push(1/e),this.frameTimes.length>this.maxFramesToTrack&&this.frameTimes.shift(),this.windowSampleCount++,this.windowSampleCount>=this.maxFramesToTrack&&(this.windowSampleCount=0,this.evaluateWindow()),this.frameTimes.reduce((e,t)=>e+t,0)/this.frameTimes.length<this.criticalFpsThreshold?(this.timeBelowThreshold+=e,this.timeBelowThreshold>=this.degradationTimeLimit&&"fallback"!==this.currentTier&&this.downgrade()):this.timeBelowThreshold=Math.max(0,this.timeBelowThreshold-2*e)),"fallback"!==this.currentTier}evaluateWindow(){if(0===this.frameTimes.length)return;let e=this.frameTimes.reduce((e,t)=>e+t,0)/this.frameTimes.length;e<this.criticalFpsThreshold?(this.declineStreak++,this.inclineStreak=0,this.declineStreak>=this.hysteresisCount&&(this.downgrade(),this.declineStreak=0)):e>this.recoveryFpsThreshold?(this.inclineStreak++,this.declineStreak=0,this.inclineStreak>=this.hysteresisCount&&(this.upgrade(),this.inclineStreak=0)):(this.declineStreak=0,this.inclineStreak=0)}downgrade(){if(this.currentTierIndex>=D.length-1)return;this.currentTierIndex++;let e=this.currentTier;this.reportedToSentry||(this.reportedToSentry=!0);let t=this.frameTimes.length>0?this.frameTimes.reduce((e,t)=>e+t,0)/this.frameTimes.length:0;console.warn(`[FailsafeMonitor] Downgraded to "${e}" (avg FPS: ${t.toFixed(1)}).`),this.applyTierSettings()}upgrade(){if(this.currentTierIndex<=0)return;this.currentTierIndex--;let e=this.currentTier,t=this.frameTimes.length>0?this.frameTimes.reduce((e,t)=>e+t,0)/this.frameTimes.length:0;console.info(`[FailsafeMonitor] Upgraded to "${e}" (avg FPS: ${t.toFixed(1)}).`),this.applyTierSettings()}applyTierSettings(){window.dispatchEvent(new CustomEvent("quality-tier-changed",{detail:{tier:this.currentTier,settings:this.qualitySettings}}))}get currentTier(){return D[this.currentTierIndex]}get qualitySettings(){return({full:{shadowsEnabled:!0,pixelRatio:Math.min(window.devicePixelRatio,2)},reduced:{shadowsEnabled:!1,pixelRatio:1.5},minimal:{shadowsEnabled:!1,pixelRatio:1},fallback:{shadowsEnabled:!1,pixelRatio:1}})[this.currentTier]}get isHealthy(){return"fallback"!==this.currentTier}get isDegraded(){return this.currentTierIndex>0}}class _{static instance;static isDisposing=!1;scene;camera;renderer;timer;canvas;postProcessing;monitor;isInitialized=!1;boundResizeHandler=null;isContextLost=!1;contextLossCount=0;static MAX_CONTEXT_RECOVERIES=3;callbacks={};boundContextLostHandler=null;boundContextRestoredHandler=null;boundVisibilityChangeHandler=null;wasRenderingBeforeHidden=!1;interactiveSpotLight=null;spotLightTargetObject=null;pointerTarget=new o.Vector2(0,0);pointerCurrent=new o.Vector2(0,0);pointerDelta=new o.Vector2(0,0);pointerPrev=new o.Vector2(0,0);reducedMotion=!1;boundPointerMoveHandler=null;constructor(e){this.canvas=e,this.scene=new o.Scene,this.reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches,this.scene.background=new o.Color(657932),this.scene.fog=new o.FogExp2(657932,.015),this.camera=function(){let e=new o.PerspectiveCamera(45,window.innerWidth/window.innerHeight,.1,1e3);return(t=new o.CatmullRomCurve3([new o.Vector3(0,5,20),new o.Vector3(10,8,10),new o.Vector3(5,4,-10),new o.Vector3(-10,2,-20),new o.Vector3(0,10,-40)])).tension=.5,e.position.copy(t.getPointAt(0)),e.lookAt(0,0,0),e}(),this.timer=new o.Timer,this.monitor=new P}static async getInstance(e,t){return _.isDisposing&&await new Promise(e=>setTimeout(e,50)),_.instance?(_.instance.bindCanvas(e),t&&(_.instance.callbacks=t)):(_.instance=new _(e),t&&(_.instance.callbacks=t),await _.instance.initRenderer(),_.instance.isInitialized&&_.instance.renderer&&(await _.instance.scheduleIdleWork(()=>{_.instance.setupLights()}),await _.instance.scheduleIdleWork(()=>{_.instance.postProcessing=new S(_.instance.renderer,_.instance.scene,_.instance.camera)}),_.instance.attachContextHandlers(),_.instance.attachVisibilityHandler(),_.instance.attachPointerMoveHandler())),_.instance}scheduleIdleWork(e){return new Promise(t=>{let r=()=>{e(),t()};"function"==typeof requestIdleCallback?requestIdleCallback(r,{timeout:3e3}):setTimeout(r,0)})}attachContextHandlers(){this.boundContextLostHandler=e=>{e.preventDefault(),this.isContextLost=!0,console.warn("[ThreeEngine] WebGL context lost."),this.callbacks.onContextLost?.()},this.boundContextRestoredHandler=e=>{if(this.contextLossCount++,console.warn(`[ThreeEngine] WebGL context restored (recovery #${this.contextLossCount}).`),this.contextLossCount>=_.MAX_CONTEXT_RECOVERIES){console.warn("[ThreeEngine] Max context recoveries exceeded, switching to fallback."),this.isContextLost=!0,this.isInitialized=!1,window.dispatchEvent(new CustomEvent("webgl-context-failed",{detail:Error("WebGL context lost too many times")})),this.callbacks.onFallback?.();return}this.rebuildRenderer(),this.isContextLost=!1,this.timer.reset(),this.callbacks.onContextRestored?.()},this.canvas.addEventListener("webglcontextlost",this.boundContextLostHandler),this.canvas.addEventListener("webglcontextrestored",this.boundContextRestoredHandler)}rebuildRenderer(){this.renderer?.dispose(),this.renderer=new a.WebGLRenderer({canvas:this.canvas,powerPreference:"high-performance",antialias:!1,stencil:!1,depth:!0}),this.renderer.setSize(window.innerWidth,window.innerHeight),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)),this.renderer.toneMapping=o.ACESFilmicToneMapping,this.renderer.toneMappingExposure=1,this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=o.PCFShadowMap,this.scene.traverse(e=>{if(e instanceof o.Mesh)for(let t of Array.isArray(e.material)?e.material:[e.material])t.needsUpdate=!0,t.map&&(t.map.needsUpdate=!0),t.normalMap&&(t.normalMap.needsUpdate=!0),t.roughnessMap&&(t.roughnessMap.needsUpdate=!0),t.metalnessMap&&(t.metalnessMap.needsUpdate=!0),t.aoMap&&(t.aoMap.needsUpdate=!0),t.emissiveMap&&(t.emissiveMap.needsUpdate=!0)}),this.postProcessing&&(this.postProcessing.dispose?.(),this.postProcessing=new S(this.renderer,this.scene,this.camera))}attachVisibilityHandler(){this.boundVisibilityChangeHandler=()=>{document.hidden?this.wasRenderingBeforeHidden=this.isInitialized&&!this.isContextLost:this.wasRenderingBeforeHidden&&!this.isContextLost&&this.timer.reset()},document.addEventListener("visibilitychange",this.boundVisibilityChangeHandler)}bindCanvas(e){this.canvas=e}async initRenderer(){try{this.renderer=new a.WebGLRenderer({canvas:this.canvas,powerPreference:"high-performance",antialias:!1,stencil:!1,depth:!0}),this.renderer.setSize(window.innerWidth,window.innerHeight),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)),this.renderer.toneMapping=o.ACESFilmicToneMapping,this.renderer.toneMappingExposure=1,this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=o.PCFShadowMap,this.isInitialized=!0}catch(e){this.isInitialized=!1,window.dispatchEvent(new CustomEvent("webgl-context-failed",{detail:e}));return}this.boundResizeHandler=this.onWindowResize.bind(this),window.addEventListener("resize",this.boundResizeHandler)}setupLights(){let e=new o.AmbientLight(0xffffff,.1);this.scene.add(e);let t=new o.DirectionalLight(0xffcaa6,2.5);t.position.set(50,20,10),t.castShadow=!0,t.shadow.mapSize.width=2048,t.shadow.mapSize.height=2048,t.shadow.bias=-1e-4,this.scene.add(t);let r=new o.DirectionalLight(4874352,.8);r.position.set(-20,10,-20),this.scene.add(r),this.interactiveSpotLight=new o.SpotLight(0xc9a84c,1.8,42,Math.PI/7,.42,1),this.interactiveSpotLight.position.set(0,12,14),this.interactiveSpotLight.castShadow=!1,this.scene.add(this.interactiveSpotLight),this.spotLightTargetObject=new o.Object3D,this.spotLightTargetObject.position.set(0,0,0),this.scene.add(this.spotLightTargetObject),this.interactiveSpotLight.target=this.spotLightTargetObject}setPointerNormalized(e,t){this.pointerTarget.set(e,t)}createInstancedParticles(e,t,r,i){let s=new o.InstancedMesh(t,r,e);s.instanceMatrix.setUsage(o.DynamicDrawUsage);let a=new o.Object3D;for(let t=0;t<e;t++){let e=i(t);a.position.copy(e),a.updateMatrix(),s.setMatrixAt(t,a.matrix)}return s.instanceMatrix.needsUpdate=!0,this.scene.add(s),s}onWindowResize(){this.camera&&this.renderer&&(this.camera.aspect=window.innerWidth/window.innerHeight,this.camera.updateProjectionMatrix(),this.renderer.setSize(window.innerWidth,window.innerHeight),this.postProcessing&&this.postProcessing.resize(window.innerWidth,window.innerHeight))}attachPointerMoveHandler(){this.reducedMotion||(this.boundPointerMoveHandler=e=>{let t=e.clientX/window.innerWidth*2-1,r=-(2*(e.clientY/window.innerHeight))+1;this.pointerDelta.set(t-this.pointerPrev.x,r-this.pointerPrev.y),this.pointerPrev.set(t,r),this.pointerTarget.set(t,r)},this.canvas.addEventListener("pointermove",this.boundPointerMoveHandler,{passive:!0}))}removeListeners(){this.boundResizeHandler&&(window.removeEventListener("resize",this.boundResizeHandler),this.boundResizeHandler=null),this.boundContextLostHandler&&(this.canvas.removeEventListener("webglcontextlost",this.boundContextLostHandler),this.boundContextLostHandler=null),this.boundContextRestoredHandler&&(this.canvas.removeEventListener("webglcontextrestored",this.boundContextRestoredHandler),this.boundContextRestoredHandler=null),this.boundVisibilityChangeHandler&&(document.removeEventListener("visibilitychange",this.boundVisibilityChangeHandler),this.boundVisibilityChangeHandler=null),this.boundPointerMoveHandler&&(this.canvas.removeEventListener("pointermove",this.boundPointerMoveHandler),this.boundPointerMoveHandler=null)}dispose(){if(!_.isDisposing){for(_.isDisposing=!0,this.removeListeners(),this.postProcessing&&(this.postProcessing.dispose?.(),this.postProcessing=void 0),this.scene.traverse(e=>{if(e instanceof o.Mesh)for(let t of(e.geometry?.dispose(),Array.isArray(e.material)?e.material:[e.material]))t.map?.dispose(),t.normalMap?.dispose(),t.roughnessMap?.dispose(),t.metalnessMap?.dispose(),t.aoMap?.dispose(),t.emissiveMap?.dispose(),t.dispose()});this.scene.children.length>0;)this.scene.remove(this.scene.children[0]);this.renderer?.dispose(),this.renderer?.forceContextLoss(),_.instance=null,_.isDisposing=!1}}get contextLost(){return this.isContextLost}get tabHidden(){return"u">typeof document&&document.hidden}render(e){if(!this.isInitialized||this.isContextLost)return;this.timer.update(performance.now());let r=this.timer.getDelta();this.pointerCurrent.lerp(this.pointerTarget,1-Math.exp(-(6*r))),this.interactiveSpotLight&&this.spotLightTargetObject&&(this.interactiveSpotLight.position.x=8*this.pointerCurrent.x,this.interactiveSpotLight.position.y=10+2*this.pointerCurrent.y,this.spotLightTargetObject.position.x=5*this.pointerCurrent.x,this.spotLightTargetObject.position.y=3*this.pointerCurrent.y,this.spotLightTargetObject.updateMatrixWorld());let i=this.monitor.checkHealth(r);!function(e,r){if(!t)return;let i=Math.max(0,Math.min(1,r)),s=t.getPointAt(i);e.position.lerp(s,.1);let a=Math.min(1,i+.05),n=t.getPointAt(a),l=new o.Object3D;l.position.copy(e.position),l.lookAt(n),e.quaternion.slerp(l.quaternion,.05)}(this.camera,e),!this.reducedMotion&&(Math.abs(this.pointerDelta.x)>.001||Math.abs(this.pointerDelta.y)>.001)&&(this.scene.traverse(e=>{if(e instanceof o.Points){let t=e.geometry.getAttribute("position");if(t){for(let e=0;e<t.count;e++)t.setX(e,t.getX(e)+.04*this.pointerDelta.x),t.setY(e,t.getY(e)+.04*this.pointerDelta.y);t.needsUpdate=!0}}}),this.pointerDelta.multiplyScalar(.95)),this.postProcessing&&i?this.postProcessing.render(r):this.renderer.render(this.scene,this.camera)}}function U(){return(0,r.jsx)("div",{className:"fixed inset-0 w-full h-full pointer-events-none -z-10",style:{background:"radial-gradient(ellipse at 50% 20%, #1a1a2e 0%, #0a0a0c 60%, #000000 100%)"},"aria-hidden":"true"})}class R extends i.Component{constructor(e){super(e),this.state={hasError:!1}}static getDerivedStateFromError(e){return{hasError:!0}}componentDidCatch(e,t){console.error("[ThreeCanvas] Render error caught by boundary:",e,t)}render(){return this.state.hasError?this.props.fallback:this.props.children}}function L(){let e=(0,i.useRef)(null),t=(0,s.usePathname)(),[o,a]=(0,i.useState)(!1),[n]=(0,i.useState)(()=>(function(){if("u"<typeof document)return"none";let e=document.createElement("canvas");try{if(e.getContext("webgl2"))return"webgl2";if(e.getContext("webgl")||e.getContext("experimental-webgl"))return"webgl1"}catch{}return"none"})()),l=(0,i.useCallback)(()=>{},[]),h=(0,i.useCallback)(()=>{a(!0)},[]),[c]=(0,i.useState)(()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches);return((0,i.useEffect)(()=>{if(t.startsWith("/admin")||"none"===n||c||!e.current)return;let r=null,i=null,s=!1,o=null,d=e=>{if(!r)return;let t=e.clientX/window.innerWidth*2-1,i=-(2*(e.clientY/window.innerHeight))+1;r.setPointerNormalized(t,i)},u=()=>{!s&&e.current&&_.getInstance(e.current,{onContextLost:l,onContextRestored:()=>{!s&&r&&f()},onFallback:h}).then(e=>{s||(r=e,window.addEventListener("pointermove",d,{passive:!0}),f())}).catch(e=>{console.error("[ThreeCanvas] Engine initialization failed:",e),a(!0)})};o="function"==typeof requestIdleCallback?requestIdleCallback(u,{timeout:3e3}):setTimeout(u,0);let f=()=>{if(!r||s)return;if(document.hidden){i=requestAnimationFrame(f);return}let e=document.documentElement.scrollHeight-window.innerHeight,t=Math.max(0,Math.min(1,e>0?window.scrollY/e:0));r.render(t),i=requestAnimationFrame(f)};return()=>{s=!0,null!==o&&("function"==typeof cancelIdleCallback&&"number"==typeof o?cancelIdleCallback(o):clearTimeout(o)),null!==i&&cancelAnimationFrame(i),window.removeEventListener("pointermove",d),r?.dispose()}},[t,n,l,h,c]),t.startsWith("/admin"))?null:"none"===n||o||c?(0,r.jsx)(U,{}):(0,r.jsx)("canvas",{ref:e,id:"gl-canvas",className:"fixed inset-0 w-full h-full pointer-events-none -z-10 bg-[#0A0A0A]","aria-hidden":"true"})}e.s(["default",0,function(){return(0,r.jsx)(R,{fallback:(0,r.jsx)(U,{}),children:(0,r.jsx)(L,{})})}],88262)},6069,e=>{e.n(e.i(88262))}]);