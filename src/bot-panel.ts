/**
 * Bot Control Panel
 * Simulates 4 players joining and playing JordGlobe
 */

import { generateBotMovementToTarget } from './botMovementGenerator';

interface BotPlayer {
    name: string;
    ws: WebSocket | null;
    isConnected: boolean;
    hasAnswered: boolean;
    isFirst: boolean;
}

class BotPanel {
    private bots: BotPlayer[] = [
        { name: 'Bot Alice', ws: null, isConnected: false, hasAnswered: false, isFirst: false },
        { name: 'Bot Bob', ws: null, isConnected: false, hasAnswered: false, isFirst: false },
        { name: 'Bot Charlie', ws: null, isConnected: false, hasAnswered: false, isFirst: false },
        { name: 'Bot Diana', ws: null, isConnected: false, hasAnswered: false, isFirst: false }
    ];

    private currentQuestion: { city: string; country: string } | null = null;
    private gameStarted = false;

    // UI Elements
    private joinAllBtn = document.getElementById('join-all') as HTMLButtonElement;
    private disconnectAllBtn = document.getElementById('disconnect-all') as HTMLButtonElement;
    private resetGameBtn = document.getElementById('reset-game') as HTMLButtonElement;
    private startGameBtn = document.getElementById('start-game') as HTMLButtonElement;
    private submitAnswersBtn = document.getElementById('submit-answers') as HTMLButtonElement;
    private submitAnswersExceptFirstBtn = document.getElementById('submit-answers-except-first') as HTMLButtonElement;
    private nextRoundBtn = document.getElementById('next-round') as HTMLButtonElement;
    private gameInfo = document.getElementById('game-info') as HTMLDivElement;
    private questionText = document.getElementById('question-text') as HTMLParagraphElement;
    private logContainer = document.getElementById('log') as HTMLDivElement;

    constructor() {
        this.setupEventListeners();
        this.log('Bot panel ready', 'info');
    }

    private setupEventListeners(): void {
        this.joinAllBtn.addEventListener('click', () => this.joinAllBots());
        this.disconnectAllBtn.addEventListener('click', () => this.disconnectAllBots());
        this.resetGameBtn.addEventListener('click', () => this.resetGame());
        this.startGameBtn.addEventListener('click', () => this.startGame());
        this.submitAnswersBtn.addEventListener('click', () => this.submitAllAnswers());
        this.submitAnswersExceptFirstBtn.addEventListener('click', () => this.submitAnswersExceptFirst());
        this.nextRoundBtn.addEventListener('click', () => this.nextRound());
    }

    private async joinAllBots(): Promise<void> {
        this.log('Joining all bots...', 'info');

        for (let i = 0; i < this.bots.length; i++) {
            await this.connectBot(i);
            // Small delay between connections
            await this.delay(200);
        }

        this.updateUI();
    }

    private async connectBot(index: number): Promise<void> {
        const bot = this.bots[index];

        return new Promise((resolve, reject) => {
            try {
                const ws = new WebSocket('ws://localhost:3003');

                ws.onopen = () => {
                    this.log(`${bot.name} connected`, 'success');
                    bot.ws = ws;
                    bot.isConnected = true;

                    // Send join message
                    ws.send(JSON.stringify({
                        type: 'join',
                        name: bot.name
                    }));

                    this.updateBotCard(index);
                    resolve();
                };

                ws.onmessage = (event) => {
                    this.handleMessage(index, event.data);
                };

                ws.onclose = () => {
                    this.log(`${bot.name} disconnected`, 'warning');
                    bot.isConnected = false;
                    bot.ws = null;
                    this.updateBotCard(index);
                    this.updateUI();
                };

                ws.onerror = (error) => {
                    this.log(`${bot.name} connection error`, 'error');
                    reject(error);
                };

            } catch (error) {
                this.log(`Failed to connect ${bot.name}: ${error}`, 'error');
                reject(error);
            }
        });
    }

    private handleMessage(botIndex: number, data: string): void {
        const bot = this.bots[botIndex];
        const message = JSON.parse(data);

        // Log all received messages for debugging
        this.log(`${bot.name} received: ${message.type}`, 'info');

        switch (message.type) {
            case 'joined':
                this.log(`${bot.name} joined the game (isFirst: ${message.isFirst})`, 'success');
                bot.isFirst = message.isFirst;
                this.updateBotCard(botIndex);
                this.updateUI();
                break;

            case 'game-start':
                this.log('Game started!', 'success');
                this.gameStarted = true;
                this.updateUI();
                break;

            case 'question':
                this.currentQuestion = message;
                this.log(`New question: Where is ${message.city}, ${message.country}?`, 'info');
                this.questionText.textContent = `Where is ${message.city}, ${message.country}?`;
                this.gameInfo.style.display = 'block';

                // Reset answered status for all bots
                this.bots.forEach(b => b.hasAnswered = false);
                this.bots.forEach((_, i) => this.updateBotCard(i));
                this.updateUI();
                break;

            case 'player-answered':
                // Mark bot as answered if it's this bot
                if (message.playerName === bot.name) {
                    bot.hasAnswered = true;
                    this.updateBotCard(botIndex);
                    this.updateUI();
                }
                break;

            case 'reveal':
                this.log('Round results revealed!', 'info');
                if (message.results) {
                    message.results.forEach((r: any) => {
                        this.log(`${r.name}: ${r.distance.toFixed(0)}km away, ${r.points} points`, 'success');
                    });
                }
                // Don't reset hasAnswered here - keep it true so "Next Round" button stays enabled
                // hasAnswered will be reset when the next question arrives
                this.updateUI();
                break;

            case 'final-results':
                this.log('Game finished! Final results:', 'success');
                if (message.players) {
                    const sorted = [...message.players].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
                    sorted.forEach((p: any, i: number) => {
                        const crown = i === 0 ? '👑 ' : '';
                        this.log(`${i + 1}. ${crown}${p.name}: ${p.score || 0} points`, i === 0 ? 'success' : 'info');
                    });
                }
                this.gameStarted = false;
                this.updateUI();
                break;

            case 'player-list':
                this.log(`Player list updated: ${message.players.map((p: any) => p.name).join(', ')}`, 'info');
                break;

            case 'error':
                this.log(`Error from server: ${message.message}`, 'error');
                break;
        }
    }

    private disconnectAllBots(): void {
        this.log('Disconnecting all bots...', 'warning');

        this.bots.forEach((bot, index) => {
            if (bot.ws) {
                bot.ws.close();
                bot.ws = null;
                bot.isConnected = false;
                bot.hasAnswered = false;
                this.updateBotCard(index);
            }
        });

        this.gameStarted = false;
        this.currentQuestion = null;
        this.gameInfo.style.display = 'none';
        this.updateUI();
    }

    private async resetGame(): Promise<void> {
        this.log('Resetting game state...', 'warning');

        // Send reset message via any connected bot (or create temporary connection)
        const connectedBot = this.bots.find(b => b.ws && b.isConnected);

        if (connectedBot && connectedBot.ws) {
            // Use existing connection
            connectedBot.ws.send(JSON.stringify({ type: 'reset-game' }));
            this.log('Reset message sent via connected bot', 'info');
        } else {
            // Create temporary connection to send reset
            try {
                const tempWs = new WebSocket('ws://localhost:3003');
                tempWs.onopen = () => {
                    tempWs.send(JSON.stringify({ type: 'reset-game' }));
                    this.log('Reset message sent', 'success');
                    setTimeout(() => tempWs.close(), 500);
                };
                tempWs.onerror = () => {
                    this.log('Could not connect to server. Is it running?', 'error');
                };
            } catch (error) {
                this.log('Failed to reset game. Please manually restart server with: npm run server', 'error');
            }
        }

        // Disconnect all bots locally
        await this.delay(500);
        this.disconnectAllBots();

        this.log('Game reset complete! You can now join bots again.', 'success');
    }

    private startGame(): void {
        const firstBot = this.bots.find(b => b.isFirst);
        if (!firstBot || !firstBot.ws) {
            this.log('Cannot start game: Bot Alice is not connected or not the first player', 'error');
            return;
        }

        const roundInput = document.getElementById('roundCount') as HTMLInputElement;
        const maxRounds = roundInput ? parseInt(roundInput.value) : 2;

        this.log(`Starting game with ${maxRounds} rounds...`, 'info');
        firstBot.ws.send(JSON.stringify({
            type: 'start-game',
            maxRounds: maxRounds
        }));
    }

    private submitAllAnswers(): void {
        if (!this.currentQuestion) {
            this.log('No active question to answer', 'warning');
            return;
        }

        this.log('Submitting answers for all bots...', 'info');

        this.bots.forEach((bot, index) => {
            if (bot.isConnected && bot.ws && !bot.hasAnswered) {
                // Generate random coordinates with some variance
                // This simulates "wrong" answers scattered around the globe
                const baseLat = Math.random() * 180 - 90;  // -90 to 90
                const baseLon = Math.random() * 360 - 180; // -180 to 180

                // Generate fake movement to this position
                const positions = generateBotMovementToTarget(baseLat, baseLon, 20 + Math.floor(Math.random() * 15), 1500 + Math.random() * 1000);

                bot.ws.send(JSON.stringify({
                    type: 'submit-answer',
                    lat: baseLat,
                    lon: baseLon,
                    positions: positions
                }));

                this.log(`${bot.name} submitted answer: ${baseLat.toFixed(2)}, ${baseLon.toFixed(2)} with ${positions.length} positions`, 'info');
            }
        });
    }

    private submitAnswersExceptFirst(): void {
        if (!this.currentQuestion) {
            this.log('No active question to answer', 'warning');
            return;
        }

        this.log('Submitting answers for all bots except first player...', 'info');

        this.bots.forEach((bot, index) => {
            // Skip the first bot (index 0 / Bot Alice)
            if (index === 0) {
                this.log(`${bot.name} skipped (you can play as this player)`, 'info');
                return;
            }

            if (bot.isConnected && bot.ws && !bot.hasAnswered) {
                // Generate random coordinates with some variance
                // This simulates "wrong" answers scattered around the globe
                const baseLat = Math.random() * 180 - 90;  // -90 to 90
                const baseLon = Math.random() * 360 - 180; // -180 to 180

                // Generate fake movement to this position
                const positions = generateBotMovementToTarget(baseLat, baseLon, 20 + Math.floor(Math.random() * 15), 1500 + Math.random() * 1000);

                bot.ws.send(JSON.stringify({
                    type: 'submit-answer',
                    lat: baseLat,
                    lon: baseLon,
                    positions: positions
                }));

                this.log(`${bot.name} submitted answer: ${baseLat.toFixed(2)}, ${baseLon.toFixed(2)} with ${positions.length} positions`, 'info');
            }
        });
    }

    private nextRound(): void {
        const firstBot = this.bots.find(b => b.isFirst);
        if (!firstBot || !firstBot.ws) {
            this.log('Cannot advance round: Bot Alice is not connected or not the first player', 'error');
            return;
        }

        this.log(`Advancing to next round... (${firstBot.name} isFirst: ${firstBot.isFirst}, gameStarted: ${this.gameStarted})`, 'info');
        const message = { type: 'next-round' };
        this.log(`Sending message: ${JSON.stringify(message)}`, 'info');
        firstBot.ws.send(JSON.stringify(message));
    }

    private updateBotCard(index: number): void {
        const bot = this.bots[index];
        const card = document.getElementById(`bot-${index}`);
        if (!card) return;

        const statusDot = card.querySelector('.status-dot') as HTMLElement;
        const statusText = card.querySelector('.bot-status') as HTMLElement;

        // Update card styling
        card.className = 'bot-card';
        if (bot.hasAnswered) {
            card.classList.add('answered');
        } else if (bot.isConnected) {
            card.classList.add('connected');
        }

        // Update status dot
        statusDot.className = 'status-dot';
        if (bot.hasAnswered) {
            statusDot.classList.add('answered');
        } else if (bot.isConnected) {
            statusDot.classList.add('connected');
        }

        // Update status text
        if (bot.hasAnswered) {
            statusText.textContent = 'Answered';
        } else if (bot.isConnected) {
            statusText.textContent = bot.isFirst ? 'Connected (Host)' : 'Connected';
        } else {
            statusText.textContent = 'Disconnected';
        }
    }

    private updateUI(): void {
        const anyConnected = this.bots.some(b => b.isConnected);
        const allConnected = this.bots.every(b => b.isConnected);
        const firstBot = this.bots.find(b => b.isFirst);
        const hasQuestion = this.currentQuestion !== null;
        const connectedBots = this.bots.filter(b => b.isConnected);
        const allAnswered = connectedBots.length > 0 && connectedBots.every(b => b.hasAnswered);

        // Debug logging
        console.log('UpdateUI:', {
            gameStarted: this.gameStarted,
            hasQuestion,
            connectedBots: connectedBots.length,
            allAnswered,
            botStates: this.bots.map(b => ({ name: b.name, connected: b.isConnected, answered: b.hasAnswered }))
        });

        // Join/Disconnect buttons
        this.joinAllBtn.disabled = allConnected;
        this.disconnectAllBtn.disabled = !anyConnected;

        // Start game button (only if first bot is connected and game not started)
        this.startGameBtn.disabled = !firstBot || !firstBot.isConnected || this.gameStarted;

        // Submit answers buttons (only if game started and has active question)
        this.submitAnswersBtn.disabled = !this.gameStarted || !hasQuestion || allAnswered;
        this.submitAnswersExceptFirstBtn.disabled = !this.gameStarted || !hasQuestion || allAnswered;

        // Next round button (only if game started and all answered)
        this.nextRoundBtn.disabled = !this.gameStarted || !hasQuestion || !allAnswered || !firstBot || !firstBot.isConnected;
    }

    private log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${timestamp}] ${message}`;

        this.logContainer.appendChild(entry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;

        // Also log to console for Claude to see
        console.log(`[Bot Panel] ${message}`);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the bot panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new BotPanel();
});
