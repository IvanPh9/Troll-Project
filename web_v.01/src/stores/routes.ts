import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
// @ts-ignore
import { migrateToGraph } from '@/modules/route-constructor/utils/graphModel.js'

export interface RoutePeriodTime {
  period: string       // наприклад "07:00 - 08:00"
  travelTime: number   // хв
  interval?: string    // наприклад "14"
  intervalMax?: string // наприклад "18"
  segmentsData?: Record<string, { travelTime: number; interval: string; intervalMax: string }>
  disabledIds?: string[]
}

export interface RouteItem {
  id: number
  number: string
  routeNumberRaw?: string
  routeLetterRaw?: string
  name: string
  status: 'Активний' | 'Неактивний' | 'В розробці'
  pointsCount: number
  color: string        // колір бейджа
  length?: string      // середній/базовий час
  periodTimes: RoutePeriodTime[] // час обороту за періодами доби
  selectedWorkMode?: number
  timeStart?: number
  timeEnd?: number
  graph?: any
}

function buildRouteGraph(config: {
  topStop: { id: number; name: string };
  bottomStop: { id: number; name: string; isDepot?: boolean; canLunch?: boolean };
  rightControls: Array<{ id: number; name: string }>;
  leftControls: Array<{ id: number; name: string }>;
  rightSegStops: Array<{ travelTime: number; interval: string; intervalMax: string; stops: Array<{ id: number; name: string }> }>;
  leftSegStops: Array<{ travelTime: number; interval: string; intervalMax: string; stops: Array<{ id: number; name: string }> }>;
}) {
  const usedNodeIds = new Set<string | number>()
  const allocNodeId = (baseId: number) => {
    if (!usedNodeIds.has(baseId)) {
      usedNodeIds.add(baseId)
      return baseId
    }
    let suffix = 2
    while (usedNodeIds.has(`${baseId}_${suffix}`)) suffix++
    const nextId = `${baseId}_${suffix}`
    usedNodeIds.add(nextId)
    return nextId
  }

  const usedStopIds = new Set<string | number>()
  const allocStopId = (baseId: number) => {
    if (!usedStopIds.has(baseId)) {
      usedStopIds.add(baseId)
      return baseId
    }
    let suffix = 2
    while (usedStopIds.has(`${baseId}_${suffix}`)) suffix++
    const nextId = `${baseId}_${suffix}`
    usedStopIds.add(nextId)
    return nextId
  }

  const nodes: any[] = []

  // Top Terminus
  nodes.push({
    id: allocNodeId(config.topStop.id),
    type: 'control',
    isTerminus: true,
    realId: config.topStop.id,
    name: config.topStop.name,
    terminusStop: config.topStop.name,
    waitMin: 5,
    waitMax: 9,
    side: 'top'
  })

  // Right Controls
  config.rightControls.forEach((rc) => {
    nodes.push({
      id: allocNodeId(rc.id),
      type: 'control',
      realId: rc.id,
      name: rc.name,
      side: 'right'
    })
  })

  // Bottom Terminus
  nodes.push({
    id: allocNodeId(config.bottomStop.id),
    type: 'control',
    isTerminus: true,
    realId: config.bottomStop.id,
    name: config.bottomStop.name,
    terminusStop: config.bottomStop.name,
    canLunch: config.bottomStop.canLunch ?? true,
    isDepot: config.bottomStop.isDepot ?? true,
    waitMin: 5,
    waitMax: 9,
    side: 'bottom'
  })

  // Left Controls
  config.leftControls.forEach((lc) => {
    nodes.push({
      id: allocNodeId(lc.id),
      type: 'control',
      realId: lc.id,
      name: lc.name,
      side: 'left'
    })
  })

  let segIdCounter = 1
  const segments: any[] = []

  config.rightSegStops.forEach((s) => {
    segments.push({
      id: segIdCounter++,
      side: 'right',
      travelTime: s.travelTime,
      interval: s.interval,
      intervalMax: s.intervalMax,
      stops: s.stops.map((st) => ({
        id: allocStopId(st.id),
        realId: st.id,
        name: st.name,
        side: 'right'
      }))
    })
  })

  config.leftSegStops.forEach((s) => {
    segments.push({
      id: segIdCounter++,
      side: 'left',
      travelTime: s.travelTime,
      interval: s.interval,
      intervalMax: s.intervalMax,
      stops: s.stops.map((st) => ({
        id: allocStopId(st.id),
        realId: st.id,
        name: st.name,
        side: 'left'
      }))
    })
  })

  return migrateToGraph(nodes, segments, [])
}

export const useRoutesStore = defineStore('routes', () => {
  const routes = ref<RouteItem[]>([])

  const defaultRoutes: RouteItem[] = [
    {
      id: 1,
      number: '1',
      routeNumberRaw: '1',
      routeLetterRaw: '',
      name: 'вул. Білопільський шлях – Хіммістечко (Завод ГТВ)',
      status: 'Активний',
      pointsCount: 18,
      color: '#DC2626', // червоний
      length: '109 хв',
      selectedWorkMode: 1,
      timeStart: 360,
      timeEnd: 640,
      periodTimes: [
        { period: '06:00 - 08:30', travelTime: 109, interval: '14', intervalMax: '18' },
        { period: '08:30 - 15:30', travelTime: 96, interval: '18', intervalMax: '22' },
        { period: '15:30 - 19:00', travelTime: 104, interval: '15', intervalMax: '19' },
        { period: '19:00 - 22:00', travelTime: 90, interval: '22', intervalMax: '28' }
      ],
      graph: buildRouteGraph({
        topStop: { id: 16, name: 'вул. Білопільський шлях' },
        bottomStop: { id: 17, name: 'Хіммістечко (Завод ГТВ)', isDepot: true, canLunch: true },
        rightControls: [
          { id: 26, name: 'Покровська площа' },
          { id: 5, name: 'Універмаг «Київ»' },
          { id: 24, name: 'вул. Харківська' }
        ],
        leftControls: [
          { id: 25, name: 'вул. Харківська' },
          { id: 27, name: 'Покровська площа' }
        ],
        rightSegStops: [
          { travelTime: 12, interval: '18', intervalMax: '22', stops: [
            { id: 3, name: 'Центральний ринок' },
            { id: 28, name: 'вул. Троїцька' }
          ]},
          { travelTime: 15, interval: '18', intervalMax: '22', stops: [
            { id: 1, name: 'Залізничний вокзал' },
            { id: 32, name: 'вул. Металургів' },
            { id: 12, name: 'Автовокзал' }
          ]},
          { travelTime: 16, interval: '18', intervalMax: '22', stops: [
            { id: 30, name: 'пр-т Михайла Лушпи' },
            { id: 10, name: 'Сумський державний університет' },
            { id: 9, name: 'Тролейбусне депо (Хімпром)' }
          ]},
          { travelTime: 11, interval: '18', intervalMax: '22', stops: [
            { id: 7, name: 'АТ «Хімпром»' }
          ]}
        ],
        leftSegStops: [
          { travelTime: 16, interval: '18', intervalMax: '22', stops: [
            { id: 8, name: 'АТ «Хімпром»' },
            { id: 11, name: 'Сумський державний університет' }
          ]},
          { travelTime: 22, interval: '18', intervalMax: '22', stops: [
            { id: 31, name: 'пр-т Михайла Лушпи' },
            { id: 6, name: 'Універмаг «Київ»' },
            { id: 4, name: 'Центральний ринок' }
          ]},
          { travelTime: 17, interval: '18', intervalMax: '22', stops: [
            { id: 29, name: 'вул. Троїцька' },
            { id: 33, name: 'вул. Металургів' }
          ]}
        ]
      })
    },
    {
      id: 2,
      number: '2',
      routeNumberRaw: '2',
      routeLetterRaw: '',
      name: 'Автовокзал – Керамейя',
      status: 'Активний',
      pointsCount: 16,
      color: '#0284C7', // синій
      length: '98 хв',
      selectedWorkMode: 1,
      timeStart: 360,
      timeEnd: 640,
      periodTimes: [
        { period: '06:30 - 09:00', travelTime: 98, interval: '12', intervalMax: '16' },
        { period: '09:00 - 16:30', travelTime: 86, interval: '16', intervalMax: '20' },
        { period: '16:30 - 21:30', travelTime: 94, interval: '14', intervalMax: '18' }
      ],
      graph: buildRouteGraph({
        topStop: { id: 13, name: 'Автовокзал' },
        bottomStop: { id: 18, name: 'Керамейя', isDepot: true, canLunch: true },
        rightControls: [
          { id: 3, name: 'Центральний ринок' },
          { id: 26, name: 'Покровська площа' }
        ],
        leftControls: [
          { id: 27, name: 'Покровська площа' },
          { id: 4, name: 'Центральний ринок' }
        ],
        rightSegStops: [
          { travelTime: 16, interval: '15', intervalMax: '20', stops: [
            { id: 12, name: 'Автовокзал' },
            { id: 5, name: 'Універмаг «Київ»' }
          ]},
          { travelTime: 18, interval: '15', intervalMax: '20', stops: [
            { id: 28, name: 'вул. Троїцька' },
            { id: 1, name: 'Залізничний вокзал' },
            { id: 32, name: 'вул. Металургів' }
          ]},
          { travelTime: 15, interval: '15', intervalMax: '20', stops: [
            { id: 16, name: 'вул. Білопільський шлях' }
          ]}
        ],
        leftSegStops: [
          { travelTime: 16, interval: '15', intervalMax: '20', stops: [
            { id: 33, name: 'вул. Металургів' },
            { id: 2, name: 'Залізничний вокзал' }
          ]},
          { travelTime: 18, interval: '15', intervalMax: '20', stops: [
            { id: 29, name: 'вул. Троїцька' },
            { id: 6, name: 'Універмаг «Київ»' }
          ]},
          { travelTime: 15, interval: '15', intervalMax: '20', stops: [
            { id: 25, name: 'вул. Харківська' }
          ]}
        ]
      })
    },
    {
      id: 3,
      number: '5',
      routeNumberRaw: '5',
      routeLetterRaw: '',
      name: 'Роменська – АТ «Хімпром»',
      status: 'Активний',
      pointsCount: 17,
      color: '#8B5CF6', // фіолетовий
      length: '115 хв',
      selectedWorkMode: 1,
      timeStart: 360,
      timeEnd: 640,
      periodTimes: [
        { period: '05:45 - 08:15', travelTime: 115, interval: '11', intervalMax: '15' },
        { period: '08:15 - 15:00', travelTime: 102, interval: '15', intervalMax: '19' },
        { period: '15:00 - 18:45', travelTime: 110, interval: '12', intervalMax: '16' },
        { period: '18:45 - 22:30', travelTime: 98, interval: '20', intervalMax: '25' }
      ],
      graph: buildRouteGraph({
        topStop: { id: 19, name: 'Роменська' },
        bottomStop: { id: 7, name: 'АТ «Хімпром»', isDepot: true, canLunch: true },
        rightControls: [
          { id: 26, name: 'Покровська площа' },
          { id: 24, name: 'вул. Харківська' }
        ],
        leftControls: [
          { id: 25, name: 'вул. Харківська' },
          { id: 27, name: 'Покровська площа' }
        ],
        rightSegStops: [
          { travelTime: 18, interval: '14', intervalMax: '18', stops: [
            { id: 3, name: 'Центральний ринок' },
            { id: 5, name: 'Універмаг «Київ»' }
          ]},
          { travelTime: 20, interval: '14', intervalMax: '18', stops: [
            { id: 30, name: 'пр-т Михайла Лушпи' },
            { id: 10, name: 'Сумський державний університет' }
          ]},
          { travelTime: 19, interval: '14', intervalMax: '18', stops: [
            { id: 9, name: 'Тролейбусне депо (Хімпром)' },
            { id: 17, name: 'Хіммістечко (Завод ГТВ)' }
          ]}
        ],
        leftSegStops: [
          { travelTime: 19, interval: '14', intervalMax: '18', stops: [
            { id: 8, name: 'АТ «Хімпром»' },
            { id: 11, name: 'Сумський державний університет' }
          ]},
          { travelTime: 20, interval: '14', intervalMax: '18', stops: [
            { id: 31, name: 'пр-т Михайла Лушпи' },
            { id: 6, name: 'Універмаг «Київ»' }
          ]},
          { travelTime: 19, interval: '14', intervalMax: '18', stops: [
            { id: 4, name: 'Центральний ринок' }
          ]}
        ]
      })
    },
    {
      id: 4,
      number: '7',
      routeNumberRaw: '7',
      routeLetterRaw: '',
      name: 'Центроліт – Хіммістечко',
      status: 'Активний',
      pointsCount: 16,
      color: '#0D9488', // бірюзовий/зелений
      length: '88 хв',
      selectedWorkMode: 1,
      timeStart: 360,
      timeEnd: 640,
      periodTimes: [
        { period: '06:15 - 08:45', travelTime: 88, interval: '16', intervalMax: '20' },
        { period: '08:45 - 16:15', travelTime: 78, interval: '20', intervalMax: '25' },
        { period: '16:15 - 21:00', travelTime: 84, interval: '18', intervalMax: '22' }
      ],
      graph: buildRouteGraph({
        topStop: { id: 20, name: 'Центроліт' },
        bottomStop: { id: 17, name: 'Хіммістечко (Завод ГТВ)', isDepot: true, canLunch: true },
        rightControls: [
          { id: 32, name: 'вул. Металургів' },
          { id: 24, name: 'вул. Харківська' }
        ],
        leftControls: [
          { id: 25, name: 'вул. Харківська' },
          { id: 33, name: 'вул. Металургів' }
        ],
        rightSegStops: [
          { travelTime: 14, interval: '20', intervalMax: '25', stops: [
            { id: 16, name: 'вул. Білопільський шлях' },
            { id: 1, name: 'Залізничний вокзал' }
          ]},
          { travelTime: 16, interval: '20', intervalMax: '25', stops: [
            { id: 28, name: 'вул. Троїцька' },
            { id: 5, name: 'Універмаг «Київ»' }
          ]},
          { travelTime: 14, interval: '20', intervalMax: '25', stops: [
            { id: 10, name: 'Сумський державний університет' },
            { id: 9, name: 'Тролейбусне депо (Хімпром)' }
          ]}
        ],
        leftSegStops: [
          { travelTime: 14, interval: '20', intervalMax: '25', stops: [
            { id: 11, name: 'Сумський державний університет' },
            { id: 6, name: 'Універмаг «Київ»' }
          ]},
          { travelTime: 16, interval: '20', intervalMax: '25', stops: [
            { id: 29, name: 'вул. Троїцька' },
            { id: 2, name: 'Залізничний вокзал' }
          ]},
          { travelTime: 14, interval: '20', intervalMax: '25', stops: [
            { id: 3, name: 'Центральний ринок' }
          ]}
        ]
      })
    },
    {
      id: 5,
      number: '10А',
      routeNumberRaw: '10',
      routeLetterRaw: 'А',
      name: 'Пансіонат – Панфілова',
      status: 'Активний',
      pointsCount: 16,
      color: '#EA580C', // помаранчевий
      length: '92 хв',
      selectedWorkMode: 1,
      timeStart: 360,
      timeEnd: 640,
      periodTimes: [
        { period: '06:00 - 09:00', travelTime: 92, interval: '13', intervalMax: '17' },
        { period: '09:00 - 15:30', travelTime: 80, interval: '17', intervalMax: '21' },
        { period: '15:30 - 19:00', travelTime: 87, interval: '14', intervalMax: '18' },
        { period: '19:00 - 22:15', travelTime: 76, interval: '21', intervalMax: '26' }
      ],
      graph: buildRouteGraph({
        topStop: { id: 21, name: 'Пансіонат' },
        bottomStop: { id: 22, name: 'Панфілова', isDepot: false, canLunch: true },
        rightControls: [
          { id: 30, name: 'пр-т Михайла Лушпи' },
          { id: 26, name: 'Покровська площа' }
        ],
        leftControls: [
          { id: 27, name: 'Покровська площа' },
          { id: 31, name: 'пр-т Михайла Лушпи' }
        ],
        rightSegStops: [
          { travelTime: 15, interval: '16', intervalMax: '20', stops: [
            { id: 14, name: 'Вулиця Героїв Крут' },
            { id: 24, name: 'вул. Харківська' }
          ]},
          { travelTime: 16, interval: '16', intervalMax: '20', stops: [
            { id: 5, name: 'Універмаг «Київ»' },
            { id: 3, name: 'Центральний ринок' }
          ]},
          { travelTime: 15, interval: '16', intervalMax: '20', stops: [
            { id: 28, name: 'вул. Троїцька' },
            { id: 1, name: 'Залізничний вокзал' }
          ]}
        ],
        leftSegStops: [
          { travelTime: 15, interval: '16', intervalMax: '20', stops: [
            { id: 2, name: 'Залізничний вокзал' },
            { id: 29, name: 'вул. Троїцька' }
          ]},
          { travelTime: 16, interval: '16', intervalMax: '20', stops: [
            { id: 4, name: 'Центральний ринок' },
            { id: 6, name: 'Універмаг «Київ»' }
          ]},
          { travelTime: 15, interval: '16', intervalMax: '20', stops: [
            { id: 15, name: 'Вулиця Героїв Крут' }
          ]}
        ]
      })
    },
    {
      id: 6,
      number: '15А',
      routeNumberRaw: '15',
      routeLetterRaw: 'А',
      name: 'Залізничний вокзал – вул. Прокоф\'єва',
      status: 'Активний',
      pointsCount: 16,
      color: '#0284C7', // морський
      length: '102 хв',
      selectedWorkMode: 1,
      timeStart: 360,
      timeEnd: 640,
      periodTimes: [
        { period: '06:20 - 08:50', travelTime: 102, interval: '13', intervalMax: '16' },
        { period: '08:50 - 16:20', travelTime: 90, interval: '16', intervalMax: '20' },
        { period: '16:20 - 21:40', travelTime: 98, interval: '14', intervalMax: '18' }
      ],
      graph: buildRouteGraph({
        topStop: { id: 1, name: 'Залізничний вокзал' },
        bottomStop: { id: 23, name: 'вул. Прокоф\'єва', isDepot: false, canLunch: true },
        rightControls: [
          { id: 5, name: 'Універмаг «Київ»' },
          { id: 24, name: 'вул. Харківська' }
        ],
        leftControls: [
          { id: 25, name: 'вул. Харківська' },
          { id: 6, name: 'Універмаг «Київ»' }
        ],
        rightSegStops: [
          { travelTime: 17, interval: '15', intervalMax: '19', stops: [
            { id: 28, name: 'вул. Троїцька' },
            { id: 3, name: 'Центральний ринок' }
          ]},
          { travelTime: 17, interval: '15', intervalMax: '19', stops: [
            { id: 26, name: 'Покровська площа' },
            { id: 30, name: 'пр-т Михайла Лушпи' }
          ]},
          { travelTime: 17, interval: '15', intervalMax: '19', stops: [
            { id: 14, name: 'Вулиця Героїв Крут' }
          ]}
        ],
        leftSegStops: [
          { travelTime: 17, interval: '15', intervalMax: '19', stops: [
            { id: 15, name: 'Вулиця Героїв Крут' },
            { id: 31, name: 'пр-т Михайла Лушпи' }
          ]},
          { travelTime: 17, interval: '15', intervalMax: '19', stops: [
            { id: 27, name: 'Покровська площа' },
            { id: 4, name: 'Центральний ринок' }
          ]},
          { travelTime: 17, interval: '15', intervalMax: '19', stops: [
            { id: 29, name: 'вул. Троїцька' },
            { id: 2, name: 'Залізничний вокзал' }
          ]}
        ]
      })
    }
  ]

  const saved = localStorage.getItem('routes-storage-v4')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(r => r.graph && r.graph.nodes)) {
        routes.value = parsed
      } else {
        routes.value = defaultRoutes
      }
    } catch {
      routes.value = defaultRoutes
    }
  } else {
    routes.value = defaultRoutes
  }

  watch(routes, (val) => {
    localStorage.setItem('routes-storage-v4', JSON.stringify(val))
  }, { deep: true })

  function deleteRoute(id: number) {
    routes.value = routes.value.filter(r => r.id !== id)
  }

  function addRoute(newRoute: RouteItem) {
    routes.value.push(newRoute)
  }

  function updateRoute(id: number, updated: Partial<RouteItem>) {
    const idx = routes.value.findIndex(r => r.id === id)
    if (idx !== -1) {
      routes.value[idx] = { ...routes.value[idx], ...updated }
    }
  }

  return {
    routes,
    deleteRoute,
    addRoute,
    updateRoute,
    defaultRoutes
  }
})
