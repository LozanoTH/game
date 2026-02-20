import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { createInputController } from "./input-controller.js";
import { ThirdPersonCameraController } from "./camera-controller.js";
import { CharacterMovementController } from "./character-movement-controller.js";
import { CharacterAnimationController } from "./character-animation-controller.js";
import { createCharacter } from "./character-factory.js";
import { InfiniteTerrainChunks } from "./terrain-chunk-manager.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060b);
scene.fog = new THREE.Fog(0x0b0f17, 180, 1200);

const textureLoader = new THREE.TextureLoader();
const skyUniforms = {
  uDayTopColor: { value: new THREE.Color(0x66a8ff) },
  uDayHorizonColor: { value: new THREE.Color(0xcde7ff) },
  uNightTopColor: { value: new THREE.Color(0x040815) },
  uNightHorizonColor: { value: new THREE.Color(0x1b2844) },
  uGroundDayColor: { value: new THREE.Color(0x7ea3b0) },
  uGroundNightColor: { value: new THREE.Color(0x152131) },
  uSunsetColor: { value: new THREE.Color(0xff8a54) },
  uSunDir: { value: new THREE.Vector3(0.2, 0.8, -0.4).normalize() },
  uMoonDir: { value: new THREE.Vector3(-0.2, 0.8, 0.4).normalize() },
  uDayFactor: { value: 1.0 },
  uTwilightFactor: { value: 0.0 },
  uNightFactor: { value: 0.0 },
  uTime: { value: 0 }
};

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(1500, 64, 40),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      uniform vec3 uDayTopColor;
      uniform vec3 uDayHorizonColor;
      uniform vec3 uNightTopColor;
      uniform vec3 uNightHorizonColor;
      uniform vec3 uGroundDayColor;
      uniform vec3 uGroundNightColor;
      uniform vec3 uSunsetColor;
      uniform vec3 uSunDir;
      uniform vec3 uMoonDir;
      uniform float uDayFactor;
      uniform float uTwilightFactor;
      uniform float uNightFactor;
      uniform float uTime;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

        vec3 daySky = mix(uDayHorizonColor, uDayTopColor, smoothstep(0.45, 0.95, h));
        vec3 nightSky = mix(uNightHorizonColor, uNightTopColor, smoothstep(0.25, 0.95, h));
        vec3 sky = mix(nightSky, daySky, uDayFactor);
        vec3 groundCol = mix(uGroundNightColor, uGroundDayColor, uDayFactor);
        sky = mix(groundCol, sky, smoothstep(0.02, 0.35, h));

        float sunsetBand = smoothstep(0.08, 0.55, 1.0 - abs(dir.y));
        sky += uSunsetColor * (uTwilightFactor * sunsetBand * 0.34);

        float sunAmount = max(dot(dir, normalize(uSunDir)), 0.0);
        float sunDisk = smoothstep(0.9992, 1.0, sunAmount);
        float sunGlow = pow(sunAmount, 26.0) * 0.34 + pow(sunAmount, 90.0) * 0.35;
        sky += vec3(1.0, 0.86, 0.58) * ((sunDisk * 1.2 + sunGlow) * (uDayFactor + uTwilightFactor * 0.8));

        float moonAmount = max(dot(dir, normalize(uMoonDir)), 0.0);
        float moonDisk = smoothstep(0.99935, 1.0, moonAmount);
        float moonGlow = pow(moonAmount, 40.0) * 0.26;
        sky += vec3(0.72, 0.84, 1.0) * (moonDisk * 1.35 + moonGlow) * uNightFactor;

        vec2 starUv = vec2(atan(dir.z, dir.x) / 6.2831853 + 0.5, acos(clamp(dir.y, -1.0, 1.0)) / 3.1415926);
        vec2 starGrid = floor(starUv * vec2(900.0, 450.0));
        float starSeed = hash(starGrid);
        float star = step(0.9975, starSeed);
        float twinkle = 0.55 + 0.45 * sin(uTime * 3.0 + starSeed * 90.0);
        float starHorizonMask = smoothstep(0.18, 0.8, h);
        sky += vec3(0.72, 0.83, 1.0) * star * twinkle * starHorizonMask * (uNightFactor * 1.25);

        vec2 cloudUV = dir.xz * 3.2 + vec2(uTime * 0.01, uTime * 0.006);
        float c = noise(cloudUV) * 0.7 + noise(cloudUV * 1.9) * 0.3;
        float cloudMask = smoothstep(0.58, 0.78, c) * smoothstep(0.2, 0.8, h);
        sky = mix(sky, sky + vec3(0.14), cloudMask * (0.16 + uDayFactor * 0.12 + uTwilightFactor * 0.05));

        gl_FragColor = vec4(sky, 1.0);
      }
    `
  })
);
scene.add(skyDome);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1600);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x5b6f9a, 0x1a1610, 0.58);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.1);
sunLight.position.set(18, 24, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -35;
sunLight.shadow.camera.right = 35;
sunLight.shadow.camera.top = 35;
sunLight.shadow.camera.bottom = -35;
sunLight.shadow.bias = -0.00018;
sunLight.shadow.normalBias = 0.02;
scene.add(sunLight);

const sunCore = new THREE.Mesh(
  new THREE.SphereGeometry(5.2, 24, 18),
  new THREE.MeshBasicMaterial({ color: 0xffeea8 })
);
scene.add(sunCore);

const moonCore = new THREE.Mesh(
  new THREE.SphereGeometry(4.1, 24, 18),
  new THREE.MeshBasicMaterial({ color: 0xc9d8ff })
);
scene.add(moonCore);

const sunGlowUniforms = {
  uTime: { value: 0 },
  uColor: { value: new THREE.Color(0xffd36e) },
  uIntensity: { value: 0.95 }
};

const sunGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(26, 26),
  new THREE.ShaderMaterial({
    uniforms: sunGlowUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p);
        float ring = smoothstep(0.95, 0.35, d);
        float pulse = 0.88 + 0.12 * sin(uTime * 2.1);
        float glow = ring * pulse * uIntensity;
        gl_FragColor = vec4(uColor, glow * 0.75);
      }
    `
  })
);
scene.add(sunGlow);

const moonGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(22, 22),
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x9ab8ff) },
      uIntensity: { value: 0.75 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p);
        float halo = smoothstep(0.95, 0.2, d);
        float pulse = 0.9 + 0.1 * sin(uTime * 1.6);
        gl_FragColor = vec4(uColor, halo * pulse * uIntensity * 0.45);
      }
    `
  })
);
scene.add(moonGlow);

const terrainManager = new InfiniteTerrainChunks({ THREE, scene, textureLoader, renderer });

const { group: player, parts: playerParts } = createCharacter(THREE);
scene.add(player);

const flashlight = new THREE.SpotLight(0xdde8ff, 0, 36, Math.PI / 8, 0.42, 1.2);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(1024, 1024);
flashlight.shadow.bias = -0.00008;
flashlight.shadow.normalBias = 0.012;
scene.add(flashlight);

const flashlightTarget = new THREE.Object3D();
scene.add(flashlightTarget);
flashlight.target = flashlightTarget;

const flashlightLens = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 14, 10),
  new THREE.MeshBasicMaterial({ color: 0xd7e4ff, transparent: true, opacity: 0 })
);
scene.add(flashlightLens);

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

class TreeChunkManager {
  constructor({ THREE, scene, terrainManager }) {
    this.THREE = THREE;
    this.scene = scene;
    this.terrainManager = terrainManager;
    this.cellSize = 90;
    this.viewRadius = 4;
    this.chunks = new Map();
    this.windDirection = new THREE.Vector2(1.0, 0.38).normalize();
    this.windStrength = 0.12;

    this.trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.92, metalness: 0.02 });
    this.leafMaterial = new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.84, metalness: 0.01 });

    this.windUniforms = {
      uWindTime: { value: 0 },
      uWindDir: { value: new THREE.Vector2(this.windDirection.x, this.windDirection.y) },
      uWindStrength: { value: this.windStrength }
    };

    this.leafMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = this.windUniforms.uWindTime;
      shader.uniforms.uWindDir = this.windUniforms.uWindDir;
      shader.uniforms.uWindStrength = this.windUniforms.uWindStrength;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform float uWindTime;
          uniform vec2 uWindDir;
          uniform float uWindStrength;
          `
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float bend = clamp(position.y / 14.0, 0.0, 1.0);
          float gust = sin(uWindTime * 1.75 + position.x * 0.9 + position.z * 0.7) * 0.65;
          gust += sin(uWindTime * 3.2 + position.x * 2.1 + position.z * 1.8) * 0.35;
          float sway = gust * uWindStrength * bend;
          transformed.xz += uWindDir * sway;
          `
        );
    };
    this.leafMaterial.customProgramCacheKey = () => "leaf-wind-v1";
  }

  _key(cx, cz) {
    return `${cx},${cz}`;
  }

  _forestDensityAt(x, z) {
    const broad = hash2(x * 0.0013, z * 0.0013);
    const medium = hash2(x * 0.0058 + 17.1, z * 0.0058 + 9.4);
    const local = hash2(x * 0.022 + 3.8, z * 0.022 + 5.1);
    const density = broad * 0.55 + medium * 0.35 + local * 0.1;
    return Math.max(0, Math.min(1, density));
  }

  _createTree(seedA, seedB) {
    const tree = new this.THREE.Group();
    const trunkHeight = 7.4 + seedA * 4.2;
    const trunkRadius = 0.24 + seedB * 0.14;

    const trunk = new this.THREE.Mesh(
      new this.THREE.CylinderGeometry(trunkRadius * 0.75, trunkRadius, trunkHeight, 10),
      this.trunkMaterial
    );
    trunk.position.y = trunkHeight * 0.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const crownBaseH = 4.2 + seedB * 2.0;
    const crownBaseR = 2.4 + seedA * 1.0;
    const crownBase = new this.THREE.Mesh(
      new this.THREE.ConeGeometry(crownBaseR, crownBaseH, 12),
      this.leafMaterial
    );
    crownBase.position.y = trunkHeight + crownBaseH * 0.42;
    crownBase.castShadow = true;
    crownBase.receiveShadow = true;
    tree.add(crownBase);

    const crownMid = new this.THREE.Mesh(
      new this.THREE.ConeGeometry(crownBaseR * 0.78, crownBaseH * 0.85, 12),
      this.leafMaterial
    );
    crownMid.position.y = trunkHeight + crownBaseH * 0.84;
    crownMid.castShadow = true;
    tree.add(crownMid);

    const crownTop = new this.THREE.Mesh(
      new this.THREE.ConeGeometry(crownBaseR * 0.5, crownBaseH * 0.65, 12),
      this.leafMaterial
    );
    crownTop.position.y = trunkHeight + crownBaseH * 1.17;
    crownTop.castShadow = true;
    tree.add(crownTop);

    return tree;
  }

  _buildCell(cx, cz) {
    const group = new this.THREE.Group();
    const cellCenterX = cx * this.cellSize;
    const cellCenterZ = cz * this.cellSize;
    const centerDensity = this._forestDensityAt(cellCenterX, cellCenterZ);
    const clearMask = hash2(cx * 0.47 + 10.2, cz * 0.63 + 11.1);
    const sparseMultiplier = clearMask > 0.83 ? 0.28 : 1.0;
    const minTrees = 8;
    const maxTrees = 38;
    const treeCount = Math.floor((minTrees + centerDensity * (maxTrees - minTrees)) * sparseMultiplier);
    const half = this.cellSize * 0.5;

    for (let i = 0; i < treeCount; i++) {
      const rx = hash2(cx * 17.7 + i * 11.3, cz * 13.1 + i * 5.2);
      const rz = hash2(cx * 9.4 + i * 7.1, cz * 19.5 + i * 3.4);
      const x = cx * this.cellSize + (rx * 2 - 1) * half;
      const z = cz * this.cellSize + (rz * 2 - 1) * half;
      const y = this.terrainManager.getHeightAt(x, z);
      if (y < -2) continue;

      const localDensity = this._forestDensityAt(x, z);
      if (localDensity < 0.22 && hash2(x * 0.11, z * 0.11) > 0.35) continue;

      const seedA = hash2(cx * 21.3 + i, cz * 8.7 + i * 2.0);
      const seedB = hash2(cx * 3.2 + i * 2.5, cz * 4.1 + i * 1.3);
      const tree = this._createTree(seedA, seedB);
      tree.position.set(x, y, z);
      tree.rotation.y = hash2(x * 0.08 + 3.0, z * 0.08 + 2.0) * Math.PI * 2;
      group.add(tree);
    }

    this.scene.add(group);
    this.chunks.set(this._key(cx, cz), group);
  }

  _removeCell(key) {
    const group = this.chunks.get(key);
    if (!group) return;
    this.scene.remove(group);
    group.traverse((obj) => {
      if (obj.isMesh && obj.geometry) obj.geometry.dispose();
    });
    this.chunks.delete(key);
  }

  update(targetPosition, timeSec) {
    const cx = Math.floor(targetPosition.x / this.cellSize);
    const cz = Math.floor(targetPosition.z / this.cellSize);
    const needed = new Set();

    for (let dz = -this.viewRadius; dz <= this.viewRadius; dz++) {
      for (let dx = -this.viewRadius; dx <= this.viewRadius; dx++) {
        const nx = cx + dx;
        const nz = cz + dz;
        const key = this._key(nx, nz);
        needed.add(key);
        if (!this.chunks.has(key)) this._buildCell(nx, nz);
      }
    }

    for (const key of this.chunks.keys()) {
      if (!needed.has(key)) this._removeCell(key);
    }

    this.windUniforms.uWindTime.value = timeSec;
  }
}

function findRandomSpawn() {
  const maxTries = 120;
  const radiusMin = 90;
  const radiusMax = 620;
  for (let i = 0; i < maxTries; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = radiusMin + Math.random() * (radiusMax - radiusMin);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = terrainManager.getHeightAt(x, z);

    const nearbyA = terrainManager.getHeightAt(x + 3, z);
    const nearbyB = terrainManager.getHeightAt(x - 3, z);
    const nearbyC = terrainManager.getHeightAt(x, z + 3);
    const nearbyD = terrainManager.getHeightAt(x, z - 3);
    const slope =
      Math.max(Math.abs(y - nearbyA), Math.abs(y - nearbyB), Math.abs(y - nearbyC), Math.abs(y - nearbyD));

    const validHeight = y > -5 && y < 120;
    const validSlope = slope < 2.8;
    if (validHeight && validSlope) return new THREE.Vector3(x, y, z);
  }

  const fallbackY = terrainManager.getHeightAt(0, 0);
  return new THREE.Vector3(0, fallbackY, 0);
}

const spawnPoint = findRandomSpawn();
terrainManager.update(spawnPoint);
player.position.copy(spawnPoint);
const treeManager = new TreeChunkManager({ THREE, scene, terrainManager });
treeManager.update(spawnPoint, 0);

const inputController = createInputController();
const cameraController = new ThirdPersonCameraController({ THREE, camera, target: player, domElement: renderer.domElement });
const movementController = new CharacterMovementController({
  THREE,
  character: player,
  getGroundHeightAt: (x, z) => terrainManager.getHeightAt(x, z)
});
const animationController = new CharacterAnimationController({ THREE, parts: playerParts });

const clock = new THREE.Clock();
let worldTime = 0;
const dayDurationSec = 240;
const dayFogColor = new THREE.Color(0x9bbce2);
const duskFogColor = new THREE.Color(0xa96b52);
const nightFogColor = new THREE.Color(0x0a1220);
const hemiDayColor = new THREE.Color(0x9cbfff);
const hemiNightColor = new THREE.Color(0x5f79b8);
const hemiGroundDayColor = new THREE.Color(0x3f362b);
const hemiGroundNightColor = new THREE.Color(0x181a26);
const tmpSunDir = new THREE.Vector3();
const tmpMoonDir = new THREE.Vector3();
const tmpTerrainDir = new THREE.Vector3();
const tmpFog = new THREE.Color();
const tmpFlashOffset = new THREE.Vector3();
const tmpFlashForward = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  worldTime += dt;

  const phase = (worldTime % dayDurationSec) / dayDurationSec;
  const sunOrbit = phase * Math.PI * 2 - Math.PI * 0.5;
  const sunX = Math.cos(sunOrbit) * 180;
  const sunY = Math.sin(sunOrbit) * 155;
  const sunZ = Math.sin(sunOrbit * 0.4) * 110 - 95;
  const moonX = -sunX;
  const moonY = -sunY;
  const moonZ = -sunZ;

  const dayFactor = THREE.MathUtils.clamp((sunY + 20) / 95, 0, 1);
  const nightFactor = THREE.MathUtils.clamp((-sunY + 18) / 85, 0, 1);
  const twilightFactor = THREE.MathUtils.clamp(1 - Math.abs(sunY) / 55, 0, 1) * (1 - dayFactor * 0.65);
  const flashlightNight = THREE.MathUtils.smoothstep(nightFactor, 0.32, 0.95);

  sunCore.position.set(sunX, sunY, sunZ);
  moonCore.position.set(moonX, moonY, moonZ);
  sunGlow.position.copy(sunCore.position);
  moonGlow.position.copy(moonCore.position);
  sunGlow.lookAt(camera.position);
  moonGlow.lookAt(camera.position);
  sunLight.position.set(sunX * 0.38, Math.max(8, sunY * 0.62), 54);
  sunLight.intensity = 0.06 + dayFactor * 1.28 + twilightFactor * 0.28;
  hemi.intensity = 0.12 + dayFactor * 0.5 + twilightFactor * 0.18 + nightFactor * 0.08;
  hemi.color.copy(hemiDayColor).lerp(hemiNightColor, nightFactor * 0.75);
  hemi.groundColor.copy(hemiGroundDayColor).lerp(hemiGroundNightColor, nightFactor * 0.8);

  tmpSunDir.set(sunX, sunY, sunZ).normalize();
  tmpMoonDir.set(moonX, moonY, moonZ).normalize();
  tmpTerrainDir.copy(tmpSunDir).lerp(tmpMoonDir, nightFactor * 0.9).normalize();
  terrainManager.setSunDirection(tmpTerrainDir);
  sunGlowUniforms.uTime.value = worldTime;
  sunGlowUniforms.uIntensity.value = 0.1 + dayFactor * 0.9 + twilightFactor * 0.4;
  moonGlow.material.uniforms.uTime.value = worldTime;
  moonGlow.material.uniforms.uIntensity.value = 0.08 + nightFactor * 0.9;
  sunCore.visible = dayFactor > 0.02 || twilightFactor > 0.2;
  sunGlow.visible = sunCore.visible;
  moonCore.visible = nightFactor > 0.05 || twilightFactor > 0.25;
  moonGlow.visible = moonCore.visible;

  skyUniforms.uSunDir.value.copy(tmpSunDir);
  skyUniforms.uMoonDir.value.copy(tmpMoonDir);
  skyUniforms.uDayFactor.value = dayFactor;
  skyUniforms.uTwilightFactor.value = twilightFactor;
  skyUniforms.uNightFactor.value = nightFactor;
  skyUniforms.uTime.value = worldTime;

  tmpFog.copy(nightFogColor).lerp(dayFogColor, dayFactor).lerp(duskFogColor, twilightFactor * 0.8);
  scene.fog.color.copy(tmpFog);
  skyDome.position.copy(camera.position);

  tmpFlashOffset.set(0.0, 1.9, 0.14).applyQuaternion(player.quaternion);
  flashlight.position.copy(player.position).add(tmpFlashOffset);
  flashlightLens.position.copy(flashlight.position);
  tmpFlashForward.set(0, 0, 1).applyQuaternion(player.quaternion);
  flashlightTarget.position.copy(flashlight.position).add(tmpFlashForward.multiplyScalar(18));
  flashlight.intensity = flashlightNight * 5.6;
  flashlight.distance = 30 + flashlightNight * 24;
  flashlight.visible = flashlightNight > 0.01;
  flashlightLens.material.opacity = flashlightNight * 0.85;
  flashlightLens.visible = flashlight.visible;

  const locomotion = movementController.update(dt, inputController, cameraController.yaw);
  terrainManager.update(player.position);
  treeManager.update(player.position, worldTime);
  animationController.update(dt, locomotion);
  cameraController.update(dt, locomotion, inputController.state);

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
