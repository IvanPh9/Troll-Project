const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

const rightPillSearch = `            <!-- New Pill AFTER Branch Terminus (Stops Only) -->
            <g v-if="!br.finished" class="anim-row"
               :style="{ opacity: (editable && !localBranchMode) ? 1 : 0, pointerEvents: (editable && !localBranchMode) ? 'auto' : 'none', transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)', transform: 'translate(' + (layout.rightX + getBranchDx(br) + 16) + 'px, ' + (getBranchEndpointY(br, i, true) + 40) + 'px)' }">`;

const rightPillReplace = `            <!-- New Pill AFTER Branch Terminus (Stops Only) -->
            <g class="anim-row"
               :style="{ opacity: (editable && !localBranchMode) ? 1 : 0, pointerEvents: (editable && !localBranchMode) ? 'auto' : 'none', transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)', transform: 'translate(' + (layout.rightX + getBranchDx(br) + 16) + 'px, ' + ((br.finished ? getRightBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, true)) + 40) + 'px)' }">`;

const leftPillSearch = `            <!-- New Pill AFTER Branch Terminus (Stops Only) -->
            <g v-if="!br.finished" class="anim-row"
               :style="{ opacity: (editable && !localBranchMode) ? 1 : 0, pointerEvents: (editable && !localBranchMode) ? 'auto' : 'none', transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)', transform: 'translate(' + (layout.leftX - getBranchDx(br) - 48) + 'px, ' + (getBranchEndpointY(br, i, false) + 40) + 'px)' }">`;

const leftPillReplace = `            <!-- New Pill AFTER Branch Terminus (Stops Only) -->
            <g class="anim-row"
               :style="{ opacity: (editable && !localBranchMode) ? 1 : 0, pointerEvents: (editable && !localBranchMode) ? 'auto' : 'none', transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)', transform: 'translate(' + (layout.leftX - getBranchDx(br) - 48) + 'px, ' + ((br.finished ? getLeftBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, false)) + 40) + 'px)' }">`;

let replaced = false;
if (content.includes(rightPillSearch)) {
  content = content.replace(rightPillSearch, rightPillReplace);
  console.log("Replaced Right Pill visibility!");
  replaced = true;
} else {
  console.log("Could not find Right Pill search string.");
}

if (content.includes(leftPillSearch)) {
  content = content.replace(leftPillSearch, leftPillReplace);
  console.log("Replaced Left Pill visibility!");
  replaced = true;
} else {
  console.log("Could not find Left Pill search string.");
}

if (replaced) {
  fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', content);
  console.log("File saved.");
}
