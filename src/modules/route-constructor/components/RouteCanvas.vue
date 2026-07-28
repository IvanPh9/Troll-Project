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
        <!-- Grid pattern -->
        <pattern id="canvas-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.03)" stroke-width="1"/>
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
              :style="{ strokeDasharray: '5000', strokeDashoffset: `${5000 - layout.botY}` }" />

        <!-- Left Rail Line -->
        <line :x1="layout.leftX" y1="0"
              :x2="layout.leftX" y2="5000"
              :stroke="color" :stroke-width="layout.RAIL_W" stroke-linecap="square"
              class="anim-line"
              :style="{ strokeDasharray: '5000', strokeDashoffset: `${5000 - layout.botY}` }" />

        <!-- Removed inline SVG defs -->



        <!-- Top Semicircular Cap (Right to Left arc bowing UP) -->
        <path :d="`M ${layout.rightX} ${layout.topY} A ${layout.CAP_R} ${layout.CAP_R} 0 0 0 ${layout.leftX} ${layout.topY}`"
              fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>

        <!-- Animated Triangle Direction Arrows -->


        <!-- Top Semicircular Cap (Left to Right arc bowing UP) -->
        <path :d="`M ${layout.leftX} ${layout.topY} A ${layout.CAP_R} ${layout.CAP_R} 0 0 1 ${layout.rightX} ${layout.topY}`"
              fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>

        <!-- Top Arc Arrows -->
        <g v-if="arcArrows">
          <template v-for="(arrow, key) in { topRight: arcArrows.topRight, topLeft: arcArrows.topLeft }" :key="key">
            <defs>
              <linearGradient :id="`arc-fade-${key}`" gradientUnits="userSpaceOnUse" :x1="arrow.startX" :y1="arrow.startY" :x2="arrow.endX" :y2="arrow.endY">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
                <stop offset="100%" stop-color="#ffffff" stop-opacity="0.4" />
              </linearGradient>
            </defs>
            <g>
              <path :d="`M ${arrow.startX} ${arrow.startY} A ${layout.CAP_R} ${layout.CAP_R} 0 0 ${arrow.sweep} ${arrow.endX} ${arrow.endY}`"
                    :stroke="`url(#arc-fade-${key})`" :stroke-width="layout.RAIL_W" fill="none" />
              <polygon points="0,-4.5 8,0 0,4.5" fill="#ffffff" opacity="0.4" :transform="`translate(${arrow.endX}, ${arrow.endY}) rotate(${arrow.tipRot})`" />
              <polygon points="0,-4.5 8,0 0,4.5" :fill="color" :transform="`translate(${arrow.startX}, ${arrow.startY}) rotate(${arrow.cutoutRot})`" />
            </g>
          </template>
        </g>

        <!-- ── TOP TERMINUS (Кінцева 1, Top Center of Cap) ── -->
        <g v-if="firstNode">
          <circle :cx="0" :cy="layout.topY - layout.CAP_R" r="9"
                  fill="#f5f5f5" :stroke="firstNode.isTerminus ? '#111827' : color" :stroke-width="firstNode.isTerminus ? 4 : 3.5"
                  :class="{ 'terminus-added': firstNode.isTerminus }" />
          <text :x="0" :y="layout.topY - layout.CAP_R - 16"
                font-size="13" font-weight="800" fill="#111827" text-anchor="middle"
                style="pointer-events:none;">
            {{ firstNode.isTerminus ? (firstNode.terminusStop || firstNode.name) : firstNode.name }} <tspan font-size="13" font-weight="800" font-style="italic" :fill="color">{{ nodeTravelTimes[firstNode.id] || 0 }} хв</tspan>
          </text>
          <!-- Icons below top terminus circle -->
          <g v-if="firstNode.isTerminus" :transform="`translate(0, ${layout.topY - layout.CAP_R + 15})`">
            <g v-for="(icon, i) in getTerminusIcons(firstNode)" :key="icon.id" :transform="`translate(${i * 24 - (getTerminusIcons(firstNode).length - 1) * 12}, 0)`">
              <SvgIcon :name="icon.id" :x="icon.x" :y="icon.y" :width="icon.w" :height="icon.h" class="text-gray-800" />
            </g>
          </g>
        </g>

        <!-- ── BOTTOM CAP & TERMINUS GROUP ── -->
        <g :transform="`translate(0, ${layout.botY})`" class="bottom-cap-group">
          <!-- Bottom Semicircular Cap (Left to Right arc bowing DOWN) -->
          <path :d="`M ${layout.leftX} 0 A ${layout.CAP_R} ${layout.CAP_R} 0 0 0 ${layout.rightX} 0`"
                fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>

          <!-- Bottom Arc Arrows -->
          <g v-if="arcArrows">
            <template v-for="(arrow, key) in { botRight: arcArrows.botRight, botLeft: arcArrows.botLeft }" :key="key">
              <defs>
                <linearGradient :id="`arc-fade-${key}`" gradientUnits="userSpaceOnUse" :x1="arrow.startX" :y1="arrow.startY - layout.botY" :x2="arrow.endX" :y2="arrow.endY - layout.botY">
                  <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
                  <stop offset="100%" stop-color="#ffffff" stop-opacity="0.4" />
                </linearGradient>
              </defs>
              <g>
                <path :d="`M ${arrow.startX} ${arrow.startY - layout.botY} A ${layout.CAP_R} ${layout.CAP_R} 0 0 ${arrow.sweep} ${arrow.endX} ${arrow.endY - layout.botY}`"
                      :stroke="`url(#arc-fade-${key})`" :stroke-width="layout.RAIL_W" fill="none" />
                <polygon points="0,-4.5 8,0 0,4.5" fill="#ffffff" opacity="0.4" :transform="`translate(${arrow.endX}, ${arrow.endY - layout.botY}) rotate(${arrow.tipRot})`" />
                <polygon points="0,-4.5 8,0 0,4.5" :fill="color" :transform="`translate(${arrow.startX}, ${arrow.startY - layout.botY}) rotate(${arrow.cutoutRot})`" />
              </g>
            </template>
          </g>

          <!-- Bottom Terminus (Кінцева 2, Bottom Center of Cap) -->
          <g v-if="lastNode">
            <circle :cx="0" :cy="layout.CAP_R" r="9"
                    fill="#f5f5f5" :stroke="lastNode.isTerminus ? '#111827' : color" :stroke-width="lastNode.isTerminus ? 4 : 3.5"
                    :class="{ 'terminus-added': lastNode.isTerminus }" />
            <text :x="0" :y="layout.CAP_R + 24"
                  font-size="13" font-weight="800" fill="#111827" text-anchor="middle"
                  style="pointer-events:none;">
              {{ lastNode.isTerminus ? (lastNode.terminusStop || lastNode.name) : lastNode.name }} <tspan font-size="13" font-weight="800" font-style="italic" :fill="color">{{ nodeTravelTimes[lastNode.id] || 0 }} хв</tspan>
            </text>
            <!-- Icons above bottom terminus circle -->
            <g v-if="lastNode.isTerminus" :transform="`translate(0, ${layout.CAP_R - 26})`">
              <g v-for="(icon, i) in getTerminusIcons(lastNode)" :key="icon.id" :transform="`translate(${i * 24 - (getTerminusIcons(lastNode).length - 1) * 12}, 0)`">
                <SvgIcon :name="icon.id" :x="icon.x" :y="icon.y" :width="icon.w" :height="icon.h" class="text-gray-800" />
              </g>
            </g>
          </g>
        </g>

        <!-- ── RIGHT RAIL & SEGMENTS ── -->
        <template v-for="(seg, i) in layout.rightSegments" :key="'rseg-' + seg.id">
          <!-- Interval Badge (Inside Oval, e.g. 20-25хв) -->
          <g class="anim-row" :style="{ transform: `translate(0px, ${(layout.rightNodeY[i] + layout.rightNodeY[i+1]) / 2}px)` }" style="pointer-events:none;">
            <text :x="layout.rightX - 25" y="4"
                  font-size="13" font-weight="800" :fill="color" font-style="italic" text-anchor="end">
              {{ seg.interval || '20' }}-{{ seg.intervalMax || '25' }}хв
            </text>
          </g>

          <!-- Clickable Overlay for Zooming -->
          <rect :x="layout.rightX - 30"
                :y="layout.rightNodeY[i]"
                width="60"
                :height="layout.rightNodeY[i+1] - layout.rightNodeY[i]"
                fill="transparent"
                style="cursor: pointer;"
                @click="zoomToSegment('right', i)" />

          <!-- Segment Stops -->
          <g class="anim-row stop-item" v-for="(stop, stIdx) in seg.stops" :key="'rstop-' + stop.id"
             :style="{ transform: `translate(0px, ${layout.rightNodeY[i] + 45 + stIdx * 32}px)` }">
            <line :x1="layout.rightX" y1="0"
                  :x2="layout.rightX + 12" y2="0"
                  :stroke="color" stroke-width="4.5" stroke-linecap="square"/>
            <text :x="layout.rightX + 18" y="4"
                  font-size="12" font-weight="700" fill="#111827"
                  style="pointer-events:none;">
              {{ stop.name }}
            </text>
          </g>

          <!-- "+ Додати зупинку" Pill (Normal Mode) -->
          <g v-if="editable && !localBranchMode" class="anim-row"
             :style="{ transform: `translate(0px, ${layout.getRightAddStopY(seg, layout.rightNodeY[i], layout.rightNodeY[i+1], i === layout.rightSegments.length - 1)}px)` }"
             style="cursor:pointer; opacity:0.9"
             @click.stop="$emit('add-stop', segments.indexOf(seg), 'right')">
            <rect :x="layout.rightX + 18" y="-13"
                  width="150" height="26" rx="13"
                  fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
            <text :x="layout.rightX + 18 + 75" y="4"
                  font-size="10" font-weight="700" fill="#4b5563" text-anchor="middle"
                  style="pointer-events:none;">+ Додати зупинку</text>
          </g>

          <!-- "+ Додати розгалудження" Pill (Branch Mode) -->
          <g v-if="editable && localBranchMode && !hasBranchForSeg(segments.indexOf(seg))" class="anim-row"
             :style="{ transform: `translate(0px, ${layout.getRightAddBranchY(seg, layout.rightNodeY[i], layout.rightNodeY[i+1], i === layout.rightSegments.length - 1)}px)` }"
             style="cursor:pointer; opacity:0.9"
             @click.stop="$emit('add-branch', segments.indexOf(seg))">
            <rect :x="layout.rightX + 18" y="-13"
                  width="190" height="26" rx="13"
                  fill="#8b5cf6" stroke="#ffffff" stroke-width="1.5"/>
            <text :x="layout.rightX + 18 + 95" y="4"
                  font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle"
                  style="pointer-events:none;">+ Додати розгалудження</text>
          </g>

          <!-- Right Branches for this Segment -->
          <template v-for="(br, brIdx) in branchesForSeg(segments.indexOf(seg))" :key="'rbr-' + br.id">
            <path v-if="br.finished"
                  :d="getRightBranchFinishedPath(br, i).d"
                  fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>
            <path v-else
                  :d="`M ${layout.rightX} ${layout.rightNodeY[i] + 40 + brIdx * 400}
                       L ${layout.rightX} ${layout.rightNodeY[i] + 40 + brIdx * 400 + 10}
                       A 15 15 0 0 0 ${layout.rightX + 15} ${layout.rightNodeY[i] + 40 + brIdx * 400 + 25}
                       L ${layout.rightX + 30} ${layout.rightNodeY[i] + 40 + brIdx * 400 + 25}
                       A 15 15 0 0 1 ${layout.rightX + 45} ${layout.rightNodeY[i] + 40 + brIdx * 400 + 40}
                       L ${layout.rightX + 45} ${layout.rightNodeY[i] + 40 + brIdx * 400 + 40 + ((br.nodes?.length||0) + 1) * 140}`"
                  fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>

            <!-- Branch Control Nodes -->
            <template v-for="(bNode, bNIdx) in br.nodes || []" :key="'rbrn-' + bNode.id">
              <circle :cx="layout.rightX + 45"
                      :cy="layout.rightNodeY[i] + 40 + (br.finished ? (65 + (bNIdx + 1) * 140) : (brIdx * 400 + 40 + (bNIdx + 1) * 140))"
                      r="9" fill="#ffffff" :stroke="color" stroke-width="3"/>
              <text :x="layout.rightX + 63"
                    :y="layout.rightNodeY[i] + 40 + (br.finished ? (65 + (bNIdx + 1) * 140) : (brIdx * 400 + 40 + (bNIdx + 1) * 140)) + 4"
                    font-size="13" font-weight="800" fill="#111827"
                    style="pointer-events:none;">{{ bNode.name }}</text>
            </template>

            <!-- Branch Stops (Per Section) -->
            <template v-for="secIdx in ((br.nodes?.length||0) + 1)" :key="'rbrsec-' + secIdx">
              <template v-for="(bStop, bStIdx) in (br.sections?.[secIdx - 1]?.stops || (secIdx === 1 ? br.stops : []))" :key="'rbrst-' + bStop.id">
                <line :x1="layout.rightX + 45"
                      :y1="layout.rightNodeY[i] + 40 + (br.finished ? (65 + (secIdx - 1) * 140 + 40 + bStIdx * 30) : (brIdx * 400 + 40 + (secIdx - 1) * 140 + 40 + bStIdx * 30))"
                      :x2="layout.rightX + 45 + 12"
                      :y2="layout.rightNodeY[i] + 40 + (br.finished ? (65 + (secIdx - 1) * 140 + 40 + bStIdx * 30) : (brIdx * 400 + 40 + (secIdx - 1) * 140 + 40 + bStIdx * 30))"
                      :stroke="color" stroke-width="4.5" stroke-linecap="square"/>
                <text :x="layout.rightX + 45 + 18"
                      :y="layout.rightNodeY[i] + 40 + (br.finished ? (65 + (secIdx - 1) * 140 + 40 + bStIdx * 30) : (brIdx * 400 + 40 + (secIdx - 1) * 140 + 40 + bStIdx * 30)) + 4"
                      font-size="12" font-weight="700" fill="#111827"
                      style="pointer-events:none;">{{ bStop.name }}</text>
              </template>

              <!-- "+ Додати зупинку" button for THIS section (Normal Mode) -->
              <g v-if="editable && !localBranchMode" style="cursor:pointer; opacity:0.9"
                 @click.stop="$emit('add-branch-stop', br.id, secIdx - 1)">
                <rect :x="layout.rightX + 45 + 18"
                      :y="layout.rightNodeY[i] + 40 + (br.finished ? (65 + (secIdx - 1) * 140 + 70) : (brIdx * 400 + 40 + (secIdx - 1) * 140 + 70)) - 13"
                      width="135" height="26" rx="13"
                      fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
                <text :x="layout.rightX + 45 + 18 + 67.5"
                      :y="layout.rightNodeY[i] + 40 + (br.finished ? (65 + (secIdx - 1) * 140 + 70) : (brIdx * 400 + 40 + (secIdx - 1) * 140 + 70)) + 4"
                      font-size="10" font-weight="700" fill="#4b5563" text-anchor="middle"
                      style="pointer-events:none;">+ Додати зупинку</text>
              </g>
            </template>

            <!-- Branch Endpoint Circle -->
            <circle :cx="layout.rightX + 180"
                    :cy="layout.rightNodeY[i] + 40 + (br.finished ? (65 + ((br.nodes?.length||0) + 1) * 140) : (brIdx * 400 + 65 + ((br.nodes?.length||0) + 1) * 140))"
                    r="9" fill="#ffffff" :stroke="color" stroke-width="3"/>
            <!-- Branch Endpoint Label -->
            <text :x="layout.rightX + 180"
                  :y="layout.rightNodeY[i] + 40 + (br.finished ? (65 + ((br.nodes?.length||0) + 1) * 140) : (brIdx * 400 + 65 + ((br.nodes?.length||0) + 1) * 140)) + layout.END_R + 16"
                  font-size="13" font-weight="800" fill="#111827" text-anchor="middle"
                  style="pointer-events:none;">Контрольна точка</text>
          </template>
        </template>

        <!-- ── LEFT RAIL & SEGMENTS ── -->
        <template v-for="(seg, i) in layout.leftSegments" :key="'lseg-' + seg.id">
          <!-- Interval Badge (Inside Oval, e.g. 20-25хв) -->
          <g class="anim-row" :style="{ transform: `translate(0px, ${(layout.leftNodeY[i] + layout.leftNodeY[i+1]) / 2}px)` }" style="pointer-events:none;">
            <text :x="layout.leftX + 25" y="4"
                  font-size="13" font-weight="800" :fill="color" font-style="italic">
              {{ seg.interval || '20' }}-{{ seg.intervalMax || '25' }}хв
            </text>
          </g>

          <!-- Clickable Overlay for Zooming -->
          <rect :x="layout.leftX - 30"
                :y="layout.leftNodeY[i]"
                width="60"
                :height="layout.leftNodeY[i+1] - layout.leftNodeY[i]"
                fill="transparent"
                style="cursor: pointer;"
                @click="zoomToSegment('left', i)" />

          <!-- Segment Stops -->
          <g class="anim-row stop-item-left" v-for="(stop, stIdx) in seg.stops" :key="'lstop-' + stop.id"
             :style="{ transform: `translate(0px, ${layout.leftNodeY[i] + 90 + (seg.stops.length - 1 - stIdx) * 32}px)` }">
            <line :x1="layout.leftX" y1="0"
                  :x2="layout.leftX - 12" y2="0"
                  :stroke="color" stroke-width="4.5" stroke-linecap="square"/>
            <text :x="layout.leftX - 18" y="4"
                  font-size="12" font-weight="700" fill="#111827" text-anchor="end"
                  style="pointer-events:none;">
              {{ stop.name }}
            </text>
          </g>

          <!-- "+ Додати зупинку" Pill (Normal Mode) -->
          <g v-if="editable && !localBranchMode" class="anim-row"
             :style="{ transform: `translate(0px, ${layout.getLeftAddStopY(seg, layout.leftNodeY[i], layout.leftNodeY[i+1], i === layout.leftSegments.length - 1)}px)` }"
             style="cursor:pointer; opacity:0.9"
             @click.stop="$emit('add-stop', segments.indexOf(seg), 'left')">
            <rect :x="layout.leftX - 18 - 150" y="-13"
                  width="150" height="26" rx="13"
                  fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
            <text :x="layout.leftX - 18 - 75" y="4"
                  font-size="10" font-weight="700" fill="#4b5563" text-anchor="middle"
                  style="pointer-events:none;">+ Додати зупинку</text>
          </g>

          <!-- "+ Додати розгалудження" Pill (Branch Mode) -->
          <g v-if="editable && localBranchMode && !hasBranchForSeg(segments.indexOf(seg))" class="anim-row"
             :style="{ transform: `translate(0px, ${layout.getLeftAddBranchY(seg, layout.leftNodeY[i], layout.leftNodeY[i+1], i === layout.leftSegments.length - 1)}px)` }"
             style="cursor:pointer; opacity:0.9"
             @click.stop="$emit('add-branch', segments.indexOf(seg))">
            <rect :x="layout.leftX - 18 - 190" y="-13"
                  width="190" height="26" rx="13"
                  fill="#8b5cf6" stroke="#ffffff" stroke-width="1.5"/>
            <text :x="layout.leftX - 18 - 95" y="4"
                  font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle"
                  style="pointer-events:none;">+ Додати розгалудження</text>
          </g>

          <!-- Left Branches for this Segment -->
          <template v-for="(br, brIdx) in branchesForSeg(segments.indexOf(seg))" :key="'lbr-' + br.id">
            <path v-if="br.finished"
                  :d="getLeftBranchFinishedPath(br, i).d"
                  fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>
            <path v-else
                  :d="`M ${layout.leftX} ${layout.leftNodeY[i+1] - 40 - brIdx * 400}
                       L ${layout.leftX} ${layout.leftNodeY[i+1] - 40 - brIdx * 400 - 10}
                       A 15 15 0 0 0 ${layout.leftX - 15} ${layout.leftNodeY[i+1] - 40 - brIdx * 400 - 25}
                       L ${layout.leftX - 30} ${layout.leftNodeY[i+1] - 40 - brIdx * 400 - 25}
                       A 15 15 0 0 1 ${layout.leftX - 45} ${layout.leftNodeY[i+1] - 40 - brIdx * 400 - 40}
                       L ${layout.leftX - 45} ${layout.leftNodeY[i+1] - 40 - brIdx * 400 - 40 - ((br.nodes?.length||0) + 1) * 140}`"
                  fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>

            <!-- Branch Control Nodes -->
            <template v-for="(bNode, bNIdx) in br.nodes || []" :key="'lbrn-' + bNode.id">
              <circle :cx="layout.leftX - 45"
                      :cy="layout.leftNodeY[i+1] - 40 - (br.finished ? (65 + (bNIdx + 1) * 140) : (brIdx * 400 + 40 + (bNIdx + 1) * 140))"
                      r="9" fill="#f5f5f5" :stroke="color" stroke-width="3"/>
              <text :x="layout.leftX - 63"
                    :y="layout.leftNodeY[i+1] - 40 - (br.finished ? (65 + (bNIdx + 1) * 140) : (brIdx * 400 + 40 + (bNIdx + 1) * 140)) + 4"
                    font-size="13" font-weight="800" fill="#111827" text-anchor="end"
                    style="pointer-events:none;">{{ bNode.name }}</text>
            </template>
          </template>
        </template>

        <!-- ── MAIN CONTROL NODES & INWARD CONNECTING LINES ── -->
        <g v-for="(node, idx) in controlNodes" :key="'cnode-' + node.id" class="anim-row"
           :style="{ transform: `translate(0px, ${getNodeY(node.id)}px)` }">
          <!-- Direction Arrow for Control Node (Gradient Stripe Style) -->
          <defs>
            <linearGradient id="arrow-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0.5" />
            </linearGradient>
          </defs>
          <g v-if="node.side === 'left'" :transform="`translate(${layout.leftX}, -25) rotate(-90)`">
            <!-- White body with gradient -->
            <polygon points="0,-4.5 42,-4.5 50,0 42,4.5 0,4.5" fill="url(#arrow-fade)" />
            <!-- Route-colored cutout at the base -->
            <polygon points="0,-4.5 8,0 0,4.5" :fill="color" />
          </g>
          <g v-else :transform="`translate(${layout.rightX}, 25) rotate(90)`">
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
            {{ (node.type === 'end' || node.isTerminus) && node.terminusStop ? node.terminusStop : node.name }} <tspan font-size="13" font-weight="800" font-style="italic" :fill="color">{{ nodeTravelTimes[node.id] || 0 }} хв</tspan>
          </text>
          <text v-else
                :x="layout.rightX + 18" y="4"
                font-size="13" font-weight="800" fill="#111827" style="pointer-events:none;">
            {{ (node.type === 'end' || node.isTerminus) && node.terminusStop ? node.terminusStop : node.name }} <tspan font-size="13" font-weight="800" font-style="italic" :fill="color">{{ nodeTravelTimes[node.id] || 0 }} хв</tspan>
          </text>
          
          <!-- Icons for side termini (placed INSIDE the oval) -->
          <g v-if="node.isTerminus && getTerminusIcons(node).length > 0" :transform="`translate(${node.side === 'left' ? layout.leftX + 32 : layout.rightX - 52}, -6)`">
            <g v-for="(icon, i) in getTerminusIcons(node)" :key="icon.id" :transform="`translate(${node.side === 'left' ? (i * 24) : (-i * 24)}, 0)`">
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
             :style="{ transform: `translate(0px, ${rightAddNodeY}px)` }"
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
             :style="{ transform: `translate(0px, ${leftAddNodeY}px)` }"
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
  const t = 0.5; // rad (50px arc length)
  const dx = Math.cos(t) * R;
  const dy = Math.sin(t) * R;
  const tDeg = t * (180 / Math.PI); // 28.65 deg

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

const emit = defineEmits([
  'add-stop', 'remove-stop',
  'add-node', 'remove-node',
  'add-branch', 'add-sub-branch', 'finish-branch',
  'add-branch-node', 'add-branch-stop',
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

function getRightBranchFinishedPath(br, i) {
  if (!layout.value) return { d: '', arrowY: 0 };
  const nodesArr = br.nodes || [];
  const nodeCount = nodesArr.length;
  const startY = layout.value.rightNodeY[i] + 40;
  const BRANCH_DX = 45;
  
  const subBrs = subBranches(br.id);
  const subBrPadding = subBrs.reduce((acc, sb) => acc + 220 + (sb.nodes ? sb.nodes.length : 0) * 140, 0);
  
  const lastNodeY = startY + 40 + (nodeCount + 1) * 140 + subBrPadding;
  
  const turnY = lastNodeY + 40;
  const mergeY = turnY + 15;
  return {
    d: `M ${layout.value.rightX} ${startY}
        L ${layout.value.rightX} ${startY + 10}
        A 15 15 0 0 0 ${layout.value.rightX + 15} ${startY + 25}
        L ${layout.value.rightX + 30} ${startY + 25}
        A 15 15 0 0 1 ${layout.value.rightX + BRANCH_DX} ${startY + 40}
        L ${layout.value.rightX + BRANCH_DX} ${turnY}
        A 15 15 0 0 1 ${layout.value.rightX + 30} ${mergeY}
        L ${layout.value.rightX + 15} ${mergeY}
        A 15 15 0 0 0 ${layout.value.rightX} ${mergeY + 15}`,
    arrowY: mergeY + 15
  };
}

function getLeftBranchFinishedPath(br, i) {
  if (!layout.value) return { d: '', arrowY: 0 };
  const nodesArr = br.nodes || [];
  const nodeCount = nodesArr.length;
  const startY = layout.value.leftNodeY[i+1] - 40;
  const BRANCH_DX = 45;
  
  const subBrs = subBranches(br.id);
  const subBrPadding = subBrs.reduce((acc, sb) => acc + 220 + (sb.nodes ? sb.nodes.length : 0) * 140, 0);
  
  const lastNodeY = startY - 40 - (nodeCount + 1) * 140 - subBrPadding;
  const turnY = lastNodeY - 40;
  const mergeY = turnY - 15;
  return {
    d: `M ${layout.value.leftX} ${startY}
        L ${layout.value.leftX} ${startY - 10}
        A 15 15 0 0 0 ${layout.value.leftX - 15} ${startY - 25}
        L ${layout.value.leftX - 30} ${startY - 25}
        A 15 15 0 0 1 ${layout.value.leftX - BRANCH_DX} ${startY - 40}
        L ${layout.value.leftX - BRANCH_DX} ${turnY}
        A 15 15 0 0 0 ${layout.value.leftX - 30} ${mergeY}
        L ${layout.value.leftX - 15} ${mergeY}
        A 15 15 0 0 1 ${layout.value.leftX} ${mergeY - 15}`,
    arrowY: mergeY - 15
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
