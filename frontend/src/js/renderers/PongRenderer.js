/** Pong canvas renderer. Internal resolution: 480 × 272. */
const W = 480, H = 272, BR = 10, PW = 12, PH = 72;

export class PongRenderer {
  constructor(canvas) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    canvas.width  = W;
    canvas.height = H;
  }

  draw(state, _playerIdx) {
    const { ctx } = this;
    ctx.fillStyle = '#020208'; ctx.fillRect(0, 0, W, H);

    ctx.setLineDash([7, 7]);
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
    ctx.setLineDash([]);

    this._paddle(ctx, state.paddles[0], '#ff5555');
    this._paddle(ctx, state.paddles[1], '#44ddcc');
    this._ball(ctx, state.puck);
  }

  drawWaiting() {
    const { ctx } = this;
    ctx.fillStyle = '#020208'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#334'; ctx.font = '13px Segoe UI';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('상대방을 기다리는 중…', W / 2, H / 2);
  }

  _paddle(ctx, { x, y }, color) {
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    const g = ctx.createLinearGradient(x - PW/2, y - PH/2, x + PW/2, y + PH/2);
    g.addColorStop(0, color + 'ee'); g.addColorStop(1, color + '55');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x - PW/2, y - PH/2, PW, PH, 3); ctx.fill();
    ctx.shadowBlur = 0;
  }

  _ball(ctx, { x, y }) {
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 8;
    const g = ctx.createRadialGradient(x-3, y-3, 0, x, y, BR);
    g.addColorStop(0, '#fff'); g.addColorStop(.4, '#aaa'); g.addColorStop(1, '#444');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, BR, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}
