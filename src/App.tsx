/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Trophy, 
  Shield, 
  Zap, 
  Heart, 
  Info, 
  ChevronRight,
  Target,
  Skull,
  Star,
  Gamepad2,
  Volume2,
  VolumeX,
  Coins,
  ShoppingBag,
  X,
  Rocket,
  CheckCircle2,
  Map,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GameState, EnemyType, PowerUpType, Achievement, GameStats, ShopItem, ShipType, SceneType } from './types';
import { audioService } from './services/audioService';

// --- Constants ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 900;
const PLAYER_SPEED = 7;
const BULLET_SPEED = 10;
const INITIAL_HEALTH = 3;
const INVINCIBILITY_DURATION = 2000; // ms

// --- Game Classes ---

class Bullet {
  x: number;
  y: number;
  radius: number = 3;
  color: string = '#00f2ff';
  speed: number = BULLET_SPEED;
  angle: number;

  constructor(x: number, y: number, angle: number = -Math.PI / 2) {
    this.x = x;
    this.y = y;
    this.angle = angle;
  }

  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.restore();
  }
}

class EnemyBullet {
  x: number;
  y: number;
  radius: number = 4;
  color: string = '#ff3d00';
  speed: number = 5;
  angle: number;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    this.angle = angle;
  }

  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.restore();
  }
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number = 1.0;
  decay: number;
  color: string;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 8;
    this.vy = (Math.random() - 0.5) * 8;
    this.decay = Math.random() * 0.02 + 0.02;
    this.color = color;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }
}

class Enemy {
  x: number;
  y: number;
  width: number;
  height: number;
  type: EnemyType;
  health: number;
  maxHealth: number;
  speed: number;
  color: string;
  scoreValue: number;
  pulse: number = 0;
  evolution: number = 0; // For Devourer
  lastShot: number = 0;

  constructor(x: number, type: EnemyType, level: number) {
    this.x = x;
    this.y = -100;
    this.type = type;
    
    switch (type) {
      case EnemyType.PREDATOR_BUG:
        this.width = 25;
        this.height = 25;
        this.health = 1;
        this.speed = 4 + (level * 0.5);
        this.color = '#1a1a1a';
        this.scoreValue = 50;
        break;
      case EnemyType.STING_SHOOTER:
        this.width = 35;
        this.height = 35;
        this.health = 2 + Math.floor(level / 3);
        this.speed = 2.5 + (level * 0.2);
        this.color = '#7b1fa2';
        this.scoreValue = 100;
        break;
      case EnemyType.ARMORED_GUARD:
        this.width = 55;
        this.height = 55;
        this.health = 8 + level;
        this.speed = 1.5 + (level * 0.1);
        this.color = '#2e7d32';
        this.scoreValue = 300;
        break;
      case EnemyType.DEVOURER:
        this.width = 40;
        this.height = 40;
        this.health = 4 + level;
        this.speed = 2 + (level * 0.2);
        this.color = '#000000';
        this.scoreValue = 200;
        break;
      case EnemyType.BOSS_VANGUARD:
        this.width = 180;
        this.height = 150;
        this.health = 100 + (level * 50);
        this.speed = 0.5;
        this.color = '#4a148c';
        this.scoreValue = 5000;
        this.x = CANVAS_WIDTH / 2 - this.width / 2;
        break;
      case EnemyType.BOSS_PREDATOR:
        this.width = 200;
        this.height = 180;
        this.health = 250 + (level * 100);
        this.speed = 0.4;
        this.color = '#1b1b1b';
        this.scoreValue = 10000;
        this.x = CANVAS_WIDTH / 2 - this.width / 2;
        break;
      case EnemyType.BOSS_CORE:
        this.width = 300;
        this.height = 250;
        this.health = 1000 + (level * 500);
        this.speed = 0.2;
        this.color = '#b71c1c';
        this.scoreValue = 50000;
        this.x = CANVAS_WIDTH / 2 - this.width / 2;
        break;
      default:
        this.width = 40;
        this.height = 40;
        this.health = 2;
        this.speed = 3;
        this.color = '#9c27b0';
        this.scoreValue = 100;
    }
    this.maxHealth = this.health;
  }

  update(time: number, enemyBullets: EnemyBullet[], playerX: number, playerY: number) {
    if (this.type.startsWith('BOSS')) {
      this.y = Math.min(150, this.y + this.speed);
      this.x += Math.sin(time / 1000) * 2;
      
      // Boss Shooting
      const shootInterval = this.type === EnemyType.BOSS_CORE ? 500 : 1000;
      if (time - this.lastShot > shootInterval) {
        if (this.type === EnemyType.BOSS_VANGUARD) {
          // Aimed shot
          const angle = Math.atan2(playerY - (this.y + this.height / 2), playerX - (this.x + this.width / 2));
          enemyBullets.push(new EnemyBullet(this.x + this.width / 2, this.y + this.height / 2, angle));
        } else if (this.type === EnemyType.BOSS_PREDATOR) {
          // Spread shot
          for (let i = -1; i <= 1; i++) {
            const angle = Math.atan2(playerY - (this.y + this.height / 2), playerX - (this.x + this.width / 2)) + (i * 0.3);
            enemyBullets.push(new EnemyBullet(this.x + this.width / 2, this.y + this.height / 2, angle));
          }
        } else if (this.type === EnemyType.BOSS_CORE) {
          // Circular burst
          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI * 2) / 8 + (time / 1000);
            enemyBullets.push(new EnemyBullet(this.x + this.width / 2, this.y + this.height / 2, angle));
          }
        }
        this.lastShot = time;
      }
    } else if (this.type === EnemyType.DEVOURER) {
      this.y += this.speed;
      // Devourer evolution logic could go here (e.g. check distance to other enemies)
    } else {
      this.y += this.speed;
    }
    this.pulse += 0.1;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    
    const scale = 1 + Math.sin(this.pulse) * 0.05;
    ctx.scale(scale, scale);

    if (this.type === EnemyType.PREDATOR_BUG) {
      // Predator Bug: Small, fast, transparent wings
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(0, -this.height/2);
      ctx.lineTo(this.width/2, this.height/2);
      ctx.lineTo(0, this.height/3);
      ctx.lineTo(-this.width/2, this.height/2);
      ctx.closePath();
      ctx.fill();
      
      // Wings
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.ellipse(-10, 0, 15, 5, Math.PI/4, 0, Math.PI*2);
      ctx.ellipse(10, 0, 15, 5, -Math.PI/4, 0, Math.PI*2);
      ctx.fill();
    } else if (this.type === EnemyType.STING_SHOOTER) {
      // Sting Shooter: Oval with spikes
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.width/2, this.height/3, 0, 0, Math.PI*2);
      ctx.fill();
      
      // Spikes
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
        ctx.lineTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
        ctx.stroke();
      }
    } else if (this.type === EnemyType.ARMORED_GUARD) {
      // Armored Guard: Heavy shell
      ctx.fillStyle = '#1b5e20';
      ctx.beginPath();
      ctx.arc(0, 0, this.width/2, Math.PI, 0);
      ctx.lineTo(this.width/2, this.height/2);
      ctx.lineTo(-this.width/2, this.height/2);
      ctx.closePath();
      ctx.fill();
      
      // Glowing eyes
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(-10, -5, 3, 0, Math.PI*2);
      ctx.arc(10, -5, 3, 0, Math.PI*2);
      ctx.fill();
    } else if (this.type === EnemyType.BOSS_VANGUARD) {
      // Vanguard Boss
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(0, -this.height/2);
      ctx.lineTo(this.width/2, 0);
      ctx.lineTo(this.width/3, this.height/2);
      ctx.lineTo(-this.width/3, this.height/2);
      ctx.lineTo(-this.width/2, 0);
      ctx.closePath();
      ctx.fill();
      
      // Large wings
      ctx.fillStyle = '#311b92';
      ctx.beginPath();
      ctx.moveTo(-this.width/2, 0);
      ctx.lineTo(-this.width*0.8, this.height/2);
      ctx.lineTo(-this.width/2, this.height/3);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(this.width/2, 0);
      ctx.lineTo(this.width*0.8, this.height/2);
      ctx.lineTo(this.width/2, this.height/3);
      ctx.fill();
    } else {
      // Default / Devourer
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.width/2, 0, Math.PI*2);
      ctx.fill();
    }

    // Health bar for Boss/Elite
    if (this.health < this.maxHealth) {
      ctx.restore();
      ctx.save();
      ctx.translate(this.x, this.y - 15);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, 0, this.width, 6);
      ctx.fillStyle = this.type.startsWith('BOSS') ? '#f44336' : '#4caf50';
      ctx.fillRect(0, 0, (this.health / this.maxHealth) * this.width, 6);
    }

    ctx.restore();
  }
}

class Coin {
  x: number;
  y: number;
  radius: number = 8;
  speed: number = 3;
  value: number;

  constructor(x: number, y: number, value: number = 1) {
    this.x = x;
    this.y = y;
    this.value = value;
  }

  update() {
    this.y += this.speed;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffd700';
    ctx.fill();
    
    ctx.fillStyle = '#b8860b';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', this.x, this.y);
    ctx.restore();
  }
}

class PowerUp {
  x: number;
  y: number;
  radius: number = 15;
  type: PowerUpType;
  speed: number = 2;

  constructor(x: number, y: number, type: PowerUpType) {
    this.x = x;
    this.y = y;
    this.type = type;
  }

  update() {
    this.y += this.speed;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    
    let color = '#fff';
    let label = '?';
    
    switch (this.type) {
      case PowerUpType.SHIELD: color = '#4fc3f7'; label = 'S'; break;
      case PowerUpType.TRIPLE_SHOT: color = '#ff9800'; label = 'W'; break;
      case PowerUpType.REPAIR: color = '#f44336'; label = 'H'; break;
      case PowerUpType.MEGA_BOMB: color = '#9c27b0'; label = 'B'; break;
      case PowerUpType.ENERGY_FRAGMENT: color = '#00e676'; label = 'E'; break;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, this.x, this.y);
    
    ctx.restore();
  }
}

// --- Main Component ---

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [selectedShip, setSelectedShip] = useState<ShipType>(ShipType.STAR_BLADE_1);
  const [unlockedShips, setUnlockedShips] = useState<ShipType[]>([ShipType.STAR_BLADE_1]);
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    level: 1,
    chapter: 1,
    health: INITIAL_HEALTH,
    maxHealth: INITIAL_HEALTH,
    coins: 0,
    enemiesDestroyed: 0,
    powerUpsCollected: 0,
    escapedEnemies: 0,
    bossesDefeated: 0,
  });
  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: 'first_blood', name: '第一滴血', description: '击毁第一架敌机', icon: 'Skull', unlocked: false },
    { id: 'survivor', name: '生存者', description: '达到第5关', icon: 'Heart', unlocked: false },
    { id: 'power_hungry', name: '能量狂人', description: '收集10个道具', icon: 'Zap', unlocked: false },
    { id: 'ace_pilot', name: '王牌飞行员', description: '分数超过10000', icon: 'Trophy', unlocked: false },
    { id: 'untouchable', name: '不可触碰', description: '在护盾保护下存活', icon: 'Shield', unlocked: false },
    { id: 'capitalist', name: '资本家', description: '拥有超过1000金币', icon: 'Coins', unlocked: false },
    { id: 'boss_slayer', name: '首领克星', description: '击败第一个BOSS', icon: 'Target', unlocked: false },
    { id: 'full_arsenal', name: '全副武装', description: '在商店购买所有类型的道具', icon: 'ShoppingBag', unlocked: false },
    { id: 'star_blade_master', name: '星刃大师', description: '解锁所有型号战机', icon: 'Star', unlocked: false },
  ]);
  const [unlockedAchievement, setUnlockedAchievement] = useState<Achievement | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [levelUpMessage, setLevelUpMessage] = useState(false);
  const [screenShake, setScreenShake] = useState(0);
  const [muted, setMuted] = useState(false);
  const [boughtTypes, setBoughtTypes] = useState<Set<PowerUpType>>(new Set());
  const [skillCooldown, setSkillCooldown] = useState(0);
  const [scene, setScene] = useState<SceneType>(SceneType.STAR_PATH);

  useEffect(() => {
    audioService.setMuted(muted);
  }, [muted]);

  // Game Engine Refs
  const playerRef = useRef({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT - 100, 
    width: 50, 
    height: 50, 
    invincibility: 0, 
    shield: false, 
    tripleShot: 0,
    trail: [] as {x: number, y: number, alpha: number}[]
  });
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const coinsRef = useRef<Coin[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const lastEnemySpawnRef = useRef(0);
  const lastShotRef = useRef(0);
  const bossActiveRef = useRef(false);
  const enemyBulletsRef = useRef<EnemyBullet[]>([]);
  const levelStartTimeRef = useRef(0);
  const starsRef = useRef<{x: number, y: number, size: number, speed: number}[]>([]);

  // Initialize Stars
  useEffect(() => {
    const stars = [];
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() * 2,
        speed: Math.random() * 2 + 0.5,
      });
    }
    starsRef.current = stars;
  }, []);

  const unlockAchievement = useCallback((id: string) => {
    setAchievements(prev => {
      const index = prev.findIndex(a => a.id === id);
      if (index !== -1 && !prev[index].unlocked) {
        const newAchievements = [...prev];
        newAchievements[index] = { ...newAchievements[index], unlocked: true };
        setUnlockedAchievement(newAchievements[index]);
        audioService.playAchievement();
        setTimeout(() => setUnlockedAchievement(null), 3000);
        return newAchievements;
      }
      return prev;
    });
  }, []);

  const resetGame = (ship: ShipType = ShipType.STAR_BLADE_1) => {
    let hp = INITIAL_HEALTH;
    if (ship === ShipType.STAR_BLADE_3) hp = 5;
    
    setStats(prev => ({
      ...prev,
      score: 0,
      level: 1,
      health: hp,
      maxHealth: hp,
      coins: prev.coins, // Keep coins across runs
      enemiesDestroyed: 0,
      powerUpsCollected: 0,
      escapedEnemies: 0,
      bossesDefeated: 0,
    }));
    
    setSelectedShip(ship);
    setSkillCooldown(0);
    
    playerRef.current = { 
      x: CANVAS_WIDTH / 2, 
      y: CANVAS_HEIGHT - 100, 
      width: ship === ShipType.STAR_BLADE_3 ? 60 : 50, 
      height: ship === ShipType.STAR_BLADE_3 ? 60 : 50, 
      invincibility: 0, 
      shield: false, 
      tripleShot: 0,
      trail: []
    };
    bulletsRef.current = [];
    enemiesRef.current = [];
    particlesRef.current = [];
    powerUpsRef.current = [];
    coinsRef.current = [];
    enemyBulletsRef.current = [];
    levelStartTimeRef.current = Date.now();
    bossActiveRef.current = false;
    setGameState(GameState.PLAYING);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    keysRef.current[e.code] = true;
    if (e.code === 'KeyP') {
      setGameState(prev => prev === GameState.PLAYING ? GameState.PAUSED : (prev === GameState.PAUSED ? GameState.PLAYING : prev));
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    keysRef.current[e.code] = false;
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (gameState !== GameState.PLAYING || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    playerRef.current.x = x - playerRef.current.width / 2;
    playerRef.current.y = y - playerRef.current.height / 2;
  }, [gameState]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const spawnBoss = () => {
    bossActiveRef.current = true;
    enemiesRef.current = [];
    
    let bossType = EnemyType.BOSS_VANGUARD;
    const bossCycle = (stats.level - 1) % 3;
    if (bossCycle === 1) bossType = EnemyType.BOSS_PREDATOR;
    if (bossCycle === 2) bossType = EnemyType.BOSS_CORE;
    
    enemiesRef.current.push(new Enemy(CANVAS_WIDTH / 2 - 90, bossType, stats.level));
    audioService.playBossSpawn();
    setGameState(GameState.BOSS_INTRO);
    setTimeout(() => setGameState(GameState.PLAYING), 2000);
  };

  const activateSkill = () => {
    const p = playerRef.current;
    setSkillCooldown(selectedShip === ShipType.STAR_BLADE_2 ? 15000 : (selectedShip === ShipType.STAR_BLADE_3 ? 45000 : 30000));
    audioService.playSkill();
    
    if (selectedShip === ShipType.STAR_BLADE_1) {
      setScreenShake(20);
      enemiesRef.current.forEach(e => {
        e.health -= 20;
        for (let i = 0; i < 10; i++) particlesRef.current.push(new Particle(e.x + e.width/2, e.y + e.height/2, '#fff'));
      });
    } else if (selectedShip === ShipType.STAR_BLADE_2) {
      p.invincibility = 2000;
      p.x = Math.random() * (CANVAS_WIDTH - p.width);
      p.y = Math.random() * (CANVAS_HEIGHT - p.height);
      for (let i = 0; i < 30; i++) particlesRef.current.push(new Particle(p.x + p.width/2, p.y + p.height/2, '#7b1fa2'));
    } else if (selectedShip === ShipType.STAR_BLADE_3) {
      setScreenShake(40);
      enemiesRef.current.forEach(e => {
        if (Math.abs(e.x + e.width/2 - (p.x + p.width/2)) < 100) {
          e.health -= 100;
        }
      });
      for (let i = 0; i < 100; i++) {
        particlesRef.current.push(new Particle(p.x + p.width/2 + (Math.random()-0.5)*50, p.y - Math.random()*CANVAS_HEIGHT, '#f44336'));
      }
    }
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const p = playerRef.current;
    if (p.invincibility > 0 && Math.floor(Date.now() / 100) % 2 === 0) return;

    ctx.save();
    ctx.translate(p.x + p.width / 2, p.y + p.height / 2);

    const gradient = ctx.createLinearGradient(0, -p.height/2, 0, p.height/2);
    let shipColor = '#90a4ae';
    let trailColor = '#00f2ff';
    
    if (selectedShip === ShipType.STAR_BLADE_2) {
      shipColor = '#212121';
      trailColor = '#7b1fa2';
    } else if (selectedShip === ShipType.STAR_BLADE_3) {
      shipColor = '#37474f';
      trailColor = '#f44336';
    }
    
    gradient.addColorStop(0, shipColor);
    gradient.addColorStop(1, '#455a64');
    ctx.fillStyle = gradient;

    if (selectedShip === ShipType.STAR_BLADE_1) {
      ctx.beginPath();
      ctx.moveTo(0, -p.height/2);
      ctx.lineTo(p.width/2, p.height/2);
      ctx.lineTo(0, p.height/3);
      ctx.lineTo(-p.width/2, p.height/2);
      ctx.closePath();
      ctx.fill();
    } else if (selectedShip === ShipType.STAR_BLADE_2) {
      ctx.beginPath();
      ctx.moveTo(0, -p.height/2);
      ctx.lineTo(p.width/3, p.height/2);
      ctx.lineTo(-p.width/3, p.height/2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#424242';
      ctx.fillRect(-p.width/2, 0, p.width/6, p.height/2);
      ctx.fillRect(p.width/2 - p.width/6, 0, p.width/6, p.height/2);
    } else if (selectedShip === ShipType.STAR_BLADE_3) {
      ctx.fillRect(-p.width/2, -p.height/4, p.width, p.height/2);
      ctx.beginPath();
      ctx.moveTo(0, -p.height/2);
      ctx.lineTo(p.width/2, p.height/4);
      ctx.lineTo(-p.width/2, p.height/4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(0, 242, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(0, -p.height/6, p.width/6, p.height/8, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.shadowBlur = 15;
    ctx.shadowColor = trailColor;
    ctx.fillStyle = trailColor;
    ctx.beginPath();
    ctx.arc(-p.width/4, p.height/2, 5, 0, Math.PI*2);
    ctx.arc(p.width/4, p.height/2, 5, 0, Math.PI*2);
    ctx.fill();

    if (p.shield) {
      ctx.restore();
      ctx.save();
      ctx.translate(p.x + p.width/2, p.y + p.height/2);
      ctx.beginPath();
      ctx.arc(0, 0, p.width * 0.8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 242, 255, 0.1)';
      ctx.fill();
    }
    ctx.restore();
  };

  // Game Loop
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const update = (time: number) => {
      // 1. Player Movement
      const p = playerRef.current;
      let speed = PLAYER_SPEED;
      if (selectedShip === ShipType.STAR_BLADE_2) speed = 10;
      if (selectedShip === ShipType.STAR_BLADE_3) speed = 5;

      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) p.x -= speed;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) p.x += speed;
      if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) p.y -= speed;
      if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) p.y += speed;

      // Trail
      p.trail.push({ x: p.x + p.width / 2, y: p.y + p.height / 2, alpha: 0.5 });
      if (p.trail.length > 15) p.trail.shift();
      p.trail.forEach(t => t.alpha -= 0.03);
      p.trail = p.trail.filter(t => t.alpha > 0);

      // Boundaries
      p.x = Math.max(0, Math.min(CANVAS_WIDTH - p.width, p.x));
      p.y = Math.max(0, Math.min(CANVAS_HEIGHT - p.height, p.y));

      // Invincibility
      if (p.invincibility > 0) p.invincibility -= 16.67;

      // Powerup Timers
      if (p.tripleShot > 0) p.tripleShot -= 16.67;
      
      // Skill Cooldown
      if (skillCooldown > 0) setSkillCooldown(prev => Math.max(0, prev - 16.67));

      // 2. Shooting
      const shotInterval = selectedShip === ShipType.STAR_BLADE_2 ? 100 : (selectedShip === ShipType.STAR_BLADE_3 ? 300 : 150);
      if (keysRef.current['Space'] && time - lastShotRef.current > shotInterval) {
        const centerX = p.x + p.width / 2;
        const centerY = p.y;
        
        if (selectedShip === ShipType.STAR_BLADE_1) {
          if (p.tripleShot > 0) {
            bulletsRef.current.push(new Bullet(centerX, centerY, -Math.PI / 2));
            bulletsRef.current.push(new Bullet(centerX, centerY, -Math.PI / 2 - 0.2));
            bulletsRef.current.push(new Bullet(centerX, centerY, -Math.PI / 2 + 0.2));
          } else {
            bulletsRef.current.push(new Bullet(centerX, centerY));
          }
          audioService.playShoot();
        } else if (selectedShip === ShipType.STAR_BLADE_2) {
          bulletsRef.current.push(new Bullet(centerX, centerY, -Math.PI / 2));
          audioService.playLaser();
        } else if (selectedShip === ShipType.STAR_BLADE_3) {
          bulletsRef.current.push(new Bullet(centerX - 20, centerY, -Math.PI / 2));
          bulletsRef.current.push(new Bullet(centerX - 10, centerY, -Math.PI / 2));
          bulletsRef.current.push(new Bullet(centerX + 10, centerY, -Math.PI / 2));
          bulletsRef.current.push(new Bullet(centerX + 20, centerY, -Math.PI / 2));
          audioService.playIon();
        }
        lastShotRef.current = time;
      }

      // Skill Activation
      if (keysRef.current['KeyF'] && skillCooldown <= 0) {
        activateSkill();
      }

      // 3. Spawning Enemies
      if (!bossActiveRef.current) {
        const levelTime = Date.now() - levelStartTimeRef.current;
        if (levelTime > 60000) {
          spawnBoss();
        } else {
          const spawnRate = Math.max(200, 1500 - (stats.level * 100));
          if (time - lastEnemySpawnRef.current > spawnRate) {
            const x = Math.random() * (CANVAS_WIDTH - 60);
            const rand = Math.random();
            let type = EnemyType.PREDATOR_BUG;
            
            if (stats.level > 5 && rand > 0.9) type = EnemyType.ARMORED_GUARD;
            else if (stats.level > 3 && rand > 0.7) type = EnemyType.STING_SHOOTER;
            else if (stats.level > 10 && rand > 0.95) type = EnemyType.DEVOURER;
            
            enemiesRef.current.push(new Enemy(x, type, stats.level));
            lastEnemySpawnRef.current = time;
          }
        }
      }

      // 4. Update Entities
      bulletsRef.current.forEach(b => b.update());
      enemiesRef.current.forEach(e => e.update(time, enemyBulletsRef.current, p.x + p.width/2, p.y + p.height/2));
      enemyBulletsRef.current.forEach(eb => eb.update());
      particlesRef.current.forEach(p => p.update());
      powerUpsRef.current.forEach(pu => pu.update());
      coinsRef.current.forEach(c => c.update());

      // Filter out-of-bounds
      bulletsRef.current = bulletsRef.current.filter(b => b.y > -10);
      enemyBulletsRef.current = enemyBulletsRef.current.filter(eb => eb.y < CANVAS_HEIGHT + 50 && eb.y > -50 && eb.x > -50 && eb.x < CANVAS_WIDTH + 50);
      
      const escaped = enemiesRef.current.filter(e => e.y > CANVAS_HEIGHT && !e.type.startsWith('BOSS'));
      if (escaped.length > 0) {
        setStats(prev => ({ 
          ...prev, 
          score: Math.max(0, prev.score - 50 * escaped.length),
          escapedEnemies: prev.escapedEnemies + escaped.length
        }));
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 1000);
      }
      enemiesRef.current = enemiesRef.current.filter(e => e.y <= CANVAS_HEIGHT);
      
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      powerUpsRef.current = powerUpsRef.current.filter(pu => pu.y <= CANVAS_HEIGHT);
      coinsRef.current = coinsRef.current.filter(c => c.y <= CANVAS_HEIGHT);

      // 5. Collision Detection
      for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
        const b = bulletsRef.current[i];
        let hit = false;
        for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
          const e = enemiesRef.current[j];
          if (
            b.x > e.x && b.x < e.x + e.width &&
            b.y > e.y && b.y < e.y + e.height
          ) {
            e.health -= 1;
            hit = true;
            for (let k = 0; k < 3; k++) particlesRef.current.push(new Particle(b.x, b.y, '#fff'));

            if (e.health <= 0) {
              enemiesRef.current.splice(j, 1);
              const isBoss = e.type.startsWith('BOSS');
              
              setStats(prev => ({ 
                ...prev, 
                score: prev.score + e.scoreValue,
                enemiesDestroyed: prev.enemiesDestroyed + 1,
                bossesDefeated: isBoss ? prev.bossesDefeated + 1 : prev.bossesDefeated
              }));
              audioService.playExplosion();
              
              if (isBoss) {
                bossActiveRef.current = false;
                unlockAchievement('boss_slayer');
                setScreenShake(30);
                for (let k = 0; k < 20; k++) {
                  coinsRef.current.push(new Coin(e.x + Math.random() * e.width, e.y + Math.random() * e.height, 10));
                }
                setStats(prev => ({ ...prev, level: prev.level + 1 }));
                levelStartTimeRef.current = Date.now();
                enemyBulletsRef.current = [];
                setLevelUpMessage(true);
                setTimeout(() => setLevelUpMessage(false), 3000);
              } else {
                let coinVal = 1;
                if (e.type === EnemyType.ARMORED_GUARD) coinVal = 5;
                if (e.type === EnemyType.STING_SHOOTER) coinVal = 2;
                coinsRef.current.push(new Coin(e.x + e.width/2, e.y + e.height/2, coinVal));
                
                if (Math.random() > 0.95) {
                  const types = [PowerUpType.SHIELD, PowerUpType.TRIPLE_SHOT, PowerUpType.REPAIR, PowerUpType.MEGA_BOMB, PowerUpType.ENERGY_FRAGMENT];
                  const puType = types[Math.floor(Math.random() * types.length)];
                  powerUpsRef.current.push(new PowerUp(e.x + e.width/2, e.y + e.height/2, puType));
                }
              }
              const pCount = isBoss ? 100 : 15;
              for (let k = 0; k < pCount; k++) particlesRef.current.push(new Particle(e.x + e.width/2, e.y + e.height/2, e.color));
              if (stats.enemiesDestroyed === 0) unlockAchievement('first_blood');
            }
            break;
          }
        }
        if (hit) bulletsRef.current.splice(i, 1);
      }

      // Enemy Bullets Collision
      for (let i = enemyBulletsRef.current.length - 1; i >= 0; i--) {
        const eb = enemyBulletsRef.current[i];
        const dist = Math.hypot(p.x + p.width/2 - eb.x, p.y + p.height/2 - eb.y);
        if (dist < p.width/2 + eb.radius) {
          enemyBulletsRef.current.splice(i, 1);
          if (p.invincibility <= 0) {
            if (p.shield) {
              p.shield = false;
              p.invincibility = 500;
              setScreenShake(5);
              audioService.playHit();
            } else {
              setStats(prev => ({ ...prev, health: prev.health - 1 }));
              p.invincibility = INVINCIBILITY_DURATION;
              setScreenShake(15);
              audioService.playHit();
            }
          }
        }
      }

      coinsRef.current.forEach((c, cIdx) => {
        const dist = Math.hypot(p.x + p.width/2 - c.x, p.y + p.height/2 - c.y);
        if (dist < p.width/2 + c.radius) {
          coinsRef.current.splice(cIdx, 1);
          setStats(prev => ({ ...prev, coins: prev.coins + c.value }));
          audioService.playCoin();
          if (stats.coins + c.value >= 1000) unlockAchievement('capitalist');
        }
      });

      if (p.invincibility <= 0) {
        enemiesRef.current.forEach((e, eIdx) => {
          if (
            p.x < e.x + e.width && p.x + p.width > e.x &&
            p.y < e.y + e.height && p.y + p.height > e.y
          ) {
            if (p.shield) {
              p.shield = false;
              p.invincibility = 500;
              unlockAchievement('untouchable');
              setScreenShake(5);
              audioService.playHit();
            } else {
              setStats(prev => ({ ...prev, health: prev.health - 1 }));
              p.invincibility = INVINCIBILITY_DURATION;
              setScreenShake(15);
              audioService.playHit();
            }
            if (!e.type.startsWith('BOSS')) {
              enemiesRef.current.splice(eIdx, 1);
              for (let i = 0; i < 20; i++) particlesRef.current.push(new Particle(e.x + e.width/2, e.y + e.height/2, '#ff0000'));
            }
          }
        });
      }

      powerUpsRef.current.forEach((pu, puIdx) => {
        const dist = Math.hypot(p.x + p.width/2 - pu.x, p.y + p.height/2 - pu.y);
        if (dist < p.width/2 + pu.radius) {
          powerUpsRef.current.splice(puIdx, 1);
          applyPowerUp(pu.type);
        }
      });

      if (stats.health <= 0) {
        setGameState(GameState.GAME_OVER);
      }

      // 6. Rendering
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Background
      ctx.save();
      if (screenShake > 0) {
        const dx = (Math.random() - 0.5) * screenShake;
        const dy = (Math.random() - 0.5) * screenShake;
        ctx.translate(dx, dy);
        setScreenShake(prev => Math.max(0, prev - 1));
      }

      // Stars
      starsRef.current.forEach(star => {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        star.y += star.speed;
        if (star.y > CANVAS_HEIGHT) star.y = 0;
      });

      // Entities
      bulletsRef.current.forEach(b => b.draw(ctx));
      enemyBulletsRef.current.forEach(eb => eb.draw(ctx));
      enemiesRef.current.forEach(e => e.draw(ctx));
      particlesRef.current.forEach(p => p.draw(ctx));
      powerUpsRef.current.forEach(pu => pu.draw(ctx));
      coinsRef.current.forEach(c => c.draw(ctx));

      // Player Trail
      p.trail.forEach(t => {
        ctx.save();
        ctx.globalAlpha = t.alpha;
        ctx.fillStyle = selectedShip === ShipType.STAR_BLADE_2 ? '#7b1fa2' : (selectedShip === ShipType.STAR_BLADE_3 ? '#f44336' : '#00f2ff');
        ctx.beginPath();
        ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      drawPlayer(ctx);
      ctx.restore();

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, stats.level, stats.score, stats.health, unlockAchievement, selectedShip, skillCooldown]);

  const applyPowerUp = (type: PowerUpType) => {
    const p = playerRef.current;
    setStats(prev => ({ ...prev, powerUpsCollected: prev.powerUpsCollected + 1 }));
    audioService.playPowerUp();
    
    switch (type) {
      case PowerUpType.SHIELD:
        p.shield = true;
        break;
      case PowerUpType.TRIPLE_SHOT:
        p.tripleShot = 8000;
        break;
      case PowerUpType.REPAIR:
        setStats(prev => ({ ...prev, health: Math.min(prev.maxHealth, prev.health + 1) }));
        break;
      case PowerUpType.MEGA_BOMB:
        enemiesRef.current.forEach(e => {
          if (!e.type.startsWith('BOSS')) {
            setStats(prev => ({ ...prev, score: prev.score + e.scoreValue }));
            for (let i = 0; i < 10; i++) particlesRef.current.push(new Particle(e.x + e.width/2, e.y + e.height/2, e.color));
          }
        });
        enemiesRef.current = enemiesRef.current.filter(e => e.type.startsWith('BOSS'));
        setScreenShake(20);
        audioService.playExplosion();
        break;
      case PowerUpType.ENERGY_FRAGMENT:
        setStats(prev => ({ ...prev, score: prev.score + 500 }));
        break;
    }

    if (stats.powerUpsCollected + 1 >= 10) unlockAchievement('power_hungry');
  };

  const shopItems: ShopItem[] = [
    { id: PowerUpType.SHIELD, name: '能量护盾', description: '抵挡一次致命伤害', price: 50, icon: 'Shield', type: PowerUpType.SHIELD },
    { id: PowerUpType.TRIPLE_SHOT, name: '三向子弹', description: '火力全开 (8秒)', price: 100, icon: 'Zap', type: PowerUpType.TRIPLE_SHOT },
    { id: PowerUpType.REPAIR, name: '战机维修', description: '恢复 1 点生命值', price: 150, icon: 'Heart', type: PowerUpType.REPAIR },
    { id: PowerUpType.MEGA_BOMB, name: '核能炸弹', description: '清除屏幕上所有普通敌机', price: 250, icon: 'Target', type: PowerUpType.MEGA_BOMB },
  ];

  const buyItem = (item: ShopItem) => {
    if (stats.coins >= item.price) {
      setStats(prev => ({ ...prev, coins: prev.coins - item.price }));
      applyPowerUp(item.id as PowerUpType);
      
      setBoughtTypes(prev => {
        const next = new Set(prev);
        next.add(item.id);
        if (next.size >= 4) unlockAchievement('full_arsenal');
        return next;
      });
    }
  };

  // --- UI Render Helpers ---

  const renderHUD = () => (
    <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-10 pointer-events-none">
      <div className="space-y-2">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl">
          <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">Score</p>
          <p className="text-3xl font-mono font-bold text-cyan-400 tabular-nums">
            {stats.score.toLocaleString()}
          </p>
        </div>
        <div className="bg-black/40 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3">
          <Coins className="w-5 h-5 text-yellow-500" />
          <p className="text-xl font-mono font-bold text-yellow-500 tabular-nums">
            {stats.coins.toLocaleString()}
          </p>
        </div>
        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-2xl w-48">
          <div className="flex justify-between items-center mb-1 px-1">
            <span className="text-[10px] text-white/40 uppercase font-bold">Hull</span>
            <span className="text-[10px] text-white/60 font-mono">{stats.health}/{stats.maxHealth}</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              animate={{ width: `${(stats.health / stats.maxHealth) * 100}%` }}
              className={`h-full ${stats.health <= 1 ? 'bg-red-500' : 'bg-cyan-500'}`}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <button 
            onClick={() => setGameState(GameState.SHOP)}
            className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-2xl pointer-events-auto hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <ShoppingBag className="w-5 h-5 text-orange-400" />
            <span className="text-xs font-bold text-orange-400">商店</span>
          </button>
          <button 
            onClick={() => setMuted(!muted)}
            className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-2xl pointer-events-auto hover:bg-white/10 transition-colors"
          >
            {muted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
          </button>
        </div>
        <div className="bg-black/40 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl text-right">
          <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">Level</p>
          <p className="text-3xl font-mono font-bold text-orange-400">
            {stats.level}
          </p>
        </div>
        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-2xl w-48">
          <div className="flex justify-between items-center mb-1 px-1">
            <span className="text-[10px] text-white/40 uppercase font-bold">Skill (F)</span>
            <span className="text-[10px] text-white/60 font-mono">{skillCooldown > 0 ? (skillCooldown/1000).toFixed(1) + 's' : 'READY'}</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              animate={{ width: `${(1 - skillCooldown / (selectedShip === ShipType.STAR_BLADE_2 ? 15000 : (selectedShip === ShipType.STAR_BLADE_3 ? 45000 : 30000))) * 100}%` }}
              className="h-full bg-purple-500"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStory = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 text-center"
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="max-w-2xl"
      >
        <h2 className="text-4xl font-bold mb-8 text-cyan-400 tracking-widest uppercase">深空彼岸：虚空入侵</h2>
        <p className="text-xl text-white/80 leading-relaxed mb-12 font-serif italic">
          "公元2749年，人类文明正处于星际扩张的巅峰。然而，来自虚空象限的异形族群‘泽格洛斯’打破了宁静。
          它们吞噬星核，毁灭文明。作为星刃舰队的指挥官，你是人类最后的希望..."
        </p>
        <button 
          onClick={() => setGameState(GameState.CHAPTER_SELECT)}
          className="px-12 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full font-bold tracking-widest transition-all hover:scale-105 shadow-[0_0_30px_rgba(6,182,212,0.3)]"
        >
          进入星图
        </button>
      </motion.div>
    </motion.div>
  );

  const renderChapterSelect = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-[#050505] flex flex-col p-8 overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-3xl font-bold tracking-tighter flex items-center gap-3">
          <Map className="text-cyan-400" />
          星区航图
        </h2>
        <button 
          onClick={() => setGameState(GameState.START)}
          className="text-white/40 hover:text-white transition-colors"
        >
          返回主菜单
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto w-full">
        {[1, 2, 3].map((ch) => (
          <motion.div
            key={ch}
            whileHover={{ scale: 1.02 }}
            className={`relative p-8 rounded-3xl border ${stats.chapter >= ch ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/5 bg-white/2 opacity-50'} overflow-hidden group`}
          >
            <div className="relative z-10">
              <span className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2 block">Chapter 0{ch}</span>
              <h3 className="text-2xl font-bold mb-4">{ch === 1 ? '虚空边缘' : (ch === 2 ? '星核走廊' : '终焉之地')}</h3>
              <p className="text-sm text-white/60 mb-8">
                {ch === 1 ? '巡逻人类星域边缘，清理落单的掠夺者。' : (ch === 2 ? '深入异形巢穴，夺回被占领的星核能源站。' : '直面泽格洛斯主脑，终结这场星际浩劫。')}
              </p>
              <button 
                disabled={stats.chapter < ch}
                onClick={() => {
                  setStats(prev => ({ ...prev, chapter: ch }));
                  setGameState(GameState.START);
                }}
                className="w-full py-3 bg-white/10 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all"
              >
                {stats.chapter >= ch ? '进入星区' : '锁定中'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const renderShipSelect = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-[#050505] flex flex-col p-8 overflow-y-auto"
    >
      <h2 className="text-3xl font-bold mb-12 text-center tracking-widest uppercase">选择你的战机</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto w-full">
        {[
          { type: ShipType.STAR_BLADE_1, name: '星刃-I (均衡型)', desc: '各项性能均衡，适合新手。', skill: '能量爆发', icon: 'Rocket' },
          { type: ShipType.STAR_BLADE_2, name: '星刃-II (敏捷型)', desc: '极速移动，配备高频激光。', skill: '空间跳跃', icon: 'Zap' },
          { type: ShipType.STAR_BLADE_3, name: '星刃-III (重装型)', desc: '厚重装甲，毁灭性离子炮。', skill: '湮灭炮', icon: 'Shield' },
        ].map((ship) => (
          <motion.div
            key={ship.type}
            whileHover={{ scale: 1.05 }}
            className={`p-8 rounded-3xl border ${selectedShip === ship.type ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/10 bg-white/5'} flex flex-col items-center text-center`}
            onClick={() => setSelectedShip(ship.type)}
          >
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${selectedShip === ship.type ? 'bg-cyan-500 text-black' : 'bg-white/10 text-white'}`}>
              <Rocket className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold mb-2">{ship.name}</h3>
            <p className="text-sm text-white/60 mb-4">{ship.desc}</p>
            <div className="bg-white/5 px-4 py-2 rounded-full text-xs font-bold text-cyan-400 mb-8">
              技能: {ship.skill}
            </div>
            <button 
              onClick={() => resetGame(ship.type)}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all"
            >
              出击
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500/30 overflow-hidden flex flex-col md:flex-row">
      {/* Sidebar - Instructions (Desktop) */}
      <aside className="hidden lg:flex flex-col w-80 p-8 border-r border-white/5 bg-white/[0.02] backdrop-blur-sm">
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Info className="w-6 h-6 text-cyan-400" />
            操作指南
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-white/60">移动</span>
              <div className="flex gap-1">
                <kbd className="px-2 py-1 bg-white/10 rounded text-xs">WASD</kbd>
                <kbd className="px-2 py-1 bg-white/10 rounded text-xs">方向键</kbd>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-white/60">射击</span>
              <kbd className="px-2 py-1 bg-white/10 rounded text-xs">空格键</kbd>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-white/60">暂停</span>
              <kbd className="px-2 py-1 bg-white/10 rounded text-xs">P</kbd>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6 text-orange-400" />
            道具说明
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex gap-4">
              <div className="w-10 h-10 rounded-full border-2 border-orange-500 flex items-center justify-center shrink-0">
                <span className="text-orange-500 font-bold">W</span>
              </div>
              <div>
                <p className="font-bold text-orange-400">三向子弹</p>
                <p className="text-xs text-white/50">大幅增强火力，持续8秒</p>
              </div>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex gap-4">
              <div className="w-10 h-10 rounded-full border-2 border-cyan-500 flex items-center justify-center shrink-0">
                <span className="text-cyan-500 font-bold">S</span>
              </div>
              <div>
                <p className="font-bold text-cyan-400">能量护盾</p>
                <p className="text-xs text-white/50">抵挡一次致命伤害</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Game Area */}
      <main className="flex-1 relative flex flex-col items-center justify-center p-4">
        {/* Game HUD */}
        {gameState === GameState.PLAYING && renderHUD()}

        {/* Canvas Container */}
        <div 
          className="relative aspect-[8/9] w-full max-w-[600px] bg-black rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 touch-none"
          onPointerMove={handlePointerMove}
          onPointerDown={() => { keysRef.current['Space'] = true; }}
          onPointerUp={() => { keysRef.current['Space'] = false; }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-full"
          />

          {/* Warning Overlay */}
          <AnimatePresence>
            {showWarning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none border-4 border-red-500/30 animate-pulse flex items-center justify-center"
              >
                <div className="bg-red-500/20 backdrop-blur-sm px-6 py-2 rounded-full border border-red-500/50">
                  <p className="text-red-500 font-bold tracking-widest">敌机逃脱! -50</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Level Up Overlay */}
          <AnimatePresence>
            {levelUpMessage && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
              >
                <div className="text-center">
                  <h2 className="text-6xl font-black text-orange-500 italic tracking-tighter drop-shadow-[0_0_20px_rgba(255,152,0,0.5)]">
                    LEVEL UP!
                  </h2>
                  <p className="text-white/60 font-bold tracking-[0.5em] uppercase mt-2">难度提升</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Screens */}
          <AnimatePresence mode="wait">
            {gameState === GameState.START && (
              <motion.div 
                key="start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="mb-12"
                >
                  <h1 className="text-7xl font-black tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20 leading-none">
                    深空彼岸
                  </h1>
                  <p className="text-cyan-400 font-bold tracking-[0.5em] uppercase mt-2 text-sm">DEEP SPACE SHORE</p>
                </motion.div>

                <div className="flex flex-col gap-4 w-full max-w-xs">
                  <button 
                    onClick={() => resetGame(selectedShip)}
                    className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 group shadow-[0_0_30px_rgba(6,182,212,0.3)]"
                  >
                    <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" /> 
                    开始任务
                  </button>
                  <button 
                    onClick={() => setGameState(GameState.CHAPTER_SELECT)}
                    className="w-full py-4 bg-white/10 text-white rounded-2xl font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-3"
                  >
                    <Map className="w-5 h-5" /> 章节选择
                  </button>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setGameState(GameState.SHOP)}
                      className="py-4 bg-white/5 text-white rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4 text-orange-400" /> 商店
                    </button>
                    <button 
                      onClick={() => setGameState(GameState.ACHIEVEMENTS)}
                      className="py-4 bg-white/5 text-white rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <Trophy className="w-4 h-4 text-yellow-500" /> 成就
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {gameState === GameState.STORY && renderStory()}
            {gameState === GameState.CHAPTER_SELECT && renderChapterSelect()}
            {gameState === GameState.START && !bossActiveRef.current && stats.score === 0 && renderShipSelect()}

            {gameState === GameState.BOSS_INTRO && (
              <motion.div
                key="boss_intro"
                initial={{ opacity: 0, scale: 2 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-red-900/20 backdrop-blur-sm pointer-events-none"
              >
                <h2 className="text-8xl font-black italic text-red-600 tracking-tighter animate-pulse drop-shadow-[0_0_30px_rgba(255,0,0,0.8)]">
                  WARNING
                </h2>
                <p className="text-white font-bold tracking-[1em] uppercase mt-4">异形首领正在接近</p>
              </motion.div>
            )}

            {gameState === GameState.SHOP && (
              <motion.div
                key="shop"
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl p-8"
              >
                <div className="w-full max-w-md">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-black italic text-white tracking-tighter flex items-center gap-2">
                      <ShoppingBag className="text-orange-400" /> 星际商店
                    </h2>
                    <button 
                      onClick={() => setGameState(GameState.PLAYING)}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-3xl p-4 mb-8 flex items-center justify-between">
                    <span className="text-white/40 uppercase text-xs font-bold tracking-widest">当前金币</span>
                    <div className="flex items-center gap-2">
                      <Coins className="text-yellow-500 w-5 h-5" />
                      <span className="text-2xl font-mono font-bold text-yellow-500">{stats.coins}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {shopItems.map(item => (
                      <button
                        key={item.id}
                        disabled={stats.coins < item.price}
                        onClick={() => buyItem(item)}
                        className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${
                          stats.coins >= item.price 
                          ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:scale-[1.02]' 
                          : 'bg-white/[0.02] border-white/5 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-4 text-left">
                          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                            {item.id === PowerUpType.SHIELD && <Shield className="text-cyan-400" />}
                            {item.id === PowerUpType.TRIPLE_SHOT && <Zap className="text-orange-400" />}
                            {item.id === PowerUpType.REPAIR && <Heart className="text-red-400" />}
                            {item.id === PowerUpType.MEGA_BOMB && <Target className="text-purple-400" />}
                          </div>
                          <div>
                            <p className="font-bold text-white">{item.name}</p>
                            <p className="text-xs text-white/40">{item.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 bg-yellow-500/20 px-3 py-1 rounded-full border border-yellow-500/30">
                          <Coins className="w-3 h-3 text-yellow-500" />
                          <span className="text-sm font-bold text-yellow-500">{item.price}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {gameState === GameState.GAME_OVER && (
              <motion.div 
                key="gameover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-2xl p-8 text-center"
              >
                <div className="text-center mb-12">
                  <Skull className="w-16 h-16 text-red-500 mx-auto mb-4 animate-bounce" />
                  <h2 className="text-5xl font-black italic text-white tracking-tighter mb-2">任务失败</h2>
                  <p className="text-white/40 uppercase tracking-widest text-xs font-bold">战机已损毁</p>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-12">
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
                    <p className="text-[10px] text-white/40 uppercase font-bold mb-1">最终得分</p>
                    <p className="text-3xl font-mono font-bold text-cyan-400">{stats.score.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
                    <p className="text-[10px] text-white/40 uppercase font-bold mb-1">最高关卡</p>
                    <p className="text-3xl font-mono font-bold text-orange-400">{stats.level}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4 w-full max-w-xs">
                  <button 
                    onClick={() => resetGame(selectedShip)}
                    className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:bg-cyan-400 transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" /> 重新出击
                  </button>
                  <button 
                    onClick={() => setGameState(GameState.START)}
                    className="w-full py-4 bg-white/10 text-white rounded-2xl font-bold hover:bg-white/20 transition-all"
                  >
                    返回主菜单
                  </button>
                </div>
              </motion.div>
            )}

            {gameState === GameState.PAUSED && (
              <motion.div 
                key="paused"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md p-8"
              >
                <h2 className="text-4xl font-black italic text-white mb-12 tracking-tighter">游戏暂停</h2>
                <div className="flex flex-col gap-4 w-full max-w-xs">
                  <button 
                    onClick={() => setGameState(GameState.PLAYING)}
                    className="w-full py-4 bg-cyan-500 text-black font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-cyan-400 transition-colors"
                  >
                    <Play className="w-5 h-5 fill-current" /> 继续游戏
                  </button>
                  <button 
                    onClick={() => setGameState(GameState.START)}
                    className="w-full py-4 bg-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-white/20 transition-colors border border-white/10"
                  >
                    <RotateCcw className="w-5 h-5" /> 退出任务
                  </button>
                </div>
              </motion.div>
            )}

            {gameState === GameState.ACHIEVEMENTS && (
              <motion.div 
                key="achievements"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl flex flex-col p-8"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-black tracking-tighter italic flex items-center gap-3">
                    <Trophy className="text-yellow-500" />
                    荣誉勋章
                  </h2>
                  <button 
                    onClick={() => setGameState(GameState.START)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-2 custom-scrollbar">
                  {achievements.map((ach) => (
                    <div 
                      key={ach.id}
                      className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${
                        ach.unlocked 
                        ? 'bg-yellow-500/10 border-yellow-500/30' 
                        : 'bg-white/[0.02] border-white/5 grayscale opacity-40'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${ach.unlocked ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white/40'}`}>
                        {ach.icon === 'Skull' && <Skull className="w-6 h-6" />}
                        {ach.icon === 'Heart' && <Heart className="w-6 h-6" />}
                        {ach.icon === 'Zap' && <Zap className="w-6 h-6" />}
                        {ach.icon === 'Trophy' && <Trophy className="w-6 h-6" />}
                        {ach.icon === 'Shield' && <Shield className="w-6 h-6" />}
                        {ach.icon === 'Coins' && <Coins className="w-6 h-6" />}
                        {ach.icon === 'Target' && <Target className="w-6 h-6" />}
                        {ach.icon === 'ShoppingBag' && <ShoppingBag className="w-6 h-6" />}
                        {ach.icon === 'Star' && <Star className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className={`font-bold ${ach.unlocked ? 'text-yellow-500' : 'text-white/40'}`}>{ach.name}</h3>
                        <p className="text-xs text-white/40">{ach.description}</p>
                      </div>
                      {ach.unlocked && (
                        <div className="ml-auto">
                          <CheckCircle2 className="text-yellow-500 w-5 h-5" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Controls Hint */}
        {gameState === GameState.PLAYING && (
          <div className="mt-8 lg:hidden text-center">
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <ChevronRight className="w-4 h-4 rotate-90" /> 使用键盘或点击屏幕控制
            </p>
          </div>
        )}
      </main>

      {/* Achievement Popups */}
      <AnimatePresence>
        {unlockedAchievement && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed bottom-10 left-1/2 z-50 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4 shadow-2xl"
          >
            <div className="bg-yellow-500/20 p-2 rounded-full">
              <Trophy className="text-yellow-500 w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-white/60 uppercase tracking-widest font-bold">成就解锁!</p>
              <p className="text-white font-bold">{unlockedAchievement.name}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Styles for Glassmorphism & Animations */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 242, 255, 0.2); }
          50% { box-shadow: 0 0 40px rgba(0, 242, 255, 0.4); }
        }
        .canvas-container {
          animation: pulse-glow 4s infinite;
        }
        kbd {
          box-shadow: 0 2px 0 rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
