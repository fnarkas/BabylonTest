/**
 * Country Label UI Module
 * Displays a country name card at the top of the screen
 * This is a work-in-progress feature for future use
 */

import { AdvancedDynamicTexture, Image, TextBlock, Control } from '@babylonjs/gui';

export class CountryLabelUI {
    private advancedTexture: AdvancedDynamicTexture;
    private countryCard: Image | null = null;
    private countryText: TextBlock | null = null;

    constructor(advancedTexture: AdvancedDynamicTexture) {
        this.advancedTexture = advancedTexture;
    }

    /**
     * Show the country label card with the given country name
     */
    show(countryName: string): void {
        // Create nine-patch country card at top center
        this.countryCard = new Image("countryCard", "/question_card_simple.png");
        this.countryCard.width = "300px";
        this.countryCard.height = "100px";
        this.countryCard.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.countryCard.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.countryCard.top = "20px";
        this.countryCard.isPointerBlocker = false;

        // Set nine-patch stretch mode
        this.countryCard.stretch = Image.STRETCH_NINE_PATCH;

        // Set slice values - these are absolute positions from origin for a 101x101 image
        this.countryCard.sliceLeft = 10;    // Left border ends at x=10
        this.countryCard.sliceRight = 91;   // Right border starts at x=91 (101-10)
        this.countryCard.sliceTop = 10;     // Top border ends at y=10
        this.countryCard.sliceBottom = 91;  // Bottom border starts at y=91 (101-10)

        // Add card to GUI
        this.advancedTexture.addControl(this.countryCard);

        // Create text for the country name (layered on top)
        this.countryText = new TextBlock("countryText", countryName);
        this.countryText.width = "300px";
        this.countryText.height = "100px";
        this.countryText.color = "#003366";  // Dark blue color
        this.countryText.fontSize = 32;
        this.countryText.fontWeight = "bold";
        this.countryText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.countryText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.countryText.top = "20px";
        this.countryText.isPointerBlocker = false;

        // Add text to GUI (on top of the card)
        this.advancedTexture.addControl(this.countryText);

        console.log(`Country label shown: ${countryName}`);
    }

    /**
     * Hide the country label
     */
    hide(): void {
        if (this.countryCard) {
            this.advancedTexture.removeControl(this.countryCard);
            this.countryCard.dispose();
            this.countryCard = null;
        }

        if (this.countryText) {
            this.advancedTexture.removeControl(this.countryText);
            this.countryText.dispose();
            this.countryText = null;
        }
    }

    /**
     * Update the displayed country name
     */
    updateCountry(countryName: string): void {
        if (this.countryText) {
            this.countryText.text = countryName;
        } else {
            // If not visible, show it
            this.show(countryName);
        }
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.hide();
    }
}
