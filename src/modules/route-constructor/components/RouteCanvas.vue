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
          <stop offset="100%" :stop-color="color" stop-opacity="0.08" />
        </linearGradient>
        <linearGradient id="interval-fade-left" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" :stop-color="color" stop-opacity="0.08" />
          <stop offset="100%" :stop-color="color" stop-opacity="0" />
        </linearGradient>

        <!-- Masks for diffused termination strictly where rails meet the circular caps -->
        <linearGradient id="vfade-top-arc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="25%" stop-color="#ffffff" stop-opacity="1" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="1" />
        </linearGradient>

        <mask id="interval-top-arc-mask" maskContentUnits="objectBoundingBox">
          <rect x="0" y="0" width="1" height="1" fill="url(#vfade-top-arc)" />
        </mask>

        <linearGradient id="vfade-bot-arc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
          <stop offset="75%" stop-color="#ffffff" stop-opacity="1" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>

        <mask id="interval-bot-arc-mask" maskContentUnits="objectBoundingBox">
          <rect x="0" y="0" width="1" height="1" fill="url(#vfade-bot-arc)" />
        </mask>

        <!-- Feather filter to disperse and dissolve edges naturally -->
        <filter id="interval-diffuse-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>

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

        <!-- ── "+ Додати ділянку" BUTTON ON RIGHT RAIL ── -->
        <g :style="{ opacity: (editable && !localBranchMode) ? 1 : 0, pointerEvents: (editable && !localBranchMode) ? 'auto' : 'none', transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }">
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
            <g :transform="'translate(' + (layout.rightX - 5.3) + ', -5.3)'" fill="#6b7280" style="pointer-events:none;">
              <path transform="scale(0.55)" d="M1.00195 8.36719H6.36328V13.7285C6.36328 14.2734 6.81152 14.7305 7.36523 14.7305C7.91895 14.7305 8.36719 14.2734 8.36719 13.7285V8.36719H13.7285C14.2734 8.36719 14.7305 7.91895 14.7305 7.36523C14.7305 6.81152 14.2734 6.36328 13.7285 6.36328H8.36719V1.00195C8.36719 0.457031 7.91895 0 7.36523 0C6.81152 0 6.36328 0.457031 6.36328 1.00195V6.36328H1.00195C0.457031 6.36328 0 6.81152 0 7.36523C0 7.91895 0.457031 8.36719 1.00195 8.36719Z" />
            </g>
            <text :x="layout.rightX + 22" y="4"
                  font-size="12" font-weight="700" fill="#6b7280" style="pointer-events:none;">Додати ділянку</text>
          </g>
        </g>
        <!-- ── "+ Додати ділянку" BUTTON ON LEFT RAIL ── -->
        <g :style="{ opacity: (editable && !localBranchMode) ? 1 : 0, pointerEvents: (editable && !localBranchMode) ? 'auto' : 'none', transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }">
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
            <g :transform="'translate(' + (layout.leftX - 5.3) + ', -5.3)'" fill="#6b7280" style="pointer-events:none;">
              <path transform="scale(0.55)" d="M1.00195 8.36719H6.36328V13.7285C6.36328 14.2734 6.81152 14.7305 7.36523 14.7305C7.91895 14.7305 8.36719 14.2734 8.36719 13.7285V8.36719H13.7285C14.2734 8.36719 14.7305 7.91895 14.7305 7.36523C14.7305 6.81152 14.2734 6.36328 13.7285 6.36328H8.36719V1.00195C8.36719 0.457031 7.91895 0 7.36523 0C6.81152 0 6.36328 0.457031 6.36328 1.00195V6.36328H1.00195C0.457031 6.36328 0 6.81152 0 7.36523C0 7.91895 0.457031 8.36719 1.00195 8.36719Z" />
            </g>
            <text :x="layout.leftX - 22" y="4"
                  font-size="12" font-weight="700" fill="#6b7280" text-anchor="end" style="pointer-events:none;">Додати ділянку</text>
          </g>
        </g>

        <!-- Top Semicircular Cap (Left to Right arc bowing UP) -->
        <path :d="'M ' + layout.leftX + ' ' + layout.topY + ' A ' + layout.CAP_R + ' ' + layout.CAP_R + ' 0 0 1 ' + layout.rightX + ' ' + layout.topY"
              fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>


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
          <!-- Extra long horizontal spur line on curve extending right -->
          <line :x1="0" :y1="layout.topY - layout.CAP_R" :x2="65" :y2="layout.topY - layout.CAP_R"
                :stroke="color" :stroke-width="layout.RAIL_W" stroke-linecap="round"
                :style="{ opacity: (localBranchMode && !nodeHasBranch(firstNode)) ? 1 : 0, transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }" />
          <circle :cx="0" :cy="layout.topY - layout.CAP_R" r="9"
                  fill="#f5f5f5" :stroke="firstNode.isTerminus ? '#111827' : color" :stroke-width="firstNode.isTerminus ? 4 : 3.5"
                  :class="{ 'terminus-added': firstNode.isTerminus }" />
          <text :x="0" :y="layout.topY - layout.CAP_R - 16"
                font-size="13" font-weight="700" fill="#111827" text-anchor="middle"
                style="pointer-events:none;">
            <tspan>{{ firstNode.isTerminus ? (firstNode.terminusStop || firstNode.name) : firstNode.name }} </tspan><tspan dx="8" font-size="13" font-weight="700" font-style="italic" :fill="color">{{ nodeTravelTimes[firstNode.id] || 0 }} хв</tspan>
          </text>
          <!-- Icons below top terminus circle -->
          <g v-if="firstNode.isTerminus" :transform="'translate(0, ' + (layout.topY - layout.CAP_R + 22) + ')'">
            <g v-for="(icon, i) in getTerminusIcons(firstNode)" :key="icon.id" :transform="'translate(' + (i * 24 - (getTerminusIcons(firstNode).length - 1) * 12) + ', 0)'">
              <SvgIcon :name="icon.id" :x="icon.x" :y="icon.y" :width="icon.w" :height="icon.h" class="text-gray-800" />
            </g>
          </g>
          <!-- Branch Addition Button at Top Terminus (65px Horizontal Right) -->
          <g :style="{ opacity: (localBranchMode && !nodeHasBranch(firstNode)) ? 1 : 0, transform: 'translate(65px, ' + (layout.topY - layout.CAP_R) + 'px) scale(' + ((localBranchMode && !nodeHasBranch(firstNode)) ? 1 : 0.5) + ')', transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)', pointerEvents: (localBranchMode && !nodeHasBranch(firstNode)) ? 'auto' : 'none' }"
             style="cursor:pointer;" @click.stop="$emit('add-branch', 0)">
            <circle cx="0" cy="0" r="9" fill="#f5f5f5" :stroke="color" stroke-width="3.5" class="shadow-sm transition"/>
            <SvgIcon name="plus" :x="-5" :y="-5" :width="10" :height="10" class="text-gray-900 pointer-events-none" />
          </g>
        </g>

        <!-- ── BOTTOM CAP & TERMINUS GROUP ── -->
        <g class="bottom-cap-group anim-row" :style="{ transform: 'translate(0px, ' + layout.botY + 'px)' }">
          <!-- Bottom Semicircular Cap (Left to Right arc bowing DOWN) -->
          <path :d="'M ' + layout.leftX + ' 0 A ' + layout.CAP_R + ' ' + layout.CAP_R + ' 0 0 0 ' + layout.rightX + ' 0'"
                fill="none" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>


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
            <!-- Extra long horizontal spur line on curve extending LEFT (-65px) -->
            <line :x1="0" :y1="layout.CAP_R" :x2="-65" :y2="layout.CAP_R"
                  :stroke="color" :stroke-width="layout.RAIL_W" stroke-linecap="round"
                  :style="{ opacity: (localBranchMode && !nodeHasBranch(lastNode)) ? 1 : 0, transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }" />
            <circle :cx="0" :cy="layout.CAP_R" r="9"
                    fill="#f5f5f5" :stroke="lastNode.isTerminus ? '#111827' : color" :stroke-width="lastNode.isTerminus ? 4 : 3.5"
                    :class="{ 'terminus-added': lastNode.isTerminus }" />
            <text :x="0" :y="layout.CAP_R + 24"
                  font-size="13" font-weight="700" fill="#111827" text-anchor="middle"
                  style="pointer-events:none;">
              <tspan>{{ lastNode.isTerminus ? (lastNode.terminusStop || lastNode.name) : lastNode.name }} </tspan><tspan dx="8" font-size="13" font-weight="700" font-style="italic" :fill="color">{{ nodeTravelTimes[lastNode.id] || 0 }} хв</tspan>
            </text>
            <!-- Icons above bottom terminus circle -->
            <g v-if="lastNode.isTerminus" :transform="'translate(0, ' + (layout.CAP_R - 22) + ')'">
              <g v-for="(icon, i) in getTerminusIcons(lastNode)" :key="icon.id" :transform="'translate(' + (i * 24 - (getTerminusIcons(lastNode).length - 1) * 12) + ', 0)'">
                <SvgIcon :name="icon.id" :x="icon.x" :y="icon.y" :width="icon.w" :height="icon.h" class="text-gray-800" />
              </g>
            </g>
            <!-- Branch Addition Button at Bottom Terminus (65px Horizontal Left) -->
            <g :style="{ opacity: (localBranchMode && !nodeHasBranch(lastNode)) ? 1 : 0, transform: 'translate(-65px, ' + (layout.CAP_R) + 'px) scale(' + ((localBranchMode && !nodeHasBranch(lastNode)) ? 1 : 0.5) + ')', transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)', pointerEvents: (localBranchMode && !nodeHasBranch(lastNode)) ? 'auto' : 'none' }"
               style="cursor:pointer;" @click.stop="$emit('add-branch', segments.length - 1)">
              <circle cx="0" cy="0" r="9" fill="#f5f5f5" :stroke="color" stroke-width="3.5" class="shadow-sm transition"/>
              <SvgIcon name="plus" :x="-5" :y="-5" :width="10" :height="10" class="text-gray-900 pointer-events-none" />
            </g>
          </g>
        </g>

        <!-- ── RIGHT RAIL & SEGMENTS ── -->
        <template v-for="(seg, i) in layout.rightSegments" :key="'rseg-' + seg.id">


          <!-- Interval Gradient & Badge (Inside Oval, e.g. 20-25хв) -->
          <template v-if="!hasQuestionBranch(seg)">
            <rect :x="layout.rightX - 80"
                  :y="layout.rightNodeY[i]"
                  width="80"
                  :height="layout.rightNodeY[i+1] - layout.rightNodeY[i]"
                  :rx="i === 0 || i === layout.rightSegments.length - 1 ? 12 : 6"
                  fill="url(#interval-fade-right)"
                  :mask="i === 0 ? 'url(#interval-top-arc-mask)' : (i === layout.rightSegments.length - 1 ? 'url(#interval-bot-arc-mask)' : undefined)"
                  :filter="i === 0 || i === layout.rightSegments.length - 1 ? 'url(#interval-diffuse-blur)' : undefined"
                  style="pointer-events:none;" />
            <g class="anim-row" :style="{ transform: 'translate(0px, ' + layout.getRightIntervalY(seg, layout.rightNodeY[i], layout.rightNodeY[i+1], i === layout.rightSegments.length - 1, segments.indexOf(seg)) + 'px)' }" style="pointer-events:none;">
              <text :x="layout.rightX - 25" y="4"
                    font-size="13" font-weight="800" :fill="color" font-style="italic" text-anchor="end">
                {{ (seg.interval && seg.interval !== '0' && seg.interval !== 0 ? seg.interval : '20') + '-' + (seg.intervalMax || '25') + 'хв' }}
              </text>
            </g>
          </template>

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
             :style="{ transform: 'translate(0px, ' + layout.stopY(seg, layout.rightNodeY[i], layout.rightNodeY[i+1], stIdx, i === layout.rightSegments.length - 1, segments.indexOf(seg)) + 'px)' }"
             style="cursor:pointer;"
             @click.stop="zoomToSegment('right', i)">
            <line :x1="layout.rightX" y1="0"
                  :x2="layout.rightX + 12" y2="0"
                  :stroke="color" stroke-width="4.5" stroke-linecap="square"/>
            <text :x="layout.rightX + 18" y="4"
                  font-size="12" font-weight="500" fill="#111827">
              <template v-if="splitStopName(stop.name).length > 1">
                <tspan :x="layout.rightX + 18" dy="0">{{ splitStopName(stop.name)[0] }}</tspan>
                <tspan :x="layout.rightX + 18" dy="16">{{ splitStopName(stop.name)[1] }}</tspan>
              </template>
              <template v-else>
                {{ stop.name }}
              </template>
            </text>
          </g>



          <!-- Unified Add Pills (Right Rail) -->
          <template v-if="editable && !localBranchMode">
            <template v-for="pill in layout.getSegmentPills(seg, i, true)" :key="'rpill-' + pill.id">
              <g class="anim-row" :style="{ transform: 'translate(0px, ' + pill.y + 'px)' }">
                <rect :x="layout.rightX + 18" y="-14" :width="(!isPillSinglePlus('right', seg, i, pill) && activeExpandedPill === ('right-' + segments.indexOf(seg) + '-' + pill.id)) ? 78 : 64" height="28" rx="14"
                      fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"
                      style="box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);" />
                
                <!-- Left Sub-button: Add Stop -->
                <g style="cursor:pointer;" :title="pill.title || 'Додати зупинку'" @click.stop="$emit('add-stop', segments.indexOf(seg), 'right', pill.insertIdx, pill.isAfterMerge)">
                  <rect :x="layout.rightX + 18" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                  <g :transform="'translate(' + (layout.rightX + 30.5) + ', -7)'" fill="#4b5563">
                    <path transform="scale(0.5)" d="M5.78869 27.4289C6.5345 27.4289 7.07691 26.9543 7.07691 26.0616V17.3943C7.07691 17.0101 7.25772 16.7841 7.56282 16.7841C7.86793 16.7841 8.06003 17.0101 8.06003 17.3943V26.0616C8.06003 26.9543 8.60244 27.4289 9.34826 27.4289ZM10.0828 27.4289 10.6252 26.9543 10.6252 26.0616V11.4165C10.6252 11.1114 10.7721 10.9306 11.0207 10.9306C11.258 10.9306 11.4162 11.1114 11.4162 11.4165V17.4282C11.4162 18.2305 11.8908 18.6825 12.5688 18.6825C13.2468 18.6825 13.7101 18.2305 13.7101 17.4282V11.5521C13.7101 7.9699 11.6874 7.04328 7.67583 7.04328H5.93559C5.15588 7.04328 4.76037 6.93027 4.13885 6.47827L2.64723 5.42735L2.37602 1.20106C2.31952 0.387446 1.79971 -0.0419624 1.1217 0.00323846C0.432382 0.0371391 -0.0422274 0.534349 0.00297345 1.33666L0.274179 5.52905C0.33068 6.44437 0.692287 6.97548 1.2573 7.39358L3.96935 9.37112C4.36486 9.65363 4.50046 10.0039 4.50046 10.4559V26.0616C4.50046 26.9543 5.05417 27.4289 5.78869 27.4289ZM7.67583 5.91325C9.17875 5.91325 10.3879 4.67023 10.3879 3.2125C10.3879 1.70957 9.17875 0.489148 7.67583 0.489148C6.16159 0.489148 4.97507 1.70957 4.97507 3.2125C4.97507 4.69283 6.16159 5.91325 7.67583 5.91325Z"/>
                  </g>
                </g>

                <!-- Vertical Divider 1 -->
                <line :x1="layout.rightX + 50" y1="-10" :x2="layout.rightX + 50" y2="10" stroke="#9ca3af" stroke-width="1" />

                <!-- COLLAPSED / SINGLE PLUS: Plus Icon -->
                <g v-if="isPillSinglePlus('right', seg, i, pill) || activeExpandedPill !== ('right-' + segments.indexOf(seg) + '-' + pill.id)" style="cursor:pointer;" title="Додати контрольну точку" @click.stop="isPillSinglePlus('right', seg, i, pill) ? handleAddNode('right', segments.indexOf(seg), 'before', pill) : togglePillExpand('right-' + segments.indexOf(seg) + '-' + pill.id)">
                  <rect :x="layout.rightX + 50" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                  <g :transform="'translate(' + (layout.rightX + 60.7) + ', -5.3)'" fill="#4b5563">
                    <path transform="scale(0.7)" d="M1.00195 8.36719H6.36328V13.7285C6.36328 14.2734 6.81152 14.7305 7.36523 14.7305C7.91895 14.7305 8.36719 14.2734 8.36719 13.7285V8.36719H13.7285C14.2734 8.36719 14.7305 7.91895 14.7305 7.36523C14.7305 6.81152 14.2734 6.36328 13.7285 6.36328H8.36719V1.00195C8.36719 0.457031 7.91895 0 7.36523 0C6.81152 0 6.36328 0.457031 6.36328 1.00195V6.36328H1.00195C0.457031 6.36328 0 6.81152 0 7.36523C0 7.91895 0.457031 8.36719 1.00195 8.36719Z" />
                  </g>
                </g>

                <!-- EXPANDED: Two Arrow Options (Only for intermediate segments without merges/branches) -->
                <g v-else>
                  <!-- Option 1: Insert Before End (Straight Arrow) -->
                  <g style="cursor:pointer;" title="Вставити перед контрольною кінця ділянки" @click.stop="handleAddNode('right', segments.indexOf(seg), 'before', pill)">
                    <rect :x="layout.rightX + 50" y="-14" width="23" height="28" fill="transparent"/>
                    <g :transform="'translate(' + (layout.rightX + 59.1) + ', -4.1)'" fill="#4b5563">
                      <path transform="scale(0.58)" d="M0 6.82031C0 7.08398 0.114258 7.34766 0.316406 7.54102L6.11719 13.333C6.32812 13.5352 6.55664 13.6318 6.81152 13.6318C7.36523 13.6318 7.76953 12.3363 7.76953 12.7002C7.76953 12.4189 7.66406 12.1816 7.47949 12.0059L5.50195 10.002L2.95312 7.67285L5.00098 7.7959H15.6533C16.2334 7.7959 16.6377 7.3916 16.6377 6.82031C16.6377 6.24023 16.2334 5.83594 15.6533 5.83594H5.00098L2.96191 5.95898L5.50195 3.62988L7.47949 1.62598C7.66406 1.4502 7.76953 1.21289 7.76953 0.931641C7.76953 0.395508 7.36523 0 6.81152 0C6.55664 0 6.31934 0.0966797 6.09082 0.316406L0.316406 6.09082C0.114258 6.28418 0 6.54785 0 6.82031Z" />
                    </g>
                  </g>

                  <!-- Option 2: Insert After End (Curved Arrow) -->
                  <g style="cursor:pointer;" title="Додати після цієї контрольної точки на кінці" @click.stop="handleAddNode('right', segments.indexOf(seg), 'after')">
                    <rect :x="layout.rightX + 73" y="-14" width="23" height="28" fill="transparent" rx="11.5"/>
                    <g :transform="'translate(' + (layout.rightX + 76.5) + ', -4.7)'" fill="#4b5563">
                      <path transform="scale(0.55)" d="M6.04688 16.5059C6.61816 16.5059 6.99609 16.1191 6.99609 15.5742C6.99609 15.293 6.88184 15.082 6.71484 14.9062L4.44727 12.7002L2.90039 11.3994L4.93945 11.4873H15.917C18.1143 11.4873 19.0459 10.4941 19.0459 8.34082V3.12891C19.0459 0.931641 18.1143 0 15.917 0H11.0391C10.4678 0 10.0635 0.430664 10.0635 0.958008C10.0635 1.48535 10.459 1.91602 11.0391 1.91602H15.873C16.7695 1.91602 17.1475 2.29395 17.1475 3.18164V8.2793C17.1475 9.18457 16.7607 9.5625 15.873 9.5625H4.93945L2.90039 9.65918L4.44727 8.34961L6.71484 6.14355C6.88184 5.97656 6.99609 5.76562 6.99609 5.47559C6.99609 4.93066 6.61816 4.54395 6.04688 4.54395C5.80957 4.54395 5.5459 4.64941 5.35254 4.84277L0.307617 9.80859C0.105469 10.002 0 10.2656 0 10.5293C0 10.7842 0.105469 11.0479 0.307617 11.2412L5.35254 16.2158C5.5459 16.4004 5.80957 16.5059 6.04688 16.5059Z" />
                    </g>
                  </g>
                </g>
              </g>
            </template>
          </template>

          <!-- Right Branches for this Segment -->
          <template v-for="(br, brIdx) in branchesForSeg(segments.indexOf(seg))" :key="'rbr-' + br.id">
            <path v-if="br.finished"
                  :d="getRightBranchFinishedPath(br, i).d"
                  fill="none" style="cursor:pointer;" @click.stop="selectBranchSection(br, 0, i, true)" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>
            <path v-else
                  :d="getBranchOutPath(layout.rightX, layout.rightNodeY[i], getBranchDx(br), 1, 1, getBranchEndpointY(br, i, true))"
                  fill="none" style="cursor:pointer;" @click.stop="selectBranchSection(br, 0, i, true)" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>

            <!-- Branch Direction Arrow (Right) -->
            <g class="anim-row" :style="{ transform: 'translate(' + (layout.rightX + getBranchDx(br)) + 'px, ' + (layout.rightNodeY[i] + 44) + 'px) rotate(90deg)', transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }">
              <polygon points="0,-4.5 42,-4.5 50,0 42,4.5 0,4.5" fill="url(#arrow-fade)" />
              <polygon points="0,-4.5 8,0 0,4.5" :fill="color" />
            </g>

            <!-- Finish Branch Icon (Right) - Positioned below the control node -->
            <g v-if="!br.finished" style="cursor:pointer" @click.stop="$emit('finish-branch', br.id)"
               :transform="'translate(' + (layout.rightX + getBranchDx(br) - 5) + ',' + (getBranchEndpointY(br, i, true) + 24) + ')'">
              <rect x="-5" y="-5" width="20" height="28" rx="4" fill="rgba(255,255,255,0.85)" />
              <path d="M2.88376 17.0266C3.43747 17.0266 3.76266 16.675 3.76266 16.0862V11.0061C4.76462 12.3948 6.39059 13.5022 8.42966 14.2053C9.00095 14.425 9.47555 14.135 9.64255 13.7307C9.80954 13.3352 9.68649 12.8342 9.09762 12.5618C5.9863 11.2698 3.76266 9.32739 3.76266 6.16333V4.35278H5.08981C5.75778 4.35278 5.95114 3.84302 5.55563 3.2981L3.44626 0.336182C3.12985 -0.112061 2.63766 -0.112061 2.32126 0.336182L0.211882 3.2981C-0.192415 3.84302 -0.00784427 4.35278 0.677703 4.35278H2.00485V16.0862C2.00485 16.675 2.33005 17.0266 2.88376 17.0266Z" :fill="color"/>
            </g>


            <!-- Branch Control Nodes -->
            <g v-for="(bNode, bNIdx) in br.nodes || []" :key="'rbrn-' + bNode.id" style="cursor:pointer;"
               @click.stop="$emit('edit-branch-node', br.id, bNIdx)">
              <template v-if="bNode.name && bNode.name !== 'Контрольна (альтернатива)'">
                <circle :cx="layout.rightX + getBranchDx(br)"
                        :cy="getBranchNodeY(br, bNIdx, i, true)"
                        r="9" fill="#ffffff" :stroke="color" stroke-width="3"/>
                <text :x="layout.rightX + getBranchDx(br) + 18"
                      :y="getBranchNodeY(br, bNIdx, i, true) + 4"
                      font-size="13" font-weight="700" fill="#111827">{{ bNode.name }}</text>
              </template>
            </g>

            <!-- Branch Stops (Per Section) -->
            <template v-for="secIdx in (getBranchNodesLength(br) + 1)" :key="'rbrsec-' + secIdx">
              <!-- Clickable Branch Section Overlay (Right) -->
              <rect :x="layout.rightX + getBranchDx(br) - 12"
                    :y="Math.min(getBranchSectionStartY(br, secIdx, i, true), getBranchSectionEndY(br, secIdx, i, true))"
                    width="24"
                    :height="Math.max(24, Math.abs(getBranchSectionEndY(br, secIdx, i, true) - getBranchSectionStartY(br, secIdx, i, true)))"
                    fill="transparent"
                    style="cursor: pointer;"
                    title="Налаштувати ділянку альтернативи"
                    @click.stop="selectBranchSection(br, secIdx - 1, i, true)" />

              <!-- Branch Section Interval Gradient & Badge (Right, e.g. 20-25хв) -->
              <template v-if="shouldShowBranchSectionInterval(br, secIdx)">
                <rect :x="layout.rightX + getBranchDx(br) - 80"
                      :y="getBranchGradientStartY(br, secIdx, i, true)"
                      width="80"
                      :height="getBranchGradientHeight(br, secIdx, i, true)"
                      rx="6"
                      fill="url(#interval-fade-right)"
                      style="pointer-events:none;" />
                <g class="anim-row" :style="{ transform: 'translate(0px, ' + getBranchSectionIntervalY(br, secIdx, i, true) + 'px)' }" style="pointer-events:none;">
                  <text :x="layout.rightX + getBranchDx(br) - 25" y="4"
                        font-size="13" font-weight="800" :fill="color" font-style="italic" text-anchor="end">
                    {{ getBranchSectionIntervalText(br, secIdx - 1) }}
                  </text>
                </g>
              </template>

              <g v-for="(bStop, bStIdx) in getBranchSectionStops(br, secIdx)" :key="'rbrst-' + bStop.id" style="cursor:pointer;"
                 @click.stop="selectBranchSection(br, secIdx - 1, i, true)">
                <line :x1="layout.rightX + getBranchDx(br)"
                      :y1="getBranchStopY(br, secIdx, bStIdx, i, true)"
                      :x2="layout.rightX + getBranchDx(br) + 12"
                      :y2="getBranchStopY(br, secIdx, bStIdx, i, true)"
                      :stroke="color" stroke-width="4.5" stroke-linecap="square"/>
                <text :x="layout.rightX + getBranchDx(br) + 18"
                      :y="getBranchStopY(br, secIdx, bStIdx, i, true) + 4"
                      font-size="12" font-weight="500" fill="#111827">
                  <template v-if="splitStopName(bStop.name).length > 1">
                    <tspan :x="layout.rightX + getBranchDx(br) + 18" dy="0">{{ splitStopName(bStop.name)[0] }}</tspan>
                    <tspan :x="layout.rightX + getBranchDx(br) + 18" dy="16">{{ splitStopName(bStop.name)[1] }}</tspan>
                  </template>
                  <template v-else>
                    {{ bStop.name }}
                  </template>
                </text>
              </g>
              <!-- Apple-style Unified Add Pill (Right Branch) -->
              <g class="anim-row"
                 :style="{ opacity: (editable && !localBranchMode) ? 1 : 0, pointerEvents: (editable && !localBranchMode) ? 'auto' : 'none', transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)', transform: 'translate(' + (layout.rightX + getBranchDx(br) + 16) + 'px, ' + getBranchAddStopY(br, secIdx, i, true) + 'px)' }">
                <rect x="0" y="-14" :width="(!isBranchSecSinglePlus(br, secIdx) && activeExpandedPill === ('rbr-' + br.id + '-' + secIdx)) ? 78 : 64" height="28" rx="14"
                      fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"
                      style="box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);" />
                
                <!-- Left Sub-button: Add Stop -->
                <g style="cursor:pointer;" title="Додати зупинку на альтернативі" @click.stop="$emit('add-branch-stop', br.id, secIdx - 1)">
                  <rect x="0" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                  <g transform="translate(19.5, -7)" fill="#4b5563">
                    <path transform="scale(0.5)" d="M5.78869 27.4289C6.5345 27.4289 7.07691 26.9543 7.07691 26.0616V17.3943C7.07691 17.0101 7.25772 16.7841 7.56282 16.7841C7.86793 16.7841 8.06003 17.0101 8.06003 17.3943V26.0616C8.06003 26.9543 8.60244 27.4289 9.34826 27.4289ZM10.0828 27.4289 10.6252 26.9543 10.6252 26.0616V11.4165C10.6252 11.1114 10.7721 10.9306 11.0207 10.9306C11.258 10.9306 11.4162 11.1114 11.4162 11.4165V17.4282C11.4162 18.2305 11.8908 18.6825 12.5688 18.6825C13.2468 18.6825 13.7101 18.2305 13.7101 17.4282V11.5521C13.7101 7.9699 11.6874 7.04328 7.67583 7.04328H5.93559C5.15588 7.04328 4.76037 6.93027 4.13885 6.47827L2.64723 5.42735L2.37602 1.20106C2.31952 0.387446 1.79971 -0.0419624 1.1217 0.00323846C0.432382 0.0371391 -0.0422274 0.534349 0.00297345 1.33666L0.274179 5.52905C0.33068 6.44437 0.692287 6.97548 1.2573 7.39358L3.96935 9.37112C4.36486 9.65363 4.50046 10.0039 4.50046 10.4559V26.0616C4.50046 26.9543 5.05417 27.4289 5.78869 27.4289ZM7.67583 5.91325C9.17875 5.91325 10.3879 4.67023 10.3879 3.2125C10.3879 1.70957 9.17875 0.489148 7.67583 0.489148C6.16159 0.489148 4.97507 1.70957 4.97507 3.2125C4.97507 4.69283 6.16159 5.91325 7.67583 5.91325Z"/>
                  </g>
                </g>

                <!-- Vertical Divider 1 -->
                <line x1="32" y1="-10" x2="32" y2="10" stroke="#9ca3af" stroke-width="1" />

                <!-- COLLAPSED / SINGLE PLUS: Plus Icon -->
                <g v-if="isBranchSecSinglePlus(br, secIdx) || activeExpandedPill !== ('rbr-' + br.id + '-' + secIdx)" style="cursor:pointer;" title="Додати контрольну точку" @click.stop="isBranchSecSinglePlus(br, secIdx) ? handleAddBranchNode(br.id, secIdx - 1, 'before') : togglePillExpand('rbr-' + br.id + '-' + secIdx)">
                  <rect x="32" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                  <g transform="translate(42.7, -5.3)" fill="#4b5563">
                    <path transform="scale(0.7)" d="M1.00195 8.36719H6.36328V13.7285C6.36328 14.2734 6.81152 14.7305 7.36523 14.7305C7.91895 14.7305 8.36719 14.2734 8.36719 13.7285V8.36719H13.7285C14.2734 8.36719 14.7305 7.91895 14.7305 7.36523C14.7305 6.81152 14.2734 6.36328 13.7285 6.36328H8.36719V1.00195C8.36719 0.457031 7.91895 0 7.36523 0C6.81152 0 6.36328 0.457031 6.36328 1.00195V6.36328H1.00195C0.457031 6.36328 0 6.81152 0 7.36523C0 7.91895 0.457031 8.36719 1.00195 8.36719Z" />
                  </g>
                </g>

                <!-- EXPANDED: Two Arrow Options (Right Branch) -->
                <g v-else>
                  <!-- Option 1: Add Control Node Before (Icon 1) -->
                  <g style="cursor:pointer;" title="Вставити перед на альтернативі" @click.stop="handleAddBranchNode(br.id, secIdx - 1, 'before')">
                    <rect x="32" y="-14" width="23" height="28" fill="transparent"/>
                    <g transform="translate(41.1, -4.1)" fill="#4b5563">
                      <path transform="scale(0.58)" d="M0 6.82031C0 7.08398 0.114258 7.34766 0.316406 7.54102L6.11719 13.333C6.32812 13.5352 6.55664 13.6318 6.81152 13.6318C7.36523 13.6318 7.76953 12.3363 7.76953 12.7002C7.76953 12.4189 7.66406 12.1816 7.47949 12.0059L5.50195 10.002L2.95312 7.67285L5.00098 7.7959H15.6533C16.2334 7.7959 16.6377 7.3916 16.6377 6.82031C16.6377 6.24023 16.2334 5.83594 15.6533 5.83594H5.00098L2.96191 5.95898L5.50195 3.62988L7.47949 1.62598C7.66406 1.4502 7.76953 1.21289 7.76953 0.931641C7.76953 0.395508 7.36523 0 6.81152 0C6.55664 0 6.31934 0.0966797 6.09082 0.316406L0.316406 6.09082C0.114258 6.28418 0 6.54785 0 6.82031Z" />
                    </g>
                  </g>

                  <!-- Option 2: Add Control Node After (Icon 2) -->
                  <g style="cursor:pointer;" title="Додати після на альтернативі" @click.stop="handleAddBranchNode(br.id, secIdx - 1, 'after')">
                    <rect x="55" y="-14" width="23" height="28" fill="transparent" rx="11.5"/>
                    <g transform="translate(58.5, -4.7)" fill="#4b5563">
                      <path transform="scale(0.55)" d="M6.04688 16.5059C6.61816 16.5059 6.99609 16.1191 6.99609 15.5742C6.99609 15.293 6.88184 15.082 6.71484 14.9062L4.44727 12.7002L2.90039 11.3994L4.93945 11.4873H15.917C18.1143 11.4873 19.0459 10.4941 19.0459 8.34082V3.12891C19.0459 0.931641 18.1143 0 15.917 0H11.0391C10.4678 0 10.0635 0.430664 10.0635 0.958008C10.0635 1.48535 10.459 1.91602 11.0391 1.91602H15.873C16.7695 1.91602 17.1475 2.29395 17.1475 3.18164V8.2793C17.1475 9.18457 16.7607 9.5625 15.873 9.5625H4.93945L2.90039 9.65918L4.44727 8.34961L6.71484 6.14355C6.88184 5.97656 6.99609 5.76562 6.99609 5.47559C6.99609 4.93066 6.61816 4.54395 6.04688 4.54395C5.80957 4.54395 5.5459 4.64941 5.35254 4.84277L0.307617 9.80859C0.105469 10.002 0 10.2656 0 10.5293C0 10.7842 0.105469 11.0479 0.307617 11.2412L5.35254 16.2158C5.5459 16.4004 5.80957 16.5059 6.04688 16.5059Z" />
                    </g>
                  </g>
                </g>
              </g>
            </template>
          </template>

          <!-- Direction Arrow (Gradient Stripe Style) -->
          <g v-if="i > 0" class="anim-row"
             :style="{ opacity: ((editable && !localBranchMode) || (seg.stops && seg.stops.length >= 2)) ? 1 : 0, transform: 'translate(' + layout.rightX + 'px, ' + (layout.rightNodeY[i] + 25) + 'px) rotate(90deg)', transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }"
             style="pointer-events:none;">
            <polygon points="0,-4.5 42,-4.5 50,0 42,4.5 0,4.5" fill="url(#arrow-fade)" />
            <polygon points="0,-4.5 8,0 0,4.5" :fill="color" />
          </g>
        </template>

        <!-- ── LEFT RAIL & SEGMENTS ── -->
        <template v-for="(seg, i) in layout.leftSegments" :key="'lseg-' + seg.id">


          <!-- Interval Gradient & Badge (Inside Oval, e.g. 20-25хв) -->
          <template v-if="!hasQuestionBranch(seg)">
            <rect :x="layout.leftX"
                  :y="layout.leftNodeY[i]"
                  width="80"
                  :height="layout.leftNodeY[i+1] - layout.leftNodeY[i]"
                  :rx="i === 0 || i === layout.leftSegments.length - 1 ? 12 : 6"
                  fill="url(#interval-fade-left)"
                  :mask="i === 0 ? 'url(#interval-top-arc-mask)' : (i === layout.leftSegments.length - 1 ? 'url(#interval-bot-arc-mask)' : undefined)"
                  :filter="i === 0 || i === layout.leftSegments.length - 1 ? 'url(#interval-diffuse-blur)' : undefined"
                  style="pointer-events:none;" />
            <g class="anim-row" :style="{ transform: 'translate(0px, ' + layout.getLeftIntervalY(seg, layout.leftNodeY[i], layout.leftNodeY[i+1], i === layout.leftSegments.length - 1, segments.indexOf(seg)) + 'px)' }" style="pointer-events:none;">
              <text :x="layout.leftX + 25" y="4"
                    font-size="13" font-weight="800" :fill="color" font-style="italic">
                {{ (seg.interval && seg.interval !== '0' && seg.interval !== 0 ? seg.interval : '20') + '-' + (seg.intervalMax || '25') + 'хв' }}
              </text>
            </g>
          </template>

          <!-- Clickable Overlay for Zooming -->
          <rect :x="layout.leftX - 8"
                :y="layout.leftNodeY[i]"
                width="16"
                :height="layout.leftNodeY[i+1] - layout.leftNodeY[i]"
                fill="transparent"
                style="cursor: pointer;"
                @click="zoomToSegment('left', i)" />

          <!-- Left Rail Stops -->
          <g class="anim-row stop-item" v-for="(st, stIdx) in seg.stops || []" :key="'lst-' + st.id"
             :style="{ transform: 'translate(0px, ' + layout.stopY(seg, layout.leftNodeY[i], layout.leftNodeY[i+1], stIdx, i === layout.leftSegments.length - 1, segments.indexOf(seg)) + 'px)' }"
             style="cursor:pointer;"
             @click.stop="zoomToSegment('left', i)">
            <line :x1="layout.leftX" y1="0"
                  :x2="layout.leftX - 12" y2="0"
                  :stroke="color" stroke-width="4.5" stroke-linecap="square"/>
            <text :x="layout.leftX - 18" y="4"
                  font-size="12" font-weight="500" fill="#111827" text-anchor="end">
              <template v-if="splitStopName(st.name).length > 1">
                <tspan :x="layout.leftX - 18" dy="0">{{ splitStopName(st.name)[0] }}</tspan>
                <tspan :x="layout.leftX - 18" dy="16">{{ splitStopName(st.name)[1] }}</tspan>
              </template>
              <template v-else>
                {{ st.name }}
              </template>
            </text>
          </g>
          <!-- Unified Add Pills (Left Rail) -->
          <template v-if="editable && !localBranchMode">
            <template v-for="pill in layout.getSegmentPills(seg, i, false)" :key="'lpill-' + pill.id">
              <g class="anim-row" :style="{ transform: 'translate(0px, ' + pill.y + 'px)' }">
                <rect :x="(!isPillSinglePlus('left', seg, i, pill) && activeExpandedPill === ('left-' + segments.indexOf(seg) + '-' + pill.id)) ? (layout.leftX - 96) : (layout.leftX - 82)" y="-14" :width="(!isPillSinglePlus('left', seg, i, pill) && activeExpandedPill === ('left-' + segments.indexOf(seg) + '-' + pill.id)) ? 78 : 64" height="28" rx="14"
                      fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"
                      style="box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), x 0.3s cubic-bezier(0.4, 0, 0.2, 1);" />
                
                <!-- COLLAPSED / SINGLE PLUS: Plus Icon -->
                <g v-if="isPillSinglePlus('left', seg, i, pill) || activeExpandedPill !== ('left-' + segments.indexOf(seg) + '-' + pill.id)" style="cursor:pointer;" title="Додати контрольну точку" @click.stop="isPillSinglePlus('left', seg, i, pill) ? handleAddNode('left', segments.indexOf(seg), 'before', pill) : togglePillExpand('left-' + segments.indexOf(seg) + '-' + pill.id)">
                  <rect :x="layout.leftX - 82" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                  <g :transform="'translate(' + (layout.leftX - 71.3) + ', -5.3)'" fill="#4b5563">
                    <path transform="scale(0.7)" d="M1.00195 8.36719H6.36328V13.7285C6.36328 14.2734 6.81152 14.7305 7.36523 14.7305C7.91895 14.7305 8.36719 14.2734 8.36719 13.7285V8.36719H13.7285C14.2734 8.36719 14.7305 7.91895 14.7305 7.36523C14.7305 6.81152 14.2734 6.36328 13.7285 6.36328H8.36719V1.00195C8.36719 0.457031 7.91895 0 7.36523 0C6.81152 0 6.36328 0.457031 6.36328 1.00195V6.36328H1.00195C0.457031 6.36328 0 6.81152 0 7.36523C0 7.91895 0.457031 8.36719 1.00195 8.36719Z" />
                  </g>
                </g>

                <!-- EXPANDED: Two Arrow Options (Only for non-turnaround segments) -->
                <g v-else>
                  <!-- Option 2: Add Control Node After End (Icon 2) -->
                  <g style="cursor:pointer;" title="Додати після цієї контрольної точки на кінці" @click.stop="handleAddNode('left', segments.indexOf(seg), 'after', pill)">
                    <rect :x="layout.leftX - 96" y="-14" width="23" height="28" fill="transparent" rx="11.5"/>
                    <g :transform="'translate(' + (layout.leftX - 87.5) + ', -4.7)'" fill="#4b5563">
                      <path transform="scale(0.55)" d="M6.04688 16.5059C6.61816 16.5059 6.99609 16.1191 6.99609 15.5742C6.99609 15.293 6.88184 15.082 6.71484 14.9062L4.44727 12.7002L2.90039 11.3994L4.93945 11.4873H15.917C18.1143 11.4873 19.0459 10.4941 19.0459 8.34082V3.12891C19.0459 0.931641 18.1143 0 15.917 0H11.0391C10.4678 0 10.0635 0.430664 10.0635 0.958008C10.0635 1.48535 10.459 1.91602 11.0391 1.91602H15.873C16.7695 1.91602 17.1475 2.29395 17.1475 3.18164V8.2793C17.1475 9.18457 16.7607 9.5625 15.873 9.5625H4.93945L2.90039 9.65918L4.44727 8.34961L6.71484 6.14355C6.88184 5.97656 6.99609 5.76562 6.99609 5.47559C6.99609 4.93066 6.61816 4.54395 6.04688 4.54395C5.80957 4.54395 5.5459 4.64941 5.35254 4.84277L0.307617 9.80859C0.105469 10.002 0 10.2656 0 10.5293C0 10.7842 0.105469 11.0479 0.307617 11.2412L5.35254 16.2158C5.5459 16.4004 5.80957 16.5059 6.04688 16.5059Z" />
                    </g>
                  </g>

                  <!-- Option 1: Add Control Node Before End (Icon 1) -->
                  <g style="cursor:pointer;" title="Вставити перед контрольною кінця ділянки" @click.stop="handleAddNode('left', segments.indexOf(seg), 'before', pill)">
                    <rect :x="layout.leftX - 73" y="-14" width="23" height="28" fill="transparent"/>
                    <g :transform="'translate(' + (layout.leftX - 59.1) + ', -4.1) scale(-1, 1)'" fill="#4b5563">
                      <path transform="scale(0.58)" d="M0 6.82031C0 7.08398 0.114258 7.34766 0.316406 7.54102L6.11719 13.333C6.32812 13.5352 6.55664 13.6318 6.81152 13.6318C7.36523 13.6318 7.76953 12.3363 7.76953 12.7002C7.76953 12.4189 7.66406 12.1816 7.47949 12.0059L5.50195 10.002L2.95312 7.67285L5.00098 7.7959H15.6533C16.2334 7.7959 16.6377 7.3916 16.6377 6.82031C16.6377 6.24023 16.2334 5.83594 15.6533 5.83594H5.00098L2.96191 5.95898L5.50195 3.62988L7.47949 1.62598C7.66406 1.4502 7.76953 1.21289 7.76953 0.931641C7.76953 0.395508 7.36523 0 6.81152 0C6.55664 0 6.31934 0.0966797 6.09082 0.316406L0.316406 6.09082C0.114258 6.28418 0 6.54785 0 6.82031Z" />
                    </g>
                  </g>
                </g>

                <!-- Vertical Divider to Add Stop -->
                <line :x1="layout.leftX - 50" y1="-10" :x2="layout.leftX - 50" y2="10" stroke="#9ca3af" stroke-width="1" />

                <!-- Add Stop -->
                <g style="cursor:pointer;" :title="pill.title || 'Додати зупинку'" @click.stop="$emit('add-stop', segments.indexOf(seg), 'left', pill.insertIdx, pill.isAfterMerge)">
                  <rect :x="layout.leftX - 50" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                  <g :transform="'translate(' + (layout.leftX - 30.5) + ', -7) scale(-1, 1)'" fill="#4b5563">
                    <path transform="scale(0.5)" d="M5.78869 27.4289C6.5345 27.4289 7.07691 26.9543 7.07691 26.0616V17.3943C7.07691 17.0101 7.25772 16.7841 7.56282 16.7841C7.86793 16.7841 8.06003 17.0101 8.06003 17.3943V26.0616C8.06003 26.9543 8.60244 27.4289 9.34826 27.4289ZM10.0828 27.4289 10.6252 26.9543 10.6252 26.0616V11.4165C10.6252 11.1114 10.7721 10.9306 11.0207 10.9306C11.258 10.9306 11.4162 11.1114 11.4162 11.4165V17.4282C11.4162 18.2305 11.8908 18.6825 12.5688 18.6825C13.2468 18.6825 13.7101 18.2305 13.7101 17.4282V11.5521C13.7101 7.9699 11.6874 7.04328 7.67583 7.04328H5.93559C5.15588 7.04328 4.76037 6.93027 4.13885 6.47827L2.64723 5.42735L2.37602 1.20106C2.31952 0.387446 1.79971 -0.0419624 1.1217 0.00323846C0.432382 0.0371391 -0.0422274 0.534349 0.00297345 1.33666L0.274179 5.52905C0.33068 6.44437 0.692287 6.97548 1.2573 7.39358L3.96935 9.37112C4.36486 9.65363 4.50046 10.0039 4.50046 10.4559V26.0616C4.50046 26.9543 5.05417 27.4289 5.78869 27.4289ZM7.67583 5.91325C9.17875 5.91325 10.3879 4.67023 10.3879 3.2125C10.3879 1.70957 9.17875 0.489148 7.67583 0.489148C6.16159 0.489148 4.97507 1.70957 4.97507 3.2125C4.97507 4.69283 6.16159 5.91325 7.67583 5.91325Z"/>
                  </g>
                </g>
              </g>
            </template>
          </template>

<!-- Left Branches for this Segment -->
          <template v-for="(br, brIdx) in branchesForSeg(segments.indexOf(seg))" :key="'lbr-' + br.id">
            <path v-if="br.finished"
                  :d="getLeftBranchFinishedPath(br, i).d"
                  fill="none" style="cursor:pointer;" @click.stop="selectBranchSection(br, 0, i, false)" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>
            <path v-else
                  :d="getBranchOutPath(layout.leftX, layout.leftNodeY[i+1], getBranchDx(br), -1, -1, getBranchEndpointY(br, i, false))"
                  fill="none" style="cursor:pointer;" @click.stop="selectBranchSection(br, 0, i, false)" :stroke="color" :stroke-width="layout.RAIL_W" stroke-linejoin="round" stroke-linecap="round"/>

            <!-- Branch Direction Arrow (Left) -->
            <g class="anim-row" :style="{ transform: 'translate(' + (layout.leftX - getBranchDx(br)) + 'px, ' + (layout.leftNodeY[i+1] - 44) + 'px) rotate(-90deg)', transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }">
              <polygon points="0,-4.5 42,-4.5 50,0 42,4.5 0,4.5" fill="url(#arrow-fade)" />
              <polygon points="0,-4.5 8,0 0,4.5" :fill="color" />
            </g>

            <!-- Finish Branch Icon (Left) - Positioned below the control node -->
            <g v-if="!br.finished" style="cursor:pointer" @click.stop="$emit('finish-branch', br.id)"
               :transform="'translate(' + (layout.leftX - getBranchDx(br) - 5) + ',' + (getBranchEndpointY(br, i, false) - 24) + ')'">
              <rect x="-5" y="-5" width="20" height="28" rx="4" fill="rgba(255,255,255,0.85)" />
              <path d="M2.88376 17.0266C3.43747 17.0266 3.76266 16.675 3.76266 16.0862V11.0061C4.76462 12.3948 6.39059 13.5022 8.42966 14.2053C9.00095 14.425 9.47555 14.135 9.64255 13.7307C9.80954 13.3352 9.68649 12.8342 9.09762 12.5618C5.9863 11.2698 3.76266 9.32739 3.76266 6.16333V4.35278H5.08981C5.75778 4.35278 5.95114 3.84302 5.55563 3.2981L3.44626 0.336182C3.12985 -0.112061 2.63766 -0.112061 2.32126 0.336182L0.211882 3.2981C-0.192415 3.84302 -0.00784427 4.35278 0.677703 4.35278H2.00485V16.0862C2.00485 16.675 2.33005 17.0266 2.88376 17.0266Z" :fill="color"/>
            </g>



            <!-- Branch Control Nodes -->
            <g v-for="(bNode, bNIdx) in br.nodes || []" :key="'lbrn-' + bNode.id" style="cursor:pointer;"
               @click.stop="$emit('edit-branch-node', br.id, bNIdx)">
              <template v-if="bNode.name && bNode.name !== 'Контрольна (альтернатива)'">
                <circle :cx="layout.leftX - getBranchDx(br)"
                        :cy="getBranchNodeY(br, bNIdx, i, false)"
                        r="9" fill="#f5f5f5" :stroke="color" stroke-width="3"/>
                <text :x="layout.leftX - getBranchDx(br) - 18"
                      :y="getBranchNodeY(br, bNIdx, i, false) + 4"
                      font-size="13" font-weight="700" fill="#111827" text-anchor="end">{{ bNode.name }}</text>
              </template>
            </g>

            <!-- Branch Stops (Per Section) -->
            <template v-for="secIdx in (getBranchNodesLength(br) + 1)" :key="'lbrsec-' + secIdx">
              <!-- Clickable Branch Section Overlay (Left) -->
              <rect :x="layout.leftX - getBranchDx(br) - 12"
                    :y="Math.min(getBranchSectionStartY(br, secIdx, i, false), getBranchSectionEndY(br, secIdx, i, false))"
                    width="24"
                    :height="Math.max(24, Math.abs(getBranchSectionEndY(br, secIdx, i, false) - getBranchSectionStartY(br, secIdx, i, false)))"
                    fill="transparent"
                    style="cursor: pointer;"
                    title="Налаштувати ділянку альтернативи"
                    @click.stop="selectBranchSection(br, secIdx - 1, i, false)" />

              <!-- Branch Section Interval Gradient & Badge (Left, e.g. 20-25хв) -->
              <template v-if="shouldShowBranchSectionInterval(br, secIdx)">
                <rect :x="layout.leftX - getBranchDx(br)"
                      :y="getBranchGradientStartY(br, secIdx, i, false)"
                      width="80"
                      :height="getBranchGradientHeight(br, secIdx, i, false)"
                      rx="6"
                      fill="url(#interval-fade-left)"
                      style="pointer-events:none;" />
                <g class="anim-row" :style="{ transform: 'translate(0px, ' + getBranchSectionIntervalY(br, secIdx, i, false) + 'px)' }" style="pointer-events:none;">
                  <text :x="layout.leftX - getBranchDx(br) + 25" y="4"
                        font-size="13" font-weight="800" :fill="color" font-style="italic" text-anchor="start">
                    {{ getBranchSectionIntervalText(br, secIdx - 1) }}
                  </text>
                </g>
              </template>
              <g v-for="(bStop, bStIdx) in getBranchSectionStops(br, secIdx)" :key="'lbrst-' + bStop.id" style="cursor:pointer;"
                 @click.stop="selectBranchSection(br, secIdx - 1, i, false)">
                <line :x1="layout.leftX - getBranchDx(br)"
                      :y1="getBranchStopY(br, secIdx, bStIdx, i, false)"
                      :x2="layout.leftX - getBranchDx(br) - 12"
                      :y2="getBranchStopY(br, secIdx, bStIdx, i, false)"
                      :stroke="color" stroke-width="4.5" stroke-linecap="square"/>
                <text :x="layout.leftX - getBranchDx(br) - 18"
                      :y="getBranchStopY(br, secIdx, bStIdx, i, false) + 4"
                      font-size="12" font-weight="500" fill="#111827" text-anchor="end">
                  <template v-if="splitStopName(bStop.name).length > 1">
                    <tspan :x="layout.leftX - getBranchDx(br) - 18" dy="0">{{ splitStopName(bStop.name)[0] }}</tspan>
                    <tspan :x="layout.leftX - getBranchDx(br) - 18" dy="16">{{ splitStopName(bStop.name)[1] }}</tspan>
                  </template>
                  <template v-else>
                    {{ bStop.name }}
                  </template>
                </text>
              </g>
              <g class="anim-row"
                 :style="{ opacity: (editable && !localBranchMode) ? 1 : 0, pointerEvents: (editable && !localBranchMode) ? 'auto' : 'none', transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)', transform: 'translate(' + (layout.leftX - getBranchDx(br) - 16) + 'px, ' + getBranchAddStopY(br, secIdx, i, false) + 'px)' }">
                <rect :x="(!isBranchSecSinglePlus(br, secIdx) && activeExpandedPill === ('lbr-' + br.id + '-' + secIdx)) ? -96 : -82" y="-14" :width="(!isBranchSecSinglePlus(br, secIdx) && activeExpandedPill === ('lbr-' + br.id + '-' + secIdx)) ? 78 : 64" height="28" rx="14"
                      fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"
                      style="box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), x 0.3s cubic-bezier(0.4, 0, 0.2, 1);" />
                
                <!-- COLLAPSED / SINGLE PLUS: Plus Icon to Expand or Add Node directly -->
                <g v-if="isBranchSecSinglePlus(br, secIdx) || activeExpandedPill !== ('lbr-' + br.id + '-' + secIdx)" style="cursor:pointer;" title="Додати контрольну точку" @click.stop="isBranchSecSinglePlus(br, secIdx) ? handleAddBranchNode(br.id, secIdx - 1, 'before') : togglePillExpand('lbr-' + br.id + '-' + secIdx)">
                  <rect :x="-82" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                  <g transform="translate(-71.3, -5.3)" fill="#4b5563">
                    <path transform="scale(0.7)" d="M1.00195 8.36719H6.36328V13.7285C6.36328 14.2734 6.81152 14.7305 7.36523 14.7305C7.91895 14.7305 8.36719 14.2734 8.36719 13.7285V8.36719H13.7285C14.2734 8.36719 14.7305 7.91895 14.7305 7.36523C14.7305 6.81152 14.2734 6.36328 13.7285 6.36328H8.36719V1.00195C8.36719 0.457031 7.91895 0 7.36523 0C6.81152 0 6.36328 0.457031 6.36328 1.00195V6.36328H1.00195C0.457031 6.36328 0 6.81152 0 7.36523C0 7.91895 0.457031 8.36719 1.00195 8.36719Z" />
                  </g>
                </g>

                <!-- EXPANDED: Two Arrow Options (Left Branch) -->
                <g v-else>
                  <!-- Option 2: Add Control Node After (Icon 2) -->
                  <g style="cursor:pointer;" title="Додати після на альтернативі" @click.stop="handleAddBranchNode(br.id, secIdx - 1, 'after')">
                    <rect :x="-96" y="-14" width="23" height="28" fill="transparent" rx="11.5"/>
                    <g transform="translate(-87.5, -4.7)" fill="#4b5563">
                      <path transform="scale(0.55)" d="M6.04688 16.5059C6.61816 16.5059 6.99609 16.1191 6.99609 15.5742C6.99609 15.293 6.88184 15.082 6.71484 14.9062L4.44727 12.7002L2.90039 11.3994L4.93945 11.4873H15.917C18.1143 11.4873 19.0459 10.4941 19.0459 8.34082V3.12891C19.0459 0.931641 18.1143 0 15.917 0H11.0391C10.4678 0 10.0635 0.430664 10.0635 0.958008C10.0635 1.48535 10.459 1.91602 11.0391 1.91602H15.873C16.7695 1.91602 17.1475 2.29395 17.1475 3.18164V8.2793C17.1475 9.18457 16.7607 9.5625 15.873 9.5625H4.93945L2.90039 9.65918L4.44727 8.34961L6.71484 6.14355C6.88184 5.97656 6.99609 5.76562 6.99609 5.47559C6.99609 4.93066 6.61816 4.54395 6.04688 4.54395C5.80957 4.54395 5.5459 4.64941 5.35254 4.84277L0.307617 9.80859C0.105469 10.002 0 10.2656 0 10.5293C0 10.7842 0.105469 11.0479 0.307617 11.2412L5.35254 16.2158C5.5459 16.4004 5.80957 16.5059 6.04688 16.5059Z" />
                    </g>
                  </g>

                  <!-- Option 1: Add Control Node Before (Icon 1) -->
                  <g style="cursor:pointer;" title="Вставити перед на альтернативі" @click.stop="handleAddBranchNode(br.id, secIdx - 1, 'before')">
                    <rect :x="-73" y="-14" width="23" height="28" fill="transparent"/>
                    <g transform="translate(-59.1, -4.1) scale(-1, 1)" fill="#4b5563">
                      <path transform="scale(0.58)" d="M0 6.82031C0 7.08398 0.114258 7.34766 0.316406 7.54102L6.11719 13.333C6.32812 13.5352 6.55664 13.6318 6.81152 13.6318C7.36523 13.6318 7.76953 12.3363 7.76953 12.7002C7.76953 12.4189 7.66406 12.1816 7.47949 12.0059L5.50195 10.002L2.95312 7.67285L5.00098 7.7959H15.6533C16.2334 7.7959 16.6377 7.3916 16.6377 6.82031C16.6377 6.24023 16.2334 5.83594 15.6533 5.83594H5.00098L2.96191 5.95898L5.50195 3.62988L7.47949 1.62598C7.66406 1.4502 7.76953 1.21289 7.76953 0.931641C7.76953 0.395508 7.36523 0 6.81152 0C6.55664 0 6.31934 0.0966797 6.09082 0.316406L0.316406 6.09082C0.114258 6.28418 0 6.54785 0 6.82031Z" />
                    </g>
                  </g>
                </g>

                <!-- Vertical Divider -->
                <line x1="-50" y1="-10" x2="-50" y2="10" stroke="#9ca3af" stroke-width="1" />

                <!-- Add Stop -->
                <g style="cursor:pointer;" title="Додати зупинку" @click.stop="$emit('add-branch-stop', br.id, secIdx - 1)">
                  <rect x="-50" y="-14" width="32" height="28" fill="transparent" rx="14"/>
                  <g transform="translate(-30.5, -7) scale(-1, 1)" fill="#4b5563">
                    <path transform="scale(0.5)" d="M5.78869 27.4289C6.5345 27.4289 7.07691 26.9543 7.07691 26.0616V17.3943C7.07691 17.0101 7.25772 16.7841 7.56282 16.7841C7.86793 16.7841 8.06003 17.0101 8.06003 17.3943V26.0616C8.06003 26.9543 8.60244 27.4289 9.34826 27.4289ZM10.0828 27.4289 10.6252 26.9543 10.6252 26.0616V11.4165C10.6252 11.1114 10.7721 10.9306 11.0207 10.9306C11.258 10.9306 11.4162 11.1114 11.4162 11.4165V17.4282C11.4162 18.2305 11.8908 18.6825 12.5688 18.6825C13.2468 18.6825 13.7101 18.2305 13.7101 17.4282V11.5521C13.7101 7.9699 11.6874 7.04328 7.67583 7.04328H5.93559C5.15588 7.04328 4.76037 6.93027 4.13885 6.47827L2.64723 5.42735L2.37602 1.20106C2.31952 0.387446 1.79971 -0.0419624 1.1217 0.00323846C0.432382 0.0371391 -0.0422274 0.534349 0.00297345 1.33666L0.274179 5.52905C0.33068 6.44437 0.692287 6.97548 1.2573 7.39358L3.96935 9.37112C4.36486 9.65363 4.50046 10.0039 4.50046 10.4559V26.0616C4.50046 26.9543 5.05417 27.4289 5.78869 27.4289ZM7.67583 5.91325C9.17875 5.91325 10.3879 4.67023 10.3879 3.2125C10.3879 1.70957 9.17875 0.489148 7.67583 0.489148C6.16159 0.489148 4.97507 1.70957 4.97507 3.2125C4.97507 4.69283 6.16159 5.91325 7.67583 5.91325Z"/>
                  </g>
                </g>
              </g>
            </template>
          </template>

          <!-- Direction Arrow (Gradient Stripe Style) -->
          <g v-if="i !== layout.leftSegments.length - 1" class="anim-row"
             :style="{ opacity: ((editable && !localBranchMode) || (seg.stops && seg.stops.length >= 2)) ? 1 : 0, transform: 'translate(' + layout.leftX + 'px, ' + (layout.leftNodeY[i+1] - 25) + 'px) rotate(-90deg)', transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }"
             style="pointer-events:none;">
            <polygon points="0,-4.5 42,-4.5 50,0 42,4.5 0,4.5" fill="url(#arrow-fade)" />
            <polygon points="0,-4.5 8,0 0,4.5" :fill="color" />
          </g>
        </template>

        <!-- ── MAIN CONTROL NODES & INWARD CONNECTING LINES ── -->
        <g v-for="(node, idx) in controlNodes" :key="'cnode-' + node.id" class="anim-row"
           :style="{ transform: 'translate(0px, ' + getNodeY(node.id) + 'px)' }">

          <!-- 45-degree Branch Spur Line for Rail Control Nodes (RENDERED FIRST -> UNDER CIRCLES) -->
          <!-- Right side: 45 degrees down-right (+32, +32) -->
          <line v-if="node.side === 'right'"
                :x1="layout.rightX" y1="0"
                :x2="layout.rightX + 32" y2="32"
                :stroke="color" :stroke-width="layout.RAIL_W" stroke-linecap="round"
                :style="{ opacity: (localBranchMode && !nodeHasBranch(node)) ? 1 : 0, transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }" />
          <!-- Left side: 45 degrees up-left (-32, -32) -->
          <line v-if="node.side === 'left'"
                :x1="layout.leftX" y1="0"
                :x2="layout.leftX - 32" y2="-32"
                :stroke="color" :stroke-width="layout.RAIL_W" stroke-linecap="round"
                :style="{ opacity: (localBranchMode && !nodeHasBranch(node)) ? 1 : 0, transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }" />

          <!-- Horizontal light blue line extending INWARDS -->
          <line v-if="node.side === 'left'"
                :x1="layout.leftX" y1="0"
                :x2="layout.leftX + 25" y2="0"
                :stroke="color" stroke-width="3"/>
          <line v-else
                :x1="layout.rightX" y1="0"
                :x2="layout.rightX - 25" y2="0"
                :stroke="color" stroke-width="3"/>

          <!-- Circle only on the correct side (RENDERED SECOND -> OVER LINE) -->
          <circle v-if="node.side === 'left'" :cx="layout.leftX" cy="0" r="9"
                  fill="#f5f5f5" :stroke="(node.type === 'end' || node.isTerminus) ? '#111827' : color" :stroke-width="(node.type === 'end' || node.isTerminus) ? 4 : 3.5"
                  :class="{ 'terminus-added': (node.type === 'end' || node.isTerminus) }" />
          <circle v-else :cx="layout.rightX" cy="0" r="9"
                  fill="#f5f5f5" :stroke="(node.type === 'end' || node.isTerminus) ? '#111827' : color" :stroke-width="(node.type === 'end' || node.isTerminus) ? 4 : 3.5"
                  :class="{ 'terminus-added': (node.type === 'end' || node.isTerminus) }" />

          <!-- Control Node Name Label & Travel Time -->
          <text v-if="node.side === 'left'"
                :x="layout.leftX - 18" y="4"
                font-size="13" font-weight="700" fill="#111827" text-anchor="end" style="pointer-events:none;">
            <tspan>{{ (node.type === 'end' || node.isTerminus) && node.terminusStop ? node.terminusStop : node.name }} </tspan><tspan dx="8" font-size="13" font-weight="700" font-style="italic" :fill="color">{{ nodeTravelTimes[node.id] || 0 }} хв</tspan>
          </text>
          <text v-else
                :x="layout.rightX + 18" y="4"
                font-size="13" font-weight="700" fill="#111827" style="pointer-events:none;">
            <tspan>{{ (node.type === 'end' || node.isTerminus) && node.terminusStop ? node.terminusStop : node.name }} </tspan><tspan dx="8" font-size="13" font-weight="700" font-style="italic" :fill="color">{{ nodeTravelTimes[node.id] || 0 }} хв</tspan>
          </text>
          
          <!-- Icons for side termini (placed INSIDE the oval) -->
          <g v-if="node.isTerminus && getTerminusIcons(node).length > 0" :transform="'translate(' + (node.side === 'left' ? layout.leftX + 32 : layout.rightX - 52) + ', -6)'">
            <g v-for="(icon, i) in getTerminusIcons(node)" :key="icon.id" :transform="'translate(' + (node.side === 'left' ? (i * 24) : (-i * 24)) + ', 0)'">
              <SvgIcon :name="icon.id" :x="icon.x" :y="icon.y" :width="icon.w" :height="icon.h" class="text-gray-800" />
            </g>
          </g>

          <!-- Branch Addition Round Button (RENDERED THIRD -> OVER END OF LINE) -->
          <g v-if="node.side === 'right'"
             :style="{ opacity: (localBranchMode && !nodeHasBranch(node)) ? 1 : 0, transform: 'translate(' + (layout.rightX + 32) + 'px, 32px) scale(' + ((localBranchMode && !nodeHasBranch(node)) ? 1 : 0.5) + ')', transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)', pointerEvents: (localBranchMode && !nodeHasBranch(node)) ? 'auto' : 'none' }"
             style="cursor:pointer;"
             @click.stop="$emit('add-branch', getSegIdxForNode(node))">
            <circle cx="0" cy="0" r="9" fill="#f5f5f5" :stroke="color" stroke-width="3.5" class="shadow-sm transition"/>
            <SvgIcon name="plus" :x="-5" :y="-5" :width="10" :height="10" class="text-gray-900 pointer-events-none" />
          </g>
          <g v-if="node.side === 'left'"
             :style="{ opacity: (localBranchMode && !nodeHasBranch(node)) ? 1 : 0, transform: 'translate(' + (layout.leftX - 32) + 'px, -32px) scale(' + ((localBranchMode && !nodeHasBranch(node)) ? 1 : 0.5) + ')', transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)', pointerEvents: (localBranchMode && !nodeHasBranch(node)) ? 'auto' : 'none' }"
             style="cursor:pointer;"
             @click.stop="$emit('add-branch', getSegIdxForNode(node))">
            <circle cx="0" cy="0" r="9" fill="#f5f5f5" :stroke="color" stroke-width="3.5" class="shadow-sm transition"/>
            <SvgIcon name="plus" :x="-5" :y="-5" :width="10" :height="10" class="text-gray-900 pointer-events-none" />
          </g>
        </g>

      </g>
    </svg>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { OvalLayout, OVAL_DEFAULTS, splitStopName, isStopMultiline, getStopHeight } from '../utils/routeGeometry';
import { getBranchDxForLevel, getMaxBranchLevel } from '../utils/branchLevelModel.js';
import SvgIcon from '@/components/ui/SvgIcon.vue';

const props = defineProps({
  routeData: { type: Object, required: true },
  editable: { type: Boolean, default: false },
  viewBoxOverride: { type: Object, default: null },
  isBranchMode: { type: Boolean, default: false },
  isAnimationPaused: { type: Boolean, default: false }
});

const emit = defineEmits([
  'add-stop', 'remove-stop',
  'add-node', 'remove-node',
  'add-branch', 'add-sub-branch', 'finish-branch', 'config-branch',
  'add-branch-node', 'add-branch-stop', 'extend-branch-with-stop',
  'edit-branch-stop', 'edit-branch-node',
  'toggle-branch-mode'
]);

function getBranchNodesLength(br) {
  if (!br || !br.nodes) return 0;
  return br.nodes.filter(n => n.name && n.name !== 'Контрольна (альтернатива)').length;
}

function getBranchSectionStops(br, secIdx) {
  if (!br) return [];
  if (br.sections && br.sections[secIdx - 1] && br.sections[secIdx - 1].stops) {
    return br.sections[secIdx - 1].stops;
  }
  return secIdx === 1 ? (br.stops || []) : [];
}

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

const activeExpandedPill = ref(null);
function togglePillExpand(key) {
  activeExpandedPill.value = activeExpandedPill.value === key ? null : key;
}
function handleAddNode(side, segIdx, posMode, pill = null) {
  emit('add-node', side, segIdx, posMode, pill?.insertIdx);
  activeExpandedPill.value = null;
}
function handleAddBranchNode(brId, sectionIdx, posMode) {
  emit('add-branch-node', brId, sectionIdx, posMode);
  activeExpandedPill.value = null;
}

function hasSubBranch(pId, nId) {
  return (branches.value || []).some(b => b && b.parentBranchId === pId && (b.parentNodeId === nId || (!b.parentNodeId && nId === 'endpoint')));
}

function getBypassedMidY(br, i, isRight) {
  if (!layout.value) return 0;
  const l = layout.value;
  if (isRight) {
    const startY = l.rightNodeY[i];
    const mergeY = getRightBranchFinishedPath(br, i).mergeY;
    return (startY + mergeY) / 2;
  } else {
    const startY = l.leftNodeY[i+1];
    const mergeY = getLeftBranchFinishedPath(br, i).mergeY;
    return (startY + mergeY) / 2;
  }
}

function getBypassedQuestionStyle(br, i, isRight) {
  if (!layout.value) return { opacity: 0, pointerEvents: 'none' };
  const x = isRight ? layout.value.rightX : layout.value.leftX;
  const y = getBypassedMidY(br, i, isRight);
  return {
    transform: 'translate(' + x + 'px, ' + y + 'px)'
  };
}

function getBypassedInsertIdx(br, seg) {
  if (!seg || !seg.stops) return 0;
  if (br.targetStopId) {
    const idx = seg.stops.findIndex(st => String(st.id) === String(br.targetStopId));
    if (idx !== -1) return idx;
  }
  return seg.stops.length;
}

function getBranchTargetSegIdx(b, allSegments) {
  const segs = allSegments || segments.value;
  if (!b || !segs) return b?.segIdx ?? 0;
  if (b.targetStopId) {
    const sIdx = segs.findIndex(s => s.stops && s.stops.some(st => String(st.id) === String(b.targetStopId)));
    if (sIdx !== -1) return sIdx;
  }
  if (b.targetNodeId && b.targetType !== 'bottom_arc') {
    const sIdx = segs.findIndex(s => String(s.nextNodeId) === String(b.targetNodeId));
    if (sIdx !== -1) return sIdx;
  }
  if (allSegments && b.segIdx !== undefined && segments.value && segments.value[b.segIdx]) {
    const pId = segments.value[b.segIdx].id;
    const idx = allSegments.findIndex(s => String(s.id) === String(pId));
    if (idx !== -1) return idx;
  }
  return b.segIdx ?? 0;
}

function getBypassedBranchesForSeg(seg) {
  const sIdx = segments.value.indexOf(seg);
  return (branches.value || []).filter(b => {
    if (!b || !b.finished || b.parentBranchId) return false;
    if (b.targetType === 'bottom_arc') return false;
    
    // Only show separate bypassed pill if merging into a specific middle stop
    if (!b.targetStopId) return false;

    const targetSegIdx = getBranchTargetSegIdx(b, segments.value);
    return (sIdx === targetSegIdx);
  });
}

function hasQuestionBranch(seg) {
  if (!seg || !branches.value) return false;
  const sIdx = segments.value.indexOf(seg);
  return branches.value.some(b => 
    b.finished && 
    (!b.bypassedMainState || b.bypassedMainState === 'question') && 
    (b.segIdx === sIdx || (b.targetStopId && seg.stops && seg.stops.some(st => String(st.id) === String(b.targetStopId))))
  );
}

function getBypassedTopPillStyle(br, i, isRight) {
  if (!layout.value) return { opacity: 0, pointerEvents: 'none' };
  const l = layout.value;
  const x = 0;
  const startY = isRight ? l.rightNodeY[i] : l.leftNodeY[i+1];
  const segs = isRight ? l.rightSegments : l.leftSegments;
  const seg = segs ? segs[i] : null;

  let mergeIdx = -1;
  if (seg && br.targetStopId && seg.stops) {
    mergeIdx = seg.stops.findIndex(st => String(st.id) === String(br.targetStopId));
  }
  if (mergeIdx === -1) {
    mergeIdx = (!br.targetStopId && seg && seg.stops) ? seg.stops.length : 0;
  }

  const hasBranchStart = (branches.value || []).some(b => b.segIdx === segments.value.indexOf(seg));
  const offset = hasBranchStart ? 64 : 32;
  const preStopsH = (seg?.stops || []).slice(0, mergeIdx).reduce((acc, st) => acc + getStopHeight(st), 0);
  const y = isRight 
    ? (startY + offset + preStopsH) 
    : (startY - offset - preStopsH);

  return {
    transform: 'translate(' + x + 'px, ' + y + 'px)'
  };
}

function shouldShowMainAddPill(side, segIndex) {
  return true;
}

function isBranchSecSinglePlus(br, secIdx) {
  if (!br) return true;
  // All intermediate sections on the branch have options (← ↩).
  // Only the last section before reconnecting/ending has a single plus (+).
  const isLastSection = secIdx === (getBranchNodesLength(br) + 1);
  return isLastSection;
}

function isPillSinglePlus(side, seg, i, pill) {
  if (!seg || !layout.value) return true;
  const isRight = side === 'right';
  const segs = isRight ? layout.value.rightSegments : layout.value.leftSegments;
  if (!segs || segs.length === 0) return true;
  
  // Only the last segment on this rail (before turnaround cap) is single plus
  if (i === segs.length - 1) return true;

  return false;
}



function getMainAddPillStyle(side, seg, i) {
  if (!layout.value) return { opacity: 0, pointerEvents: 'none' };
  const isRight = side === 'right';
  const show = props.editable && !localBranchMode.value && shouldShowMainAddPill(side, i);
  const actualIdx = segments.value.indexOf(seg);
  const y = isRight
    ? layout.value.getRightAddStopY(seg, layout.value.rightNodeY[i], layout.value.rightNodeY[i+1], i === layout.value.rightSegments.length - 1, actualIdx)
    : layout.value.getLeftAddStopY(seg, layout.value.leftNodeY[i], layout.value.leftNodeY[i+1], i === layout.value.leftSegments.length - 1, actualIdx);

  return {
    opacity: show ? 1 : 0,
    pointerEvents: show ? 'auto' : 'none',
    transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: 'translate(0px, ' + y + 'px)'
  };
}

const color = computed(() => props.routeData.color || '#1D43EF');
const nodes = computed(() => props.routeData.nodes || []);
const segments = computed(() => props.routeData.segments || []);
const branches = computed(() => props.routeData.branches || []);
const localBranchMode = computed(() => props.isBranchMode || props.routeData.isBranchMode || false);

const firstNode = computed(() => {
  return nodes.value.find(n => !n.side || n.side === 'top') || nodes.value[0] || null;
});
const lastNode = computed(() => {
  return nodes.value.find(n => n.side === 'bottom') || nodes.value.filter(n => !n.side)[1] || null;
});
const controlNodes = computed(() => nodes.value.filter(n => (n.side === 'left' || n.side === 'right') && n.type !== 'virtual'));

const rightAddNodeY = computed(() => {
  if (!layout.value || !layout.value.rightNodeY?.length) return 80;
  const lastY = layout.value.rightNodeY[layout.value.rightNodeY.length - 1];
  return lastY !== undefined ? lastY + 80 : 80;
});

const leftAddNodeY = computed(() => {
  if (!layout.value || !layout.value.leftNodeY?.length) return 80;
  const topY = layout.value.leftNodeY[0];
  return topY !== undefined ? Math.max(40, topY - 80) : 80;
});

const nodeTravelTimes = computed(() => {
  if (!layout.value || !props.routeData?.nodes?.length) return {};
  const times = {};
  const nodeMap = new Map(props.routeData.nodes.map(n => [String(n.id), n]));
  const segMapById = new Map((props.routeData.segments || []).map(s => [String(s.id), s]));
  const segMapByFromNode = new Map((props.routeData.segments || []).map(s => [String(s.fromNodeId), s]));

  // Find start node (top terminus)
  const startNode = firstNode.value || props.routeData.nodes.find(n => !n.side || n.side === 'top') || props.routeData.nodes[0];
  if (!startNode) return {};

  const firstTerminusId = startNode.id;
  let currNode = startNode;
  let time = 0;
  times[currNode.id] = 0;

  const visited = new Set();
  while (currNode && !visited.has(String(currNode.id))) {
    visited.add(String(currNode.id));

    // If leaving a non-start terminus, add its wait time
    if (currNode.isTerminus && String(currNode.id) !== String(firstTerminusId)) {
      time += Number(currNode.waitMin || 0);
    }

    const seg = currNode.nextSegId 
      ? (segMapById.get(String(currNode.nextSegId)) || segMapByFromNode.get(String(currNode.id)))
      : segMapByFromNode.get(String(currNode.id));
    if (!seg) break;

    time += Number(seg.travelTime || 0);

    const nextNode = seg.nextNodeId ? nodeMap.get(String(seg.nextNodeId)) : null;
    if (!nextNode) break;

    if (String(nextNode.id) === String(firstTerminusId)) {
      // Returned back to the start terminus! Loop complete!
      break;
    }

    times[nextNode.id] = time;
    currNode = nextNode;
  }

  const totalLoopTime = time;
  const formattedTimes = {};
  for (let key in times) {
    if (String(key) === String(firstTerminusId)) {
      formattedTimes[key] = totalLoopTime + ' / 0';
    } else {
      formattedTimes[key] = String(times[key]);
    }
  }

  // Fallback for any unvisited nodes
  for (let n of props.routeData.nodes) {
    if (formattedTimes[n.id] === undefined) {
      formattedTimes[n.id] = '0';
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
    if (n) map[n.id] = l.leftNodeY[i + 1] ?? 0;
  });
  if (firstNode.value) map[firstNode.value.id] = l.topY - (l.CAP_R || 100);
  if (lastNode.value) map[lastNode.value.id] = l.botY + (l.CAP_R || 100);
  return map;
});

function getNodeY(nodeId) {
  return nodeYMap.value[nodeId] ?? 0;
}

function getSegIdxForNode(node) {
  if (!layout.value || !node) return 0;
  if (node.side === 'right') {
    const idx = layout.value.rightNodes.findIndex(n => n?.id === node.id);
    if (idx !== -1 && layout.value.rightSegments[idx]) {
      return segments.value.indexOf(layout.value.rightSegments[idx]);
    }
  } else if (node.side === 'left') {
    const idx = layout.value.leftNodes.findIndex(n => n?.id === node.id);
    if (idx !== -1 && layout.value.leftSegments[idx + 1]) {
      return segments.value.indexOf(layout.value.leftSegments[idx + 1]);
    }
  }
  return 0;
}

function getBranchOutPath(x, y, dx, dirX, dirY, endY) {
  const absDx = Math.abs(dx);
  const r = 16;
  const sweep1 = 0;
  const sweep2 = 1;
  const finalY = endY !== undefined ? endY : (y + (absDx <= 128 ? 96 : 128) * dirY);
  
  return 'M ' + x + ' ' + y + ' '
       + 'L ' + (x + 27.32 * dirX) + ' ' + (y + 27.32 * dirY) + ' '
       + 'A ' + r + ' ' + r + ' 0 0 ' + sweep1 + ' ' + (x + 38.62 * dirX) + ' ' + (y + 32 * dirY) + ' '
       + 'L ' + (x + (absDx - r) * dirX) + ' ' + (y + 32 * dirY) + ' '
       + 'A ' + r + ' ' + r + ' 0 0 ' + sweep2 + ' ' + (x + absDx * dirX) + ' ' + (y + (32 + r) * dirY) + ' '
       + 'L ' + (x + absDx * dirX) + ' ' + finalY;
}

function getBranchInPath(x, y, dx, dirX, dirY) {
  const r = 16;
  const startX = x + dx * dirX;
  const sweep = (dirX * dirY > 0) ? 0 : 1;
  return 'M ' + startX + ' ' + (y - (64 + r) * dirY) + ' '
       + 'L ' + startX + ' ' + (y - r * dirY) + ' '
       + 'A ' + r + ' ' + r + ' 0 0 ' + sweep + ' ' + (startX - r * dirX) + ' ' + y + ' '
       + 'L ' + x + ' ' + y;
}

function getBranchNodeY(br, bNIdx, i, isRight) {
  if (!layout.value) return 0;
  const l = layout.value;
  const startY = isRight ? (l.rightNodeY[i] + 64) : (l.leftNodeY[i+1] - 64);
  
  let yOffset = 0;
  const sections = br.sections || [];
  for (let si = 0; si <= bNIdx; si++) {
    const stops = sections[si]?.stops || [];
    const stopsHeight = stops.reduce((acc, st) => acc + getStopHeight(st), 0);
    yOffset += stopsHeight;
    if (props.editable !== false) yOffset += 32;
  }
  yOffset += bNIdx * 32;
  return isRight ? (startY + yOffset) : (startY - yOffset);
}

function getBranchStopY(br, secIdx, bStIdx, i, isRight) {
  if (!layout.value) return 0;
  const l = layout.value;
  const startY = isRight ? (l.rightNodeY[i] + 64) : (l.leftNodeY[i+1] - 64);
  
  let yOffset = 0;
  const sections = br.sections || [];
  for (let si = 0; si < secIdx - 1; si++) {
    const stops = sections[si]?.stops || [];
    const stopsHeight = stops.reduce((acc, st) => acc + getStopHeight(st), 0);
    yOffset += stopsHeight;
    if (props.editable !== false) yOffset += 32;
    yOffset += 32;
  }
  const currentSecStops = sections[secIdx - 1]?.stops || [];
  const currentStopsHeightBefore = currentSecStops.slice(0, bStIdx).reduce((acc, st) => acc + getStopHeight(st), 0);
  yOffset += currentStopsHeightBefore;
  return isRight ? (startY + yOffset) : (startY - yOffset);
}

function selectBranchSection(br, secIdx = 0, segIndex = 0, isRight = true) {
  if (!br.sections) br.sections = [];
  while (br.sections.length <= secIdx) {
    const sIdx = br.sections.length;
    br.sections.push({
      id: 'br_sec_' + br.id + '_' + sIdx,
      stops: [],
      travelTime: 5,
      interval: '20',
      intervalMax: '25'
    });
  }
  const sec = br.sections[secIdx];
  if (!sec.id) {
    sec.id = 'br_sec_' + br.id + '_' + secIdx;
  }
  if (!sec.stops) sec.stops = [];
  if (sec.travelTime === undefined) sec.travelTime = 5;
  if (sec.interval === undefined) sec.interval = '20';
  if (sec.intervalMax === undefined) sec.intervalMax = '25';

  if (router && route) {
    router.push({ query: { ...route.query, segmentId: String(sec.id) } });
  }

  // Camera zoom to branch section
  if (!layout.value) return;
  const l = layout.value;
  const cx = isRight ? (l.rightX + getBranchDx(br)) : (l.leftX - getBranchDx(br));
  const sY = getBranchSectionStartY(br, secIdx + 1, segIndex, isRight);
  const eY = getBranchSectionEndY(br, secIdx + 1, segIndex, isRight);
  const cy = (sY + eY) / 2;
  const segH = Math.abs(eY - sY);

  let targetH = segH + 160;
  let targetW = targetH * (800 / 1200);
  if (targetW < 350) {
    targetW = 350;
    targetH = targetW * (1200 / 800);
  }
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
  const duration = 500;
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

function getBranchSectionStartY(br, secIdx, i, isRight) {
  if (!layout.value) return 0;
  const l = layout.value;
  const baseStartY = isRight ? (l.rightNodeY[i] + 64) : (l.leftNodeY[i+1] - 64);
  if (secIdx <= 1) return baseStartY;
  return getBranchNodeY(br, secIdx - 2, i, isRight);
}

function getBranchSectionEndY(br, secIdx, i, isRight) {
  if (!layout.value) return 0;
  const nodesLen = getBranchNodesLength(br);
  if (secIdx <= nodesLen) {
    return getBranchNodeY(br, secIdx - 1, i, isRight);
  }
  if (br.finished) {
    return isRight ? getRightBranchFinishedPath(br, i).turnY : getLeftBranchFinishedPath(br, i).turnY;
  }
  return getBranchEndpointY(br, i, isRight);
}

function getBranchAddStopY(br, secIdx, i, isRight) {
  if (!layout.value) return 0;
  const l = layout.value;
  const startY = isRight ? (l.rightNodeY[i] + 64) : (l.leftNodeY[i+1] - 64);
  
  let yOffset = 0;
  const sections = br.sections || [];
  for (let si = 0; si < secIdx - 1; si++) {
    const stops = sections[si]?.stops || [];
    const stopsHeight = stops.reduce((acc, st) => acc + getStopHeight(st), 0);
    yOffset += stopsHeight;
    if (props.editable !== false) yOffset += 32;
    yOffset += 32; // for the control node between sections
  }
  
  const currentSecStops = sections[secIdx - 1]?.stops || [];
  const currentStopsHeight = currentSecStops.reduce((acc, st) => acc + getStopHeight(st), 0);
  yOffset += currentStopsHeight;
  
  return isRight ? (startY + yOffset) : (startY - yOffset);
}

function getBranchAddNodeY(br, secIdx, i, isRight) {
  return getBranchAddStopY(br, secIdx, i, isRight) + (isRight ? 32 : -32);
}

function getBranchEndpointY(br, i, isRight) {
  if (!layout.value) return 0;
  const l = layout.value;
  const baseY = isRight ? (l.rightNodeY[i] + 64) : (l.leftNodeY[i+1] - 64);
  
  let yOffset = 0;
  const sections = br.sections || [];
  const nodesLen = getBranchNodesLength(br);
  for (let si = 0; si <= nodesLen; si++) {
    const stops = sections[si]?.stops || [];
    const stopsHeight = stops.reduce((acc, st) => acc + getStopHeight(st), 0);
    yOffset += stopsHeight;
    if (props.editable !== false) yOffset += 32;
  }
  yOffset += nodesLen * 32;
  
  return isRight ? (baseY + yOffset) : (baseY - yOffset);
}

function shouldShowBranchSectionInterval(br, secIdx) {
  const stops = getBranchSectionStops(br, secIdx);
  if (stops && stops.length > 0) return true;
  return getBranchDx(br) > 112;
}

function getBranchSectionIntervalText(br, secIdx) {
  const sec = br?.sections?.[secIdx];
  const min = (sec && sec.interval && sec.interval !== '0' && sec.interval !== 0) ? sec.interval : '20';
  const max = (sec && sec.intervalMax) ? sec.intervalMax : '25';
  return `${min}-${max}хв`;
}

function getBranchSectionIntervalY(br, secIdx, i, isRight) {
  const sY = getBranchSectionStartY(br, secIdx, i, isRight);
  const eY = getBranchSectionEndY(br, secIdx, i, isRight);
  return (sY + eY) / 2;
}

function getBranchGradientStartY(br, secIdx, i, isRight) {
  let sY = Math.min(getBranchSectionStartY(br, secIdx, i, isRight), getBranchSectionEndY(br, secIdx, i, isRight));
  if (secIdx === 1) {
    sY -= 32; // shift 1 position (32px) higher to start from the top turn
  }
  return sY;
}

function getBranchGradientHeight(br, secIdx, i, isRight) {
  let h = Math.max(24, Math.abs(getBranchSectionEndY(br, secIdx, i, isRight) - getBranchSectionStartY(br, secIdx, i, isRight)));
  if (secIdx === 1) {
    h += 32; // extend by 1 position (32px) to match the shifted start
  }
  return h;
}

function getBranchDx(br) {
  if (!br) return 224;
  if (layout.value && typeof layout.value.getBranchDx === 'function') {
    return layout.value.getBranchDx(br);
  }
  return getBranchDxForLevel(br, 1, segments.value);
}

function getRightBranchFinishedPath(br, i) {
  if (!layout.value) return { d: '', arrowY: 0, turnY: 0, mergeY: 0 };
  const l = layout.value;
  const parentSeg = br.segIdx !== undefined ? props.routeData.segments[br.segIdx] : null;
  const rSegIdx = parentSeg ? l.rightSegments.findIndex(s => String(s.id) === String(parentSeg.id)) : (br.segIdx ?? i);
  const startY = (rSegIdx !== -1 && l.rightNodeY[rSegIdx] !== undefined) ? l.rightNodeY[rSegIdx] : (l.rightNodeY[i] ?? 0);
  const dx = getBranchDx(br);

  const minTurnY = getBranchEndpointY(br, i, true);
  let mergeY = l.getBranchMergeY(br, true);
  mergeY = Math.max(mergeY, minTurnY);

  const turnY = mergeY;
  const r = 16;
  const absDx = Math.abs(dx);
  
  let dPath = 'M ' + l.rightX + ' ' + startY + ' '
     + 'L ' + (l.rightX + 27.32) + ' ' + (startY + 27.32) + ' '
     + 'A ' + r + ' ' + r + ' 0 0 0 ' + (l.rightX + 38.62) + ' ' + (startY + 32) + ' '
     + 'L ' + (l.rightX + absDx - r) + ' ' + (startY + 32) + ' '
     + 'A ' + r + ' ' + r + ' 0 0 1 ' + (l.rightX + absDx) + ' ' + (startY + 48) + ' '
     + 'L ' + (l.rightX + absDx) + ' ' + (mergeY - r) + ' '
     + 'A ' + r + ' ' + r + ' 0 0 1 ' + (l.rightX + absDx - r) + ' ' + mergeY + ' '
     + 'L ' + (l.rightX + r) + ' ' + mergeY + ' '
     + 'A ' + r + ' ' + r + ' 0 0 0 ' + l.rightX + ' ' + (mergeY + r);
     
  return {
    d: dPath,
    arrowY: mergeY + 15,
    turnY: turnY,
    mergeY: mergeY
  };
}

function getLeftBranchFinishedPath(br, i) {
  if (!layout.value) return { d: '', arrowY: 0, turnY: 0, mergeY: 0 };
  const l = layout.value;
  const parentSeg = br.segIdx !== undefined ? props.routeData.segments[br.segIdx] : null;
  const lSegIdx = parentSeg ? l.leftSegments.findIndex(s => String(s.id) === String(parentSeg.id)) : (br.segIdx ?? i);
  const startY = (lSegIdx !== -1 && l.leftNodeY[lSegIdx + 1] !== undefined) ? l.leftNodeY[lSegIdx + 1] : (l.leftNodeY[i + 1] ?? 0);
  
  const dx = getBranchDx(br);
  const minTurnY = getBranchEndpointY(br, i, false);
  let mergeY = l.getBranchMergeY(br, false);
  mergeY = Math.min(mergeY, minTurnY);

  const turnY = mergeY;
  const r = 16;
  const absDx = Math.abs(dx);
  
  let dPath = 'M ' + l.leftX + ' ' + startY + ' '
     + 'L ' + (l.leftX - 27.32) + ' ' + (startY - 27.32) + ' '
     + 'A ' + r + ' ' + r + ' 0 0 0 ' + (l.leftX - 38.62) + ' ' + (startY - 32) + ' '
     + 'L ' + (l.leftX - absDx + r) + ' ' + (startY - 32) + ' '
     + 'A ' + r + ' ' + r + ' 0 0 1 ' + (l.leftX - absDx) + ' ' + (startY - 48) + ' '
     + 'L ' + (l.leftX - absDx) + ' ' + (mergeY + r) + ' '
     + 'A ' + r + ' ' + r + ' 0 0 1 ' + (l.leftX - absDx + r) + ' ' + mergeY + ' '
     + 'L ' + (l.leftX - r) + ' ' + mergeY + ' '
     + 'A ' + r + ' ' + r + ' 0 0 0 ' + l.leftX + ' ' + (mergeY - r);

  return {
    d: dPath,
    arrowY: mergeY - 15,
    turnY: turnY,
    mergeY: mergeY
  };
}

const layout = computed(() => {
  if (!nodes.value.length) return null;
  return new OvalLayout(nodes.value, segments.value, branches.value, {
    editable: props.editable,
    isBranchMode: localBranchMode.value
  });
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

function nodeHasBranch(node) {
  if (!branches.value || !branches.value.length || !node) return false;
  if (firstNode.value && node.id === firstNode.value.id) {
    return branches.value.some(b => b.segIdx === 0 && !b.parentBranchId);
  }
  if (lastNode.value && node.id === lastNode.value.id) {
    return branches.value.some(b => b.segIdx === (segments.value.length - 1) && !b.parentBranchId);
  }
  const sIdx = getSegIdxForNode(node);
  return branches.value.some(b => (b.segIdx === sIdx || b.parentNodeId === node.id) && !b.parentBranchId);
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
    return v.x + ' ' + v.y + ' ' + v.w + ' ' + v.h;
  }
  return vbX.value + ' ' + vbY.value + ' ' + vbW.value + ' ' + vbH.value;
});

const isDragging = ref(false);
let _px = 0, _py = 0, _vx0 = 0, _vy0 = 0;

function onMouseDown(e) {
  if (document.activeElement && typeof document.activeElement.blur === 'function' && document.activeElement !== document.body) {
    document.activeElement.blur();
  }
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
  const { maxRight, maxLeft } = getMaxBranchLevel(branches.value, layout.value?.branchLevels);
  const rightExtra = Math.max(0, (maxRight - 1) * 224);
  const leftExtra = Math.max(0, (maxLeft - 1) * 224);
  vbX.value = -350 - leftExtra;
  vbY.value = -120;
  vbW.value = 800 + rightExtra + leftExtra;
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
  transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: stroke-dashoffset;
}

.anim-row,
.bottom-cap-group {
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
}

.anim-rect {
  transition: height 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: height;
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
<!-- RouteCanvas updated -->
