# Структура аудиоконвейера для NPU Silicon M1

## Общая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                    AudioPipeline Manager                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Input Stage   │─▶│  Effect Stage   │─▶│  Output Stage   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│         │                       │                       │       │
│         ▼                       ▼                       ▼       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Buffer Mgmt   │  │   NPU Core      │  │   Format Conv   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Модульная структура файлов

### Ядро системы
- `core/AudioPipeline.js` - Главный менеджер конвейера
- `core/BufferManager.js` - Управление аудиобуферами
- `core/NPUInterface.js` - Интерфейс для работы с NPU M1

### Входной модуль
- `input/AudioInput.js` - Захват аудио с различных источников
- `input/InputProcessor.js` - Предварительная обработка входного сигнала

### Модуль эффектов
- `effects/BaseEffect.js` - Базовый класс для эффектов
- `effects/ReverbEffect.js` - Реализация эффекта реверберации (выбранный эффект)
- `effects/EffectRegistry.js` - Реестр доступных эффектов

### Выходной модуль
- `output/AudioOutput.js` - Вывод обработанного аудио
- `output/FormatConverter.js` - Конвертация форматов

### Утилиты и конфигурация
- `utils/NPUOptimizer.js` - Оптимизации для Silicon M1
- `utils/PerformanceMonitor.js` - Мониторинг производительности
- `config/PipelineConfig.js` - Конфигурация конвейера

## Детальная архитектура компонентов

### 1. AudioPipeline (Главный менеджер)
```javascript
class AudioPipeline {
    constructor(config) {
        this.config = config;
        this.inputStage = new AudioInput(config.input);
        this.effectStage = new EffectRegistry();
        this.outputStage = new AudioOutput(config.output);
        this.bufferManager = new BufferManager();
        this.npuInterface = new NPUInterface();
    }
}
```

### 2. NPU Interface (Интерфейс для M1)
- Оптимизация для Neural Engine M1
- Управление памятью GPU/NPU
- Асинхронная обработка больших буферов

### 3. Reverb Effect (Выбранный эффект)
- Алгоритм: Convolutional Reverb с IR (Impulse Response)
- Оптимизация: Использование Metal Performance Shaders для M1
- Параметры: Room Size, Decay Time, Wet/Dry Mix

## Особенности для Silicon M1

### NPU Оптимизации
1. **Memory Management**: Использование unified memory M1
2. **Parallel Processing**: Распараллеливание на CPU/GPU/Neural Engine
3. **Buffer Optimization**: Aligned memory buffers для максимальной производительности
4. **Metal Integration**: Использование Metal для GPU вычислений

### Производительность
- Latency: < 10ms для real-time обработки
- Buffer Size: 256-512 samples (оптимально для M1)
- Sample Rate: 44.1kHz / 48kHz
- Bit Depth: 32-bit float

## Конфигурация по умолчанию

```javascript
const defaultConfig = {
    input: {
        sampleRate: 48000,
        bufferSize: 512,
        channels: 2
    },
    effects: {
        reverb: {
            roomSize: 0.5,
            decayTime: 2.0,
            wetMix: 0.3,
            dryMix: 0.7
        }
    },
    output: {
        sampleRate: 48000,
        channels: 2,
        format: 'float32'
    },
    npu: {
        useNeuralEngine: true,
        preferGPU: true,
        maxLatency: 10 // ms
    }
};
```

## Интерфейс API

### Основные методы
```javascript
// Инициализация
pipeline.initialize()

// Добавление эффекта
pipeline.addEffect('reverb', reverbParams)

// Запуск обработки
pipeline.start()

// Обновление параметров в реальном времени
pipeline.updateEffect('reverb', { roomSize: 0.8 })

// Остановка
pipeline.stop()
```

### События
```javascript
pipeline.on('audioProcessed', (outputBuffer) => {})
pipeline.on('performanceUpdate', (stats) => {})
pipeline.on('error', (error) => {})
```

## Мониторинг производительности

### Метрики
- CPU Usage (разбивка по ядрам)
- GPU Usage
- Neural Engine Usage
- Memory Usage
- Latency (input to output)
- Processing Time per Buffer

### Автооптимизация
- Динамическое изменение buffer size
- Переключение между CPU/GPU в зависимости от нагрузки
- Адаптивное качество эффектов

## Расширяемость

### Добавление новых эффектов
1. Наследование от `BaseEffect`
2. Реализация NPU-оптимизированных алгоритмов
3. Регистрация в `EffectRegistry`

### Интеграция с существующим кодом
- Совместимость с `AdvancedAudioProcessor`
- Возможность постепенной миграции
- Сохранение существующих настроек

Эта структура обеспечивает:
- ✅ Модульность и расширяемость
- ✅ Оптимизация для Silicon M1 NPU
- ✅ Низкая латентность (< 10ms)
- ✅ Совместимость с существующим кодом
- ✅ Простой API для интеграции
- ✅ Мониторинг производительности