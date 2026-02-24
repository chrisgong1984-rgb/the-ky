import { LucideIcon } from 'lucide-react';

export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  SHOP = 'SHOP',
  GAME_OVER = 'GAME_OVER',
  BOSS_INTRO = 'BOSS_INTRO',
  STORY = 'STORY',
  CHAPTER_SELECT = 'CHAPTER_SELECT',
  ACHIEVEMENTS = 'ACHIEVEMENTS',
}

export enum EnemyType {
  PREDATOR_BUG = 'PREDATOR_BUG',
  STING_SHOOTER = 'STING_SHOOTER',
  ARMORED_GUARD = 'ARMORED_GUARD',
  DEVOURER = 'DEVOURER',
  BOSS_VANGUARD = 'BOSS_VANGUARD',
  BOSS_PREDATOR = 'BOSS_PREDATOR',
  BOSS_CORE = 'BOSS_CORE',
}

export enum ShipType {
  STAR_BLADE_1 = 'STAR_BLADE_1',
  STAR_BLADE_2 = 'STAR_BLADE_2',
  STAR_BLADE_3 = 'STAR_BLADE_3',
}

export enum PowerUpType {
  TRIPLE_SHOT = 'TRIPLE_SHOT',
  SHIELD = 'SHIELD',
  REPAIR = 'REPAIR',
  MEGA_BOMB = 'MEGA_BOMB',
  ENERGY_FRAGMENT = 'ENERGY_FRAGMENT',
}

export enum SceneType {
  STAR_PATH = 'STAR_PATH',
  COLONY = 'COLONY',
  MOTHERHIVE = 'MOTHERHIVE',
  VOID_EDGE = 'VOID_EDGE',
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export interface GameStats {
  score: number;
  level: number;
  chapter: number;
  health: number;
  maxHealth: number;
  coins: number;
  enemiesDestroyed: number;
  powerUpsCollected: number;
  escapedEnemies: number;
  bossesDefeated: number;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'UPGRADE' | 'ITEM' | 'SHIP' | PowerUpType;
  icon: string;
}
