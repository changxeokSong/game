/** Air Hockey canvas renderer. Internal resolution: 480 × 272. */
const W = 480, H = 272;
const PR = 14, PAR = 28, GH = 120, GY = (H - GH) / 2;

export class AirHockeyRenderer {
  constructor(canvas) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    canvas.width   = W;
    canvas.height  = H;
  }

  draw(state, playerIdx) {
    const { ctx } = this;
    ctx.save();
    if (playerIdx === 1) { ctx.translate(W, H); ctx.rotate(Math.PI); }
    this._rink(ctx);
    this._paddle(ctx, state.paddles[0], '#ff5555', playerIdx === 0);
    this._paddle(ctx, state.paddles[1], '#44ddcc', playerIdx === 1);
    this._puck(ctx, state.puck);
    ctx.restore();
  }

  drawWaiting() {
    const { ctx } = this;
    ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#445'; ctx.font = '13px Segoe UI';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('상대방을 기다리는 중…', W / 2, H / 2);
  }

  _rink(ctx) {
    const bg = ctx.createLinearGradient(0, 0, W, 0);
    bg.addColorStop(0, '#0b1a30'); bg.addColorStop(.5, '#112244'); bg.addColorStop(1, '#0b1a30');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,85,85,.15)';   ctx.fillRect(0,   GY, 10, GH);
    ctx.fillStyle = 'rgba(68,221,204,.15)';  ctx.fillRect(W-10, GY, 10, GH);
    ctx.strokeStyle = '#ff5555'; ctx.lineWidth = 2;
    ctx.strokeRect(0,   GY, 10, GH);
    ctx.strokeStyle = '#44ddcc';
    ctx.strokeRect(W-10, GY, 10, GH);

    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W/2, H/2, 50, 0, Math.PI * 2); ctx.stroke();
  }

  _paddle(ctx, { x, y }, color, isMe) {
    const g = ctx.createRadialGradient(x, y, PAR*.5, x, y, PAR*1.8);
    g.addColorStop(0, color + '2a'); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, PAR*1.8, 0, Math.PI*2); ctx.fill();

    const g2 = ctx.createRadialGradient(x-7, y-7, 0, x, y, PAR);
    g2.addColorStop(0, '#fff'); g2.addColorStop(.3, color); g2.addColorStop(1, color+'aa');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, PAR, 0, Math.PI*2); ctx.fill();

    ctx.strokeStyle = isMe ? '#ffffffcc' : '#ffffff33';
    ctx.lineWidth   = isMe ? 2 : 1;
    ctx.beginPath(); ctx.arc(x, y, PAR, 0, Math.PI*2); ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2); ctx.fill();
  }

  _puck(ctx, { x, y }) {
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(x+3, y+3, PR, PR*.6, 0, 0, Math.PI*2); ctx.fill();
    const g = ctx.createRadialGradient(x-4, y-4, 0, x, y, PR);
    g.addColorStop(0, '#999'); g.addColorStop(.5, '#444'); g.addColorStop(1, '#111');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, PR, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.arc(x-4, y-4, PR*.33, 0, Math.PI*2); ctx.fill();
  }
}
