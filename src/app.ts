/** What every screen shares: the data source and the one player. */
import type { DataSource } from './data/types';
import { mockSource } from './data/mock';
import { Player } from './playback/player';
import { Html5Engine } from './playback/html5';

export const app = {
  source: mockSource as DataSource,
  player: new Player(new Html5Engine()),
};
