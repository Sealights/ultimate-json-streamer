"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputMode = exports.ParserMode = exports.ParserValueType = exports.JSONStreamTransformer = void 0;
var fs = require('fs');
var process = require('process');
var stream_1 = require("stream");
var json_stream_options_manager_1 = require("./json-stream-options-manager");
var json_stream_buffer_manager_1 = require("./json-stream-buffer-manager");
var JSONStreamTransformer = /** @class */ (function () {
    function JSONStreamTransformer() {
    }
    JSONStreamTransformer.createTransformStream = function (options) {
        return new ParserTransform(options);
    };
    return JSONStreamTransformer;
}());
exports.JSONStreamTransformer = JSONStreamTransformer;
var ParserValueType;
(function (ParserValueType) {
    ParserValueType["Array"] = "Array";
    ParserValueType["Object"] = "Object";
})(ParserValueType = exports.ParserValueType || (exports.ParserValueType = {}));
var ParserMode;
(function (ParserMode) {
    ParserMode["SingleObject"] = "SingleObject";
    ParserMode["DiscoverArrayLength"] = "DiscoverArrayLength";
    ParserMode["BatchAndProcess"] = "BatchAndProcess";
    ParserMode["SkipAndStream"] = "SkipAndStream";
    ParserMode["SkipAndBatch"] = "SkipAndBatch";
})(ParserMode = exports.ParserMode || (exports.ParserMode = {}));
var OutputMode;
(function (OutputMode) {
    OutputMode["JSON"] = "JSON";
    OutputMode["STRING"] = "STRING";
})(OutputMode = exports.OutputMode || (exports.OutputMode = {}));
var ParserTransform = /** @class */ (function (_super) {
    __extends(ParserTransform, _super);
    function ParserTransform(options) {
        var _this = _super.call(this, { readableObjectMode: true, writableObjectMode: false, decodeStrings: false, allowHalfOpen: false }) || this;
        _this.detectionBuffer = '';
        _this.buffer = '';
        _this.detectedStartingPoint = false;
        _this.bracketNum = 0;
        _this.elementBuffer = '';
        _this.elementsArray = [];
        _this.elementCount = 0;
        _this.relevantElementCount = 0;
        _this.lastCharEscaped = false;
        _this.openQuote = false;
        _this.continueOnPsik = false;
        _this.shouldEnd = false;
        _this.optionsManager = new json_stream_options_manager_1.JsonStreamOptionsManager(options);
        _this.bufferManager = new json_stream_buffer_manager_1.JsonStreamBufferManager();
        return _this;
    }
    ParserTransform.prototype._transform = function (chunk, encoding, callback) {
        if (this.shouldEnd) {
            return this._flush(callback);
        }
        if (!chunk) {
            this.processChunkElement();
            console.warn('found end of stream');
            return this._flush(callback);
        }
        this.bufferManager.addChunkToBuffer(chunk);
        while (!this.bufferManager.fetchNextBuffer()) {
            if (this.optionsManager.isAttributeInProgress()) {
                this.bufferManager.detectRelevantObject();
            }
            else {
                this.bufferManager.processChunk();
            }
        }
        callback();
    };
    /**
     * Due to the fact any attribute could be split between 2 buffers, we must keep more 2 buffers for detecting the attribute
     * @private
     */
    ParserTransform.prototype.locateStartIndex = function () {
        this.detectionBuffer = (this.detectionBuffer.length > this.buffer.length * 2 ? this.detectionBuffer.substring(this.buffer.length) : '') + this.buffer;
        var nextAttribute = this.findClosestAttribute();
        if (nextAttribute) {
            console.info("detected start of relevant key " + nextAttribute);
            var attributeLength = nextAttribute.attribute.length;
            var offset = this.options.find(function (o) { return o.attributeName === nextAttribute.attribute; }).type === ParserValueType.Array ? ParserTransform.ADD_REQUIRED_CHARS_TO_START_ARR_INDEX : ParserTransform.ADD_REQUIRED_CHARS_TO_START_OBJ_INDEX;
            this.buffer = this.buffer.substring(nextAttribute.value + attributeLength + offset);
            this.detectedStartingPoint = true;
            this.workingOnAttribute = nextAttribute.attribute;
            return true;
        }
        return false;
    };
    ParserTransform.prototype.findClosestAttribute = function () {
        var attribute;
        var value;
        var _loop_1 = function (attr) {
            var char = this_1.options.find(function (o) { return o.attributeName === attr; }).type === ParserValueType.Array ? '[' : '{';
            var index = this_1.detectionBuffer.indexOf("\"" + attr + "\":" + char);
            if (index !== -1 && (!value || index < value)) {
                attribute = attr;
                value = index;
            }
        };
        var this_1 = this;
        for (var _i = 0, _a = this.attributesToProcess; _i < _a.length; _i++) {
            var attr = _a[_i];
            _loop_1(attr);
        }
        if (!value)
            return null;
        return { value: value, attribute: attribute };
    };
    ParserTransform.prototype.process = function () {
        this.bufferManager.processChunk();
    };
    ParserTransform.prototype.processChunkElement = function () {
        var _this = this;
        var regex = new RegExp(ParserTransform.DETECTION_REGEX);
        var match;
        var lastIndex = 0;
        while ((match = regex.exec(this.buffer)) !== null) {
            if (this.continueOnPsik) {
                if (match[0] === ']') {
                    this.processEndStream();
                    break;
                }
                this.continueOnPsik = false;
                lastIndex = match.index + 1;
                continue;
            }
            this.processSingleChar(match[0]);
            this.addToElementBuffer(lastIndex, match.index + 1);
            if (this.bracketNum === 0) {
                var processType = this.options.find(function (o) { return o.attributeName === _this.workingOnAttribute; }).type;
                if (processType === ParserValueType.Array) {
                    var arrayFulfilled = this.processNewElement();
                    this.logProgress();
                    if (arrayFulfilled) {
                        this.processAttributeCompleted(lastIndex);
                        break;
                    }
                    this.elementBuffer = '';
                    this.continueOnPsik = true;
                }
                else {
                    this.processCompletedObject();
                    this.processAttributeCompleted(lastIndex);
                    break;
                }
            }
            lastIndex = match.index + 1;
        }
        if (this.buffer.length > lastIndex) {
            this.elementBuffer += this.buffer.substring(lastIndex);
        }
    };
    ParserTransform.prototype.processAttributeCompleted = function (lastIndex) {
        var _this = this;
        this.attributesProcessed.push(this.workingOnAttribute);
        this.attributesToProcess.filter(function (a) { return a !== _this.workingOnAttribute; });
        this.workingOnAttribute = null;
        this.elementCount = 0;
        this.elementBuffer = '';
        this.elementsArray = [];
        this.buffer = this.buffer.substring(lastIndex + 1);
        if (this.options.every(function (o) { return _this.attributesProcessed.includes(o.attributeName); })) {
            this.processEndStream();
        }
    };
    ParserTransform.prototype.addToElementBuffer = function (start, end) {
        this.elementBuffer += this.buffer.substring(start, end);
    };
    ParserTransform.prototype.customEmit = function (data) {
        this.emit(this.workingOnAttribute, data);
    };
    ParserTransform.prototype.validateObject = function () {
        var _this = this;
        try {
            var element = JSON.parse(this.elementBuffer);
            return this.options.find(function (o) { return o.attributeName === _this.workingOnAttribute; }).validator(element) ? element : null;
        }
        catch (e) {
            console.warn('first element failed JSON.parse');
            return null;
        }
    };
    ParserTransform.prototype.processCompletedObject = function () {
        var validatedObject = this.validateObject();
        if (!validatedObject) {
            console.warn('first element did not pass validation, resetting entry point logic...');
            this.detectedStartingPoint = false;
            // reset
        }
        this.emit(this.workingOnAttribute, validatedObject);
    };
    ParserTransform.prototype.processNewElement = function () {
        var _this = this;
        if (this.elementCount === 0) {
            console.info('validating first element');
            var validate = this.validateObject();
            if (!validate) {
                console.warn('first element did not pass validation, resetting entry point logic...');
                this.detectedStartingPoint = false;
                return false;
            }
        }
        this.elementCount++;
        var options = this.options.find(function (o) { return o.attributeName === _this.workingOnAttribute; });
        switch (options.mode) {
            case ParserMode.BatchAndProcess:
                this.relevantElementCount++;
                this.elementsArray.push(this.elementBuffer);
                if (options.batchSize === this.relevantElementCount) {
                    this.customEmit(JSON.parse("[" + this.elementsArray.join(',') + "]"));
                    this.relevantElementCount = 0;
                    this.elementsArray = [];
                }
                break;
            case ParserMode.SkipAndBatch:
                if (this.elementCount > options.skip) {
                    this.relevantElementCount++;
                    this.elementsArray.push(this.elementBuffer);
                    if (options.batchSize === this.relevantElementCount) {
                        this.customEmit(JSON.parse("[" + this.elementsArray.join(',') + "]"));
                        return true;
                    }
                }
                break;
            case ParserMode.SkipAndStream:
                if (this.elementCount > options.skip) {
                    this.relevantElementCount++;
                    this.customEmit(JSON.parse(this.elementBuffer));
                    if (options.batchSize === this.relevantElementCount) {
                        return true;
                    }
                }
                break;
        }
        return false;
    };
    ParserTransform.prototype._flush = function (callback) {
        this.push(null);
        this.emit('done');
        callback();
    };
    ParserTransform.prototype.processEndStream = function () {
        if (this.options.mode === ParserMode.DiscoverArrayLength) {
            this.push(this.elementCount);
        }
        else if (this.options.mode === ParserMode.BatchAndProcess) {
            this.push(JSON.parse("[" + this.elementsArray.join(',') + "]"));
        }
        console.info('calling end!');
        this.shouldEnd = true;
    };
    ParserTransform.prototype.processSingleChar = function (char) {
        if (char === '\\') {
            this.lastCharEscaped = true;
            return;
        }
        if (!this.lastCharEscaped && char === '"') {
            this.openQuote = !this.openQuote;
            return;
        }
        if (this.shouldIncludeBracket() && (char === '{' || char === '[')) {
            this.bracketNum++;
        }
        else if (this.shouldIncludeBracket() && (char === '}' || char === ']')) {
            this.bracketNum--;
        }
        this.lastCharEscaped = false;
    };
    ParserTransform.prototype.shouldIncludeBracket = function () {
        return !this.openQuote && !this.lastCharEscaped;
    };
    ParserTransform.ADD_REQUIRED_CHARS_TO_START_ARR_INDEX = 4; // "attr":[
    ParserTransform.ADD_REQUIRED_CHARS_TO_START_OBJ_INDEX = 3; // "attr":
    ParserTransform.DETECTION_REGEX = /[{}\[\],"\\]/g;
    return ParserTransform;
}(stream_1.Transform));
