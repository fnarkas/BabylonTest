/**
 * Shared test utilities for HTML test pages
 */

import type { Scene } from '@babylonjs/core/scene';

/**
 * Enable Babylon Inspector with Cmd+I (Mac) or Ctrl+I (Windows/Linux) toggle
 * Call this after scene is initialized
 */
export async function enableInspector(scene: Scene): Promise<void> {
    // Import inspector and wait for it to load
    await import('@babylonjs/inspector');

    // Track visibility manually since isVisible() seems unreliable
    let inspectorVisible = false;

    // Add keyboard shortcut for inspector (Cmd+I on Mac, Ctrl+I on Windows/Linux)
    window.addEventListener('keydown', (event) => {
        if ((event.key === 'i' || event.key === 'I') && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();

            if (!scene.debugLayer) return;

            if (inspectorVisible) {
                scene.debugLayer.hide();
                inspectorVisible = false;
            } else {
                scene.debugLayer.show({
                    embedMode: true,
                    overlay: true,
                    globalRoot: document.body
                });
                inspectorVisible = true;
            }
        }
    });
}
