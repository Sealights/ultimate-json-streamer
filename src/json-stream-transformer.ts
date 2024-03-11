import { Transform } from "stream";
import { JsonStreamOptionsManager } from "./json-stream-options-manager";
import { JsonStreamBufferManager } from "./json-stream-buffer-manager";
import { JsonStreamElementManager } from "./json-stream-element-manager";
import { appendLog } from "./utils";

export class JSONStreamTransformer {
  public static createTransformStream<T>(
    options: IParserTransformOptions<T>[],
    closeOnDone = false,
    logger?: ILogger,
  ) {
    return new ParserTransform<T>(options, closeOnDone, logger || console);
  }
}
export enum ParserValueType {
  Array = "Array",
  Object = "Object",
}
export enum ParserMode {
  SingleObject = "SingleObject",
  BatchAndProcess = "BatchAndProcess",
  SkipAndStream = "SkipAndStream",
  SkipAndBatch = "SkipAndBatch",
}

export enum OutputMode {
  JSON = "JSON",
  STRING = "STRING",
}

export interface IDataEmit {
  attributeName: string;
  data: any;
  amount?: number;
  startIdx?: number;
  endIdx?: number;
}
export interface ILogger {
  debug(message: string, additionalData?: any);
  info(message: string, additionalData?: any);
  warn(message: string, additionalData?: any);
  error(message: string, additionalData?: any);
}

export interface IParserTransformOptions<T> {
  attributeName: keyof T;
  type: ParserValueType;
  mode?: ParserMode;
  batchSize?: number; // relevant for type Array: BatchAndProcess and SkipAndBatch and SkipAndStream
  skip?: number; //  relevant for type Array: SkipAndStream and SkipAndBatch
  validator?: Function;
  output: OutputMode;
}
class ParserTransform<T> extends Transform {
  private shouldEnd = false;
  private calledDone = false;
  private optionsManager: JsonStreamOptionsManager<T>;
  private bufferManager: JsonStreamBufferManager<T>;
  private elementManager: JsonStreamElementManager<T>;

  constructor(
    options: IParserTransformOptions<T>[],
    private readonly closeOnDone = false,
    private logger: ILogger,
  ) {
    super({
      readableObjectMode: true,
      writableObjectMode: false,
      decodeStrings: false,
      allowHalfOpen: false,
    });
    this.optionsManager = new JsonStreamOptionsManager<T>(options);
    this.bufferManager = new JsonStreamBufferManager<T>(
      this.optionsManager,
      logger,
    );
    this.setListeners();
  }

  private setListeners() {
    this.bufferManager.on("ready", (elementBuffer) => {
      if (!this.elementManager) {
        this.elementManager = new JsonStreamElementManager<T>(
          this.optionsManager.getAttributeInProgress(),
          this.logger,
        );
        this.elementManager.on("data", (data: IDataEmit) => {
          this.customEmit(
            this.optionsManager.getAttributeInProgress().attributeName,
            data,
          );
        });
        this.elementManager.on("done", () => {
          this.bufferManager.stop();
          this.elementManager = null;
        });
        this.elementManager.on("error", (err: NodeJS.ErrnoException) => {
          this.emit("error", err);
          this.shouldEnd = true;
          this.calledDone = true;
        });
      }
      this.elementManager.processNewElement(elementBuffer);
    });
    this.bufferManager.on("done", () => {
      if (this.elementManager) {
        this.elementManager.handleEnd();
      }
      this.processEnd();
      if (this.shouldEnd && !this.calledDone) {
        this.done();
      }
    });
  }

  _transform(chunk: string, encoding: string, callback: Function) {
    if (this.calledDone) {
      if (!chunk) {
        return this._flush(callback);
      }
      return callback();
    }
    if (this.shouldEnd && !this.calledDone) {
      this.done();
      return callback();
    }
    if (!chunk) {
      this.bufferManager.processChunk();
      this.logger.warn(appendLog("found end of stream"));
      return this._flush(callback);
    }

    this.bufferManager.addChunkToBuffer(chunk);

    while (!this.bufferManager.fetchNextBuffer()) {
      if (this.shouldEnd) {
        return callback();
      }
      if (!this.optionsManager.isAttributeInProgress()) {
        this.bufferManager.detectRelevantObject();
      } else {
        this.bufferManager.processChunk();
      }
    }
    callback();
  }

  private customEmit(attribute: keyof T, data: IDataEmit) {
    this.emit("data", <IDataEmit>{
      attributeName: attribute,
      ...data,
    });
  }

  private done() {
    this.emit("done");
    this.calledDone = true;
    if (this.closeOnDone) {
      this.push(null);
      this.emit("close");
    }
  }

  _flush(callback) {
    if (!this.calledDone) {
      this.done();
    }
    callback();
  }

  private processEnd(): void {
    this.optionsManager.setCurrentAttributeProcessed();
    this.shouldEnd = this.optionsManager.getAttributesToProcess().length === 0;
  }
}
