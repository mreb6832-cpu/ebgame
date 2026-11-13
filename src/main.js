
/* ==========================================
   EBGAME - OPEN WORLD CAR SIMULATOR
   Three.js + Rapier Physics
   Keyboard + Gamepad + Touch + Phone QR
========================================== */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/+esm";
import { setupPhoneController } from "./controller.js";

const CONFIG = {
    citySize: 500,
    roadWidth: 16,
    maxSpeed: 65,
    acceleration: 32,
    braking: 45,
    steering: 2.2
};

const $ = id => document.getElementById(id);

const canvas = $("game-canvas");
const loadingScreen = $("loading-screen");
const loadingProgress = $("loading-progress");
const loadingText = $("loading-text");

let scene, camera, renderer, world, carBody, carMesh;
let wheels = [];
let clock = new THREE.Clock();
let trafficSystem = null;

let speed = 0;
let cameraMode = 0;
let paused = false;
let controllerConnected = false;
let phoneConnected = false;

const keys = {};
const touch = {
    left: false,
    right: false,
    gas: false,
    brake: false
};

let phoneControls = {
    gas: false,
    brake: false,
    left: false,
    right: false,
    steering: 0,
    gear: "D"
};

// ------------------------------------------
// LOADING
// ------------------------------------------

function setLoading(percent, message) {
    if (loadingProgress) {
        loadingProgress.style.width = `${percent}%`;
    }

    if (loadingText) {
        loadingText.textContent = message;
    }
}

// ------------------------------------------
// START GAME
// ------------------------------------------

async function startGame() {
    try {
        if (!canvas) {
            throw new Error('Canvas with id="game-canvas" was not found.');
        }

        setLoading(10, "Starting physics engine...");
        await RAPIER.init();

        setLoading(25, "Creating 3D world...");
        createScene();
        createLighting();
        createGround();

        setLoading(45, "Building the city...");
        createCity();
        createRoads();

        setLoading(65, "Preparing your car...");
        createCar();

        setLoading(78, "Connecting controls...");
        setupControls();
        setupButtons();
        setupGamepad();

        // Traffic module is optional.
        try {
            const trafficModule = await import("./traffic.js");

            if (typeof trafficModule.createTraffic === "function") {
                trafficSystem = trafficModule.createTraffic(scene);
            }
        } catch (error) {
            console.warn("Traffic module not loaded:", error);
        }

        // Connect phone controller and create QR code.
        setupPhoneController(
            handlePhoneInput,
            handlePhoneStatus
        );

        setLoading(100, "EBGAME is ready!");

        setTimeout(() => {
            if (loadingScreen) {
                loadingScreen.style.display = "none";
            }
        }, 700);

        animate();

    } catch (error) {
        console.error("EBGAME startup error:", error);
        setLoading(
            100,
            "Game failed to load. Check the console and internet."
        );
    }
}

// ------------------------------------------
// THREE.JS SCENE
// ------------------------------------------

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

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    world = new RAPIER.World({
        x: 0,
        y: -9.81,
        z: 0
    });

    world.timestep = 1 / 60;
}

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
    sunlight.shadow.mapSize.set(2048, 2048);

    sunlight.shadow.camera.left = -150;
    sunlight.shadow.camera.right = 150;
    sunlight.shadow.camera.top = 150;
    sunlight.shadow.camera.bottom = -150;

    scene.add(sunlight);
}

// ------------------------------------------
// GROUND
// ------------------------------------------

function createGround() {
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(
            CONFIG.citySize,
            CONFIG.citySize
        ),
        new THREE.MeshStandardMaterial({
            color: 0x53664d,
            roughness: 1
        })
    );

    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;

    scene.add(ground);

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

// ------------------------------------------
// CITY
// ------------------------------------------

function createCity() {
    const colors = [
        0x8a929d,
        0x687b8d,
        0xb4a99b,
        0x777f89,
        0x9da8b3,
        0x555f70
    ];

    for (let x = -220; x <= 220; x += 45) {
        for (let z = -220; z <= 220; z += 45) {

            if (
                Math.abs(x % 90) < 18 ||
                Math.abs(z % 90) < 18
            ) {
                continue;
            }

            const width = 15 + Math.random() * 12;
            const height = 12 + Math.random() * 65;
            const depth = 15 + Math.random() * 12;

            const building = new THREE.Mesh(
                new THREE.BoxGeometry(
                    width,
                    height,
                    depth
                ),
                new THREE.MeshStandardMaterial({
                    color: colors[
                        Math.floor(Math.random() * colors.length)
                    ],
                    roughness: 0.75,
                    metalness: 0.1
                })
            );

            building.position.set(
                x + (Math.random() - 0.5) * 12,
                height / 2,
                z + (Math.random() - 0.5) * 12
            );

            building.castShadow = true;
            building.receiveShadow = true;

            scene.add(building);

            createWindows(
                building,
                width,
                height,
                depth
            );
        }
    }
}

function createWindows(building, width, height, depth) {
    const rows = Math.floor(height / 5);

    const material = new THREE.MeshStandardMaterial({
        color: 0x9ed8ed,
        emissive: 0x162b40,
        emissiveIntensity: 0.3
    });

    for (let y = 1; y < rows; y++) {
        for (
            let x = -width / 2 + 2;
            x < width / 2 - 1;
            x += 3
        ) {
            const windowMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(1.5, 2),
                material
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

// ------------------------------------------
// ROADS
// ------------------------------------------

function createRoads() {
    const roadMaterial = new THREE.MeshStandardMaterial({
        color: 0x292d33,
        roughness: 0.95
    });

    const lineMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff
    });

    for (let i = -225; i <= 225; i += 90) {

        const horizontal = new THREE.Mesh(
            new THREE.PlaneGeometry(
                CONFIG.citySize,
                CONFIG.roadWidth
            ),
            roadMaterial
        );

        horizontal.rotation.x = -Math.PI / 2;
        horizontal.position.set(0, 0.02, i);
        horizontal.receiveShadow = true;

        scene.add(horizontal);

        const vertical = new THREE.Mesh(
            new THREE.PlaneGeometry(
                CONFIG.roadWidth,
                CONFIG.citySize
            ),
            roadMaterial
        );

        vertical.rotation.x = -Math.PI / 2;
        vertical.position.set(i, 0.025, 0);
        vertical.receiveShadow = true;

        scene.add(vertical);

        for (let p = -240; p <= 240; p += 18) {

            const markH = new THREE.Mesh(
                new THREE.PlaneGeometry(7, 0.25),
                lineMaterial
            );

            markH.rotation.x = -Math.PI / 2;
            markH.position.set(p, 0.04, i);

            scene.add(markH);

            const markV = new THREE.Mesh(
                new THREE.PlaneGeometry(0.25, 7),
                lineMaterial
            );

            markV.rotation.x = -Math.PI / 2;
            markV.position.set(i, 0.045, p);

            scene.add(markV);
        }
    }
}

// ------------------------------------------
// PLAYER CAR
// ------------------------------------------

function createCar() {
    const group = new THREE.Group();

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
    group.add(body);

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
    group.add(cabin);

    const windshield = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 0.55, 0.08),
        new THREE.MeshStandardMaterial({
            color: 0x9ed8ed,
            metalness: 0.7,
            roughness: 0.15
        })
    );

    windshield.position.set(0, 1.53, 0.88);
    group.add(windshield);

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

    const wheelPositions = [
        [-1.12, 0.45, 1.45],
        [1.12, 0.45, 1.45],
        [-1.12, 0.45, -1.45],
        [1.12, 0.45, -1.45]
    ];

    wheelPositions.forEach(position => {
        const wheel = new THREE.Mesh(
            wheelGeometry,
            wheelMaterial
        );

        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(...position);
        wheel.castShadow = true;

        group.add(wheel);
        wheels.push(wheel);
    });

    for (const side of [-1, 1]) {
        const headlight = new THREE.PointLight(
            0xffffff,
            1,
            15
        );

        headlight.position.set(side * 0.7, 1, 2.2);
        group.add(headlight);
    }

    carMesh = group;
    scene.add(carMesh);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, 2, 5)
        .setLinearDamping(0.8)
        .setAngularDamping(4)
        .setCanSleep(false)
        .setEnabledRotations(false, true, false);

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

    const vehicleName = $("vehicle-name");

    if (vehicleName) {
        vehicleName.textContent = "EB SPORT CAR";
    }
}

// ------------------------------------------
// KEYBOARD + TOUCH CONTROLS
// ------------------------------------------

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

    bindTouch("steer-left", "left");
    bindTouch("steer-right", "right");
    bindTouch("accelerate-button", "gas");
    bindTouch("brake-button", "brake");

    window.addEventListener("resize", resizeGame);
}

function bindTouch(id, controlName) {
    const element = $(id);

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

// ------------------------------------------
// PHONE CONTROLLER
// ------------------------------------------

function handlePhoneInput(data = {}) {
    phoneControls = {
        gas: Boolean(data.gas),
        brake: Boolean(data.brake),
        left: Boolean(data.left),
        right: Boolean(data.right),
        steering: Number(data.steering) || 0,

        gear: ["P", "R", "N", "D"].includes(data.gear)
            ? data.gear
            : "D"
    };

    if (data.action === "pause") {
        togglePause();
    }

    if (data.action === "camera") {
        changeCamera();
    }
}

function handlePhoneStatus(status) {
    phoneConnected = status === "PHONE CONNECTED";

    const element = $("controller-status");

    if (element) {
        element.textContent = phoneConnected
            ? "PHONE: CONNECTED"
            : `PHONE: ${status}`;
    }
}

// ------------------------------------------
// GAMEPAD CONTROLLER
// ------------------------------------------

function setupGamepad() {
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
        gas: (pad.buttons[7]?.value || 0) > 0.1,
        brake: (pad.buttons[6]?.value || 0) > 0.1,
        steer: pad.axes[0] || 0
    };
}

function updateControllerStatus() {
    const element = $("controller-status");

    if (element) {
        element.textContent = controllerConnected
            ? "CONTROLLER: CONNECTED"
            : "CONTROLLER: NOT CONNECTED";
    }
}

// ------------------------------------------
// CAR DRIVING + PHYSICS
// ------------------------------------------

function driveCar(delta) {
    if (paused || !carBody) return;

    const pad = getGamepadInput();

    const gas =
        keys.KeyW ||
        keys.ArrowUp ||
        touch.gas ||
        pad.gas ||
        phoneControls.gas;

    const brake =
        keys.KeyS ||
        keys.ArrowDown ||
        touch.brake ||
        pad.brake ||
        phoneControls.brake;

    let steer =
        (
            keys.KeyA ||
            keys.ArrowLeft ||
            touch.left ||
            phoneControls.left
        ? -1 : 0
        ) +
        (
            keys.KeyD ||
            keys.ArrowRight ||
            touch.right ||
            phoneControls.right
        ? 1 : 0
        );

    if (Math.abs(phoneControls.steering) > 0.05) {
        steer = phoneControls.steering;
    }

    if (Math.abs(pad.steer) > 0.12) {
        steer = pad.steer;
    }

    steer = THREE.MathUtils.clamp(steer, -1, 1);

    const gear = phoneControls.gear || "D";

    const rotation = carBody.rotation();

    const quaternion = new THREE.Quaternion(
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w
    );

    const forward = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(quaternion);

    const velocity = carBody.linvel();

    const horizontalSpeed = Math.hypot(
        velocity.x,
        velocity.z
    );

    const signedSpeed = new THREE.Vector3(
        velocity.x,
        0,
        velocity.z
    ).dot(forward);

    // Forward and reverse.
    if (gas && (gear === "D" || gear === "R")) {
        const direction = gear === "R" ? -1 : 1;

        const impulse = forward.clone().multiplyScalar(
            CONFIG.acceleration *
            delta *
            1100 *
            direction
        );

        carBody.applyImpulse({
            x: impulse.x,
            y: 0,
            z: impulse.z
        }, true);
    }

    // Brake and parking gear.
    if (brake || gear === "P") {
        const brakeDirection = signedSpeed >= 0 ? -1 : 1;

        const force = forward.clone().multiplyScalar(
            -CONFIG.braking *
            delta *
            1100 *
            brakeDirection
        );

        carBody.applyImpulse({
            x: force.x,
            y: 0,
            z: force.z
        }, true);
    }

    // Steering.
    if (
        horizontalSpeed > 0.5 &&
        Math.abs(steer) > 0.01 &&
        gear !== "P"
    ) {
        const direction = signedSpeed >= 0 ? -1 : 1;

        carBody.applyTorqueImpulse({
            x: 0,
            y: steer *
                CONFIG.steering *
                delta *
                Math.min(horizontalSpeed / 8, 2) *
                direction,
            z: 0
        }, true);
    }

    // Maximum speed.
    const maxVelocity = CONFIG.maxSpeed / 3.6;

    if (horizontalSpeed > maxVelocity) {
        const factor = maxVelocity / horizontalSpeed;

        carBody.setLinvel({
            x: velocity.x * factor,
            y: velocity.y,
            z: velocity.z * factor
        }, true);
    }

    speed = Math.round(horizontalSpeed * 3.6);

    const speedElement = $("speed-value");

    if (speedElement) {
        speedElement.textContent = speed;
    }

    const gearElement = $("gear-value");

    if (gearElement) {
        gearElement.textContent = "GEAR: " + gear;
    }

    wheels.forEach(wheel => {
        wheel.rotation.x += signedSpeed * delta * 0.8;
    });
}

// ------------------------------------------
// CAMERA
// ------------------------------------------

function updateCamera(delta) {
    if (!carMesh) return;

    const position = carMesh.position;

    // Third-person camera.
    if (cameraMode === 0) {
        const offset = new THREE.Vector3(0, 6, -12);

        offset.applyQuaternion(carMesh.quaternion);

        camera.position.lerp(
            position.clone().add(offset),
            Math.min(delta * 5, 1)
        );

        camera.lookAt(
            position.x,
            position.y + 1,
            position.z
        );

    } else {
        // Cockpit-style camera.
        const offset = new THREE.Vector3(0, 2.2, 0.5);

        offset.applyQuaternion(carMesh.quaternion);

        camera.position.copy(position).add(offset);

        const forward = new THREE.Vector3(0, 1.7, 12)
            .applyQuaternion(carMesh.quaternion);

        camera.lookAt(
            position.clone().add(forward)
        );
    }
}

function changeCamera() {
    cameraMode = (cameraMode + 1) % 2;
}

// ------------------------------------------
// BUTTONS + PAUSE MENU
// ------------------------------------------

function setupButtons() {
    $("camera-button")?.addEventListener(
        "click",
        changeCamera
    );

    $("map-button")?.addEventListener("click", () => {
        alert("City map is coming soon!");
    });

    $("settings-button")?.addEventListener("click", () => {
        alert("EBGAME settings are coming soon!");
    });

    $("resume-button")?.addEventListener(
        "click",
        togglePause
    );

    $("restart-button")?.addEventListener("click", () => {
        location.reload();
    });
}

function togglePause() {
    paused = !paused;

    $("pause-menu")?.classList.toggle(
        "hidden",
        !paused
    );
}

// ------------------------------------------
// MAIN GAME LOOP
// ------------------------------------------

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

        if (trafficSystem) {
            trafficSystem.update(delta);
        }

        updateCamera(delta);
    }

    renderer.render(scene, camera);
}

// ------------------------------------------
// RESIZE
// ------------------------------------------

function resizeGame() {
    if (!camera || !renderer) return;

    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );
}

// ------------------------------------------
// START EBGAME
// ------------------------------------------

startGame();
