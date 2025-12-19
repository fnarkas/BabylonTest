/**
 * Simple confetti effect
 * Creates colorful falling particles to celebrate the winner
 */

interface ConfettiParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    rotationSpeed: number;
    color: string;
    size: number;
}

export class Confetti {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private particles: ConfettiParticle[] = [];
    private animationId: number | null = null;
    private colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
        `;
        this.ctx = this.canvas.getContext('2d')!;
        document.body.appendChild(this.canvas);
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    private resize(): void {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    private createParticle(): ConfettiParticle {
        return {
            x: Math.random() * this.canvas.width,
            y: -20,
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 2 + 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            color: this.colors[Math.floor(Math.random() * this.colors.length)],
            size: Math.random() * 8 + 4
        };
    }

    start(duration: number = 3000): void {
        this.stop(); // Stop any existing animation

        // Create initial burst
        for (let i = 0; i < 150; i++) {
            this.particles.push(this.createParticle());
        }

        // Add more particles over time
        const intervalId = setInterval(() => {
            for (let i = 0; i < 10; i++) {
                this.particles.push(this.createParticle());
            }
        }, 100);

        // Stop creating new particles after duration
        setTimeout(() => {
            clearInterval(intervalId);
        }, duration);

        this.animate();
    }

    private animate = (): void => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw particles
        this.particles = this.particles.filter(p => {
            // Update position
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            p.vy += 0.1; // Gravity

            // Remove if off screen
            if (p.y > this.canvas.height + 20) {
                return false;
            }

            // Draw particle
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate((p.rotation * Math.PI) / 180);
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            this.ctx.restore();

            return true;
        });

        // Continue animation if there are particles
        if (this.particles.length > 0) {
            this.animationId = requestAnimationFrame(this.animate);
        } else {
            this.cleanup();
        }
    };

    stop(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.particles = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    cleanup(): void {
        this.stop();
        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}
