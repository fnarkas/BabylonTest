/**
 * Manages distance labels that appear above player pins showing distance from correct answer
 */

import { Scene, Camera, Vector3, Matrix } from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock } from '@babylonjs/gui';
import { calculateDistance } from '../shared/geo';

export interface DistanceLabel {
    playerId: string;
    textBlock: TextBlock;
    targetDistance: number;
    currentDistance: number;
    position: { lat: number; lon: number };
    animationStartTime: number | null;
    isAnimating: boolean;
}

export class DistanceLabelManager {
    private scene: Scene;
    private camera: Camera;
    private advancedTexture: AdvancedDynamicTexture;
    private labels: Map<string, DistanceLabel> = new Map();
    private correctAnswerPosition: { lat: number; lon: number } | null = null;

    // Animation constants
    private readonly ANIMATION_DURATION = 2000; // 2 seconds
    private readonly EARTH_RADIUS = 2.0;
    private readonly LABEL_HEIGHT_OFFSET = 0.25; // How high above pin to position label

    // Color thresholds (in km)
    private readonly GREEN_THRESHOLD = 500;
    private readonly YELLOW_THRESHOLD = 2000;

    constructor(scene: Scene, camera: Camera) {
        this.scene = scene;
        this.camera = camera;

        // Create GUI texture for 2D labels
        this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('DistanceLabels', true, this.scene);
    }

    /**
     * Set the correct answer position for distance calculations
     */
    setCorrectAnswer(lat: number, lon: number): void {
        this.correctAnswerPosition = { lat, lon };

        // Recalculate all existing labels
        this.labels.forEach((label, playerId) => {
            const distance = calculateDistance(
                label.position.lat,
                label.position.lon,
                lat,
                lon
            );
            label.targetDistance = distance;
            this.startAnimation(playerId);
        });
    }

    /**
     * Add or update a distance label for a player
     */
    addLabel(playerId: string, playerLat: number, playerLon: number): void {
        // If label already exists, update it
        if (this.labels.has(playerId)) {
            this.updateLabel(playerId, playerLat, playerLon);
            return;
        }

        // Calculate distance from correct answer (if set)
        const distance = this.correctAnswerPosition
            ? calculateDistance(playerLat, playerLon, this.correctAnswerPosition.lat, this.correctAnswerPosition.lon)
            : 0;

        // Create text block
        const textBlock = new TextBlock();
        textBlock.fontSize = 18;
        textBlock.color = 'white';
        textBlock.outlineWidth = 2;
        textBlock.outlineColor = 'black';
        textBlock.text = this.formatDistance(0);

        this.advancedTexture.addControl(textBlock);

        // Create label data
        const label: DistanceLabel = {
            playerId,
            textBlock,
            targetDistance: distance,
            currentDistance: 0,
            position: { lat: playerLat, lon: playerLon },
            animationStartTime: null,
            isAnimating: false
        };

        this.labels.set(playerId, label);

        // Start animation if we have a correct answer
        if (this.correctAnswerPosition) {
            this.startAnimation(playerId);
        }
    }

    /**
     * Update an existing label's position
     */
    updateLabel(playerId: string, playerLat: number, playerLon: number): void {
        const label = this.labels.get(playerId);
        if (!label) return;

        label.position = { lat: playerLat, lon: playerLon };

        // Recalculate distance if we have correct answer
        if (this.correctAnswerPosition) {
            const distance = calculateDistance(
                playerLat,
                playerLon,
                this.correctAnswerPosition.lat,
                this.correctAnswerPosition.lon
            );
            label.targetDistance = distance;
            this.startAnimation(playerId);
        }
    }

    /**
     * Remove a label
     */
    removeLabel(playerId: string): void {
        const label = this.labels.get(playerId);
        if (!label) return;

        this.advancedTexture.removeControl(label.textBlock);
        label.textBlock.dispose();
        this.labels.delete(playerId);
    }

    /**
     * Clear all labels
     */
    clearAllLabels(): void {
        this.labels.forEach(label => {
            this.advancedTexture.removeControl(label.textBlock);
            label.textBlock.dispose();
        });
        this.labels.clear();
    }

    /**
     * Start the counter animation for a label
     */
    private startAnimation(playerId: string): void {
        const label = this.labels.get(playerId);
        if (!label) return;

        label.animationStartTime = Date.now();
        label.isAnimating = true;
        label.currentDistance = 0;
    }

    /**
     * Update all label positions and animations
     * Call this in the render loop
     */
    updateLabels(): void {
        const now = Date.now();

        this.labels.forEach(label => {
            // Update animation
            if (label.isAnimating && label.animationStartTime !== null) {
                const elapsed = now - label.animationStartTime;
                const progress = Math.min(elapsed / this.ANIMATION_DURATION, 1.0);

                // Ease-out cubic
                const easedProgress = 1 - Math.pow(1 - progress, 3);

                label.currentDistance = label.targetDistance * easedProgress;

                if (progress >= 1.0) {
                    label.isAnimating = false;
                    label.currentDistance = label.targetDistance;
                }

                // Update text
                label.textBlock.text = this.formatDistance(label.currentDistance);

                // Update color
                label.textBlock.color = this.getColorForDistance(label.currentDistance);
            }

            // Update 3D position
            this.updateLabelPosition(label);
        });
    }

    /**
     * Update the 2D screen position of a label based on its 3D world position
     */
    private updateLabelPosition(label: DistanceLabel): void {
        // Convert lat/lon to 3D position
        const worldPos = this.latLonToVector3(label.position.lat, label.position.lon);

        // Add height offset (above the pin)
        const normal = worldPos.normalizeToNew();
        const offsetPos = worldPos.add(normal.scale(this.LABEL_HEIGHT_OFFSET));

        // Project to screen coordinates
        const screenPos = Vector3.Project(
            offsetPos,
            Matrix.Identity(),
            this.scene.getTransformMatrix(),
            this.camera.viewport.toGlobal(
                this.scene.getEngine().getRenderWidth(),
                this.scene.getEngine().getRenderHeight()
            )
        );

        // Update GUI position
        label.textBlock.left = screenPos.x;
        label.textBlock.top = screenPos.y;
        label.textBlock.linkOffsetY = 0;
    }

    /**
     * Convert lat/lon to 3D Cartesian position
     */
    private latLonToVector3(lat: number, lon: number): Vector3 {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        const x = -(this.EARTH_RADIUS * Math.sin(phi) * Math.cos(theta));
        const z = this.EARTH_RADIUS * Math.sin(phi) * Math.sin(theta);
        const y = this.EARTH_RADIUS * Math.cos(phi);

        return new Vector3(x, y, z);
    }

    /**
     * Format distance with comma separators
     */
    private formatDistance(distanceKm: number): string {
        const rounded = Math.round(distanceKm);
        const formatted = rounded.toLocaleString('en-US');
        return `${formatted} km`;
    }

    /**
     * Get color based on distance (green = close, yellow = medium, red = far)
     */
    private getColorForDistance(distanceKm: number): string {
        if (distanceKm < this.GREEN_THRESHOLD) {
            return '#4CAF50'; // Green
        } else if (distanceKm < this.YELLOW_THRESHOLD) {
            return '#FFC107'; // Yellow/Amber
        } else {
            return '#F44336'; // Red
        }
    }

    /**
     * Get all labels
     */
    getLabels(): Map<string, DistanceLabel> {
        return this.labels;
    }

    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.clearAllLabels();
        this.advancedTexture.dispose();
    }
}
