/**
 * JordGlobe Party Server
 *
 * Simple WebSocket server for coordinating players.
 * Kept separate to avoid merge conflicts - can be integrated with host later.
 *
 * Run with: npm run server
 */

import { WebSocketServer } from 'ws';
import os from 'os';
import { appendFileSync, writeFileSync } from 'fs';
import { getRandomCity, calculateDistance } from './cities.mjs';

// Logging setup
const LOG_FILE = 'game-server.log';
writeFileSync(LOG_FILE, ''); // Clear log on startup

function log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logLine = data
        ? `[${timestamp}] ${message} ${JSON.stringify(data)}\n`
        : `[${timestamp}] ${message}\n`;

    // Write to file
    appendFileSync(LOG_FILE, logLine);

    // Also print to console
    process.stdout.write(logLine);
}

const PORT = 3003;
const WEB_PORT = 3000; // Vite server port

// Get local network IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

// Game state
const players = [];
const hosts = new Set();
let gameStarted = false;
let currentCity = null;
const answers = new Map(); // playerName -> { lat, lon, positions }
const scores = new Map();  // playerName -> total score
let maxRounds = 2; // Default number of rounds
let currentRound = 0;

function broadcast(message) {
    const data = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(data);
        }
    });
}

function getPlayerList() {
    return players.map(p => ({
        name: p.name,
        isFirst: p.isFirst,
        score: scores.get(p.name) || 0
    }));
}

function startNewRound() {
    answers.clear();
    currentRound++;
    currentCity = getRandomCity();
    log(`Round ${currentRound}/${maxRounds}: ${currentCity.name}, ${currentCity.country}`);

    broadcast({
        type: 'question',
        city: currentCity.name,
        country: currentCity.country,
        round: currentRound,
        maxRounds: maxRounds
    });
}

function checkAllAnswered() {
    if (players.length === 0) return;

    const allAnswered = players.every(p => answers.has(p.name));
    if (!allAnswered) return;

    // Calculate results
    const results = players.map(p => {
        const answer = answers.get(p.name);
        const distance = calculateDistance(
            currentCity.lat, currentCity.lon,
            answer.lat, answer.lon
        );
        return {
            name: p.name,
            distance: distance,
            lat: answer.lat,
            lon: answer.lon,
            positions: answer.positions || []
        };
    });

    // Sort by distance (closest first)
    results.sort((a, b) => a.distance - b.distance);

    // Assign points: last place = 0, 2nd last = 1, etc.
    const numPlayers = results.length;
    results.forEach((r, i) => {
        r.points = numPlayers - 1 - i;
        const currentScore = scores.get(r.name) || 0;
        scores.set(r.name, currentScore + r.points);
        r.totalScore = scores.get(r.name);
    });

    log('All answered! Results:', results);

    broadcast({
        type: 'reveal',
        correct: {
            name: currentCity.name,
            country: currentCity.country,
            lat: currentCity.lat,
            lon: currentCity.lon
        },
        results: results,
        players: getPlayerList(),
        round: currentRound,
        maxRounds: maxRounds
    });

    // Check if game is over
    if (currentRound >= maxRounds) {
        setTimeout(() => {
            log('Game finished! Sending final results...');
            broadcast({
                type: 'final-results',
                players: getPlayerList()
            });
        }, 5000); // Wait 5 seconds after reveal before showing final results
    }
}

wss.on('connection', (ws) => {
    log('Client connected');
    let playerName = null;
    let isHost = false;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            log('Received:', message);

            switch (message.type) {
                case 'host-connect': {
                    isHost = true;
                    hosts.add(ws);
                    const localIP = getLocalIP();
                    log('Host connected, local IP:', localIP);
                    ws.send(JSON.stringify({
                        type: 'host-info',
                        localIP,
                        webPort: WEB_PORT,
                        players: getPlayerList()
                    }));
                    break;
                }

                case 'join': {
                    if (players.some(p => p.name === message.name)) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Name already taken'
                        }));
                        return;
                    }

                    const isFirst = players.length === 0;
                    playerName = message.name;
                    players.push({ name: playerName, isFirst, ws });

                    log(`Player joined: ${playerName} (isFirst: ${isFirst})`);

                    ws.send(JSON.stringify({
                        type: 'joined',
                        name: playerName,
                        isFirst,
                        players: getPlayerList()
                    }));

                    broadcast({
                        type: 'player-list',
                        players: getPlayerList()
                    });
                    break;
                }

                case 'start-game': {
                    const player = players.find(p => p.name === playerName);
                    if (player && player.isFirst) {
                        gameStarted = true;
                        currentRound = 0;
                        scores.clear();

                        // Set max rounds if provided
                        if (message.maxRounds && message.maxRounds > 0) {
                            maxRounds = message.maxRounds;
                        }

                        log(`Game started! Max rounds: ${maxRounds}`);
                        broadcast({ type: 'game-start', maxRounds });

                        // Start first round after short delay
                        setTimeout(() => startNewRound(), 2000);
                    }
                    break;
                }

                case 'submit-answer': {
                    if (!gameStarted || !currentCity) return;
                    if (answers.has(playerName)) return; // Already answered

                    answers.set(playerName, {
                        lat: message.lat,
                        lon: message.lon,
                        positions: message.positions || [] // Optional recorded positions
                    });
                    log(`${playerName} answered: lat=${message.lat}, lon=${message.lon}, positions=${message.positions ? message.positions.length : 0}`);

                    // Broadcast that this player answered
                    broadcast({
                        type: 'player-answered',
                        playerName: playerName
                    });

                    // Check if all players have answered
                    checkAllAnswered();
                    break;
                }

                case 'next-round': {
                    const player = players.find(p => p.name === playerName);
                    log(`next-round request from ${playerName} (isFirst: ${player?.isFirst}, gameStarted: ${gameStarted}, currentRound: ${currentRound}/${maxRounds})`);

                    if (player && player.isFirst && gameStarted) {
                        if (currentRound >= maxRounds) {
                            log('Game already finished - ignoring next-round request');
                        } else {
                            log('Starting next round...');
                            startNewRound();
                        }
                    } else {
                        log(`next-round DENIED - player: ${!!player}, isFirst: ${player?.isFirst}, gameStarted: ${gameStarted}`);
                    }
                    break;
                }

                case 'reset-game': {
                    log('Resetting game state...');

                    // Clear all game state
                    players.length = 0;
                    hosts.clear();
                    gameStarted = false;
                    currentCity = null;
                    answers.clear();
                    scores.clear();
                    currentRound = 0;
                    maxRounds = 2;

                    // Notify all clients
                    broadcast({ type: 'game-reset' });

                    log('Game reset complete');
                    break;
                }
            }
        } catch (err) {
            log('Error parsing message:', err);
        }
    });

    ws.on('close', () => {
        if (isHost) {
            hosts.delete(ws);
            log('Host disconnected');
        } else if (playerName) {
            const index = players.findIndex(p => p.name === playerName);
            if (index !== -1) {
                players.splice(index, 1);
                log(`Player left: ${playerName}`);

                if (players.length > 0 && !players.some(p => p.isFirst)) {
                    players[0].isFirst = true;
                    log(`New host: ${players[0].name}`);
                }

                broadcast({
                    type: 'player-list',
                    players: getPlayerList()
                });
            }
        }
        log('Client disconnected');
    });
});

log(`JordGlobe Party Server running on ws://localhost:${PORT}`);
log(`Logging to ${LOG_FILE}`);
log('Waiting for players to join...');
