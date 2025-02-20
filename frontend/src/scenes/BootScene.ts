import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    this.load.tilemapTiledJSON("map", "assets/maps/level.json");
    this.load.image("tiles", "assets/tilesets/plains.png");
    this.load.image("grass", "assets/tilesets/grass.png");
    this.load.image("water-sheet", "assets/tilesets/water-sheet.png");
    this.load.image("objects", "assets/objects/objects.png");

    this.load.spritesheet("player", "assets/images/player.png", {
      frameWidth: 48,
      frameHeight: 48,
      // used tile extruder to avoid pixel bleeding
      // https://www.html5gamedevs.com/topic/38809-sprite-is-not-rendered-correctly-extra-lines-on-the-edge/?do=findComment&comment=221678
      // adds a margin and spacing post transformation
      margin: 1,
      spacing: 2,
    });
    this.load.spritesheet("slime", "assets/images/slime.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create() {
    Player.createAnimations(this);
    Enemy.createAnimations(this);
    this.scene.start("MainScene");
  }
}
