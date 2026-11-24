/* Original scroll-driven artwork. The same pose values drive the native-image fallbacks. */
window.HyphaSculptures = (() => {
  'use strict';

  function surface(canvas, vertexSource, fragmentSource, onLost) {
    const gl = canvas.getContext('webgl', {
      alpha: true, depth: false, stencil: false, antialias: false,
      premultipliedAlpha: false, powerPreference: 'low-power'
    });
    if (!gl) return null;
    const program = gl.createProgram();
    for (const [kind, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
      const shader = gl.createShader(kind);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    canvas.addEventListener('webglcontextlost', onLost, {once: true});
    const coords = gl.getAttribLocation(program, 'aPoint');
    function vertices(points) {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(coords);
      gl.vertexAttribPointer(coords, 2, gl.FLOAT, false, 0, 0);
    }
    function texture(image) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      return tex;
    }
    function resize(cssWidth, limit) {
      const size = Math.max(1, Math.min(limit, Math.ceil(cssWidth * (window.devicePixelRatio || 1))));
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = canvas.height = size;
        gl.viewport(0, 0, size, size);
      }
    }
    return {gl, vertices, texture, resize, uniform: name => gl.getUniformLocation(program, name)};
  }

  const ballVertex = [
    'attribute vec2 aPoint;', 'varying vec2 vPoint;',
    'void main() { vPoint = aPoint * 1.30; gl_Position = vec4(aPoint, 0., 1.); }'
  ].join('\n');

  const ballFragment = [
    'precision highp float;',
    'varying vec2 vPoint;',
    'uniform sampler2D uSurface;',
    'uniform float uPhase, uStretch, uSize, uPixel;',
    'mat2 turn(float a) { float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }',
    'float distanceToHole(vec3 n) {',
    '  vec2 uv=vec2(atan(n.z,n.x)*.159154943+.5,acos(clamp(n.y,-1.,1.))*.318309886);',
    '  return texture2D(uSurface,uv).r*.46;',
    '}',
    'vec3 objectNormal(vec3 n) {',
    '  n.xy=turn(-.27+.52*uPhase)*n.xy; n.xz=turn(-.34-5.2*uPhase)*n.xz;',
    '  return n;',
    '}',
    'float softbox(vec2 r,vec2 centre,vec2 size,float skew) {',
    '  r-=centre; r.y-=r.x*skew;',
    '  float edge=max(abs(r.x)/size.x,abs(r.y)/size.y);',
    '  return 1.-smoothstep(.76,1.10,edge);',
    '}',
    'void main() {',
    '  vec2 p=turn(.32-.55*uStretch)*vPoint/max(uSize,.025);',
    '  vec2 axes=vec2(.5+.24*uStretch,.5-.10*uStretch);',
    '  float x=p.x/axes.x;',
    '  p.y-=uStretch*.075*sin(x*2.7);',
    '  vec2 uv=vec2(x,p.y/axes.y); float rr=dot(uv,uv);',
    '  float aa=clamp(uPixel/max(uSize,.05),.001,.13);',
    '  if(rr>1.+aa) discard;',
    '  float z=sqrt(max(.0001,1.-rr));',
    '  vec3 n=normalize(vec3(uv.x/axes.x-uv.y*uStretch*.42*cos(2.7*x),uv.y/axes.y,z*2.));',
    '  vec3 obj=objectNormal(normalize(vec3(uv,z)));',
    '  float d=distanceToHole(obj);',
    '  float rim=smoothstep(.170,.215,d)*(1.-smoothstep(.218,.249,d));',
    '  float hole=1.-smoothstep(.177-aa*.48,.200+aa*.48,d);',
    '  float diffuse=max(0.,dot(n,normalize(vec3(-.46,.71,.72))));',
    '  vec3 refl=reflect(vec3(0.,0.,-1.),n);',
    '  vec3 lime=mix(vec3(.76,.95,.013),vec3(.98,.77,.013),uStretch*(.15+.14*uv.x));',
    '  vec3 paint=lime*(.24+.77*diffuse)+vec3(.012,.038,.006);',
    '  paint+=vec3(.30,.34,.13)*pow(1.-max(n.z,0.),2.3);',
    '  paint+=vec3(.62,.61,.52)*softbox(refl.xy,vec2(-.27,.61),vec2(.54,.095),-.22)*(.34+.66*max(refl.z,0.));',
    '  paint+=vec3(.62,.56,.74)*softbox(refl.xy,vec2(.67,.16),vec2(.085,.60),.14)*(.33+.67*max(refl.z,0.));',
    '  paint+=vec3(.13,.19,.19)*softbox(refl.xy,vec2(-.72,-.34),vec2(.16,.26),.04);',
    '  paint+=rim*vec3(.13,.18,.036)*(.4+.6*diffuse);',
    '  float lip=smoothstep(.115,.185,d);',
    '  float bounce=clamp(.46-.25*n.y+.18*n.x,.13,.87);',
    '  vec3 inner=vec3(.049,.079,.009)+vec3(.42,.52,.07)*lip*lip*bounce;',
    '  float rear=distanceToHole(objectNormal(normalize(vec3(uv,-z))));',
    '  inner*=mix(.45,1.,smoothstep(.13,.23,rear));',
    '  float alpha=1.-smoothstep(1.-aa,1.+aa,rr);',
    '  alpha*=1.-hole*(1.-smoothstep(.10,.17,rear))*.72;',
    '  gl_FragColor=vec4(mix(paint,inner,hole),alpha);',
    '}'
  ].join('\n');

  function ball(canvas, coating, onLost) {
    const s = surface(canvas, ballVertex, ballFragment, onLost);
    if (!s) return null;
    const {gl} = s;
    s.vertices(new Float32Array([-1,-1, 1,-1, -1,1, 1,1]));
    s.texture(coating);
    const phase = s.uniform('uPhase'), stretch = s.uniform('uStretch');
    const size = s.uniform('uSize'), pixel = s.uniform('uPixel');
    return {
      resize(width) { s.resize(width, 1280); },
      draw(progress, pull, diameter) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(phase, progress); gl.uniform1f(stretch, pull);
        gl.uniform1f(size, diameter); gl.uniform1f(pixel, 5.2/canvas.width);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  }

  const partnerVertex = [
    'precision highp float;',
    'attribute vec2 aPoint;',
    'uniform vec4 uCrop;',
    'uniform float uRose, uOpen, uCrouch, uRecoil;',
    'varying vec2 vUV;',
    'vec2 hinged(vec2 p, vec2 pivot, float a) {',
    '  float c=cos(a), s=sin(a); return pivot+mat2(c,s,-s,c)*(p-pivot);',
    '}',
    'void main() {',
    '  vUV=aPoint;',
    '  vec2 p=uCrop.xy+aPoint*uCrop.zw;',
    '  float side=mix(1.,-1.,uRose);',
    '  vec2 shoulder=mix(vec2(.591,.388),vec2(.386,.450),uRose);',
    '  vec2 elbow=mix(vec2(.532,.306),vec2(.419,.322),uRose);',
    '  vec2 foot=mix(vec2(.84,.892),vec2(.25,.90),uRose);',
    '  float blueEdge=mix(.532,.591,smoothstep(.246,.395,p.y));',
    '  float pinkEdge=mix(.372,.358,smoothstep(.275,.451,p.y));',
    '  float nearArm=mix(1.-smoothstep(blueEdge-.006,blueEdge+.014,p.x),smoothstep(pinkEdge-.006,pinkEdge+.015,p.x),uRose);',
    '  float arm=nearArm*(1.-smoothstep(shoulder.y-.15,shoulder.y+.010,p.y));',
    '  float forearm=nearArm*(1.-smoothstep(elbow.y-.065,elbow.y+.05,p.y));',
    '  p=hinged(p,elbow,side*(.115*uOpen-.022*uRecoil)*forearm);',
    '  p=hinged(p,shoulder,side*(.235*uOpen-.042*uRecoil)*arm);',
    '  p.y+=arm*(.054*uOpen+.014*uCrouch);',
    '  float bodyWeight=smoothstep(0.,.68,foot.y-p.y);',
    '  p.y+=bodyWeight*(.035*uOpen+.055*uCrouch-.014*uRecoil);',
    '  p=hinged(p,foot,side*(.027*uOpen+.014*uCrouch-.006*uRecoil));',
    '  p.x+=side*(.009*uOpen+.006*uCrouch);',
    '  p=.5+(p-.5)*.90;',
    '  gl_Position=vec4(2.*p.x-1.,1.-2.*p.y,0.,1.);',
    '}'
  ].join('\n');
  const partnerFragment = [
    'precision mediump float;', 'uniform sampler2D uFigure;', 'varying vec2 vUV;',
    'void main() { gl_FragColor=texture2D(uFigure,vUV); }'
  ].join('\n');

  function partners(canvas, images, onLost) {
    const s = surface(canvas, partnerVertex, partnerFragment, onLost);
    if (!s) return null;
    const {gl} = s, cols = 48, rows = 64, points = [], indices = [];
    for (let y = 0; y <= rows; y++) {
      for (let x = 0; x <= cols; x++) points.push(x/cols, y/rows);
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y*(cols+1)+x;
        indices.push(i, i+1, i+cols+1, i+1, i+cols+2, i+cols+1);
      }
    }
    s.vertices(new Float32Array(points));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    // Native coordinates of the two plates cut from the original 1254px sculpture.
    const textures = images.map(image => s.texture(image));
    const crops = [[0,80,686,1103], [550,19,704,1164]].map(rect => rect.map(n => n/1254));
    const rose=s.uniform('uRose'), crop=s.uniform('uCrop');
    const open=s.uniform('uOpen'), crouch=s.uniform('uCrouch'), recoil=s.uniform('uRecoil');
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return {
      resize(width) { s.resize(width, 1440); },
      draw(spread, anticipation, rebound) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(open, spread); gl.uniform1f(crouch, anticipation); gl.uniform1f(recoil, rebound);
        textures.forEach((tex, i) => {
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.uniform1f(rose, 1-i); gl.uniform4fv(crop, crops[i]);
          gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
        });
      }
    };
  }

  return {ball, partners};
})();
