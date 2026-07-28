import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { Stop } from '../models/stop.js'

export const useStopsStore = defineStore('stops', () => {
    const stopsList = ref([])
    const isAddStopModalOpen = ref(false)
    const isDeleteMode = ref(false)

    // 1. ВІДНОВЛЕННЯ ДАНИХ
    const savedData = localStorage.getItem('stops-storage')
    let parsed = null
    try {
        if (savedData) {
            parsed = JSON.parse(savedData)
        }
    } catch (e) {}

    if (parsed && parsed.length > 0) {
        // Автоматична міграція з Київських зупинок на Сумські
        const hasKyivData = parsed.some(s => s.name.includes("Майдан") || s.name.includes("Золоті") || s.name.includes("Контрактова"));
        if (hasKyivData) {
            loadDefaultStops()
        } else {
            stopsList.value = parsed.map(s => new Stop(
                s.stopId,
                s.name,
                s.type || 'normal',
                s.directionCode || 1,
                s.directionComment || '',
                s.latitude || 0,
                s.longitude || 0,
                s.platformsCount || 1
            ))
        }
    } else {
        loadDefaultStops()
    }

    // 2. АВТОЗБЕРЕЖЕННЯ
    watch(stopsList, (state) => {
        localStorage.setItem('stops-storage', JSON.stringify(state))
    }, { deep: true })

    // 3. Завантаження базових зупинок (Тематика міста Суми)
    function loadDefaultStops() {
        stopsList.value = [
            // Залізничний вокзал (2 напрямки)
            new Stop(1, "Залізничний вокзал", "normal", 1, "В бік Центру (вул. Соборна)", 50.9238, 34.8048, 2),
            new Stop(2, "Залізничний вокзал", "normal", 2, "В бік вул. Привокзальна", 50.9242, 34.8055, 2),
            
            // Центральний ринок (2 напрямки)
            new Stop(3, "Центральний ринок", "normal", 1, "В бік Універмагу Київ", 50.9112, 34.7960, 2),
            new Stop(4, "Центральний ринок", "normal", 2, "В бік Автовокзалу", 50.9105, 34.7952, 2),
            
            // Універмаг «Київ» (2 напрямки)
            new Stop(5, "Універмаг «Київ»", "normal", 1, "В бік Набережної р. Стрілка", 50.9155, 34.8021, 2),
            new Stop(6, "Універмаг «Київ»", "normal", 2, "В бік Залізничного вокзалу", 50.9160, 34.8030, 2),
            
            // Хімпром (3 напрямки - кінцева і депо)
            new Stop(7, "АТ «Хімпром»", "end", 1, "Кінцева (розворотне кільце)", 50.8872, 34.8475, 3),
            new Stop(8, "АТ «Хімпром»", "normal", 2, "Вхідна прохідна", 50.8885, 34.8490, 1),
            new Stop(9, "Тролейбусне депо (Хімпром)", "depo", 3, "В'їзд до депо КП «Електроавтотранс»", 50.8902, 34.8432, 2),
            
            // СумДУ (2 напрямки)
            new Stop(10, "Сумський державний університет", "normal", 1, "В бік вул. Харківська", 50.8996, 34.8398, 2),
            new Stop(11, "Сумський державний університет", "normal", 2, "В бік Хімпрому", 50.8990, 34.8410, 2),

            // Автовокзал (2 напрямки)
            new Stop(12, "Автовокзал", "normal", 1, "В бік вул. Степана Бандери", 50.9038, 34.7798, 1),
            new Stop(13, "Автовокзал", "end", 2, "Кінцева міжміського сполучення", 50.9030, 34.7780, 3),

            // Героїв Крут (2 напрямки)
            new Stop(14, "Вулиця Героїв Крут", "normal", 1, "В бік пр-ту Михайла Лушпи", 50.8942, 34.8322, 2),
            new Stop(15, "Вулиця Героїв Крут", "end", 2, "Кінцева (9-й мікрорайон)", 50.8930, 34.8305, 2)
        ]
    }

    function addStop(stop) {
        const stopInstance = stop instanceof Stop
            ? stop
            : new Stop(stop.stopId, stop.name, stop.type, stop.directionCode, stop.directionComment, stop.latitude, stop.longitude, stop.platformsCount)
        
        const { isValid, errors } = stopInstance.validate()
        if (!isValid) {
            throw new Error(JSON.stringify(errors))
        }
        stopsList.value.push(stopInstance)
    }

    function updateStop(id, updatedStop) {
        const stopInstance = updatedStop instanceof Stop
            ? updatedStop
            : new Stop(updatedStop.stopId, updatedStop.name, updatedStop.type, updatedStop.directionCode, updatedStop.directionComment, updatedStop.latitude, updatedStop.longitude, updatedStop.platformsCount)
        
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
