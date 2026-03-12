import { Queuer } from "@tanstack/pacer";
import { psReader, psWriter } from "./leanaide";
import { isOutputSent, isServerReady } from "./constants";
import { Array } from "effect";
import { $effect, $state } from "./states";

export const inputQ = new Queuer<string>((_) => _, {
  // manual queue
  started: false,
  wait: 1000,
  onItemsChange(queuer) {
    // when started or gets a new input
    // first checks if it is ready
    if ($state.ready()) {
      // get the item as FIFO
      const input = queuer.getNextItem();
      if (input) {
        // stop here because we don't want a barrage of inputs to be processed
        inputQ.stop();
        // the queue adds to the writer queue
        processQ.addItem(input);
        // change the state to "wait-for-output"
        $effect.waitOutput();
      }
    }
  },
});

export const processQ = new Queuer<string>(
  (item) => {
    psWriter.emit("write", item);
  },
  {
    started: true,
    wait: 1000,
  },
);

export const resultQ = new Queuer<string>((_) => _, {
  started: false,
  wait: 1000,
  onExecute(item) {
    try {
      const json = JSON.parse(item);
      psReader.emit("result", json);
      psReader.emit("output-queue", json);
    } catch {}
  },
});

export const outputQ = new Queuer<string>(_ => _, {
  started: true,
  wait: 1000,
})

export const displayQ = new Queuer<string>(
  // get the value from display queue
  (item) => {
    // first log to stdout
    psReader.emit('console', item)
    // if the line from leanaide contains
    // line "Server ready"
    if (isServerReady(item)) {
      // if true change the state to ready
      $effect.ready();
      // start the manual queue
      inputQ.start();
    }
    if (isOutputSent(item) && $state.waitOutput()) {
      // if both the statements are true, process the complete result queue
      resultQ.flushAsBatch((item) => {
        return Array.reduce(item, "", (acc, x) => acc + x);
      });
      $effect.reset();
    }
  },
  {
    started: true,
    wait: 1000,
    onItemsChange(queuer) {
      // while consuming the changes in display queue
      if ($state.waitOutput()) {
        // get the latest element from the queue
        const lastItem = queuer.peekNextItem();
        // if it is non empty, add to the resultQ
        if (lastItem) {
          resultQ.addItem(lastItem);
        }
      }
    },
  },
);
