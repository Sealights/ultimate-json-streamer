import {IParserTransformOptions, OutputMode, ParserMode} from "./json-stream-transformer";
import {EventEmitter} from 'events';

export class JsonStreamElementManager<T> extends EventEmitter{
    private elementCount = 0;
    private relevantElementCount = 0;
    private elementsArray: string[] = [];

    constructor(private readonly attributeOptions: IParserTransformOptions<T>) {
        super();
    }

    public processNewElement(buffer: string): boolean {
        if (this.elementCount === 0) {
            console.info('validating first element');
            const validate = this.attributeOptions.validator(buffer);
            if (!validate) {
                console.warn('first element did not pass validation, resetting entry point logic...');
                throw new Error('failed to validate first object');
            }
        }
        this.elementCount++;
        const mode = this.attributeOptions.mode;
        const batchSize  = this.attributeOptions.batchSize;
        const skip = this.attributeOptions.skip;
        switch (mode) {
            case ParserMode.SingleObject:
                //do
                this.emitData(buffer);
                break;
            case ParserMode.BatchAndProcess:
                if(!skip || this.elementCount > skip) {
                    this.relevantElementCount++;
                    this.elementsArray.push(buffer);
                    if (batchSize === this.relevantElementCount) {
                        this.emitData("[" + this.elementsArray.join(',') + "]");
                        this.relevantElementCount = 0;
                        this.elementsArray = [];
                    }
                }
                break;
            case ParserMode.SkipAndBatch:
                if (this.elementCount > skip) {
                    this.relevantElementCount++;
                    this.elementsArray.push(buffer);
                    if (batchSize === this.relevantElementCount) {
                        this.emitData( "[" + this.elementsArray.join(',') + "]");
                        this.emit('done');
                    }
                }
                break;
            case ParserMode.SkipAndStream:
                if (this.elementCount > skip) {
                    this.relevantElementCount++;
                    this.emitData(buffer);
                    if (batchSize === this.relevantElementCount) {
                        this.emit('done');
                    }
                }
                break;
        }
        this.logProgress();
        return false;
    }

    private emitData(data: string): void {
        const outputMode = this.attributeOptions.output;
        switch (outputMode) {
            case OutputMode.JSON:
                this.emit('data', JSON.parse(data))
                break;
            case OutputMode.STRING:
                this.emit('data', data)
                break;
        }
    }

    private logProgress() {
        if (this.elementCount === 1) {
            console.info('Found first element')
        }
        if (this.relevantElementCount === 1) {
            console.info('Found first relevant element')
        }

        if (this.relevantElementCount > 0 && this.relevantElementCount % 1000 === 0) {
            console.info(`Relevant Element number ${this.elementCount}`, {
                memoryUsage: formatBytes(process.memoryUsage().rss), cpuUsage: process.cpuUsage()
            });
        } else if (this.elementCount % 1000 === 0) {
            console.info(`Element number ${this.elementCount}`, {
                memoryUsage: formatBytes(process.memoryUsage().rss), cpuUsage: process.cpuUsage()
            });
        }

        function formatBytes(bytes, decimals = 2) {
            if (bytes === 0) return '0 Bytes';

            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

            const i = Math.floor(Math.log(bytes) / Math.log(k));

            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        }

    }
}