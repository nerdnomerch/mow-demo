import * as fs from "fs";
import * as path from "path";

interface Tileset {
  firstgid: number;
  image: string;
  imageheight: number;
  imagewidth: number;
  name: string;
  tilecount: number;
  tileheight: number;
  tilewidth: number;
  tiles?: Tile[];
}

interface Tile {
  id: number;
  properties?: { name: string; type: string; value: any }[];
}

interface Layer {
  name: string;
  type: string;
  data: number[];
  height: number;
  width: number;
  x: number;
  y: number;
  visible: boolean;
  opacity: number;
  properties?: { [key: string]: any };
}

interface Tilemap {
  layers: Layer[];
  tilesets: Tileset[];
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  type: string;
  version: string;
  orientation: string;
  renderorder: string;
  tiledversion: string;
  nextlayerid: number;
  nextobjectid: number;
  infinite: boolean;
}

export class MapLoader {
  private map: Tilemap;
  private collidableTiles: Set<number>;

  constructor(mapPath: string) {
    const fullPath = path.resolve(mapPath);
    const rawData = fs.readFileSync(fullPath, "utf-8");
    this.map = JSON.parse(rawData);
    this.collidableTiles = this.findCollidableTiles();
  }

  private findCollidableTiles(): Set<number> {
    const collidableTiles = new Set<number>();
    for (const tileset of this.map.tilesets) {
      for (const tile of tileset.tiles || []) {
        if (
          tile.properties?.some(
            (prop) => prop.name === "collideable" && prop.value
          )
        ) {
          collidableTiles.add(tile.id + tileset.firstgid);
        }
      }
    }
    return collidableTiles;
  }

  isTileBlocked(x: number, y: number): boolean {
    for (const layer of this.map.layers) {
      if (layer.type !== "tilelayer") continue;

      if (x < 0 || x >= layer.width || y < 0 || y >= layer.height) {
        return true; // Out of bounds tiles are blocked
      }

      const index = y * layer.width + x;
      const tile = layer.data[index];
      if (this.collidableTiles.has(tile)) {
        return true;
      }
    }
    return false;
  }
}
