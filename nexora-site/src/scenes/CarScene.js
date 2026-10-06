import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CarSceneProcedural, CAR_X, SPEED } from './CarSceneProcedural.js';
import { CameraPath } from '../managers/CameraController.js';
import { ASSETS, CREDITS } from '../config.js';
import { canvasTexture, glowSprite } from './helpers.js';
import { rng, smoothstep } from '../core/math.js';

/*
 * Cena 5 + 6 (0.71–1.00) — versão fotorrealista.
 *   Fundo: HDRI "Lago d'Isola" (Poly Haven, CC0) — lago congelado, Alpes nevados, pinheiros.
 *   Carro: Khronos "Car Concept" (CC BY 4.0) com pintura PBR, clearcoat e vidro com transmissão.
 *   Chão: asfalto, cascalho e neve com texturas PBR (Poly Haven) que rolam com a velocidade,
 *         e se dissolvem no próprio fundo fotográfico na distância (sem emenda no horizonte).
 * Se algum desses assets faltar, cai na versão procedural (CarSceneProcedural).
 *
 *   local 0.00–0.08  câmera colada na tela central (cards) → recua no interior
 *   local 0.08–0.20  atravessa o para-brisa e sobe à frente do carro
 *   local 0.20–0.45  contorna pelo alto e vai para trás do carro
 *   local 0.45–1.00  câmera de perseguição; créditos sobre a cena escurecida
 */

const ROAD_W = 7.4;
const ROAD_LEN = 700;
const GROUND = 900;
const SCREEN = { w: 0.34, h: 0.2125 }; // 16:10
// posição do sol no HDRI (fração da imagem equiretangular: u da esquerda, v do topo)
const HDRI_SUN = { u: 0.598, v: 0.219 };

const bgVert = /* glsl */ `
  varying vec3 vDir;
  void main(){
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // sempre no fundo
  }`;
const bgFrag = /* glsl */ `
  uniform sampler2D uBg; uniform mat3 uRot; uniform float uIntensity;
  varying vec3 vDir;
  vec2 eqUv(vec3 d){ return vec2(atan(d.z, d.x) * 0.1591549 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.3183099 + 0.5); }
  void main(){
    vec3 d = normalize(uRot * vDir);
    gl_FragColor = vec4(textureLod(uBg, eqUv(d), 0.0).rgb * uIntensity, 1.0);
  }`;

export class CarScene extends CarSceneProcedural {
  static deferred = true; // depende de assets carregados em segundo plano

  async build() {
    const A = this.ctx.assets;
    this.carGltf = A.model('car');
    this.bgTex = A.texture('roadBackplate');
    this.hdr = A.hdri('road');
    this.real = !!(this.carGltf && this.bgTex && this.hdr);
    if (!this.real) return super.build();

    const s = this.scene;
    const ctx = this.ctx;
    const rand = rng(91);
    this.bloom = 0.16;
    this.camera.near = 0.03;
    this.camera.far = 2000;
    this.camera.updateProjectionMatrix();

    /* ---- fundo fotográfico + iluminação HDRI ---- */
    const rotY = ASSETS.roadHdriRotation;
    this.bgRot = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(rotY));
    const bg = this.bgTex;
    bg.generateMipmaps = false;
    bg.minFilter = THREE.LinearFilter;
    bg.needsUpdate = true;
    this.bgIntensity = 1.12;
    this.bgMat = new THREE.ShaderMaterial({
      uniforms: { uBg: { value: bg }, uRot: { value: this.bgRot }, uIntensity: { value: this.bgIntensity } },
      vertexShader: bgVert,
      fragmentShader: bgFrag,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.bgSphere = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 32), this.bgMat);
    this.bgSphere.renderOrder = -10;
    this.bgSphere.frustumCulled = false;
    s.add(this.bgSphere);

    this.envTex = ctx.pmrem.fromEquirectangular(this.hdr).texture;
    s.environment = this.envTex;
    s.environmentIntensity = 1.0;
    // a rotação do ambiente acompanha a do fundo (mesmo eixo, sinal do mapeamento do three)
    s.environmentRotation.set(0, -rotY, 0);

    // sol: direção calculada a partir do pixel do sol no HDRI
    const az = (HDRI_SUN.u - 0.5) * Math.PI * 2;
    const el = (0.5 - HDRI_SUN.v) * Math.PI;
    const dirTex = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    this.sunDir = dirTex.applyMatrix3(this.bgRot.clone().transpose()).normalize();
    const sun = new THREE.DirectionalLight(0xfff4e6, 2.6);
    sun.position.copy(this.sunDir).multiplyScalar(30).add(new THREE.Vector3(CAR_X, 0, 0));
    sun.target.position.set(CAR_X, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -5;
    sun.shadow.camera.right = 5;
    sun.shadow.camera.top = 5;
    sun.shadow.camera.bottom = -5;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    s.add(sun, sun.target);

    /* ---- chão: neve, acostamento de pedra e asfalto (texturas PBR rolando) ---- */
    this.scrollers = [];
    const pbr = (prefix, repeat) => {
      const maps = { map: A.texture(prefix + 'Diff'), normalMap: A.texture(prefix + 'Nor'), arm: A.texture(prefix + 'Arm') };
      const tex = [maps.map, maps.normalMap, maps.arm].filter(Boolean).map((t) => {
        const c = t.clone();
        c.repeat.set(repeat[0], repeat[1]);
        c.needsUpdate = true;
        return c;
      });
      const [map, normalMap, arm] = tex;
      const mat = new THREE.MeshStandardMaterial({
        map,
        normalMap,
        roughnessMap: arm,
        aoMap: arm,
        metalnessMap: arm,
        metalness: 1,
        roughness: 1,
        normalScale: new THREE.Vector2(1, 1),
      });
      return { mat, tex };
    };

    const snow = pbr('snow', [GROUND / 5, GROUND / 5]);
    snow.mat.color.setScalar(0.92);
    this.patchGround(snow.mat, { fade: [60, 420] });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND, GROUND), snow.mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, -GROUND / 2 + 60);
    ground.receiveShadow = true;
    s.add(ground);
    this.scrollers.push({ tex: snow.tex, tile: 5 });

    const rocks = pbr('rocks', [2, ROAD_LEN / 3]);
    for (const side of [-1, 1]) {
      const m = rocks.mat.clone();
      this.patchGround(m, { fade: [50, 380], shoulder: true });
      m.transparent = true;
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(6, ROAD_LEN), m);
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(side * (ROAD_W / 2 + 2.6), -0.005, -ROAD_LEN / 2 + 60);
      sh.receiveShadow = true;
      sh.renderOrder = 1;
      s.add(sh);
    }
    this.scrollers.push({ tex: rocks.tex, tile: 3 });

    const asphalt = pbr('asphalt', [ROAD_W / 3.5, ROAD_LEN / 3.5]);
    asphalt.mat.color.setScalar(0.85);
    this.patchGround(asphalt.mat, { fade: [80, 450], markings: true });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_LEN), asphalt.mat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.0, -ROAD_LEN / 2 + 60);
    road.receiveShadow = true;
    road.renderOrder = 2;
    s.add(road);
    this.roadMat = asphalt.mat;
    this.scrollers.push({ tex: asphalt.tex, tile: 3.5 });

    /* ---- balizas de estrada (brancas com faixa preta e refletor) ---- */
    this.posts = this.buildRealPosts();
    s.add(this.posts.mesh);
    void rand;

    /* ---- carro ---- */
    await this.setupCar();

    this.dist = 0;
  }

  /* Ajusta materiais do chão: marcações da pista, bordas suaves e dissolução no fundo */
  patchGround(mat, { fade, markings = false, shoulder = false }) {
    const u = {
      uBg: { value: this.bgTex },
      uBgRot: { value: this.bgRot },
      uBgIntensity: { value: this.bgIntensity },
      uFade: { value: new THREE.Vector2(fade[0], fade[1]) },
      uOffset: { value: 0 },
    };
    mat.userData.ground = u;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGWorld; varying vec2 vGUv;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGUv = uv;');
      let frag = sh.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uBg; uniform mat3 uBgRot; uniform float uBgIntensity; uniform vec2 uFade; uniform float uOffset;
        varying vec3 vGWorld; varying vec2 vGUv;
        vec2 eqUv(vec3 d){ return vec2(atan(d.z, d.x) * 0.1591549 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.3183099 + 0.5); }`
      );
      if (markings) {
        frag = frag
          .replace(
            '#include <map_fragment>',
            `#include <map_fragment>
            float gx = (vGUv.x - 0.5) * ${ROAD_W.toFixed(2)};
            float gz = vGWorld.z + uOffset;
            float gEdge = 1.0 - smoothstep(0.055, 0.075, abs(abs(gx) - 3.42));
            float gDash = (1.0 - smoothstep(0.055, 0.075, abs(gx))) * step(0.6, fract(gz / 12.0));
            float gPaint = clamp(gEdge + gDash, 0.0, 1.0);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.72, 0.7), gPaint * 0.9);`
          )
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.55, gPaint);');
      }
      if (shoulder) {
        frag = frag.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          float gEdgeA = smoothstep(0.0, 0.3, vGUv.x) * smoothstep(1.0, 0.7, vGUv.x);
          diffuseColor.a *= gEdgeA;`
        );
      }
      frag = frag.replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        {
          vec3 gDir = normalize(uBgRot * normalize(vGWorld - cameraPosition));
          vec3 gBg = textureLod(uBg, eqUv(gDir), 0.0).rgb * uBgIntensity;
          float gF = smoothstep(uFade.x, uFade.y, length(vGWorld.xz - cameraPosition.xz));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gBg, gF);
        }`
      );
      sh.fragmentShader = frag;
    };
    mat.customProgramCacheKey = () => `ground-${markings}-${shoulder}`;
  }

  buildRealPosts() {
    const tex = canvasTexture(64, 256, (g, w, h) => {
      g.fillStyle = '#f2f2ee';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#111';
      g.fillRect(0, 0, w, h * 0.22);
      g.fillStyle = '#ffb21a';
      g.fillRect(w * 0.25, h * 0.06, w * 0.5, h * 0.1);
    });
    const geo = new THREE.BoxGeometry(0.11, 1.05, 0.14);
    geo.translate(0, 0.525, 0);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0 });
    const N = 56;
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const items = Array.from({ length: N }, (_, i) => ({
      x: i % 2 ? ROAD_W / 2 + 0.7 : -(ROAD_W / 2 + 0.7),
      z: -380 + Math.floor(i / 2) * 15,
      s: 1,
      r: i % 2 ? 0 : Math.PI,
    }));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return { mesh, items, len: 420, min: -380 };
  }

  async setupCar() {
    const gltf = this.carGltf;
    const model = gltf.scene;

    // variante de pintura (KHR_materials_variants)
    const variants = gltf.parser.json.extensions?.KHR_materials_variants?.variants || [];
    const vi = variants.findIndex((v) => v.name === ASSETS.carVariant);
    if (vi >= 0) {
      const jobs = [];
      model.traverse((o) => {
        const ext = o.userData?.gltfExtensions?.KHR_materials_variants;
        if (!o.isMesh || !ext) return;
        const m = ext.mappings.find((mp) => mp.variants.includes(vi));
        if (m) jobs.push(gltf.parser.getDependency('material', m.material).then((mat) => (o.material = mat)));
      });
      await Promise.all(jobs);
    }

    // placa própria (substitui o logotipo de exemplo)
    const plate = canvasTexture(512, 128, (g, w, h) => {
      g.fillStyle = '#f4f4f0';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#1d3f8f';
      g.fillRect(0, 0, w, 26);
      g.strokeStyle = '#111';
      g.lineWidth = 6;
      g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = '#111';
      g.font = '700 70px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('NXR·2026', w / 2, h / 2 + 14);
    });
    plate.flipY = false;

    const meshes = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      meshes.push(o);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m.name === 'License') m.map = plate;
        else if (['Hardware', 'Mirror', 'Brake', 'Rim1', 'Rim2', 'Tireside'].includes(m.name) && m.map) {
          m.map = null; // a textura era o logotipo de exemplo
          if (m.name === 'Tireside') m.color.setRGB(0.025, 0.025, 0.027); // borracha
          m.needsUpdate = true;
        }
        if (m.name === 'Brakelight') {
          m.emissive?.setRGB(1, 0.05, 0.03);
          m.emissiveIntensity = Math.max(m.emissiveIntensity, 6);
        }
        if (m.name === 'Headlight') m.emissiveIntensity = Math.max(m.emissiveIntensity, 3);
        m.envMapIntensity = 1.1;
      });
    });

    // orientação: o modelo vem com Z para cima e frente em -Y → Y para cima e frente em -Z
    const orient = new THREE.Group();
    orient.add(model);
    const box0 = new THREE.Box3().setFromObject(model);
    const size0 = box0.getSize(new THREE.Vector3());
    if (size0.z < size0.y * 0.6) orient.rotation.x = -Math.PI / 2;
    const yaw = new THREE.Group();
    yaw.add(orient);
    yaw.rotation.y = Math.PI;
    yaw.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(yaw);
    const center = box.getCenter(new THREE.Vector3());
    yaw.position.set(-center.x, -box.min.y, -center.z);
    this.carSize = box.getSize(new THREE.Vector3());

    const group = new THREE.Group();
    group.add(yaw);
    group.position.x = CAR_X;
    this.scene.add(group);
    group.updateMatrixWorld(true);
    this.car = { group, model };

    // rodas: gira aro e pneu (as pinças de freio ficam paradas)
    this.wheelParts = [];
    for (const n of ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR']) {
      const w = model.getObjectByName(n);
      // o modelo original vem com as dianteiras esterçadas ~30°: alinha todas com o eixo do carro
      w?.quaternion.identity();
      w?.children.forEach((c) => {
        if (!/BrakePad/i.test(c.name)) this.wheelParts.push(c);
      });
    }

    // pontos de referência (no espaço do grupo do carro)
    const localBox = (name) => {
      const o = model.getObjectByName(name);
      if (!o) return null;
      const b = new THREE.Box3().setFromObject(o);
      const inv = group.matrixWorld.clone().invert();
      return b.applyMatrix4(inv);
    };
    const dash = localBox('InteriorDashMid') || new THREE.Box3(new THREE.Vector3(-0.7, 0.2, -1.6), new THREE.Vector3(0.7, 0.85, -1.1));
    const tail = localBox('BodyTaillights');
    const roof = box.max.y - box.min.y;
    this.refs = { dash, tail, roof };

    // tela central (recebe a cena dos cards)
    this.screenRT = new THREE.WebGLRenderTarget(1024, 640, { type: THREE.HalfFloatType, samples: 2 });
    const screenMat = new THREE.MeshBasicMaterial({ map: this.screenRT.texture });
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat);
    const bezel = new THREE.Mesh(
      new RoundedBoxGeometry(SCREEN.w + 0.02, SCREEN.h + 0.02, 0.015, 2, 0.006),
      new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.25, metalness: 0.6 })
    );
    bezel.position.z = -0.009;
    this.screen.add(bezel);
    const dc = dash.getCenter(new THREE.Vector3());
    this.screen.position.set(dc.x, dash.max.y + SCREEN.h / 2 + 0.02, dash.max.z - 0.06);
    this.screen.rotation.x = -0.18;
    group.add(this.screen);
    this.screenOn = true;

    // brilho das lanternas
    this.flares = [];
    if (tail) {
      const tc = tail.getCenter(new THREE.Vector3());
      for (const x of [tail.min.x + 0.08, tail.max.x - 0.08]) {
        const f = glowSprite(new THREE.Color(1.6, 0.08, 0.05), 0.55, 0.4);
        f.position.set(x, tc.y, tail.max.z + 0.04);
        group.add(f);
        this.flares.push(f);
      }
    }

    // sombra de contato suave
    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(this.carSize.x * 1.25, this.carSize.z * 1.12),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `varying vec2 vUv; void main(){ vec2 p=(vUv-0.5)*2.0; float a=smoothstep(1.0,0.2,length(p*vec2(1.0,0.9))); gl_FragColor=vec4(0.0,0.0,0.0,a*0.55);} `,
      })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.012;
    contact.renderOrder = 3;
    group.add(contact);

    this.windshield = model.getObjectByName('BodyWindshield');
    this.buildRealPath();
  }

  buildRealPath() {
    const cx = CAR_X;
    const sp = this.screen.getWorldPosition(new THREE.Vector3());
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(this.screen.getWorldQuaternion(new THREE.Quaternion()));
    const d = (SCREEN.h / 2 / Math.tan(THREE.MathUtils.degToRad(21))) * 0.94;
    const start = sp.clone().addScaledVector(n, d);
    const { dash, roof } = this.refs;
    const eyeY = dash.max.y + 0.2;
    const eyeZ = dash.max.z + 0.62;
    this.path = new CameraPath([
      { t: 0.0, pos: start.toArray(), target: sp.toArray(), fov: 42 },
      { t: 0.07, pos: [cx, eyeY, eyeZ], target: [cx, eyeY - 0.2, -6], fov: 60 },
      { t: 0.13, pos: [cx, roof * 0.9, dash.min.z - 0.9], target: [cx, 0.9, -12], fov: 55 },
      { t: 0.2, pos: [cx + 0.9, 2.1, -5.2], target: [cx, 0.7, 0], fov: 42 },
      { t: 0.31, pos: [cx + 7.6, 3.1, 2.6], target: [cx, 0.8, -1.5], fov: 36 },
      { t: 0.45, pos: [cx + 1.6, 1.55, 8.6], target: [cx - 0.1, 1.15, -6], fov: 38 },
      { t: 0.7, pos: [cx - 1.2, 1.7, 9.0], target: [cx - 0.3, 1.5, -12], fov: 40 },
      { t: 1.0, pos: [cx - 2.4, 2.2, 12], target: [cx - 0.8, 2.0, -20], fov: 38 },
    ]);
  }

  update(l, dt, time, global) {
    if (!this.real) return super.update(l, dt, time, global);
    const cam = this.camera;
    this.path.apply(cam, l);
    // em retrato, recentraliza o carro (o enquadramento foi pensado para 16:10)
    if (cam.aspect < 1) cam.translateX(-Math.min(1.6, (1 - cam.aspect) * 2.4) * smoothstep(0.2, 0.45, l));
    this.ctx.cameraFX.applyLook(cam, global);
    this.bgSphere.position.copy(cam.position);

    // movimento: o carro fica parado e o mundo rola
    const dz = SPEED * dt;
    this.dist += dz;
    for (const sc of this.scrollers) sc.tex.forEach((t) => (t.offset.y = (this.dist / sc.tile) % 1));
    this.roadMat.userData.ground.uOffset.value = -this.dist;
    this.scroll(this.posts, dz);
    this.wheelParts.forEach((w) => (w.rotation.x -= dz / 0.38));
    this.car.group.position.y = Math.sin(time * 11) * 0.0025 + Math.sin(time * 3.1) * 0.002;

    this.flares.forEach((f) => (f.material.opacity = (0.32 + Math.sin(time * 2) * 0.03) * smoothstep(0.15, 0.3, l)));

    // tela só enquanto o interior aparece
    this.screenOn = l < 0.16;
    this.screen.visible = this.screenOn;
    // dentro do carro o para-brisa (com transmissão) sai da frente da câmera
    if (this.windshield) this.windshield.visible = l > 0.115;

    // créditos: escurece 50% e aplica blur
    const [c0] = CREDITS.range;
    const k = smoothstep(c0, CREDITS.bandsClosedAt, global);
    this.ctx.postfx.state.darken = k * CREDITS.darken;
    this.ctx.postfx.state.blur = k * CREDITS.blur;
    this.bloomBoost = 1 - k * 0.4;
    this.time = time;
    this.dt = dt;
  }
}
