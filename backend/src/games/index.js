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
};

module.exports = GAMES;
