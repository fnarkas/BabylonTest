/**
 * Host Lobby - Shows QR code and player list, then game with globe + leaderboard
 */

import QRCode from 'qrcode';
import { EarthGlobe } from '../earthGlobe';

interface Player {
    name: string;
    isFirst: boolean;
    score?: number;
}

class HostLobby {
    private ws: WebSocket | null = null;
    private players: Player[] = [];
    private globe: EarthGlobe | null = null;
    private questionOverlay: HTMLElement | null = null;

    constructor() {
        this.connectToServer();
    }

    private async generateQRCode(localIP: string, webPort: number): Promise<void> {
        const partyUrl = `http://${localIP}:${webPort}/party`;

        const urlElement = document.getElementById('joinUrl');
        if (urlElement) {
            urlElement.textContent = partyUrl;
        }

        const qrContainer = document.getElementById('qrCode');
        if (qrContainer) {
            qrContainer.innerHTML = '';
            try {
                const canvas = await QRCode.toCanvas(partyUrl, {
                    width: 250,
                    margin: 0,
                    color: { dark: '#1a1a2e', light: '#ffffff' }
                });
                qrContainer.appendChild(canvas);
                console.log('QR code generated for:', partyUrl);
            } catch (err) {
                console.error('Failed to generate QR code:', err);
            }
        }
    }

    private connectToServer(): void {
        const host = window.location.hostname || 'localhost';
        const serverUrl = `ws://${host}:3003`;

        console.log('Connecting to server:', serverUrl);
        this.ws = new WebSocket(serverUrl);

        this.ws.onopen = () => {
            console.log('Connected to server');
            this.ws?.send(JSON.stringify({ type: 'host-connect' }));
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('Received:', message);

                switch (message.type) {
                    case 'host-info':
                        this.generateQRCode(message.localIP, message.webPort);
                        this.players = message.players;
                        this.updateLobbyPlayerList();
                        this.updateWaitingMessage();
                        break;

                    case 'player-list':
                        this.players = message.players;
                        this.updateLobbyPlayerList();
                        this.updateWaitingMessage();
                        this.updateLeaderboard();
                        break;

                    case 'game-start':
                        console.log('Game starting!');
                        this.startGame();
                        break;

                    case 'question':
                        this.showQuestion(message.city);
                        break;
                }
            } catch (err) {
                console.error('Error parsing message:', err);
            }
        };

        this.ws.onerror = (err) => console.error('WebSocket error:', err);
        this.ws.onclose = () => {
            console.log('Disconnected from server');
            setTimeout(() => this.connectToServer(), 2000);
        };
    }

    private startGame(): void {
        const lobbyScreen = document.getElementById('lobbyScreen');
        const gameScreen = document.getElementById('gameScreen');

        if (lobbyScreen) lobbyScreen.style.display = 'none';
        if (gameScreen) gameScreen.style.display = 'block';

        this.globe = new EarthGlobe('renderCanvas');
        (window as unknown as { earthGlobe: EarthGlobe }).earthGlobe = this.globe;

        this.createQuestionOverlay();
        this.players = this.players.map(p => ({ ...p, score: 0 }));
        this.updateLeaderboard();
    }

    private createQuestionOverlay(): void {
        this.questionOverlay = document.createElement('div');
        this.questionOverlay.id = 'questionOverlay';
        this.questionOverlay.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(26, 26, 46, 0.95);
            padding: 20px 40px;
            border-radius: 16px;
            text-align: center;
            z-index: 100;
            border: 2px solid #e94560;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        this.questionOverlay.innerHTML = `
            <div style="color: rgba(255,255,255,0.7); font-size: 1rem; margin-bottom: 10px;">Where is...</div>
            <div id="cityName" style="color: #e94560; font-size: 2.5rem; font-weight: bold;"></div>
        `;
        document.querySelector('.globe-container')?.appendChild(this.questionOverlay);
    }

    private showQuestion(city: string): void {
        if (!this.questionOverlay) return;

        const cityEl = this.questionOverlay.querySelector('#cityName');
        if (cityEl) cityEl.textContent = city;

        this.questionOverlay.style.display = 'block';
    }

    private updateLobbyPlayerList(): void {
        const listElement = document.getElementById('lobbyPlayerList');
        if (!listElement) return;

        if (this.players.length === 0) {
            listElement.innerHTML = '<li class="no-players">Waiting for players to join...</li>';
            return;
        }

        listElement.innerHTML = this.players.map((player, index) => `
            <li class="${player.isFirst ? 'host' : ''}">
                <span class="player-number">${index + 1}</span>
                <span>${player.name}</span>
                ${player.isFirst ? '<span class="host-badge">Host</span>' : ''}
            </li>
        `).join('');
    }

    private updateWaitingMessage(): void {
        const messageElement = document.getElementById('waitingMessage');
        if (!messageElement) return;

        if (this.players.length === 0) {
            messageElement.textContent = '';
            return;
        }

        const hostPlayer = this.players.find(p => p.isFirst);
        if (hostPlayer) {
            messageElement.textContent = `Waiting for ${hostPlayer.name} to start the party...`;
        }
    }

    private updateLeaderboard(): void {
        const listElement = document.getElementById('leaderboard');
        if (!listElement) return;

        const sortedPlayers = [...this.players].sort((a, b) => (b.score || 0) - (a.score || 0));

        listElement.innerHTML = sortedPlayers.map((player, index) => `
            <li>
                <span class="leaderboard-rank">${index + 1}</span>
                <span class="leaderboard-name">${player.name}</span>
                <span class="leaderboard-score">${player.score || 0}</span>
            </li>
        `).join('');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new HostLobby();
    console.log('Host lobby initialized');
});
