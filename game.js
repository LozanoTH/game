import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene = new THREE.Scene();
// scene.fog se gestiona en updateSun ahora

let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

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

// Permitir que el cielo actúe como mapa de reflexión ambiental (RTX feel)
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

// Configuración de Sombras de "Alta Calidad" (RTX feel)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Sombras suaves
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;

// Luz Hemisférica para colores más naturales
const hemiLight = new THREE.HemisphereLight(0x88aabb, 0x443333, 0.6);
scene.add(hemiLight);

// Variables de tiempo
let time = 0;
const dayDuration = 240;
let clock = new THREE.Clock();

function updateSun(dt) {
    // Rotar el cielo lentamente
    sky.rotation.y += dt * 0.05;
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
    roughness: 0.8,
    metalness: 0.2
});
const road = new THREE.Mesh(roadGeo, roadMat);
road.rotation.x = -Math.PI / 2;
scene.add(road);

// Líneas laterales (Geometría separada)
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

// Líneas centrales (Amarillas discontinuas)
const centerLineGeo = new THREE.PlaneGeometry(0.3, 400);
const centerLineMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });

// Para hacerlas discontinuas usamos un truco de textura alpha o geometría múltiple.
// Por simplicidad/rendimiento, usaremos una textura procedural simple para la línea central transparente
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


// Césped lateral (Textura mejorada)
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
    tex.repeat.set(50, 50); // Mucha repetición para detalle
    return tex;
}

const grassTex = createGrassTexture();
const grassMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    roughness: 1,
    metalness: 0
});

// Plano de suelo infinito (simulado)
const groundGeo = new THREE.PlaneGeometry(500, 500);
const ground = new THREE.Mesh(groundGeo, grassMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1; // Justo debajo de la carretera
scene.add(ground);

// --- MONTAÑAS ---
function createMountain(x, z, scale) {
    const geo = new THREE.ConeGeometry(scale, scale * 1.5, 4); // Pirámides low poly
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
    // Montañas izquierda lejana
    createMountain(-80 - Math.random() * 100, -100 - Math.random() * 100, 30 + Math.random() * 50);
    // Montañas derecha lejana
    createMountain(80 + Math.random() * 100, -100 - Math.random() * 100, 30 + Math.random() * 50);
}

// --- ÁRBOLES ---
function createTreeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Tronco
    ctx.fillStyle = '#4d3319';
    ctx.fillRect(56, 90, 16, 38);

    // Hojas (Triángulos superpuestos para estilo pino)
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
    let offset = 8 + Math.random() * 15; // Distancia desde la carretera

    let tree = new THREE.Sprite(treeMat);
    tree.scale.set(4, 4, 1);
    tree.position.set(side * offset, 2, -100);
    tree.center.set(0.5, 0.0); // Anclar árbol al suelo desde su base
    scene.add(tree);
    trees.push(tree);
}

// Generar árboles iniciales
for (let i = 0; i < 20; i++) {
    let side = Math.random() > 0.5 ? 1 : -1;
    let offset = 8 + Math.random() * 15;
    let tree = new THREE.Sprite(treeMat);
    tree.scale.set(4, 4, 1);
    tree.position.set(side * offset, 2, -100 + i * 10); // Distribuir a lo largo
    tree.center.set(0.5, 0.0); // Anclar base
    scene.add(tree);
    trees.push(tree);
}

// --- MODELADO DE COCHES 3D CON ACABADO PREMIUM (RTX) ---
function createCar(color) {
    const carGroup = new THREE.Group();

    // Chasis con Pintura Metalizada (MeshPhysicalMaterial)
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.5, 2.2);
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
    const cabinGeo = new THREE.BoxGeometry(0.9, 0.4, 1.0);
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
    const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });

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
    });

    // Luces con emisión de luz (Glow)
    const lightGeo = new THREE.BoxGeometry(0.3, 0.15, 0.1);
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

    return carGroup;
}

function createWreckedCar() {
    const wreckColors = [0x5c5c5c, 0x4a2f2f, 0x3a3d52, 0x4f3d2c];
    const carGroup = createCar(wreckColors[Math.floor(Math.random() * wreckColors.length)]);

    // Aspecto de choque: inclinación, piezas oscuras y "humo" estático.
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
const skidMarks = [];
const skidParticleGeo = new THREE.SphereGeometry(0.08, 6, 6);
const skidParticleMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.9 });
const skidMarkGeo = new THREE.PlaneGeometry(0.18, 1.1);
const skidMarkMat = new THREE.MeshBasicMaterial({ color: 0x101010, transparent: true, opacity: 0.35 });

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

function spawnSkidMarks() {
    for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const mark = new THREE.Mesh(skidMarkGeo, skidMarkMat.clone());
        mark.rotation.x = -Math.PI / 2;
        mark.rotation.z = (Math.random() - 0.5) * 0.2;
        mark.position.set(player.position.x + side * 0.42, 0.021, player.position.z + 0.2 + Math.random() * 0.4);
        mark.userData.life = 1.2;
        scene.add(mark);
        skidMarks.push(mark);
    }
}

let audioCtx = null;
let lastSkidTime = 0;

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
    const nowMs = performance.now();
    if (nowMs - lastSkidTime < 90) return;
    lastSkidTime = nowMs;

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
let currentLane = 0;         // posición actual interpolada
let lanePositions = [-3, 0, 3];

let enemies = [];
let score = 0;
let speed = 0.5;
let isGameOver = true;

function spawnEnemy() {
    if (isGameOver) return;
    let wreckedCar = createWreckedCar();
    wreckedCar.position.set(lanePositions[Math.floor(Math.random() * 3)], 0.0, -80);
    scene.add(wreckedCar);
    enemies.push(wreckedCar);
}

function startGame() {
    isGameOver = false;
    clock = new THREE.Clock(); // Resetear reloj para evitar saltos temporales
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("game-over-screen").style.display = "none";
    score = 0;
    speed = 0.5;
    document.getElementById("score").textContent = score;

    // Limpiar enemigos y árboles existentes
    enemies.forEach(e => scene.remove(e));
    enemies = [];
    trees.forEach(t => scene.remove(t));
    trees = [];
    skidParticles.forEach(p => scene.remove(p));
    skidParticles.length = 0;
    skidMarks.forEach(m => scene.remove(m));
    skidMarks.length = 0;

    // Reiniciar posición jugador
    player.position.set(0, 0.0, 5);
    targetLane = 0;
    currentLane = 0;

    // Reiniciar loop si es necesario (evitar duplicados)
    // En este diseño simple, el requestAnimationFrame sigue corriendo pero podemos filtrar update
}

function stopGame() {
    isGameOver = true;
    document.getElementById("game-over-screen").style.display = "flex";
    document.getElementById("final-score").textContent = score;
}

// Inicializar loops de spawneo (se ejecutan siempre pero chequean isGameOver)
setInterval(spawnEnemy, 1500);
setInterval(spawnTree, 500);

function update() {
    requestAnimationFrame(update);
    if (isGameOver) return;

    let dt = clock.getDelta();
    updateSun(dt);

    // Movimiento de la textura de la carretera para simular velocidad
    if (roadMat.map) roadMat.map.offset.y += speed * 0.1;
    dashTex.offset.y += speed * 0.1; // Mover las líneas discontinuas también

    // Mover textura del césped para sensación de velocidad
    if (grassMat.map) grassMat.map.offset.y += speed * 0.1;

    // Animación lateral suave
    currentLane += (targetLane - currentLane) * 0.15;
    player.position.x = currentLane;

    // Pequeña inclinación visual al girar
    player.rotation.z = -(targetLane - currentLane) * 0.5;

    for (let i = skidParticles.length - 1; i >= 0; i--) {
        const particle = skidParticles[i];
        particle.position.x += particle.userData.vx;
        particle.position.y += particle.userData.vy;
        particle.position.z += speed + particle.userData.vz;
        particle.userData.life -= dt;
        particle.material.opacity = Math.max(0, particle.userData.life * 2);

        if (particle.userData.life <= 0 || particle.position.z > 20) {
            scene.remove(particle);
            skidParticles.splice(i, 1);
        }
    }

    for (let i = skidMarks.length - 1; i >= 0; i--) {
        const mark = skidMarks[i];
        mark.position.z += speed;
        mark.userData.life -= dt;
        mark.material.opacity = Math.max(0, mark.userData.life * 0.3);

        if (mark.userData.life <= 0 || mark.position.z > 20) {
            scene.remove(mark);
            skidMarks.splice(i, 1);
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const car = enemies[i];
        car.position.z += speed;

        if (car.position.distanceTo(player.position) < 1.8) {
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

    // Mover y limpiar árboles
    for (let i = trees.length - 1; i >= 0; i--) {
        const tree = trees[i];
        tree.position.z += speed; // Misma velocidad que la carretera
        if (tree.position.z > 20) {
            scene.remove(tree);
            trees.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
}

// Render inicial para mostrar la escena
renderer.render(scene, camera);

// Hacer funciones globales para que el HTML pueda acceder a ellas (al usar módulos)
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
        playSkidSound();
        spawnSkidParticles(-1);
        spawnSkidMarks();
    }
}

function moveRight() {
    let i = lanePositions.indexOf(targetLane);
    if (i < lanePositions.length - 1) {
        targetLane = lanePositions[i + 1];
        playSkidSound();
        spawnSkidParticles(1);
        spawnSkidMarks();
    }
}

document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") moveLeft();
    if (e.key === "ArrowRight") moveRight();
});

function bindControlInput(elementId, action) {
    const el = document.getElementById(elementId);
    el.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        action();
    });
}

bindControlInput('left', moveLeft);
bindControlInput('right', moveRight);

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Iniciar bucle de renderizado (se mantendrá en 'isGameOver=true' hasta pulsar JUGAR)
update();
