/**
 * Главный менеджер аудиоконвейера для NPU Silicon M1
 * Координирует все компоненты системы
 */

import { PipelineConfig, validateConfig } from '../config/PipelineConfig.js';
import { NPUInterface } from './NPUInterface.js';
import { BufferManager } from './BufferManager.js';
import { AudioInput } from '../input/AudioInput.js';
import { AudioOutput } from '../output/AudioOutput.js';
import { EffectRegistry } from '../effects/EffectRegistry.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';

export class AudioPipeline extends EventTarget {
    constructor(userConfig = {}) {
        super();
        
        // Объединение пользовательской конфигурации с default
        this.config = { ...PipelineConfig, ...userConfig };
        
        // Валидация конфигурации
        const validation = validateConfig(this.config);
        if (!validation.valid) {
            throw new Error(`Ошибка конфигурации: ${validation.errors.join(', ')}`);
        }
        
        // Основные компоненты
        this.audioContext = null;
        this.npuInterface = null;
        this.bufferManager = null;
        this.audioInput = null;
        this.audioOutput = null;
        this.effectRegistry = null;
        this.performanceMonitor = null;
        
        // Состояние конвейера
        this.state = 'idle'; // idle, initializing, running, stopping, error
        this.initialized = false;
        this.processing = false;
        
        // Цепочка обработки
        this.effectChain = [];
        this.inputNode = null;
        this.outputNode = null;
        
        // Метрики производительности
        this.metrics = {
            latency: 0,
            processingTime: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            bufferUnderruns: 0,
            bufferOverruns: 0
        };
        
        console.log('AudioPipeline создан с конфигурацией:', this.config);
    }

    async initialize() {
        if (this.initialized) {
            console.warn('AudioPipeline уже инициализирован');
            return;
        }
        
        this.setState('initializing');
        
        try {
            // 1. Инициализация AudioContext
            await this.initializeAudioContext();
            
            // 2. Инициализация NPU Interface
            this.npuInterface = new NPUInterface(this.config);
            await this.npuInterface.initialize();
            
            // 3. Инициализация BufferManager
            this.bufferManager = new BufferManager(this.config);
            
            // 4. Инициализация компонентов ввода и вывода
            this.audioInput = new AudioInput(this.audioContext, this.config);
            this.audioOutput = new AudioOutput(this.audioContext, this.config);
            
            // 5. Инициализация реестра эффектов
            this.effectRegistry = new EffectRegistry(this.audioContext, this.config, this.npuInterface);
            
            // 6. Инициализация мониторинга производительности
            if (this.config.performance.enableMonitoring) {
                this.performanceMonitor = new PerformanceMonitor(this.config);
                this.setupPerformanceMonitoring();
            }
            
            // 7. Настройка аудио графа
            this.setupAudioGraph();
            
            // 8. Добавление стандартного эффекта реверберации
            await this.addEffect('reverb', this.config.effects.reverb);
            
            this.initialized = true;
            this.setState('idle');
            
            console.log('AudioPipeline успешно инициализирован');
            this.dispatchEvent(new CustomEvent('initialized', { detail: this.getStatus() }));
            
        } catch (error) {
            this.setState('error');
            console.error('Ошибка инициализации AudioPipeline:', error);
            this.dispatchEvent(new CustomEvent('error', { detail: error }));
            throw error;
        }
    }

    async initializeAudioContext() {
        if (this.audioContext && this.audioContext.state !== 'closed') {
            await this.audioContext.close();
        }
        
        const contextOptions = {
            latencyHint: 'interactive',
            sampleRate: this.config.input.sampleRate
        };
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)(contextOptions);
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        console.log(`AudioContext создан: ${this.audioContext.sampleRate}Hz, состояние: ${this.audioContext.state}`);
    }

    setupAudioGraph() {
        // Создание основных узлов
        this.inputNode = this.audioContext.createGain();
        this.outputNode = this.audioContext.createGain();
        
        // Настройка начального соединения (без эффектов)
        this.inputNode.connect(this.outputNode);
        
        console.log('Аудио граф настроен');
    }

    setupPerformanceMonitoring() {
        this.performanceMonitor.on('metrics', (metrics) => {
            this.metrics = { ...this.metrics, ...metrics };
            this.dispatchEvent(new CustomEvent('performanceUpdate', { detail: this.metrics }));
            
            // Автооптимизация при необходимости
            if (this.config.performance.adaptiveOptimization) {
                this.handlePerformanceOptimization(metrics);
            }
        });
        
        this.performanceMonitor.start();
    }

    handlePerformanceOptimization(metrics) {
        // Оптимизация при высокой нагрузке на CPU
        if (metrics.cpuUsage > this.config.performance.cpuThreshold) {
            console.log('Высокая нагрузка CPU, оптимизация...');
            this.npuInterface.optimizeForLatency();
        }
        
        // Оптимизация при высоком использовании памяти
        if (metrics.memoryUsage > this.config.performance.memoryThreshold) {
            console.log('Высокое использование памяти, очистка буферов...');
            this.bufferManager.optimizeMemory();
        }
    }

    async addEffect(effectType, params = {}) {
        if (!this.effectRegistry) {
            throw new Error('EffectRegistry не инициализирован');
        }
        
        const effect = await this.effectRegistry.createEffect(effectType, params);
        this.effectChain.push(effect);
        
        // Пересоединение аудио графа с новым эффектом
        this.rebuildAudioGraph();
        
        console.log(`Эффект ${effectType} добавлен в цепочку`);
        this.dispatchEvent(new CustomEvent('effectAdded', { 
            detail: { effectType, effectId: effect.getId() } 
        }));
        
        return effect.getId();
    }

    removeEffect(effectId) {
        const effectIndex = this.effectChain.findIndex(effect => effect.getId() === effectId);
        
        if (effectIndex === -1) {
            console.warn(`Эффект с ID ${effectId} не найден`);
            return false;
        }
        
        const effect = this.effectChain[effectIndex];
        effect.dispose();
        this.effectChain.splice(effectIndex, 1);
        
        // Пересоединение аудио графа
        this.rebuildAudioGraph();
        
        console.log(`Эффект ${effectId} удален из цепочки`);
        this.dispatchEvent(new CustomEvent('effectRemoved', { detail: { effectId } }));
        
        return true;
    }

    rebuildAudioGraph() {
        // Отключение всех соединений
        try {
            this.inputNode.disconnect();
            this.effectChain.forEach(effect => effect.output.disconnect());
        } catch (error) {
            console.warn('Ошибка при отключении узлов:', error);
        }
        
        // Пересоединение цепочки эффектов
        let currentNode = this.inputNode;
        
        for (const effect of this.effectChain) {
            currentNode.connect(effect.input);
            currentNode = effect.output;
        }
        
        // Подключение к выходу
        currentNode.connect(this.outputNode);
        
        console.log(`Аудио граф пересоединен с ${this.effectChain.length} эффектами`);
    }

    updateEffect(effectId, parameterName, value) {
        const effect = this.effectChain.find(e => e.getId() === effectId);
        
        if (!effect) {
            console.warn(`Эффект с ID ${effectId} не найден`);
            return false;
        }
        
        try {
            effect.updateParameter(parameterName, value);
            
            this.dispatchEvent(new CustomEvent('effectUpdated', { 
                detail: { effectId, parameterName, value } 
            }));
            
            return true;
        } catch (error) {
            console.error('Ошибка обновления параметра эффекта:', error);
            return false;
        }
    }

    async start() {
        if (!this.initialized) {
            throw new Error('AudioPipeline не инициализирован');
        }
        
        if (this.processing) {
            console.warn('AudioPipeline уже запущен');
            return;
        }
        
        this.setState('running');
        
        try {
            // Запуск захвата аудио
            await this.audioInput.start();
            
            // Подключение входа к нашему графу
            this.audioInput.connectTo(this.inputNode);
            
            // Подключение выхода к системному выходу
            this.outputNode.connect(this.audioContext.destination);
            
            this.processing = true;
            
            console.log('AudioPipeline запущен');
            this.dispatchEvent(new CustomEvent('started'));
            
        } catch (error) {
            this.setState('error');
            console.error('Ошибка запуска AudioPipeline:', error);
            this.dispatchEvent(new CustomEvent('error', { detail: error }));
            throw error;
        }
    }

    async stop() {
        if (!this.processing) {
            console.warn('AudioPipeline не запущен');
            return;
        }
        
        this.setState('stopping');
        
        try {
            // Остановка захвата аудио
            await this.audioInput.stop();
            
            // Отключение от системного выхода
            this.outputNode.disconnect();
            
            this.processing = false;
            this.setState('idle');
            
            console.log('AudioPipeline остановлен');
            this.dispatchEvent(new CustomEvent('stopped'));
            
        } catch (error) {
            console.error('Ошибка остановки AudioPipeline:', error);
            this.dispatchEvent(new CustomEvent('error', { detail: error }));
        }
    }

    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        
        this.dispatchEvent(new CustomEvent('stateChanged', { 
            detail: { oldState, newState } 
        }));
    }

    getStatus() {
        return {
            state: this.state,
            initialized: this.initialized,
            processing: this.processing,
            effects: this.effectChain.map(effect => ({
                id: effect.getId(),
                type: effect.getEffectType(),
                enabled: effect.isEnabled(),
                parameters: effect.getParameters()
            })),
            metrics: this.metrics,
            config: this.config
        };
    }

    getMetrics() {
        const baseMetrics = { ...this.metrics };
        
        if (this.npuInterface) {
            Object.assign(baseMetrics, this.npuInterface.getPerformanceMetrics());
        }
        
        if (this.performanceMonitor) {
            Object.assign(baseMetrics, this.performanceMonitor.getMetrics());
        }
        
        return baseMetrics;
    }

    // Совместимость с существующим AdvancedAudioProcessor
    setPreGain(value) {
        if (this.audioInput && this.audioInput.setPreGain) {
            this.audioInput.setPreGain(value);
        }
    }

    setMainGain(value) {
        if (this.outputNode) {
            this.outputNode.gain.setValueAtTime(value, this.audioContext.currentTime);
        }
    }

    autoConfigureForWeakSignal() {
        console.log('Автоконфигурация для слабого сигнала...');
        
        // Настройка входного усиления
        this.setPreGain(4.0);
        this.setMainGain(2.0);
        
        // Настройка реверберации для слабого сигнала
        const reverbEffect = this.effectChain.find(e => e.getEffectType() === 'reverb');
        if (reverbEffect) {
            reverbEffect.updateParameter('wetMix', 0.2);
            reverbEffect.updateParameter('dryMix', 0.8);
        }
        
        // Оптимизация NPU
        if (this.npuInterface) {
            this.npuInterface.optimizeForLatency();
        }
    }

    async dispose() {
        console.log('Очистка AudioPipeline...');
        
        // Остановка если запущен
        if (this.processing) {
            await this.stop();
        }
        
        // Очистка эффектов
        this.effectChain.forEach(effect => effect.dispose());
        this.effectChain = [];
        
        // Очистка компонентов
        if (this.performanceMonitor) {
            this.performanceMonitor.stop();
        }
        
        if (this.audioInput) {
            this.audioInput.dispose();
        }
        
        if (this.audioOutput) {
            this.audioOutput.dispose();
        }
        
        if (this.npuInterface) {
            this.npuInterface.dispose();
        }
        
        // Закрытие AudioContext
        if (this.audioContext && this.audioContext.state !== 'closed') {
            await this.audioContext.close();
        }
        
        this.initialized = false;
        console.log('AudioPipeline очищен');
    }
}