
/* ==========================================
   EBGAME - PHONE CONTROLLER
   Phone to PC connection using PeerJS
========================================== */

let peer = null;
let phoneConnection = null;
let isConnected = false;

let phoneInput = {
    gas: false,
    brake: false,
    left: false,
    right: false
};

const PHONE_CONFIG = {
    peerScript: "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js",
    qrScript: "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
};

// Load external libraries
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(
            `script[src="${src}"]`
        );

        if (existing) {
            resolve();
            return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;

        document.head.appendChild(script);
    });
}

// Start phone controller connection
export async function setupPhoneController(
    onInput = () => {},
    onStatus = () => {}
) {
    try {
        await loadScript(PHONE_CONFIG.peerScript);
        await loadScript(PHONE_CONFIG.qrScript);

        peer = new Peer();

        peer.on("open", peerId => {
            const phoneUrl =
                `${window.location.origin}/phone-controller.html?peer=${encodeURIComponent(peerId)}`;

            showPhoneQR(phoneUrl);

            onStatus("WAITING FOR PHONE");
        });

        peer.on("connection", connection => {
            phoneConnection = connection;

            connection.on("open", () => {
                isConnected = true;
                onStatus("PHONE CONNECTED");
            });

            connection.on("data", data => {
                if (!data || typeof data !== "object") return;

                phoneInput = {
                    gas: Boolean(data.gas),
                    brake: Boolean(data.brake),
                    left: Boolean(data.left),
                    right: Boolean(data.right)
                };

                onInput({ ...phoneInput });
            });

            connection.on("close", () => {
                isConnected = false;
                resetPhoneInput();
                onStatus("PHONE DISCONNECTED");
            });

            connection.on("error", error => {
                console.error("Phone connection error:", error);
                onStatus("CONNECTION ERROR");
            });
        });

        peer.on("error", error => {
            console.error("PeerJS error:", error);
            onStatus("CONNECTION FAILED");
        });

    } catch (error) {
        console.error("Phone controller setup failed:", error);
        onStatus("PHONE CONTROLLER UNAVAILABLE");
    }
}

// Display QR code
function showPhoneQR(url) {
    let container = document.getElementById("phone-qr-container");

    if (!container) {
        container = document.createElement("div");
        container.id = "phone-qr-container";

        Object.assign(container.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "#101722",
            color: "white",
            padding: "24px",
            borderRadius: "16px",
            zIndex: "99999",
            textAlign: "center",
            fontFamily: "Arial"
        });

        document.body.appendChild(container);
    }

    container.innerHTML = `
        <h2>EBGAME PHONE CONTROLLER</h2>
        <p>Scan this QR code with your phone</p>
        <div id="phone-qr"></div>
        <p id="phone-connection-label">Waiting for connection...</p>
        <button id="close-phone-qr">CLOSE</button>
    `;

    new QRCode(document.getElementById("phone-qr"), {
        text: url,
        width: 200,
        height: 200
    });

    document.getElementById("close-phone-qr")
        .addEventListener("click", () => {
            container.remove();
        });
}

// Get current phone controls
export function getPhoneInput() {
    return { ...phoneInput };
}

// Check connection
export function isPhoneConnected() {
    return isConnected;
}

// Reset controls
function resetPhoneInput() {
    phoneInput = {
        gas: false,
        brake: false,
        left: false,
        right: false
    };
}

// Disconnect phone
export function disconnectPhoneController() {
    if (phoneConnection) {
        phoneConnection.close();
        phoneConnection = null;
    }

    if (peer) {
        peer.destroy();
        peer = null;
    }

    isConnected = false;
    resetPhoneInput();
}
