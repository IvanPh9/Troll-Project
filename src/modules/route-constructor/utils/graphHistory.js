import { ref, computed } from 'vue';

const MAX_HISTORY = 100;
const MAX_LOGS = 100;

export function useGraphHistory(routeGraph) {
  const undoStack = ref([]);
  const redoStack = ref([]);
  const actionLogs = ref([]);

  function takeSnapshot(actionName, details = null) {
    if (!routeGraph.value) return;

    try {
      const snapshot = JSON.parse(JSON.stringify(routeGraph.value));
      undoStack.value.push({
        id: Date.now() + Math.random(),
        action: actionName,
        details: details ? JSON.parse(JSON.stringify(details)) : null,
        snapshot,
        time: new Date().toLocaleTimeString()
      });

      if (undoStack.value.length > MAX_HISTORY) {
        undoStack.value.shift();
      }

      // Any new action clears redo stack
      redoStack.value = [];

      // Add to action logs
      const logEntry = {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString(),
        type: 'action',
        action: actionName,
        details
      };
      actionLogs.value.unshift(logEntry);
      if (actionLogs.value.length > MAX_LOGS) {
        actionLogs.value.pop();
      }

      // Console logging
      console.groupCollapsed(
        `%c[Graph Action] %c${actionName} %c(${logEntry.time})`,
        'color: #3b82f6; font-weight: bold;',
        'color: #10b981; font-weight: bold;',
        'color: #9ca3af; font-weight: normal;'
      );
      if (details) {
        console.log('Details:', details);
      }
      console.log('Graph Snapshot:', snapshot);
      console.log('Undo Stack Size:', undoStack.value.length);
      console.groupEnd();
    } catch (e) {
      console.error('[GraphHistory] Failed to capture snapshot:', e);
    }
  }

  function undo() {
    if (undoStack.value.length === 0) {
      console.log('%c[Undo] Стек порожній, немає дій для скасування', 'color: #9ca3af; font-style: italic;');
      return false;
    }

    try {
      const currentSnapshot = JSON.parse(JSON.stringify(routeGraph.value));
      const entry = undoStack.value.pop();

      redoStack.value.push({
        id: Date.now() + Math.random(),
        action: entry.action,
        details: entry.details,
        snapshot: currentSnapshot,
        time: new Date().toLocaleTimeString()
      });

      routeGraph.value = entry.snapshot;

      const logEntry = {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString(),
        type: 'undo',
        action: `Скасовано: ${entry.action}`,
        details: entry.details
      };
      actionLogs.value.unshift(logEntry);
      if (actionLogs.value.length > MAX_LOGS) {
        actionLogs.value.pop();
      }

      console.groupCollapsed(
        `%c[Undo (Ctrl+Z)] %c${entry.action} %c(${logEntry.time})`,
        'color: #f59e0b; font-weight: bold;',
        'color: #ef4444; font-weight: bold;',
        'color: #9ca3af; font-weight: normal;'
      );
      console.log('Restored Snapshot:', entry.snapshot);
      console.log('Remaining Undo Stack:', undoStack.value.length);
      console.log('Redo Stack Size:', redoStack.value.length);
      console.groupEnd();

      return true;
    } catch (e) {
      console.error('[GraphHistory] Failed to undo:', e);
      return false;
    }
  }

  function redo() {
    if (redoStack.value.length === 0) {
      console.log('%c[Redo] Стек порожній, немає дій для повторення', 'color: #9ca3af; font-style: italic;');
      return false;
    }

    try {
      const currentSnapshot = JSON.parse(JSON.stringify(routeGraph.value));
      const entry = redoStack.value.pop();

      undoStack.value.push({
        id: Date.now() + Math.random(),
        action: entry.action,
        details: entry.details,
        snapshot: currentSnapshot,
        time: new Date().toLocaleTimeString()
      });

      routeGraph.value = entry.snapshot;

      const logEntry = {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString(),
        type: 'redo',
        action: `Повторено: ${entry.action}`,
        details: entry.details
      };
      actionLogs.value.unshift(logEntry);
      if (actionLogs.value.length > MAX_LOGS) {
        actionLogs.value.pop();
      }

      console.groupCollapsed(
        `%c[Redo (Ctrl+Y)] %c${entry.action} %c(${logEntry.time})`,
        'color: #10b981; font-weight: bold;',
        'color: #3b82f6; font-weight: bold;',
        'color: #9ca3af; font-weight: normal;'
      );
      console.log('Restored Snapshot:', entry.snapshot);
      console.log('Undo Stack Size:', undoStack.value.length);
      console.log('Remaining Redo Stack:', redoStack.value.length);
      console.groupEnd();

      return true;
    } catch (e) {
      console.error('[GraphHistory] Failed to redo:', e);
      return false;
    }
  }

  function clearHistory() {
    undoStack.value = [];
    redoStack.value = [];
    actionLogs.value = [];
    console.log('%c[GraphHistory] Історію та логи очищено', 'color: #9ca3af;');
  }

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  return {
    undoStack,
    redoStack,
    actionLogs,
    takeSnapshot,
    undo,
    redo,
    clearHistory,
    canUndo,
    canRedo
  };
}
