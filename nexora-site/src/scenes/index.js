import { OrbitScene } from './OrbitScene.js';
import { DiamondMapScene } from './DiamondMapScene.js';
import { DataCenterScene } from './DataCenterScene.js';
import { QuantumScene } from './QuantumScene.js';
import { CardsScene } from './CardsScene.js';
import { CarScene } from './CarScene.js';

// id da cena (config.SCENES) → classe
export const sceneClasses = {
  orbit: OrbitScene,
  diamondMap: DiamondMapScene,
  dataCenter: DataCenterScene,
  quantum: QuantumScene,
  cards: CardsScene,
  car: CarScene,
};
