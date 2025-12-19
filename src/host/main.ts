// Babylon.js Earth Globe Application
// Main entry point - initializes EarthGlobe

// Inspector - only include in development builds
if (import.meta.env.DEV) {
    import('@babylonjs/inspector');
}

import { EarthGlobe } from '../earthGlobe';
import { Game } from './game';

// Initialize the application when page loads
window.addEventListener('DOMContentLoaded', () => {
    const globe = new EarthGlobe('renderCanvas', {
        onReady: (globe) => {
            // Globe is now fully initialized, safe to wire up callbacks

            // Create and start game (host-specific logic)
            const game = new Game();
            game.start();

            // Wire PinManager to Game for pin placement
            const pinManager = globe.getPinManager();
            pinManager.onPinPlaced((country, latLon) => {
                game.handlePinPlaced(country, latLon);
            });

            // Wire Game to globe animations when country is cleared
            game.onCountryCleared((country) => {
                const selectionBehavior = globe.getSelectionBehavior();
                if (selectionBehavior) {
                    selectionBehavior.animateToCleared(country.countryIndex);
                    selectionBehavior.clearSelectionState();
                }
            });
        }
    });

    // Make the globe accessible globally for debugging and external use
    (window as unknown as { earthGlobe: EarthGlobe }).earthGlobe = globe;
});

// Export for external use
export { EarthGlobe };
export type { CountryPolygon, LatLon } from '../countryPicker';
