import { engine } from '../audio/engine'
import { Coach } from './game'

export const coach = new Coach(engine)

if (import.meta.env.DEV) (window as unknown as { __coach: Coach }).__coach = coach
