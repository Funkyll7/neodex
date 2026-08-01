/**
 * store.js — etat applicatif minimaliste.
 *
 * Un seul objet d'etat, des abonnes notifies apres chaque `set`.
 * Les notifications sont groupees dans une microtache : dix `set` d'affilee
 * ne declenchent qu'un seul rendu.
 */

export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  let pending = null;
  let changed = new Set();

  function flush() {
    pending = null;
    const keys = changed;
    changed = new Set();
    for (const listener of [...listeners]) listener(state, keys);
  }

  return {
    get state() {
      return state;
    },

    /** Fusionne un patch (ou le resultat d'une fonction) dans l'etat. */
    set(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      let touched = false;
      for (const [key, value] of Object.entries(next)) {
        if (!Object.is(state[key], value)) {
          changed.add(key);
          touched = true;
        }
      }
      if (!touched) return;
      state = { ...state, ...next };
      if (!pending) pending = Promise.resolve().then(flush);
    },

    /** S'abonne aux changements. Renvoie la fonction de desabonnement. */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Retarde un appel tant qu'il est reappele (utile sur la recherche). */
export function debounce(fn, delay = 160) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
