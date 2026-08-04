const fs = require('fs');

let fileContent = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

const svg1Path = "M0 6.82031C0 7.08398 0.114258 7.34766 0.316406 7.54102L6.11719 13.333C6.32812 13.5352 6.55664 13.6318 6.81152 13.6318C7.36523 13.6318 7.76953 13.2363 7.76953 12.7002C7.76953 12.4189 7.66406 12.1816 7.47949 12.0059L5.50195 10.002L2.95312 7.67285L5.00098 7.7959H15.6533C16.2334 7.7959 16.6377 7.3916 16.6377 6.82031C16.6377 6.24023 16.2334 5.83594 15.6533 5.83594H5.00098L2.96191 5.95898L5.50195 3.62988L7.47949 1.62598C7.66406 1.4502 7.76953 1.21289 7.76953 0.931641C7.76953 0.395508 7.36523 0 6.81152 0C6.55664 0 6.31934 0.0966797 6.09082 0.316406L0.316406 6.09082C0.114258 6.28418 0 6.54785 0 6.82031Z";
const svg2Path = "M6.04688 16.5059C6.61816 16.5059 6.99609 16.1191 6.99609 15.5742C6.99609 15.293 6.88184 15.082 6.71484 14.9062L4.44727 12.7002L2.90039 11.3994L4.93945 11.4873H15.917C18.1143 11.4873 19.0459 10.4941 19.0459 8.34082V3.12891C19.0459 0.931641 18.1143 0 15.917 0H11.0391C10.4678 0 10.0635 0.430664 10.0635 0.958008C10.0635 1.48535 10.459 1.91602 11.0391 1.91602H15.873C16.7695 1.91602 17.1475 2.29395 17.1475 3.18164V8.2793C17.1475 9.18457 16.7607 9.5625 15.873 9.5625H4.93945L2.90039 9.65918L4.44727 8.34961L6.71484 6.14355C6.88184 5.97656 6.99609 5.76562 6.99609 5.47559C6.99609 4.93066 6.61816 4.54395 6.04688 4.54395C5.80957 4.54395 5.5459 4.64941 5.35254 4.84277L0.307617 9.80859C0.105469 10.002 0 10.2656 0 10.5293C0 10.7842 0.105469 11.0479 0.307617 11.2412L5.35254 16.2158C5.5459 16.4004 5.80957 16.5059 6.04688 16.5059Z";

// Replace Right Rail Add Control Node Template
const rightPillRegex = /<!-- Apple-style Unified Add Pill \(Right Rail\) -->[\s\S]*?<!-- Right Branches for this Segment -->/;
const rightReplacement = `<!-- Apple-style Unified Add Pill (Right Rail) -->
          <g class="anim-row"
             :style="{ opacity: (editable && !localBranchMode) ? 1 : 0, pointerEvents: (editable && !localBranchMode) ? 'auto' : 'none', transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)', transform: 'translate(0px, ' + layout.getRightAddStopY(seg, layout.rightNodeY[i], layout.rightNodeY[i+1], i === layout.rightSegments.length - 1, segments.indexOf(seg)) + 'px)' }">
            <rect :x="layout.rightX + 18" y="-14" :width="activeExpandedPill === ('right-' + segments.indexOf(seg)) ? 78 : 64" height="28" rx="14"
                  fill="rgba(255,255,255,0.85)" stroke="#d1d5db" stroke-width="1"
                  style="backdrop-filter: blur(4px); transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);" />
            
            <!-- Left Sub-button: Add Stop -->
            <g style="cursor:pointer;" title="Додати зупинку" @click.stop="$emit('add-stop', segments.indexOf(seg), 'right')">
              <rect :x="layout.rightX + 18" y="-14" width="32" height="28" fill="transparent" rx="14"/>
              <g :transform="'translate(' + (layout.rightX + 30.5) + ', -7)'" fill="#4b5563">
                <path transform="scale(0.5)" d="M5.78869 27.4289C6.5345 27.4289 7.07691 26.9543 7.07691 26.0616V17.3943C7.07691 17.0101 7.25772 16.7841 7.56282 16.7841C7.86793 16.7841 8.06003 17.0101 8.06003 17.3943V26.0616C8.06003 26.9543 8.60244 27.4289 9.34826 27.4289ZM10.0828 27.4289 10.6252 26.9543 10.6252 26.0616V11.4165C10.6252 11.1114 10.7721 10.9306 11.0207 10.9306C11.258 10.9306 11.4162 11.1114 11.4162 11.4165V17.4282C11.4162 18.2305 11.8908 18.6825 12.5688 18.6825C13.2468 18.6825 13.7101 18.2305 13.7101 17.4282V11.5521C13.7101 7.9699 11.6874 7.04328 7.67583 7.04328H5.93559C5.15588 7.04328 4.76037 6.93027 4.13885 6.47827L2.64723 5.42735L2.37602 1.20106C2.31952 0.387446 1.79971 -0.0419624 1.1217 0.00323846C0.432382 0.0371391 -0.0422274 0.534349 0.00297345 1.33666L0.274179 5.52905C0.33068 6.44437 0.692287 6.97548 1.2573 7.39358L3.96935 9.37112C4.36486 9.65363 4.50046 10.0039 4.50046 10.4559V26.0616C4.50046 26.9543 5.05417 27.4289 5.78869 27.4289ZM7.67583 5.91325C9.17875 5.91325 10.3879 4.67023 10.3879 3.2125C10.3879 1.70957 9.17875 0.489148 7.67583 0.489148C6.16159 0.489148 4.97507 1.70957 4.97507 3.2125C4.97507 4.69283 6.16159 5.91325 7.67583 5.91325Z"/>
              </g>
            </g>

            <!-- Vertical Divider 1 -->
            <line :x1="layout.rightX + 50" y1="-10" :x2="layout.rightX + 50" y2="10" stroke="#9ca3af" stroke-width="1" />

            <!-- COLLAPSED: Plus Icon to Expand -->
            <g v-if="activeExpandedPill !== ('right-' + segments.indexOf(seg))" style="cursor:pointer;" title="Додати контрольну точку" @click.stop="togglePillExpand('right-' + segments.indexOf(seg))">
              <rect :x="layout.rightX + 50" y="-14" width="32" height="28" fill="transparent" rx="14"/>
              <g :transform="'translate(' + (layout.rightX + 60.7) + ', -5.3)'" fill="#4b5563">
                <path transform="scale(0.7)" d="M1.00195 8.36719H6.36328V13.7285C6.36328 14.2734 6.81152 14.7305 7.36523 14.7305C7.91895 14.7305 8.36719 14.2734 8.36719 13.7285V8.36719H13.7285C14.2734 8.36719 14.7305 7.91895 14.7305 7.36523C14.7305 6.81152 14.2734 6.36328 13.7285 6.36328H8.36719V1.00195C8.36719 0.457031 7.91895 0 7.36523 0C6.81152 0 6.36328 0.457031 6.36328 1.00195V6.36328H1.00195C0.457031 6.36328 0 6.81152 0 7.36523C0 7.91895 0.457031 8.36719 1.00195 8.36719Z" />
              </g>
            </g>

            <!-- EXPANDED: Two Arrow Options (Grid Aligned & Centered) -->
            <g v-else>
              <!-- Option 1: Insert Before End (Straight Arrow) -->
              <g style="cursor:pointer;" title="Вставити перед контрольною кінця ділянки" @click.stop="handleAddNode('right', segments.indexOf(seg), 'before')">
                <rect :x="layout.rightX + 50" y="-14" width="23" height="28" fill="transparent"/>
                <g :transform="'translate(' + (layout.rightX + 57.4) + ', -3.4)'" fill="#4b5563">
                  <path transform="scale(0.48)" d="${svg1Path}" />
                </g>
              </g>

              <!-- Option 2: Insert After End (Curved Arrow) -->
              <g style="cursor:pointer;" title="Додати після цієї контрольної точки на кінці" @click.stop="handleAddNode('right', segments.indexOf(seg), 'after')">
                <rect :x="layout.rightX + 73" y="-14" width="23" height="28" fill="transparent" rx="11.5"/>
                <g :transform="'translate(' + (layout.rightX + 80.0) + ', -3.8)'" fill="#4b5563">
                  <path transform="scale(0.45)" d="${svg2Path}" />
                </g>
              </g>
            </g>
          </g>

          <!-- Right Branches for this Segment -->`;

fileContent = fileContent.replace(rightPillRegex, rightReplacement);

// Replace Left Rail Add Control Node Template
const leftPillRegex = /<!-- Apple-style Unified Add Pill \(Left Rail\) -->[\s\S]*?<!-- Left Branches for this Segment -->/;
const leftReplacement = `<!-- Apple-style Unified Add Pill (Left Rail) -->
          <g class="anim-row"
             :style="{ opacity: (editable && !localBranchMode) ? 1 : 0, pointerEvents: (editable && !localBranchMode) ? 'auto' : 'none', transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)', transform: 'translate(0px, ' + layout.getLeftAddStopY(seg, layout.leftNodeY[i], layout.leftNodeY[i+1], i === layout.leftSegments.length - 1, segments.indexOf(seg)) + 'px)' }">
            <rect :x="activeExpandedPill === ('left-' + segments.indexOf(seg)) ? (layout.leftX - 96) : (layout.leftX - 82)" y="-14" :width="activeExpandedPill === ('left-' + segments.indexOf(seg)) ? 78 : 64" height="28" rx="14"
                  fill="rgba(255,255,255,0.85)" stroke="#d1d5db" stroke-width="1"
                  style="backdrop-filter: blur(4px); transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), x 0.3s cubic-bezier(0.4, 0, 0.2, 1);" />
            
            <!-- COLLAPSED: Plus Icon to Expand -->
            <g v-if="activeExpandedPill !== ('left-' + segments.indexOf(seg))" style="cursor:pointer;" title="Додати контрольну точку" @click.stop="togglePillExpand('left-' + segments.indexOf(seg))">
              <rect :x="layout.leftX - 82" y="-14" width="32" height="28" fill="transparent" rx="14"/>
              <g :transform="'translate(' + (layout.leftX - 71.3) + ', -5.3)'" fill="#4b5563">
                <path transform="scale(0.7)" d="M1.00195 8.36719H6.36328V13.7285C6.36328 14.2734 6.81152 14.7305 7.36523 14.7305C7.91895 14.7305 8.36719 14.2734 8.36719 13.7285V8.36719H13.7285C14.2734 8.36719 14.7305 7.91895 14.7305 7.36523C14.7305 6.81152 14.2734 6.36328 13.7285 6.36328H8.36719V1.00195C8.36719 0.457031 7.91895 0 7.36523 0C6.81152 0 6.36328 0.457031 6.36328 1.00195V6.36328H1.00195C0.457031 6.36328 0 6.81152 0 7.36523C0 7.91895 0.457031 8.36719 1.00195 8.36719Z" />
              </g>
            </g>

            <!-- EXPANDED: Two Arrow Options (Grid Aligned & Centered) -->
            <g v-else>
              <!-- Option 2: Add Control Node After End (Icon 2) -->
              <g style="cursor:pointer;" title="Додати після цієї контрольної точки на кінці" @click.stop="handleAddNode('left', segments.indexOf(seg), 'after')">
                <rect :x="layout.leftX - 96" y="-14" width="23" height="28" fill="transparent" rx="11.5"/>
                <g :transform="'translate(' + (layout.leftX - 89.0) + ', -3.8)'" fill="#4b5563">
                  <path transform="scale(0.45)" d="${svg2Path}" />
                </g>
              </g>

              <!-- Option 1: Add Control Node Before End (Icon 1) -->
              <g style="cursor:pointer;" title="Вставити перед контрольною кінця ділянки" @click.stop="handleAddNode('left', segments.indexOf(seg), 'before')">
                <rect :x="layout.leftX - 73" y="-14" width="23" height="28" fill="transparent"/>
                <g :transform="'translate(' + (layout.leftX - 66.4) + ', -3.4) scale(-1, 1)'" fill="#4b5563">
                  <path transform="scale(0.48)" d="${svg1Path}" />
                </g>
              </g>
            </g>

            <!-- Vertical Divider to Add Stop -->
            <line :x1="layout.leftX - 50" y1="-10" :x2="layout.leftX - 50" y2="10" stroke="#9ca3af" stroke-width="1" />

            <!-- Add Stop -->
            <g style="cursor:pointer;" title="Додати зупинку" @click.stop="$emit('add-stop', segments.indexOf(seg), 'left')">
              <rect :x="layout.leftX - 50" y="-14" width="32" height="28" fill="transparent" rx="14"/>
              <g :transform="'translate(' + (layout.leftX - 30.5) + ', -7) scale(-1, 1)'" fill="#4b5563">
                <path transform="scale(0.5)" d="M5.78869 27.4289C6.5345 27.4289 7.07691 26.9543 7.07691 26.0616V17.3943C7.07691 17.0101 7.25772 16.7841 7.56282 16.7841C7.86793 16.7841 8.06003 17.0101 8.06003 17.3943V26.0616C8.06003 26.9543 8.60244 27.4289 9.34826 27.4289ZM10.0828 27.4289 10.6252 26.9543 10.6252 26.0616V11.4165C10.6252 11.1114 10.7721 10.9306 11.0207 10.9306C11.258 10.9306 11.4162 11.1114 11.4162 11.4165V17.4282C11.4162 18.2305 11.8908 18.6825 12.5688 18.6825C13.2468 18.6825 13.7101 18.2305 13.7101 17.4282V11.5521C13.7101 7.9699 11.6874 7.04328 7.67583 7.04328H5.93559C5.15588 7.04328 4.76037 6.93027 4.13885 6.47827L2.64723 5.42735L2.37602 1.20106C2.31952 0.387446 1.79971 -0.0419624 1.1217 0.00323846C0.432382 0.0371391 -0.0422274 0.534349 0.00297345 1.33666L0.274179 5.52905C0.33068 6.44437 0.692287 6.97548 1.2573 7.39358L3.96935 9.37112C4.36486 9.65363 4.50046 10.0039 4.50046 10.4559V26.0616C4.50046 26.9543 5.05417 27.4289 5.78869 27.4289ZM7.67583 5.91325C9.17875 5.91325 10.3879 4.67023 10.3879 3.2125C10.3879 1.70957 9.17875 0.489148 7.67583 0.489148C6.16159 0.489148 4.97507 1.70957 4.97507 3.2125C4.97507 4.69283 6.16159 5.91325 7.67583 5.91325Z"/>
              </g>
            </g>
          </g>

          <!-- Left Branches for this Segment -->`;

fileContent = fileContent.replace(leftPillRegex, leftReplacement);

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', fileContent);
console.log('Successfully aligned expanded pill to grid line!');
