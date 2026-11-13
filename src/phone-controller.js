
/* ==========================================
   EBGAME - PHONE CONTROLLER ENGINE
   Connects mobile controls to the PC game
========================================== */

const params = new URLSearchParams(window.location.search);
const hostPeerId = params.get("peer");

const statusElement = document.getElementById("connection-status");
const speedElement = document.getElementById("speed");
const wheel = document.getElementById("steering-wheel");

let peer = null;
let connection = null;
let connected = false;

const controls = {
    gas: false,
    brake: false,
    left: false,
    right: false,
    steering: 0,
    gear: "D"
};

function setStatus(message, isConnected = false) {
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.classList.toggle("connected", isConnected);
}

function sendControls(extra = {}) {
    if (!connected || !connection || !connection.open) return;

    connection.send({
        ...controls,
        ...extra,
        timestamp: Date.now()
    });
}

function connectToGame() {
    if (!hostPeerId) {
        setStatus("INVALID QR CODE");
        return;
    }

    if (typeof Peer === "undefined") {
        setStatus("CONNECTION LIBRARY ERROR");
        return;
    }

    peer = new Peer();

    peer.on("open", () => {
        setStatus("CONNECTING TO GAME...");

        connection = peer.connect(hostPeerId, {
            reliable: true
        });

        connection.on("open", () => {
            connected = true;
            setStatus("CONNECTED TO EBGAME", true);
            sendControls();
        });

        connection.on("data", data => {
            if (data && typeof data.speed === "number") {
                speedElement.textContent =
                    Math.round(Math.abs(data.speed));
            }
        });

        connection.on("close", () => {
            connected = false;
            setStatus("GAME DISCONNECTED");
        });

        connection.on("error", error => {
            console.error(error);
            setStatus("CONNECTION ERROR");
        });
    });

    peer.on("error", error => {
        console.error("PeerJS:", error);
        setStatus("CONNECTION FAILED");
    });
}

// Button controls
function setupHoldButton(id, controlName) {
    const button = document.getElementById(id);
    if (!button) return;

    const press = event => {
        event.preventDefault();
        controls[controlName] = true;
        button.classList.add("active");
        sendControls();
    };

    const release = event => {
        event.preventDefault();
        controls[controlName] = false;
        button.classList.remove("active");
        sendControls();
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("contextmenu", e => e.preventDefault());
}

setupHoldButton("gas", "gas");
setupHoldButton("brake", "brake");

// Steering wheel
let steeringPointer = null;

function updateSteering(event) {
    const rect = wheel.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const angle = Math.atan2(
        event.clientY - centerY,
        event.clientX - centerX
    );

    controls.steering = Math.max(
        -1,
        Math.min(1, Math.sin(angle))
    );

    controls.left = controls.steering < -0.12;
    controls.right = controls.steering > 0.12;

    wheel.style.transform =
        `rotate(${controls.steering * 100}deg)`;

    sendControls();
}

wheel.addEventListener("pointerdown", event => {
    event.preventDefault();

    steeringPointer = event.pointerId;
    wheel.setPointerCapture(event.pointerId);

    updateSteering(event);
});

wheel.addEventListener("pointermove", event => {
    if (event.pointerId !== steeringPointer) return;
    updateSteering(event);
});

function releaseSteering(event) {
    if (event.pointerId !== steeringPointer) return;

    steeringPointer = null;

    controls.steering = 0;
    controls.left = false;
    controls.right = false;

    wheel.style.transform = "rotate(0deg)";
    sendControls();
}

wheel.addEventListener("pointerup", releaseSteering);
wheel.addEventListener("pointercancel", releaseSteering);

// Gear selector
document.querySelectorAll(".gear").forEach(button => {
    button.addEventListener("click", () => {
        const gear = button.dataset.gear;

        controls.gear = gear;

        document.querySelectorAll(".gear").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        sendControls();
    });
});

// Pause and camera commands
document.getElementById("pause-button")
    ?.addEventListener("click", () => {
        sendControls({ action: "pause" });
    });

document.getElementById("camera-button")
    ?.addEventListener("click", () => {
        sendControls({ action: "camera" });
    });

// Send current controls regularly
const sendLoop = window.setInterval(() => {
    if (connected) sendControls();
}, 50);

// Reset controls if page loses focus
window.addEventListener("blur", () => {
    controls.gas = false;
    controls.brake = false;
    controls.left = false;
    controls.right = false;
    controls.steering = 0;

    sendControls();
});

// Start connection
connectToGame();

// Clean up
window.addEventListener("pagehide", () => {
    clearInterval(sendLoop);

    if (connection) connection.close();
    if (peer) peer.destroy();
});
