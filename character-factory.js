export function createCharacter(THREE) {
  const player = new THREE.Group();
  const parts = {};

  const skinMat = new THREE.MeshPhysicalMaterial({ color: 0xffd7b3, roughness: 0.58, metalness: 0.02, clearcoat: 0.2, clearcoatRoughness: 0.5 });
  const shirtMat = new THREE.MeshPhysicalMaterial({ color: 0x2f6fdd, roughness: 0.45, metalness: 0.1, clearcoat: 0.3, clearcoatRoughness: 0.35 });
  const pantMat = new THREE.MeshStandardMaterial({ color: 0x22334d, roughness: 0.75, metalness: 0.05 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x2d2218, roughness: 0.82 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.0, 20, 1), shirtMat);
  torso.position.y = 1.35;
  torso.castShadow = true;
  player.add(torso);

  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 18), shirtMat);
  pelvis.position.y = 0.82;
  pelvis.castShadow = true;
  player.add(pelvis);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.16, 18), skinMat);
  neck.position.y = 1.95;
  neck.castShadow = true;
  player.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 30, 22), skinMat);
  head.position.y = 2.25;
  head.castShadow = true;
  player.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.34, 30, 20, 0, Math.PI * 2, 0, Math.PI * 0.65), hairMat);
  hair.position.y = 2.35;
  hair.castShadow = true;
  player.add(hair);

  const eyeGeom = new THREE.SphereGeometry(0.04, 16, 14);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
  eyeL.position.set(-0.11, 2.28, 0.29);
  eyeR.position.set(0.11, 2.28, 0.29);
  player.add(eyeL, eyeR);

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0x8f4f40, roughness: 0.95 }));
  mouth.position.set(0, 2.14, 0.31);
  player.add(mouth);

  const upperLegGeom = new THREE.CylinderGeometry(0.13, 0.15, 0.55, 18);
  const lowerLegGeom = new THREE.CylinderGeometry(0.11, 0.12, 0.52, 18);
  const legUpperL = new THREE.Mesh(upperLegGeom, pantMat);
  const legUpperR = new THREE.Mesh(upperLegGeom, pantMat);
  const legLowerL = new THREE.Mesh(lowerLegGeom, pantMat);
  const legLowerR = new THREE.Mesh(lowerLegGeom, pantMat);
  legUpperL.position.set(-0.18, 0.53, 0);
  legUpperR.position.set(0.18, 0.53, 0);
  legLowerL.position.set(-0.18, 0.2, 0);
  legLowerR.position.set(0.18, 0.2, 0);
  legUpperL.castShadow = true;
  legUpperR.castShadow = true;
  legLowerL.castShadow = true;
  legLowerR.castShadow = true;
  player.add(legUpperL, legUpperR, legLowerL, legLowerR);

  const upperArmGeom = new THREE.CylinderGeometry(0.085, 0.095, 0.46, 16);
  const lowerArmGeom = new THREE.CylinderGeometry(0.07, 0.08, 0.42, 16);
  const armUpperL = new THREE.Mesh(upperArmGeom, shirtMat);
  const armUpperR = new THREE.Mesh(upperArmGeom, shirtMat);
  const armLowerL = new THREE.Mesh(lowerArmGeom, skinMat);
  const armLowerR = new THREE.Mesh(lowerArmGeom, skinMat);
  armUpperL.position.set(-0.5, 1.48, 0);
  armUpperR.position.set(0.5, 1.48, 0);
  armLowerL.position.set(-0.5, 1.1, 0);
  armLowerR.position.set(0.5, 1.1, 0);
  armUpperL.castShadow = true;
  armUpperR.castShadow = true;
  armLowerL.castShadow = true;
  armLowerR.castShadow = true;
  player.add(armUpperL, armUpperR, armLowerL, armLowerR);

  const handGeom = new THREE.SphereGeometry(0.09, 16, 14);
  const handL = new THREE.Mesh(handGeom, skinMat);
  const handR = new THREE.Mesh(handGeom, skinMat);
  handL.position.set(-0.5, 0.86, 0.02);
  handR.position.set(0.5, 0.86, 0.02);
  handL.castShadow = true;
  handR.castShadow = true;
  player.add(handL, handR);

  const shoeGeom = new THREE.BoxGeometry(0.24, 0.11, 0.4);
  const shoeL = new THREE.Mesh(shoeGeom, shoeMat);
  const shoeR = new THREE.Mesh(shoeGeom, shoeMat);
  shoeL.position.set(-0.18, 0.02, 0.07);
  shoeR.position.set(0.18, 0.02, 0.07);
  shoeL.castShadow = true;
  shoeR.castShadow = true;
  player.add(shoeL, shoeR);

  parts.legUpperL = legUpperL;
  parts.legUpperR = legUpperR;
  parts.legLowerL = legLowerL;
  parts.legLowerR = legLowerR;
  parts.armUpperL = armUpperL;
  parts.armUpperR = armUpperR;
  parts.armLowerL = armLowerL;
  parts.armLowerR = armLowerR;
  parts.torso = torso;

  return { group: player, parts };
}
