
/* ==========================================
   EBGAME - 3D OPEN WORLD CAR SIMULATOR
   Engine: Three.js + Rapier Physics
========================================== */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/+esm";

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

        loadingProgress.style.width = "100%";
        loadingText.textContent = "Ready! Enjoy EBGAME.";

        setTimeout(() => {
            loadingScreen.style.display = "none";
        }, 700);

        animate();

    } catch (error) {
        console.error("EBGAME startup error:", error);
        loadingText.textContent = "Game loading failed. Check your internet and refresh.";
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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
        for (let x = -width / 2 + 2; x < width / 2 - 1; x += 3) {

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
            new THREE.PlaneGeometry(CONFIG.citySize, CONFIG.roadWidth),
            roadMaterial
        );

        road1.rotation.x = -Math.PI / 2;
        road1.position.set(0, 0.02, i);
        road1.receiveShadow = true;

        scene.add(road1);

        // Vertical road
        const road2 = new THREE.Mesh(
            new THREE.PlaneGeometry(CONFIG.roadWidth, CONFIG.citySize),
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

// ==========================================
// 8. PLAYER CAR
// ==========================================

function createCar() {
    const carGroup = new THREE.Group();

    // Main body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.65, 4.5),
        new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            metalness: 0.8,
            roughness: 0.25
        })
    );

    body.position.y = 0.85;
    body.castShadow = true;

    carGroup.add(body);

    // Cabin
    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.75, 0.75, 2.2),
        new THREE.MeshStandardMaterial({
            color: 0x182d3e,
            metalness: 0.5,
            roughness: 0.2
        })
    );

    cabin.position.set(0, 1.5, -0.25);
    cabin.castShadow = true;

    carGroup.add(cabin);

    // Front windshield
    const windshield = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 0.55, 0.08),
        new THREE.MeshStandardMaterial({
            color: 0x9ed8ed,
            metalness: 0.7,
            roughness: 0.15
        })
    );

    windshield.position.set(0, 1.53, 0.88);
    carGroup.add(windshield);

    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(
        0.43,
        0.43,
        0.32,
        24
    );

    const wheelMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.9
    });

    const positions = [
        [-1.12, 0.45, 1.45],
        [1.12, 0.45, 1.45],
        [-1.12, 0.45, -1.45],
        [1.12, 0.45, -1.45]
    ];

    positions.forEach(position => {
        const wheel = new THREE.Mesh(
            wheelGeometry,
            wheelMaterial
        );

        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(...position);

        wheel.castShadow = true;

        carGroup.add(wheel);
        wheels.push(wheel);
    });

    // Headlights
    for (const side of [-1, 1]) {
        const light = new THREE.PointLight(0xffffff, 1, 15);

        light.position.set(side * 0.7, 1, 2.2);

        carGroup.add(light);
    }

    carMesh = carGroup;
    scene.add(carMesh);

    // Rapier physics body
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, 2, 5)
        .setLinearDamping(0.8)
        .setAngularDamping(4)
        .setCanSleep(false)
        .setEnabledRotations(false, true, false, true);

    carBody = world.createRigidBody(bodyDesc);

    const collider = RAPIER.ColliderDesc.cuboid(
        1.05,
        0.55,
        2.15
    )
        .setMass(1100)
        .setFriction(1.2)
        .setRestitution(0.05);

    world.createCollider(collider, carBody);

    document.getElementById("vehicle-name").textContent =
        "EB SPORT CAR";
}

// ==========================================
// 9. KEYBOARD CONTROLS
// ==========================================

function setupControls() {
    window.addEventListener("keydown", event => {
        keys[event.code] = true;

        if (event.code === "Escape") {
            togglePause();
        }

        if (event.code === "KeyC") {
            changeCamera();
        }
    });

    window.addEventListener("keyup", event => {
        keys[event.code] = false;
    });

    // Mobile touch buttons
    bindTouch("steer-left", "left");
    bindTouch("steer-right", "right");
    bindTouch("accelerate-button", "gas");
    bindTouch("brake-button", "brake");

    window.addEventListener("resize", resizeGame);
}

function bindTouch(elementId, controlName) {
    const element = document.getElementById(elementId);

    if (!element) return;

    element.addEventListener("pointerdown", event => {
        event.preventDefault();
        touch[controlName] = true;
        element.setPointerCapture(event.pointerId);
    });

    const release = () => {
        touch[controlName] = false;
    };

    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("lostpointercapture", release);
}

// ==========================================
// 10. GAMEPAD CONTROLLER
// ==========================================

let controllerConnected = false;

function setupController() {
    window.addEventListener("gamepadconnected", () => {
        controllerConnected = true;
        updateControllerStatus();
    });

    window.addEventListener("gamepaddisconnected", () => {
        controllerConnected = false;
        updateControllerStatus();
    });
}

function getGamepadInput() {
    const pads = navigator.getGamepads
        ? navigator.getGamepads()
        : [];

    const pad = Array.from(pads).find(Boolean);

    if (!pad) {
        return {
            gas: false,
            brake: false,
            steer: 0
        };
    }

    return {
        gas: pad.buttons[7]?.value > 0.1,
        brake: pad.buttons[6]?.value > 0.1,
        steer: pad.axes[0] || 0
    };
}

function updateControllerStatus() {
    const status = document.getElementById("controller-status");

    status.textContent = controllerConnected
        ? "CONTROLLER: CONNECTED"
        : "CONTROLLER: NOT CONNECTED";
}

// ==========================================
// 11. CAR DRIVING
// ==========================================

function driveCar(delta) {
    if (paused || !carBody) return;

    const pad = getGamepadInput();

    const gas =
        keys["KeyW"] ||
        keys["ArrowUp"] ||
        touch.gas ||
        pad.gas;

    const brake =
        keys["KeyS"] ||
        keys["ArrowDown"] ||
        touch.brake ||
        pad.brake;

    let steer =
        (keys["KeyA"] || keys["ArrowLeft"] || touch.left ? -1 : 0) +
        (keys["KeyD"] || keys["ArrowRight"] || touch.right ? 1 : 0);

    if (Math.abs(pad.steer) > 0.12) {
        steer = pad.steer;
    }

    const rotation = carBody.rotation();
    const angle = new THREE.Quaternion(
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w
    );

    const forward = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(angle);

    const velocity = carBody.linvel();

    const horizontalSpeed = Math.sqrt(
        velocity.x * velocity.x +
        velocity.z * velocity.z
    );

    const signedSpeed = new THREE.Vector3(
        velocity.x,
        0,
        velocity.z
    ).dot(forward);

    if (gas) {
        const impulse = forward.clone().multiplyScalar(
            CONFIG.acceleration * delta * 1100
        );

        carBody.applyImpulse(
            { x: impulse.x, y: 0, z: impulse.z },
            true
        );
    }

    if (brake) {
        const brakingForce = forward.clone().multiplyScalar(
            -CONFIG.braking * delta * 1100 *
            (signedSpeed >= 0 ? 1 : -1)
        );

        carBody.applyImpulse(
            {
                x: brakingForce.x,
                y: 0,
                z: brakingForce.z
            },
            true
        );
    }

    // Steering
    if (horizontalSpeed > 0.5 && Math.abs(steer) > 0.01) {
        const direction = signedSpeed >= 0 ? -1 : 1;

        carBody.applyTorqueImpulse(
            {
                x: 0,
                y: steer * CONFIG.steering * delta *
                    Math.min(horizontalSpeed / 8, 2) * direction,
                z: 0
            },
            true
        );
    }

    // Speed limit
    const maxVelocity = CONFIG.maxSpeed / 3.6;

    if (horizontalSpeed > maxVelocity) {
        const factor = maxVelocity / horizontalSpeed;

        carBody.setLinvel(
            {
                x: velocity.x * factor,
                y: velocity.y,
                z: velocity.z * factor
            },
            true
        );
    }

    speed = Math.round(horizontalSpeed * 3.6);

    document.getElementById("speed-value").textContent =
        speed;

    document.getElementById("gear-value").textContent =
        "GEAR: " + (
            speed < 1 ? "N" :
            speed < 20 ? "1" :
            speed < 40 ? "2" :
            speed < 65 ? "3" : "4"
        );

    // Rotate wheels
    wheels.forEach(wheel => {
        wheel.rotation.x += signedSpeed * delta * 0.8;
    });
}

// ==========================================
// 12. CAMERA SYSTEM
// ==========================================

function updateCamera(delta) {
    if (!carMesh) return;

    const position = carMesh.position;

    if (cameraMode === 0) {
        const offset = new THREE.Vector3(0, 6, -12);

        offset.applyQuaternion(carMesh.quaternion);

        const targetPosition = position.clone().add(offset);

        camera.position.lerp(
            targetPosition,
            Math.min(delta * 5, 1)
        );

        camera.lookAt(
            position.x,
            position.y + 1,
            position.z
        );

    } else if (cameraMode === 1) {
        const offset = new THREE.Vector3(0, 2.2, 0.5);

        offset.applyQuaternion(carMesh.quaternion);

        camera.position.copy(position).add(offset);

        const forward = new THREE.Vector3(0, 1.7, 12)
            .applyQuaternion(carMesh.quaternion);

        camera.lookAt(position.clone().add(forward));
    }
}

function changeCamera() {
    cameraMode = (cameraMode + 1) % 2;
}

// ==========================================
// 13. BUTTONS
// ==========================================

function setupButtons() {
    document.getElementById("camera-button")
        .addEventListener("click", changeCamera);

    document.getElementById("map-button")
        .addEventListener("click", () => {
            alert("City map is coming soon!");
        });

    document.getElementById("settings-button")
        .addEventListener("click", () => {
            alert("EBGAME settings are coming soon!");
        });

    document.getElementById("resume-button")
        .addEventListener("click", togglePause);

    document.getElementById("restart-button")
        .addEventListener("click", () => {
            location.reload();
        });
}

function togglePause() {
    paused = !paused;

    document.getElementById("pause-menu")
        .classList.toggle("hidden", !paused);
}

// ==========================================
// 14. GAME LOOP
// ==========================================

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.033);

    if (!paused) {
        driveCar(delta);

        world.step();

        const position = carBody.translation();
        const rotation = carBody.rotation();

        carMesh.position.set(
            position.x,
            position.y,
            position.z
        );

        carMesh.quaternion.set(
            rotation.x,
            rotation.y,
            rotation.z,
            rotation.w
        );

        updateCamera(delta);
    }

    renderer.render(scene, camera);
}

// ==========================================
// 15. RESIZE
// ==========================================

function resizeGame() {
    if (!camera || !renderer) return;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );
}

// ==========================================
// 16. START EBGAME
// ==========================================

startGame();
