/**
 * Country Selection Behavior
 *
 * Handles visual feedback when a country is selected:
 * - Increases selected country's altitude (extrusion)
 * - Shows country name label
 * - On deselection: resets altitude and hides label
 */

import { Scene } from '@babylonjs/core/scene';
import type { Nullable } from '@babylonjs/core/types';
import type { Observer } from '@babylonjs/core/Misc/observable';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import type { CountryPolygon, LatLon } from './countryPicker';

export interface SelectionBehaviorOptions {
    /** Default altitude for countries (0-1, default: 0.4 which equals 0.08 actual altitude) */
    defaultAltitude?: number;
    /** Altitude value for selected country (0-1, default: 0.5) */
    selectedAltitude?: number;
    /** Altitude value for cleared country (0-1, default: 0.1 which equals 0.02 actual altitude) */
    clearedAltitude?: number;
    /** Animation duration in milliseconds (default: 300) */
    animationDuration?: number;
    /** Label font size (default: "24px") */
    labelFontSize?: string;
    /** Label color (default: "white") */
    labelColor?: string;
    /** Label background color (default: "rgba(0,0,0,0.7)") */
    labelBackground?: string;
}

const DEFAULT_OPTIONS: Required<SelectionBehaviorOptions> = {
    defaultAltitude: 0.4,  // 0.4 * 0.2 (ANIMATION_AMPLITUDE) = 0.08 actual altitude
    selectedAltitude: 0.5,
    clearedAltitude: 0.1,  // 0.1 * 0.2 (ANIMATION_AMPLITUDE) = 0.02 actual altitude
    animationDuration: 300,
    labelFontSize: "24px",
    labelColor: "white",
    labelBackground: "rgba(0,0,0,0.7)"
};

/** Callback type for setting country altitude */
export type SetAltitudeCallback = (countryIndex: number, altitude: number) => void;

/** Callback type for getting country altitude */
export type GetAltitudeCallback = (countryIndex: number) => number;

/** Callback type for setting country saturation */
export type SetSaturationCallback = (countryIndex: number, saturation: number) => void;

/** Callback type for getting country saturation */
export type GetSaturationCallback = (countryIndex: number) => number;

// Max countries we can animate (matches MAX_ANIMATION_COUNTRIES in main.ts)
const MAX_ANIMATED = 256;

/**
 * Manages country selection visual behavior
 */
export class CountrySelectionBehavior {
    private scene: Scene;
    private advancedTexture: AdvancedDynamicTexture;
    private options: Required<SelectionBehaviorOptions>;
    private setAltitude: SetAltitudeCallback;
    private getAltitude: GetAltitudeCallback;
    private setSaturation: SetSaturationCallback;
    private getSaturation: GetSaturationCallback;

    private selectedCountry: CountryPolygon | null = null;
    private countryLabel: TextBlock | null = null;
    private labelContainer: Rectangle | null = null;

    // Animation state - pre-allocated arrays (no garbage per frame)
    private animationObserver: Nullable<Observer<Scene>> = null;
    private animAltitudeTargets: Float32Array;    // Target altitude for each country (-1 = no animation)
    private animAltitudeStartValues: Float32Array; // Start altitude when animation began
    private animAltitudeStartTimes: Float32Array;  // Start time (ms) for each animation
    private animSaturationTargets: Float32Array;    // Target saturation for each country (-1 = no animation)
    private animSaturationStartValues: Float32Array; // Start saturation when animation began
    private animSaturationStartTimes: Float32Array;  // Start time (ms) for each animation
    private animCount: number = 0;         // Number of active animations

    constructor(
        scene: Scene,
        advancedTexture: AdvancedDynamicTexture,
        setAltitude: SetAltitudeCallback,
        getAltitude: GetAltitudeCallback,
        setSaturation: SetSaturationCallback,
        getSaturation: GetSaturationCallback,
        options: SelectionBehaviorOptions = {}
    ) {
        this.scene = scene;
        this.advancedTexture = advancedTexture;
        this.setAltitude = setAltitude;
        this.getAltitude = getAltitude;
        this.setSaturation = setSaturation;
        this.getSaturation = getSaturation;
        this.options = { ...DEFAULT_OPTIONS, ...options };

        // Pre-allocate animation arrays for altitude
        this.animAltitudeTargets = new Float32Array(MAX_ANIMATED);
        this.animAltitudeStartValues = new Float32Array(MAX_ANIMATED);
        this.animAltitudeStartTimes = new Float32Array(MAX_ANIMATED);
        this.animAltitudeTargets.fill(-1);  // -1 = no animation

        // Pre-allocate animation arrays for saturation
        this.animSaturationTargets = new Float32Array(MAX_ANIMATED);
        this.animSaturationStartValues = new Float32Array(MAX_ANIMATED);
        this.animSaturationStartTimes = new Float32Array(MAX_ANIMATED);
        this.animSaturationTargets.fill(-1);  // -1 = no animation

        this.createLabel();
    }

    /**
     * Handle country selection - call this from the country selected callback
     */
    public onCountrySelected(country: CountryPolygon | null, latLon: LatLon): void {
        // Deselect previous country if different
        if (this.selectedCountry && (!country || country.iso2 !== this.selectedCountry.iso2)) {
            this.deselectCountry(this.selectedCountry);
            this.selectedCountry = null;
        }

        if (country) {
            this.selectCountry(country, latLon);
        } else {
            this.hideLabel();
        }
    }

    /**
     * Manually deselect the current country
     */
    public deselectCurrent(): void {
        if (this.selectedCountry) {
            this.deselectCountry(this.selectedCountry);
            this.selectedCountry = null;
        }
        this.hideLabel();
    }

    /**
     * Get the currently selected country
     */
    public getSelectedCountry(): CountryPolygon | null {
        return this.selectedCountry;
    }

    /**
     * Clear selection state (hide label and clear reference) without resetting altitude
     * Used when transitioning to cleared animation
     */
    public clearSelectionState(): void {
        this.selectedCountry = null;
        this.hideLabel();
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        this.stopAllAnimations();
        if (this.labelContainer) {
            this.advancedTexture.removeControl(this.labelContainer);
            this.labelContainer.dispose();
        }
    }

    private createLabel(): void {
        // Create container rectangle for the label
        const container = new Rectangle("countryLabelContainer");
        container.width = "auto";
        container.height = "auto";
        container.adaptWidthToChildren = true;
        container.adaptHeightToChildren = true;
        container.cornerRadius = 8;
        container.color = "transparent";
        container.thickness = 0;
        container.background = this.options.labelBackground;
        container.paddingLeft = "12px";
        container.paddingRight = "12px";
        container.paddingTop = "8px";
        container.paddingBottom = "8px";
        container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        container.top = "60px";
        container.isVisible = false;

        // Create text label
        const label = new TextBlock("countryLabel");
        label.text = "";
        label.color = this.options.labelColor;
        label.fontSize = this.options.labelFontSize;
        label.fontWeight = "bold";
        label.resizeToFit = true;
        label.textWrapping = true;  // Enable text wrapping

        container.addControl(label);
        this.advancedTexture.addControl(container);

        this.labelContainer = container;
        this.countryLabel = label;
    }

    private selectCountry(country: CountryPolygon, latLon: LatLon): void {
        this.selectedCountry = country;

        // Show and update label
        if (this.countryLabel && this.labelContainer) {
            this.countryLabel.text = country.name;
            this.labelContainer.isVisible = true;
        }

        // Set altitude immediately (no animation for hover feedback)
        this.animateAltitude(country.countryIndex, this.options.selectedAltitude, false);
        console.log(`Selected: ${country.name} (${country.iso2})`);
    }

    private deselectCountry(country: CountryPolygon): void {
        // Reset altitude to default (no animation for hover feedback)
        this.animateAltitude(country.countryIndex, this.options.defaultAltitude, false);
        console.log(`Deselected: ${country.name} (${country.iso2})`);
    }

    private hideLabel(): void {
        if (this.labelContainer) {
            this.labelContainer.isVisible = false;
        }
    }

    private animateAltitude(countryIndex: number, targetValue: number, animate: boolean = true): void {
        if (countryIndex < 0 || countryIndex >= MAX_ANIMATED) return;

        // Immediate jump - no animation
        if (!animate) {
            // Clear any pending animation for this country
            if (this.animAltitudeTargets[countryIndex] >= 0) {
                this.animAltitudeTargets[countryIndex] = -1;
                this.animCount--;
            }
            this.setAltitude(countryIndex, targetValue);
            return;
        }

        // Get current altitude as start value (handles interrupting ongoing animations)
        const currentAltitude = this.getAltitude(countryIndex);

        // Check if this is a new animation
        const isNew = this.animAltitudeTargets[countryIndex] < 0;

        // Set animation state in pre-allocated arrays
        this.animAltitudeTargets[countryIndex] = targetValue;
        this.animAltitudeStartValues[countryIndex] = currentAltitude;
        this.animAltitudeStartTimes[countryIndex] = performance.now();

        if (isNew) {
            this.animCount++;
        }

        // Start the animation loop if not already running
        this.ensureAnimationLoop();
    }

    private ensureAnimationLoop(): void {
        if (this.animationObserver) return;

        this.animationObserver = this.scene.onBeforeRenderObservable.add(() => {
            const now = performance.now();
            const duration = this.options.animationDuration;

            // Update all active animations (iterate through array, no allocations)
            for (let i = 0; i < MAX_ANIMATED; i++) {
                // Animate altitude
                const altitudeTarget = this.animAltitudeTargets[i];
                if (altitudeTarget >= 0) {  // Has active animation
                    const elapsed = now - this.animAltitudeStartTimes[i];
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);  // Ease out cubic

                    const startValue = this.animAltitudeStartValues[i];
                    const currentValue = startValue + (altitudeTarget - startValue) * eased;
                    this.setAltitude(i, currentValue);

                    if (progress >= 1) {
                        this.animAltitudeTargets[i] = -1;  // Clear animation
                        this.animCount--;
                    }
                }

                // Animate saturation
                const saturationTarget = this.animSaturationTargets[i];
                if (saturationTarget >= 0) {  // Has active animation
                    const elapsed = now - this.animSaturationStartTimes[i];
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);  // Ease out cubic

                    const startValue = this.animSaturationStartValues[i];
                    const currentValue = startValue + (saturationTarget - startValue) * eased;
                    this.setSaturation(i, currentValue);

                    if (progress >= 1) {
                        this.animSaturationTargets[i] = -1;  // Clear animation
                        this.animCount--;
                    }
                }
            }

            // Stop the loop if no more animations
            if (this.animCount <= 0) {
                this.animCount = 0;
                this.stopAnimationLoop();
            }
        });
    }

    private stopAnimationLoop(): void {
        if (this.animationObserver) {
            this.scene.onBeforeRenderObservable.remove(this.animationObserver);
            this.animationObserver = null;
        }
    }

    private stopAllAnimations(): void {
        this.animAltitudeTargets.fill(-1);
        this.animSaturationTargets.fill(-1);
        this.animCount = 0;
        this.stopAnimationLoop();
    }

    /**
     * Animate saturation for a country
     * @param countryIndex The country index
     * @param targetValue Target saturation value (0-1)
     * @param animate Whether to animate (true) or jump immediately (false)
     */
    private animateSaturation(countryIndex: number, targetValue: number, animate: boolean = true): void {
        if (countryIndex < 0 || countryIndex >= MAX_ANIMATED) return;

        // Immediate jump - no animation
        if (!animate) {
            // Clear any pending animation for this country
            if (this.animSaturationTargets[countryIndex] >= 0) {
                this.animSaturationTargets[countryIndex] = -1;
                this.animCount--;
            }
            this.setSaturation(countryIndex, targetValue);
            return;
        }

        // Get current saturation as start value (handles interrupting ongoing animations)
        const currentSaturation = this.getSaturation(countryIndex);

        // Check if this is a new animation
        const isNew = this.animSaturationTargets[countryIndex] < 0;

        // Set animation state in pre-allocated arrays
        this.animSaturationTargets[countryIndex] = targetValue;
        this.animSaturationStartValues[countryIndex] = currentSaturation;
        this.animSaturationStartTimes[countryIndex] = performance.now();

        if (isNew) {
            this.animCount++;
        }

        // Start the animation loop if not already running
        this.ensureAnimationLoop();
    }

    /**
     * Animate country to "cleared" state (grey and slightly above surface)
     * @param countryIndex The country index
     */
    public animateToCleared(countryIndex: number): void {
        // Animate altitude from current (0.5 when hovered) to cleared altitude (slightly above surface)
        this.animateAltitude(countryIndex, this.options.clearedAltitude, true);
        // Animate saturation from current (1.0 = colored) to 0 (grey)
        this.animateSaturation(countryIndex, 0, true);
    }
}
