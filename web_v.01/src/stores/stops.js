import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { Stop } from '../models/stop.js'

export const useStopsStore = defineStore('stops', () => {
    const stopsList = ref([])
    const isAddStopModalOpen = ref(false)
    const isDeleteMode = ref(false)

    function getDefaultStopsArray() {
        return [
            // Залізничний вокзал (2 напрямки)
            new Stop(1, "Залізничний вокзал", "normal", 1, "В бік Центру (вул. Соборна)", 50.9238, 34.8048, 1, { 9: 15 }),
            new Stop(2, "Залізничний вокзал", "normal", 2, "В бік вул. Привокзальна", 50.9242, 34.8055, 1, { 9: 15 }),
            
            // Центральний ринок (2 напрямки)
            new Stop(3, "Центральний ринок", "normal", 1, "В бік Універмагу Київ", 50.9112, 34.7960, 1, { 9: 12 }),
            new Stop(4, "Центральний ринок", "normal", 2, "В бік Автовокзалу", 50.9105, 34.7952, 1, { 9: 12 }),
            
            // Універмаг «Київ» (2 напрямки)
            new Stop(5, "Універмаг «Київ»", "normal", 1, "В бік Набережної р. Стрілка", 50.9155, 34.8021, 1, { 9: 14 }),
            new Stop(6, "Універмаг «Київ»", "normal", 2, "В бік Залізничного вокзалу", 50.9160, 34.8030, 1, { 9: 14 }),
            
            // Хімпром (3 напрямки - кінцева і депо)
            new Stop(7, "АТ «Хімпром»", "normal", 1, "Кінцева (розворотне кільце)", 50.8872, 34.8475, 1, { 9: 3 }),
            new Stop(8, "АТ «Хімпром»", "normal", 2, "Вхідна прохідна", 50.8885, 34.8490, 1, { 9: 4 }),
            new Stop(9, "Тролейбусне депо (Хімпром)", "depo", 3, "В'їзд до депо КП «Електроавтотранс»", 50.8902, 34.8432, 1),
            
            // СумДУ (2 напрямки)
            new Stop(10, "Сумський державний університет", "normal", 1, "В бік вул. Харківська", 50.8996, 34.8398, 1, { 9: 6 }),
            new Stop(11, "Сумський державний університет", "normal", 2, "В бік Хімпрому", 50.8990, 34.8410, 1, { 9: 6 }),

            // Автовокзал (2 напрямки)
            new Stop(12, "Автовокзал", "normal", 1, "В бік вул. Степана Бандери", 50.9038, 34.7798, 1, { 9: 18 }),
            new Stop(13, "Автовокзал", "normal", 2, "Кінцева міжміського сполучення", 50.9030, 34.7780, 1, { 9: 18 }),

            // Героїв Крут (2 напрямки)
            new Stop(14, "Вулиця Героїв Крут", "normal", 1, "В бік пр-ту Михайла Лушпи", 50.8942, 34.8322, 1, { 9: 8 }),
            new Stop(15, "Вулиця Героїв Крут", "normal", 2, "Кінцева (9-й мікрорайон)", 50.8930, 34.8305, 1, { 9: 8 }),

            // Додаткові кінцеві та проміжні зупинки маршрутів м. Суми
            new Stop(16, "вул. Білопільський шлях", "normal", 1, "Кінцева (Білопільський шлях)", 50.9385, 34.7640, 1, { 9: 22 }),
            new Stop(17, "Хіммістечко (Завод ГТВ)", "normal", 1, "Кінцева (Завод ГТВ)", 50.8895, 34.8380, 1, { 9: 4 }),
            new Stop(18, "Керамейя", "normal", 1, "Кінцева (Завод Керамейя)", 50.9445, 34.7820, 1, { 9: 24 }),
            new Stop(19, "Роменська", "normal", 1, "Кінцева (вул. Роменська)", 50.8965, 34.7620, 1, { 9: 20 }),
            new Stop(20, "Центроліт", "normal", 1, "Кінцева (Завод Центроліт)", 50.9540, 34.7750, 1, { 9: 25 }),
            new Stop(21, "Пансіонат", "normal", 1, "Кінцева (Пансіонат)", 50.9390, 34.8280, 1, { 9: 19 }),
            new Stop(22, "Панфілова", "normal", 1, "Кінцева (вул. Панфілова)", 50.8950, 34.7720, 1, { 9: 17 }),
            new Stop(23, "вул. Прокоф'єва", "normal", 1, "Кінцева (вул. Прокоф'єва)", 50.8910, 34.8120, 1, { 9: 10 }),
            new Stop(24, "вул. Харківська", "normal", 1, "В бік Хіммістечка", 50.9035, 34.8180, 1, { 9: 9 }),
            new Stop(25, "вул. Харківська", "normal", 2, "В бік Центру", 50.9040, 34.8175, 1, { 9: 9 }),
            new Stop(26, "Покровська площа", "normal", 1, "В бік вул. Соборна", 50.9075, 34.7985, 1, { 9: 13 }),
            new Stop(27, "Покровська площа", "normal", 2, "В бік вул. Роменська", 50.9070, 34.7978, 1, { 9: 13 }),
            new Stop(28, "вул. Троїцька", "normal", 1, "В бік Залізничного вокзалу", 50.9165, 34.8110, 1, { 9: 14 }),
            new Stop(29, "вул. Троїцька", "normal", 2, "В бік Центру", 50.9160, 34.8105, 1, { 9: 14 }),
            new Stop(30, "пр-т Михайла Лушпи", "normal", 1, "В бік ТРЦ Лавина", 50.9010, 34.8260, 1, { 9: 8 }),
            new Stop(31, "пр-т Михайла Лушпи", "normal", 2, "В бік вул. Харківська", 50.9015, 34.8255, 1, { 9: 8 }),
            new Stop(32, "вул. Металургів", "normal", 1, "В бік Центру", 50.9220, 34.7890, 1, { 9: 16 }),
            new Stop(33, "вул. Металургів", "normal", 2, "В бік вул. Білопільський шлях", 50.9225, 34.7885, 1, { 9: 16 })
        ]
    }

    function loadDefaultStops() {
        stopsList.value = getDefaultStopsArray()
    }

    // 1. ВІДНОВЛЕННЯ ДАНИХ
    const savedData = localStorage.getItem('stops-storage')
    let parsed = null
    try {
        if (savedData) {
            parsed = JSON.parse(savedData)
        }
    } catch (e) {}

    if (parsed && parsed.length > 0) {
        const hasKyivData = parsed.some(s => s.name.includes("Майдан") || s.name.includes("Золоті") || s.name.includes("Контрактова"));
        if (hasKyivData) {
            loadDefaultStops()
        } else {
            const loaded = parsed.map(s => new Stop(
                s.stopId,
                s.name,
                s.type === 'depo' ? 'depo' : 'normal',
                s.directionCode || 1,
                s.directionComment || '',
                s.latitude || 0,
                s.longitude || 0,
                s.platformsCount || 1,
                s.depotTravelTimes || {}
            ))
            // Доповнюємо базовими зупинками, якщо їх ще не було в кеші
            const defaults = getDefaultStopsArray()
            defaults.forEach(defStop => {
                if (!loaded.some(item => item.stopId === defStop.stopId)) {
                    loaded.push(defStop)
                }
            })
            stopsList.value = loaded
        }
    } else {
        loadDefaultStops()
    }

    // 2. АВТОЗБЕРЕЖЕННЯ
    watch(stopsList, (state) => {
        localStorage.setItem('stops-storage', JSON.stringify(state))
    }, { deep: true })

    function addStop(stop) {
        const stopInstance = stop instanceof Stop
            ? stop
            : new Stop(stop.stopId, stop.name, stop.type, stop.directionCode, stop.directionComment, stop.latitude, stop.longitude, stop.platformsCount, stop.depotTravelTimes)
        
        const { isValid, errors } = stopInstance.validate()
        if (!isValid) {
            throw new Error(JSON.stringify(errors))
        }
        stopsList.value.push(stopInstance)
    }

    function updateStop(id, updatedStop) {
        const stopInstance = updatedStop instanceof Stop
            ? updatedStop
            : new Stop(updatedStop.stopId, updatedStop.name, updatedStop.type, updatedStop.directionCode, updatedStop.directionComment, updatedStop.latitude, updatedStop.longitude, updatedStop.platformsCount, updatedStop.depotTravelTimes)
        
        const { isValid, errors } = stopInstance.validate()
        if (!isValid) {
            throw new Error(JSON.stringify(errors))
        }
        const index = stopsList.value.findIndex(s => s.stopId === id)
        if (index !== -1) {
            stopsList.value[index] = stopInstance
        }
    }

    function deleteStop(id) {
        stopsList.value = stopsList.value.filter(s => s.stopId !== id)
    }

    return {
        stopsList,
        isAddStopModalOpen,
        isDeleteMode,
        addStop,
        updateStop,
        deleteStop,
        loadDefaultStops
    }
})
