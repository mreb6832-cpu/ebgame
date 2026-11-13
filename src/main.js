
/* ==========================================
   EBGAME - 3D OPEN WORLD CAR SIMULATOR
   Engine: Three.js + Rapier Physics
========================================== */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/+esm";
import { setupPhoneController } from "./controller.js";

// ==========================================
// 1. GAME CONFIGURATION
// ==========================================

const CONFIG = {
    citySize: 500,
    roadWidth: 16,
    maxSpeed: 65,
    acceleration: 32,
    braking: 45,
    steering: 2.2
};

const canvas = document.getElementById("game-canvas");
const loadingScreen = document.getElementById("loading-screen");
const loadingProgress = document.getElementById("loading-progress");
const loadingText = document.getElementById("loading-text");

let scene;
let camera;
let renderer;
let world;
let carBody;
let carMesh;
let wheels = [];
let clock = new THREE.Clock();

let speed = 0;
let steering = 0;
let cameraMode = 0;
let paused = false;
let phoneConnected = false;

let phoneControls = {
    gas: false,
    brake: false,
    left: false,
    right: false,
    steering: 0,
    gear: "D"
};

const keys = {};

const touch = {
    left: false,
    right: false,
    gas: false,
    brake: false
};

// ==========================================
// 2. START GAME
// ==========================================

async function startGame() {
    try {
        loadingText.textContent = "Starting 3D engine...";
        loadingProgress.style.width = "15%";

        await RAPIER.init();

        loadingText.textContent = "Building your city...";
        loadingProgress.style.width = "30%";

        createScene();

        loadingProgress.style.width = "50%";

        createLighting();
        createGround();
        createCity();

        loadingProgress.style.width = "70%";

        createRoads();
        createCar();

        loadingProgress.style.width = "90%";

        setupControls();
        setupButtons();
        setupController();

        setupPhoneController(
            handlePhoneInput,
            handlePhoneStatus
        );

        loadingProgress.style.width = "100%";
        loadingText.textContent = "Ready! Enjoy EBGAME.";

        setTimeout(() => {
            loadingScreen.style.display = "none";
        }, 700);

        animate();

    } catch (error) {
        console.error("EBGAME startup error:", error);
        loadingText.textContent =
            "Game loading failed. Check your internet and refresh.";
    }
}

// ==========================================
// 3. THREE.JS SCENE
// ==========================================

function createScene() {
    scene = new THREE.Scene();

    scene.background = new THREE.Color(0x9bc7e8);
    scene.fog = new THREE.Fog(0x9bc7e8, 150, 480);

    camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    camera.position.set(0, 8, -14);

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: "high-performance"
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Physics world
    world = new RAPIER.World({
        x: 0,
        y: -9.81,
        z: 0
    });

    world.timestep = 1 / 60;
}

// ==========================================
// 4. LIGHTING
// ==========================================

function createLighting() {
    const ambient = new THREE.HemisphereLight(
        0xddeeff,
        0x52604b,
        2
    );

    scene.add(ambient);

    const sunlight = new THREE.DirectionalLight(
        0xffffff,
        3
    );

    sunlight.position.set(100, 150, 80);
    sunlight.castShadow = true;

    sunlight.shadow.mapSize.width = 2048;
    sunlight.shadow.mapSize.height = 2048;

    sunlight.shadow.camera.left = -150;
    sunlight.shadow.camera.right = 150;
    sunlight.shadow.camera.top = 150;
    sunlight.shadow.camera.bottom = -150;

    scene.add(sunlight);
}

// ==========================================
// 5. GROUND
// ==========================================

function createGround() {
    const groundGeometry = new THREE.PlaneGeometry(
        CONFIG.citySize,
        CONFIG.citySize
    );

    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x53664d,
        roughness: 1
    });

    const ground = new THREE.Mesh(
        groundGeometry,
        groundMaterial
    );

    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;

    scene.add(ground);

    // Static physics floor
    const floorBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
    );

    world.createCollider(
        RAPIER.ColliderDesc.cuboid(
            CONFIG.citySize / 2,
            0.2,
            CONFIG.citySize / 2
        ).setTranslation(0, -0.2, 0),
        floorBody
    );
}

// ==========================================
// 6. CITY BUILDINGS
// ==========================================

function createCity() {
    const buildingColors = [
        0x8a929d,
        0x687b8d,
        0xb4a99b,
        0x777f89,
        0x9da8b3,
        0x555f70
    ];

    for (let x = -220; x <= 220; x += 45) {
        for (let z = -220; z <= 220; z += 45) {

            // Keep roads clear
            if (
                Math.abs(x % 90) < 18 ||
                Math.abs(z % 90) < 18
            ) continue;

            const width = 15 + Math.random() * 12;
            const height = 12 + Math.random() * 65;
            const depth = 15 + Math.random() * 12;

            const geometry = new THREE.BoxGeometry(
                width,
                height,
                depth
            );

            const material = new THREE.MeshStandardMaterial({
                color: buildingColors[
                    Math.floor(Math.random() * buildingColors.length)
                ],
                roughness: 0.75,
                metalness: 0.1
            });

            const building = new THREE.Mesh(
                geometry,
                material
            );

            building.position.set(
                x + (Math.random() - 0.5) * 12,
                height / 2,
                z + (Math.random() - 0.5) * 12
            );

            building.castShadow = true;
            building.receiveShadow = true;

            scene.add(building);

            // Windows
            createWindows(building, width, height, depth);
        }
    }
}

function createWindows(building, width, height, depth) {
    const rows = Math.floor(height / 5);

    for (let y = 1; y < rows; y++) {
        for (
            let x = -width / 2 + 2;
            x < width / 2 - 1;
            x += 3
        ) {
            const windowMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(1.5, 2),
                new THREE.MeshStandardMaterial({
                    color: Math.random() > 0.5
                        ? 0x9ed8ed
                        : 0x253b50,
                    emissive: 0x162b40,
                    emissiveIntensity: 0.3
                })
            );

            windowMesh.position.set(
                building.position.x + x,
                y * 5,
                building.position.z + depth / 2 + 0.02
            );

            scene.add(windowMesh);
        }
    }
}

// ==========================================
// 7. ROADS
// ==========================================

function createRoads() {
    const roadMaterial = new THREE.MeshStandardMaterial({
        color: 0x292d33,
        roughness: 0.95
    });

    const lineMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff
    });

    for (let i = -225; i <= 225; i += 90) {

        // Horizontal road
        const road1 = new THREE.Mesh(
            new THREE.PlaneGeometry(
                CONFIG.citySize,
                CONFIG.roadWidth
            ),
            roadMaterial
        );

        road1.rotation.x = -Math.PI / 2;
        road1.position.set(0, 0.02, i);
        road1.receiveShadow = true;

        scene.add(road1);

        // Vertical road
        const road2 = new THREE.Mesh(
            new THREE.PlaneGeometry(
                CONFIG.roadWidth,
                CONFIG.citySize
            ),
            roadMaterial
        );

        road2.rotation.x = -Math.PI / 2;
        road2.position.set(i, 0.025, 0);
        road2.receiveShadow = true;

        scene.add(road2);

        // Road markings
        for (let p = -240; p <= 240; p += 18) {

            const mark1 = new THREE.Mesh(
                new THREE.PlaneGeometry(7, 0.25),
                lineMaterial
            );

            mark1.rotation.x = -Math.PI / 2;
            mark1.position.set(p, 0.04, i);
            scene.add(mark1);

            const mark2 = new THREE.Mesh(
                new THREE.PlaneGeometry(0.25, 7),
                lineMaterial
            );

            mark2.rotation.x = -Math.PI / 2;
            mark2.position.set(i, 0.045, p);
            scene.add(mark2);
        }
    }
}
