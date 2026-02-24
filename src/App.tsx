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
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GameState, EnemyType, PowerUpType, Achievement, GameStats } from './types';
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
  speed: number;
  color: string;
  scoreValue: number;

  constructor(x: number, type: EnemyType, level: number) {
    this.x = x;
    this.y = -50;
    this.type = type;
    
    switch (type) {
      case EnemyType.FAST:
        this.width = 30;
        this.height = 30;
        this.health = 1;
        this.speed = 5 + (level * 0.5);
        this.color = '#ffeb3b';
        this.scoreValue = 150;
        break;
      case EnemyType.HEAVY:
        this.width = 60;
        this.height = 60;
        this.health = 5 + Math.floor(level / 2);
        this.speed = 1.5 + (level * 0.1);
        this.color = '#f44336';
        this.scoreValue = 300;
        break;
      default:
        this.width = 40;
        this.height = 40;
        this.health = 2 + Math.floor(level / 3);
        this.speed = 3 + (level * 0.2);
        this.color = '#9c27b0';
        this.scoreValue = 100;
    }
  }

  update() {
    this.y += this.speed;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // Draw body
    ctx.beginPath();
    ctx.moveTo(0, this.height);
    ctx.lineTo(this.width / 2, 0);
    ctx.lineTo(this.width, this.height);
    ctx.lineTo(this.width / 2, this.height * 0.7);
    ctx.closePath();
    
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    ctx.fill();

    // Health bar for heavy
    if (this.type === EnemyType.HEAVY && this.health > 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, -10, this.width, 4);
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(0, -10, (this.health / (5 + 0)) * this.width, 4);
    }

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
    
    const color = this.type === PowerUpType.SHIELD ? '#4fc3f7' : '#ff9800';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();

    // Icon representation
    ctx.fillStyle = color;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.type === PowerUpType.SHIELD ? 'S' : 'W', this.x, this.y);
    
    ctx.restore();
  }
}

// --- Main Component ---

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    level: 1,
    health: INITIAL_HEALTH,
    enemiesDestroyed: 0,
    powerUpsCollected: 0,
    escapedEnemies: 0,
  });
  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: 'first_blood', name: '第一滴血', description: '击毁第一架敌机', icon: 'Skull', unlocked: false },
    { id: 'survivor', name: '生存者', description: '达到第5关', icon: 'Heart', unlocked: false },
    { id: 'power_hungry', name: '能量狂人', description: '收集10个道具', icon: 'Zap', unlocked: false },
    { id: 'ace_pilot', name: '王牌飞行员', description: '分数超过10000', icon: 'Trophy', unlocked: false },
    { id: 'untouchable', name: '不可触碰', description: '在护盾保护下存活', icon: 'Shield', unlocked: false },
  ]);
  const [unlockedAchievement, setUnlockedAchievement] = useState<Achievement | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [levelUpMessage, setLevelUpMessage] = useState(false);
  const [screenShake, setScreenShake] = useState(0);
  const [muted, setMuted] = useState(false);

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
  const keysRef = useRef<Record<string, boolean>>({});
  const lastEnemySpawnRef = useRef(0);
  const lastShotRef = useRef(0);
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

  const resetGame = () => {
    setStats({
      score: 0,
      level: 1,
      health: INITIAL_HEALTH,
      enemiesDestroyed: 0,
      powerUpsCollected: 0,
      escapedEnemies: 0,
    });
    playerRef.current = { 
      x: CANVAS_WIDTH / 2, 
      y: CANVAS_HEIGHT - 100, 
      width: 50, 
      height: 50, 
      invincibility: 0, 
      shield: false, 
      tripleShot: 0,
      trail: []
    };
    bulletsRef.current = [];
    enemiesRef.current = [];
    particlesRef.current = [];
    powerUpsRef.current = [];
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
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) p.x -= PLAYER_SPEED;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) p.x += PLAYER_SPEED;
      if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) p.y -= PLAYER_SPEED;
      if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) p.y += PLAYER_SPEED;

      // Trail
      p.trail.push({ x: p.x + p.width / 2, y: p.y + p.height / 2, alpha: 0.5 });
      if (p.trail.length > 10) p.trail.shift();
      p.trail.forEach(t => t.alpha -= 0.05);
      p.trail = p.trail.filter(t => t.alpha > 0);

      // Boundaries
      p.x = Math.max(0, Math.min(CANVAS_WIDTH - p.width, p.x));
      p.y = Math.max(0, Math.min(CANVAS_HEIGHT - p.height, p.y));

      // Invincibility
      if (p.invincibility > 0) p.invincibility -= 16.67; // approx 60fps

      // Powerup Timers
      if (p.tripleShot > 0) p.tripleShot -= 16.67;

      // 2. Shooting
      if (keysRef.current['Space'] && time - lastShotRef.current > 150) {
        const centerX = p.x + p.width / 2;
        const centerY = p.y;
        
        if (p.tripleShot > 0) {
          bulletsRef.current.push(new Bullet(centerX, centerY, -Math.PI / 2));
          bulletsRef.current.push(new Bullet(centerX, centerY, -Math.PI / 2 - 0.2));
          bulletsRef.current.push(new Bullet(centerX, centerY, -Math.PI / 2 + 0.2));
        } else {
          bulletsRef.current.push(new Bullet(centerX, centerY));
        }
        audioService.playShoot();
        lastShotRef.current = time;
      }

      // 3. Spawning Enemies
      const spawnRate = Math.max(500, 1500 - (stats.level * 100));
      if (time - lastEnemySpawnRef.current > spawnRate) {
        const x = Math.random() * (CANVAS_WIDTH - 60);
        const rand = Math.random();
        let type = EnemyType.BASIC;
        if (rand > 0.8) type = EnemyType.HEAVY;
        else if (rand > 0.6) type = EnemyType.FAST;
        
        enemiesRef.current.push(new Enemy(x, type, stats.level));
        lastEnemySpawnRef.current = time;
      }

      // 4. Update Entities
      bulletsRef.current.forEach(b => b.update());
      enemiesRef.current.forEach(e => e.update());
      particlesRef.current.forEach(p => p.update());
      powerUpsRef.current.forEach(pu => pu.update());

      // Filter out-of-bounds
      bulletsRef.current = bulletsRef.current.filter(b => b.y > -10);
      
      const escaped = enemiesRef.current.filter(e => e.y > CANVAS_HEIGHT);
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

      // 5. Collision Detection
      
      // Bullets vs Enemies
      bulletsRef.current.forEach((b, bIdx) => {
        enemiesRef.current.forEach((e, eIdx) => {
          if (
            b.x > e.x && b.x < e.x + e.width &&
            b.y > e.y && b.y < e.y + e.height
          ) {
            // Hit!
            e.health -= 1;
            bulletsRef.current.splice(bIdx, 1);
            
            // Spark particles
            for (let i = 0; i < 3; i++) particlesRef.current.push(new Particle(b.x, b.y, '#fff'));

            if (e.health <= 0) {
              // Destroyed!
              enemiesRef.current.splice(eIdx, 1);
              setStats(prev => ({ 
                ...prev, 
                score: prev.score + e.scoreValue,
                enemiesDestroyed: prev.enemiesDestroyed + 1 
              }));
              audioService.playExplosion();
              
              // Explosion particles
              for (let i = 0; i < 15; i++) particlesRef.current.push(new Particle(e.x + e.width/2, e.y + e.height/2, e.color));

              // Chance to drop powerup
              if (Math.random() > 0.85) {
                const puType = Math.random() > 0.5 ? PowerUpType.SHIELD : PowerUpType.TRIPLE_SHOT;
                powerUpsRef.current.push(new PowerUp(e.x + e.width/2, e.y + e.height/2, puType));
              }

              // Achievements
              if (stats.enemiesDestroyed === 0) unlockAchievement('first_blood');
            }
          }
        });
      });

      // Player vs Enemies
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
            
            // Destroy enemy on impact
            enemiesRef.current.splice(eIdx, 1);
            for (let i = 0; i < 20; i++) particlesRef.current.push(new Particle(e.x + e.width/2, e.y + e.height/2, '#ff0000'));
          }
        });
      }

      // Player vs PowerUps
      powerUpsRef.current.forEach((pu, puIdx) => {
        const dist = Math.hypot(p.x + p.width/2 - pu.x, p.y + p.height/2 - pu.y);
        if (dist < p.width/2 + pu.radius) {
          powerUpsRef.current.splice(puIdx, 1);
          setStats(prev => ({ ...prev, powerUpsCollected: prev.powerUpsCollected + 1 }));
          audioService.playPowerUp();
          
          if (pu.type === PowerUpType.SHIELD) p.shield = true;
          if (pu.type === PowerUpType.TRIPLE_SHOT) p.tripleShot = 8000; // 8 seconds

          if (stats.powerUpsCollected + 1 >= 10) unlockAchievement('power_hungry');
        }
      });

      // 6. Level Up Logic
      const nextLevelScore = stats.level * 2000;
      if (stats.score >= nextLevelScore) {
        setStats(prev => ({ ...prev, level: prev.level + 1 }));
        setLevelUpMessage(true);
        setScreenShake(10);
        audioService.playLevelUp();
        enemiesRef.current = []; // Clear current enemies
        setTimeout(() => setLevelUpMessage(false), 2000);
        if (stats.level + 1 === 5) unlockAchievement('survivor');
      }

      // Score Achievement
      if (stats.score >= 10000) unlockAchievement('ace_pilot');

      // 7. Game Over Check
      if (stats.health <= 0) {
        setGameState(GameState.GAME_OVER);
      }

      // 8. Draw
      ctx.save();
      if (screenShake > 0) {
        const dx = (Math.random() - 0.5) * screenShake;
        const dy = (Math.random() - 0.5) * screenShake;
        ctx.translate(dx, dy);
        setScreenShake(prev => Math.max(0, prev - 1));
      }
      ctx.clearRect(-50, -50, CANVAS_WIDTH + 100, CANVAS_HEIGHT + 100);

      // Background Stars
      starsRef.current.forEach(s => {
        let speed = s.speed;
        if (levelUpMessage) speed *= 10; // Warp effect
        
        s.y += speed;
        if (s.y > CANVAS_HEIGHT) {
          s.y = -10;
          s.x = Math.random() * CANVAS_WIDTH;
        }
        
        if (levelUpMessage) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = s.size;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x, s.y - 50);
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.fillRect(s.x, s.y, s.size, s.size);
        }
      });

      // Entities
      bulletsRef.current.forEach(b => b.draw(ctx));
      enemiesRef.current.forEach(e => e.draw(ctx));
      particlesRef.current.forEach(p => p.draw(ctx));
      powerUpsRef.current.forEach(pu => pu.draw(ctx));

      // Player Trail
      p.trail.forEach(t => {
        ctx.save();
        ctx.globalAlpha = t.alpha;
        ctx.translate(t.x - p.width / 2, t.y - p.height / 2);
        ctx.beginPath();
        ctx.moveTo(p.width / 2, 0);
        ctx.lineTo(0, p.height);
        ctx.lineTo(p.width / 2, p.height * 0.8);
        ctx.lineTo(p.width, p.height);
        ctx.closePath();
        ctx.fillStyle = '#00f2ff';
        ctx.fill();
        ctx.restore();
      });

      // Player
      ctx.save();
      if (p.invincibility > 0 && Math.floor(time / 100) % 2 === 0) {
        ctx.globalAlpha = 0.3;
      }
      
      ctx.translate(p.x, p.y);
      
      // Ship Body
      ctx.beginPath();
      ctx.moveTo(p.width / 2, 0);
      ctx.lineTo(0, p.height);
      ctx.lineTo(p.width / 2, p.height * 0.8);
      ctx.lineTo(p.width, p.height);
      ctx.closePath();
      
      ctx.fillStyle = '#00f2ff';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00f2ff';
      ctx.fill();

      // Engine Glow
      ctx.beginPath();
      ctx.arc(p.width / 2, p.height * 0.9, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3d00';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff3d00';
      ctx.fill();

      // Shield
      if (p.shield) {
        ctx.beginPath();
        ctx.arc(p.width / 2, p.height / 2, p.width * 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(79, 195, 247, 0.6)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = 'rgba(79, 195, 247, 0.1)';
        ctx.fill();
      }

      ctx.restore();
      ctx.restore(); // Restore shake

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, stats.level, stats.score, stats.health, unlockAchievement]);

  // --- UI Render Helpers ---

  const renderAchievementPopup = () => (
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
        {gameState === GameState.PLAYING && (
          <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-10 pointer-events-none">
            <div className="space-y-2">
              <div className="bg-black/40 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl">
                <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">Score</p>
                <p className="text-3xl font-mono font-bold text-cyan-400 tabular-nums">
                  {stats.score.toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                {Array.from({ length: INITIAL_HEALTH }).map((_, i) => (
                  <Heart 
                    key={i} 
                    className={`w-5 h-5 ${i < stats.health ? 'text-red-500 fill-red-500' : 'text-white/20'}`} 
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button 
                onClick={() => setMuted(!muted)}
                className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-2xl pointer-events-auto hover:bg-white/10 transition-colors"
              >
                {muted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
              </button>
              <div className="bg-black/40 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl text-right">
                <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">Level</p>
                <p className="text-3xl font-mono font-bold text-orange-400">
                  {stats.level}
                </p>
              </div>
              {playerRef.current.shield && (
                <div className="flex items-center gap-2 bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/30 text-xs font-bold animate-pulse">
                  <Shield className="w-3 h-3" /> SHIELD ACTIVE
                </div>
              )}
              {playerRef.current.tripleShot > 0 && (
                <div className="flex items-center gap-2 bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full border border-orange-500/30 text-xs font-bold">
                  <Zap className="w-3 h-3" /> TRIPLE SHOT: {(playerRef.current.tripleShot / 1000).toFixed(1)}s
                </div>
              )}
            </div>
          </div>
        )}

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
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl p-8 text-center"
              >
                <motion.div
                  initial={{ y: -50 }}
                  animate={{ y: 0 }}
                  className="mb-12"
                >
                  <h1 className="text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 mb-2">
                    深空彼岸
                  </h1>
                  <div className="h-1 w-24 bg-cyan-500 mx-auto rounded-full shadow-[0_0_15px_#00f2ff]" />
                </motion.div>

                <p className="text-white/60 max-w-md mb-12 leading-relaxed">
                  作为星际联盟的顶级飞行员，你的任务是拦截入侵的敌方舰队。
                  收集能量道具，解锁成就，在无尽的太空中生存下去。
                </p>

                <button
                  onClick={resetGame}
                  className="group relative px-12 py-5 bg-white text-black font-black uppercase tracking-widest rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95"
                >
                  <div className="absolute inset-0 bg-cyan-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <span className="relative z-10 flex items-center gap-2">
                    <Play className="w-5 h-5 fill-current" /> 开始任务
                  </span>
                </button>

                <div className="mt-12 lg:hidden grid grid-cols-2 gap-4 w-full max-w-xs">
                  <div className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <Gamepad2 className="w-6 h-6 text-cyan-400" />
                    <span className="text-[10px] uppercase font-bold text-white/40">触屏操作</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <Star className="w-6 h-6 text-yellow-400" />
                    <span className="text-[10px] uppercase font-bold text-white/40">挑战成就</span>
                  </div>
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

            {gameState === GameState.GAME_OVER && (
              <motion.div
                key="gameover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-2xl p-8"
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

                <div className="w-full max-w-md mb-12">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-4 flex items-center gap-2">
                    <Trophy className="w-3 h-3" /> 已解锁成就
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {achievements.filter(a => a.unlocked).map(a => (
                      <div key={a.id} className="bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full border border-yellow-500/30 text-[10px] font-bold">
                        {a.name}
                      </div>
                    ))}
                    {achievements.filter(a => a.unlocked).length === 0 && (
                      <p className="text-white/20 italic text-sm">暂无成就</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={resetGame}
                  className="px-12 py-5 bg-white text-black font-black uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-transform"
                >
                  重新开始
                </button>
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
      {renderAchievementPopup()}

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
