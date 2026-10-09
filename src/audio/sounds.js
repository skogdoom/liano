import { bong, crash, pling } from './recipes.js';

// The sounds to play for a batch of game events: a bong for an obstacle hit, a crash
// for a fall and a pling for a banana taken. Every event plays at most one sound;
// other events are silent.
export function soundsFor(events) {
  const sounds = [];
  for (const event of events) {
    if (event.type === 'death') sounds.push(event.cause === 'obstacle' ? bong(event.obstacle) : crash());
    else if (event.type === 'banana') sounds.push(pling());
  }
  return sounds;
}
