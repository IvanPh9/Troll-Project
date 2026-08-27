const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

const rightTerminusSearch = `            <!-- Контрольна точка circle (Right) -->
            <g style="cursor:pointer">
              <circle :cx="layout.rightX + getBranchDx(br)"
                      :cy="br.finished ? getRightBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, true)"
                      r="9" fill="#ffffff" :stroke="color" stroke-width="3"/>
              <text :x="layout.rightX + getBranchDx(br) + 18"
                    :y="(br.finished ? getRightBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, true)) + 4"
                    font-size="13" font-weight="700" fill="#111827" text-anchor="start"
                    style="pointer-events:none;">Контрольна точка</text>
            </g>`;

const rightTerminusReplace = rightTerminusSearch + `

            <!-- New Pill AFTER Branch Terminus (Stops Only) -->
            <g v-if="!br.finished" class="anim-row"
               :style="{ opacity: (editable && !localBranchMode) ? 1 : 0, pointerEvents: (editable && !localBranchMode) ? 'auto' : 'none', transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)', transform: 'translate(' + (layout.rightX + getBranchDx(br) + 16) + 'px, ' + (getBranchEndpointY(br, i, true) + 40) + 'px)' }">
              <rect x="0" y="-14" width="32" height="28" rx="14" fill="rgba(255,255,255,0.8)" stroke="#d1d5db" stroke-width="1" style="backdrop-filter: blur(4px);" />
              <g style="cursor:pointer;" title="Додати зупинку" @click.stop="$emit('add-branch-stop', br.id, getBranchNodesLength(br))">
                <rect x="0" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                <g transform="translate(11, -7)" fill="#4b5563">
                  <path transform="scale(0.5)" d="M5.78869 27.4289C6.5345 27.4289 7.07691 26.9543 7.07691 26.0616V17.3943C7.07691 17.0101 7.25772 16.7841 7.56282 16.7841C7.86793 16.7841 8.06003 17.0101 8.06003 17.3943V26.0616C8.06003 26.9543 8.60244 27.4289 9.34826 27.4289C10.0828 27.4289 10.6252 26.9543 10.6252 26.0616V11.4165C10.6252 11.1114 10.7721 10.9306 11.0207 10.9306C11.258 10.9306 11.4162 11.1114 11.4162 11.4165V17.4282C11.4162 18.2305 11.8908 18.6825 12.5688 18.6825C13.2468 18.6825 13.7101 18.2305 13.7101 17.4282V11.5521C13.7101 7.9699 11.6874 7.04328 7.67583 7.04328H5.93559C5.15588 7.04328 4.76037 6.93027 4.13885 6.47827L2.64723 5.42735L2.37602 1.20106C2.31952 0.387446 1.79971 -0.0419624 1.1217 0.00323846C0.432382 0.0371391 -0.0422274 0.534349 0.00297345 1.33666L0.274179 5.52905C0.33068 6.44437 0.692287 6.97548 1.2573 7.39358L3.96935 9.37112C4.36486 9.65363 4.50046 10.0039 4.50046 10.4559V26.0616C4.50046 26.9543 5.05417 27.4289 5.78869 27.4289ZM7.67583 5.91325C9.17875 5.91325 10.3879 4.67023 10.3879 3.2125C10.3879 1.70957 9.17875 0.489148 7.67583 0.489148C6.16159 0.489148 4.97507 1.70957 4.97507 3.2125C4.97507 4.69283 6.16159 5.91325 7.67583 5.91325Z"/>
                </g>
              </g>
            </g>`;

const leftTerminusSearch = `            <!-- Контрольна точка circle (Left) -->
            <g style="cursor:pointer">
              <circle :cx="layout.leftX - getBranchDx(br)"
                      :cy="br.finished ? getLeftBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, false)"
                      r="9" fill="#f5f5f5" :stroke="color" stroke-width="3"/>
              <text :x="layout.leftX - getBranchDx(br) - 18"
                    :y="(br.finished ? getLeftBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, false)) + 4"
                    font-size="13" font-weight="700" fill="#111827" text-anchor="end"
                    style="pointer-events:none;">Контрольна точка</text>
            </g>`;

const leftTerminusReplace = leftTerminusSearch + `

            <!-- New Pill AFTER Branch Terminus (Stops Only) -->
            <g v-if="!br.finished" class="anim-row"
               :style="{ opacity: (editable && !localBranchMode) ? 1 : 0, pointerEvents: (editable && !localBranchMode) ? 'auto' : 'none', transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)', transform: 'translate(' + (layout.leftX - getBranchDx(br) - 48) + 'px, ' + (getBranchEndpointY(br, i, false) + 40) + 'px)' }">
              <rect x="-32" y="-14" width="32" height="28" rx="14" fill="rgba(255,255,255,0.8)" stroke="#d1d5db" stroke-width="1" style="backdrop-filter: blur(4px);" />
              <g style="cursor:pointer;" title="Додати зупинку" @click.stop="$emit('add-branch-stop', br.id, getBranchNodesLength(br))">
                <rect x="-32" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                <g transform="translate(-12.5, -7) scale(-1, 1)" fill="#4b5563">
                  <path transform="scale(0.5)" d="M5.78869 27.4289C6.5345 27.4289 7.07691 26.9543 7.07691 26.0616V17.3943C7.07691 17.0101 7.25772 16.7841 7.56282 16.7841C7.86793 16.7841 8.06003 17.0101 8.06003 17.3943V26.0616C8.06003 26.9543 8.60244 27.4289 9.34826 27.4289C10.0828 27.4289 10.6252 26.9543 10.6252 26.0616V11.4165C10.6252 11.1114 10.7721 10.9306 11.0207 10.9306C11.258 10.9306 11.4162 11.1114 11.4162 11.4165V17.4282C11.4162 18.2305 11.8908 18.6825 12.5688 18.6825C13.2468 18.6825 13.7101 18.2305 13.7101 17.4282V11.5521C13.7101 7.9699 11.6874 7.04328 7.67583 7.04328H5.93559C5.15588 7.04328 4.76037 6.93027 4.13885 6.47827L2.64723 5.42735L2.37602 1.20106C2.31952 0.387446 1.79971 -0.0419624 1.1217 0.00323846C0.432382 0.0371391 -0.0422274 0.534349 0.00297345 1.33666L0.274179 5.52905C0.33068 6.44437 0.692287 6.97548 1.2573 7.39358L3.96935 9.37112C4.36486 9.65363 4.50046 10.0039 4.50046 10.4559V26.0616C4.50046 26.9543 5.05417 27.4289 5.78869 27.4289ZM7.67583 5.91325C9.17875 5.91325 10.3879 4.67023 10.3879 3.2125C10.3879 1.70957 9.17875 0.489148 7.67583 0.489148C6.16159 0.489148 4.97507 1.70957 4.97507 3.2125C4.97507 4.69283 6.16159 5.91325 7.67583 5.91325Z"/>
                </g>
              </g>
            </g>`;

if (content.includes(rightTerminusSearch)) {
  content = content.replace(rightTerminusSearch, rightTerminusReplace);
  console.log("Replaced Right Terminus!");
} else {
  console.log("ERROR: Could not find Right Terminus!");
}

if (content.includes(leftTerminusSearch)) {
  content = content.replace(leftTerminusSearch, leftTerminusReplace);
  console.log("Replaced Left Terminus!");
} else {
  console.log("ERROR: Could not find Left Terminus!");
}

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', content);
console.log("Updated RouteCanvas.vue successfully with new terminus pill!");
