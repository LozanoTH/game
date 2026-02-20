function fract(x) {
  return x - Math.floor(x);
}

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return fract(s);
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function saturate(t) {
  return Math.max(0, Math.min(1, t));
}

function valueNoise2D(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;

  const a = hash2(xi, zi);
  const b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1);
  const d = hash2(xi + 1, zi + 1);

  const ux = smoothstep(xf);
  const uz = smoothstep(zf);

  const lerpX1 = a + (b - a) * ux;
  const lerpX2 = c + (d - c) * ux;
  return lerpX1 + (lerpX2 - lerpX1) * uz;
}

function fbm(x, z, octaves = 5) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let sumAmp = 0;

  for (let i = 0; i < octaves; i++) {
    value += valueNoise2D(x * frequency, z * frequency) * amplitude;
    sumAmp += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / Math.max(0.0001, sumAmp);
}

function ridgeNoise(x, z, octaves = 5) {
  let value = 0;
  let amplitude = 0.6;
  let frequency = 1;
  let sumAmp = 0;

  for (let i = 0; i < octaves; i++) {
    const n = valueNoise2D(x * frequency, z * frequency);
    const ridge = 1 - Math.abs(n * 2 - 1); // picos mas afilados
    value += ridge * amplitude;
    sumAmp += amplitude;
    amplitude *= 0.55;
    frequency *= 2.05;
  }

  return value / Math.max(0.0001, sumAmp);
}

export class InfiniteTerrainChunks {
  constructor({ THREE, scene, textureLoader, renderer }) {
    this.THREE = THREE;
    this.scene = scene;
    this.chunkSize = 80;
    this.chunkResolution = 56;
    this.viewRadius = 3;
    this.farChunkSize = 200;
    this.farChunkResolution = 14;
    this.farViewRadius = 6;
    this.chunks = new Map();
    this.farChunks = new Map();

    this.grassTexture = textureLoader.load("texture/sesped.jpg");
    this.grassTexture.colorSpace = THREE.SRGBColorSpace;
    this.grassTexture.wrapS = THREE.RepeatWrapping;
    this.grassTexture.wrapT = THREE.RepeatWrapping;
    this.grassTexture.repeat.set(6, 6);
    this.grassTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

    this.terrainMaterial = new THREE.MeshStandardMaterial({
      map: this.grassTexture,
      roughness: 0.94,
      metalness: 0.02
    });

    this.farTerrainMaterial = new THREE.MeshStandardMaterial({
      map: this.grassTexture,
      roughness: 0.96,
      metalness: 0.01
    });

    this.terrainUniforms = {
      uSunDir: { value: new THREE.Vector3(0.2, 0.8, -0.4).normalize() }
    };
    this._applyTerrainShader(this.terrainMaterial);
    this._applyTerrainShader(this.farTerrainMaterial);
  }

  getHeightAt(worldX, worldZ) {
    const biomeNoise = fbm(worldX * 0.0015, worldZ * 0.0015, 5);
    const plainToMountain = Math.pow(smoothstep(saturate((biomeNoise - 0.42) / 0.58)), 1.4);

    const lowFreq = fbm(worldX * 0.0034, worldZ * 0.0034, 6);
    const medium = fbm(worldX * 0.012, worldZ * 0.012, 5);
    const detail = fbm(worldX * 0.055, worldZ * 0.055, 3);
    const ridges = ridgeNoise(worldX * 0.006, worldZ * 0.006, 6);

    const plains = (medium - 0.5) * 5.2 + (detail - 0.5) * 1.25;
    const mountainBody = Math.pow(Math.max(0, lowFreq - 0.33) / 0.67, 1.9) * 58;
    const mountainRidges = Math.pow(ridges, 1.6) * 32;
    const mountains = mountainBody + mountainRidges + (medium - 0.5) * 10;

    let height = plains * (1 - plainToMountain) + mountains * plainToMountain;

    const moundField = fbm(worldX * 0.03, worldZ * 0.03, 3);
    const moundMask = smoothstep(saturate((moundField - 0.58) / 0.42));
    const moundHeight = (0.8 + plainToMountain * 1.8) * moundMask;
    height += moundHeight;

    const holeField = fbm(worldX * 0.009, worldZ * 0.009, 4);
    const holeMask = smoothstep(saturate((holeField - 0.78) / 0.22));
    const holeDepth = 10 + plainToMountain * 22;
    height -= Math.pow(holeMask, 1.3) * holeDepth;

    return height;
  }

  _applyTerrainShader(material) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSunDir = this.terrainUniforms.uSunDir;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vWorldPos;
          `
        )
        .replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
          vWorldPos = worldPosition.xyz;
          `
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform vec3 uSunDir;
          varying vec3 vWorldPos;
          `
        )
        .replace(
          "#include <dithering_fragment>",
          `
          float ndl = max(dot(normalize(normal), normalize(uSunDir)), 0.0);
          float sunBoost = mix(0.82, 1.2, ndl);
          float slopeShadow = mix(0.88, 1.05, clamp(normal.y, 0.0, 1.0));
          outgoingLight *= sunBoost * slopeShadow;
          #include <dithering_fragment>
          `
        );
    };
    material.customProgramCacheKey = () => "terrain-light-shadow-v2";
    material.needsUpdate = true;
  }

  setSunDirection(direction) {
    this.terrainUniforms.uSunDir.value.copy(direction).normalize();
  }

  _chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  _buildChunk(cx, cz) {
    const size = this.chunkSize;
    const res = this.chunkResolution;

    const geometry = new this.THREE.PlaneGeometry(size, size, res, res);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    const originX = cx * size;
    const originZ = cz * size;

    for (let i = 0; i < pos.count; i++) {
      const localX = pos.getX(i);
      const localZ = pos.getZ(i);
      const wx = originX + localX;
      const wz = originZ + localZ;
      const h = this.getHeightAt(wx, wz);
      pos.setY(i, h);
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();

    const mesh = new this.THREE.Mesh(geometry, this.terrainMaterial);
    mesh.receiveShadow = true;
    mesh.position.set(originX, 0, originZ);

    this.scene.add(mesh);
    this.chunks.set(this._chunkKey(cx, cz), mesh);
  }

  _buildFarChunk(cx, cz) {
    const size = this.farChunkSize;
    const res = this.farChunkResolution;

    const geometry = new this.THREE.PlaneGeometry(size, size, res, res);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    const originX = cx * size;
    const originZ = cz * size;

    for (let i = 0; i < pos.count; i++) {
      const localX = pos.getX(i);
      const localZ = pos.getZ(i);
      const wx = originX + localX;
      const wz = originZ + localZ;
      const h = this.getHeightAt(wx, wz);
      pos.setY(i, h);
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();

    const mesh = new this.THREE.Mesh(geometry, this.farTerrainMaterial);
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    mesh.position.set(originX, 0, originZ);

    this.scene.add(mesh);
    this.farChunks.set(this._chunkKey(cx, cz), mesh);
  }

  _removeChunk(key) {
    const mesh = this.chunks.get(key);
    if (!mesh) return;
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    this.chunks.delete(key);
  }

  _removeFarChunk(key) {
    const mesh = this.farChunks.get(key);
    if (!mesh) return;
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    this.farChunks.delete(key);
  }

  update(targetPosition) {
    const cx = Math.floor(targetPosition.x / this.chunkSize);
    const cz = Math.floor(targetPosition.z / this.chunkSize);
    const fcx = Math.floor(targetPosition.x / this.farChunkSize);
    const fcz = Math.floor(targetPosition.z / this.farChunkSize);

    const needed = new Set();
    const neededFar = new Set();
    for (let dz = -this.viewRadius; dz <= this.viewRadius; dz++) {
      for (let dx = -this.viewRadius; dx <= this.viewRadius; dx++) {
        const nx = cx + dx;
        const nz = cz + dz;
        const key = this._chunkKey(nx, nz);
        needed.add(key);
        if (!this.chunks.has(key)) this._buildChunk(nx, nz);
      }
    }

    for (let dz = -this.farViewRadius; dz <= this.farViewRadius; dz++) {
      for (let dx = -this.farViewRadius; dx <= this.farViewRadius; dx++) {
        const nx = fcx + dx;
        const nz = fcz + dz;
        const centerX = nx * this.farChunkSize;
        const centerZ = nz * this.farChunkSize;
        const distX = centerX - targetPosition.x;
        const distZ = centerZ - targetPosition.z;
        const nearCutoff = this.chunkSize * (this.viewRadius + 1.2);
        if (Math.hypot(distX, distZ) < nearCutoff) continue;
        const key = this._chunkKey(nx, nz);
        neededFar.add(key);
        if (!this.farChunks.has(key)) this._buildFarChunk(nx, nz);
      }
    }

    for (const key of this.chunks.keys()) {
      if (!needed.has(key)) this._removeChunk(key);
    }

    for (const key of this.farChunks.keys()) {
      if (!neededFar.has(key)) this._removeFarChunk(key);
    }
  }
}
