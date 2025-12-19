// Client Entry Point
// Mobile player app - join screen and globe with pin placement

import { JoinScreen } from './JoinScreen';
import { WaitingScreen } from './WaitingScreen';
import { GameSocket } from './socket';
import { EarthGlobe } from '../earthGlobe';

// Initialize the application when page loads
window.addEventListener('DOMContentLoaded', async () => {
    const joinScreen = new JoinScreen();
    const waitingScreen = new WaitingScreen();
    const socket = new GameSocket();

    // Track current player state
    let myName = '';
    let isFirstPlayer = false;
    let globe: EarthGlobe | null = null;
    let questionOverlay: HTMLElement | null = null;

    function createQuestionOverlay(): void {
        questionOverlay = document.createElement('div');
        questionOverlay.id = 'questionOverlay';
        questionOverlay.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(26, 26, 46, 0.95);
            padding: 15px 30px;
            border-radius: 12px;
            text-align: center;
            z-index: 100;
            border: 2px solid #e94560;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        questionOverlay.innerHTML = `
            <div style="color: rgba(255,255,255,0.7); font-size: 0.9rem; margin-bottom: 5px;">Where is...</div>
            <div id="cityName" style="color: #e94560; font-size: 1.8rem; font-weight: bold;"></div>
        `;
        document.getElementById('gameScreen')?.appendChild(questionOverlay);
    }

    function showQuestion(city: string): void {
        if (!questionOverlay) return;

        const cityEl = questionOverlay.querySelector('#cityName');
        if (cityEl) cityEl.textContent = city;

        questionOverlay.style.display = 'block';
    }

    // Set up socket handlers
    socket.on('joined', (data) => {
        myName = data.name;
        isFirstPlayer = data.isFirst;

        const joinContainer = document.getElementById('joinScreen');
        if (joinContainer) {
            joinContainer.style.display = 'none';
        }

        waitingScreen.show(myName, isFirstPlayer, data.players);
        console.log(`Joined as ${myName} (isFirst: ${isFirstPlayer})`);
    });

    socket.on('player-list', (data) => {
        const me = data.players.find(p => p.name === myName);
        if (me) {
            isFirstPlayer = me.isFirst;
        }
        waitingScreen.show(myName, isFirstPlayer, data.players);
    });

    socket.on('game-start', () => {
        console.log('Game starting!');
        waitingScreen.hide();

        const gameScreen = document.getElementById('gameScreen');
        if (gameScreen) {
            gameScreen.style.display = 'block';
        }

        globe = new EarthGlobe('renderCanvas');
        (window as unknown as { earthGlobe: EarthGlobe }).earthGlobe = globe;

        createQuestionOverlay();
        console.log('Globe initialized');
    });

    // Handle question from server
    socket.on('question', (data) => {
        console.log(`Question: Where is ${data.city}?`);
        showQuestion(data.city);
    });

    socket.on('error', (data) => {
        alert(data.message);
        joinScreen.enable();
    });

    // Handle join
    joinScreen.onJoin(async (name) => {
        joinScreen.disable();

        try {
            await socket.connect();
            socket.join(name);
        } catch (err) {
            console.error('Failed to connect:', err);
            alert('Could not connect to server. Is it running?');
            joinScreen.enable();
        }
    });

    // Handle start game
    waitingScreen.onStart(() => {
        console.log('Starting game...');
        socket.startGame();
    });

    console.log('Client app initialized - JoinScreen ready');
});
