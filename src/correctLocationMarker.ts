/**
 * Correct Location Marker
 * Shows the correct answer location with a special golden star marker and pulsing animation
 */

import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Animation } from '@babylonjs/core/Animations/animation';
import { CircleEase, EasingFunction } from '@babylonjs/core/Animations/easing';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { EarthGlobe } from './earthGlobe';

export class CorrectLocationMarker {
    private scene: Scene;
    private camera: ArcRotateCamera;
    private earthGlobe: EarthGlobe;
    private earthSphere: any; // The earth mesh to parent to
    private marker: TransformNode | null = null;
    private starMesh: Mesh | null = null;
    private pulseAnimation: Animation | null = null;
    private isAnimating: boolean = false;

    constructor(scene: Scene, camera: ArcRotateCamera, earthGlobe: EarthGlobe) {
        this.scene = scene;
        this.camera = camera;
        this.earthGlobe = earthGlobe;
        this.earthSphere = earthGlobe.getEarthSphere();
    }

    /**
     * Show the correct location marker at the given lat/lon
     */
    show(lat: number, lon: number): void {
        // Remove existing marker if any
        this.hide();

        // Create marker pivot in world space
        this.marker = new TransformNode('correctLocationMarker', this.scene);

        // Create star mesh
        this.starMesh = this.createStarMesh();
        this.starMesh.parent = this.marker;

        // Position the marker
        this.positionMarker(lat, lon);
    }

    /**
     * Hide the correct location marker
     */
    hide(): void {
        if (this.marker) {
            this.marker.dispose();
            this.marker = null;
        }
        if (this.starMesh) {
            this.starMesh.dispose();
            this.starMesh = null;
        }
        this.pulseAnimation = null;
        this.isAnimating = false;
    }

    /**
     * Start pulsing animation
     */
    startPulseAnimation(): void {
        if (!this.starMesh || this.isAnimating) return;

        // Get current scale (managed by updateScale())
        const currentScale = this.starMesh.scaling.x;

        // Create scale animation that pulses from current size to 1.5x
        const scaleAnimation = new Animation(
            'starPulse',
            'scaling.x', // Animate each component
            30,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        const keys = [
            { frame: 0, value: currentScale },
            { frame: 30, value: currentScale * 1.5 },
            { frame: 60, value: currentScale }
        ];

        scaleAnimation.setKeys(keys);

        // Add easing for smooth animation
        const easingFunction = new CircleEase();
        easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        scaleAnimation.setEasingFunction(easingFunction);

        // Apply animation to all three axes
        const animationX = scaleAnimation.clone();
        animationX.targetProperty = 'scaling.x';
        const animationY = scaleAnimation.clone();
        animationY.targetProperty = 'scaling.y';
        const animationZ = scaleAnimation.clone();
        animationZ.targetProperty = 'scaling.z';

        this.starMesh.animations = [animationX, animationY, animationZ];
        this.scene.beginAnimation(this.starMesh, 0, 60, true);
        this.isAnimating = true;
    }

    /**
     * Stop pulsing animation
     */
    stopPulseAnimation(): void {
        if (!this.starMesh) return;

        this.scene.stopAnimation(this.starMesh);
        this.isAnimating = false;

        // Reset scale - updateScale() will set it correctly in the next frame
        this.updateScale();
    }

    /**
     * Update marker scale based on camera distance (call in render loop)
     */
    updateScale(): void {
        if (!this.marker || !this.starMesh) return;

        // Scale based on camera distance to maintain consistent visual size
        const baseScale = 10; // Small but visible
        const referenceRadius = 10;
        const scaleFactor = baseScale * (this.camera.radius / referenceRadius);

        this.starMesh.scaling.setAll(scaleFactor);
    }

    /**
     * Get the current marker position
     */
    getPosition(): { lat: number; lon: number } | null {
        if (!this.marker) return null;

        const pos = this.marker.position;
        const normal = pos.normalizeToNew(); // Use normalizeToNew() to avoid modifying position!

        // Convert back to lat/lon
        const lat = Math.asin(normal.y) * (180 / Math.PI);
        const lon = Math.atan2(normal.z, normal.x) * (180 / Math.PI);

        return { lat, lon };
    }

    /**
     * Check if marker is currently visible
     */
    isVisible(): boolean {
        return this.marker !== null && this.marker.isEnabled();
    }

    /**
     * Set visibility of the marker
     */
    setVisible(visible: boolean): void {
        if (this.marker) {
            this.marker.setEnabled(visible);
        }
    }

    /**
     * Create a golden star mesh
     */
    private createStarMesh(): Mesh {
        // Create a cylinder to represent the star marker (like a pin but with different styling)
        const star = MeshBuilder.CreateCylinder('star', {
            diameterTop: 0,
            diameterBottom: 0.015,
            height: 0.2,
            tessellation: 8
        }, this.scene);

        // Create golden material with glow
        const material = new StandardMaterial('correctMarkerMat', this.scene);
        material.diffuseColor = new Color3(1.0, 0.84, 0.0);  // Golden color
        material.emissiveColor = new Color3(0.8, 0.67, 0.0); // Golden glow
        material.specularColor = new Color3(1.0, 1.0, 0.8);  // Shiny highlights

        star.material = material;

        return star;
    }

    /**
     * Position the marker at the given lat/lon on the globe
     */
    private positionMarker(lat: number, lon: number): void {
        if (!this.marker) return;

        // Use the earthGlobe API to get correct position and normal
        // Uses default altitude (COUNTRY_ALTITUDE + 0.01) to position just above countries
        const { position, normal } = this.earthGlobe.positionAtLatLon(lat, lon);

        // Set the marker position directly (position already includes altitude)
        this.marker.position.copyFrom(position);

        // Orient the marker to point outward from globe
        const upVector = Vector3.Up();
        const quaternion = new Quaternion();
        Quaternion.FromUnitVectorsToRef(upVector, normal, quaternion);
        this.marker.rotationQuaternion = quaternion;
    }
}
