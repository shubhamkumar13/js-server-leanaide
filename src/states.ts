import { createStore } from "@tanstack/store";

// states of programs
// 1. not-ready
// 2. ready
// 3. wait-for-output
// 4. goto 1.

const $currentState = createStore("not-ready");

export const initState = () => {
  $currentState.setState((_) => "not-ready");
};
const resetState = initState;
const getCurrent = createStore((_) => $currentState.state);
const toReady = () => $currentState.setState((_) => "ready");
const toWaitOutput = () => $currentState.setState((_) => "wait-for-output");

const isNotReady = createStore((_) => $currentState.state === "not-ready");

const isReady = createStore((_) => $currentState.state === "ready");
const isWaitOutput = createStore((_) => $currentState.state === "wait-for-output");

export const $state = {
  current: () => getCurrent.state,
  ready: () => isReady.state,
  notReady: () => isNotReady.state,
  waitOutput: () => isWaitOutput.state,
};

export const $effect = {
  init: () => initState(),
  reset: () => resetState(),
  ready: () => toReady(),
  notReady: () => resetState(),
  waitOutput: () => toWaitOutput(),
};
