import * as zlib from "zlib";

const fs = require('fs');
const process = require('process');
import {pipeline, Transform} from 'stream';
import {JsonStreamOptionsManager} from "./json-stream-options-manager";
import {JsonStreamBufferManager} from "./json-stream-buffer-manager";
import {JsonStreamElementManager} from "./json-stream-element-manager";

export class JSONStreamTransformer {
    public static createTransformStream<T>(options: IParserTransformOptions<T>[]) {
        return new ParserTransform<T>(options);
    }
}
export enum ParserValueType {
    Array = 'Array',
    Object = 'Object'
}
export enum ParserMode {
    SingleObject = 'SingleObject',
    DiscoverArrayLength = 'DiscoverArrayLength',
    BatchAndProcess = 'BatchAndProcess',
    SkipAndStream = 'SkipAndStream',
    SkipAndBatch = 'SkipAndBatch'
}

export enum OutputMode {
    JSON = 'JSON',
    STRING = 'STRING'
}

export interface IParserTransformOptions<T> {
    attributeName: keyof T,
    type: ParserValueType,
    mode?: ParserMode,
    batchSize?: number, // relevant for type Array: BatchAndProcess and SkipAndBatch and SkipAndStream
    skip?: number, //  relevant for type Array: SkipAndStream and SkipAndBatch
    validator: (e: any) => boolean // will be used to validate the object or first element of the array to make sure it is the relevant array
    output: OutputMode
}
class ParserTransform<T> extends Transform {
    private shouldEnd = false;
    private optionsManager: JsonStreamOptionsManager<T>;
    private bufferManager: JsonStreamBufferManager<T>;
    private elementManager: JsonStreamElementManager<T>;
    constructor(options: IParserTransformOptions<T>[]) {
        super({readableObjectMode: true, writableObjectMode: false, decodeStrings: false, allowHalfOpen: false});
        this.optionsManager = new JsonStreamOptionsManager<T>(options);
        this.bufferManager = new JsonStreamBufferManager<T>(this.optionsManager);
        this.setListeners();
    }

    private setListeners() {
        this.bufferManager.on('ready', (elementBuffer) => {
            if(!this.elementManager) {
                this.elementManager = new JsonStreamElementManager<T>(this.optionsManager.getAttributeInProgress());
                this.elementManager.on('data', (data) => {
                    this.customEmit(this.optionsManager.getAttributeInProgress().attributeName, data);
                });
                this.elementManager.on('done', () => {
                    this.bufferManager.stop();
                });
            }
           this.elementManager.processNewElement(elementBuffer);
        });
        this.bufferManager.on('done', () => {
            this.processEnd();
        });
    }

    _transform(chunk: string, encoding: string, callback: Function) {
        if (this.shouldEnd) {
            return this._flush(callback);
        }
        if (!chunk) {
            this.bufferManager.processChunk()
            console.warn('found end of stream');
            return this._flush(callback);
        }

        this.bufferManager.addChunkToBuffer(chunk);

        while(!this.bufferManager.fetchNextBuffer()) {
            if(this.shouldEnd) {
                return this._flush(callback);
            }
            if(!this.optionsManager.isAttributeInProgress()) {
                this.bufferManager.detectRelevantObject();
            } else {
                this.bufferManager.processChunk()
            }
        }
        callback();
    }

    private customEmit(attribute: keyof T, data: any) {
        this.emit(<string>attribute, data);
    }

    _flush(callback) {
        this.push(null);
        this.emit('done');
        callback()
    }

    processEnd(): void {
        this.optionsManager.setCurrentAttributeProcessed();
        this.shouldEnd = this.optionsManager.getAttributesToProcess().length === 0;
    }
}