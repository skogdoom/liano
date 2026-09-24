import { bong, crash } from './recipes.js';

// The sounds to play for a batch of game events: a bong for an obstacle hit and a
// crash for a fall. Every event plays at most one sound; other events are silent.
export function soundsFor(events) {
  const sounds = [];
  for (const event of events) {
    if (event.type === 'death') sounds.push(event.cause === 'obstacle' ? bong(event.obstacle) : crash());
  }
  return sounds;
}
