import { wheee, swish, bong, crash } from './recipes.js';

// What to do for a batch of game events: { play: recipe } or { stop: name }.
// Every event plays at most one sound; other events are silent.
export function soundActions(events) {
  const actions = [];
  for (const event of events) {
    if (event.type === 'release') {
      actions.push({ play: wheee() });
    } else if (event.type === 'swish') {
      actions.push({ play: swish() });
    } else if (event.type === 'death') {
      // A death cuts the "wheee" of the flight it ended.
      actions.push({ stop: 'wheee' });
      actions.push({ play: event.cause === 'obstacle' ? bong(event.obstacle) : crash() });
    }
  }
  return actions;
}
