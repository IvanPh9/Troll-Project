/**
 * routeChains.js
 *
 * Models the route graph as elementary directed sub-segments between vertices
 * (main control nodes, branch control nodes, and internal mid-segment merge junctions),
 * groups them into Junction-to-Junction chains ("від з'єднання до з'єднання"),
 * evaluates active turnaround loops per time period, and synthesizes the
 * single-oval preview ("ПЕРЕДПЕРЕГЛЯД БЕЗ АЛЬТЕРНАТИВ").
 */

import { getBranchTargetSegIdx } from './branchLevelModel.js';

export function analyzeRouteChains(nodes = [], segments = [], branches = [], disabledIds = [], originNodeId = null) {
  const disabledSet = new Set((disabledIds || []).map(String));

  const firstNode = nodes.find(n => !n.side || n.side === 'top') || nodes[0] || null;
  const lastNode = nodes.find(n => n.side === 'bottom') || nodes.filter(n => !n.side)[1] || null;

  const rightSegments = segments.filter(
    s => s.side === 'right' || (!s.side && segments.indexOf(s) < Math.ceil(segments.length / 2))
  );
  const leftSegments = segments.filter(
    s => s.side === 'left' || (!s.side && segments.indexOf(s) >= Math.ceil(segments.length / 2))
  );
  // In traverseGraph, leftSegments[0] is near topNode and leftSegments[last] is near bottomNode.
  // Travel order on the left rail is bottom -> top (lastNode -> firstNode).
  const leftSegmentsTravel = [...leftSegments].reverse();

  const nodeMap = new Map();
  nodes.forEach(n => {
    if (n) nodeMap.set(String(n.id), n);
  });

  const finishedBranches = (branches || []).filter(b => b && b.finished);
  finishedBranches.forEach(br => {
    (br.nodes || []).forEach(bn => {
      if (bn && bn.name !== 'Контрольна (альтернатива)') {
        nodeMap.set(String(bn.id), { ...bn, isBranchNode: true, side: br.side || 'right' });
      }
    });
  });

  // 1. Resolve start and merge vertices for each finished branch
  // midMergesBySegId: segId -> Map(stopIdx -> [brId, ...])
  const midMergesBySegId = new Map();
  // endMergesBySegId: segId -> [brId, ...]
  const endMergesBySegId = new Map();
  const branchEndpoints = new Map();

  finishedBranches.forEach(br => {
    const parentSeg = br.segIdx !== undefined ? segments[br.segIdx] : null;
    const startVertex = br.parentBranchId
      ? String(br.parentNodeId || br.startNodeId || String(br.id).replace('br_', ''))
      : String(br.startNodeId || parentSeg?.fromNodeId || String(br.id).replace('br_', ''));

    let endVertex = null;
    let targetSegId = null;
    let mergeSlot = null;

    if (br.targetType === 'bottom_arc') {
      if (br.side === 'left') {
        endVertex = String(firstNode?.id || leftSegments[0]?.nextNodeId || '');
        targetSegId = leftSegments[0]?.id;
      } else {
        endVertex = String(lastNode?.id || rightSegments[rightSegments.length - 1]?.nextNodeId || '');
        targetSegId = rightSegments[rightSegments.length - 1]?.id;
      }
      if (targetSegId !== undefined && targetSegId !== null) {
        const key = String(targetSegId);
        if (!endMergesBySegId.has(key)) endMergesBySegId.set(key, []);
        endMergesBySegId.get(key).push(br.id);
      }
    } else {
      const targetSegIdx = getBranchTargetSegIdx(br, segments);
      const targetSeg = segments[targetSegIdx];
      if (targetSeg) {
        targetSegId = targetSeg.id;
        const stops = targetSeg.stops || [];
        const stopIdx = br.targetStopId
          ? stops.findIndex(st => String(st.id) === String(br.targetStopId))
          : -1;

        if (stopIdx !== -1 && stopIdx < stops.length) {
          mergeSlot = stopIdx;
          endVertex = `J_seg_${targetSeg.id}_slot_${stopIdx}`;
          const key = String(targetSeg.id);
          if (!midMergesBySegId.has(key)) midMergesBySegId.set(key, new Map());
          const slotMap = midMergesBySegId.get(key);
          if (!slotMap.has(stopIdx)) slotMap.set(stopIdx, []);
          slotMap.get(stopIdx).push(br.id);
        } else {
          endVertex = String(br.targetNodeId || targetSeg.nextNodeId || '');
          const key = String(targetSeg.id);
          if (!endMergesBySegId.has(key)) endMergesBySegId.set(key, []);
          endMergesBySegId.get(key).push(br.id);
        }
      }
    }

    if (startVertex && endVertex) {
      branchEndpoints.set(br.id, {
        startVertex,
        endVertex,
        targetSegId,
        mergeSlot
      });
    }
  });

  // 2. Build elementary sub-segments for main rail
  function buildMainSideSubSegments(sideSegsInTravelOrder, sideName) {
    const subSegs = [];

    sideSegsInTravelOrder.forEach(seg => {
      const segKey = String(seg.id);
      const stops = seg.stops || [];
      const slotMap = midMergesBySegId.get(segKey);
      const midSlots = slotMap ? [...slotMap.keys()].sort((a, b) => a - b) : [];

      if (midSlots.length === 0) {
        subSegs.push({
          id: segKey,
          parentSegId: seg.id,
          partIndex: 0,
          totalParts: 1,
          startSlot: 0,
          endSlot: stops.length,
          fromVertex: String(seg.fromNodeId),
          toVertex: String(seg.nextNodeId),
          stops: stops,
          travelTime: Number(seg.travelTime || 0),
          interval: seg.interval || '20',
          intervalMax: seg.intervalMax || '25',
          side: sideName,
          isBranch: false,
          isBypassedMain: false,
          isPreMergePart: false,
          isPostMergePart: false,
          bypassedByBranchIds: [],
          startMergeBranchIds: [],
          endMergeBranchIds: endMergesBySegId.get(segKey) || []
        });
      } else {
        const partCount = midSlots.length + 1;
        const totalSegTime = Number(seg.travelTime || 0);
        const weights = [];
        for (let r = 0; r < partCount; r++) {
          const sSlot = r === 0 ? 0 : midSlots[r - 1];
          const eSlot = r === partCount - 1 ? stops.length : midSlots[r];
          weights.push((eSlot - sSlot) + 1);
        }
        const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
        let allocatedTime = 0;

        for (let r = 0; r < partCount; r++) {
          const sSlot = r === 0 ? 0 : midSlots[r - 1];
          const eSlot = r === partCount - 1 ? stops.length : midSlots[r];
          const fromV = r === 0 ? String(seg.fromNodeId) : `J_seg_${seg.id}_slot_${sSlot}`;
          const toV = r === partCount - 1 ? String(seg.nextNodeId) : `J_seg_${seg.id}_slot_${eSlot}`;
          const subId = r === 0 ? segKey : `${segKey}_post_${sSlot}`;
          const subStops = stops.slice(sSlot, eSlot);

          let partTime = 0;
          if (r < partCount - 1) {
            partTime = Math.min(
              Math.max(1, Math.round((totalSegTime * weights[r]) / totalWeight)),
              Math.max(0, totalSegTime - allocatedTime)
            );
            allocatedTime += partTime;
          } else {
            partTime = Math.max(0, totalSegTime - allocatedTime);
          }

          subSegs.push({
            id: subId,
            parentSegId: seg.id,
            partIndex: r,
            totalParts: partCount,
            startSlot: sSlot,
            endSlot: eSlot,
            fromVertex: fromV,
            toVertex: toV,
            stops: subStops,
            travelTime: partTime,
            interval: seg.interval || '20',
            intervalMax: seg.intervalMax || '25',
            side: sideName,
            isBranch: false,
            isBypassedMain: false,
            isPreMergePart: r < partCount - 1,
            isPostMergePart: r > 0,
            bypassedByBranchIds: [],
            startMergeBranchIds: r === 0 ? [] : (slotMap.get(sSlot) || []),
            endMergeBranchIds: r === partCount - 1 ? (endMergesBySegId.get(segKey) || []) : (slotMap.get(eSlot) || [])
          });
        }
      }
    });

    // Mark which main sub-segments are bypassed by at least one finished branch on this side
    const vertexPos = new Map();
    subSegs.forEach((ss, idx) => {
      if (!vertexPos.has(ss.fromVertex)) vertexPos.set(ss.fromVertex, idx);
    });
    if (subSegs.length > 0) {
      vertexPos.set(subSegs[subSegs.length - 1].toVertex, subSegs.length);
    }

    finishedBranches.forEach(br => {
      const brSide = br.side === 'left' ? 'left' : 'right';
      if (brSide !== sideName) return;
      const ep = branchEndpoints.get(br.id);
      if (!ep) return;
      const sPos = vertexPos.get(ep.startVertex);
      const ePos = vertexPos.get(ep.endVertex);
      if (sPos !== undefined && ePos !== undefined && sPos < ePos) {
        for (let q = sPos; q < ePos; q++) {
          subSegs[q].isBypassedMain = true;
          if (!subSegs[q].bypassedByBranchIds.includes(br.id)) {
            subSegs[q].bypassedByBranchIds.push(br.id);
          }
        }
      }
    });

    return subSegs;
  }

  const rightMainSubSegs = buildMainSideSubSegments(rightSegments, 'right');
  const leftMainSubSegs = buildMainSideSubSegments(leftSegmentsTravel, 'left');
  const allMainSubSegs = [...rightMainSubSegs, ...leftMainSubSegs];

  // 3. Build elementary branch sub-segments
  const branchSubSegsByBranchId = new Map();
  const allBranchSubSegs = [];

  finishedBranches.forEach(br => {
    const ep = branchEndpoints.get(br.id);
    if (!ep) return;
    const validBrNodes = (br.nodes || []).filter(n => n && n.name !== 'Контрольна (альтернатива)');
    const sections = br.sections || [];
    const secCount = Math.max(validBrNodes.length + 1, 1);
    const brEdges = [];

    for (let s = 0; s < secCount; s++) {
      const sec = sections[s] || {
        id: `br_sec_${br.id}_${s}`,
        stops: [],
        travelTime: 5,
        interval: '20',
        intervalMax: '25'
      };
      const fromV = s === 0 ? ep.startVertex : String(validBrNodes[s - 1].id);
      const toV = s < validBrNodes.length ? String(validBrNodes[s].id) : ep.endVertex;

      const edge = {
        id: String(sec.id),
        branchId: br.id,
        branchName: br.name || 'Альтернатива',
        sectionIdx: s,
        totalSections: secCount,
        fromVertex: fromV,
        toVertex: toV,
        stops: sec.stops || [],
        travelTime: Number(sec.travelTime || 5),
        interval: sec.interval || '20',
        intervalMax: sec.intervalMax || '25',
        side: br.side === 'left' ? 'left' : 'right',
        isBranch: true,
        isBypassedMain: false,
        isPreMergePart: false,
        isPostMergePart: false
      };
      brEdges.push(edge);
      allBranchSubSegs.push(edge);
    }

    branchSubSegsByBranchId.set(br.id, brEdges);
  });

  // 4. Compute vertex degrees to identify Junctions ("з'єднання")
  const inDegree = new Map();
  const outDegree = new Map();
  const allEdges = [...allMainSubSegs, ...allBranchSubSegs];

  allEdges.forEach(e => {
    outDegree.set(e.fromVertex, (outDegree.get(e.fromVertex) || 0) + 1);
    inDegree.set(e.toVertex, (inDegree.get(e.toVertex) || 0) + 1);
  });

  function isJunctionVertex(v) {
    if (!v) return false;
    if (firstNode && String(v) === String(firstNode.id)) return true;
    if (lastNode && String(v) === String(lastNode.id)) return true;
    if (String(v).startsWith('J_seg_')) return true;
    return (inDegree.get(v) || 0) > 1 || (outDegree.get(v) || 0) > 1;
  }

  // 5. Group elementary edges into Junction-to-Junction Chains ("від з'єднання до з'єднання")
  const chains = [];
  const chainById = new Map();
  const chainByLookupId = new Map();

  function registerChain(edgesList, opts = {}) {
    if (!edgesList || edgesList.length === 0) return null;
    const firstE = edgesList[0];
    const lastE = edgesList[edgesList.length - 1];
    const chainId = opts.id || (edgesList.length === 1 ? String(firstE.id) : `chain_${edgesList.map(e => e.id).join('__')}`);
    const edgeIds = edgesList.map(e => String(e.id));
    const lookupIds = new Set([chainId, ...edgeIds, ...(opts.extraLookupIds || [])]);

    const intermediateNodeIds = [];
    for (let i = 0; i < edgesList.length - 1; i++) {
      intermediateNodeIds.push(edgesList[i].toVertex);
    }

    const isDisabled = [...lookupIds].some(id => disabledSet.has(String(id)));

    const chainObj = {
      id: chainId,
      fromVertex: firstE.fromVertex,
      toVertex: lastE.toVertex,
      side: firstE.side,
      isBranch: !!firstE.isBranch,
      branchId: firstE.branchId || null,
      isBypassedMain: !!firstE.isBypassedMain,
      isPreMergePart: !!firstE.isPreMergePart,
      isPostMergePart: !!firstE.isPostMergePart,
      edges: edgesList,
      edgeIds,
      lookupIds: [...lookupIds],
      intermediateNodeIds,
      disabled: isDisabled
    };

    edgesList.forEach(e => {
      e.chainId = chainId;
      e.disabled = isDisabled;
    });

    chains.push(chainObj);
    chainById.set(chainId, chainObj);
    lookupIds.forEach(lid => {
      chainByLookupId.set(String(lid), chainObj);
    });

    return chainObj;
  }

  function buildMainChainsForSide(sideSubSegs) {
    let i = 0;
    while (i < sideSubSegs.length) {
      const curr = sideSubSegs[i];
      if (curr.isBypassedMain) {
        const group = [curr];
        while (
          i + 1 < sideSubSegs.length &&
          sideSubSegs[i + 1].isBypassedMain &&
          !isJunctionVertex(sideSubSegs[i].toVertex)
        ) {
          i++;
          group.push(sideSubSegs[i]);
        }
        registerChain(group);
        i++;
      } else {
        registerChain([curr]);
        i++;
      }
    }
  }

  buildMainChainsForSide(rightMainSubSegs);
  buildMainChainsForSide(leftMainSubSegs);

  finishedBranches.forEach(br => {
    const brEdges = branchSubSegsByBranchId.get(br.id) || [];
    let i = 0;
    while (i < brEdges.length) {
      const group = [brEdges[i]];
      while (i + 1 < brEdges.length && !isJunctionVertex(brEdges[i].toVertex)) {
        i++;
        group.push(brEdges[i]);
      }
      const extraIds = group.length === brEdges.length ? [String(br.id)] : [];
      registerChain(group, { extraLookupIds: extraIds });
      i++;
    }
  });

  // Also map unfinished branches if any
  (branches || []).filter(b => b && !b.finished).forEach(br => {
    const sections = br.sections || [];
    sections.forEach(sec => {
      const isDis = disabledSet.has(String(sec.id)) || disabledSet.has(String(br.id));
      sec.disabled = isDis;
    });
  });

  // 6. Find active paths on Right side (firstNode -> lastNode) and Left side (lastNode -> firstNode)
  function findActivePaths(sideName, startV, targetV) {
    if (!startV || !targetV) return [];
    const sideChains = chains.filter(c => c.side === sideName && !c.disabled);
    const outMap = new Map();
    sideChains.forEach(c => {
      if (!outMap.has(c.fromVertex)) outMap.set(c.fromVertex, []);
      outMap.get(c.fromVertex).push(c);
    });

    // Sort outgoing chains at each junction: main rail first, then branches
    outMap.forEach(list => {
      list.sort((a, b) => (a.isBranch === b.isBranch ? 0 : a.isBranch ? 1 : -1));
    });

    const results = [];
    const visited = new Set();

    function dfs(currV, pathChains) {
      if (String(currV) === String(targetV)) {
        results.push([...pathChains]);
        return;
      }
      if (visited.has(currV)) return;
      visited.add(currV);

      const outs = outMap.get(String(currV)) || [];
      for (const ch of outs) {
        pathChains.push(ch);
        dfs(ch.toVertex, pathChains);
        pathChains.pop();
      }

      visited.delete(currV);
    }

    dfs(String(startV), []);
    return results;
  }

  const firstId = firstNode ? String(firstNode.id) : null;
  const lastId = lastNode ? String(lastNode.id) : null;

  const rightPaths = findActivePaths('right', firstId, lastId);
  const leftPaths = findActivePaths('left', lastId, firstId);

  const chainsOnValidPaths = new Set();
  rightPaths.forEach(p => p.forEach(ch => chainsOnValidPaths.add(ch.id)));
  leftPaths.forEach(p => p.forEach(ch => chainsOnValidPaths.add(ch.id)));

  const danglingEnabledChains = chains.filter(c => !c.disabled && !chainsOnValidPaths.has(c.id));

  const rightPathCount = rightPaths.length;
  const leftPathCount = leftPaths.length;
  const totalLoops = rightPathCount * leftPathCount;
  const hasSingleLoop = rightPathCount === 1 && leftPathCount === 1 && danglingEnabledChains.length === 0;
  const isBrokenLoop = rightPathCount === 0 || leftPathCount === 0;
  const isMultipleLoops = totalLoops > 1 || (!isBrokenLoop && danglingEnabledChains.length > 0);

  // Build a contiguous walk of edges from startV to targetV when a side has 0 complete paths
  // (e.g., user disabled a non-bypassed segment): uses enabled chains where available,
  // and skips disabled stops/nodes so preview & partial time still work cleanly.
  function buildBestEffortSideEdges(sideName, startV, targetV) {
    const sideChains = chains.filter(c => c.side === sideName);
    const outMap = new Map();
    sideChains.forEach(c => {
      if (!outMap.has(c.fromVertex)) outMap.set(c.fromVertex, []);
      outMap.get(c.fromVertex).push(c);
    });

    const chosenEdges = [];
    let currV = String(startV || '');
    const visited = new Set();

    while (currV && currV !== String(targetV) && !visited.has(currV)) {
      visited.add(currV);
      const outs = outMap.get(currV) || [];
      if (outs.length === 0) break;

      // Prefer enabled chain; if none enabled, advance along main chain with empty stops/0 time
      const enabledOut = outs.find(c => !c.disabled);
      if (enabledOut) {
        chosenEdges.push(...enabledOut.edges);
        currV = enabledOut.toVertex;
      } else {
        const fallbackChain = outs.find(c => !c.isBranch) || outs[0];
        const firstE = fallbackChain.edges[0];
        chosenEdges.push({
          ...firstE,
          id: `collapsed_${fallbackChain.id}`,
          fromVertex: fallbackChain.fromVertex,
          toVertex: fallbackChain.toVertex,
          stops: [],
          travelTime: 0,
          disabled: true
        });
        currV = fallbackChain.toVertex;
      }
    }

    return chosenEdges;
  }

  const activeRightEdges = rightPaths.length > 0
    ? rightPaths[0].flatMap(c => c.edges)
    : buildBestEffortSideEdges('right', firstId, lastId);

  const activeLeftEdges = leftPaths.length > 0
    ? leftPaths[0].flatMap(c => c.edges)
    : buildBestEffortSideEdges('left', lastId, firstId);

  const activeLoopEdges = [
    ...activeRightEdges.filter(e => !e.disabled),
    ...activeLeftEdges.filter(e => !e.disabled)
  ];

  // 7. Determine active vs disabled status for all nodes and stops
  const activeVertexSet = new Set();
  const enabledEdges = allEdges.filter(e => !e.disabled);
  const enabledInCount = new Map();
  const enabledOutCount = new Map();

  enabledEdges.forEach(e => {
    enabledOutCount.set(e.fromVertex, (enabledOutCount.get(e.fromVertex) || 0) + 1);
    enabledInCount.set(e.toVertex, (enabledInCount.get(e.toVertex) || 0) + 1);
  });

  const disabledNodeIds = new Set();
  nodeMap.forEach((nodeObj, nId) => {
    const hasIn = (enabledInCount.get(nId) || 0) > 0;
    const hasOut = (enabledOutCount.get(nId) || 0) > 0;
    if (!hasIn || !hasOut) {
      disabledNodeIds.add(nId);
    } else {
      activeVertexSet.add(nId);
    }
  });

  const disabledStopIds = new Set();
  allEdges.forEach(e => {
    if (e.disabled) {
      (e.stops || []).forEach(st => {
        if (st && st.id !== undefined) disabledStopIds.add(String(st.id));
      });
    }
  });

  const disabledSubSegIds = new Set(allEdges.filter(e => e.disabled).map(e => String(e.id)));

  const subSegsByParentSegId = new Map();
  allMainSubSegs.forEach(ss => {
    const k = String(ss.parentSegId);
    if (!subSegsByParentSegId.has(k)) subSegsByParentSegId.set(k, []);
    subSegsByParentSegId.get(k).push(ss);
  });

  const fullyDisabledMainSegIds = new Set();
  subSegsByParentSegId.forEach((parts, segIdKey) => {
    if (parts.length > 0 && parts.every(p => p.disabled)) {
      fullyDisabledMainSegIds.add(segIdKey);
    }
  });

  // 8. Calculate dynamic turnaround time ("Коло оберту динамічно рахувати") & cumulative nodeTravelTimes
  const activeLoopNodeIds = new Set();
  activeLoopEdges.forEach(e => {
    if (!String(e.fromVertex).startsWith('J_seg_')) activeLoopNodeIds.add(String(e.fromVertex));
    if (!String(e.toVertex).startsWith('J_seg_')) activeLoopNodeIds.add(String(e.toVertex));
  });

  const activeTerminusNodes = nodes.filter(n => n.isTerminus && activeLoopNodeIds.has(String(n.id)));
  const startTerminus = (originNodeId && activeTerminusNodes.find(n => String(n.id) === String(originNodeId)))
    || activeTerminusNodes[0]
    || firstNode;

  const travelTimeSum = activeLoopEdges.reduce((acc, e) => acc + Number(e.travelTime || 0), 0);
  let waitTimeSum = activeTerminusNodes.reduce((acc, n) => acc + Number(n.waitMin || 0), 0);
  if (startTerminus && activeTerminusNodes.length > 1) {
    waitTimeSum -= Number(startTerminus.waitMin || 0);
  }
  const dynamicTotalTime = travelTimeSum + waitTimeSum;
  const dynamicTotalStops = activeLoopEdges.reduce((acc, e) => acc + (e.stops ? e.stops.length : 0), 0);

  // Compute cumulative travel times along activeLoopEdges starting from startTerminus
  const nodeTravelTimes = {};
  const rawTimes = {};
  if (startTerminus && activeLoopEdges.length > 0) {
    const startId = String(startTerminus.id);
    const startEdgeIdx = activeLoopEdges.findIndex(e => String(e.fromVertex) === startId);
    const orderedEdges = startEdgeIdx !== -1
      ? [...activeLoopEdges.slice(startEdgeIdx), ...activeLoopEdges.slice(0, startEdgeIdx)]
      : activeLoopEdges;

    let cumTime = 0;
    rawTimes[startId] = 0;

    orderedEdges.forEach((edge, idx) => {
      const fromId = String(edge.fromVertex);
      const fromNodeObj = nodeMap.get(fromId);
      if (idx > 0 && fromNodeObj && fromNodeObj.isTerminus && fromId !== startId) {
        cumTime += Number(fromNodeObj.waitMin || 0);
      }
      cumTime += Number(edge.travelTime || 0);
      const toId = String(edge.toVertex);
      if (!toId.startsWith('J_seg_') && toId !== startId) {
        rawTimes[toId] = cumTime;
      }
    });

    Object.keys(rawTimes).forEach(k => {
      if (k === startId) {
        nodeTravelTimes[k] = `${cumTime} / 0`;
      } else {
        nodeTravelTimes[k] = String(rawTimes[k]);
      }
    });
  }

  // Also compute cumulative travel times for branch control nodes from their branch startNode
  (branches || []).forEach(br => {
    if (!br) return;
    const validBrNodes = (br.nodes || []).filter(n => n && n.name !== 'Контрольна (альтернатива)');
    if (validBrNodes.length === 0) return;
    const parentSeg = br.segIdx !== undefined ? segments[br.segIdx] : null;
    const startNodeId = String(
      br.parentBranchId
        ? (br.parentNodeId || br.startNodeId || String(br.id).replace('br_', ''))
        : (br.startNodeId || parentSeg?.fromNodeId || String(br.id).replace('br_', ''))
    );
    let brTime = rawTimes[startNodeId] !== undefined ? Number(rawTimes[startNodeId]) : 0;
    const sections = br.sections || [];
    validBrNodes.forEach((bn, bIdx) => {
      const secTime = Number(sections[bIdx]?.travelTime ?? 5);
      brTime += secTime;
      const bnId = String(bn.id);
      if (rawTimes[bnId] === undefined) {
        rawTimes[bnId] = brTime;
        nodeTravelTimes[bnId] = String(brTime);
      }
    });
  });

  nodeMap.forEach((_, nId) => {
    if (nodeTravelTimes[nId] === undefined) {
      nodeTravelTimes[nId] = '0';
    }
  });

  // 9. Build Single-Oval Preview Data ("ПЕРЕДПЕРЕГЛЯД БЕЗ АЛЬТЕРНАТИВ")
  // Coalesces consecutive active edges across internal merge junctions J_seg_...
  // and places active branch sections & branch control nodes directly onto the main oval!
  function coalesceSideEdgesForPreview(sideEdges, sideName, sideStartNode, sideEndNode) {
    // Filter out disabled edges unless all edges on the side are disabled
    const enabledSideEdges = (sideEdges || []).filter(e => !e.disabled);
    const effectiveEdges = enabledSideEdges.length > 0 ? enabledSideEdges : (sideEdges || []);

    if (effectiveEdges.length === 0) {
      return {
        previewSegments: [{
          id: `preview_empty_${sideName}`,
          fromNodeId: sideStartNode?.id,
          nextNodeId: sideEndNode?.id,
          side: sideName,
          travelTime: 0,
          interval: '20',
          intervalMax: '25',
          stops: []
        }],
        intermediateNodes: []
      };
    }

    // Coalesce across internal junctions J_seg_... and across any disabled nodes
    const coalescedSegments = [];
    let currentGroup = null;

    effectiveEdges.forEach(edge => {
      if (!currentGroup) {
        currentGroup = {
          id: edge.isBranch ? edge.id : (edge.parentSegId ?? edge.id),
          fromNodeId: edge.fromVertex,
          nextNodeId: edge.toVertex,
          side: sideName,
          travelTime: Number(edge.travelTime || 0),
          interval: edge.interval || '20',
          intervalMax: edge.intervalMax || '25',
          stops: (edge.stops || []).map(st => ({ ...st, side: sideName }))
        };
      } else {
        currentGroup.nextNodeId = edge.toVertex;
        currentGroup.travelTime += Number(edge.travelTime || 0);
        currentGroup.stops.push(...(edge.stops || []).map(st => ({ ...st, side: sideName })));
      }

      const toV = String(edge.toVertex);
      const isInternalEnd = toV.startsWith('J_seg_');
      const isTerminalEnd = (sideStartNode && toV === String(sideStartNode.id)) || (sideEndNode && toV === String(sideEndNode.id));
      const isRealActiveControlNode = !isInternalEnd && !isTerminalEnd && nodeMap.has(toV) && !disabledNodeIds.has(toV);

      if (isTerminalEnd || isRealActiveControlNode) {
        coalescedSegments.push(currentGroup);
        currentGroup = null;
      }
    });

    if (currentGroup) {
      if (sideEndNode) {
        currentGroup.nextNodeId = sideEndNode.id;
      }
      coalescedSegments.push(currentGroup);
    }

    // Build exact intermediateNodes matching coalescedSegments[0 .. length - 2].nextNodeId
    const intermediateNodes = [];
    for (let i = 0; i < coalescedSegments.length - 1; i++) {
      const endId = String(coalescedSegments[i].nextNodeId);
      const nObj = nodeMap.get(endId) || { id: endId, name: `Контрольна ${i + 1}`, type: 'control' };
      intermediateNodes.push({
        ...nObj,
        type: nObj.type || 'control',
        side: sideName
      });
    }

    return { previewSegments: coalescedSegments, intermediateNodes };
  }

  const rightPreview = coalesceSideEdgesForPreview(activeRightEdges, 'right', firstNode, lastNode);
  const leftPreview = coalesceSideEdgesForPreview(activeLeftEdges, 'left', lastNode, firstNode);

  const previewNodes = [
    ...(firstNode ? [{ ...firstNode, side: undefined }] : []),
    ...rightPreview.intermediateNodes,
    ...(lastNode ? [{ ...lastNode, side: undefined }] : []),
    ...[...leftPreview.intermediateNodes].reverse()
  ];

  const previewSegments = [
    ...rightPreview.previewSegments,
    ...[...leftPreview.previewSegments].reverse()
  ];

  return {
    chains,
    chainById,
    chainByLookupId,
    allMainSubSegs,
    allBranchSubSegs,
    subSegsByParentSegId,
    disabledSet,
    disabledSubSegIds,
    fullyDisabledMainSegIds,
    disabledNodeIds,
    disabledStopIds,
    rightPaths,
    leftPaths,
    danglingEnabledChains,
    totalLoops,
    hasSingleLoop,
    isBrokenLoop,
    isMultipleLoops,
    activeLoopEdges,
    activeLoopNodeIds,
    dynamicTotalTime,
    dynamicTotalStops,
    nodeTravelTimes,
    previewNodes,
    previewSegments
  };
}

/**
 * Toggles a chain (from junction to junction) for a given disabledIds array
 * and returns a new array of disabled IDs.
 */
export function toggleChainInList(chainAnalysis, targetId, currentDisabledIds = []) {
  if (!chainAnalysis || !targetId) return [...currentDisabledIds];
  const chain = chainAnalysis.chainByLookupId.get(String(targetId)) || chainAnalysis.chainById.get(String(targetId));
  const set = new Set((currentDisabledIds || []).map(String));

  if (!chain) {
    const key = String(targetId);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    return [...set];
  }

  if (chain.disabled) {
    // Enable the entire junction-to-junction chain
    chain.lookupIds.forEach(id => set.delete(String(id)));
  } else {
    // Disable the entire junction-to-junction chain
    chain.lookupIds.forEach(id => set.add(String(id)));
  }

  return [...set];
}
