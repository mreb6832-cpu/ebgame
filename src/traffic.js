
/* ==========================================
   EBGAME - AI CITY TRAFFIC SYSTEM
========================================== */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const CITY_LIMIT = 225;
const ROAD_SPACING = 90;
const TRAFFIC_COUNT = 24;

const carColors = [
    0xff2020,
    0xffffff,
    0x111111,
    0x1565c0,
    0xffcc00,
    0x888888,
    0x00aa88,
    0x6622aa
];

const trafficCars = [];

// ==========================================
// CREATE TRAFFIC CAR
// ==========================================

function createTrafficCar(scene, index) {
    const group = new THREE.Group();

    const color = carColors[
        index % carColors.length
    ];

    // Car body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.65, 3.8),
        new THREE.MeshStandardMaterial({
            color,
            metalness: 0.65,
            roughness: 0.3
        })
    );

    body.position.y = 0.85;
    body.castShadow = true;
    group.add(body);

    // Car roof
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.65, 1.9),
        new THREE.MeshStandardMaterial({
            color: 0x263746,
            metalness: 0.4,
            roughness: 0.2
        })
    );

    roof.position.set(0, 1.48, -0.25);
    group.add(roof);

    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(
        0.35,
        0.35,
        0.25,
        16
    );

    const wheelMaterial = new THREE.MeshStandardMaterial({
        color: 0x101010
    });

    for (const x of [-0.95, 0.95]) {
        for (const z of [-1.2, 1.2]) {
            const wheel = new THREE.Mesh(
                wheelGeometry,
                wheelMaterial
            );

            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x, 0.4, z);

            group.add(wheel);
        }
    }

    // Headlights
    for (const x of [-0.55, 0.55]) {
        const headlight = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.18, 0.08),
            new THREE.MeshBasicMaterial({
                color: 0xffffff
            })
        );

        headlight.position.set(x, 0.9, 1.94);
        group.add(headlight);
    }

    // Rear lights
    for (const x of [-0.55, 0.55]) {
        const rearLight = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.18, 0.08),
            new THREE.MeshBasicMaterial({
                color: 0xff0000
            })
        );

        rearLight.position.set(x, 0.9, -1.94);
        group.add(rearLight);
    }

    scene.add(group);

    return group;
}

// ==========================================
// CREATE TRAFFIC ROUTE
// ==========================================

function getTrafficRoute(index) {
    const roadIndex = index % 5 - 2;

    const roadPosition = roadIndex * ROAD_SPACING;

    const direction = index % 2 === 0 ? 1 : -1;

    const lane = index % 3 === 0 ? 3 : -3;

    const horizontal = Math.floor(index / 5) % 2 === 0;

    return {
        horizontal,
        direction,
        roadPosition,
        lane,
        progress: Math.random() * CITY_LIMIT * 2,
        speed: 8 + Math.random() * 12
    };
}

// ==========================================
// INITIALIZE TRAFFIC
// ==========================================

export function createTraffic(scene) {
    trafficCars.length = 0;

    for (let i = 0; i < TRAFFIC_COUNT; i++) {
        const mesh = createTrafficCar(scene, i);

        const route = getTrafficRoute(i);

        trafficCars.push({
            mesh,
            route
        });
    }

    console.log("EBGAME: AI Traffic initialized");

    return {
        update(delta) {
            updateTraffic(delta);
        },

        remove() {
            trafficCars.forEach(car => {
                scene.remove(car.mesh);
            });

            trafficCars.length = 0;
        }
    };
}

// ==========================================
// UPDATE TRAFFIC MOVEMENT
// ==========================================

function updateTraffic(delta) {
    trafficCars.forEach(car => {
        const { mesh, route } = car;

        route.progress += route.speed * delta;

        if (route.progress > CITY_LIMIT * 2) {
            route.progress = -CITY_LIMIT;
        }

        const distance = route.progress;

        if (route.horizontal) {
            mesh.position.set(
                route.direction * distance,
                0,
                route.roadPosition + route.lane
            );

            mesh.rotation.y =
                route.direction === 1
                    ? Math.PI / 2
                    : -Math.PI / 2;

        } else {
            mesh.position.set(
                route.roadPosition + route.lane,
                0,
                route.direction * distance
            );

            mesh.rotation.y =
                route.direction === 1
                    ? 0
                    : Math.PI;
        }
    });
}
