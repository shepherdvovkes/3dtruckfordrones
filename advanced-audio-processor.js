/**
 * Продвинутый аудио-процессор для работы с WB Cable
 * Решает проблемы слабого сигнала и улучшает транскрипцию
 */

class AdvancedAudioProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.initializeProcessors();
    }

    initializeProcessors() {
        // Компрессор для выравнивания уровня сигнала
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-30, this.audioContext.currentTime);
        this.compressor.knee.setValueAtTime(10, this.audioContext.currentTime);
        this.compressor.ratio.setValueAtTime(8, this.audioContext.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);

        // Усилитель предварительного сигнала
        this.preGain = this.audioContext.createGain();
        this.preGain.gain.value = 2.0; // Предварительное усиление

        // Основной усилитель
        this.mainGain = this.audioContext.createGain();
        this.mainGain.gain.value = 1.0;

        // Лимитер для предотвращения перегрузки
        this.limiter = this.audioContext.createDynamicsCompressor();
        this.limiter.threshold.setValueAtTime(-3, this.audioContext.currentTime);
        this.limiter.knee.setValueAtTime(0, this.audioContext.currentTime);
        this.limiter.ratio.setValueAtTime(20, this.audioContext.currentTime);
        this.limiter.attack.setValueAtTime(0.001, this.audioContext.currentTime);
        this.limiter.release.setValueAtTime(0.01, this.audioContext.currentTime);

        // Фильтр высоких частот для удаления шума
        this.highpassFilter = this.audioContext.createBiquadFilter();
        this.highpassFilter.type = 'highpass';
        this.highpassFilter.frequency.setValueAtTime(80, this.audioContext.currentTime);
        this.highpassFilter.Q.setValueAtTime(0.7, this.audioContext.currentTime);

        // Фильтр низких частот для удаления высокочастотного шума
        this.lowpassFilter = this.audioContext.createBiquadFilter();
        this.lowpassFilter.type = 'lowpass';
        this.lowpassFilter.frequency.setValueAtTime(8000, this.audioContext.currentTime);
        this.lowpassFilter.Q.setValueAtTime(0.7, this.audioContext.currentTime);

        // Подавитель шума с gate
        this.noiseGate = this.audioContext.createGain();
        this.gateThreshold = -40; // дБ
        this.isGateOpen = false;

        // Анализатор для мониторинга
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.3;

        this.setupProcessingChain();
        this.startGateProcessing();
    }

    setupProcessingChain() {
        // Подключаем цепочку обработки:
        // Вход -> Предварительное усиление -> Компрессор -> Фильтры -> Основное усиление -> Лимитер -> Выход
        this.input = this.preGain;
        
        this.preGain.connect(this.highpassFilter);
        this.highpassFilter.connect(this.lowpassFilter);
        this.lowpassFilter.connect(this.compressor);
        this.compressor.connect(this.noiseGate);
        this.noiseGate.connect(this.mainGain);
        this.mainGain.connect(this.limiter);
        this.limiter.connect(this.analyser);
        
        this.output = this.analyser;
    }

    startGateProcessing() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);

        const processGate = () => {
            this.analyser.getFloatTimeDomainData(dataArray);
            
            // Вычисляем RMS уровень
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i] * dataArray[i];
            }
            const rms = Math.sqrt(sum / bufferLength);
            const dB = 20 * Math.log10(rms);

            // Управляем gate
            if (dB > this.gateThreshold) {
                if (!this.isGateOpen) {
                    this.isGateOpen = true;
                    this.noiseGate.gain.exponentialRampToValueAtTime(
                        1.0, this.audioContext.currentTime + 0.01
                    );
                }
            } else {
                if (this.isGateOpen) {
                    this.isGateOpen = false;
                    this.noiseGate.gain.exponentialRampToValueAtTime(
                        0.01, this.audioContext.currentTime + 0.1
                    );
                }
            }

            requestAnimationFrame(processGate);
        };

        processGate();
    }

    // Методы для настройки параметров
    setPreGain(value) {
        this.preGain.gain.setValueAtTime(value, this.audioContext.currentTime);
    }

    setMainGain(value) {
        this.mainGain.gain.setValueAtTime(value, this.audioContext.currentTime);
    }

    setGateThreshold(dB) {
        this.gateThreshold = dB;
    }

    setHighpassFrequency(freq) {
        this.highpassFilter.frequency.setValueAtTime(freq, this.audioContext.currentTime);
    }

    setLowpassFrequency(freq) {
        this.lowpassFilter.frequency.setValueAtTime(freq, this.audioContext.currentTime);
    }

    setCompressorThreshold(dB) {
        this.compressor.threshold.setValueAtTime(dB, this.audioContext.currentTime);
    }

    setCompressorRatio(ratio) {
        this.compressor.ratio.setValueAtTime(ratio, this.audioContext.currentTime);
    }

    // Подключение входа и выхода
    connectInput(source) {
        source.connect(this.input);
    }

    connectOutput(destination) {
        this.output.connect(destination);
    }

    getAnalyser() {
        return this.analyser;
    }

    // Автоматическая настройка для слабого сигнала
    autoConfigureForWeakSignal() {
        console.log('Применение автоматических настроек для слабого сигнала...');
        
        // Увеличиваем предварительное усиление
        this.setPreGain(4.0);
        
        // Настраиваем компрессор для более агрессивного сжатия
        this.setCompressorThreshold(-45);
        this.setCompressorRatio(12);
        
        // Расширяем частотный диапазон
        this.setHighpassFrequency(60);
        this.setLowpassFrequency(10000);
        
        // Понижаем порог gate для захвата тихих сигналов
        this.setGateThreshold(-50);
        
        // Увеличиваем основное усиление
        this.setMainGain(2.0);
        
        console.log('Настройки применены: PreGain=4.0x, MainGain=2.0x, Gate=-50dB');
    }

    // Получение уровня сигнала для отображения
    getSignalLevel() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        return (sum / bufferLength) / 255 * 100;
    }

    // Анализ качества сигнала
    analyzeSignalQuality() {
        const bufferLength = this.analyser.frequencyBinCount;
        const freqData = new Uint8Array(bufferLength);
        const timeData = new Float32Array(bufferLength);
        
        this.analyser.getByteFrequencyData(freqData);
        this.analyser.getFloatTimeDomainData(timeData);

        // Анализ динамического диапазона
        let maxLevel = 0;
        let minLevel = 255;
        for (let i = 0; i < bufferLength; i++) {
            if (freqData[i] > maxLevel) maxLevel = freqData[i];
            if (freqData[i] < minLevel) minLevel = freqData[i];
        }
        const dynamicRange = maxLevel - minLevel;

        // Анализ RMS уровня
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += timeData[i] * timeData[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        const rmsDb = 20 * Math.log10(rms);

        // Анализ отношения сигнал/шум
        const signalBands = freqData.slice(10, 100); // Речевой диапазон
        const noiseBands = freqData.slice(200, 300); // Высокочастотный шум
        
        const signalLevel = signalBands.reduce((a, b) => a + b) / signalBands.length;
        const noiseLevel = noiseBands.reduce((a, b) => a + b) / noiseBands.length;
        const snr = signalLevel / (noiseLevel + 1);

        return {
            dynamicRange,
            rmsLevel: rmsDb,
            snrRatio: snr,
            maxLevel,
            quality: this.assessQuality(dynamicRange, rmsDb, snr)
        };
    }

    assessQuality(dynamicRange, rmsDb, snr) {
        let score = 0;
        
        // Оценка динамического диапазона
        if (dynamicRange > 50) score += 3;
        else if (dynamicRange > 30) score += 2;
        else if (dynamicRange > 15) score += 1;

        // Оценка уровня сигнала
        if (rmsDb > -20) score += 3;
        else if (rmsDb > -35) score += 2;
        else if (rmsDb > -50) score += 1;

        // Оценка отношения сигнал/шум
        if (snr > 5) score += 3;
        else if (snr > 2) score += 2;
        else if (snr > 1) score += 1;

        if (score >= 7) return 'Отличное';
        if (score >= 5) return 'Хорошее';
        if (score >= 3) return 'Удовлетворительное';
        return 'Плохое';
    }

    // Автоматическая коррекция настроек на основе анализа
    autoAdjustSettings() {
        const quality = this.analyzeSignalQuality();
        
        console.log('Анализ качества сигнала:', quality);

        if (quality.rmsLevel < -40) {
            console.log('Обнаружен слабый сигнал, увеличиваем усиление');
            this.setPreGain(Math.min(this.preGain.gain.value * 1.5, 8.0));
        }

        if (quality.snrRatio < 2) {
            console.log('Плохое отношение сигнал/шум, настраиваем фильтры');
            this.setHighpassFrequency(100);
            this.setLowpassFrequency(6000);
        }

        if (quality.dynamicRange < 20) {
            console.log('Малый динамический диапазон, настраиваем компрессор');
            this.setCompressorRatio(Math.min(this.compressor.ratio.value + 2, 15));
        }

        return quality;
    }
}

// Улучшенный менеджер транскрипции
class EnhancedTranscriptionManager {
    constructor() {
        this.recognition = null;
        this.isActive = false;
        this.lastTranscript = '';
        this.confidenceThreshold = 0.7;
        this.silenceTimeout = null;
        this.restartDelay = 2000;
        
        this.initRecognition();
    }

    initRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
        } else if ('SpeechRecognition' in window) {
            this.recognition = new SpeechRecognition();
        } else {
            console.error('Speech Recognition API не поддерживается');
            return;
        }

        // Оптимальные настройки для непрерывной транскрипции
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 3;
        this.recognition.lang = 'ru-RU';

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.recognition.onstart = () => {
            console.log('Транскрипция запущена');
            this.isActive = true;
        };

        this.recognition.onresult = (event) => {
            this.processResults(event);
        };

        this.recognition.onerror = (event) => {
            console.error('Ошибка транскрипции:', event.error);
            
            // Автоматический перезапуск при определенных ошибках
            if (event.error === 'no-speech' || event.error === 'audio-capture') {
                console.log('Попытка перезапуска транскрипции...');
                this.restart();
            }
        };

        this.recognition.onend = () => {
            console.log('Транскрипция остановлена');
            this.isActive = false;
            
            // Автоматический перезапуск если транскрипция была активна
            if (this.shouldAutoRestart) {
                setTimeout(() => this.start(), this.restartDelay);
            }
        };
    }

    processResults(event) {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            const confidence = result[0].confidence;

            if (result.isFinal) {
                // Принимаем только результаты с высокой уверенностью
                if (confidence >= this.confidenceThreshold) {
                    finalTranscript += transcript + ' ';
                }
            } else {
                interimTranscript += transcript;
            }
        }

        // Отправляем результаты в callback
        if (this.onTranscriptCallback) {
            this.onTranscriptCallback({
                final: finalTranscript,
                interim: interimTranscript,
                confidence: event.results[event.results.length - 1]?.[0]?.confidence || 0
            });
        }

        // Сбрасываем таймер тишины
        this.resetSilenceTimeout();
    }

    resetSilenceTimeout() {
        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
        }

        // Перезапуск при длительной тишине (30 секунд)
        this.silenceTimeout = setTimeout(() => {
            console.log('Обнаружена длительная тишина, перезапускаем транскрипцию');
            this.restart();
        }, 30000);
    }

    start(callback) {
        if (!this.recognition) {
            console.error('Speech Recognition недоступен');
            return false;
        }

        this.onTranscriptCallback = callback;
        this.shouldAutoRestart = true;

        try {
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('Не удалось запустить транскрипцию:', error);
            return false;
        }
    }

    stop() {
        this.shouldAutoRestart = false;
        
        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
        }

        if (this.recognition && this.isActive) {
            this.recognition.stop();
        }
    }

    restart() {
        this.stop();
        setTimeout(() => {
            if (this.shouldAutoRestart) {
                this.start(this.onTranscriptCallback);
            }
        }, 1000);
    }

    setConfidenceThreshold(threshold) {
        this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
    }

    setLanguage(lang) {
        if (this.recognition) {
            this.recognition.lang = lang;
        }
    }
}

// Экспорт для использования в основном файле
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdvancedAudioProcessor, EnhancedTranscriptionManager };
} else {
    window.AdvancedAudioProcessor = AdvancedAudioProcessor;
    window.EnhancedTranscriptionManager = EnhancedTranscriptionManager;
}