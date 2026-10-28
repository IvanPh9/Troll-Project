// src/models/vehicle.js

export class Vehicle {
    constructor(vehicleId, boardNumber, model, type = 'bus') {
        this.vehicleId = vehicleId;
        this.boardNumber = boardNumber;
        this.model = model;
        this.type = type; // 'bus' або 'trolleybus'
        this.isActive = false;
    }

    validate() {
        const errors = {};

        // Перевірка vehicleId
        if (this.vehicleId !== null && this.vehicleId !== undefined) {
            const idNum = Number(this.vehicleId);
            if (isNaN(idNum) || idNum <= 0) {
                errors.vehicleId = "ID транспортного засобу має бути додатним числом";
            }
        }

        // Перевірка бортового номера
        if (!this.boardNumber || typeof this.boardNumber !== 'string' || this.boardNumber.trim().length === 0) {
            errors.boardNumber = "Бортовий номер не може бути порожнім";
        } else if (this.boardNumber.trim().length > 50) {
            errors.boardNumber = "Бортовий номер не може перевищувати 50 символів";
        }

        // Перевірка моделі
        if (!this.model || typeof this.model !== 'string' || this.model.trim().length < 2) {
            errors.model = "Модель має містити щонайменше 2 символи";
        } else if (this.model.trim().length > 100) {
            errors.model = "Модель не може перевищувати 100 символів";
        }

        // Перевірка типу ТЗ
        if (!this.type || (this.type !== 'bus' && this.type !== 'trolleybus')) {
            errors.type = "Тип транспортного засобу має бути 'bus' (Автобус) або 'trolleybus' (Тролейбус)";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
}

// Конкретний клас для автобуса
export class Bus extends Vehicle {
    constructor(vehicleId, boardNumber, model) {
        super(vehicleId, boardNumber, model, 'bus');
    }
}

// Конкретний клас для тролейбуса
export class Trolleybus extends Vehicle {
    constructor(vehicleId, boardNumber, model, hasBatteryAutonomous = false) {
        super(vehicleId, boardNumber, model, 'trolleybus');
        this.hasBatteryAutonomous = !!hasBatteryAutonomous;
    }

    validate() {
        const result = super.validate();
        if (this.hasBatteryAutonomous !== undefined && typeof this.hasBatteryAutonomous !== 'boolean') {
            result.errors.hasBatteryAutonomous = "Поле 'Автономний хід від батареї' має бути булевим значенням";
            result.isValid = false;
        }
        return result;
    }
}

// Успадковуємо базовий клас для активного транспортного засобу (на рейсі)
export class ActiveVehicle extends Vehicle {
    constructor(vehicleId, boardNumber, model, type = 'bus', currentRoute = null) {
        // Викликаємо конструктор батьківського класу
        super(vehicleId, boardNumber, model, type);

        // Специфічні поля для активного ТЗ
        this.currentRoute = currentRoute;
        this.isActive = true;
    }

    static [Symbol.hasInstance](instance) {
        return instance && instance.isActive === true;
    }
}

// Активний автобус
export class ActiveBus extends Bus {
    constructor(vehicleId, boardNumber, model, currentRoute = null) {
        super(vehicleId, boardNumber, model);
        this.currentRoute = currentRoute;
        this.isActive = true;
    }
}

// Активний тролейбус
export class ActiveTrolleybus extends Trolleybus {
    constructor(vehicleId, boardNumber, model, hasBatteryAutonomous = false, currentRoute = null) {
        super(vehicleId, boardNumber, model, hasBatteryAutonomous);
        this.currentRoute = currentRoute;
        this.isActive = true;
    }
}

