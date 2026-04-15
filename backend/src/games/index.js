'use strict';
/**
 * Game registry.
 * To add a new game: require its module and add an entry.
 */
const AirHockey = require('./AirHockey');
const Pong      = require('./Pong');

const GAMES = {
  'air-hockey': {
    id: 'air-hockey', name: 'Air Hockey',
    desc: '마우스로 퍽을 쳐서 골을 넣으세요', icon: '🏒',
    W: AirHockey.C.W,  H: AirHockey.C.H,  win: AirHockey.C.WIN,
    createState: AirHockey.createState,
    launch:      AirHockey.launch,
    tick:        AirHockey.tick,
    move:        AirHockey.move,
  },
  'pong': {
    id: 'pong', name: 'Pong',
    desc: '클래식 탁구. 공을 받아치세요', icon: '🏓',
    W: Pong.C.W,  H: Pong.C.H,  win: Pong.C.WIN,
    createState: Pong.createState,
    launch:      Pong.launch,
    tick:        Pong.tick,
    move:        Pong.move,
  },
  'tron': {
    id: 'tron', name: 'Neon Tron',
    desc: '빛의 궤적 대결. 벽과 꼬리를 피하세요', icon: '🏎️',
    W: require('./Tron').C.W,  H: require('./Tron').C.H,  win: require('./Tron').C.WIN,
    createState: require('./Tron').createState,
    launch:      require('./Tron').launch,
    tick:        require('./Tron').tick,
    move:        require('./Tron').move,
  },
  'breakers': {
    id: 'breakers', name: 'Breakers VS',
    desc: '협동 블록 파괴 실력 경쟁', icon: '💎',
    W: require('./Breakers').C.W,  H: require('./Breakers').C.H,  win: require('./Breakers').C.WIN,
    createState: require('./Breakers').createState,
    launch:      require('./Breakers').launch,
    tick:        require('./Breakers').tick,
    move:        require('./Breakers').move,
  },
  'volley': {
    id: 'volley', name: 'Slime Volley',
    desc: '점프와 중력을 이용한 슬라임 배구', icon: '🏐',
    W: require('./SlimeVolley').C.W,  H: require('./SlimeVolley').C.H,  win: require('./SlimeVolley').C.WIN,
    createState: require('./SlimeVolley').createState,
    launch:      require('./SlimeVolley').launch,
    tick:        require('./SlimeVolley').tick,
    move:        require('./SlimeVolley').move,
  },
  'tanks': {
    id: 'tanks', name: 'Cyber Tanks',
    desc: '포탄이 튕기는 전략 탱크 슈팅', icon: '🚀',
    W: require('./Tanks').C.W,  H: require('./Tanks').C.H,  win: require('./Tanks').C.WIN,
    createState: require('./Tanks').createState,
    launch:      require('./Tanks').launch,
    tick:        require('./Tanks').tick,
    move:        require('./Tanks').move,
  },
};

module.exports = GAMES;
