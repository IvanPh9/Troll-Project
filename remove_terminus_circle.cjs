const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

const rightSearch = `            <!-- Контрольна точка circle (Right) -->
            <g style="cursor:pointer">
              <circle :cx="layout.rightX + getBranchDx(br)"
                      :cy="br.finished ? getRightBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, true)"
                      r="9" fill="#ffffff" :stroke="color" stroke-width="3"/>
              <text :x="layout.rightX + getBranchDx(br) + 18"
                    :y="(br.finished ? getRightBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, true)) + 4"
                    font-size="13" font-weight="700" fill="#111827" text-anchor="start"
                    style="pointer-events:none;">Контрольна точка</text>
            </g>`;

const leftSearch = `            <!-- Контрольна точка circle (Left) -->
            <g style="cursor:pointer">
              <circle :cx="layout.leftX - getBranchDx(br)"
                      :cy="br.finished ? getLeftBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, false)"
                      r="9" fill="#f5f5f5" :stroke="color" stroke-width="3"/>
              <text :x="layout.leftX - getBranchDx(br) - 18"
                    :y="(br.finished ? getLeftBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, false)) + 4"
                    font-size="13" font-weight="700" fill="#111827" text-anchor="end"
                    style="pointer-events:none;">Контрольна точка</text>
            </g>`;

if (content.includes(rightSearch)) {
  content = content.replace(rightSearch, '');
  console.log("Removed Right Terminus Circle");
} else {
  console.log("Right Terminus Circle not found");
}

if (content.includes(leftSearch)) {
  content = content.replace(leftSearch, '');
  console.log("Removed Left Terminus Circle");
} else {
  console.log("Left Terminus Circle not found");
}

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', content);
