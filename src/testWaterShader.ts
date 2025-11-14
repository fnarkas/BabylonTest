/**
 * Test page entry point for water shader
 */

import * as BABYLON from "@babylonjs/core";
import { createWaterMaterial } from "./waterShader";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new BABYLON.Engine(canvas, true);

const createScene = () => {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.15, 1);

  // Camera
  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    0,
    Math.PI / 3,
    10,
    BABYLON.Vector3.Zero(),
    scene
  );
  camera.attachControl(canvas, true);

  // Light
  const light = new BABYLON.HemisphericLight(
    "light",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );
  light.intensity = 0.7;

  // Create sphere with water shader
  const sphere = BABYLON.MeshBuilder.CreateSphere(
    "sphere",
    { diameter: 4, segments: 64 },
    scene
  );

  // Apply enhanced water material with ocean depth map
  const waterMaterial = createWaterMaterial(scene, "OceanDepthMap.png", "water");
  sphere.material = waterMaterial;

  return scene;
};

const scene = createScene();

engine.runRenderLoop(() => {
  scene.render();
});

window.addEventListener("resize", () => {
  engine.resize();
});
