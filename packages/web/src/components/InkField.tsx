import { useEffect, useRef } from 'react';

/**
 * Hero background: fine-grain "ink" in the same family as the reference (smoky ribbons made of thousands of
 * tiny specks), original and generative. A domain-warped noise field is turned into ribbon-shaped density, then
 * stippled one pixel at a time (dark grey plus Bitcoin Cash green). It is drawn once per size, so it costs nothing
 * per frame; a very slow CSS drift gives it life.
 */

// --- small seeded value noise -------------------------------------------------------------------
function makeNoise(seed: number) {
  const perm = new Uint8Array(512);
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = (x: number, y: number) => perm[(perm[x & 255] + y) & 255] / 255;
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = fade(x - xi);
    const v = fade(y - yi);
    const a = val(xi, yi);
    const b = val(xi + 1, yi);
    const c = val(xi, yi + 1);
    const d = val(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

const fbm = (n: (x: number, y: number) => number, x: number, y: number) =>
  n(x, y) * 0.55 + n(x * 2.1, y * 2.1) * 0.28 + n(x * 4.3, y * 4.3) * 0.17;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Paint the speckled ribbons into a canvas of w x h device pixels. */
function paint(canvas: HTMLCanvasElement, w: number, h: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = w;
  canvas.height = h;
  const img = ctx.createImageData(w, h);
  const px = img.data;
  const nA = makeNoise(7);
  const nB = makeNoise(31);
  const nW = makeNoise(101);

  // Evaluate the (expensive) field on a coarse grid, then interpolate per pixel.
  const STEP = 6;
  const gw = Math.ceil(w / STEP) + 2;
  const gh = Math.ceil(h / STEP) + 2;
  const dark = new Float32Array(gw * gh);
  const green = new Float32Array(gw * gh);
  const scale = 1.6 / Math.max(w, h * 1.4);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const x = gx * STEP * scale * 3.2;
      const y = gy * STEP * scale * 3.2;
      // domain warp: pushes straight contours into flowing, folded ribbons
      const wx = fbm(nW, x + 3.1, y + 1.7) * 2 - 1;
      const wy = fbm(nW, x + 8.4, y + 5.2) * 2 - 1;
      const qx = x + wx * 1.5;
      const qy = y + wy * 1.5;
      const a = fbm(nA, qx, qy);
      const b = fbm(nB, qx + 5.5, qy + 2.2);
      // contour band of the noise = a thin ribbon; two bands make the folded look
      const ribA = Math.exp(-Math.pow((a - 0.5) / 0.042, 2)) + 0.4 * Math.exp(-Math.pow((a - 0.68) / 0.055, 2));
      const ribB = Math.exp(-Math.pow((b - 0.46) / 0.03, 2));
      // composition: ink concentrates up and to the right, and fades out toward the bottom edge
      const fx = (gx * STEP) / w;
      const fy = (gy * STEP) / h;
      const weight = (0.1 + 0.9 * smooth(0.25, 0.95, fx)) * (1 - smooth(0.4, 0.95, fy));
      dark[gy * gw + gx] = ribA * weight;
      green[gy * gw + gx] = ribB * weight * 0.8;
    }
  }

  const sample = (arr: Float32Array, x: number, y: number) => {
    const gx = x / STEP;
    const gy = y / STEP;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const i = y0 * gw + x0;
    return (
      arr[i] * (1 - fx) * (1 - fy) +
      arr[i + 1] * fx * (1 - fy) +
      arr[i + gw] * (1 - fx) * fy +
      arr[i + gw + 1] * fx * fy
    );
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = sample(dark, x, y);
      const g = sample(green, x, y);
      const r = Math.random();
      const o = (y * w + x) * 4;
      // each pixel becomes a speck with probability = density: gives a fine grainy edge instead of blobs
      if (r < g * 0.55) {
        px[o] = 10;
        px[o + 1] = 193;
        px[o + 2] = 142;
        px[o + 3] = 120 + Math.random() * 110;
      } else if (r < d * 0.62 + g * 0.55) {
        const v = 20 + Math.random() * 55;
        px[o] = v;
        px[o + 1] = v + 4;
        px[o + 2] = v + 2;
        px[o + 3] = 90 + Math.random() * 150;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

/** Same ribbon + speck look as paint(), but evaluated live on the GPU so the ink really flows. */
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uT;
uniform vec2 uM;   // smoothed pointer, 0..1 (y down)
uniform vec2 uV;   // pointer velocity
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){ return vn(p) * 0.55 + vn(p * 2.1 + 7.0) * 0.28 + vn(p * 4.3 + 3.0) * 0.17; }
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = px / uRes;
  float sc = 1.6 / max(uRes.x, uRes.y * 1.4) * 3.2;
  vec2 p = px * sc;
  // pointer: the whole ink slides against the cursor, and the ink near it is pushed along its motion
  p -= (uM - 0.5) * 1.4;
  vec2 d = (uv - uM) * vec2(uRes.x / uRes.y, 1.0);
  p += uV * exp(-dot(d, d) * 7.0) * 3.5;
  float t = uT * 0.045;
  vec2 w = vec2(fbm(p + vec2(3.1 + t * 1.3, 1.7 - t)), fbm(p + vec2(8.4 - t, 5.2 + t * 1.1))) * 2.0 - 1.0;
  vec2 q = p + w * 1.5;
  float a = fbm(q + vec2(t * 0.6, 0.0));
  float b = fbm(q + vec2(5.5, 2.2 - t * 0.5));
  float ka = (a - 0.5) / 0.06;
  float kb = (a - 0.68) / 0.08;
  float ribA = exp(-ka * ka) + 0.4 * exp(-kb * kb);
  float kc = (b - 0.46) / 0.04;
  float ribB = exp(-kc * kc);
  float weight = (0.1 + 0.9 * smoothstep(0.25, 0.95, uv.x)) * (1.0 - smoothstep(0.4, 0.95, uv.y));
  float dk = ribA * weight;
  float gr = ribB * weight * 0.8;
  vec2 cell = floor(gl_FragCoord.xy);
  float r = hash(cell);
  float al = hash(cell + 17.0);
  vec4 c = vec4(0.0);
  if (r < gr * 0.7) { c = vec4(vec3(10.0, 193.0, 142.0) / 255.0, (120.0 + al * 110.0) / 255.0); }
  else if (r < dk * 0.85 + gr * 0.7) { float v = (20.0 + al * 55.0) / 255.0; c = vec4(v, v + 0.016, v + 0.008, (90.0 + al * 150.0) / 255.0); }
  gl_FragColor = vec4(c.rgb * c.a, c.a);
}`;

function startGL(canvas: HTMLCanvasElement): (() => void) | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const o = gl.createShader(type);
    if (!o) return null;
    gl.shaderSource(o, src);
    gl.compileShader(o);
    return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null;
  };
  const vs = sh(gl.VERTEX_SHADER, VERT);
  const fs = sh(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uT = gl.getUniformLocation(prog, 'uT');
  const uM = gl.getUniformLocation(prog, 'uM');
  const uV = gl.getUniformLocation(prog, 'uV');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hover = window.matchMedia('(hover: hover)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  let mx = 0.5;
  let my = 0.5;
  let tmx = mx;
  let tmy = my;
  let vx = 0;
  let vy = 0;
  let visible = true;
  let raf = 0;
  const t0 = performance.now();

  const size = () => {
    canvas.width = Math.max(2, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(2, Math.round(canvas.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  const draw = (now: number) => {
    raf = requestAnimationFrame(draw);
    if (!visible) return;
    const px = mx;
    const py = my;
    mx += (tmx - mx) * 0.06;
    my += (tmy - my) * 0.06;
    vx += ((mx - px) * 22 - vx) * 0.2;
    vy += ((my - py) * 22 - vy) * 0.2;
    // Visible parallax: the whole ink glides against the cursor (the canvas is oversized so edges never show).
    canvas.style.transform = `translate3d(${(-(mx - 0.5) * 2 * 40).toFixed(1)}px, ${(-(my - 0.5) * 2 * 28).toFixed(1)}px, 0)`;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uT, reduced ? 12 : (now - t0) / 1000 + 12);
    gl.uniform2f(uM, mx, my);
    gl.uniform2f(uV, vx, vy);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (reduced) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  const onMove = (e: PointerEvent) => {
    tmx = e.clientX / window.innerWidth;
    tmy = e.clientY / window.innerHeight;
  };
  size();
  const ro = new ResizeObserver(() => {
    size();
    if (!raf) draw(performance.now());
  });
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
  });
  io.observe(canvas);
  if (hover && !reduced) window.addEventListener('pointermove', onMove, { passive: true });
  raf = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener('pointermove', onMove);
    // The context is intentionally not released: React StrictMode re-runs this effect on the same canvas.
  };
}

export function InkField({ settled }: { settled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // Live GPU ink; if WebGL is unavailable, fall back to the one-off CPU stipple.
    const stop = startGL(canvas);
    if (stop) return stop;
    let timer = 0;
    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      paint(
        canvas,
        Math.max(320, Math.round(canvas.clientWidth * dpr)),
        Math.max(320, Math.round(canvas.clientHeight * dpr)),
      );
    };
    render();
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(render, 250);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className={`ink ${settled ? 'settled' : ''}`} aria-hidden="true">
      <canvas ref={ref} />
      <div className="grain" />
    </div>
  );
}
