#!/usr/bin/env node
/**
 * Browser Console Log Server
 *
 * Receives console logs from the browser via WebSocket and writes them to a file.
 * This allows Claude to read browser console output by tailing the log file.
 *
 * Run with: node scripts/log-server.mjs
 */

import { WebSocketServer } from 'ws';
import { appendFileSync, writeFileSync } from 'fs';

const LOG_FILE = 'browser-console.log';
const PORT = 9999;

// Clear the log file on startup
writeFileSync(LOG_FILE, '');

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
    console.log('[Log Server] Browser connected');

    ws.on('message', (data) => {
        const timestamp = new Date().toISOString();
        const message = `[${timestamp}] ${data}\n`;

        // Write to file
        appendFileSync(LOG_FILE, message);

        // Also print to terminal
        process.stdout.write(message);
    });

    ws.on('close', () => {
        console.log('[Log Server] Browser disconnected');
    });

    ws.on('error', (error) => {
        console.error('[Log Server] WebSocket error:', error.message);
    });
});

wss.on('error', (error) => {
    console.error('[Log Server] Server error:', error.message);
    process.exit(1);
});

console.log(`[Log Server] Listening on ws://localhost:${PORT}`);
console.log(`[Log Server] Writing to ${LOG_FILE}`);
console.log(`[Log Server] Claude can run: tail -f ${LOG_FILE}`);
