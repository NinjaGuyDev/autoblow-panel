import { useReducer, useCallback } from 'react';
import type { FunscriptAction } from '@/types/funscript';

interface UndoableState {
  past: FunscriptAction[][];
  present: FunscriptAction[];
  future: FunscriptAction[][];
}

type UndoableAction =
  | { type: 'SET'; actions: FunscriptAction[] }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET'; actions: FunscriptAction[] };

const MAX_HISTORY_SIZE = 50;

function undoableReducer(state: UndoableState, action: UndoableAction): UndoableState {
  switch (action.type) {
    case 'SET': {
      const newPast = [...state.past, state.present];
      // Cap history at MAX_HISTORY_SIZE - drop oldest if exceeded
      const cappedPast = newPast.length > MAX_HISTORY_SIZE
        ? newPast.slice(newPast.length - MAX_HISTORY_SIZE)
        : newPast;

      return {
        past: cappedPast,
        present: action.actions,
        future: [], // Clear future on new action
      };
    }

    case 'UNDO': {
      if (state.past.length === 0) return state;

      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);

      return {
        past: newPast,
        present: previous,
        future: [state.present, ...state.future],
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;

      const next = state.future[0];
      const newFuture = state.future.slice(1);

      return {
        past: [...state.past, state.present],
        present: next,
        future: newFuture,
      };
    }

    case 'RESET': {
      return {
        past: [],
        present: action.actions,
        future: [],
      };
    }

    default:
      return state;
  }
}

export interface UseUndoableActionsReturn {
  actions: FunscriptAction[];
  setActions: (actions: FunscriptAction[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (actions: FunscriptAction[]) => void;
  historySize: number;
}

export function useUndoableActions(
  initialActions: FunscriptAction[] = []
): UseUndoableActionsReturn {
  const [state, dispatch] = useReducer(undoableReducer, {
    past: [],
    present: initialActions,
    future: [],
  });

  const setActions = useCallback((actions: FunscriptAction[]) => {
    dispatch({ type: 'SET', actions });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const reset = useCallback((actions: FunscriptAction[]) => {
    dispatch({ type: 'RESET', actions });
  }, []);

  return {
    actions: state.present,
    setActions,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    reset,
    historySize: state.past.length,
  };
}
