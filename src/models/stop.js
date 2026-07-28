// src/models/stop.js

export class Stop {
    constructor(stopId, name, type = 'normal', directionCode = 1, directionComment = '', latitude = 0, longitude = 0, platformsCount = 1) {
        this.stopId = stopId;
        this.name = name;
        this.type = type; // 'depo', 'end', або 'normal'
        this.directionCode = directionCode; // для однакових назв зупинок - різні коди напрямку
        this.directionComment = directionComment; // коментар до напрямку руху
        this.platformsCount = platformsCount; // кількість платформ на зупинці

        // Гнучке парсування координат "як у Google" (підтримка чисел, comma-separated рядків та посилань Google Maps)
        this.latitude = 0;
        this.longitude = 0;
        this.parseCoordinates(latitude, longitude);
    }

    // Метод парсування координат з різних форматів Google Maps
    parseCoordinates(latInput, lngInput) {
        this._originalCoordinateInput = latInput;
        if (typeof latInput === 'string') {
            const trimmed = latInput.trim();
            // 1. Якщо це посилання Google Maps
            if (trimmed.includes('google.com/maps') || trimmed.includes('maps.app.goo.gl')) {
                const match = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (match) {
                    this.latitude = parseFloat(match[1]);
                    this.longitude = parseFloat(match[2]);
                    return;
                }
            }
            
            // 2. Якщо це скопійований рядок координат "50.4501, 30.5234"
            if (trimmed.includes(',')) {
                const parts = trimmed.split(',');
                this.latitude = parseFloat(parts[0].trim()) || 0;
                this.longitude = parseFloat(parts[1].trim()) || 0;
                return;
            }

            // 3. Звичайний рядок для широти
            this.latitude = parseFloat(trimmed) || 0;
        } else {
            this.latitude = Number(latInput) || 0;
        }

        // Парсуємо довготу, якщо її передано окремо
        if (typeof lngInput === 'string') {
            this.longitude = parseFloat(lngInput.trim()) || 0;
        } else {
            this.longitude = Number(lngInput) || 0;
        }
    }

    // Повертає посилання на Google Maps для цієї зупинки
    getGoogleMapsUrl() {
        return `https://www.google.com/maps?q=${this.latitude},${this.longitude}`;
    }

    // Повертає координати у стандартному форматі Google "широта, довгота"
    getLatLngString() {
        return `${this.latitude}, ${this.longitude}`;
    }

    validate() {
        const errors = {};

        // Перевірка stopId
        if (this.stopId !== null && this.stopId !== undefined) {
            const idNum = Number(this.stopId);
            if (isNaN(idNum) || idNum <= 0) {
                errors.stopId = "ID зупинки має бути додатним числом";
            }
        }

        // Перевірка назви
        if (!this.name || typeof this.name !== 'string' || this.name.trim().length < 2) {
            errors.name = "Назва зупинки має містити щонайменше 2 символи";
        } else if (this.name.trim().length > 100) {
            errors.name = "Назва зупинки не може перевищувати 100 символів";
        }

        // Перевірка типу
        if (!this.type || (this.type !== 'depo' && this.type !== 'end' && this.type !== 'normal')) {
            errors.type = "Тип зупинки має бути 'depo' (Депо), 'end' (Кінцева) або 'normal' (Звичайна)";
        }

        // Перевірка коду напрямку
        const dirCode = Number(this.directionCode);
        if (this.directionCode === null || this.directionCode === undefined || isNaN(dirCode) || dirCode <= 0) {
            errors.directionCode = "Код напрямку має бути додатним числом";
        }

        // Перевірка коментаря до напрямку
        if (this.directionComment && typeof this.directionComment !== 'string') {
            errors.directionComment = "Коментар до напрямку має бути текстовим значенням";
        } else if (this.directionComment && this.directionComment.trim().length > 255) {
            errors.directionComment = "Коментар до напрямку не може перевищувати 255 символів";
        }

        // Перевірка кількості платформ
        const platCount = Number(this.platformsCount);
        if (this.platformsCount === null || this.platformsCount === undefined || isNaN(platCount) || !Number.isInteger(platCount) || platCount <= 0) {
            errors.platformsCount = "Кількість платформ має бути додатним цілим числом";
        }

        // Перевірка координат
        const latNum = Number(this.latitude);
        const lngNum = Number(this.longitude);
        
        if (typeof this._originalCoordinateInput === 'string' && this._originalCoordinateInput.includes('maps.app.goo.gl')) {
            errors.coordinates = "Короткі посилання (maps.app.goo.gl) не підтримуються. Будь ласка, скопіюйте самі координати (напр. 50.9077, 34.7981) або повне посилання з @широта,довгота.";
        } else if (isNaN(latNum) || latNum < -90 || latNum > 90) {
            errors.coordinates = "Широта має бути числом від -90 до +90";
        } else if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
            errors.coordinates = "Довгота має бути числом від -180 до +180";
        } else if (latNum === 0 && lngNum === 0) {
            errors.coordinates = "Координати (0, 0) не допускаються або формат не розпізнано. Введіть координати у форматі 'широта, довгота'.";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
}
