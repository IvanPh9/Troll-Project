import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { Vehicle, ActiveVehicle, Bus, Trolleybus, ActiveBus, ActiveTrolleybus } from '../models/vehicle.js'

export const useVehiclesStore = defineStore('vehicles', () => {
    const vehiclesList = ref([])
    const isDeleteMode = ref(false)
    const isAssignRouteMode = ref(false)
    const isAddVehicleModalOpen = ref(false)

    // 1. ВІДНОВЛЕННЯ ДАНИХ: При запуску перевіряємо, чи є збережені дані в браузері
    const savedData = localStorage.getItem('vehicles-storage')
    let parsed = null
    try {
        if (savedData) {
            parsed = JSON.parse(savedData)
        }
    } catch (e) {}

    // Перевіряємо, чи є в збережених даних поле 'type'. Якщо немає (стара схема), змушуємо оновитися
    const hasType = parsed && parsed.length > 0 && ('type' in parsed[0])

    if (parsed && parsed.length >= 10 && hasType) {
        // JSON перетворює класи на звичайні об'єкти, тому нам треба відновити їхні типи
        vehiclesList.value = parsed.map(v => {
            const hasBattery = !!v.hasBatteryAutonomous;
            if (v.isActive) {
                if (v.type === 'trolleybus') {
                    return new ActiveTrolleybus(v.vehicleId, v.boardNumber, v.model, hasBattery, v.currentRoute)
                } else {
                    return new ActiveBus(v.vehicleId, v.boardNumber, v.model, v.currentRoute)
                }
            } else {
                if (v.type === 'trolleybus') {
                    return new Trolleybus(v.vehicleId, v.boardNumber, v.model, hasBattery)
                } else {
                    return new Bus(v.vehicleId, v.boardNumber, v.model)
                }
            }
        })
    } else {
        // Завантажуємо стартову базу з 100 ТЗ
        loadVehicles()
    }

    // 2. АВТОЗБЕРЕЖЕННЯ: Слідкуємо за масивом і зберігаємо в браузер при будь-яких змінах
    watch(vehiclesList, (state) => {
        localStorage.setItem('vehicles-storage', JSON.stringify(state))
    }, { deep: true })

    // 3. Метод завантаження базових даних (100 ТЗ)
    function loadVehicles() {
        const vehicleModels = [
            "Bogdan T701",
            "Mercedes-Benz Citaro",
            "Solaris Urbino 12",
            "MAN Lion's City",
            "ElectroLAZ-12",
            "Ataman A092",
            "ZAZ A10C",
            "Etalon A081",
            "Volvo 7900",
            "Iveco Urbanway"
        ];
        
        const generated = [];
        // Додаємо перших 3 фіксованих
        generated.push(new Bus(1, "001", "Mercedes-Benz Citaro"));
        generated.push(new ActiveTrolleybus(2, "002", "Bogdan T701", true, "Рейс 4B"));
        generated.push(new ActiveBus(3, "003", "Solaris Urbino 12", "Рейс 7C"));
        
        for (let i = 4; i <= 100; i++) {
            const model = vehicleModels[Math.floor(Math.random() * vehicleModels.length)];
            const boardNumber = String(100 + i); // Наприклад, "104", "105" ...
            const type = (model === "Bogdan T701" || model === "ElectroLAZ-12") ? "trolleybus" : "bus";
            const hasBattery = type === 'trolleybus' ? (Math.random() < 0.5) : false;
            
            if (Math.random() < 0.25) {
                const routeNum = Math.floor(1 + Math.random() * 30);
                const routeLetter = ["A", "B", "C", "D", "E"][Math.floor(Math.random() * 5)];
                if (type === 'trolleybus') {
                    generated.push(new ActiveTrolleybus(i, boardNumber, model, hasBattery, `Рейс ${routeNum}${routeLetter}`));
                } else {
                    generated.push(new ActiveBus(i, boardNumber, model, `Рейс ${routeNum}${routeLetter}`));
                }
            } else {
                if (type === 'trolleybus') {
                    generated.push(new Trolleybus(i, boardNumber, model, hasBattery));
                } else {
                    generated.push(new Bus(i, boardNumber, model));
                }
            }
        }
        vehiclesList.value = generated;
    }

    function addVehicle(vehicle) {
        const vehicleInstance = vehicle instanceof Vehicle
            ? vehicle
            : (vehicle.isActive 
                ? (vehicle.type === 'trolleybus'
                    ? new ActiveTrolleybus(vehicle.vehicleId, vehicle.boardNumber, vehicle.model, !!vehicle.hasBatteryAutonomous, vehicle.currentRoute)
                    : new ActiveBus(vehicle.vehicleId, vehicle.boardNumber, vehicle.model, vehicle.currentRoute))
                : (vehicle.type === 'trolleybus'
                    ? new Trolleybus(vehicle.vehicleId, vehicle.boardNumber, vehicle.model, !!vehicle.hasBatteryAutonomous)
                    : new Bus(vehicle.vehicleId, vehicle.boardNumber, vehicle.model)));

        const { isValid, errors } = vehicleInstance.validate()
        if (!isValid) {
            throw new Error(JSON.stringify(errors))
        }
        vehiclesList.value.push(vehicleInstance)
    }

    function updateVehicle(id, updatedVehicle) {
        const vehicleInstance = updatedVehicle instanceof Vehicle
            ? updatedVehicle
            : (updatedVehicle.isActive 
                ? (updatedVehicle.type === 'trolleybus'
                    ? new ActiveTrolleybus(updatedVehicle.vehicleId, updatedVehicle.boardNumber, updatedVehicle.model, !!updatedVehicle.hasBatteryAutonomous, updatedVehicle.currentRoute)
                    : new ActiveBus(updatedVehicle.vehicleId, updatedVehicle.boardNumber, updatedVehicle.model, updatedVehicle.currentRoute))
                : (updatedVehicle.type === 'trolleybus'
                    ? new Trolleybus(updatedVehicle.vehicleId, updatedVehicle.boardNumber, updatedVehicle.model, !!updatedVehicle.hasBatteryAutonomous)
                    : new Bus(updatedVehicle.vehicleId, updatedVehicle.boardNumber, updatedVehicle.model)));

        const { isValid, errors } = vehicleInstance.validate()
        if (!isValid) {
            throw new Error(JSON.stringify(errors))
        }
        const index = vehiclesList.value.findIndex(v => v.vehicleId === id)
        if (index !== -1) {
            vehiclesList.value[index] = vehicleInstance
        }
    }

    function deleteVehicle(id) {
        vehiclesList.value = vehiclesList.value.filter(v => v.vehicleId !== id)
    }

    // Дія: Вивести ТЗ на рейс
    function activateVehicle(id, routeName) {
        const index = vehiclesList.value.findIndex(v => v.vehicleId === id)

        if (index !== -1) {
            const oldVal = vehiclesList.value[index]
            if (oldVal.type === 'trolleybus') {
                vehiclesList.value[index] = new ActiveTrolleybus(
                    oldVal.vehicleId,
                    oldVal.boardNumber,
                    oldVal.model,
                    !!oldVal.hasBatteryAutonomous,
                    routeName
                )
            } else {
                vehiclesList.value[index] = new ActiveBus(
                    oldVal.vehicleId,
                    oldVal.boardNumber,
                    oldVal.model,
                    routeName
                )
            }
        }
    }

    // Дія: Зняти ТЗ з рейсу
    function deactivateVehicle(id) {
        const index = vehiclesList.value.findIndex(v => v.vehicleId === id)

        if (index !== -1) {
            const oldVal = vehiclesList.value[index]
            if (oldVal.type === 'trolleybus') {
                vehiclesList.value[index] = new Trolleybus(
                    oldVal.vehicleId,
                    oldVal.boardNumber,
                    oldVal.model,
                    !!oldVal.hasBatteryAutonomous
                )
            } else {
                vehiclesList.value[index] = new Bus(
                    oldVal.vehicleId,
                    oldVal.boardNumber,
                    oldVal.model
                )
            }
        }
    }

    const getVehicleById = computed(() => {
        return (id) => vehiclesList.value.find(v => v.vehicleId === id)
    })

    const activeVehicles = computed(() => {
        return vehiclesList.value.filter(v => v instanceof ActiveVehicle)
    })

    return {
        vehiclesList,
        activeVehicles,
        activateVehicle,
        deactivateVehicle,
        getVehicleById,
        loadVehicles,
        addVehicle,
        updateVehicle,
        deleteVehicle,
        isDeleteMode,
        isAssignRouteMode,
        isAddVehicleModalOpen
    }
})
