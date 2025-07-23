/**
 * Базовый класс для всех аудиоэффектов
 * Обеспечивает единый интерфейс и общую функциональность
 */

export class BaseEffect {
    constructor(audioContext, effectType, config = {}) {
        this.audioContext = audioContext;
        this.effectType = effectType;
        this.config = config;
        this.enabled = config.enabled !== false;
        
        // Создание входных и выходных узлов
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        this.bypass = this.audioContext.createGain();
        
        // Узел для включения/выключения эффекта
        this.wetGain = this.audioContext.createGain();
        this.dryGain = this.audioContext.createGain();
        
        // Начальная настройка bypass
        this.setupBypass();
        
        // Метрики производительности
        this.performance = {
            processingTime: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            lastProcessTime: 0
        };
        
        // ID для идентификации эффекта
        this.id = this.generateId();
        
        console.log(`BaseEffect ${this.effectType} создан с ID: ${this.id}`);
    }

    generateId() {
        return `${this.effectType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    setupBypass() {
        // Настройка bypass маршрутизации
        if (this.enabled) {
            // Эффект включен: сигнал проходит через обработку
            this.input.connect(this.wetGain);
            this.input.connect(this.dryGain);
            this.dryGain.connect(this.bypass);
            this.bypass.connect(this.output);
            
            // Настройка уровней
            this.wetGain.gain.value = 1.0;
            this.dryGain.gain.value = 0.0;
        } else {
            // Эффект выключен: сигнал идет напрямую
            this.input.connect(this.output);
            this.wetGain.gain.value = 0.0;
            this.dryGain.gain.value = 1.0;
        }
    }

    // Абстрактные методы, которые должны быть реализованы в наследниках
    async processAudio(inputBuffer) {
        throw new Error('processAudio() должен быть реализован в наследнике');
    }

    updateParameter(name, value) {
        throw new Error('updateParameter() должен быть реализован в наследнике');
    }

    getParameters() {
        throw new Error('getParameters() должен быть реализован в наследнике');
    }

    // Общие методы для всех эффектов
    setEnabled(enabled) {
        if (this.enabled === enabled) return;
        
        this.enabled = enabled;
        this.updateBypass();
        
        console.log(`Эффект ${this.effectType} ${enabled ? 'включен' : 'выключен'}`);
    }

    updateBypass() {
        const currentTime = this.audioContext.currentTime;
        const fadeTime = 0.01; // 10ms fade для избежания щелчков
        
        if (this.enabled) {
            // Включение эффекта
            this.wetGain.gain.linearRampToValueAtTime(1.0, currentTime + fadeTime);
            this.dryGain.gain.linearRampToValueAtTime(0.0, currentTime + fadeTime);
        } else {
            // Выключение эффекта (bypass)
            this.wetGain.gain.linearRampToValueAtTime(0.0, currentTime + fadeTime);
            this.dryGain.gain.linearRampToValueAtTime(1.0, currentTime + fadeTime);
        }
    }

    isEnabled() {
        return this.enabled;
    }

    getEffectType() {
        return this.effectType;
    }

    getId() {
        return this.id;
    }

    // Подключение к другим узлам
    connectTo(destination) {
        if (destination.input) {
            // Подключение к другому эффекту
            this.output.connect(destination.input);
        } else {
            // Подключение к Web Audio узлу
            this.output.connect(destination);
        }
    }

    disconnectFrom(destination) {
        if (destination.input) {
            this.output.disconnect(destination.input);
        } else {
            this.output.disconnect(destination);
        }
    }

    // Методы для мониторинга производительности
    startPerformanceMeasure() {
        this.performance.lastProcessTime = performance.now();
    }

    endPerformanceMeasure() {
        const endTime = performance.now();
        this.performance.processingTime = endTime - this.performance.lastProcessTime;
        this.updatePerformanceMetrics();
    }

    updatePerformanceMetrics() {
        // Примерная оценка CPU usage на основе времени обработки
        const bufferDuration = (this.config.bufferSize || 512) / (this.audioContext.sampleRate || 48000) * 1000;
        this.performance.cpuUsage = (this.performance.processingTime / bufferDuration) * 100;
        
        // Ограничиваем значения
        this.performance.cpuUsage = Math.min(100, Math.max(0, this.performance.cpuUsage));
    }

    getPerformanceMetrics() {
        return {
            ...this.performance,
            effectType: this.effectType,
            id: this.id,
            enabled: this.enabled
        };
    }

    // Методы для сериализации состояния
    serialize() {
        return {
            id: this.id,
            effectType: this.effectType,
            enabled: this.enabled,
            parameters: this.getParameters(),
            config: this.config
        };
    }

    deserialize(data) {
        if (data.id) this.id = data.id;
        if (data.enabled !== undefined) this.setEnabled(data.enabled);
        if (data.parameters) {
            Object.keys(data.parameters).forEach(param => {
                try {
                    this.updateParameter(param, data.parameters[param]);
                } catch (error) {
                    console.warn(`Не удалось восстановить параметр ${param}:`, error);
                }
            });
        }
    }

    // Методы для отладки
    getDebugInfo() {
        return {
            id: this.id,
            type: this.effectType,
            enabled: this.enabled,
            performance: this.performance,
            inputConnections: this.input.numberOfInputs,
            outputConnections: this.output.numberOfOutputs,
            audioContext: {
                sampleRate: this.audioContext.sampleRate,
                currentTime: this.audioContext.currentTime,
                state: this.audioContext.state
            }
        };
    }

    // Валидация параметров
    validateParameter(name, value, constraints = {}) {
        if (constraints.min !== undefined && value < constraints.min) {
            console.warn(`Параметр ${name} меньше минимума (${constraints.min}), установлено: ${constraints.min}`);
            return constraints.min;
        }
        
        if (constraints.max !== undefined && value > constraints.max) {
            console.warn(`Параметр ${name} больше максимума (${constraints.max}), установлено: ${constraints.max}`);
            return constraints.max;
        }
        
        if (constraints.type && typeof value !== constraints.type) {
            throw new Error(`Параметр ${name} должен быть типа ${constraints.type}, получен: ${typeof value}`);
        }
        
        return value;
    }

    // Плавное изменение параметров для избежания щелчков
    smoothParameterChange(audioParam, targetValue, duration = 0.1) {
        const currentTime = this.audioContext.currentTime;
        audioParam.cancelScheduledValues(currentTime);
        audioParam.setValueAtTime(audioParam.value, currentTime);
        audioParam.linearRampToValueAtTime(targetValue, currentTime + duration);
    }

    // Очистка ресурсов
    dispose() {
        // Отключение всех соединений
        try {
            this.input.disconnect();
            this.output.disconnect();
            this.wetGain.disconnect();
            this.dryGain.disconnect();
            this.bypass.disconnect();
        } catch (error) {
            console.warn('Ошибка при отключении узлов:', error);
        }
        
        // Очистка ссылок
        this.input = null;
        this.output = null;
        this.wetGain = null;
        this.dryGain = null;
        this.bypass = null;
        this.audioContext = null;
        
        console.log(`BaseEffect ${this.effectType} (${this.id}) очищен`);
    }
}