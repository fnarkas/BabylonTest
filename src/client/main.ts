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
    let resultsOverlay: HTMLElement | null = null;
    let finalResultsOverlay: HTMLElement | null = null;

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
            <div id="cityName" style="color: #e94560; font-size: 1.8rem; font-weight: bold; margin-bottom: 15px;"></div>
            <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 10px;">
                <input type="number" id="latInput" placeholder="Lat" step="any" style="width: 80px; padding: 8px; border-radius: 6px; border: 1px solid #e94560; background: rgba(255,255,255,0.1); color: white; text-align: center;">
                <input type="number" id="lonInput" placeholder="Lon" step="any" style="width: 80px; padding: 8px; border-radius: 6px; border: 1px solid #e94560; background: rgba(255,255,255,0.1); color: white; text-align: center;">
            </div>
            <button id="submitAnswer" style="padding: 10px 30px; background: #e94560; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">SUBMIT</button>
            <div id="answerStatus" style="margin-top: 10px; color: #4CAF50; display: none;">Answer submitted!</div>
        `;
        document.getElementById('gameScreen')?.appendChild(questionOverlay);

        // Set up submit button handler
        const submitBtn = questionOverlay.querySelector('#submitAnswer') as HTMLButtonElement;
        submitBtn?.addEventListener('click', () => {
            const latInput = questionOverlay!.querySelector('#latInput') as HTMLInputElement;
            const lonInput = questionOverlay!.querySelector('#lonInput') as HTMLInputElement;
            const lat = parseFloat(latInput.value);
            const lon = parseFloat(lonInput.value);

            if (!isNaN(lat) && !isNaN(lon)) {
                socket.submitAnswer(lat, lon);
                submitBtn.disabled = true;
                submitBtn.textContent = 'SUBMITTED';
                const status = questionOverlay!.querySelector('#answerStatus') as HTMLElement;
                if (status) status.style.display = 'block';
            }
        });
    }

    function showQuestion(city: string): void {
        if (!questionOverlay) return;

        // Hide results overlay if visible
        if (resultsOverlay) resultsOverlay.style.display = 'none';

        // Reset the submit button
        const submitBtn = questionOverlay.querySelector('#submitAnswer') as HTMLButtonElement;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'SUBMIT';
        }
        const status = questionOverlay.querySelector('#answerStatus') as HTMLElement;
        if (status) status.style.display = 'none';
        const latInput = questionOverlay.querySelector('#latInput') as HTMLInputElement;
        const lonInput = questionOverlay.querySelector('#lonInput') as HTMLInputElement;
        if (latInput) latInput.value = '';
        if (lonInput) lonInput.value = '';

        const cityEl = questionOverlay.querySelector('#cityName');
        if (cityEl) cityEl.textContent = city;

        questionOverlay.style.display = 'block';
    }

    function createResultsOverlay(): void {
        resultsOverlay = document.createElement('div');
        resultsOverlay.id = 'resultsOverlay';
        resultsOverlay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(26, 26, 46, 0.98);
            padding: 25px 35px;
            border-radius: 16px;
            text-align: center;
            z-index: 200;
            border: 2px solid #e94560;
            display: none;
            min-width: 280px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        document.getElementById('gameScreen')?.appendChild(resultsOverlay);
    }

    function showResults(correct: { name: string; country: string }, results: { name: string; distance: number; points: number }[]): void {
        if (!resultsOverlay) return;

        // Hide question overlay
        if (questionOverlay) questionOverlay.style.display = 'none';

        resultsOverlay.innerHTML = `
            <div style="color: rgba(255,255,255,0.7); font-size: 0.9rem; margin-bottom: 5px;">The answer was</div>
            <div style="color: #e94560; font-size: 1.5rem; font-weight: bold; margin-bottom: 20px;">
                ${correct.name}, ${correct.country}
            </div>
            <div style="text-align: left; margin-bottom: 20px;">
                ${results.map((r, i) => `
                    <div style="
                        display: flex;
                        align-items: center;
                        padding: 8px 12px;
                        margin: 5px 0;
                        background: ${i === 0 ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.05)'};
                        border-radius: 8px;
                    ">
                        <span style="color: white; flex: 1;">${r.name}</span>
                        <span style="color: rgba(255,255,255,0.5); margin-right: 10px;">${r.distance.toLocaleString()} km</span>
                        <span style="color: ${r.points > 0 ? '#4CAF50' : 'rgba(255,255,255,0.5)'}; font-weight: bold;">+${r.points}p</span>
                    </div>
                `).join('')}
            </div>
            ${isFirstPlayer ? `
                <button id="nextRoundBtn" style="
                    padding: 12px 40px;
                    background: #e94560;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 1.1rem;
                    font-weight: bold;
                    cursor: pointer;
                ">NEXT ROUND</button>
            ` : `
                <div style="color: rgba(255,255,255,0.5); font-size: 0.9rem;">Waiting for host to continue...</div>
            `}
        `;

        resultsOverlay.style.display = 'block';

        // Set up next round button handler for first player
        if (isFirstPlayer) {
            const nextBtn = resultsOverlay.querySelector('#nextRoundBtn') as HTMLButtonElement;
            nextBtn?.addEventListener('click', () => {
                socket.nextRound();
            });
        }
    }

    function createFinalResultsOverlay(): void {
        finalResultsOverlay = document.createElement('div');
        finalResultsOverlay.id = 'finalResultsOverlay';
        finalResultsOverlay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(26, 26, 46, 0.98);
            padding: 35px 45px;
            border-radius: 16px;
            text-align: center;
            z-index: 300;
            border: 2px solid #e94560;
            display: none;
            min-width: 320px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        document.getElementById('gameScreen')?.appendChild(finalResultsOverlay);
    }

    function showFinalResults(players: { name: string; score: number }[]): void {
        if (!finalResultsOverlay) return;

        // Hide other overlays
        if (questionOverlay) questionOverlay.style.display = 'none';
        if (resultsOverlay) resultsOverlay.style.display = 'none';

        // Sort players by score
        const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
        const winner = sortedPlayers[0];
        const myPosition = sortedPlayers.findIndex(p => p.name === myName) + 1;

        finalResultsOverlay.innerHTML = `
            <div style="color: rgba(255,255,255,0.7); font-size: 1rem; margin-bottom: 8px;">Game Over!</div>
            <div style="color: #e94560; font-size: 2.5rem; font-weight: bold; margin-bottom: 8px;">
                <span style="font-size: 3rem;">👑</span>
            </div>
            <div style="color: #FFD700; font-size: 2rem; font-weight: bold; margin-bottom: 15px;">
                ${winner.name} Wins!
            </div>
            <div style="color: rgba(255,255,255,0.6); font-size: 1rem; margin-bottom: 25px;">
                Final Score: ${winner.score} points
            </div>
            <div style="text-align: left; margin-bottom: 20px;">
                ${sortedPlayers.map((p, i) => `
                    <div style="
                        display: flex;
                        align-items: center;
                        padding: 10px 15px;
                        margin: 6px 0;
                        background: ${p.name === myName ? 'rgba(233, 69, 96, 0.3)' : i === 0 ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.05)'};
                        border-radius: 8px;
                        ${p.name === myName ? 'border: 1px solid #e94560;' : ''}
                    ">
                        <span style="color: white; flex: 1;">${i === 0 ? '👑 ' : ''}${p.name}</span>
                        <span style="color: #e94560; font-weight: bold;">${p.score}p</span>
                    </div>
                `).join('')}
            </div>
            <div style="color: ${myPosition === 1 ? '#FFD700' : 'rgba(255,255,255,0.7)'}; font-size: 1.1rem; font-weight: bold;">
                You placed ${myPosition}${myPosition === 1 ? 'st' : myPosition === 2 ? 'nd' : myPosition === 3 ? 'rd' : 'th'}!
            </div>
        `;

        finalResultsOverlay.style.display = 'block';
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
        createResultsOverlay();
        createFinalResultsOverlay();
        console.log('Globe initialized');
    });

    // Handle question from server
    socket.on('question', (data) => {
        console.log(`Question: Where is ${data.city}?`);
        showQuestion(data.city);
    });

    // Handle results reveal
    socket.on('reveal', (data) => {
        console.log('Results revealed:', data);
        showResults(data.correct, data.results);
    });

    // Handle final results
    socket.on('final-results', (data) => {
        console.log('Final results:', data);
        showFinalResults(data.players);
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
    waitingScreen.onStart((maxRounds) => {
        console.log(`Starting game with ${maxRounds} rounds...`);
        socket.startGame(maxRounds);
    });

    console.log('Client app initialized - JoinScreen ready');
});
