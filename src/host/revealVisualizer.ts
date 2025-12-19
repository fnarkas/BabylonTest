/**
 * Reveal Visualizer
 * Orchestrates the visual reveal sequence showing player answers and correct location
 * Displays pins for all answers and animated arcs from answers to correct location
 */

import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { EarthGlobe } from '../earthGlobe';
import { MultiPinManager } from '../multiPinManager';
import { ArcDrawer } from '../arcDrawer';
import { CameraAnimator } from '../cameraAnimator';
import { getPlayerColor } from '../../shared/playerColors';

const ARC_ANIMATION_DURATION = 2000; // 2 seconds
const ARC_START_DELAY = 300; // 300ms delay before arcs start
const CAMERA_ANIMATION_DURATION = 2000; // 2 seconds
const CAMERA_TARGET_RADIUS = 6; // Distance from globe

interface RevealData {
    correct: {
        name: string;
        country: string;
        lat: number;
        lon: number;
    };
    results: Array<{
        name: string;
        lat: number;
        lon: number;
        distance: number;
        points: number;
    }>;
}

export class RevealVisualizer {
    private scene: Scene;
    private camera: ArcRotateCamera;
    private globe: EarthGlobe;

    private pinManager: MultiPinManager;
    private arcDrawer: ArcDrawer;
    private cameraAnimator: CameraAnimator;

    private currentArcIds: string[] = [];
    private animationFrameId: number | null = null;

    constructor(globe: EarthGlobe, scene: Scene, camera: ArcRotateCamera) {
        this.globe = globe;
        this.scene = scene;
        this.camera = camera;

        // Initialize managers
        this.pinManager = new MultiPinManager(
            scene,
            camera,
            (material) => globe.createUnlitMaterial(material)
        );

        this.arcDrawer = new ArcDrawer(scene, globe);
        this.cameraAnimator = new CameraAnimator(camera);
    }

    /**
     * Initialize the visualizer (load models, etc.)
     */
    async init(): Promise<void> {
        await this.pinManager.init();
        console.log('RevealVisualizer initialized');
    }

    /**
     * Show the reveal visualization
     * @param data Reveal data from server
     * @returns Promise that resolves after arcs complete + 1s delay (when results should show)
     */
    async showReveal(data: RevealData): Promise<void> {
        console.log('Showing reveal visualization', data);

        // Clear any existing visualization
        this.hideReveal();

        // Step 1: Add player pins (NOT the correct location pin)
        this.showPlayerPins(data);

        // Step 2: Create arcs (invisible initially)
        this.createArcs(data);

        // Step 3: Animate arcs and camera in parallel after a brief delay
        await this.delay(ARC_START_DELAY);
        await Promise.all([
            this.animateArcs(ARC_ANIMATION_DURATION),
            this.cameraAnimator.animateToLocation(
                data.correct.lat,
                data.correct.lon,
                CAMERA_TARGET_RADIUS,
                CAMERA_ANIMATION_DURATION
            )
        ]);

        console.log('Reveal visualization complete');

        // Wait 1 more second before showing results overlay
        await this.delay(1000);

        console.log('Ready to show results overlay');
    }

    /**
     * Hide/clear the reveal visualization
     */
    hideReveal(): void {
        // Clear pins
        this.pinManager.clearAllPins();

        // Clear arcs
        this.currentArcIds.forEach(arcId => {
            this.arcDrawer.removeArc(arcId);
        });
        this.currentArcIds = [];

        // Cancel any ongoing animation
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        console.log('Reveal visualization hidden');
    }

    /**
     * Display pins for all player answers (no correct location pin)
     */
    private showPlayerPins(data: RevealData): void {
        const { results } = data;

        // Add player answer pins only
        results.forEach((result, index) => {
            const color = getPlayerColor(index);
            this.pinManager.addPin(
                `player_${result.name}`,
                result.name,
                color,
                result.lat,
                result.lon
            );
        });

        console.log(`Added ${results.length} player pins`);
    }

    /**
     * Create arcs from each player answer to correct location
     */
    private createArcs(data: RevealData): void {
        const { correct, results } = data;

        results.forEach((result, index) => {
            const color = getPlayerColor(index);

            const arcId = this.arcDrawer.addArc(
                result.lat,
                result.lon,
                correct.lat,
                correct.lon,
                color,
                0.3 // altitude (how high the arc curves)
            );

            this.currentArcIds.push(arcId);
        });

        console.log(`Created ${this.currentArcIds.length} arcs`);
    }

    /**
     * Animate all arcs from 0% to 100% over the specified duration
     */
    private async animateArcs(duration: number): Promise<void> {
        return new Promise((resolve) => {
            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Update all arcs to current progress
                this.currentArcIds.forEach(arcId => {
                    this.arcDrawer.setArcProgress(arcId, progress);
                });

                if (progress < 1) {
                    this.animationFrameId = requestAnimationFrame(animate);
                } else {
                    this.animationFrameId = null;
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * Utility function to delay execution
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
