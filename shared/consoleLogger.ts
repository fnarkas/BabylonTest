/**
 * Browser Console Logger
 *
 * Intercepts console.log/error/warn and sends them to a WebSocket server
 * that writes to a file for Claude to read.
 *
 * This module auto-executes when imported and gracefully handles the case
 * where the log server is not running.
 */

const LOG_SERVER_URL = 'ws://localhost:9999';

// Try to connect to log server
let logSocket: WebSocket | null = null;
let isConnected = false;

try {
    logSocket = new WebSocket(LOG_SERVER_URL);

    logSocket.addEventListener('open', () => {
        isConnected = true;
        console.log('[Console Logger] Connected to log server');
    });

    logSocket.addEventListener('error', () => {
        // Silently fail if server not running - don't spam console
        isConnected = false;
    });

    logSocket.addEventListener('close', () => {
        isConnected = false;
    });
} catch (error) {
    // Server not running - that's ok
}

// Helper to send message to log server
function sendToServer(message: string): void {
    if (logSocket && isConnected && logSocket.readyState === WebSocket.OPEN) {
        try {
            logSocket.send(message);
        } catch (error) {
            // Ignore send errors
        }
    }
}

// Format arguments for logging
function formatArgs(args: any[]): string {
    return args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');
}

// Override console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args: any[]) => {
    originalLog(...args);
    sendToServer(`[LOG] ${formatArgs(args)}`);
};

console.error = (...args: any[]) => {
    originalError(...args);
    sendToServer(`[ERROR] ${formatArgs(args)}`);
};

console.warn = (...args: any[]) => {
    originalWarn(...args);
    sendToServer(`[WARN] ${formatArgs(args)}`);
};

export {}; // Make this a module
