<template>
  <div class="canvas-container relative w-full h-full min-h-[650px] overflow-hidden bg-white select-none">
    <!-- SVG Canvas -->
    <svg ref="svgRef" class="w-full h-full cursor-grab active:cursor-grabbing"
         :viewBox="currentViewBox"
         preserveAspectRatio="xMidYMid meet"
         @mousedown="onMouseDown"
         @mousemove="onMouseMove"
         @mouseup="onMouseUp"
         @wheel.prevent="onWheel">

      <defs>
        <!-- Glow Filter for route lines -->
        <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <!-- Grid pattern (Strict 32px Grid for perfect layout alignment) -->
        <pattern id="canvas-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="1"/>
        </pattern>
        <!-- Curved Arrow Marker -->
        <marker id="curved-arrow-grey" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#9ca3af" />
        </marker>
        <!-- Transparent white gradient for projected segment extensions towards add button -->
        <linearGradient v-if="layout" id="rail-grey-down" gradientUnits="userSpaceOnUse"
                        :x1="layout.rightX" :y1="(layout.rightNodeY[layout.rightNodeY.length - 1] || 0)"
                        :x2="layout.rightX" :y2="rightAddNodeY">
          <stop offset="0%" :stop-color="color" stop-opacity="1.0" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <linearGradient v-if="layout" id="rail-grey-up" gradientUnits="userSpaceOnUse"
                        :x1="layout.leftX" :y1="(layout.leftNodeY[0] || 0)"
                        :x2="layout.leftX" :y2="leftAddNodeY">
          <stop offset="0%" :stop-color="color" stop-opacity="1.0" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>

        <linearGradient id="arrow-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.5" />
        </linearGradient>

        <linearGradient id="interval-fade-right" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" :stop-color="color" stop-opacity="0" />
          <stop offset="100%" :stop-color="color" stop-opacity="0.06" />
        </linearGradient>
        <linearGradient id="interval-fade-left" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" :stop-color="color" stop-opacity="0.06" />
          <stop offset="100%" :stop-color="color" stop-opacity="0" />
        </linearGradient>

        <radialGradient id="cap-glow-top" gradientUnits="userSpaceOnUse" cx="0" :cy="layout ? layout.topY : 0" :r="layout ? layout.CAP_R : 96">
          <stop offset="47.9%" :stop-color="color" stop-opacity="0" />
          <stop offset="100%" :stop-color="color" stop-opacity="0.06" />
        </radialGradient>
        <radialGradient id="cap-glow-bot" gradientUnits="userSpaceOnUse" cx="0" cy="0" :r="layout ? layout.CAP_R : 96">
          <stop offset="47.9%" :stop-color="color" stop-opacity="0" />
          <stop offset="100%" :stop-color="color" stop-opacity="0.06" />
        </radialGradient>

        <linearGradient v-if="arcArrows" id="arc-fade-topRight" gradientUnits="userSpaceOnUse" :x1="arcArrows.topRight.startX" :y1="arcArrows.topRight.startY" :x2="arcArrows.topRight.endX" :y2="arcArrows.topRight.endY">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.4" />
        </linearGradient>
        <linearGradient v-if="arcArrows" id="arc-fade-topLeft" gradientUnits="userSpaceOnUse" :x1="arcArrows.topLeft.startX" :y1="arcArrows.topLeft.startY" :x2="arcArrows.topLeft.endX" :y2="arcArrows.topLeft.endY">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.4" />
        </linearGradient>
        <linearGradient v-if="arcArrows" id="arc-fade-botRight" gradientUnits="userSpaceOnUse" :x1="arcArrows.botRight.startX" :y1="arcArrows.botRight.startY - (layout ? layout.botY : 0)" :x2="arcArrows.botRight.endX" :y2="arcArrows.botRight.endY - (layout ? layout.botY : 0)">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.4" />
        </linearGradient>
        <linearGradient v-if="arcArrows" id="arc-fade-botLeft" gradientUnits="userSpaceOnUse" :x1="arcArrows.botLeft.startX" :y1="arcArrows.botLeft.startY - (layout ? layout.botY : 0)" :x2="arcArrows.botLeft.endX" :y2="arcArrows.botLeft.endY - (layout ? layout.botY : 0)">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.4" />
        </linearGradient>
      </defs>

      <!-- Background Grid -->
      <rect x="-2000" y="-2000" width="4000" height="4000" fill="url(#canvas-grid)" />

      <!-- Render Oval Route Layout -->
      <g v-if="layout">
        <!-- ── CONTINUOUS MAIN STADIUM OVAL LOOP ── -->
        <!-- Continuous Right & Left Rail Lines (Native strokeDashoffset CSS Animation) -->
        <!-- Right Rail Line -->
        <line :x1="layout.rightX" y1="0"
              :x2="layout.rightX" y2="5000"
              :stroke="color" :stroke-width="layout.RAIL_W" stroke-linecap="square"
              class="anim-line"
              :style="{ strokeDasharray: '5000', strokeDashoffset: (5000 - layout.botY) }" />

        <!-- Left Rail Line -->
        <line :x1="layout.leftX" y1="0"
              :x2="layout.leftX" y2="5000"
              :stroke="color" :stroke-width="layout.RAIL_W" stroke-linecap="square"
              class="anim-line"
              :style="{ strokeDasharray: '5000', strokeDashoffset: (5000 - layout.botY) }" />

        <!-- Removed inline SVG defs -->



        <!-- Top Semicircular Cap (Right to Left arc bowing UP) -->
        <path :d="'M ' + layout.rightX + ' ' + layout.topY + ' A ' + layout.CAP_R + ' ' + layout.CAP_R + ' 0 0 0 ' + layout.leftX + ' ' + layout.topY"
              fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>

        <!-- Animated Triangle Direction Arrows -->


        <!-- Top Semicircular Cap (Left to Right arc bowing UP) -->
        <path :d="'M ' + layout.leftX + ' ' + layout.topY + ' A ' + layout.CAP_R + ' ' + layout.CAP_R + ' 0 0 1 ' + layout.rightX + ' ' + layout.topY"
              fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>

        <!-- Top Cap Background Gradient (Right quadrant only) -->
        <path :d="'M ' + layout.rightX + ' ' + layout.topY + ' A ' + layout.CAP_R + ' ' + layout.CAP_R + ' 0 0 0 0 ' + (layout.topY - layout.CAP_R) + ' L 0 ' + (layout.topY - (layout.CAP_R - 50)) + ' A ' + (layout.CAP_R - 50) + ' ' + (layout.CAP_R - 50) + ' 0 0 1 ' + (layout.rightX - 50) + ' ' + layout.topY + ' Z'"
              fill="url(#cap-glow-top)" />

        <!-- Top Arc Arrows -->
        <g v-if="arcArrows">
          <g v-for="arrow in topArcArrows" :key="arrow.key">
            <path :d="'M ' + arrow.startX + ' ' + arrow.startY + ' A ' + layout.CAP_R + ' ' + layout.CAP_R + ' 0 0 ' + arrow.sweep + ' ' + arrow.endX + ' ' + arrow.endY"
                  :stroke="'url(#arc-fade-' + arrow.key + ')'" :stroke-width="layout.RAIL_W" fill="none" />
            <polygon points="0,-4.5 8,0 0,4.5" fill="#ffffff" opacity="0.4" :transform="'translate(' + arrow.endX + ', ' + arrow.endY + ') rotate(' + arrow.tipRot + ')'" />
            <polygon points="0,-4.5 8,0 0,4.5" :fill="color" :transform="'translate(' + arrow.startX + ', ' + arrow.startY + ') rotate(' + arrow.cutoutRot + ')'" />
          </g>
        </g>

        <!-- ── TOP TERMINUS (Кінцева 1, Top Center of Cap) ── -->
        <g v-if="firstNode">
          <circle :cx="0" :cy="layout.topY - layout.CAP_R" r="9"
                  fill="#f5f5f5" :stroke="firstNode.isTerminus ? '#111827' : color" :stroke-width="firstNode.isTerminus ? 4 : 3.5"
                  :class="{ 'terminus-added': firstNode.isTerminus }" />
          <text :x="0" :y="layout.topY - layout.CAP_R - 16"
                font-size="13" font-weight="800" fill="#111827" text-anchor="middle"
                style="pointer-events:none;">
            <tspan>{{ firstNode.isTerminus ? (firstNode.terminusStop || firstNode.name) : firstNode.name }} </tspan><tspan font-size="13" font-weight="800" font-style="italic" :fill="color">{{ nodeTravelTimes[firstNode.id] || 0 }} хв</tspan>
          </text>
          <!-- Icons below top terminus circle -->
          <g v-if="firstNode.isTerminus" :transform="'translate(0, ' + (layout.topY - layout.CAP_R + 15) + ')'">
            <g v-for="(icon, i) in getTerminusIcons(firstNode)" :key="icon.id" :transform="'translate(' + (i * 24 - (getTerminusIcons(firstNode).length - 1) * 12) + ', 0)'">
              <SvgIcon :name="icon.id" :x="icon.x" :y="icon.y" :width="icon.w" :height="icon.h" class="text-gray-800" />
            </g>
          </g>
        </g>

        <!-- ── BOTTOM CAP & TERMINUS GROUP ── -->
        <g :transform="'translate(0, ' + layout.botY + ')'" class="bottom-cap-group">
          <!-- Bottom Semicircular Cap (Left to Right arc bowing DOWN) -->
          <path :d="'M ' + layout.leftX + ' 0 A ' + layout.CAP_R + ' ' + layout.CAP_R + ' 0 0 0 ' + layout.rightX + ' 0'"
                fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>

          <!-- Bottom Cap Background Gradient (Left quadrant only) -->
          <path :d="'M ' + layout.leftX + ' 0 A ' + layout.CAP_R + ' ' + layout.CAP_R + ' 0 0 0 0 ' + layout.CAP_R + ' L 0 ' + (layout.CAP_R - 50) + ' A ' + (layout.CAP_R - 50) + ' ' + (layout.CAP_R - 50) + ' 0 0 1 ' + (layout.leftX + 50) + ' 0 Z'"
                fill="url(#cap-glow-bot)" />

          <!-- Bottom Arc Arrows -->
          <g v-if="arcArrows">
            <g v-for="arrow in botArcArrows" :key="arrow.key">
              <path :d="'M ' + arrow.startX + ' ' + (arrow.startY - layout.botY) + ' A ' + layout.CAP_R + ' ' + layout.CAP_R + ' 0 0 ' + arrow.sweep + ' ' + arrow.endX + ' ' + (arrow.endY - layout.botY)"
                    :stroke="'url(#arc-fade-' + arrow.key + ')'" :stroke-width="layout.RAIL_W" fill="none" />
              <polygon points="0,-4.5 8,0 0,4.5" fill="#ffffff" opacity="0.4" :transform="'translate(' + arrow.endX + ', ' + (arrow.endY - layout.botY) + ') rotate(' + arrow.tipRot + ')'" />
              <polygon points="0,-4.5 8,0 0,4.5" :fill="color" :transform="'translate(' + arrow.startX + ', ' + (arrow.startY - layout.botY) + ') rotate(' + arrow.cutoutRot + ')'" />
            </g>
          </g>

          <!-- Bottom Terminus (Кінцева 2, Bottom Center of Cap) -->
          <g v-if="lastNode">
            <circle :cx="0" :cy="layout.CAP_R" r="9"
                    fill="#f5f5f5" :stroke="lastNode.isTerminus ? '#111827' : color" :stroke-width="lastNode.isTerminus ? 4 : 3.5"
                    :class="{ 'terminus-added': lastNode.isTerminus }" />
            <text :x="0" :y="layout.CAP_R + 24"
                  font-size="13" font-weight="800" fill="#111827" text-anchor="middle"
                  style="pointer-events:none;">
              <tspan>{{ lastNode.isTerminus ? (lastNode.terminusStop || lastNode.name) : lastNode.name }} </tspan><tspan font-size="13" font-weight="800" font-style="italic" :fill="color">{{ nodeTravelTimes[lastNode.id] || 0 }} хв</tspan>
            </text>
            <!-- Icons above bottom terminus circle -->
            <g v-if="lastNode.isTerminus" :transform="'translate(0, ' + (layout.CAP_R - 26) + ')'">
              <g v-for="(icon, i) in getTerminusIcons(lastNode)" :key="icon.id" :transform="'translate(' + (i * 24 - (getTerminusIcons(lastNode).length - 1) * 12) + ', 0)'">
                <SvgIcon :name="icon.id" :x="icon.x" :y="icon.y" :width="icon.w" :height="icon.h" class="text-gray-800" />
              </g>
            </g>
          </g>
        </g>

        <!-- ── RIGHT RAIL & SEGMENTS ── -->
        <template v-for="(seg, i) in layout.rightSegments" :key="'rseg-' + seg.id">
          <!-- Segment Background Gradient -->
          <rect :x="layout.rightX - 50"
                :y="layout.rightNodeY[i]"
                width="50"
                :height="layout.rightNodeY[i+1] - layout.rightNodeY[i]"
                fill="url(#interval-fade-right)" />

          <!-- Interval Badge (Inside Oval, e.g. 20-25хв) -->
          <g class="anim-row" :style="{ transform: 'translate(0px, ' + layout.getRightIntervalY(seg, layout.rightNodeY[i], layout.rightNodeY[i+1], i === layout.rightSegments.length - 1, segments.indexOf(seg)) + 'px)' }" style="pointer-events:none;">
            <text :x="layout.rightX - 25" y="4"
                  font-size="13" font-weight="800" :fill="color" font-style="italic" text-anchor="end">
              {{ (seg.interval || '20') + '-' + (seg.intervalMax || '25') + 'хв' }}
            </text>
          </g>

          <!-- Clickable Overlay for Zooming -->
          <rect :x="layout.rightX - 8"
                :y="layout.rightNodeY[i]"
                width="16"
                :height="layout.rightNodeY[i+1] - layout.rightNodeY[i]"
                fill="transparent"
                style="cursor: pointer;"
                @click="zoomToSegment('right', i)" />

          <!-- Segment Stops -->
          <g class="anim-row stop-item" v-for="(stop, stIdx) in seg.stops" :key="'rstop-' + stop.id"
             :style="{ transform: 'translate(0px, ' + layout.stopY(seg, layout.rightNodeY[i], layout.rightNodeY[i+1], stIdx, i === layout.rightSegments.length - 1, segments.indexOf(seg)) + 'px)' }">
            <line :x1="layout.rightX" y1="0"
                  :x2="layout.rightX + 12" y2="0"
                  :stroke="color" stroke-width="4.5" stroke-linecap="square"/>
            <text :x="layout.rightX + 18" y="4"
                  font-size="12" font-weight="700" fill="#111827"
                  style="pointer-events:none;">
              {{ stop.name }}
            </text>
          </g>

          <!-- Apple-style Unified Add Pill (Right Rail) -->
          <g v-if="editable" class="anim-row"
             :style="{ transform: 'translate(0px, ' + layout.getRightAddStopY(seg, layout.rightNodeY[i], layout.rightNodeY[i+1], i === layout.rightSegments.length - 1, segments.indexOf(seg)) + 'px)' }">
            <rect :x="layout.rightX + 18" y="-14" width="64" height="28" rx="14"
                  fill="rgba(255,255,255,0.8)" stroke="#d1d5db" stroke-width="1"
                  style="backdrop-filter: blur(4px);" />
            
            <!-- Left Half: Add Stop -->
            <g style="cursor:pointer;" @click.stop="$emit('add-stop', segments.indexOf(seg), 'right')">
              <rect :x="layout.rightX + 18" y="-14" width="32" height="28" fill="transparent" rx="14"/>
              <g :transform="'translate(' + (layout.rightX + 28) + ', -7)'" fill="#4b5563">
                <path transform="scale(0.5)" d="M5.78869 27.4289C6.5345 27.4289 7.07691 26.9543 7.07691 26.0616V17.3943C7.07691 17.0101 7.25772 16.7841 7.56282 16.7841C7.86793 16.7841 8.06003 17.0101 8.06003 17.3943V26.0616C8.06003 26.9543 8.60244 27.4289 9.34826 27.4289C10.0828 27.4289 10.6252 26.9543 10.6252 26.0616V11.4165C10.6252 11.1114 10.7721 10.9306 11.0207 10.9306C11.258 10.9306 11.4162 11.1114 11.4162 11.4165V17.4282C11.4162 18.2305 11.8908 18.6825 12.5688 18.6825C13.2468 18.6825 13.7101 18.2305 13.7101 17.4282V11.5521C13.7101 7.9699 11.6874 7.04328 7.67583 7.04328H5.93559C5.15588 7.04328 4.76037 6.93027 4.13885 6.47827L2.64723 5.42735L2.37602 1.20106C2.31952 0.387446 1.79971 -0.0419624 1.1217 0.00323846C0.432382 0.0371391 -0.0422274 0.534349 0.00297345 1.33666L0.274179 5.52905C0.33068 6.44437 0.692287 6.97548 1.2573 7.39358L3.96935 9.37112C4.36486 9.65363 4.50046 10.0039 4.50046 10.4559V26.0616C4.50046 26.9543 5.05417 27.4289 5.78869 27.4289ZM7.67583 5.91325C9.17875 5.91325 10.3879 4.67023 10.3879 3.2125C10.3879 1.70957 9.17875 0.489148 7.67583 0.489148C6.16159 0.489148 4.97507 1.70957 4.97507 3.2125C4.97507 4.69283 6.16159 5.91325 7.67583 5.91325Z"/>
              </g>
            </g>

            <!-- Vertical Divider -->
            <line v-if="!hasBranchForSeg(segments.indexOf(seg))" :x1="layout.rightX + 50" y1="-10" :x2="layout.rightX + 50" y2="10" stroke="#9ca3af" stroke-width="1" />

            <!-- Right Half: Add Control Node -->
            <g v-if="!hasBranchForSeg(segments.indexOf(seg))" style="cursor:pointer;" @click.stop="$emit('add-node', 'right', segments.indexOf(seg))">
              <rect :x="layout.rightX + 50" y="-14" width="32" height="28" fill="transparent" rx="14"/>
              <g :transform="'translate(' + (layout.rightX + 56.5) + ', -9.5)'" fill="#4b5563">
                <path d="M9.08789 18.1758C14.0713 18.1758 18.1846 14.0625 18.1846 9.08789C18.1846 4.11328 14.0625 0 9.0791 0C4.10449 0 0 4.11328 0 9.08789C0 14.0625 4.11328 18.1758 9.08789 18.1758ZM9.08789 16.3652C5.05371 16.3652 1.82812 13.1221 1.82812 9.08789C1.82812 5.05371 5.05371 1.81934 9.0791 1.81934C13.1133 1.81934 16.3564 5.05371 16.3652 9.08789C16.374 13.1221 13.1221 16.3652 9.08789 16.3652ZM5.84473 9.92285H8.25293V12.3398C8.25293 12.8232 8.5957 13.166 9.07031 13.166C9.5625 13.166 9.91406 12.8232 9.91406 12.3398V9.92285H12.3311C12.8145 9.92285 13.166 9.58008 13.166 9.09668C13.166 8.61328 12.8232 8.26172 12.3311 8.26172H9.91406V5.84473C9.91406 5.35254 9.5625 5.00977 9.07031 5.00977C8.5957 5.00977 8.25293 5.35254 8.25293 5.84473V8.26172H5.84473C5.34375 8.26172 5.00098 8.61328 5.00098 9.09668C5.00098 9.58008 5.35254 9.92285 5.84473 9.92285Z" />
              </g>
            </g>
          </g>

          <!-- Right Branches for this Segment -->
          <template v-for="(br, brIdx) in branchesForSeg(segments.indexOf(seg))" :key="'rbr-' + br.id">
            <path v-if="br.finished"
                  :d="getRightBranchFinishedPath(br, i).d"
                  fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>
            <path v-else
                  :d="getBranchOutPath(layout.rightX, layout.rightNodeY[i] + 40, getBranchDx(br), 1, 1) + ' L ' + (layout.rightX + getBranchDx(br)) + ' ' + getBranchEndpointY(br, i, true)"
                  fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>

            <!-- Branch Direction Arrow (Right) -->
            <g :transform="'translate(' + (layout.rightX + getBranchDx(br)) + ', ' + (layout.rightNodeY[i] + 40 + 48) + ') rotate(90)'">
              <polygon points="0,-4.5 42,-4.5 50,0 42,4.5 0,4.5" fill="url(#arrow-fade)" />
              <polygon points="0,-4.5 8,0 0,4.5" :fill="color" />
            </g>

            <!-- Config Circle Badge (Right) -->
            <g style="cursor:pointer" @click.stop="!br.finished && $emit('finish-branch', br.id)">
              <circle :cx="layout.rightX + getBranchDx(br)"
                      :cy="br.finished ? getRightBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, true)"
                      r="9" fill="#ffffff" :stroke="color" stroke-width="3"/>
              <text :x="layout.rightX + getBranchDx(br) + 18"
                    :y="(br.finished ? getRightBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, true)) + 4"
                    font-size="13" font-weight="800" fill="#111827" text-anchor="start"
                    style="pointer-events:none;">Контрольна точка</text>
            </g>

            <!-- Type 1 Merge Node on Main Line -->
            <g v-if="br.finished && br.mergeConfigured === 'add_inside'">
              <circle :cx="layout.rightX"
                      :cy="getRightBranchFinishedPath(br, i).mergeY"
                      r="9" fill="#ffffff" :stroke="color" stroke-width="3"/>
              <text :x="layout.rightX - 18"
                    :y="getRightBranchFinishedPath(br, i).mergeY + 4"
                    font-size="13" font-weight="800" fill="#111827" text-anchor="end"
                    style="pointer-events:none;">З'єднання</text>
            </g>

            <!-- Branch Control Nodes -->
            <g v-for="(bNode, bNIdx) in br.nodes || []" :key="'rbrn-' + bNode.id" style="cursor:pointer;"
               @click.stop="$emit('edit-branch-node', br.id, bNIdx)">
              <circle :cx="layout.rightX + getBranchDx(br)"
                      :cy="getBranchNodeY(br, bNIdx, i, true)"
                      r="9" fill="#ffffff" :stroke="color" stroke-width="3"/>
              <text :x="layout.rightX + getBranchDx(br) + 18"
                    :y="getBranchNodeY(br, bNIdx, i, true) + 4"
                    font-size="13" font-weight="800" fill="#111827">{{ bNode.name }}</text>
            </g>

            <!-- Branch Stops (Per Section) -->
            <template v-for="secIdx in (getBranchNodesLength(br) + 1)" :key="'rbrsec-' + secIdx">
              <g v-for="(bStop, bStIdx) in getBranchSectionStops(br, secIdx)" :key="'rbrst-' + bStop.id" style="cursor:pointer;"
                 @click.stop="$emit('edit-branch-stop', br.id, secIdx - 1, bStIdx)">
                <line :x1="layout.rightX + getBranchDx(br)"
                      :y1="getBranchStopY(br, secIdx, bStIdx, i, true)"
                      :x2="layout.rightX + getBranchDx(br) + 12"
                      :y2="getBranchStopY(br, secIdx, bStIdx, i, true)"
                      :stroke="color" stroke-width="4.5" stroke-linecap="square"/>
                <text :x="layout.rightX + getBranchDx(br) + 18"
                      :y="getBranchStopY(br, secIdx, bStIdx, i, true) + 4"
                      font-size="12" font-weight="700" fill="#111827">{{ bStop.name }}</text>
              </g>

              <!-- Apple-style Unified Add Pill (Right Branch) -->
              <g v-if="!br.finished && editable"
                 :transform="'translate(' + (layout.rightX + getBranchDx(br) - 24) + ', ' + getBranchNodeY(br, secIdx - 1, i, true) + ')'">
                <rect x="0" y="-14" width="64" height="28" rx="14"
                      fill="rgba(255,255,255,0.8)" stroke="#d1d5db" stroke-width="1"
                      style="backdrop-filter: blur(4px);" />
                
                <!-- Left Half: Add Stop -->
                <g style="cursor:pointer;" @click.stop="$emit('add-branch-stop', br.id, secIdx - 1)">
                  <rect x="0" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                  <g transform="translate(10, -7)" fill="#4b5563">
                    <path transform="scale(0.5)" d="M5.78869 27.4289C6.5345 27.4289 7.07691 26.9543 7.07691 26.0616V17.3943C7.07691 17.0101 7.25772 16.7841 7.56282 16.7841C7.86793 16.7841 8.06003 17.0101 8.06003 17.3943V26.0616C8.06003 26.9543 8.60244 27.4289 9.34826 27.4289C10.0828 27.4289 10.6252 26.9543 10.6252 26.0616V11.4165C10.6252 11.1114 10.7721 10.9306 11.0207 10.9306C11.258 10.9306 11.4162 11.1114 11.4162 11.4165V17.4282C11.4162 18.2305 11.8908 18.6825 12.5688 18.6825C13.2468 18.6825 13.7101 18.2305 13.7101 17.4282V11.5521C13.7101 7.9699 11.6874 7.04328 7.67583 7.04328H5.93559C5.15588 7.04328 4.76037 6.93027 4.13885 6.47827L2.64723 5.42735L2.37602 1.20106C2.31952 0.387446 1.79971 -0.0419624 1.1217 0.00323846C0.432382 0.0371391 -0.0422274 0.534349 0.00297345 1.33666L0.274179 5.52905C0.33068 6.44437 0.692287 6.97548 1.2573 7.39358L3.96935 9.37112C4.36486 9.65363 4.50046 10.0039 4.50046 10.4559V26.0616C4.50046 26.9543 5.05417 27.4289 5.78869 27.4289ZM7.67583 5.91325C9.17875 5.91325 10.3879 4.67023 10.3879 3.2125C10.3879 1.70957 9.17875 0.489148 7.67583 0.489148C6.16159 0.489148 4.97507 1.70957 4.97507 3.2125C4.97507 4.69283 6.16159 5.91325 7.67583 5.91325Z"/>
                  </g>
                </g>

                <line x1="32" y1="-10" x2="32" y2="10" stroke="#9ca3af" stroke-width="1" />

                <!-- Right Half: Add Node -->
                <g style="cursor:pointer;" @click.stop="$emit('add-branch-node', br.id)">
                  <rect x="32" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                  <g transform="translate(38.5, -9.5)" fill="#4b5563">
                    <path d="M9.08789 18.1758C14.0713 18.1758 18.1846 14.0625 18.1846 9.08789C18.1846 4.11328 14.0625 0 9.0791 0C4.10449 0 0 4.11328 0 9.08789C0 14.0625 4.11328 18.1758 9.08789 18.1758ZM9.08789 16.3652C5.05371 16.3652 1.82812 13.1221 1.82812 9.08789C1.82812 5.05371 5.05371 1.81934 9.0791 1.81934C13.1133 1.81934 16.3564 5.05371 16.3652 9.08789C16.374 13.1221 13.1221 16.3652 9.08789 16.3652ZM5.84473 9.92285H8.25293V12.3398C8.25293 12.8232 8.5957 13.166 9.07031 13.166C9.5625 13.166 9.91406 12.8232 9.91406 12.3398V9.92285H12.3311C12.8145 9.92285 13.166 9.58008 13.166 9.09668C13.166 8.61328 12.8232 8.26172 12.3311 8.26172H9.91406V5.84473C9.91406 5.35254 9.5625 5.00977 9.07031 5.00977C8.5957 5.00977 8.25293 5.35254 8.25293 5.84473V8.26172H5.84473C5.34375 8.26172 5.00098 8.61328 5.00098 9.09668C5.00098 9.58008 5.35254 9.92285 5.84473 9.92285Z" />
                  </g>
                </g>
              </g>
            </template>
          </template>
        </template>

        <!-- ── LEFT RAIL & SEGMENTS ── -->
        <template v-for="(seg, i) in layout.leftSegments" :key="'lseg-' + seg.id">
          <!-- Segment Background Gradient -->
          <rect :x="layout.leftX"
                :y="layout.leftNodeY[i]"
                width="50"
                :height="layout.leftNodeY[i+1] - layout.leftNodeY[i]"
                fill="url(#interval-fade-left)" />

          <!-- Interval Badge (Inside Oval, e.g. 20-25хв) -->
          <g class="anim-row" :style="{ transform: 'translate(0px, ' + layout.getLeftIntervalY(seg, layout.leftNodeY[i], layout.leftNodeY[i+1], i === layout.leftSegments.length - 1, segments.indexOf(seg)) + 'px)' }" style="pointer-events:none;">
            <text :x="layout.leftX + 25" y="4"
                  font-size="13" font-weight="800" :fill="color" font-style="italic">
              {{ (seg.interval || '20') + '-' + (seg.intervalMax || '25') + 'хв' }}
            </text>
          </g>

          <!-- Clickable Overlay for Zooming -->
          <rect :x="layout.leftX - 8"
                :y="layout.leftNodeY[i]"
                width="16"
                :height="layout.leftNodeY[i+1] - layout.leftNodeY[i]"
                fill="transparent"
                style="cursor: pointer;"
                @click="zoomToSegment('left', i)" />

          <!-- Segment Stops -->
          <g class="anim-row stop-item-left" v-for="(stop, stIdx) in seg.stops" :key="'lstop-' + stop.id"
             :style="{ transform: 'translate(0px, ' + layout.stopY(seg, layout.leftNodeY[i], layout.leftNodeY[i+1], stIdx, i === layout.leftSegments.length - 1, segments.indexOf(seg)) + 'px)' }">
            <line :x1="layout.leftX" y1="0"
                  :x2="layout.leftX - 12" y2="0"
                  :stroke="color" stroke-width="4.5" stroke-linecap="square"/>
            <text :x="layout.leftX - 18" y="4"
                  font-size="12" font-weight="700" fill="#111827" text-anchor="end"
                  style="pointer-events:none;">
              {{ stop.name }}
            </text>
          </g>

          <!-- Apple-style Unified Add Pill (Left Rail) -->
          <g v-if="editable" class="anim-row"
             :style="{ transform: 'translate(0px, ' + layout.getLeftAddStopY(seg, layout.leftNodeY[i], layout.leftNodeY[i+1], i === layout.leftSegments.length - 1, segments.indexOf(seg)) + 'px)' }">
            <rect :x="layout.leftX - 82" y="-14" width="64" height="28" rx="14"
                  fill="rgba(255,255,255,0.8)" stroke="#d1d5db" stroke-width="1"
                  style="backdrop-filter: blur(4px);" />
            
            <!-- Far Left Half: Add Control Node -->
            <g v-if="!hasBranchForSeg(segments.indexOf(seg))" style="cursor:pointer;" @click.stop="$emit('add-node', 'left', segments.indexOf(seg))">
              <rect :x="layout.leftX - 82" y="-14" width="32" height="28" fill="transparent" rx="14"/>
              <g :transform="'translate(' + (layout.leftX - 75.5) + ', -9.5)'" fill="#4b5563">
                <path d="M9.08789 18.1758C14.0713 18.1758 18.1846 14.0625 18.1846 9.08789C18.1846 4.11328 14.0625 0 9.0791 0C4.10449 0 0 4.11328 0 9.08789C0 14.0625 4.11328 18.1758 9.08789 18.1758ZM9.08789 16.3652C5.05371 16.3652 1.82812 13.1221 1.82812 9.08789C1.82812 5.05371 5.05371 1.81934 9.0791 1.81934C13.1133 1.81934 16.3564 5.05371 16.3652 9.08789C16.374 13.1221 13.1221 16.3652 9.08789 16.3652ZM5.84473 9.92285H8.25293V12.3398C8.25293 12.8232 8.5957 13.166 9.07031 13.166C9.5625 13.166 9.91406 12.8232 9.91406 12.3398V9.92285H12.3311C12.8145 9.92285 13.166 9.58008 13.166 9.09668C13.166 8.61328 12.8232 8.26172 12.3311 8.26172H9.91406V5.84473C9.91406 5.35254 9.5625 5.00977 9.07031 5.00977C8.5957 5.00977 8.25293 5.35254 8.25293 5.84473V8.26172H5.84473C5.34375 8.26172 5.00098 8.61328 5.00098 9.09668C5.00098 9.58008 5.35254 9.92285 5.84473 9.92285Z" />
              </g>
            </g>

            <!-- Vertical Divider -->
            <line v-if="!hasBranchForSeg(segments.indexOf(seg))" :x1="layout.leftX - 50" y1="-10" :x2="layout.leftX - 50" y2="10" stroke="#9ca3af" stroke-width="1" />
            
            <!-- Right Half (closer to rail): Add Stop -->
            <g style="cursor:pointer;" @click.stop="$emit('add-stop', segments.indexOf(seg), 'left')">
              <rect :x="layout.leftX - 50" y="-14" width="32" height="28" fill="transparent" rx="14"/>
              <g :transform="'translate(' + (layout.leftX - 40) + ', -7) scale(-1, 1)'" fill="#4b5563">
                <path transform="scale(0.5)" d="M5.78869 27.4289C6.5345 27.4289 7.07691 26.9543 7.07691 26.0616V17.3943C7.07691 17.0101 7.25772 16.7841 7.56282 16.7841C7.86793 16.7841 8.06003 17.0101 8.06003 17.3943V26.0616C8.06003 26.9543 8.60244 27.4289 9.34826 27.4289C10.0828 27.4289 10.6252 26.9543 10.6252 26.0616V11.4165C10.6252 11.1114 10.7721 10.9306 11.0207 10.9306C11.258 10.9306 11.4162 11.1114 11.4162 11.4165V17.4282C11.4162 18.2305 11.8908 18.6825 12.5688 18.6825C13.2468 18.6825 13.7101 18.2305 13.7101 17.4282V11.5521C13.7101 7.9699 11.6874 7.04328 7.67583 7.04328H5.93559C5.15588 7.04328 4.76037 6.93027 4.13885 6.47827L2.64723 5.42735L2.37602 1.20106C2.31952 0.387446 1.79971 -0.0419624 1.1217 0.00323846C0.432382 0.0371391 -0.0422274 0.534349 0.00297345 1.33666L0.274179 5.52905C0.33068 6.44437 0.692287 6.97548 1.2573 7.39358L3.96935 9.37112C4.36486 9.65363 4.50046 10.0039 4.50046 10.4559V26.0616C4.50046 26.9543 5.05417 27.4289 5.78869 27.4289ZM7.67583 5.91325C9.17875 5.91325 10.3879 4.67023 10.3879 3.2125C10.3879 1.70957 9.17875 0.489148 7.67583 0.489148C6.16159 0.489148 4.97507 1.70957 4.97507 3.2125C4.97507 4.69283 6.16159 5.91325 7.67583 5.91325Z"/>
              </g>
            </g>
          </g>

          <!-- Left Branches for this Segment -->
          <template v-for="(br, brIdx) in branchesForSeg(segments.indexOf(seg))" :key="'lbr-' + br.id">
            <path v-if="br.finished"
                  :d="getLeftBranchFinishedPath(br, i).d"
                  fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>
            <path v-else
                  :d="getBranchOutPath(layout.leftX, layout.leftNodeY[i+1] - 40, getBranchDx(br), -1, -1) + ' L ' + (layout.leftX - getBranchDx(br)) + ' ' + getBranchEndpointY(br, i, false)"
                  fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>

            <!-- Branch Direction Arrow (Left) -->
            <g :transform="'translate(' + (layout.leftX - getBranchDx(br)) + ', ' + (layout.leftNodeY[i+1] - 40 - 48) + ') rotate(-90)'">
              <polygon points="0,-4.5 42,-4.5 50,0 42,4.5 0,4.5" fill="url(#arrow-fade)" />
              <polygon points="0,-4.5 8,0 0,4.5" :fill="color" />
            </g>

            <!-- Config Circle Badge (Left) -->
            <g style="cursor:pointer" @click.stop="!br.finished && $emit('finish-branch', br.id)">
              <circle :cx="layout.leftX - getBranchDx(br)"
                      :cy="br.finished ? getLeftBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, false)"
                      r="9" fill="#f5f5f5" :stroke="color" stroke-width="3"/>
              <text :x="layout.leftX - getBranchDx(br) - 18"
                    :y="(br.finished ? getLeftBranchFinishedPath(br, i).turnY : getBranchEndpointY(br, i, false)) + 4"
                    font-size="13" font-weight="800" fill="#111827" text-anchor="end"
                    style="pointer-events:none;">Контрольна точка</text>
            </g>

            <!-- Type 1 Merge Node on Main Line -->
            <g v-if="br.finished && br.mergeConfigured === 'add_inside'">
              <circle :cx="layout.leftX"
                      :cy="getLeftBranchFinishedPath(br, i).mergeY"
                      r="9" fill="#f5f5f5" :stroke="color" stroke-width="3"/>
              <text :x="layout.leftX + 18"
                    :y="getLeftBranchFinishedPath(br, i).mergeY + 4"
                    font-size="13" font-weight="800" fill="#111827" text-anchor="start"
                    style="pointer-events:none;">З'єднання</text>
            </g>

            <!-- Branch Control Nodes -->
            <g v-for="(bNode, bNIdx) in br.nodes || []" :key="'lbrn-' + bNode.id" style="cursor:pointer;"
               @click.stop="$emit('edit-branch-node', br.id, bNIdx)">
              <circle :cx="layout.leftX - getBranchDx(br)"
                      :cy="getBranchNodeY(br, bNIdx, i, false)"
                      r="9" fill="#f5f5f5" :stroke="color" stroke-width="3"/>
              <text :x="layout.leftX - getBranchDx(br) - 18"
                    :y="getBranchNodeY(br, bNIdx, i, false) + 4"
                    font-size="13" font-weight="800" fill="#111827" text-anchor="end">{{ bNode.name }}</text>
            </g>

            <!-- Branch Stops (Per Section) -->
            <template v-for="(si, secIdx) in (getBranchNodesLength(br) + 1)" :key="'lbrsec-' + secIdx">
              <g v-for="(bStop, bStIdx) in getBranchSectionStops(br, secIdx)" :key="'lbrst-' + bStop.id" style="cursor:pointer;"
                 @click.stop="$emit('edit-branch-stop', br.id, secIdx - 1, bStIdx)">
                <line :x1="layout.leftX - getBranchDx(br)"
                      :y1="getBranchStopY(br, secIdx, bStIdx, i, false)"
                      :x2="layout.leftX - getBranchDx(br) - 12"
                      :y2="getBranchStopY(br, secIdx, bStIdx, i, false)"
                      :stroke="color" stroke-width="4.5" stroke-linecap="square"/>
                <text :x="layout.leftX - getBranchDx(br) - 18"
                      :y="getBranchStopY(br, secIdx, bStIdx, i, false) + 4"
                      font-size="12" font-weight="700" fill="#111827" text-anchor="end">{{ bStop.name }}</text>
              </g>

              <!-- Apple-style Unified Add Pill (Left Branch) -->
              <g v-if="!br.finished && editable"
                 :transform="'translate(' + (layout.leftX - getBranchDx(br) + 24) + ', ' + getBranchNodeY(br, secIdx - 1, i, false) + ')'">
                <rect x="-64" y="-14" width="64" height="28" rx="14"
                      fill="rgba(255,255,255,0.8)" stroke="#d1d5db" stroke-width="1"
                      style="backdrop-filter: blur(4px);" />
                
                <!-- Far Left: Add Node -->
                <g style="cursor:pointer;" @click.stop="$emit('add-branch-node', br.id)">
                  <rect x="-64" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                  <g transform="translate(-57.5, -9.5)" fill="#4b5563">
                    <path d="M9.08789 18.1758C14.0713 18.1758 18.1846 14.0625 18.1846 9.08789C18.1846 4.11328 14.0625 0 9.0791 0C4.10449 0 0 4.11328 0 9.08789C0 14.0625 4.11328 18.1758 9.08789 18.1758ZM9.08789 16.3652C5.05371 16.3652 1.82812 13.1221 1.82812 9.08789C1.82812 5.05371 5.05371 1.81934 9.0791 1.81934C13.1133 1.81934 16.3564 5.05371 16.3652 9.08789C16.374 13.1221 13.1221 16.3652 9.08789 16.3652ZM5.84473 9.92285H8.25293V12.3398C8.25293 12.8232 8.5957 13.166 9.07031 13.166C9.5625 13.166 9.91406 12.8232 9.91406 12.3398V9.92285H12.3311C12.8145 9.92285 13.166 9.58008 13.166 9.09668C13.166 8.61328 12.8232 8.26172 12.3311 8.26172H9.91406V5.84473C9.91406 5.35254 9.5625 5.00977 9.07031 5.00977C8.5957 5.00977 8.25293 5.35254 8.25293 5.84473V8.26172H5.84473C5.34375 8.26172 5.00098 8.61328 5.00098 9.09668C5.00098 9.58008 5.35254 9.92285 5.84473 9.92285Z" />
                  </g>
                </g>

                <line x1="-32" y1="-10" x2="-32" y2="10" stroke="#9ca3af" stroke-width="1" />

                <!-- Right (closer to branch): Add Stop -->
                <g style="cursor:pointer;" @click.stop="$emit('add-branch-stop', br.id, si)">
                  <rect x="-32" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                  <g transform="translate(-22, -7) scale(-1, 1)" fill="#4b5563">
                    <path transform="scale(0.5)" d="M5.78869 27.4289C6.5345 27.4289 7.07691 26.9543 7.07691 26.0616V17.3943C7.07691 17.0101 7.25772 16.7841 7.56282 16.7841C7.86793 16.7841 8.06003 17.0101 8.06003 17.3943V26.0616C8.06003 26.9543 8.60244 27.4289 9.34826 27.4289C10.0828 27.4289 10.6252 26.9543 10.6252 26.0616V11.4165C10.6252 11.1114 10.7721 10.9306 11.0207 10.9306C11.258 10.9306 11.4162 11.1114 11.4162 11.4165V17.4282C11.4162 18.2305 11.8908 18.6825 12.5688 18.6825C13.2468 18.6825 13.7101 18.2305 13.7101 17.4282V11.5521C13.7101 7.9699 11.6874 7.04328 7.67583 7.04328H5.93559C5.15588 7.04328 4.76037 6.93027 4.13885 6.47827L2.64723 5.42735L2.37602 1.20106C2.31952 0.387446 1.79971 -0.0419624 1.1217 0.00323846C0.432382 0.0371391 -0.0422274 0.534349 0.00297345 1.33666L0.274179 5.52905C0.33068 6.44437 0.692287 6.97548 1.2573 7.39358L3.96935 9.37112C4.36486 9.65363 4.50046 10.0039 4.50046 10.4559V26.0616C4.50046 26.9543 5.05417 27.4289 5.78869 27.4289ZM7.67583 5.91325C9.17875 5.91325 10.3879 4.67023 10.3879 3.2125C10.3879 1.70957 9.17875 0.489148 7.67583 0.489148C6.16159 0.489148 4.97507 1.70957 4.97507 3.2125C4.97507 4.69283 6.16159 5.91325 7.67583 5.91325Z"/>
                  </g>
                </g>
              </g>
            </template>
          </template>
        </template>

        <!-- ── MAIN CONTROL NODES & INWARD CONNECTING LINES ── -->
        <g v-for="(node, idx) in controlNodes" :key="'cnode-' + node.id" class="anim-row"
           :style="{ transform: 'translate(0px, ' + getNodeY(node.id) + 'px)' }">
          <!-- Direction Arrow for Control Node (Gradient Stripe Style) -->
          <g v-if="node.side === 'left'" :transform="'translate(' + layout.leftX + ', -25) rotate(-90)'">
            <!-- White body with gradient -->
            <polygon points="0,-4.5 42,-4.5 50,0 42,4.5 0,4.5" fill="url(#arrow-fade)" />
            <!-- Route-colored cutout at the base -->
            <polygon points="0,-4.5 8,0 0,4.5" :fill="color" />
          </g>
          <g v-else :transform="'translate(' + layout.rightX + ', 25) rotate(90)'">
            <!-- White body with gradient -->
            <polygon points="0,-4.5 42,-4.5 50,0 42,4.5 0,4.5" fill="url(#arrow-fade)" />
            <!-- Route-colored cutout at the base -->
            <polygon points="0,-4.5 8,0 0,4.5" :fill="color" />
          </g>

          <!-- Horizontal light blue line extending INWARDS -->
          <line v-if="node.side === 'left'"
                :x1="layout.leftX" y1="0"
                :x2="layout.leftX + 25" y2="0"
                :stroke="color" stroke-width="3"/>
          <line v-else
                :x1="layout.rightX" y1="0"
                :x2="layout.rightX - 25" y2="0"
                :stroke="color" stroke-width="3"/>

          <!-- Circle only on the correct side -->
          <circle v-if="node.side === 'left'" :cx="layout.leftX" cy="0" r="9"
                  fill="#f5f5f5" :stroke="(node.type === 'end' || node.isTerminus) ? '#111827' : color" :stroke-width="(node.type === 'end' || node.isTerminus) ? 4 : 3.5"
                  :class="{ 'terminus-added': (node.type === 'end' || node.isTerminus) }" />
          <circle v-else :cx="layout.rightX" cy="0" r="9"
                  fill="#f5f5f5" :stroke="(node.type === 'end' || node.isTerminus) ? '#111827' : color" :stroke-width="(node.type === 'end' || node.isTerminus) ? 4 : 3.5"
                  :class="{ 'terminus-added': (node.type === 'end' || node.isTerminus) }" />

          <!-- Control Node Name Label & Travel Time -->
          <text v-if="node.side === 'left'"
                :x="layout.leftX - 18" y="4"
                font-size="13" font-weight="800" fill="#111827" text-anchor="end" style="pointer-events:none;">
            <tspan>{{ (node.type === 'end' || node.isTerminus) && node.terminusStop ? node.terminusStop : node.name }} </tspan><tspan font-size="13" font-weight="800" font-style="italic" :fill="color">{{ nodeTravelTimes[node.id] || 0 }} хв</tspan>
          </text>
          <text v-else
                :x="layout.rightX + 18" y="4"
                font-size="13" font-weight="800" fill="#111827" style="pointer-events:none;">
            <tspan>{{ (node.type === 'end' || node.isTerminus) && node.terminusStop ? node.terminusStop : node.name }} </tspan><tspan font-size="13" font-weight="800" font-style="italic" :fill="color">{{ nodeTravelTimes[node.id] || 0 }} хв</tspan>
          </text>
          
          <!-- Icons for side termini (placed INSIDE the oval) -->
          <g v-if="node.isTerminus && getTerminusIcons(node).length > 0" :transform="'translate(' + (node.side === 'left' ? layout.leftX + 32 : layout.rightX - 52) + ', -6)'">
            <g v-for="(icon, i) in getTerminusIcons(node)" :key="icon.id" :transform="'translate(' + (node.side === 'left' ? (i * 24) : (-i * 24)) + ', 0)'">
              <SvgIcon :name="icon.id" :x="icon.x" :y="icon.y" :width="icon.w" :height="icon.h" class="text-gray-800" />
            </g>
          </g>
        </g>

        <!-- ── "+ Додати ділянку" BUTTON ON RIGHT RAIL ── -->
        <g v-if="editable && !localBranchMode">
          <!-- Grey gradient extension line towards right button -->
          <line class="anim-line"
                :x1="layout.rightX" :y1="(layout.rightNodeY[layout.rightNodeY.length - 1] || 0)"
                :x2="layout.rightX" :y2="rightAddNodeY"
                stroke="url(#rail-grey-down)" :stroke-width="layout.RAIL_W" stroke-linecap="round" />
          <g class="anim-row"
             :style="{ transform: 'translate(0px, ' + rightAddNodeY + 'px)' }"
             style="cursor:pointer;" @click.stop="$emit('add-node', 'right')">
            <circle :cx="layout.rightX" cy="0" r="14"
                    fill="#ffffff" stroke="#9ca3af" stroke-width="2.5"/>
            <text :x="layout.rightX" y="5"
                  font-size="16" font-weight="900" fill="#6b7280" text-anchor="middle" style="pointer-events:none;">+</text>
            <text :x="layout.rightX + 22" y="4"
                  font-size="12" font-weight="700" fill="#6b7280" style="pointer-events:none;">Додати ділянку</text>
          </g>
        </g>
        <!-- ── "+ Додати ділянку" BUTTON ON LEFT RAIL ── -->
        <g v-if="editable && !localBranchMode">
          <!-- Grey gradient extension line towards left button -->
          <line class="anim-line"
                :x1="layout.leftX" :y1="(layout.leftNodeY[0] || 0)"
                :x2="layout.leftX" :y2="leftAddNodeY"
                stroke="url(#rail-grey-up)" :stroke-width="layout.RAIL_W" stroke-linecap="round" />
          <g class="anim-row"
             :style="{ transform: 'translate(0px, ' + leftAddNodeY + 'px)' }"
             style="cursor:pointer;" @click.stop="$emit('add-node', 'left')">
            <circle :cx="layout.leftX" cy="0" r="14"
                    fill="#ffffff" stroke="#9ca3af" stroke-width="2.5"/>
            <text :x="layout.leftX" y="5"
                  font-size="16" font-weight="900" fill="#6b7280" text-anchor="middle" style="pointer-events:none;">+</text>
            <text :x="layout.leftX - 22" y="4"
                  font-size="12" font-weight="700" fill="#6b7280" text-anchor="end" style="pointer-events:none;">Додати ділянку</text>
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { OvalLayout, OVAL_DEFAULTS } from '../utils/routeGeometry';
import SvgIcon from '@/components/ui/SvgIcon.vue';

function getBranchNodesLength(br) {
  return (br && br.nodes) ? br.nodes.length : 0;
}

function getBranchSectionStops(br, secIdx) {
  if (!br) return [];
  if (br.sections && br.sections[secIdx - 1] && br.sections[secIdx - 1].stops) {
    return br.sections[secIdx - 1].stops;
  }
  return secIdx === 1 ? (br.stops || []) : [];
}

const props = defineProps({
  routeData: { type: Object, required: true },
  editable: { type: Boolean, default: false },
  viewBoxOverride: { type: Object, default: null },
  isBranchMode: { type: Boolean, default: false },
  isAnimationPaused: { type: Boolean, default: false }
});

const router = useRouter();
const route = useRoute();

const svgRef = ref(null);

watch(() => props.isAnimationPaused, (paused) => {
  if (svgRef.value) {
    if (paused) svgRef.value.pauseAnimations();
    else svgRef.value.unpauseAnimations();
  }
});

const arcArrows = computed(() => {
  if (!layout.value) return null;
  const l = layout.value;
  const R = l.CAP_R;
  const t = 0.5;
  const dx = Math.cos(t) * R;
  const dy = Math.sin(t) * R;
  const tDeg = t * (180 / Math.PI);

  return {
    topRight: {
      startX: dx,
      startY: l.topY - dy,
      endX: l.rightX,
      endY: l.topY,
      cutoutRot: 90 - tDeg,
      tipRot: 90,
      sweep: 1
    },
    botRight: {
      startX: l.rightX,
      startY: l.botY,
      endX: dx,
      endY: l.botY + dy,
      cutoutRot: 90,
      tipRot: 90 + tDeg,
      sweep: 1
    },
    topLeft: {
      startX: l.leftX,
      startY: l.topY,
      endX: -dx,
      endY: l.topY - dy,
      cutoutRot: -90,
      tipRot: -90 + tDeg,
      sweep: 1
    },
    botLeft: {
      startX: -dx,
      startY: l.botY + dy,
      endX: l.leftX,
      endY: l.botY,
      cutoutRot: -90 - tDeg,
      tipRot: -90,
      sweep: 1
    }
  };
});

const topArcArrows = computed(() => {
  if (!arcArrows.value) return [];
  return [
    { key: 'topRight', ...arcArrows.value.topRight },
    { key: 'topLeft', ...arcArrows.value.topLeft }
  ];
});

const botArcArrows = computed(() => {
  if (!arcArrows.value) return [];
  return [
    { key: 'botRight', ...arcArrows.value.botRight },
    { key: 'botLeft', ...arcArrows.value.botLeft }
  ];
});

const emit = defineEmits([
  'add-stop', 'remove-stop',
  'add-node', 'remove-node',
  'add-branch', 'add-sub-branch', 'finish-branch',
  'add-branch-node', 'add-branch-stop',
  'edit-branch-stop', 'edit-branch-node',
  'toggle-branch-mode'
]);

const color = computed(() => props.routeData.color || '#1D43EF');
const nodes = computed(() => props.routeData.nodes || []);
const segments = computed(() => props.routeData.segments || []);
const branches = computed(() => props.routeData.branches || []);
const localBranchMode = computed(() => props.isBranchMode || props.routeData.isBranchMode || false);

const firstNode = computed(() => nodes.value.find(n => !n.side));
const lastNode = computed(() => nodes.value.filter(n => !n.side)[1] || nodes.value.find(n => !n.side));
const controlNodes = computed(() => nodes.value.filter(n => n.side === 'left' || n.side === 'right'));

const rightAddNodeY = computed(() => {
  if (!layout.value || !layout.value.rightNodeY?.length) return 55;
  const lastY = layout.value.rightNodeY[layout.value.rightNodeY.length - 1];
  return lastY !== undefined ? lastY + 55 : 55;
});

const leftAddNodeY = computed(() => {
  if (!layout.value || !layout.value.leftNodeY?.length) return 55;
  const topY = layout.value.leftNodeY[0];
  return topY !== undefined ? Math.max(25, topY - 55) : 55;
});

const nodeTravelTimes = computed(() => {
  if (!layout.value) return {};
  const times = {};
  let time = 0;
  const nodeMap = new Map(props.routeData.nodes.map(n => [String(n.id), n]));
  
  // Find the exact first terminus in traversal order
  let firstTerminusId = null;
  const top = props.routeData.nodes.find(n => !n.side);
  if (top && top.isTerminus) firstTerminusId = top.id;
  if (!firstTerminusId) {
    const right = props.routeData.nodes.find(n => n.side === 'right' && n.isTerminus);
    if (right) firstTerminusId = right.id;
  }
  if (!firstTerminusId) {
    const bot = props.routeData.nodes.filter(n => !n.side)[1];
    if (bot && bot.isTerminus) firstTerminusId = bot.id;
  }
  if (!firstTerminusId) {
    const lefts = props.routeData.nodes.filter(n => n.side === 'left');
    for (let i = lefts.length - 1; i >= 0; i--) {
      if (lefts[i].isTerminus) { firstTerminusId = lefts[i].id; break; }
    }
  }
  
  // Forward trip (right rail)
  layout.value.rightSegments.forEach((seg, i) => {
    const nodeId = layout.value.rightNodes[i]?.id;
    if (nodeId) {
      times[nodeId] = time;
      const node = nodeMap.get(String(nodeId));
      if (node && node.isTerminus && String(node.id) !== String(firstTerminusId)) {
        time += Number(node.waitMin || 0);
      }
    }
    time += Number(seg.travelTime || 0);
  });
  
  // Bottom terminus
  const bottomNodeId = layout.value.rightNodes[layout.value.rightNodes.length - 1]?.id;
  if (bottomNodeId) {
    times[bottomNodeId] = time;
    const botNode = nodeMap.get(String(bottomNodeId));
    if (botNode && botNode.isTerminus && String(botNode.id) !== String(firstTerminusId)) {
      time += Number(botNode.waitMin || 0);
    }
  }
  
  // Return trip (left rail, from bottom to top)
  for (let i = layout.value.leftSegments.length - 1; i >= 0; i--) {
    time += Number(layout.value.leftSegments[i].travelTime || 0);
    const nodeId = layout.value.leftNodes[i]?.id;
    if (nodeId && i > 0) { // i=0 is the top node which is already processed initially
      times[nodeId] = time;
      const node = nodeMap.get(String(nodeId));
      if (node && node.isTerminus && String(node.id) !== String(firstTerminusId)) {
        time += Number(node.waitMin || 0);
      }
    }
  }
  const totalLoopTime = time;
  const shiftTime = firstTerminusId && times[firstTerminusId] !== undefined ? times[firstTerminusId] : 0;
  
  const formattedTimes = {};
  for (let key in times) {
    let t = times[key] - shiftTime;
    if (t < 0) t += totalLoopTime;
    
    if (String(key) === String(firstTerminusId)) {
      formattedTimes[key] = `${totalLoopTime} / 0`;
    } else {
      formattedTimes[key] = String(t);
    }
  }
  
  return formattedTimes;
});

const nodeYMap = computed(() => {
  if (!layout.value) return {};
  const map = {};
  const l = layout.value;
  l.rightNodes?.forEach((n, i) => {
    if (n) map[n.id] = l.rightNodeY[i] ?? 0;
  });
  l.leftNodes?.forEach((n, i) => {
    if (n) map[n.id] = l.leftNodeY[i] ?? 0;
  });
  if (l.firstNode) map[l.firstNode.id] = l.topY - (l.CAP_R || 100);
  if (l.lastNode) map[l.lastNode.id] = l.botY + (l.CAP_R || 100);
  return map;
});

function getNodeY(nodeId) {
  return nodeYMap.value[nodeId] ?? 0;
}

function getBranchOutPath(x, y, dx, dirX, dirY) {
  const absDx = Math.abs(dx);
  const r = Math.min(20, absDx / 2);
  const y1 = y + 8 * dirY;
  const y2 = y1 + r * dirY;
  const x2 = x + r * dirX;
  const endX = x + dx * dirX;
  const lineEndX = endX - r * dirX;
  const endY = y2 + r * dirY;
  return `M ${x} ${y} 
          L ${x} ${y1} 
          Q ${x} ${y2} ${x2} ${y2} 
          L ${lineEndX} ${y2} 
          Q ${endX} ${y2} ${endX} ${endY}`;
}

function getBranchInPath(x, y, dx, dirX, dirY) {
  const absDx = Math.abs(dx);
  const r = Math.min(20, absDx / 2);
  const startX = x + dx * dirX;
  const startY = y - (8 + 2 * r) * dirY;
  const yArcTop = startY + r * dirY;
  const lineEndX = x + r * dirX;
  const yArcBot = y - 8 * dirY;
  return `L ${startX} ${startY}
          Q ${startX} ${yArcTop} ${startX - r * dirX} ${yArcTop}
          L ${lineEndX} ${yArcTop}
          Q ${x} ${yArcTop} ${x} ${yArcBot}
          L ${x} ${y}`;
}

function getBranchNodeY(br, bNIdx, i, isRight) {
  if (!layout.value) return 0;
  const l = layout.value;
  const startY = isRight ? (l.rightNodeY[i] + 40) : (l.leftNodeY[i+1] - 40);
  
  let yOffset = 48;
  const sections = br.sections || [];
  for (let si = 0; si <= bNIdx; si++) {
    const stopsCount = (sections[si]?.stops || []).length;
    yOffset += (stopsCount > 0 ? (35 + stopsCount * 32) : 25);
  }
  return isRight ? (startY + yOffset) : (startY - yOffset);
}

function getBranchStopY(br, secIdx, bStIdx, i, isRight) {
  if (!layout.value) return 0;
  const l = layout.value;
  const startY = isRight ? (l.rightNodeY[i] + 40) : (l.leftNodeY[i+1] - 40);
  
  let yOffset = 48;
  const sections = br.sections || [];
  for (let si = 0; si < secIdx - 1; si++) {
    const stopsCount = (sections[si]?.stops || []).length;
    yOffset += (stopsCount > 0 ? (35 + stopsCount * 32) : 25);
  }
  yOffset += 20 + bStIdx * 32;
  return isRight ? (startY + yOffset) : (startY - yOffset);
}

function getBranchAddStopY(br, secIdx, i, isRight) {
  if (!layout.value) return 0;
  const l = layout.value;
  const startY = isRight ? (l.rightNodeY[i] + 40) : (l.leftNodeY[i+1] - 40);
  
  let yOffset = 48;
  const sections = br.sections || [];
  for (let si = 0; si < secIdx - 1; si++) {
    const stopsCount = (sections[si]?.stops || []).length;
    yOffset += (stopsCount > 0 ? (35 + stopsCount * 32) : 25);
  }
  const stopsCount = (sections[secIdx - 1]?.stops || []).length;
  yOffset += (stopsCount > 0 ? (20 + stopsCount * 32 + 10) : 20);
  return isRight ? (startY + yOffset) : (startY - yOffset);
}

function getBranchAddNodeY(br, secIdx, i, isRight) {
  return getBranchAddStopY(br, secIdx, i, isRight) + (isRight ? 28 : -28);
}

function getBranchEndpointY(br, i, isRight) {
  const secIdx = getBranchNodesLength(br) + 1;
  return getBranchAddNodeY(br, secIdx, i, isRight) + (isRight ? 25 : -25);
}

function getBranchDx(br) {
  return (br.mergeConfigured === 'add_inside' || (br.finished && br.targetType && br.targetType !== 'current')) ? 190 : 45;
}

function getRightBranchFinishedPath(br, i) {
  if (!layout.value) return { d: '', arrowY: 0, turnY: 0, mergeY: 0 };
  const l = layout.value;
  const startY = l.rightNodeY[i] + 40;
  
  const isType1 = br.mergeConfigured === 'add_inside';
  const isType2 = br.targetType && br.targetType !== 'current';
  const dx = getBranchDx(br);
  
  const sections = br.sections || [];
  const sectionCount = Math.max((br.nodes || []).length + 1, 1);
  let branchHeight = 48 + 25;
  for (let si = 0; si < sectionCount; si++) {
    const stopsCount = (sections[si]?.stops || []).length;
    branchHeight += (stopsCount > 0 ? (35 + stopsCount * 32) : 25);
  }
  const nodeCount = (br.nodes || []).length;
  if (nodeCount > 0) branchHeight += nodeCount * 28;
  branchHeight = Math.max(135, branchHeight);
  
  const subBrs = subBranches(br.id);
  const subBrPadding = subBrs.reduce((acc, sb) => {
    const sbSections = sb.sections || [];
    const sbSectionCount = Math.max((sb.nodes || []).length + 1, 1);
    let sbH = sb.finished ? 100 : 50;
    for (let si = 0; si < sbSectionCount; si++) {
      sbH += ((sbSections[si]?.stops || []).length) * 32 + 25;
    }
    return acc + sbH;
  }, 0);
  
  const r = Math.min(20, Math.abs(dx) / 2);
  const outH = 8 + 2 * r;
  const turnY = startY + branchHeight + subBrPadding - outH;
  
  let targetNodeY = turnY + outH;
  if (br.targetType === 'node' && br.targetNodeId) {
    const tIdx = l.rightNodes.findIndex(n => n.id === br.targetNodeId);
    if (tIdx !== -1) targetNodeY = l.rightNodeY[tIdx];
  } else if (br.targetType === 'bottom_arc') {
    targetNodeY = l.rightNodeY[l.rightNodeY.length - 1] + 80;
  }
  
  const mergeY = isType2 ? targetNodeY : (turnY + outH);
  
  return {
    d: `${getBranchOutPath(l.rightX, startY, dx, 1, 1)}
        L ${l.rightX + dx} ${mergeY - outH}
        ${getBranchInPath(l.rightX, mergeY, dx, 1, 1)}`,
    arrowY: mergeY - 15,
    turnY: mergeY - outH,
    mergeY: mergeY
  };
}

function getLeftBranchFinishedPath(br, i) {
  if (!layout.value) return { d: '', arrowY: 0, turnY: 0, mergeY: 0 };
  const l = layout.value;
  const startY = l.leftNodeY[i+1] - 40;
  
  const isType2 = br.targetType && br.targetType !== 'current';
  const dx = getBranchDx(br);
  
  const sections = br.sections || [];
  const sectionCount = Math.max((br.nodes || []).length + 1, 1);
  let branchHeight = 48 + 25;
  for (let si = 0; si < sectionCount; si++) {
    const stopsCount = (sections[si]?.stops || []).length;
    branchHeight += (stopsCount > 0 ? (35 + stopsCount * 32) : 25);
  }
  const nodeCount = (br.nodes || []).length;
  if (nodeCount > 0) branchHeight += nodeCount * 28;
  branchHeight = Math.max(135, branchHeight);
  
  const subBrs = subBranches(br.id);
  const subBrPadding = subBrs.reduce((acc, sb) => {
    const sbSections = sb.sections || [];
    const sbSectionCount = Math.max((sb.nodes || []).length + 1, 1);
    let sbH = sb.finished ? 100 : 50;
    for (let si = 0; si < sbSectionCount; si++) {
      sbH += ((sbSections[si]?.stops || []).length) * 32 + 25;
    }
    return acc + sbH;
  }, 0);
  
  const r = Math.min(20, Math.abs(dx) / 2);
  const outH = 8 + 2 * r;
  const turnY = startY - branchHeight - subBrPadding + outH;
  
  let targetNodeY = turnY - outH;
  if (br.targetType === 'node' && br.targetNodeId) {
    const tIdx = l.leftNodes.findIndex(n => n.id === br.targetNodeId);
    if (tIdx !== -1) targetNodeY = l.leftNodeY[tIdx];
  }
  const mergeY = isType2 ? targetNodeY : (turnY - outH);
  
  return {
    d: `${getBranchOutPath(l.leftX, startY, dx, -1, -1)}
        L ${l.leftX - dx} ${mergeY + outH}
        ${getBranchInPath(l.leftX, mergeY, dx, -1, -1)}`,
    arrowY: mergeY + 15,
    turnY: mergeY + outH,
    mergeY: mergeY
  };
}

const layout = computed(() => {
  if (!nodes.value.length) return null;
  return new OvalLayout(nodes.value, segments.value, branches.value);
});

function branchesForSeg(sIdx) {
  return (branches.value || []).filter(b => b && b.segIdx === sIdx && !b.parentBranchId);
}

function subBranches(pId) {
  return (branches.value || []).filter(b => b && b.parentBranchId === pId);
}

function hasBranchForSeg(sIdx) {
  return (branches.value || []).some(b => !b.parentBranchId && b.segIdx === sIdx);
}

function hasSubBranch(pId, nId) {
  return (branches.value || []).some(b => b && b.parentBranchId === pId && (b.parentNodeId === nId || (!b.parentNodeId && nId === 'endpoint')));
}

/* ── ViewBox & Pan Handler ── */
const vbX = ref(-350);
const vbY = ref(-120);
const vbW = ref(800);
const vbH = ref(1200);

let zoomAnimFrame = null;
function zoomToSegment(side, index) {
  if (!layout.value) return;
  const l = layout.value;
  let cx = side === 'right' ? l.rightX : l.leftX;
  let cy = 0;
  let segH = 0;
  let segId = null;
  
  if (side === 'right') {
    cy = (l.rightNodeY[index] + l.rightNodeY[index+1]) / 2;
    segH = Math.abs(l.rightNodeY[index+1] - l.rightNodeY[index]);
    segId = l.rightSegments[index]?.id;
  } else {
    cy = (l.leftNodeY[index] + l.leftNodeY[index+1]) / 2;
    segH = Math.abs(l.leftNodeY[index+1] - l.leftNodeY[index]);
    segId = l.leftSegments[index]?.id;
  }
  
  if (segId && router && route) {
    router.push({ query: { ...route.query, segmentId: segId } });
  }
  
  // Target zoom size (fit the segment height + 160px padding)
  let targetH = segH + 160;
  let targetW = targetH * (800 / 1200);
  
  // Enforce a minimum width so text/buttons don't get cut off
  if (targetW < 350) {
    targetW = 350;
    targetH = targetW * (1200 / 800);
  }

  // If the segment is extremely long, don't zoom out further than default
  if (targetW > 800) {
    targetW = 800;
    targetH = 1200;
  }

  const targetX = cx - targetW / 2;
  const targetY = cy - targetH / 2;

  const startX = vbX.value;
  const startY = vbY.value;
  const startW = vbW.value;
  const startH = vbH.value;
  
  const duration = 500; // slightly longer for dramatic zoom
  const startTime = performance.now();
  
  if (zoomAnimFrame) cancelAnimationFrame(zoomAnimFrame);
  
  function step(time) {
    let progress = (time - startTime) / duration;
    if (progress > 1) progress = 1;
    // easeInOutQuad
    const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    vbX.value = startX + (targetX - startX) * ease;
    vbY.value = startY + (targetY - startY) * ease;
    vbW.value = startW + (targetW - startW) * ease;
    vbH.value = startH + (targetH - startH) * ease;
    
    if (progress < 1) {
      zoomAnimFrame = requestAnimationFrame(step);
    }
  }
  zoomAnimFrame = requestAnimationFrame(step);
}

function getTerminusIcons(node) {
  if (!node || !node.isTerminus) return [];
  const icons = [];
  if (node.waitMin > 0 || node.waitMax > 0) {
    icons.push({ id: 'bed', x: -10, y: 0, w: 20, h: 13.3 });
  }
  if (node.isDepot) {
    icons.push({ id: 'depot', x: -9.5, y: -1.5, w: 19, h: 16 });
  }
  if (node.canLunch) {
    icons.push({ id: 'lunch', x: -5, y: -2, w: 10, h: 17 });
  }
  return icons;
}

const currentViewBox = computed(() => {
  if (props.viewBoxOverride) {
    const v = props.viewBoxOverride;
    return `${v.x} ${v.y} ${v.w} ${v.h}`;
  }
  return `${vbX.value} ${vbY.value} ${vbW.value} ${vbH.value}`;
});

const isDragging = ref(false);
let _px = 0, _py = 0, _vx0 = 0, _vy0 = 0;

function onMouseDown(e) {
  if (props.viewBoxOverride) return;
  if (e.button === 1 || e.button === 0) {
    if (zoomAnimFrame) cancelAnimationFrame(zoomAnimFrame);
    isDragging.value = true;
    _px = e.clientX; _py = e.clientY;
    _vx0 = vbX.value; _vy0 = vbY.value;
  }
}

function onMouseMove(e) {
  if (!isDragging.value) return;
  const dx = e.clientX - _px;
  const dy = e.clientY - _py;
  // Adjust drag speed based on zoom level
  const scale = vbW.value / 800;
  vbX.value = _vx0 - dx * scale;
  vbY.value = _vy0 - dy * scale;
}

function onMouseUp() {
  isDragging.value = false;
}

function onWheel(e) {
  if (props.viewBoxOverride) return;
  const factor = e.deltaY > 0 ? 1.1 : 0.9;
  vbW.value *= factor;
  vbH.value *= factor;
}

function focusNode(nodeId) {
  if (!layout.value) return;
  const idx = nodes.value.findIndex(n => String(n.id) === String(nodeId));
  if (idx === -1) return;
  const node = nodes.value[idx];
  const ny = getNodeY(nodeId);
  
  let cx = 0;
  if (node.side === 'left') {
    cx = layout.value.leftX;
  } else if (node.side === 'right') {
    cx = layout.value.rightX;
  }
  
  const cy = ny;
  
  let targetH = 600;
  let targetW = targetH * (800 / 1200);
  
  const targetX = cx - targetW / 2;
  const targetY = cy - targetH / 2;
  
  const startX = vbX.value;
  const startY = vbY.value;
  const startW = vbW.value;
  const startH = vbH.value;
  
  const duration = 700;
  const startTime = performance.now();
  
  if (zoomAnimFrame) cancelAnimationFrame(zoomAnimFrame);
  
  function step(time) {
    let progress = (time - startTime) / duration;
    if (progress > 1) progress = 1;
    const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    vbX.value = startX + (targetX - startX) * ease;
    vbY.value = startY + (targetY - startY) * ease;
    vbW.value = startW + (targetW - startW) * ease;
    vbH.value = startH + (targetH - startH) * ease;
    
    if (progress < 1) {
      zoomAnimFrame = requestAnimationFrame(step);
    }
  }
  zoomAnimFrame = requestAnimationFrame(step);
}

function resetView() {
  if (zoomAnimFrame) cancelAnimationFrame(zoomAnimFrame);
  vbX.value = -350;
  vbY.value = -120;
  vbW.value = 800;
  vbH.value = 1200;
}

defineExpose({
  focusNode,
  resetView
});
</script>

<style scoped>
/* Hardware-accelerated transitions targeted strictly to animated structural elements */
.anim-line {
  transition: stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: stroke-dashoffset;
}

.anim-row,
.bottom-cap-group {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

@keyframes stopFadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.stop-item,
.stop-item-left {
  animation: stopFadeIn 0.35s ease-out forwards;
}

@keyframes popVectorRadius {
  0% { 
    r: 9px;
    stroke-width: 4px;
  }
  20% { 
    r: 15px;
    stroke-width: 6px;
  }
  40% {
    r: 11px;
    stroke-width: 4.5px;
  }
  60% {
    r: 15px;
    stroke-width: 6px;
  }
  80% {
    r: 11px;
    stroke-width: 4.5px;
  }
  100% { 
    r: 9px;
    stroke-width: 4px;
  }
}

.terminus-added {
  animation: popVectorRadius 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
</style>
