/**
 * Эффект реверберации оптимизированный для NPU Silicon M1
 * Использует convolutional reverb с impulse response
 */

import { BaseEffect } from './BaseEffect.js';

export class ReverbEffect extends BaseEffect {
    constructor(audioContext, config, npuInterface) {
        super(audioContext, 'reverb', config);
        
        this.npuInterface = npuInterface;
        this.impulseResponse = null;
        this.convolver = null;
        this.dryGain = null;
        this.wetGain = null;
        this.lowShelfFilter = null;
        this.highShelfFilter = null;
        this.preDelayNode = null;
        
        this.parameters = {
            roomSize: config.roomSize || 0.5,
            decayTime: config.decayTime || 2.0,
            damping: config.damping || 0.5,
            wetMix: config.wetMix || 0.3,
            dryMix: config.dryMix || 0.7,
            preDelay: config.preDelay || 0.03,
            lowShelf: config.lowShelf || { frequency: 200, gain: 0 },
            highShelf: config.highShelf || { frequency: 4000, gain: -2 }
        };

        this.initializeNodes();
        this.generateImpulseResponse();
    }

    initializeNodes() {
        // Создание аудио узлов
        this.convolver = this.audioContext.createConvolver();
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        // Предварительная задержка
        this.preDelayNode = this.audioContext.createDelay(0.1);
        this.preDelayNode.delayTime.value = this.parameters.preDelay;
        
        // EQ фильтры
        this.lowShelfFilter = this.audioContext.createBiquadFilter();
        this.lowShelfFilter.type = 'lowshelf';
        this.lowShelfFilter.frequency.value = this.parameters.lowShelf.frequency;
        this.lowShelfFilter.gain.value = this.parameters.lowShelf.gain;
        
        this.highShelfFilter = this.audioContext.createBiquadFilter();
        this.highShelfFilter.type = 'highshelf';
        this.highShelfFilter.frequency.value = this.parameters.highShelf.frequency;
        this.highShelfFilter.gain.value = this.parameters.highShelf.gain;
        
        // Настройка усиления
        this.updateMixLevels();
        
        // Соединение узлов
        this.setupNodeConnections();
    }

    setupNodeConnections() {
        // Сухой сигнал
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Мокрый сигнал
        this.input.connect(this.preDelayNode);
        this.preDelayNode.connect(this.lowShelfFilter);
        this.lowShelfFilter.connect(this.highShelfFilter);
        this.highShelfFilter.connect(this.convolver);
        this.convolver.connect(this.wetGain);
        this.wetGain.connect(this.output);
    }

    generateImpulseResponse() {
        const sampleRate = this.audioContext.sampleRate;
        const length = Math.floor(sampleRate * this.parameters.decayTime);
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);
        
        // Генерация impulse response для конвольной реверберации
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            
            // Алгоритм Schroeder для генерации реверберации
            this.generateSchroederReverb(channelData, sampleRate, length, channel);
        }
        
        this.impulseResponse = impulse;
        this.convolver.buffer = impulse;
        
        console.log(`Impulse Response сгенерирован: ${length} сэмплов, ${this.parameters.decayTime}с`);
    }

    generateSchroederReverb(channelData, sampleRate, length, channel) {
        const { roomSize, damping, decayTime } = this.parameters;
        
        // Параметры для алгоритма Schroeder
        const combDelays = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(d => 
            Math.floor(d * roomSize * (sampleRate / 44100))
        );
        const allpassDelays = [556, 441, 341, 225].map(d => 
            Math.floor(d * roomSize * (sampleRate / 44100))
        );
        
        // Инициализация задержек
        const combBuffers = combDelays.map(delay => new Float32Array(delay));
        const allpassBuffers = allpassDelays.map(delay => new Float32Array(delay));
        
        let combIndices = new Array(combDelays.length).fill(0);
        let allpassIndices = new Array(allpassDelays.length).fill(0);
        
        // Генерация impulse response
        for (let i = 0; i < length; i++) {
            // Входной импульс только в первом сэмпле
            let input = i === 0 ? 1.0 : 0.0;
            
            // Comb фильтры (параллельно)
            let combSum = 0;
            for (let c = 0; c < combDelays.length; c++) {
                const delay = combDelays[c];
                const buffer = combBuffers[c];
                const index = combIndices[c];
                
                // Обратная связь с затуханием
                const feedback = buffer[index] * 0.742 * Math.pow(0.001, 1.0 / (decayTime * sampleRate));
                const output = input + feedback;
                
                combSum += buffer[index];
                buffer[index] = output;
                combIndices[c] = (index + 1) % delay;
            }
            
            // Allpass фильтры (последовательно)
            let allpassOut = combSum;
            for (let a = 0; a < allpassDelays.length; a++) {
                const delay = allpassDelays[a];
                const buffer = allpassBuffers[a];
                const index = allpassIndices[a];
                
                const delayedInput = buffer[index];
                const output = delayedInput + allpassOut * 0.7;
                buffer[index] = allpassOut + delayedInput * (-0.7);
                allpassOut = output;
                
                allpassIndices[a] = (index + 1) % delay;
            }
            
            // Применение затухания и стереоэффекта
            const decay = Math.exp(-i / (decayTime * sampleRate * 0.5));
            const stereoSpread = channel === 0 ? 1.0 : 0.8; // Легкий стереоэффект
            
            channelData[i] = allpassOut * decay * damping * stereoSpread;
        }
    }

    async processAudio(inputBuffer) {
        // Используем NPU если доступен
        if (this.npuInterface && this.npuInterface.initialized) {
            try {
                return await this.processWithNPU(inputBuffer);
            } catch (error) {
                console.warn('NPU обработка не удалась, используем WebAudio:', error);
                return null; // WebAudio граф обработает автоматически
            }
        }
        
        // WebAudio граф обработает автоматически
        return null;
    }

    async processWithNPU(inputBuffer) {
        // Подготовка параметров для NPU
        const params = {
            wetMix: this.parameters.wetMix,
            dryMix: this.parameters.dryMix,
            roomSize: this.parameters.roomSize,
            decayTime: this.parameters.decayTime
        };

        // Получение impulse response как Float32Array
        const impulseData = this.impulseResponse.getChannelData(0);
        
        // Обработка через NPU
        return await this.npuInterface.processReverbGPU(inputBuffer, impulseData, params);
    }

    updateParameter(name, value) {
        if (!this.parameters.hasOwnProperty(name)) {
            console.warn(`Параметр ${name} не существует`);
            return;
        }

        this.parameters[name] = value;

        switch (name) {
            case 'roomSize':
            case 'decayTime':
            case 'damping':
                // Регенерация impulse response
                this.generateImpulseResponse();
                break;
                
            case 'wetMix':
            case 'dryMix':
                this.updateMixLevels();
                break;
                
            case 'preDelay':
                this.preDelayNode.delayTime.setValueAtTime(
                    value, this.audioContext.currentTime
                );
                break;
                
            case 'lowShelf':
                this.lowShelfFilter.frequency.value = value.frequency;
                this.lowShelfFilter.gain.value = value.gain;
                break;
                
            case 'highShelf':
                this.highShelfFilter.frequency.value = value.frequency;
                this.highShelfFilter.gain.value = value.gain;
                break;
        }

        console.log(`Параметр ${name} обновлен: ${JSON.stringify(value)}`);
    }

    updateMixLevels() {
        const currentTime = this.audioContext.currentTime;
        this.dryGain.gain.setValueAtTime(this.parameters.dryMix, currentTime);
        this.wetGain.gain.setValueAtTime(this.parameters.wetMix, currentTime);
    }

    getParameters() {
        return { ...this.parameters };
    }

    setPreset(presetName) {
        const presets = {
            hall: {
                roomSize: 0.8,
                decayTime: 3.5,
                damping: 0.3,
                wetMix: 0.4,
                dryMix: 0.6,
                preDelay: 0.05
            },
            room: {
                roomSize: 0.5,
                decayTime: 1.2,
                damping: 0.7,
                wetMix: 0.3,
                dryMix: 0.7,
                preDelay: 0.02
            },
            cathedral: {
                roomSize: 0.95,
                decayTime: 6.0,
                damping: 0.2,
                wetMix: 0.5,
                dryMix: 0.5,
                preDelay: 0.1
            },
            plate: {
                roomSize: 0.3,
                decayTime: 2.5,
                damping: 0.8,
                wetMix: 0.35,
                dryMix: 0.65,
                preDelay: 0.01
            }
        };

        if (presets[presetName]) {
            const preset = presets[presetName];
            Object.keys(preset).forEach(param => {
                this.updateParameter(param, preset[param]);
            });
            console.log(`Применен пресет: ${presetName}`);
        } else {
            console.warn(`Пресет ${presetName} не найден`);
        }
    }

    getAnalysis() {
        // Анализ характеристик реверберации
        return {
            rt60: this.parameters.decayTime * 0.6, // Приблизительное RT60
            earlyReflections: this.parameters.preDelay * 1000, // мс
            diffusion: this.parameters.roomSize * 100, // %
            brightness: 100 - (this.parameters.damping * 100), // %
            wetLevel: this.parameters.wetMix * 100, // %
            dryLevel: this.parameters.dryMix * 100 // %
        };
    }

    dispose() {
        // Очистка ресурсов
        if (this.convolver) {
            this.convolver.disconnect();
            this.convolver = null;
        }
        
        if (this.impulseResponse) {
            this.impulseResponse = null;
        }
        
        super.dispose();
        console.log('ReverbEffect очищен');
    }
}