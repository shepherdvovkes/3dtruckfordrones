/**
 * Конфигурация аудиоконвейера для NPU Silicon M1
 */

export const PipelineConfig = {
    // Входные параметры
    input: {
        sampleRate: 48000,
        bufferSize: 512,
        channels: 2,
        bitDepth: 32,
        preferredDevice: 'WB Cable', // Совместимость с существующим кодом
        autoGainControl: false,
        noiseSuppression: false,
        echoCancellation: false
    },

    // Настройки эффектов
    effects: {
        reverb: {
            enabled: true,
            roomSize: 0.5,          // 0.0 - 1.0
            decayTime: 2.0,         // секунды
            damping: 0.5,           // высокочастотное затухание
            wetMix: 0.3,            // уровень обработанного сигнала
            dryMix: 0.7,            // уровень оригинального сигнала
            preDelay: 0.03,         // предварительная задержка (сек)
            lowShelf: {
                frequency: 200,      // Гц
                gain: 0             // дБ
            },
            highShelf: {
                frequency: 4000,     // Гц
                gain: -2            // дБ
            }
        }
    },

    // Выходные параметры
    output: {
        sampleRate: 48000,
        channels: 2,
        format: 'float32',
        bufferSize: 512
    },

    // NPU/M1 оптимизации
    npu: {
        useNeuralEngine: true,      // Использовать Neural Engine
        preferGPU: true,            // Предпочтительно GPU для тяжелых вычислений
        useMetal: true,             // Использовать Metal Performance Shaders
        maxLatency: 10,             // максимальная латентность в мс
        threadCount: 4,             // количество потоков для обработки
        memoryAlignment: 64,        // выравнивание памяти в байтах
        vectorized: true,           // использовать векторизованные операции
        precisionMode: 'mixed'      // mixed, full, half precision
    },

    // Мониторинг производительности
    performance: {
        enableMonitoring: true,
        metricsInterval: 1000,      // интервал сбора метрик в мс
        logPerformance: true,
        adaptiveOptimization: true,  // автоматическая оптимизация
        cpuThreshold: 80,           // % загрузки CPU для переключения на GPU
        memoryThreshold: 85         // % использования памяти
    },

    // Буферизация
    buffering: {
        inputBuffers: 3,            // количество входных буферов
        outputBuffers: 2,           // количество выходных буферов
        processBuffers: 4,          // буферы для обработки
        ringBufferSize: 8192,       // размер кольцевого буфера
        preloadSamples: 1024        // предзагрузка сэмплов
    },

    // Отладка и разработка
    debug: {
        enabled: false,
        logLevel: 'info',           // error, warn, info, debug
        measureLatency: true,
        profileMemory: false,
        exportMetrics: false
    }
};

// Предустановки для различных сценариев
export const Presets = {
    // Низкая латентность (игры, живое исполнение)
    lowLatency: {
        ...PipelineConfig,
        input: { ...PipelineConfig.input, bufferSize: 256 },
        output: { ...PipelineConfig.output, bufferSize: 256 },
        npu: { ...PipelineConfig.npu, maxLatency: 5 },
        effects: {
            reverb: {
                ...PipelineConfig.effects.reverb,
                wetMix: 0.2,
                decayTime: 1.0
            }
        }
    },

    // Высокое качество (студийная запись)
    highQuality: {
        ...PipelineConfig,
        input: { ...PipelineConfig.input, bufferSize: 1024, sampleRate: 96000 },
        output: { ...PipelineConfig.output, bufferSize: 1024, sampleRate: 96000 },
        npu: { ...PipelineConfig.npu, precisionMode: 'full' },
        effects: {
            reverb: {
                ...PipelineConfig.effects.reverb,
                decayTime: 4.0,
                wetMix: 0.4
            }
        }
    },

    // Экономия ресурсов (батарея)
    powerSaving: {
        ...PipelineConfig,
        npu: {
            ...PipelineConfig.npu,
            useNeuralEngine: false,
            preferGPU: false,
            threadCount: 2,
            precisionMode: 'half'
        },
        effects: {
            reverb: {
                ...PipelineConfig.effects.reverb,
                wetMix: 0.2,
                decayTime: 1.5
            }
        }
    }
};

// Валидация конфигурации
export function validateConfig(config) {
    const errors = [];

    // Проверка входных параметров
    if (config.input.sampleRate < 8000 || config.input.sampleRate > 192000) {
        errors.push('Sample rate должен быть между 8000 и 192000 Hz');
    }

    if (config.input.bufferSize < 64 || config.input.bufferSize > 4096) {
        errors.push('Buffer size должен быть между 64 и 4096 samples');
    }

    // Проверка эффектов
    const reverb = config.effects.reverb;
    if (reverb.roomSize < 0 || reverb.roomSize > 1) {
        errors.push('Room size должен быть между 0.0 и 1.0');
    }

    if (reverb.wetMix + reverb.dryMix > 1.0) {
        errors.push('Сумма wet и dry mix не должна превышать 1.0');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}