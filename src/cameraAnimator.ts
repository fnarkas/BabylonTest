/**
 * Camera Animator Module
 * Handles smooth camera animations for ArcRotateCamera
 */

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';

/**
 * Easing function for smooth animations (ease-in-out cubic)
 */
function easeInOutCubic(t: number): number {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class CameraAnimator {
    private camera: ArcRotateCamera;

    constructor(camera: ArcRotateCamera) {
        this.camera = camera;
    }

    /**
     * Convert lat/lon to camera alpha/beta angles
     * @param lat Latitude in degrees
     * @param lon Longitude in degrees
     * @returns Object with alpha (horizontal) and beta (vertical) angles in radians
     */
    private latLonToAlphaBeta(lat: number, lon: number): { alpha: number; beta: number } {
        // Alpha: horizontal rotation (longitude)
        // Convert longitude to radians
        const alpha = lon * (Math.PI / 180);

        // Beta: vertical rotation (measured from top/north pole)
        // Beta = 0 is looking down from north pole
        // Beta = PI is looking up from south pole
        // Beta = PI/2 is looking at equator
        // Latitude is measured from equator, so: beta = PI/2 - latitude
        const beta = Math.PI / 2 - (lat * Math.PI / 180);

        return { alpha, beta };
    }

    /**
     * Animate camera to look at a specific location with a given zoom
     * @param lat Latitude in degrees
     * @param lon Longitude in degrees
     * @param targetRadius Target camera radius (zoom distance)
     * @param duration Animation duration in milliseconds
     * @returns Promise that resolves when animation completes
     */
    async animateToLocation(
        lat: number,
        lon: number,
        targetRadius: number,
        duration: number
    ): Promise<void> {
        const { alpha: targetAlpha, beta: targetBeta } = this.latLonToAlphaBeta(lat, lon);

        // Store starting values
        const startAlpha = this.camera.alpha;
        const startBeta = this.camera.beta;
        const startRadius = this.camera.radius;

        // Calculate deltas (handle alpha wrapping around 2*PI)
        let deltaAlpha = targetAlpha - startAlpha;
        // Normalize to shortest rotation path
        if (deltaAlpha > Math.PI) deltaAlpha -= 2 * Math.PI;
        if (deltaAlpha < -Math.PI) deltaAlpha += 2 * Math.PI;

        const deltaBeta = targetBeta - startBeta;
        const deltaRadius = targetRadius - startRadius;

        return new Promise((resolve) => {
            const startTime = performance.now();

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const rawProgress = Math.min(1, elapsed / duration);

                // Apply easing
                const progress = easeInOutCubic(rawProgress);

                // Update camera properties
                this.camera.alpha = startAlpha + deltaAlpha * progress;
                this.camera.beta = startBeta + deltaBeta * progress;
                this.camera.radius = startRadius + deltaRadius * progress;

                if (rawProgress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Ensure we end exactly at target
                    this.camera.alpha = targetAlpha;
                    this.camera.beta = targetBeta;
                    this.camera.radius = targetRadius;
                    resolve();
                }
            };

            requestAnimationFrame(animate);
        });
    }

    /**
     * Reset camera to default position
     * @param duration Animation duration in milliseconds
     */
    async reset(duration: number = 1000): Promise<void> {
        // Default position: looking at globe from distance
        return this.animateToLocation(0, 0, 10, duration);
    }
}
