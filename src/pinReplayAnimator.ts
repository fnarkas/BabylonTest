/**
 * Pin Replay Animator Module
 * Animates recorded pin movements for multiple players simultaneously
 */

import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { hexToRgb } from '../shared/playerColors';
import type { PinRecording } from './pinRecorder';

const EARTH_RADIUS = 2.0;
const ANIMATION_SPEED = 1.0; // 1.0 = real-time, 2.0 = 2x speed, etc.

interface AnimatedPin {
    playerId: string;
    mesh: TransformNode;
    animationGroup: AnimationGroup;
}

export class PinReplayAnimator {
    private scene: Scene;
    private camera: ArcRotateCamera;
    private bossPinTemplate: AbstractMesh | null = null;
    private animatedPins: AnimatedPin[] = [];
    private onCompleteCallback: (() => void) | null = null;

    constructor(scene: Scene, camera: ArcRotateCamera) {
        this.scene = scene;
        this.camera = camera;
    }

    /**
     * Initialize by loading the pin model
     */
    async init(): Promise<void> {
        await this.loadBossPinModel();
    }

    /**
     * Load the BossPin model to use as template
     */
    private async loadBossPinModel(): Promise<void> {
        try {
            const result = await SceneLoader.ImportMeshAsync("", "/", "BossPin.glb", this.scene);
            if (result.meshes.length === 0) {
                console.error('No meshes found in BossPin model');
                return;
            }
            const rootMesh = result.meshes[0];
            rootMesh.setEnabled(false);
            this.bossPinTemplate = rootMesh;
            console.log('PinReplayAnimator: BossPin model loaded');
        } catch (error) {
            console.error('Failed to load BossPin model:', error);
        }
    }

    /**
     * Play animations for multiple player recordings simultaneously
     */
    async playRecordings(recordings: PinRecording[], onComplete?: () => void): Promise<void> {
        if (!this.bossPinTemplate) {
            console.error('Cannot play recordings: BossPin template not loaded');
            return;
        }

        // Clear any existing animations
        this.clearAnimations();

        this.onCompleteCallback = onComplete || null;

        // Create animated pins for each recording
        for (const recording of recordings) {
            const animatedPin = this.createAnimatedPin(recording);
            if (animatedPin) {
                this.animatedPins.push(animatedPin);
            }
        }

        // Start all animations
        console.log(`PinReplayAnimator: Starting ${this.animatedPins.length} animations`);

        // Listen for the first animation to complete (they should all finish at roughly the same time)
        if (this.animatedPins.length > 0) {
            const firstAnimation = this.animatedPins[0].animationGroup;
            firstAnimation.onAnimationGroupEndObservable.addOnce(() => {
                this.handleAnimationsComplete();
            });

            // Start all animations
            this.animatedPins.forEach(pin => {
                pin.animationGroup.start(false, ANIMATION_SPEED);
            });
        }
    }

    /**
     * Create an animated pin from a recording
     */
    private createAnimatedPin(recording: PinRecording): AnimatedPin | null {
        if (!this.bossPinTemplate || recording.positions.length === 0) return null;

        // Create pin mesh
        const pinPivot = new TransformNode(`replayPin_${recording.playerId}`, this.scene);
        const pinContainer = new TransformNode(`replayPinContainer_${recording.playerId}`, this.scene);
        pinContainer.parent = pinPivot;

        const pinScale = 150;
        pinContainer.scaling = new Vector3(pinScale, pinScale, pinScale);

        // Clone meshes and apply color
        this.bossPinTemplate.getChildMeshes().forEach(mesh => {
            const cloned = mesh.clone(`replayPinMesh_${recording.playerId}`, pinContainer);
            if (cloned) {
                cloned.setEnabled(true);
                const coloredMaterial = this.createColoredMaterial(recording.color);
                cloned.material = coloredMaterial;
            }
        });

        // Create animation for position and rotation
        const animationGroup = this.createAnimationFromRecording(pinPivot, recording);

        return {
            playerId: recording.playerId,
            mesh: pinPivot,
            animationGroup
        };
    }

    /**
     * Create Babylon.js animation from recorded positions
     */
    private createAnimationFromRecording(pinMesh: TransformNode, recording: PinRecording): AnimationGroup {
        const positions = recording.positions;
        const fps = 60;

        // Create position animation
        const positionAnimation = new Animation(
            `positionAnim_${recording.playerId}`,
            'position',
            fps,
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        // Create rotation animation
        const rotationAnimation = new Animation(
            `rotationAnim_${recording.playerId}`,
            'rotationQuaternion',
            fps,
            Animation.ANIMATIONTYPE_QUATERNION,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const positionKeys = [];
        const rotationKeys = [];

        // Convert recorded positions to animation keyframes
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            const frame = (pos.timestamp / 1000) * fps; // Convert ms to frames

            // Convert lat/lon to cartesian
            const latRad = pos.lat * (Math.PI / 180);
            const lonRad = pos.lon * (Math.PI / 180);

            const x = EARTH_RADIUS * Math.cos(latRad) * Math.cos(lonRad);
            const y = EARTH_RADIUS * Math.sin(latRad);
            const z = EARTH_RADIUS * Math.cos(latRad) * Math.sin(lonRad);

            const position = new Vector3(x, y, z);
            const normal = position.normalizeToNew();

            // Position keyframe
            positionKeys.push({
                frame: frame,
                value: normal.scale(EARTH_RADIUS)
            });

            // Rotation keyframe (orient pin to point outward)
            const upVector = Vector3.Up();
            const quaternion = new Quaternion();
            Quaternion.FromUnitVectorsToRef(upVector, normal, quaternion);

            rotationKeys.push({
                frame: frame,
                value: quaternion
            });
        }

        positionAnimation.setKeys(positionKeys);
        rotationAnimation.setKeys(rotationKeys);

        // Create animation group
        const animationGroup = new AnimationGroup(`pinReplay_${recording.playerId}`, this.scene);
        animationGroup.addTargetedAnimation(positionAnimation, pinMesh);
        animationGroup.addTargetedAnimation(rotationAnimation, pinMesh);

        return animationGroup;
    }

    /**
     * Create a colored material for the pin
     */
    private createColoredMaterial(hexColor: string): StandardMaterial {
        const material = new StandardMaterial(`replayPinMaterial_${hexColor}`, this.scene);
        const rgb = hexToRgb(hexColor);

        material.diffuseColor = new Color3(rgb.r, rgb.g, rgb.b);
        material.emissiveColor = new Color3(rgb.r * 0.5, rgb.g * 0.5, rgb.b * 0.5);
        material.specularColor = new Color3(0, 0, 0);

        return material;
    }

    /**
     * Handle animation completion
     */
    private handleAnimationsComplete(): void {
        console.log('PinReplayAnimator: All animations complete');

        if (this.onCompleteCallback) {
            this.onCompleteCallback();
        }
    }

    /**
     * Clear all animations and remove pin meshes
     */
    clearAnimations(): void {
        this.animatedPins.forEach(pin => {
            pin.animationGroup.stop();
            pin.animationGroup.dispose();
            pin.mesh.dispose();
        });
        this.animatedPins = [];
    }

    /**
     * Stop animations early
     */
    stopAnimations(): void {
        this.animatedPins.forEach(pin => {
            pin.animationGroup.stop();
        });
    }

    /**
     * Set animation playback speed (1.0 = normal, 2.0 = 2x speed)
     */
    setSpeed(speed: number): void {
        this.animatedPins.forEach(pin => {
            pin.animationGroup.speedRatio = speed;
        });
    }
}
