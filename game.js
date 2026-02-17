import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/SSAOPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/shaders/FXAAShader.js';

let scene = new THREE.Scene();
// scene.fog se gestiona en updateSun ahora

let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 280);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);
const baseCameraFov = 75;
const maxCameraFov = 95;

let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.body.appendChild(renderer.domElement);

let composer;
let bloomPass;
let ssaoPass;
let fxaaPass;
let graphicsQuality = 20;

function updateGraphicsLabel(level) {
    const label = document.getElementById("graphics-label");
    if (!label) return;
    if (level >= 95) label.textContent = "RTX PRO MAX";
    else if (level >= 80) label.textContent = "Ultra";
    else if (level >= 60) label.textContent = "Alto";
    else if (level >= 40) label.textContent = "Medio";
    else label.textContent = "Bajo";
}

function applyGraphicsQuality(level) {
    graphicsQuality = THREE.MathUtils.clamp(level, 20, 100);
    const t = (graphicsQuality - 20) / 80; // 0..1

    const pixelRatio = THREE.MathUtils.lerp(0.9, 2.0, t);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatio));
    renderer.toneMappingExposure = THREE.MathUtils.lerp(0.98, 1.14, t);

    const shadowSize = t > 0.8 ? 4096 : (t > 0.45 ? 2048 : 1024);
    dirLight.shadow.mapSize.width = shadowSize;
    dirLight.shadow.mapSize.height = shadowSize;
    if (dirLight.shadow.map) dirLight.shadow.map.dispose();

    if (ssaoPass) {
        ssaoPass.enabled = graphicsQuality >= 35;
        ssaoPass.kernelRadius = THREE.MathUtils.lerp(6, 14, t);
        ssaoPass.minDistance = THREE.MathUtils.lerp(0.006, 0.002, t);
        ssaoPass.maxDistance = THREE.MathUtils.lerp(0.18, 0.26, t);
    }

    if (bloomPass) {
        bloomPass.enabled = true;
        bloomPass.strength = THREE.MathUtils.lerp(0.14, 0.42, t);
        bloomPass.radius = THREE.MathUtils.lerp(0.35, 0.9, t);
        bloomPass.threshold = THREE.MathUtils.lerp(1.05, 0.82, t);
    }

    updateGraphicsLabel(graphicsQuality);
}

// --- CIELO Y AMBIENTE ---
// --- CIELO Y AMBIENTE ---
const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'anonymous';
// Cargar textura local del cielo desde la carpeta 'texture'
const skyTexture = textureLoader.load('texture/cielo.png');

const skyGeo = new THREE.SphereGeometry(500, 32, 32);
const skyMat = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// Permitir que el cielo actÃºe como mapa de reflexiÃ³n ambiental (RTX feel)
skyTexture.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = skyTexture;

// Luz ambiental
const ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);

// Luz Direccional
let dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(-50, 100, 50);
dirLight.castShadow = true;
scene.add(dirLight);

// Niebla ajustada
scene.fog = new THREE.Fog(0x88aabb, 20, 200);

// ConfiguraciÃ³n de Sombras de "Alta Calidad" (RTX feel)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Sombras suaves
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
dirLight.shadow.bias = -0.00025;
dirLight.shadow.normalBias = 0.02;

// Luz HemisfÃ©rica para colores mÃ¡s naturales
const hemiLight = new THREE.HemisphereLight(0x88aabb, 0x443333, 0.6);
scene.add(hemiLight);

// Sol y luna para ciclo dia/noche
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xfff0b3, transparent: true, opacity: 1 });
const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xcfd8ff, transparent: true, opacity: 1 });
const sun = new THREE.Mesh(new THREE.SphereGeometry(3.2, 20, 20), sunMaterial);
const moon = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 16), moonMaterial);
scene.add(sun);
scene.add(moon);

// Variables de tiempo
let time = 0;
const dayDuration = 240;
let clock = new THREE.Clock();

const daySkyColor = new THREE.Color(0x8dcfff);
const duskSkyColor = new THREE.Color(0xffa366);
const nightSkyColor = new THREE.Color(0x0b1026);
const dayHemiSky = new THREE.Color(0xbadfff);
const nightHemiSky = new THREE.Color(0x1b2550);
const dayHemiGround = new THREE.Color(0x4a3a28);
const nightHemiGround = new THREE.Color(0x0f1018);
const daySunColor = new THREE.Color(0xffffff);
const nightSunColor = new THREE.Color(0x7f8bb2);
const tmpColorA = new THREE.Color();
const tmpColorB = new THREE.Color();

function smoothstep(edge0, edge1, x) {
    const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

function updateSun(dt) {
    time = (time + dt) % dayDuration;
    const phase = time / dayDuration;
    const angle = phase * Math.PI * 2;
    const sunHeight = Math.sin(angle);
    const dayFactor = smoothstep(-0.2, 0.2, sunHeight);
    const twilightFactor = Math.max(0, 1 - Math.abs(sunHeight) * 4);

    // Rotacion suave del cielo
    sky.rotation.y += dt * 0.01;

    // Colores de cielo y niebla
    tmpColorA.copy(nightSkyColor).lerp(daySkyColor, dayFactor);
    tmpColorB.copy(tmpColorA).lerp(duskSkyColor, twilightFactor * (1 - dayFactor * 0.6));
    renderer.setClearColor(tmpColorB, 1);
    scene.fog.color.copy(tmpColorB);
    scene.fog.near = THREE.MathUtils.lerp(14, 24, dayFactor);
    scene.fog.far = THREE.MathUtils.lerp(85, 155, dayFactor);

    // Luces
    ambientLight.intensity = THREE.MathUtils.lerp(0.35, 1.9, dayFactor);
    hemiLight.intensity = THREE.MathUtils.lerp(0.2, 0.75, dayFactor);
    hemiLight.color.copy(nightHemiSky).lerp(dayHemiSky, dayFactor);
    hemiLight.groundColor.copy(nightHemiGround).lerp(dayHemiGround, dayFactor);
    dirLight.intensity = THREE.MathUtils.lerp(0.06, 1.6, dayFactor);
    dirLight.color.copy(nightSunColor).lerp(daySunColor, dayFactor);

    // Orbita solar/lunar
    const orbitX = Math.cos(angle) * 120;
    const orbitY = 24 + sunHeight * 90;
    sun.position.set(orbitX, orbitY, -120);
    moon.position.set(-orbitX, 24 - sunHeight * 90, -120);
    sunMaterial.opacity = THREE.MathUtils.lerp(0.2, 1, dayFactor);
    moonMaterial.opacity = THREE.MathUtils.lerp(0.95, 0.15, dayFactor);

    // La direccional sigue el sol para sombras coherentes
    dirLight.position.set(orbitX * 0.7, Math.max(8, orbitY), 70);
}

function initPostProcessing() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const px = renderer.getPixelRatio();

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    ssaoPass = new SSAOPass(scene, camera, w, h);
    ssaoPass.kernelRadius = 12;
    ssaoPass.minDistance = 0.002;
    ssaoPass.maxDistance = 0.22;
    composer.addPass(ssaoPass);

    bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.75, 0.9);
    composer.addPass(bloomPass);

    fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms['resolution'].value.set(1 / (w * px), 1 / (h * px));
    composer.addPass(fxaaPass);

    applyGraphicsQuality(graphicsQuality);
}
// --- CARRETERA Y TEXTURAS ---
// Cargar textura de asfalto (Imagen real desde fuente confiable)
// const textureLoader = new THREE.TextureLoader(); // Ya declarado arriba
// textureLoader.crossOrigin = 'anonymous';

function createRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ruido suave para simular asfalto y evitar depender de assets faltantes.
    for (let i = 0; i < 12000; i++) {
        const shade = 40 + Math.floor(Math.random() * 35);
        ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = 1 + Math.random() * 2;
        ctx.fillRect(x, y, size, size);
    }

    return new THREE.CanvasTexture(canvas);
}

const roadTexture = createRoadTexture();

roadTexture.wrapS = THREE.RepeatWrapping;
roadTexture.wrapT = THREE.RepeatWrapping;
roadTexture.repeat.set(1, 10);

const roadGeo = new THREE.PlaneGeometry(12, 400);
const roadMat = new THREE.MeshStandardMaterial({
    map: roadTexture,
    color: 0x888888,
    roughness: 0.62,
    metalness: 0.28,
    envMapIntensity: 0.9
});
const road = new THREE.Mesh(roadGeo, roadMat);
road.rotation.x = -Math.PI / 2;
scene.add(road);

// LÃ­neas laterales (GeometrÃ­a separada)
const lineGeo = new THREE.PlaneGeometry(0.5, 400);
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const leftLine = new THREE.Mesh(lineGeo, lineMat);
leftLine.rotation.x = -Math.PI / 2;
leftLine.position.set(-5, 0.02, 0); // Ligeramente elevado
scene.add(leftLine);

const rightLine = new THREE.Mesh(lineGeo, lineMat);
rightLine.rotation.x = -Math.PI / 2;
rightLine.position.set(5, 0.02, 0);
scene.add(rightLine);

// LÃ­neas centrales (Amarillas discontinuas)
const centerLineGeo = new THREE.PlaneGeometry(0.3, 400);
const centerLineMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });

// Para hacerlas discontinuas usamos un truco de textura alpha o geometrÃ­a mÃºltiple.
// Por simplicidad/rendimiento, usaremos una textura procedural simple para la lÃ­nea central transparente
const canvasDash = document.createElement('canvas');
canvasDash.width = 32; canvasDash.height = 64;
const ctxDash = canvasDash.getContext('2d');
ctxDash.fillStyle = '#ffcc00'; // Color
ctxDash.fillRect(0, 0, 32, 32); // Mitad rellena
ctxDash.clearRect(0, 32, 32, 32); // Mitad transparente

const dashTex = new THREE.CanvasTexture(canvasDash);
dashTex.wrapT = THREE.RepeatWrapping;
dashTex.repeat.set(1, 40); // Repetir muchas veces

const dashMat = new THREE.MeshBasicMaterial({
    map: dashTex,
    transparent: true,
    alphaTest: 0.5
});

const centerLineLeft = new THREE.Mesh(centerLineGeo, dashMat);
centerLineLeft.rotation.x = -Math.PI / 2;
centerLineLeft.position.set(-1.66, 0.02, 0);
scene.add(centerLineLeft);

const centerLineRight = new THREE.Mesh(centerLineGeo, dashMat);
centerLineRight.rotation.x = -Math.PI / 2;
centerLineRight.position.set(1.66, 0.02, 0);
scene.add(centerLineRight);


// CÃ©sped lateral (Textura mejorada)
function createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Fondo verde tierra
    ctx.fillStyle = '#1a3300';
    ctx.fillRect(0, 0, 512, 512);

    // Ruido de hierba
    for (let i = 0; i < 40000; i++) {
        const color = Math.random() > 0.5 ? '#2d4d00' : '#142900';
        ctx.fillStyle = color;
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const w = 1 + Math.random() * 2;
        const h = 2 + Math.random() * 3;
        ctx.fillRect(x, y, w, h);
    }

    let tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(50, 50); // Mucha repeticiÃ³n para detalle
    return tex;
}

const grassTex = createGrassTexture();
const grassMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    roughness: 0.95,
    metalness: 0.03,
    envMapIntensity: 0.45
});

// Plano de suelo infinito (simulado)
const groundGeo = new THREE.PlaneGeometry(500, 500);
const ground = new THREE.Mesh(groundGeo, grassMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1; // Justo debajo de la carretera
scene.add(ground);

// --- MONTAÃ‘AS ---
function createMountain(x, z, scale) {
    const geo = new THREE.ConeGeometry(scale, scale * 1.5, 4); // PirÃ¡mides low poly
    const mat = new THREE.MeshStandardMaterial({
        color: 0x4d4d4d,
        roughness: 0.9,
        flatShading: true // Low poly look
    });
    const mountain = new THREE.Mesh(geo, mat);
    mountain.position.set(x, scale * 0.75 - 10, z); // Enterradas un poco
    scene.add(mountain);
}

// Generar paisaje de fondo
for (let i = 0; i < 15; i++) {
    // MontaÃ±as izquierda lejana
    createMountain(-80 - Math.random() * 100, -100 - Math.random() * 100, 30 + Math.random() * 50);
    // MontaÃ±as derecha lejana
    createMountain(80 + Math.random() * 100, -100 - Math.random() * 100, 30 + Math.random() * 50);
}

// Mas volumen en el horizonte para evitar el efecto de vacio
function createDistantMonolith(x, z, w, h, d, color = 0x3f3f3f) {
    const rock = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d, 2, 3, 2),
        new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.02, flatShading: true })
    );
    rock.position.set(x, h * 0.5 - 6, z);
    rock.rotation.y = (Math.random() - 0.5) * 0.7;
    scene.add(rock);
}

for (let i = 0; i < 22; i++) {
    createDistantMonolith(
        -58 - Math.random() * 95,
        -40 - Math.random() * 230,
        8 + Math.random() * 12,
        16 + Math.random() * 26,
        8 + Math.random() * 12,
        0x474747
    );
    createDistantMonolith(
        58 + Math.random() * 95,
        -40 - Math.random() * 230,
        8 + Math.random() * 12,
        16 + Math.random() * 26,
        8 + Math.random() * 12,
        0x454545
    );
}

// --- ÃRBOLES ---
function createTreeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Tronco
    ctx.fillStyle = '#4d3319';
    ctx.fillRect(56, 90, 16, 38);

    // Hojas (TriÃ¡ngulos superpuestos para estilo pino)
    ctx.fillStyle = '#1e591e';

    // Capa baja
    ctx.beginPath();
    ctx.moveTo(10, 90);
    ctx.lineTo(64, 40);
    ctx.lineTo(118, 90);
    ctx.fill();

    // Capa media
    ctx.fillStyle = '#267326';
    ctx.beginPath();
    ctx.moveTo(20, 65);
    ctx.lineTo(64, 20);
    ctx.lineTo(108, 65);
    ctx.fill();

    // Capa alta
    ctx.fillStyle = '#339933';
    ctx.beginPath();
    ctx.moveTo(30, 40);
    ctx.lineTo(64, 0);
    ctx.lineTo(98, 40);
    ctx.fill();

    let tex = new THREE.CanvasTexture(canvas);
    // tex.magFilter = THREE.NearestFilter; // Pixel art look
    return tex;
}

const treeTex = createTreeTexture();
const treeMat = new THREE.SpriteMaterial({ map: treeTex });
let trees = [];

function spawnTree() {
    // Crear árbol a la izquierda o derecha
    let side = Math.random() > 0.5 ? 1 : -1;
    let offset = 6.8 + Math.random() * 12.5; // Distancia desde la carretera

    let tree = new THREE.Sprite(treeMat);
    const size = 3.6 + Math.random() * 1.8;
    tree.scale.set(size, size, 1);
    tree.userData.side = side;
    tree.userData.offset = offset;
    tree.position.set(side * offset, 2, -100);
    tree.center.set(0.5, 0.0); // Anclar árbol al suelo desde su base
    scene.add(tree);
    trees.push(tree);

    // Densidad extra: algunos spawns crean un árbol acompañante.
    if (Math.random() < 0.35) {
        const companion = new THREE.Sprite(treeMat);
        const cSize = 3.2 + Math.random() * 1.6;
        companion.scale.set(cSize, cSize, 1);
        companion.userData.side = side;
        companion.userData.offset = offset + (Math.random() * 2.2 + 0.8);
        companion.position.set(side * companion.userData.offset, 2, -102 - Math.random() * 9);
        companion.center.set(0.5, 0.0);
        scene.add(companion);
        trees.push(companion);
    }
}
// Generar Ã¡rboles iniciales
for (let i = 0; i < 42; i++) {
    let side = Math.random() > 0.5 ? 1 : -1;
    let offset = 6.8 + Math.random() * 12.5;
    let tree = new THREE.Sprite(treeMat);
    const size = 3.4 + Math.random() * 1.9;
    tree.scale.set(size, size, 1);
    tree.userData.side = side;
    tree.userData.offset = offset;
    tree.position.set(side * offset, 2, -120 + i * 6.5); // Distribuir más denso
    tree.center.set(0.5, 0.0); // Anclar base
    scene.add(tree);
    trees.push(tree);
}

const mapProps = [];
const roadsideCliffs = [];
const cliffSegmentsPerSide = 18;

function createRoadsideCliffSegment(side, z) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1, 2, 2, 2),
        new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.08, 0.06, 0.23 + Math.random() * 0.08),
            roughness: 0.98,
            metalness: 0.01,
            flatShading: true
        })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.side = side;
    resetRoadsideCliffSegment(mesh, z);
    return mesh;
}

function resetRoadsideCliffSegment(segment, z) {
    const side = segment.userData.side ?? 1;
    const width = 8 + Math.random() * 10;
    const height = 12 + Math.random() * 26;
    const depth = 14 + Math.random() * 22;
    segment.userData.offset = 28 + Math.random() * 20;
    segment.userData.baseY = height * 0.42 + 1.2;
    segment.userData.spin = (Math.random() - 0.5) * 0.004;
    segment.scale.set(width, height, depth);
    segment.position.set(side * segment.userData.offset, segment.userData.baseY, z);
    segment.rotation.set((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.45, side * 0.03);
}

function initRoadsideCliffs() {
    for (let i = 0; i < cliffSegmentsPerSide; i++) {
        const left = createRoadsideCliffSegment(-1, -35 - i * 18);
        const right = createRoadsideCliffSegment(1, -35 - i * 18);
        scene.add(left);
        scene.add(right);
        roadsideCliffs.push(left, right);
    }
}

function createRoadSign() {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2.1, 12),
        new THREE.MeshStandardMaterial({ color: 0xaab0b8, roughness: 0.4, metalness: 0.8 })
    );
    pole.position.y = 1.05;
    pole.castShadow = true;
    group.add(pole);

    const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.55, 0.08, 3, 2, 1),
        new THREE.MeshStandardMaterial({ color: 0x2f6fd6, roughness: 0.65, metalness: 0.1 })
    );
    sign.position.y = 2.05;
    sign.castShadow = true;
    group.add(sign);

    return group;
}

function createLampPost() {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.08, 3.2, 12),
        new THREE.MeshStandardMaterial({ color: 0x6d737a, roughness: 0.5, metalness: 0.5 })
    );
    pole.position.y = 1.6;
    pole.castShadow = true;
    group.add(pole);

    const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.08, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x6d737a, roughness: 0.5, metalness: 0.5 })
    );
    arm.position.set(0.3, 3.05, 0);
    arm.castShadow = true;
    group.add(arm);

    const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffd36b, emissiveIntensity: 0.5 })
    );
    lamp.position.set(0.62, 2.95, 0);
    group.add(lamp);

    return group;
}

function createRoadRock() {
    const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.45 + Math.random() * 0.25, 0),
        new THREE.MeshStandardMaterial({ color: 0x565656, roughness: 0.95, metalness: 0.02, flatShading: true })
    );
    rock.castShadow = true;
    return rock;
}

function createGiantRock() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.35 + Math.random() * 1.2, 0),
        new THREE.MeshStandardMaterial({ color: 0x4f4f4f, roughness: 0.98, metalness: 0.01, flatShading: true })
    );
    base.castShadow = true;
    base.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
    g.add(base);

    if (Math.random() < 0.7) {
        const child = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.65 + Math.random() * 0.8, 0),
            new THREE.MeshStandardMaterial({ color: 0x585858, roughness: 0.98, metalness: 0.01, flatShading: true })
        );
        child.position.set((Math.random() - 0.5) * 1.4, 0.45, (Math.random() - 0.5) * 1.2);
        child.castShadow = true;
        g.add(child);
    }

    g.position.y = 1.2;
    return g;
}

function spawnMapProp(z = -110) {
    const side = Math.random() > 0.5 ? 1 : -1;
    const r = Math.random();
    let prop;
    let offset = 9 + Math.random() * 13;
    let kind = "rock";

    if (r < 0.25) {
        prop = createGiantRock();
        offset = 16 + Math.random() * 18;
        kind = "giant_rock";
    } else if (r < 0.58) {
        prop = createRoadRock();
        kind = "rock";
    } else if (r < 0.82) {
        prop = createRoadSign();
        kind = "sign";
    } else {
        prop = createLampPost();
        kind = "lamp";
    }

    prop.userData.side = side;
    prop.userData.offset = offset;
    prop.userData.kind = kind;
    prop.userData.baseY = prop.position.y;
    prop.userData.spin = (Math.random() - 0.5) * 0.03;
    prop.position.z = z;
    scene.add(prop);
    mapProps.push(prop);
}

for (let i = 0; i < 24; i++) {
    spawnMapProp(-25 - Math.random() * 135);
}
initRoadsideCliffs();

// --- MODELADO DE COCHES 3D CON ACABADO PREMIUM (RTX) ---
function createCar(color) {
    const carGroup = new THREE.Group();

    // Chasis con Pintura Metalizada (MeshPhysicalMaterial)
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.5, 2.2, 8, 4, 12);
    const bodyMat = new THREE.MeshPhysicalMaterial({
        color: color,
        metalness: 0.7,
        roughness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.5
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    body.receiveShadow = true;
    carGroup.add(body);

    // Cabina (Cristales reflectantes)
    const cabinGeo = new THREE.BoxGeometry(0.9, 0.4, 1.0, 6, 3, 6);
    const cabinMat = new THREE.MeshPhysicalMaterial({
        color: 0x111111,
        metalness: 0.9,
        roughness: 0.0,
        transparent: true,
        opacity: 0.7,
        envMapIntensity: 2.0
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 0.8, -0.2);
    cabin.castShadow = true;
    carGroup.add(cabin);

    // Ruedas con material gomoso
    const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 40, 3);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xb9bec8, roughness: 0.3, metalness: 0.85 });

    // ... (posiciones de ruedas se mantienen)
    const wheelPositions = [
        [-0.6, 0.25, 0.7], [0.6, 0.25, 0.7],
        [-0.6, 0.25, -0.7], [0.6, 0.25, -0.7]
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos[0], pos[1], pos[2]);
        wheel.castShadow = true;
        carGroup.add(wheel);

        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.205, 36, 2), rimMat);
        rim.rotation.z = Math.PI / 2;
        rim.position.set(pos[0], pos[1], pos[2]);
        rim.castShadow = true;
        carGroup.add(rim);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.21, 20, 1), wheelMat);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(pos[0], pos[1], pos[2]);
        hub.castShadow = true;
        carGroup.add(hub);

        const brakeDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.035, 28, 1), rimMat);
        brakeDisc.rotation.z = Math.PI / 2;
        brakeDisc.position.set(pos[0], pos[1], pos[2]);
        brakeDisc.castShadow = true;
        carGroup.add(brakeDisc);

        const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.14, 2, 2, 3), bodyMat);
        caliper.position.set(pos[0] + (pos[0] > 0 ? 0.09 : -0.09), pos[1] + 0.02, pos[2]);
        caliper.castShadow = true;
        carGroup.add(caliper);
    });

    // Luces con emisiÃ³n de luz (Glow)
    const lightGeo = new THREE.BoxGeometry(0.3, 0.15, 0.1, 3, 2, 2);
    const lightMat = new THREE.MeshStandardMaterial({
        color: 0xffffaa,
        emissive: 0xffffaa,
        emissiveIntensity: 2
    });

    const frontLightL = new THREE.Mesh(lightGeo, lightMat);
    frontLightL.position.set(-0.35, 0.45, -1.1);
    carGroup.add(frontLightL);

    const frontLightR = new THREE.Mesh(lightGeo, lightMat);
    frontLightR.position.set(0.35, 0.45, -1.1);
    carGroup.add(frontLightR);

    // Piezas extra para aumentar detalle visual/poligonal
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.75, metalness: 0.25 });

    const hoodGeo = new THREE.BoxGeometry(1.06, 0.12, 0.68, 4, 2, 6);
    const hood = new THREE.Mesh(hoodGeo, bodyMat);
    hood.position.set(0, 0.67, -0.86);
    hood.castShadow = true;
    carGroup.add(hood);

    const bumperGeo = new THREE.BoxGeometry(1.08, 0.18, 0.18, 4, 2, 2);
    const frontBumper = new THREE.Mesh(bumperGeo, trimMat);
    frontBumper.position.set(0, 0.34, -1.16);
    frontBumper.castShadow = true;
    carGroup.add(frontBumper);

    const rearBumper = new THREE.Mesh(bumperGeo, trimMat);
    rearBumper.position.set(0, 0.34, 1.16);
    rearBumper.castShadow = true;
    carGroup.add(rearBumper);

    const sideSkirtGeo = new THREE.BoxGeometry(0.08, 0.15, 1.7, 3, 2, 6);
    const leftSkirt = new THREE.Mesh(sideSkirtGeo, trimMat);
    leftSkirt.position.set(-0.63, 0.28, 0);
    leftSkirt.castShadow = true;
    carGroup.add(leftSkirt);

    const rightSkirt = new THREE.Mesh(sideSkirtGeo, trimMat);
    rightSkirt.position.set(0.63, 0.28, 0);
    rightSkirt.castShadow = true;
    carGroup.add(rightSkirt);

    const mirrorGeo = new THREE.BoxGeometry(0.12, 0.09, 0.18, 3, 2, 3);
    const leftMirror = new THREE.Mesh(mirrorGeo, trimMat);
    leftMirror.position.set(-0.56, 0.76, -0.26);
    leftMirror.castShadow = true;
    carGroup.add(leftMirror);

    const rightMirror = new THREE.Mesh(mirrorGeo, trimMat);
    rightMirror.position.set(0.56, 0.76, -0.26);
    rightMirror.castShadow = true;
    carGroup.add(rightMirror);

    const wheelArchGeo = new THREE.TorusGeometry(0.3, 0.03, 10, 24, Math.PI);
    const wheelArchPositions = [
        [-0.56, 0.36, 0.7, Math.PI / 2],
        [0.56, 0.36, 0.7, -Math.PI / 2],
        [-0.56, 0.36, -0.7, Math.PI / 2],
        [0.56, 0.36, -0.7, -Math.PI / 2]
    ];
    wheelArchPositions.forEach(([x, y, z, rotY]) => {
        const arch = new THREE.Mesh(wheelArchGeo, trimMat);
        arch.position.set(x, y, z);
        arch.rotation.set(0, rotY, Math.PI / 2);
        arch.castShadow = true;
        carGroup.add(arch);
    });

    const spoilerBaseGeo = new THREE.BoxGeometry(0.06, 0.2, 0.06, 2, 2, 2);
    const spoilerWingGeo = new THREE.BoxGeometry(0.95, 0.05, 0.2, 6, 2, 3);
    const spoilerLeft = new THREE.Mesh(spoilerBaseGeo, trimMat);
    spoilerLeft.position.set(-0.3, 0.86, 0.97);
    spoilerLeft.castShadow = true;
    carGroup.add(spoilerLeft);
    const spoilerRight = new THREE.Mesh(spoilerBaseGeo, trimMat);
    spoilerRight.position.set(0.3, 0.86, 0.97);
    spoilerRight.castShadow = true;
    carGroup.add(spoilerRight);
    const spoilerWing = new THREE.Mesh(spoilerWingGeo, trimMat);
    spoilerWing.position.set(0, 0.96, 0.99);
    spoilerWing.castShadow = true;
    carGroup.add(spoilerWing);

    const exhaustGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.18, 18, 1);
    const exhaustL = new THREE.Mesh(exhaustGeo, trimMat);
    exhaustL.rotation.x = Math.PI / 2;
    exhaustL.position.set(-0.23, 0.2, 1.2);
    exhaustL.castShadow = true;
    carGroup.add(exhaustL);
    const exhaustR = new THREE.Mesh(exhaustGeo, trimMat);
    exhaustR.rotation.x = Math.PI / 2;
    exhaustR.position.set(0.23, 0.2, 1.2);
    exhaustR.castShadow = true;
    carGroup.add(exhaustR);

    const grilleMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.55, metalness: 0.4 });
    const grilleSlatGeo = new THREE.BoxGeometry(0.95, 0.02, 0.02, 4, 1, 1);
    for (let i = 0; i < 6; i++) {
        const slat = new THREE.Mesh(grilleSlatGeo, grilleMat);
        slat.position.set(0, 0.39 + i * 0.03, -1.16);
        slat.castShadow = true;
        carGroup.add(slat);
    }

    const roofAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 10, 1), trimMat);
    roofAntenna.position.set(0.12, 1.04, 0.1);
    roofAntenna.castShadow = true;
    carGroup.add(roofAntenna);
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), rimMat);
    antennaTip.position.set(0.12, 1.16, 0.1);
    antennaTip.castShadow = true;
    carGroup.add(antennaTip);

    return carGroup;
}

function createWreckedCar() {
    const wreckColors = [0x5c5c5c, 0x4a2f2f, 0x3a3d52, 0x4f3d2c];
    const carGroup = createCar(wreckColors[Math.floor(Math.random() * wreckColors.length)]);

    // Aspecto de choque: inclinaciÃ³n, piezas oscuras y "humo" estÃ¡tico.
    carGroup.rotation.set(
        (Math.random() - 0.5) * 0.18,
        (Math.random() - 0.5) * 0.9,
        (Math.random() - 0.5) * 0.15
    );

    const dentGeo = new THREE.BoxGeometry(0.5, 0.15, 0.2);
    const dentMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 1 });

    for (let i = 0; i < 3; i++) {
        const dent = new THREE.Mesh(dentGeo, dentMat);
        dent.position.set((Math.random() - 0.5) * 1.0, 0.45 + Math.random() * 0.25, (Math.random() - 0.5) * 1.8);
        dent.rotation.set(Math.random(), Math.random(), Math.random());
        carGroup.add(dent);
    }

    return carGroup;
}

const skidParticles = [];
const skidParticleGeo = new THREE.SphereGeometry(0.08, 6, 6);
const skidParticleMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.9 });
const speedLines = [];
const speedLineGeo = new THREE.BoxGeometry(0.04, 0.04, 1.7);
const speedLineMat = new THREE.MeshBasicMaterial({ color: 0xdbe9ff, transparent: true, opacity: 0.35 });
let speedLineSpawnAccumulator = 0;

function spawnSpeedLine(playerRoadCenter, speedNorm) {
    const line = new THREE.Mesh(speedLineGeo, speedLineMat.clone());
    const lateral = (Math.random() - 0.5) * 16;
    line.position.set(
        playerRoadCenter + lateral,
        0.6 + Math.random() * 4.6,
        -48 - Math.random() * 34
    );
    const scaleBoost = 1 + speedNorm * 1.4;
    line.scale.set(1, 1, scaleBoost);
    line.userData.vz = 0.6 + Math.random() * 1.8 + speedNorm * 2.4;
    line.userData.life = 0.28 + Math.random() * 0.3;
    line.userData.vx = lateral * -0.002;
    line.material.opacity = 0.18 + speedNorm * 0.35;
    scene.add(line);
    speedLines.push(line);
}

function spawnSkidParticles(direction) {
    for (let i = 0; i < 14; i++) {
        const particle = new THREE.Mesh(skidParticleGeo, skidParticleMat.clone());
        particle.position.set(
            player.position.x + direction * (0.2 + Math.random() * 0.4),
            0.25 + Math.random() * 0.2,
            player.position.z + 0.5 + (Math.random() - 0.5) * 0.8
        );
        particle.userData.vx = direction * (0.01 + Math.random() * 0.02);
        particle.userData.vy = 0.01 + Math.random() * 0.02;
        particle.userData.vz = 0.02 + Math.random() * 0.04;
        particle.userData.life = 0.45 + Math.random() * 0.25;
        scene.add(particle);
        skidParticles.push(particle);
    }
}

let audioCtx = null;

function ensureAudioContext() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function playSkidSound() {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const duration = 0.16;
    const now = ctx.currentTime;

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < output.length; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.45;
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800;
    band.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(band);
    band.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + duration);
}

// Jugador
let player = createCar(0xff0000);
scene.add(player);

let targetLane = 0;          // carril objetivo (-3, 0, 3)
let currentLane = 0;         // posiciÃ³n actual interpolada
let currentLaneVel = 0;      // velocidad lateral para animaciÃ³n suave
let lanePositions = [-3, 0, 3];

let enemies = [];
let score = 0;
let speed = 0.5;
let isGameOver = true;
const cheatState = { immortal: false };
let cheatBuffer = "";
let elapsedGameTime = 0;
let worldDistance = 0;
let currentDifficulty = 1;
let enemySpawnTimer = 0;
let treeSpawnTimer = 0;
let propSpawnTimer = 0;
const baseSpeed = 0.5;
const minEnemySpawnInterval = 0.25;
const maxEnemySpawnInterval = 1.4;
const treeSpawnInterval = 0.2;
const propSpawnInterval = 0.55;
const baseTrackDifficulty = 0.45; // Intensidad base de la pista
const maxTrackDifficulty = 2.35; // Tope para evitar curvas absurdas
const difficultyGrowthPerSecond = 0.02; // +1x cada 50s aprox
const maxDifficultyMultiplier = 6.0;

function updateCheatStatusUI() {
    const el = document.getElementById("cheat-status");
    if (!el) return;
    el.textContent = cheatState.immortal ? "INMORTALIDAD" : "OFF";
    el.style.color = cheatState.immortal ? "#66ff66" : "#ffffff";
}

function toggleImmortality() {
    cheatState.immortal = !cheatState.immortal;
    updateCheatStatusUI();
}

function handleCheatInput(key) {
    if (key.length !== 1) return;
    cheatBuffer = (cheatBuffer + key.toLowerCase()).slice(-24);
    if (cheatBuffer.includes("inmortal")) {
        toggleImmortality();
        cheatBuffer = "";
    }
}

function getDifficultyMultiplier() {
    // Crecimiento lineal controlado (sin escalada exponencial).
    return Math.min(maxDifficultyMultiplier, 1 + elapsedGameTime * difficultyGrowthPerSecond);
}

function getEnemySpawnInterval() {
    const interval = maxEnemySpawnInterval / Math.pow(currentDifficulty, 0.85);
    return THREE.MathUtils.clamp(interval, minEnemySpawnInterval, maxEnemySpawnInterval);
}

function getRoadCenterAtZ(z) {
    const trackDifficulty = THREE.MathUtils.clamp(currentDifficulty + baseTrackDifficulty, 1, maxTrackDifficulty);
    const curveAmp = 0.75 + (trackDifficulty - 1) * 0.82;
    const d = worldDistance - z * 0.9;
    return Math.sin(d * 0.035) * curveAmp + Math.sin(d * 0.013 + 1.4) * curveAmp * 0.6;
}

function getRoadHeightAtZ(z) {
    const trackDifficulty = THREE.MathUtils.clamp(currentDifficulty + baseTrackDifficulty, 1, maxTrackDifficulty);
    const hillAmp = 0.06 + (trackDifficulty - 1) * 0.12;
    const d = worldDistance - z;
    return Math.sin(d * 0.022) * hillAmp + Math.sin(d * 0.009 + 2.2) * hillAmp * 0.8;
}

function getRoadBankAtZ(z) {
    const x1 = getRoadCenterAtZ(z + 2);
    const x0 = getRoadCenterAtZ(z - 2);
    return THREE.MathUtils.clamp((x1 - x0) * 0.18, -0.14, 0.14);
}

function getRoadPitchAtZ(z) {
    const y1 = getRoadHeightAtZ(z + 2);
    const y0 = getRoadHeightAtZ(z - 2);
    return THREE.MathUtils.clamp((y1 - y0) * 0.3, -0.1, 0.1);
}

function spawnEnemy() {
    if (isGameOver) return;
    let wreckedCar = createWreckedCar();
    const lane = lanePositions[Math.floor(Math.random() * lanePositions.length)];
    const spawnZ = -85;
    wreckedCar.userData.lane = lane;
    wreckedCar.userData.baseRotX = wreckedCar.rotation.x;
    wreckedCar.userData.baseRotY = wreckedCar.rotation.y;
    wreckedCar.userData.baseRotZ = wreckedCar.rotation.z;
    wreckedCar.position.set(
        lane + getRoadCenterAtZ(spawnZ),
        getRoadHeightAtZ(spawnZ),
        spawnZ
    );
    scene.add(wreckedCar);
    enemies.push(wreckedCar);
}

function startGame() {
    isGameOver = false;
    clock = new THREE.Clock(); // Resetear reloj para evitar saltos temporales
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("game-over-screen").style.display = "none";
    score = 0;
    speed = baseSpeed;
    elapsedGameTime = 0;
    worldDistance = 0;
    currentDifficulty = 1;
    enemySpawnTimer = 0.2;
    treeSpawnTimer = 0.05;
    propSpawnTimer = 0.25;
    document.getElementById("score").textContent = score;
    document.getElementById("difficulty").textContent = "1.00x";
    updateCheatStatusUI();

    // Limpiar enemigos y Ã¡rboles existentes
    enemies.forEach(e => scene.remove(e));
    enemies = [];
    trees.forEach(t => scene.remove(t));
    trees = [];
    mapProps.forEach(p => scene.remove(p));
    mapProps.length = 0;
    skidParticles.forEach(p => scene.remove(p));
    skidParticles.length = 0;
    speedLines.forEach(s => scene.remove(s));
    speedLines.length = 0;
    speedLineSpawnAccumulator = 0;

    for (let i = 0; i < 34; i++) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const offset = 6.8 + Math.random() * 12.5;
        const z = -20 - Math.random() * 130;
        const tree = new THREE.Sprite(treeMat);
        tree.scale.set(4, 4, 1);
        tree.userData.side = side;
        tree.userData.offset = offset;
        tree.position.set(getRoadCenterAtZ(z) + side * offset, getRoadHeightAtZ(z) + 2, z);
        tree.center.set(0.5, 0.0);
        scene.add(tree);
        trees.push(tree);
    }

    for (let i = 0; i < 26; i++) {
        spawnMapProp(-22 - Math.random() * 145);
    }

    for (let i = 0; i < roadsideCliffs.length; i++) {
        const band = Math.floor(i / 2);
        resetRoadsideCliffSegment(roadsideCliffs[i], -24 - band * 18 - Math.random() * 12);
    }

    // Reiniciar posiciÃ³n jugador
    player.position.set(0, getRoadHeightAtZ(5), 5);
    targetLane = 0;
    currentLane = 0;
    currentLaneVel = 0;
    camera.position.set(0, 5, 10);
    camera.rotation.set(0, 0, 0);

    // Reiniciar loop si es necesario (evitar duplicados)
    // En este diseÃ±o simple, el requestAnimationFrame sigue corriendo pero podemos filtrar update
}

function stopGame() {
    isGameOver = true;
    document.getElementById("game-over-screen").style.display = "flex";
    document.getElementById("final-score").textContent = score;
}

function update() {
    requestAnimationFrame(update);
    let dt = clock.getDelta();
    updateSun(dt);
    if (isGameOver) {
        composer.render();
        return;
    }

    elapsedGameTime += dt;
    currentDifficulty = getDifficultyMultiplier();
    speed = baseSpeed + 0.08 * (currentDifficulty - 1);
    document.getElementById("difficulty").textContent = `${currentDifficulty.toFixed(2)}x`;
    const speedNorm = THREE.MathUtils.clamp((speed - baseSpeed) / 2.8, 0, 1);
    const frameScale = dt * 60;
    const movementStep = speed * frameScale;
    worldDistance += movementStep;

    const targetFov = THREE.MathUtils.lerp(baseCameraFov, maxCameraFov, speedNorm);
    camera.fov += (targetFov - camera.fov) * 0.08;
    camera.updateProjectionMatrix();

    enemySpawnTimer -= dt;
    while (enemySpawnTimer <= 0) {
        spawnEnemy();
        enemySpawnTimer += getEnemySpawnInterval();
    }

    treeSpawnTimer -= dt;
    while (treeSpawnTimer <= 0) {
        spawnTree();
        treeSpawnTimer += treeSpawnInterval;
    }

    propSpawnTimer -= dt;
    while (propSpawnTimer <= 0) {
        spawnMapProp();
        propSpawnTimer += propSpawnInterval;
    }

    const roadVisualZ = -35;
    const roadVisualCenter = getRoadCenterAtZ(roadVisualZ) * 0.85;
    const roadVisualBank = getRoadBankAtZ(roadVisualZ);
    const roadVisualPitch = getRoadPitchAtZ(roadVisualZ);

    road.position.x = roadVisualCenter;
    leftLine.position.x = roadVisualCenter - 5;
    rightLine.position.x = roadVisualCenter + 5;
    centerLineLeft.position.x = roadVisualCenter - 1.66;
    centerLineRight.position.x = roadVisualCenter + 1.66;

    road.rotation.x = -Math.PI / 2 + roadVisualPitch * 0.2;
    leftLine.rotation.x = -Math.PI / 2 + roadVisualPitch * 0.2;
    rightLine.rotation.x = -Math.PI / 2 + roadVisualPitch * 0.2;
    centerLineLeft.rotation.x = -Math.PI / 2 + roadVisualPitch * 0.2;
    centerLineRight.rotation.x = -Math.PI / 2 + roadVisualPitch * 0.2;

    road.rotation.z = -roadVisualBank * 0.9;
    leftLine.rotation.z = -roadVisualBank * 0.9;
    rightLine.rotation.z = -roadVisualBank * 0.9;
    centerLineLeft.rotation.z = -roadVisualBank * 0.9;
    centerLineRight.rotation.z = -roadVisualBank * 0.9;

    // Movimiento de texturas para reforzar sensaciÃ³n de velocidad
    if (roadMat.map) roadMat.map.offset.y += movementStep * 0.1;
    dashTex.offset.y += movementStep * 0.1; // Mover las lÃ­neas discontinuas tambiÃ©n

    // Mover textura del cÃ©sped para sensaciÃ³n de velocidad
    if (grassMat.map) grassMat.map.offset.y += movementStep * 0.1;

    // Animacion lateral tipo resorte (acelera/frena suave)
    const laneDelta = targetLane - currentLane;
    const laneAccel = laneDelta * 36 - currentLaneVel * 10.5;
    currentLaneVel += laneAccel * dt;
    currentLane += currentLaneVel * dt;
    currentLane = THREE.MathUtils.clamp(currentLane, lanePositions[0], lanePositions[lanePositions.length - 1]);
    if (Math.abs(laneDelta) < 0.03 && Math.abs(currentLaneVel) < 0.08) {
        currentLane = targetLane;
        currentLaneVel = 0;
    }
    const playerRoadCenter = getRoadCenterAtZ(player.position.z);
    const playerRoadHeight = getRoadHeightAtZ(player.position.z);
    const playerRoadBank = getRoadBankAtZ(player.position.z);
    const playerRoadPitch = getRoadPitchAtZ(player.position.z);
    player.position.x = currentLane + playerRoadCenter;
    player.position.y = playerRoadHeight;
    player.rotation.x = playerRoadPitch * 0.8 + Math.min(0.06, Math.abs(currentLaneVel) * 0.03);

    // Inclinacion y guiÃ±ada segun velocidad lateral
    const lateralLean = THREE.MathUtils.clamp(-currentLaneVel * 0.32 - laneDelta * 0.16, -0.52, 0.52);
    player.rotation.z = lateralLean - playerRoadBank * 0.9;
    player.rotation.y = THREE.MathUtils.clamp(-currentLaneVel * 0.12, -0.26, 0.26);

    const camTargetX = getRoadCenterAtZ(8) * 0.75;
    const camTargetY = 5 + getRoadHeightAtZ(8) * 1.2;
    const camRoll = -getRoadBankAtZ(8) * 0.35;
    const speedShake = speedNorm * 0.08;
    camera.position.x += (camTargetX - camera.position.x) * 0.06;
    camera.position.y += (camTargetY + Math.sin(elapsedGameTime * 20) * speedShake - camera.position.y) * 0.06;
    camera.rotation.z += (camRoll - camera.rotation.z) * 0.05;
    camera.lookAt(getRoadCenterAtZ(-12) * 0.8, getRoadHeightAtZ(-12) + 0.6, -8);

    speedLineSpawnAccumulator += dt * (1 + speedNorm * 50);
    const playerRoadCenterNow = getRoadCenterAtZ(player.position.z);
    while (speedLineSpawnAccumulator >= 1) {
        spawnSpeedLine(playerRoadCenterNow, speedNorm);
        speedLineSpawnAccumulator -= 1;
    }

    for (let i = skidParticles.length - 1; i >= 0; i--) {
        const particle = skidParticles[i];
        particle.position.x += particle.userData.vx;
        particle.position.y += particle.userData.vy;
        particle.position.z += movementStep + particle.userData.vz;
        particle.userData.life -= dt;
        particle.material.opacity = Math.max(0, particle.userData.life * 2);

        if (particle.userData.life <= 0 || particle.position.z > 20) {
            scene.remove(particle);
            skidParticles.splice(i, 1);
        }
    }

    for (let i = speedLines.length - 1; i >= 0; i--) {
        const line = speedLines[i];
        line.position.x += line.userData.vx;
        line.position.z += movementStep + line.userData.vz;
        line.userData.life -= dt;
        line.material.opacity = Math.max(0, line.userData.life * 1.6);
        if (line.userData.life <= 0 || line.position.z > 22) {
            scene.remove(line);
            speedLines.splice(i, 1);
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const car = enemies[i];
        car.position.z += movementStep;
        car.position.x = car.userData.lane + getRoadCenterAtZ(car.position.z);
        car.position.y = getRoadHeightAtZ(car.position.z);
        car.rotation.x = car.userData.baseRotX + getRoadPitchAtZ(car.position.z) * 0.6;
        car.rotation.y = car.userData.baseRotY;
        car.rotation.z = car.userData.baseRotZ - getRoadBankAtZ(car.position.z) * 0.7;

        if (car.position.distanceTo(player.position) < 1.8) {
            if (cheatState.immortal) {
                scene.remove(car);
                enemies.splice(i, 1);
                score++;
                document.getElementById("score").textContent = score;
                continue;
            }
            stopGame();
        }
        // Resetear enemigos si salen del mapa
        if (car.position.z > 20) {
            scene.remove(car);
            enemies.splice(i, 1);
            score++;
            document.getElementById("score").textContent = score;
        }
    }

    // Mover y limpiar Ã¡rboles
    for (let i = trees.length - 1; i >= 0; i--) {
        const tree = trees[i];
        tree.position.z += movementStep; // Misma velocidad que la carretera
        const side = tree.userData.side ?? (Math.random() > 0.5 ? 1 : -1);
        const offset = tree.userData.offset ?? (6.8 + Math.random() * 12.5);
        tree.position.x = getRoadCenterAtZ(tree.position.z) + side * offset;
        tree.position.y = getRoadHeightAtZ(tree.position.z) + 2;
        if (tree.position.z > 24) {
            scene.remove(tree);
            trees.splice(i, 1);
        }
    }

    for (let i = mapProps.length - 1; i >= 0; i--) {
        const prop = mapProps[i];
        prop.position.z += movementStep;
        const side = prop.userData.side ?? 1;
        const offset = prop.userData.offset ?? 10;
        const baseY = prop.userData.baseY ?? 0;
        const kind = prop.userData.kind ?? "rock";
        const bank = getRoadBankAtZ(prop.position.z);
        prop.position.x = getRoadCenterAtZ(prop.position.z) + side * offset;
        prop.position.y = getRoadHeightAtZ(prop.position.z) + baseY;
        prop.rotation.y += prop.userData.spin ?? 0;
        prop.rotation.z = -bank * (kind === "giant_rock" ? 0.12 : 0.25);
        if (prop.position.z > 22) {
            scene.remove(prop);
            mapProps.splice(i, 1);
        }
    }

    for (let i = 0; i < roadsideCliffs.length; i++) {
        const cliff = roadsideCliffs[i];
        cliff.position.z += movementStep;
        if (cliff.position.z > 38) {
            resetRoadsideCliffSegment(cliff, -340 - Math.random() * 120);
        }

        const side = cliff.userData.side ?? 1;
        const offset = cliff.userData.offset ?? 34;
        const baseY = cliff.userData.baseY ?? 7;
        const bank = getRoadBankAtZ(cliff.position.z);
        cliff.position.x = getRoadCenterAtZ(cliff.position.z) + side * offset;
        cliff.position.y = getRoadHeightAtZ(cliff.position.z) + baseY;
        cliff.rotation.y += cliff.userData.spin ?? 0;
        cliff.rotation.z = -bank * 0.42 + side * 0.03;
    }

    composer.render();
}

// Render inicial para mostrar la escena
initPostProcessing();
composer.render();

// Hacer funciones globales para que el HTML pueda acceder a ellas (al usar mÃ³dulos)
window.startGame = startGame;
window.moveLeft = moveLeft;
window.moveRight = moveRight;

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("restart-btn").addEventListener("click", startGame);

// Cambio de carril
function moveLeft() {
    let i = lanePositions.indexOf(targetLane);
    if (i > 0) {
        targetLane = lanePositions[i - 1];
        currentLaneVel -= 0.9;
        playSkidSound();
        spawnSkidParticles(-1);
    }
}

function moveRight() {
    let i = lanePositions.indexOf(targetLane);
    if (i < lanePositions.length - 1) {
        targetLane = lanePositions[i + 1];
        currentLaneVel += 0.9;
        playSkidSound();
        spawnSkidParticles(1);
    }
}

document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") moveLeft();
    if (e.key === "ArrowRight") moveRight();
    if (e.key === "F8") toggleImmortality();
    handleCheatInput(e.key);
});

const leftBtn = document.getElementById("left");
const rightBtn = document.getElementById("right");

function bindControlButton(button, moveFn) {
    button.addEventListener("touchstart", (event) => {
        // Evita el "doble tap" sintÃ©tico (touch + mouse/click) en Android.
        event.preventDefault();
        moveFn();
    }, { passive: false });

    button.addEventListener("mousedown", moveFn);
}

bindControlButton(leftBtn, moveLeft);
bindControlButton(rightBtn, moveRight);

const graphicsSlider = document.getElementById("graphics-slider");
if (graphicsSlider) {
    graphicsSlider.value = String(graphicsQuality);
    updateGraphicsLabel(graphicsQuality);
    graphicsSlider.addEventListener("input", () => {
        const level = Number(graphicsSlider.value);
        applyGraphicsQuality(level);
        const w = window.innerWidth;
        const h = window.innerHeight;
        const px = renderer.getPixelRatio();
        if (composer) composer.setSize(w, h);
        if (ssaoPass) ssaoPass.setSize(w, h);
        if (bloomPass) bloomPass.setSize(w, h);
        if (fxaaPass) fxaaPass.material.uniforms['resolution'].value.set(1 / (w * px), 1 / (h * px));
    });
}

window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const px = renderer.getPixelRatio();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
    if (ssaoPass) ssaoPass.setSize(w, h);
    if (bloomPass) bloomPass.setSize(w, h);
    if (fxaaPass) fxaaPass.material.uniforms['resolution'].value.set(1 / (w * px), 1 / (h * px));
    applyGraphicsQuality(graphicsQuality);
});

// Iniciar bucle de renderizado (se mantendrÃ¡ en 'isGameOver=true' hasta pulsar JUGAR)
update();



