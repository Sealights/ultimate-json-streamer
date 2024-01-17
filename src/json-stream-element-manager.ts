import {IDataEmit, ILogger, IParserTransformOptions, OutputMode, ParserMode} from "./json-stream-transformer";
import {EventEmitter} from 'events';

export class JsonStreamElementManager<T> extends EventEmitter{
    private elementCount = 0;
    private relevantElementCount = 0;
    private elementsArray: string[] = [];

    constructor(private readonly attributeOptions: IParserTransformOptions<T>, private readonly logger: ILogger) {
        super();
    }

    public processNewElement(buffer: string): boolean {
        if (this.elementCount === 0) {
            this.logger.info('validating first element');
            const validate = this.attributeOptions.validator(buffer);
            if (!validate) {
                const msg = `ValidationError: attribute ${this.attributeOptions.attributeName} failed validator`;
                this.logger.error(msg, this.attributeOptions);
                this.emit('error', new Error(msg));
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
                        this.emitData("[" + this.elementsArray.join(',') + "]", this.relevantElementCount,
                            this.elementCount - this.relevantElementCount, this.elementCount);
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
                        this.emitData( "[" + this.elementsArray.join(',') + "]", this.relevantElementCount,
                            this.elementCount - this.relevantElementCount, this.elementCount);
                        this.emit('done');
                    }
                }
                break;
            case ParserMode.SkipAndStream:
                if (this.elementCount > skip) {
                    this.relevantElementCount++;
                    this.emitData(buffer, 1);
                    if (batchSize === this.relevantElementCount) {
                        this.emit('done');
                    }
                }
                break;
        }
        this.logProgress();
        return false;
    }

    public handleEnd() {
        const mode = this.attributeOptions.mode;
        switch (mode) {
            case ParserMode.BatchAndProcess:
                if(this.relevantElementCount > 0) {
                    this.emitData("[" + this.elementsArray.join(',') + "]", this.relevantElementCount,
                        this.elementCount - this.relevantElementCount, this.elementCount);
                }
                break;
            case ParserMode.SkipAndBatch:
                if (this.relevantElementCount > 0) {
                    this.emitData( "[" + this.elementsArray.join(',') + "]", this.relevantElementCount,
                        this.elementCount - this.relevantElementCount, this.elementCount);
                }
                break;
            default:
                break;
        }
        this.emit('done');
    }

    private emitData(data: string, amount?: number, startIdx?: number, endIdx?: number): void {
        const outputMode = this.attributeOptions.output;
        switch (outputMode) {
            case OutputMode.JSON:
                try{
                    this.emit('data', <IDataEmit>{
                        data: JSON.parse(data),
                        amount, startIdx, endIdx
                    })
                } catch (e) {
                    const msg = `JSONParseError: Failed to parse output data for attribute ${this.attributeOptions.attributeName}`;
                    this.logger.error(msg, this.attributeOptions);
                    this.emit('error', new Error(msg));
                }
                break;
            case OutputMode.STRING:
                this.emit('data', <IDataEmit>{
                    data, amount, startIdx, endIdx
                });
                break;
        }
    }

    private logProgress() {
        if (this.elementCount === 1) {
            this.logger.info('Found first element');
        }
        if (this.relevantElementCount === 1) {
            this.logger.info('Found first relevant element');
        }

        if (this.relevantElementCount > 0 && this.relevantElementCount % 1000 === 0) {
            this.logger.debug(`Relevant Element number ${this.elementCount}`, {
                memoryUsage: formatBytes(process.memoryUsage().rss), cpuUsage: process.cpuUsage()
            });
        } else if (this.elementCount % 1000 === 0) {
            this.logger.debug(`Element number ${this.elementCount}`, {
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