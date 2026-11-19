import { engine } from '../audio/engine'
import { Game } from './game'

export const game = new Game(engine)

if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game
