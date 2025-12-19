/**
 * Pin Recorder Module
 * Records player pin movements (cursor/touch tracking) during placement
 * Stores up to 100 positions with timestamps for replay
 */

export interface RecordedPosition {
    lat: number;
    lon: number;
    timestamp: number; // milliseconds since recording started
}

export interface PinRecording {
    playerId: string;
    playerName: string;
    color: string;
    positions: RecordedPosition[];
}

export class PinRecorder {
    private positions: RecordedPosition[] = [];
    private startTime: number = 0;
    private isRecording: boolean = false;
    private maxPositions: number = 100;
    private lastRecordedTime: number = 0;
    private minTimeBetweenSamples: number = 16; // ~60fps

    /**
     * Start recording pin movements
     */
    startRecording(): void {
        this.positions = [];
        this.startTime = Date.now();
        this.lastRecordedTime = 0;
        this.isRecording = true;
        console.log('PinRecorder: Started recording');
    }

    /**
     * Stop recording and return the recorded positions
     */
    stopRecording(): RecordedPosition[] {
        this.isRecording = false;
        console.log(`PinRecorder: Stopped recording. Captured ${this.positions.length} positions`);
        return this.positions;
    }

    /**
     * Add a position to the recording
     * Automatically throttles to avoid too many samples
     */
    recordPosition(lat: number, lon: number): void {
        if (!this.isRecording) return;

        const now = Date.now();
        const elapsed = now - this.startTime;

        // Throttle: only record if enough time has passed since last sample
        if (elapsed - this.lastRecordedTime < this.minTimeBetweenSamples) {
            return;
        }

        // If we've reached max positions, replace oldest (sliding window)
        if (this.positions.length >= this.maxPositions) {
            this.positions.shift();
        }

        this.positions.push({
            lat,
            lon,
            timestamp: elapsed
        });

        this.lastRecordedTime = elapsed;
    }

    /**
     * Check if currently recording
     */
    isRecordingActive(): boolean {
        return this.isRecording;
    }

    /**
     * Get current number of recorded positions
     */
    getPositionCount(): number {
        return this.positions.length;
    }

    /**
     * Clear all recorded positions
     */
    clear(): void {
        this.positions = [];
        this.startTime = 0;
        this.lastRecordedTime = 0;
        this.isRecording = false;
    }

    /**
     * Set the maximum number of positions to record
     */
    setMaxPositions(max: number): void {
        this.maxPositions = Math.max(1, max);
    }

    /**
     * Set the minimum time between samples in milliseconds
     */
    setMinTimeBetweenSamples(ms: number): void {
        this.minTimeBetweenSamples = Math.max(0, ms);
    }

    /**
     * Create a full recording object with player info
     */
    createRecording(playerId: string, playerName: string, color: string): PinRecording {
        return {
            playerId,
            playerName,
            color,
            positions: [...this.positions]
        };
    }
}
