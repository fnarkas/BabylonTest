/**
 * Bot Movement Generator
 * Generates realistic fake pin movement data for bot players
 */

export interface RecordedPosition {
    lat: number;
    lon: number;
    timestamp: number;
}

/**
 * Generate realistic pin movement from start to end position
 * Simulates cursor movement with wobble to look natural
 */
export function generateBotMovement(
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    numPositions: number = 25,
    duration: number = 2000
): RecordedPosition[] {
    const positions: RecordedPosition[] = [];

    for (let i = 0; i < numPositions; i++) {
        const t = i / (numPositions - 1); // 0 to 1
        const timestamp = t * duration;

        // Interpolate with some wobble to simulate realistic cursor movement
        const wobbleAmount = 3.0; // degrees
        const wobbleX = Math.sin(t * Math.PI * 5) * wobbleAmount * (1 - t);
        const wobbleY = Math.cos(t * Math.PI * 4) * wobbleAmount * (1 - t);

        const lat = startLat + (endLat - startLat) * t + wobbleY;
        const lon = startLon + (endLon - startLon) * t + wobbleX;

        positions.push({ lat, lon, timestamp });
    }

    return positions;
}

/**
 * Generate a random starting position away from the target
 * This makes the bot movement look more realistic (coming from somewhere)
 */
export function generateRandomStartPosition(targetLat: number, targetLon: number): { lat: number; lon: number } {
    // Generate a point roughly 30-60 degrees away
    const distance = 30 + Math.random() * 30;
    const angle = Math.random() * Math.PI * 2;

    // Simple offset (not geodesically accurate but good enough for visual effect)
    const startLat = Math.max(-90, Math.min(90, targetLat + Math.cos(angle) * distance));
    const startLon = ((targetLon + Math.sin(angle) * distance + 180) % 360) - 180;

    return { lat: startLat, lon: startLon };
}

/**
 * Generate complete bot movement to a target position
 * Automatically picks a random start position
 */
export function generateBotMovementToTarget(
    targetLat: number,
    targetLon: number,
    numPositions?: number,
    duration?: number
): RecordedPosition[] {
    const start = generateRandomStartPosition(targetLat, targetLon);
    return generateBotMovement(start.lat, start.lon, targetLat, targetLon, numPositions, duration);
}
