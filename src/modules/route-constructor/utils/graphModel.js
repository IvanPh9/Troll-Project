/**
 * Graph Model Utilities for Route Constructor
 * Implements a cyclical linked list for nodes, segments, and stops.
 */

// 1. Migration: Convert old array-based state to graph-based state
export function migrateToGraph(nodesArr, segmentsArr, branchesArr) {
  const graph = {
    startNodeId: null,
    nodes: {},
    segments: {},
    stops: {}
  };

  if (!nodesArr || nodesArr.length === 0) return graph;

  const nodes = JSON.parse(JSON.stringify(nodesArr));
  const segments = JSON.parse(JSON.stringify(segmentsArr));
  const branches = JSON.parse(JSON.stringify(branchesArr || []));

  const topNode = nodes.find(n => n.side === 'top' || (!n.side && nodes.indexOf(n) === 0));
  const bottomNode = nodes.find(n => n.side === 'bottom' || (!n.side && nodes.indexOf(n) > 0));
  const rightNodes = nodes.filter(n => n.side === 'right');
  const leftNodes = nodes.filter(n => n.side === 'left');

  const rightSegs = segments.filter(s => s.side === 'right' || (!s.side && segments.indexOf(s) < Math.ceil(segments.length / 2)));
  const leftSegs = segments.filter(s => s.side === 'left' || (!s.side && segments.indexOf(s) >= Math.ceil(segments.length / 2)));

  nodes.forEach(n => {
    let side = n.side;
    if (!side) {
      if (topNode && n.id === topNode.id) side = 'top';
      else if (bottomNode && n.id === bottomNode.id) side = 'bottom';
      else side = 'right';
    }
    graph.nodes[n.id] = { ...n, side, nextSegId: null, altSegId: null };
  });

  graph.startNodeId = topNode ? topNode.id : nodes[0].id;

  // Ordered list of nodes along right rail: [topNode, ...rightNodes, bottomNode]
  const fullRightNodes = [topNode, ...rightNodes, bottomNode].filter(Boolean);

  rightSegs.forEach((seg, i) => {
    const fromNode = fullRightNodes[i];
    const toNode = fullRightNodes[i + 1] || bottomNode || leftNodes[0] || topNode;
    if (fromNode && graph.nodes[fromNode.id]) graph.nodes[fromNode.id].nextSegId = seg.id;
    
    let firstStopId = null, prevStop = null;
    (seg.stops || []).forEach(st => {
      const stopClone = { ...st, nextStopId: null };
      graph.stops[st.id] = stopClone;
      if (!firstStopId) firstStopId = st.id;
      if (prevStop) prevStop.nextStopId = st.id;
      prevStop = stopClone;
    });

    graph.segments[seg.id] = { ...seg, stops: undefined, side: 'right', nextNodeId: toNode ? toNode.id : null, firstStopId };
  });

  // Ordered list of nodes along left rail: [bottomNode, ...leftNodes, topNode]
  const fullLeftNodes = [bottomNode, ...leftNodes, topNode].filter(Boolean);

  leftSegs.forEach((seg, i) => {
    const fromNode = fullLeftNodes[i];
    const toNode = fullLeftNodes[i + 1] || topNode || fullRightNodes[0];
    if (fromNode && graph.nodes[fromNode.id]) graph.nodes[fromNode.id].nextSegId = seg.id;
    
    let firstStopId = null, prevStop = null;
    (seg.stops || []).forEach(st => {
      const stopClone = { ...st, nextStopId: null };
      graph.stops[st.id] = stopClone;
      if (!firstStopId) firstStopId = st.id;
      if (prevStop) prevStop.nextStopId = st.id;
      prevStop = stopClone;
    });

    graph.segments[seg.id] = { ...seg, stops: undefined, side: 'left', nextNodeId: toNode ? toNode.id : null, firstStopId };
  });

  branches.forEach(br => {
    if (!br.finished) return;
    const parentSeg = segments.find((s, idx) => idx === br.segIdx);
    if (!parentSeg) return;
    
    let branchStartNode = nodes.find(n => graph.nodes[n.id] && graph.nodes[n.id].nextSegId === parentSeg.id);
    if (!branchStartNode) return;

    const brNodes = br.nodes || [];
    const brSections = br.sections || [];
    
    brNodes.forEach((n) => {
      graph.nodes[n.id] = { ...n, nextSegId: null, altSegId: null, isBranchNode: true };
    });

    let firstBrSegId = null;
    brSections.forEach((sec, idx) => {
      const segId = 'br_seg_' + Date.now() + '_' + idx;
      let firstStopId = null, prevStop = null;
      (sec.stops || []).forEach(st => {
        const stopClone = { ...st, nextStopId: null };
        graph.stops[st.id] = stopClone;
        if (!firstStopId) firstStopId = st.id;
        if (prevStop) prevStop.nextStopId = st.id;
        prevStop = stopClone;
      });

      const toNodeId = brNodes[idx] ? brNodes[idx].id : (br.targetNodeId || graph.segments[parentSeg.id].nextNodeId);
      
      graph.segments[segId] = { 
        id: segId, isBranch: true, travelTime: 5, interval: parentSeg.interval,
        side: parentSeg.side, nextNodeId: toNodeId, firstStopId 
      };

      if (idx === 0) firstBrSegId = segId;
      else if (brNodes[idx - 1]) graph.nodes[brNodes[idx - 1].id].nextSegId = segId;
    });

    if (firstBrSegId && graph.nodes[branchStartNode.id]) {
      graph.nodes[branchStartNode.id].altSegId = firstBrSegId;
      graph.nodes[branchStartNode.id].branchConfig = {
        finished: br.finished,
        targetType: br.targetType,
        targetNodeId: br.targetNodeId,
        targetStopId: br.targetStopId,
        mergeConfigured: br.mergeConfigured,
        bypassedMainState: br.bypassedMainState,
        name: br.name || 'Альтернатива'
      };
    }
  });

  return graph;
}

export function traverseGraph(graph) {
  const result = { nodes: [], segments: [], branches: [] };
  if (!graph.startNodeId) return result;

  const visitedNodes = new Set();
  let currentNodeId = graph.startNodeId;

  const leftSegs = [];
  const leftNodes = [];

  while (currentNodeId && !visitedNodes.has(currentNodeId)) {
    const node = graph.nodes[currentNodeId];
    if (!node) break;
    
    visitedNodes.add(currentNodeId);
    
    const effectiveSide = (node.side === 'top' || node.side === 'bottom') ? undefined : node.side;
    const outNode = { ...node, side: effectiveSide };
    
    if (node.side === 'left') {
      leftNodes.unshift(outNode); // prepend for left side visual reversing
    } else {
      result.nodes.push(outNode);
    }

    const segId = node.nextSegId;
    if (segId) {
      const seg = graph.segments[segId];
      if (seg) {
        const stops = [];
        let stopId = seg.firstStopId;
        while (stopId) {
          const st = graph.stops[stopId];
          if (st) {
            stops.push({ ...st });
            stopId = st.nextStopId;
          } else break;
        }

        const segSide = seg.side || (node.side === 'left' ? 'left' : 'right');
        const outSeg = { 
          ...seg, 
          stops, 
          side: segSide,
          fromNodeId: node.id,
          nextNodeId: seg.nextNodeId
        };
        if (segSide === 'left') {
          leftSegs.unshift(outSeg);
        } else {
          result.segments.push(outSeg);
        }
        currentNodeId = seg.nextNodeId;
      } else currentNodeId = null;
    } else currentNodeId = null;
  }

  result.nodes = result.nodes.concat(leftNodes);
  result.segments = result.segments.concat(leftSegs);

  Object.values(graph.nodes).forEach(node => {
    if (node.altSegId) {
      const parentSeg = result.segments.find(s => s.id === node.nextSegId);
      const br = {
        id: 'br_' + node.id,
        startNodeId: node.id,
        altSegId: node.altSegId,
        segIdx: parentSeg ? result.segments.indexOf(parentSeg) : 0,
        side: parentSeg ? parentSeg.side : (node.side || 'right'),
        finished: node.branchConfig?.finished ?? true,
        targetType: node.branchConfig?.targetType ?? 'node',
        targetNodeId: node.branchConfig?.targetNodeId,
        targetStopId: node.branchConfig?.targetStopId,
        mergeConfigured: node.branchConfig?.mergeConfigured,
        bypassedMainState: node.branchConfig?.bypassedMainState,
        name: node.branchConfig?.name || 'Альтернатива',
        nodes: [],
        sections: []
      };
      
      let currentAltSegId = node.altSegId;
      while (currentAltSegId) {
        const altSeg = graph.segments[currentAltSegId];
        if (!altSeg) break;
        
        const stops = [];
        let stopId = altSeg.firstStopId;
        while (stopId) {
          const st = graph.stops[stopId];
          if (st) { stops.push({ ...st }); stopId = st.nextStopId; } 
          else break;
        }
        
        br.sections.push({ ...altSeg, stops });
        
        const nextN = graph.nodes[altSeg.nextNodeId];
        if (nextN && nextN.isBranchNode && nextN.nextSegId && !visitedNodes.has(nextN.id)) {
          br.nodes.push({ ...nextN });
          currentAltSegId = nextN.nextSegId;
        } else {
          br.targetNodeId = altSeg.nextNodeId || (parentSeg ? parentSeg.nextNodeId : null);
          currentAltSegId = null;
        }
      }

      // Link last stop of branch to main segment stop / target stop
      let lastBranchStop = null;
      for (let i = br.sections.length - 1; i >= 0; i--) {
        const secStops = br.sections[i].stops;
        if (secStops && secStops.length > 0) {
          lastBranchStop = secStops[secStops.length - 1];
          break;
        }
      }

      if (lastBranchStop) {
        let targetNextStopId = (br.targetType !== 'node' && br.targetStopId) ? br.targetStopId : null;
        lastBranchStop.nextStopId = targetNextStopId;
      }

      result.branches.push(br);
    }
  });

  return result;
}

function checkStopInSeg(graph, segId, stopId) {
  if (!graph || !graph.segments[segId] || !stopId) return false;
  let curr = graph.segments[segId].firstStopId;
  const visited = new Set();
  while (curr && !visited.has(curr)) {
    visited.add(curr);
    if (String(curr) === String(stopId)) return true;
    curr = graph.stops[curr]?.nextStopId;
  }
  return false;
}

// 3. Graph Mutations (CRUD)
export function addControlNodeGraph(graph, targetSegId, posMode = 'before', side = 'right') {
  const oldSeg = graph.segments[targetSegId];
  if (!oldSeg) return null;

  const newNodeId = Date.now();
  const newSegId = Date.now() + 1;

  const newNode = {
    id: newNodeId,
    type: 'control',
    name: 'Контрольна ' + (Object.values(graph.nodes).filter(n => n.type === 'control').length + 1),
    nextSegId: newSegId,
    altSegId: null,
    side: oldSeg.side || side
  };
  graph.nodes[newNodeId] = newNode;

  const half = Math.max(1, Math.floor(oldSeg.travelTime / 2));

  if (posMode === 'before') {
    // FIRST ARROW (posMode === 'before'):
    // Add new control node after existing stops of this segment.
    // oldSeg keeps all existing stops (firstStopId remains untouched) and now ends at newNodeId.
    // newSeg is created between newNodeId and oldSeg.nextNodeId and is EMPTY (firstStopId: null).
    const newSeg = {
      id: newSegId,
      travelTime: half,
      interval: oldSeg.interval,
      intervalMax: oldSeg.intervalMax,
      side: oldSeg.side || side,
      nextNodeId: oldSeg.nextNodeId,
      firstStopId: null
    };
    graph.segments[newSegId] = newSeg;

    oldSeg.travelTime = Math.max(1, oldSeg.travelTime - half);
    oldSeg.nextNodeId = newNodeId;
  } else if (posMode === 'bypassed_split') {
    // Find the branch that bypasses this segment
    const brNodeId = Object.keys(graph.nodes).find(nId => {
       const n = graph.nodes[nId];
       if (!n.altSegId || (!n.branchConfig?.finished && n.branchConfig?.bypassedMainState !== 'add_pills')) return false;
       if (graph.segments[n.nextSegId]?.id === targetSegId) return true;
       if (graph.segments[targetSegId] && checkStopInSeg(graph, targetSegId, n.branchConfig?.targetStopId)) return true;
       let currNodeId = n.id;
       const visited = new Set();
       while (currNodeId && !visited.has(currNodeId)) {
         visited.add(currNodeId);
         const segId = graph.nodes[currNodeId]?.nextSegId;
         if (segId === targetSegId) return true;
         const seg = graph.segments[segId];
         if (!seg || (n.branchConfig?.targetNodeId && String(seg.nextNodeId) === String(n.branchConfig.targetNodeId))) break;
         currNodeId = seg.nextNodeId;
       }
       return false;
    });
    
    let targetStopId = null;
    let brNode = brNodeId ? graph.nodes[brNodeId] : null;
    if (brNode && brNode.branchConfig) {
       targetStopId = brNode.branchConfig.targetStopId;
    }

    let isTargetInOldSeg = false;
    let prevStopBeforeTarget = null;

    if (targetStopId && oldSeg.firstStopId) {
      let curr = oldSeg.firstStopId;
      const visited = new Set();
      while (curr && !visited.has(curr)) {
        visited.add(curr);
        if (String(curr) === String(targetStopId)) {
          isTargetInOldSeg = true;
          break;
        }
        prevStopBeforeTarget = curr;
        curr = graph.stops[curr]?.nextStopId;
      }
    }

    let newSegFirstStopId = null;
    if (isTargetInOldSeg) {
      newSegFirstStopId = targetStopId;
      if (String(oldSeg.firstStopId) === String(targetStopId)) {
        oldSeg.firstStopId = null;
      } else if (prevStopBeforeTarget && graph.stops[prevStopBeforeTarget]) {
        graph.stops[prevStopBeforeTarget].nextStopId = null;
      }
    } else {
      newSegFirstStopId = null;
    }

    const newSeg = {
      id: newSegId,
      travelTime: half,
      interval: oldSeg.interval,
      intervalMax: oldSeg.intervalMax,
      side: oldSeg.side || side,
      nextNodeId: oldSeg.nextNodeId,
      firstStopId: newSegFirstStopId
    };
    graph.segments[newSegId] = newSeg;

    oldSeg.travelTime = Math.max(1, oldSeg.travelTime - half);
    oldSeg.nextNodeId = newNodeId;

    if (brNode && brNode.branchConfig) {
      if (isTargetInOldSeg && targetStopId) {
        brNode.branchConfig.targetStopId = targetStopId;
      }
      brNode.branchConfig.targetNodeId = newSeg.nextNodeId;
    }
  } else {
    // SECOND ARROW (posMode === 'after'):
    // Add a new control node after the end control point of this segment,
    // creating a new empty section below starting from the end of the previous control point.
    const endNodeId = oldSeg.nextNodeId;
    const endNode = endNodeId ? graph.nodes[endNodeId] : null;

    if (endNode && endNode.nextSegId && graph.segments[endNode.nextSegId]) {
      const segAfter = graph.segments[endNode.nextSegId];
      // Create newSeg after newNodeId pointing to segAfter's target, with segAfter's stops
      const newSeg = {
        id: newSegId,
        travelTime: Math.max(1, Math.floor(segAfter.travelTime / 2)),
        interval: segAfter.interval,
        intervalMax: segAfter.intervalMax,
        side: segAfter.side || side,
        nextNodeId: segAfter.nextNodeId,
        firstStopId: segAfter.firstStopId
      };
      graph.segments[newSegId] = newSeg;

      // segAfter becomes the NEW EMPTY segment from endNodeId to newNodeId
      segAfter.travelTime = Math.max(1, segAfter.travelTime - Math.floor(segAfter.travelTime / 2));
      segAfter.nextNodeId = newNodeId;
      segAfter.firstStopId = null; // EMPTY!
    } else {
      // Fallback if endNode has no nextSegId (e.g. at end of graph/rail)
      const newSeg = {
        id: newSegId,
        travelTime: half,
        interval: oldSeg.interval,
        intervalMax: oldSeg.intervalMax,
        side: oldSeg.side || side,
        nextNodeId: null,
        firstStopId: null
      };
      graph.segments[newSegId] = newSeg;
      if (endNode) {
        endNode.nextSegId = newSegId;
      }
    }
  }

  return newNodeId;
}

export function addStopGraph(graph, segId, side, insertIdx = -1) {
  const seg = graph.segments[segId];
  if (!seg) return;

  const newStop = { id: Date.now(), name: 'Нова зупинка', side, nextStopId: null };
  graph.stops[newStop.id] = newStop;

  if (insertIdx === 0 || !seg.firstStopId) {
    newStop.nextStopId = seg.firstStopId;
    seg.firstStopId = newStop.id;
  } else {
    let curr = seg.firstStopId;
    const visited = new Set();
    const segStops = [];

    while (curr && !visited.has(curr)) {
      visited.add(curr);
      segStops.push(curr);
      if (insertIdx !== -1 && segStops.length > insertIdx) break;
      curr = graph.stops[curr]?.nextStopId;
    }

    if (insertIdx === -1 || insertIdx >= segStops.length) {
      const lastStopId = segStops[segStops.length - 1];
      if (lastStopId && graph.stops[lastStopId]) {
        newStop.nextStopId = graph.stops[lastStopId].nextStopId;
        graph.stops[lastStopId].nextStopId = newStop.id;
      } else {
        seg.firstStopId = newStop.id;
      }
    } else {
      const targetStopId = segStops[insertIdx];
      const prevStopId = segStops[insertIdx - 1];
      if (prevStopId && graph.stops[prevStopId]) {
        newStop.nextStopId = targetStopId;
        graph.stops[prevStopId].nextStopId = newStop.id;
      } else {
        newStop.nextStopId = seg.firstStopId;
        seg.firstStopId = newStop.id;
      }
    }
  }


  return newStop.id;
}

export function removeStopGraph(graph, segId, stopId) {
  const seg = graph.segments[segId];
  if (!seg || !seg.firstStopId) return;

  const nextStopId = graph.stops[stopId]?.nextStopId || null;
  let prevStopId = null;

  if (seg.firstStopId === stopId) {
    seg.firstStopId = nextStopId;
  } else {
    let curr = seg.firstStopId;
    let prev = null;
    while (curr && curr !== stopId) {
      prev = curr;
      curr = graph.stops[curr]?.nextStopId;
    }
    if (curr === stopId && prev) {
      prevStopId = prev;
      graph.stops[prev].nextStopId = nextStopId;
    }
  }

  delete graph.stops[stopId];

  // Update any branch targets that were pointing to this deleted stop
  // Along movement direction: if nextStopId exists, merge into it; otherwise connect directly to next control node
  Object.values(graph.nodes).forEach(n => {
    if (n.branchConfig && String(n.branchConfig.targetStopId) === String(stopId)) {
      n.branchConfig.targetStopId = nextStopId || null;
      if (!nextStopId) {
        n.branchConfig.targetType = 'current';
        n.branchConfig.targetNodeId = seg.nextNodeId;
      }
    }
  });
}

export function removeNodeGraph(graph, nodeId) {
  const node = graph.nodes[nodeId];
  if (!node || node.type !== 'control') return;

  const prevSeg = Object.values(graph.segments).find(s => s.nextNodeId === nodeId);
  if (!prevSeg) return;

  const nextSegId = node.nextSegId;
  const nextSeg = graph.segments[nextSegId];
  if (!nextSeg) return;

  prevSeg.travelTime += nextSeg.travelTime;
  prevSeg.nextNodeId = nextSeg.nextNodeId;

  let lastPrevStopId = prevSeg.firstStopId;
  if (lastPrevStopId) {
    let curr = lastPrevStopId;
    while (graph.stops[curr].nextStopId) {
      curr = graph.stops[curr].nextStopId;
    }
    graph.stops[curr].nextStopId = nextSeg.firstStopId;
  } else {
    prevSeg.firstStopId = nextSeg.firstStopId;
  }

  delete graph.nodes[nodeId];
  delete graph.segments[nextSegId];
}

export function addBranchGraph(graph, parentSegId) {
  const parentSeg = graph.segments[parentSegId];
  if (!parentSeg) return;

  const startNode = Object.values(graph.nodes).find(n => n.nextSegId === parentSegId);
  if (!startNode) return;

  const brSegId = 'br_seg_' + Date.now();

  graph.segments[brSegId] = {
    id: brSegId,
    isBranch: true,
    travelTime: 5,
    interval: parentSeg.interval,
    side: parentSeg.side,
    nextNodeId: parentSeg.nextNodeId,
    firstStopId: null
  };

  startNode.branchConfig = {
    name: 'Альтернатива ' + (Object.values(graph.nodes).filter(n => n.branchConfig).length + 1),
    finished: false,
    targetType: 'current',
    targetNodeId: parentSeg.nextNodeId,
    targetStopId: parentSeg.firstStopId || null,
    bypassedMainState: 'add_pills'
  };
  startNode.altSegId = brSegId;
  return brSegId;
}

export function addBranchNodeGraph(graph, brStartNodeId, sectionIdx = 0, posMode = 'after') {
  const startNode = graph.nodes[brStartNodeId];
  if (!startNode || !startNode.altSegId) return null;

  // Collect all branch segments in order
  const branchSegs = [];
  let currAltSegId = startNode.altSegId;
  const visitedAlt = new Set();
  while (currAltSegId && !visitedAlt.has(currAltSegId)) {
    visitedAlt.add(currAltSegId);
    const altSeg = graph.segments[currAltSegId];
    if (!altSeg) break;
    branchSegs.push(altSeg);
    const nextN = graph.nodes[altSeg.nextNodeId];
    if (nextN && nextN.isBranchNode && nextN.nextSegId) {
      currAltSegId = nextN.nextSegId;
    } else break;
  }

  if (branchSegs.length === 0) return null;

  const targetIdx = Math.max(0, Math.min(sectionIdx, branchSegs.length - 1));
  const targetSeg = branchSegs[targetIdx];

  const brNodeId = 'br_node_' + Date.now();
  const brSegId = 'br_seg_' + Date.now();

  const allControls = Object.values(graph.nodes).filter(n => n.type === 'control');
  const maxNum = allControls.reduce((max, n) => {
    const match = n.name && n.name.match(/\d+/);
    return match ? Math.max(max, parseInt(match[0], 10)) : max;
  }, 0);
  const nextNum = maxNum + 1;

  graph.nodes[brNodeId] = {
    id: brNodeId,
    type: 'control',
    name: 'Контрольна ' + nextNum,
    nextSegId: null,
    altSegId: null,
    isBranchNode: true
  };

  const endNodeId = targetSeg.nextNodeId;
  const endNode = endNodeId ? graph.nodes[endNodeId] : null;

  if (posMode === 'after' && endNode && endNode.isBranchNode && endNode.nextSegId && graph.segments[endNode.nextSegId]) {
    // Add after endNode (intermediate branch node)
    const segAfter = graph.segments[endNode.nextSegId];
    const newSeg = {
      id: brSegId,
      isBranch: true,
      travelTime: Math.max(1, Math.floor(segAfter.travelTime / 2)),
      interval: segAfter.interval,
      intervalMax: segAfter.intervalMax,
      side: segAfter.side,
      nextNodeId: segAfter.nextNodeId,
      firstStopId: segAfter.firstStopId
    };
    graph.segments[brSegId] = newSeg;
    graph.nodes[brNodeId].nextSegId = brSegId;

    // segAfter becomes empty between endNode and brNodeId
    segAfter.travelTime = Math.max(1, segAfter.travelTime - Math.floor(segAfter.travelTime / 2));
    segAfter.nextNodeId = brNodeId;
    segAfter.firstStopId = null;
  } else {
    // posMode === 'before' OR endNode is not a branch node (e.g. at branch end)
    // Insert before endNode of targetSeg
    graph.segments[brSegId] = {
      id: brSegId,
      isBranch: true,
      travelTime: 5,
      interval: targetSeg.interval,
      intervalMax: targetSeg.intervalMax,
      side: targetSeg.side,
      nextNodeId: targetSeg.nextNodeId,
      firstStopId: null
    };

    graph.nodes[brNodeId].nextSegId = brSegId;
    targetSeg.nextNodeId = brNodeId;
  }

  return brNodeId;
}

export function removeBranchNodeGraph(graph, brStartNodeId, bNIdx) {
  const startNode = graph.nodes[brStartNodeId];
  if (!startNode || !startNode.altSegId) return;

  // Collect the branch path
  const branchNodes = [];
  const branchSegs = [];
  
  let currentSegId = startNode.altSegId;
  while (currentSegId) {
    const seg = graph.segments[currentSegId];
    if (!seg) break;
    branchSegs.push(seg);
    
    const nextNode = graph.nodes[seg.nextNodeId];
    if (nextNode && nextNode.isBranchNode) {
      branchNodes.push(nextNode);
      currentSegId = nextNode.nextSegId;
    } else {
      currentSegId = null;
    }
  }

  const nodeToRemove = branchNodes[bNIdx];
  if (!nodeToRemove) return;

  const prevSeg = branchSegs[bNIdx];
  const nextSeg = branchSegs[bNIdx + 1];

  if (!prevSeg || !nextSeg) return;

  prevSeg.travelTime += nextSeg.travelTime;
  prevSeg.nextNodeId = nextSeg.nextNodeId;

  let lastPrevStopId = prevSeg.firstStopId;
  if (lastPrevStopId) {
    let curr = lastPrevStopId;
    while (graph.stops[curr].nextStopId) {
      curr = graph.stops[curr].nextStopId;
    }
    graph.stops[curr].nextStopId = nextSeg.firstStopId;
  } else {
    prevSeg.firstStopId = nextSeg.firstStopId;
  }

  delete graph.nodes[nodeToRemove.id];
  delete graph.segments[nextSeg.id];
}

export function setBranchConfigGraph(graph, brStartNodeId, config) {
  const startNode = graph.nodes[brStartNodeId];
  if (startNode) {
    startNode.branchConfig = { ...startNode.branchConfig, ...config };
  }
}
