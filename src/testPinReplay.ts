/**
 * Test page for Pin Replay Animator
 * Shows mock pin movement recordings for 3 players
 */

import { EarthGlobe } from './earthGlobe';
import { PinReplayAnimator } from './pinReplayAnimator';
import type { PinRecording } from './pinRecorder';

// Initialize EarthGlobe
const globe = new EarthGlobe('renderCanvas');
(window as any).earthGlobe = globe;

// Generate mock pin recording data
// Each player has a different movement pattern leading to Paris
function generateMockRecording(
    playerId: string,
    playerName: string,
    color: string,
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    numPositions: number,
    duration: number
): PinRecording {
    const positions = [];

    for (let i = 0; i < numPositions; i++) {
        const t = i / (numPositions - 1); // 0 to 1
        const timestamp = t * duration;

        // Interpolate with some wobble to simulate realistic cursor movement
        const wobbleAmount = 2.0; // degrees
        const wobbleX = Math.sin(t * Math.PI * 4) * wobbleAmount * (1 - t);
        const wobbleY = Math.cos(t * Math.PI * 3) * wobbleAmount * (1 - t);

        const lat = startLat + (endLat - startLat) * t + wobbleY;
        const lon = startLon + (endLon - startLon) * t + wobbleX;

        positions.push({ lat, lon, timestamp });
    }

    return {
        playerId,
        playerName,
        color,
        positions
    };
}

// Wait for globe to initialize
setTimeout(async () => {
    const scene = globe.getScene();
    const camera = globe.getCamera();

    // Initialize pin replay animator
    const replayAnimator = new PinReplayAnimator(scene, camera);
    await replayAnimator.init();
    (window as any).replayAnimator = replayAnimator;

    // Target location (Paris)
    const paris = { lat: 48.8584, lon: 2.2945 };

    // Generate mock recordings for 3 players
    // Each starts from a different location and moves toward Paris
    const recordings: PinRecording[] = [
        // Alice - starts from New York
        generateMockRecording(
            'alice',
            'Alice',
            '#FF6B6B',
            40.7128,  // New York lat
            -74.0060, // New York lon
            paris.lat,
            paris.lon,
            25,       // 25 positions
            2000      // 2 seconds
        ),

        // Bob - starts from Tokyo
        generateMockRecording(
            'bob',
            'Bob',
            '#4ECDC4',
            35.6762,  // Tokyo lat
            139.6503, // Tokyo lon
            paris.lat,
            paris.lon,
            30,       // 30 positions
            2500      // 2.5 seconds
        ),

        // Charlie - starts from Sydney
        generateMockRecording(
            'charlie',
            'Charlie',
            '#FFE66D',
            -33.8688, // Sydney lat
            151.2093, // Sydney lon
            paris.lat,
            paris.lon,
            20,       // 20 positions
            1500      // 1.5 seconds
        )
    ];

    const statusEl = document.getElementById('status');
    const playBtn = document.getElementById('playBtn') as HTMLButtonElement;
    const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;

    const updateStatus = (text: string) => {
        if (statusEl) statusEl.textContent = text;
        console.log(text);
    };

    // Play button handler
    playBtn?.addEventListener('click', async () => {
        playBtn.disabled = true;
        clearBtn.disabled = true;
        updateStatus('Playing animations...');

        await replayAnimator.playRecordings(recordings, () => {
            updateStatus('Animations complete!');
            playBtn.disabled = false;
            clearBtn.disabled = false;
        });
    });

    // Clear button handler
    clearBtn?.addEventListener('click', () => {
        replayAnimator.clearAnimations();
        updateStatus('Cleared animations');
    });

    updateStatus('Ready - click "Play Animations" to see pin movements');
    console.log('Mock recordings created:', recordings);

}, 1000);
