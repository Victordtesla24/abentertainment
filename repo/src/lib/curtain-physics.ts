export interface ClothConfig {
  width: number;
  height: number;
  segmentsX: number;
  segmentsY: number;
  mass: number;
  stiffness: number;
  damping: number;
  gravity: number;
}

export class ClothSimulation {
  private particles: Float32Array;
  private velocities: Float32Array;
  private restPositions: Float32Array;
  private pinned: Set<number>;
  private readonly config: ClothConfig;

  constructor(config: ClothConfig) {
    this.config = config;
    const count = (config.segmentsX + 1) * (config.segmentsY + 1);
    this.particles = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.restPositions = new Float32Array(count * 3);
    this.pinned = new Set();

    for (let y = 0; y <= config.segmentsY; y += 1) {
      for (let x = 0; x <= config.segmentsX; x += 1) {
        const index = (y * (config.segmentsX + 1) + x) * 3;
        const px = (x / config.segmentsX) * config.width - config.width / 2;
        const py = (1 - y / config.segmentsY) * config.height;
        this.particles[index] = px;
        this.particles[index + 1] = py;
        this.particles[index + 2] = 0;
        this.restPositions[index] = px;
        this.restPositions[index + 1] = py;
        this.restPositions[index + 2] = 0;
      }
    }

    for (let x = 0; x <= config.segmentsX; x += 1) {
      this.pinned.add(x);
    }
  }

  simulate(deltaSeconds: number, pullForce: number) {
    const { damping, gravity, segmentsX, segmentsY, stiffness } = this.config;
    const cols = segmentsX + 1;

    for (let index = 0; index < this.particles.length / 3; index += 1) {
      if (this.pinned.has(index)) {
        const restX = this.restPositions[index * 3];
        this.particles[index * 3] += pullForce * Math.sign(restX) * deltaSeconds;
        continue;
      }
      this.velocities[index * 3 + 1] -= gravity * deltaSeconds;
      this.velocities[index * 3] *= 1 - damping * deltaSeconds;
      this.velocities[index * 3 + 1] *= 1 - damping * deltaSeconds;
      this.velocities[index * 3 + 2] *= 1 - damping * deltaSeconds;
    }

    const restX = this.config.width / segmentsX;
    const restY = this.config.height / segmentsY;
    for (let y = 0; y <= segmentsY; y += 1) {
      for (let x = 0; x <= segmentsX; x += 1) {
        const idx = y * cols + x;
        if (x < segmentsX) this.applySpring(idx, idx + 1, restX, stiffness);
        if (y < segmentsY) this.applySpring(idx, idx + cols, restY, stiffness);
      }
    }

    for (let index = 0; index < this.particles.length / 3; index += 1) {
      if (this.pinned.has(index)) continue;
      this.particles[index * 3] += this.velocities[index * 3] * deltaSeconds;
      this.particles[index * 3 + 1] += this.velocities[index * 3 + 1] * deltaSeconds;
      this.particles[index * 3 + 2] += this.velocities[index * 3 + 2] * deltaSeconds;
    }
  }

  getPositions() {
    return this.particles;
  }

  private applySpring(a: number, b: number, rest: number, stiffness: number) {
    const ax = this.particles[a * 3];
    const ay = this.particles[a * 3 + 1];
    const az = this.particles[a * 3 + 2];
    const bx = this.particles[b * 3];
    const by = this.particles[b * 3 + 1];
    const bz = this.particles[b * 3 + 2];

    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const distance = Math.hypot(dx, dy, dz) || 1;
    const diff = (distance - rest) / distance;
    const force = stiffness * diff * 0.5;

    if (!this.pinned.has(a)) {
      this.velocities[a * 3] += dx * force;
      this.velocities[a * 3 + 1] += dy * force;
      this.velocities[a * 3 + 2] += dz * force;
    }
    if (!this.pinned.has(b)) {
      this.velocities[b * 3] -= dx * force;
      this.velocities[b * 3 + 1] -= dy * force;
      this.velocities[b * 3 + 2] -= dz * force;
    }
  }
}
