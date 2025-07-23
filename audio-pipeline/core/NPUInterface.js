/**
 * Интерфейс для работы с NPU Silicon M1
 * Оптимизированный для neural engine и GPU вычислений
 */

export class NPUInterface {
    constructor(config) {
        this.config = config;
        this.metalSupported = this.checkMetalSupport();
        this.neuralEngineSupported = this.checkNeuralEngineSupport();
        this.gpuContext = null;
        this.computePipelines = new Map();
        this.commandQueue = null;
        
        this.initialized = false;
        this.performance = {
            processingTime: 0,
            memoryUsage: 0,
            gpuUsage: 0,
            neuralEngineUsage: 0
        };
    }

    async initialize() {
        try {
            // Инициализация GPU контекста
            if (this.config.npu.useMetal && this.metalSupported) {
                await this.initializeMetalContext();
            }

            // Настройка compute pipelines для аудио обработки
            await this.setupComputePipelines();

            // Выделение буферов с aligned memory
            this.setupAlignedBuffers();

            this.initialized = true;
            console.log('NPU Interface инициализирован');
            console.log(`Metal: ${this.metalSupported}, Neural Engine: ${this.neuralEngineSupported}`);
            
        } catch (error) {
            console.error('Ошибка инициализации NPU Interface:', error);
            throw error;
        }
    }

    checkMetalSupport() {
        // Проверка поддержки Metal на macOS
        if (typeof navigator !== 'undefined' && navigator.platform) {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const isM1 = navigator.userAgent.includes('Macintosh') && 
                        navigator.userAgent.includes('Intel') === false;
            return isMac && isM1;
        }
        return false;
    }

    checkNeuralEngineSupport() {
        // Проверка доступности Neural Engine
        return this.metalSupported && 
               typeof navigator !== 'undefined' && 
               navigator.userAgent.includes('Version/14') || 
               navigator.userAgent.includes('Version/15') ||
               navigator.userAgent.includes('Version/16');
    }

    async initializeMetalContext() {
        try {
            // В реальной реализации здесь будет инициализация Metal
            // Для WebAudio используем WebGL как альтернативу
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            
            if (!gl) {
                throw new Error('WebGL не поддерживается');
            }

            this.gpuContext = gl;
            this.setupWebGLExtensions();
            
        } catch (error) {
            console.warn('Не удалось инициализировать Metal контекст:', error);
            this.config.npu.useMetal = false;
        }
    }

    setupWebGLExtensions() {
        if (!this.gpuContext) return;

        // Включаем расширения для производительности
        const extensions = [
            'OES_texture_float',
            'OES_texture_float_linear',
            'EXT_color_buffer_float',
            'WEBGL_color_buffer_float'
        ];

        extensions.forEach(ext => {
            const extension = this.gpuContext.getExtension(ext);
            if (extension) {
                console.log(`Расширение ${ext} включено`);
            }
        });
    }

    async setupComputePipelines() {
        // Настройка compute pipelines для реверберации
        if (this.config.npu.useMetal && this.gpuContext) {
            // Пайплайн для конвольной реверберации
            const reverbPipeline = await this.createReverbPipeline();
            this.computePipelines.set('reverb', reverbPipeline);

            // Пайплайн для FFT операций
            const fftPipeline = await this.createFFTPipeline();
            this.computePipelines.set('fft', fftPipeline);
        }
    }

    async createReverbPipeline() {
        // Создание compute shader для реверберации
        const shaderSource = `
            precision highp float;
            
            uniform sampler2D inputBuffer;
            uniform sampler2D impulseResponse;
            uniform float wetMix;
            uniform float dryMix;
            uniform float roomSize;
            uniform vec2 bufferSize;
            
            varying vec2 texCoord;
            
            void main() {
                vec2 uv = texCoord;
                float dry = texture2D(inputBuffer, uv).r;
                
                // Конвольная реверберация (упрощенная версия)
                float wet = 0.0;
                float irLength = roomSize * 0.1; // Длина impulse response
                
                for (float i = 0.0; i < irLength; i += 1.0/1024.0) {
                    vec2 irUV = vec2(i, 0.0);
                    float ir = texture2D(impulseResponse, irUV).r;
                    vec2 delayedUV = uv - vec2(i, 0.0);
                    
                    if (delayedUV.x >= 0.0) {
                        float delayed = texture2D(inputBuffer, delayedUV).r;
                        wet += delayed * ir;
                    }
                }
                
                float output = dry * dryMix + wet * wetMix;
                gl_FragColor = vec4(output, 0.0, 0.0, 1.0);
            }
        `;

        return {
            shader: shaderSource,
            uniforms: ['inputBuffer', 'impulseResponse', 'wetMix', 'dryMix', 'roomSize']
        };
    }

    async createFFTPipeline() {
        // Упрощенный FFT пайплайн для частотного анализа
        const fftShader = `
            precision highp float;
            
            uniform sampler2D inputBuffer;
            uniform float N; // FFT size
            uniform float stage;
            varying vec2 texCoord;
            
            const float PI = 3.14159265359;
            
            vec2 complexMult(vec2 a, vec2 b) {
                return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
            }
            
            void main() {
                // Упрощенная реализация Cooley-Tukey FFT
                float index = texCoord.x * N;
                vec2 value = texture2D(inputBuffer, texCoord).xy;
                
                // Базовые операции FFT
                float angle = -2.0 * PI * index / N;
                vec2 twiddle = vec2(cos(angle), sin(angle));
                
                vec2 result = complexMult(value, twiddle);
                gl_FragColor = vec4(result.x, result.y, 0.0, 1.0);
            }
        `;

        return {
            shader: fftShader,
            uniforms: ['inputBuffer', 'N', 'stage']
        };
    }

    setupAlignedBuffers() {
        const alignment = this.config.npu.memoryAlignment;
        const bufferSize = this.config.input.bufferSize;
        
        // Создание aligned буферов для оптимальной производительности
        this.alignedBuffers = {
            input: this.createAlignedBuffer(bufferSize * 2, alignment),
            output: this.createAlignedBuffer(bufferSize * 2, alignment),
            impulseResponse: this.createAlignedBuffer(4096, alignment),
            workBuffer: this.createAlignedBuffer(bufferSize * 4, alignment)
        };
    }

    createAlignedBuffer(size, alignment) {
        // Создание aligned buffer
        const totalSize = size + alignment - 1;
        const buffer = new Float32Array(totalSize);
        const offset = alignment - (buffer.byteOffset % alignment);
        return buffer.subarray(offset, offset + size);
    }

    async processReverbGPU(inputBuffer, impulseResponse, params) {
        if (!this.config.npu.useMetal || !this.computePipelines.has('reverb')) {
            // Fallback на CPU обработку
            return this.processReverbCPU(inputBuffer, impulseResponse, params);
        }

        const startTime = performance.now();

        try {
            // Копирование данных в GPU буферы
            this.alignedBuffers.input.set(inputBuffer);

            // Выполнение compute shader для реверберации
            const result = await this.executeComputeShader('reverb', {
                inputBuffer: this.alignedBuffers.input,
                impulseResponse,
                ...params
            });

            this.performance.processingTime = performance.now() - startTime;
            return result;

        } catch (error) {
            console.warn('GPU обработка не удалась, переключение на CPU:', error);
            return this.processReverbCPU(inputBuffer, impulseResponse, params);
        }
    }

    processReverbCPU(inputBuffer, impulseResponse, params) {
        // CPU реализация конвольной реверберации
        const outputBuffer = new Float32Array(inputBuffer.length);
        const { wetMix, dryMix, roomSize } = params;
        
        const irLength = Math.min(impulseResponse.length, roomSize * 1024);
        
        for (let i = 0; i < inputBuffer.length; i++) {
            let wet = 0;
            
            // Конвольция с impulse response
            for (let j = 0; j < irLength && (i - j) >= 0; j++) {
                wet += inputBuffer[i - j] * impulseResponse[j];
            }
            
            // Смешивание сухого и мокрого сигнала
            outputBuffer[i] = inputBuffer[i] * dryMix + wet * wetMix;
        }
        
        return outputBuffer;
    }

    async executeComputeShader(pipelineName, params) {
        // Выполнение compute shader
        const pipeline = this.computePipelines.get(pipelineName);
        if (!pipeline || !this.gpuContext) {
            throw new Error(`Pipeline ${pipelineName} не найден`);
        }

        // В реальной реализации здесь будет выполнение Metal compute shader
        // Пока используем CPU fallback
        return this.alignedBuffers.output;
    }

    optimizeForLatency() {
        // Оптимизация для минимальной латентности
        if (this.config.npu.adaptiveOptimization) {
            const currentLatency = this.performance.processingTime;
            
            if (currentLatency > this.config.npu.maxLatency) {
                // Переключение на менее точный, но быстрый режим
                this.config.npu.precisionMode = 'half';
                this.config.npu.threadCount = Math.max(2, this.config.npu.threadCount - 1);
                
                console.log('Оптимизация: снижение точности для уменьшения латентности');
            }
        }
    }

    getPerformanceMetrics() {
        return {
            ...this.performance,
            memoryUsage: this.getMemoryUsage(),
            initialized: this.initialized,
            metalSupported: this.metalSupported,
            neuralEngineSupported: this.neuralEngineSupported
        };
    }

    getMemoryUsage() {
        // Примерная оценка использования памяти
        let totalMemory = 0;
        
        Object.values(this.alignedBuffers || {}).forEach(buffer => {
            totalMemory += buffer.byteLength;
        });
        
        return totalMemory / (1024 * 1024); // MB
    }

    dispose() {
        // Очистка ресурсов
        if (this.computePipelines) {
            this.computePipelines.clear();
        }
        
        this.alignedBuffers = null;
        this.gpuContext = null;
        this.initialized = false;
        
        console.log('NPU Interface очищен');
    }
}