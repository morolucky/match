// Renderer, camera, controls, ground, LevelLighting instance
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LevelLighting } from '../lighting/LevelLighting.js';
import { $ } from '../core/dom.js';

/* ================= scene + the uploaded LevelLighting stack ================= */
const V = $('v'); let W0 = Math.max(300, V.clientWidth), H0 = Math.max(300, V.clientHeight);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(W0, H0); V.prepend(renderer.domElement);
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, W0 / H0, 0.5, 2500); cam.position.set(30, 16, 40);
const ll = new LevelLighting(renderer, scene, cam, { shadowMap: 2048, aoMapSize: 1024 });
const oc = new OrbitControls(cam, renderer.domElement); oc.enableDamping = true; oc.maxPolarAngle = Math.PI * 0.495; oc.target.set(0, 8, 0);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.3, 0.28, 0.25), roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ll.level.add(ground);
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });

export { V, W0, H0, renderer, scene, cam, ll, oc, ground, mat };
