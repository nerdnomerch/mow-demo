import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MainScene } from "./scenes/MainScene";
import { UIScene } from "./scenes/UIScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: "game-container",
    width: window.innerWidth,
    height: window.innerHeight,
  },
  roundPixels: true,
  antialias: true,
  pixelArt: true,
  physics: {
    default: "arcade",
  },
  scene: [BootScene, MainScene, UIScene],
};

export const game = new Phaser.Game(config);
