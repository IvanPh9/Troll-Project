const fs = require('fs');

let canvasContent = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

const leftSecLoopStr = `<template v-for="(si, secIdx) in (getBranchNodesLength(br) + 1)" :key="'lbrsec-' + secIdx">`;
const leftSecOverlay = `<template v-for="(si, secIdx) in (getBranchNodesLength(br) + 1)" :key="'lbrsec-' + secIdx">
              <!-- Clickable Branch Section Overlay (Left) -->
              <rect :x="layout.leftX - getBranchDx(br) - 12"
                    :y="Math.min(getBranchSectionStartY(br, secIdx, i, false), getBranchSectionEndY(br, secIdx, i, false))"
                    width="24"
                    :height="Math.max(24, Math.abs(getBranchSectionEndY(br, secIdx, i, false) - getBranchSectionStartY(br, secIdx, i, false)))"
                    fill="transparent"
                    style="cursor: pointer;"
                    title="Налаштувати ділянку розгалудження"
                    @click.stop="selectBranchSection(br, secIdx - 1)" />`;

canvasContent = canvasContent.replace(leftSecLoopStr, leftSecOverlay);

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', canvasContent);
console.log('Successfully added left branch section click overlay!');
