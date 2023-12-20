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
exports.JsonStreamBufferManager = exports.ProcessStatus = void 0;
var json_stream_transformer_1 = require("./json-stream-transformer");
var events_1 = require("events");
var ProcessStatus;
(function (ProcessStatus) {
    ProcessStatus["Proceed"] = "Proceed";
    ProcessStatus["ElementReady"] = "ElementReady";
    ProcessStatus["DoneWithAttribute"] = "DoneWithAttribute";
    ProcessStatus["Error"] = "Error";
})(ProcessStatus = exports.ProcessStatus || (exports.ProcessStatus = {}));
var JsonStreamBufferManager = /** @class */ (function (_super) {
    __extends(JsonStreamBufferManager, _super);
    function JsonStreamBufferManager(options) {
        var _this = _super.call(this) || this;
        _this.options = options;
        _this.buffer = '';
        _this.detectionBuffer = '';
        _this.lastCharEscaped = false;
        _this.openQuote = false;
        _this.continueOnPsik = false;
        _this.elementBuffer = '';
        _this.bracketNum = 0;
        _this.detectionBrackets = 0;
        return _this;
    }
    JsonStreamBufferManager.prototype.addChunkToBuffer = function (chunk) {
        this.buffer += chunk.toString();
    };
    JsonStreamBufferManager.prototype.fetchNextBuffer = function () {
        return this.buffer.length === 0;
    };
    JsonStreamBufferManager.prototype.processSingleChar = function (char) {
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
    JsonStreamBufferManager.prototype.shouldIncludeBracket = function () {
        return !this.openQuote && !this.lastCharEscaped;
    };
    JsonStreamBufferManager.prototype.processChunk = function () {
        var regex = new RegExp("" + JsonStreamBufferManager.DETECTION_REGEX, 'g');
        var processType = this.options.getAttributeInProgress('type');
        var lastIndex = 0;
        var match;
        while ((match = regex.exec(this.buffer)) !== null) {
            if (this.continueOnPsik) {
                if (match[0] === ']') {
                    this.emit('done');
                }
                this.continueOnPsik = false;
                lastIndex = match.index + 1;
                continue;
            }
            this.processSingleChar(match[0]);
            if (this.bracketNum === 0) {
                this.emit('ready', this.elementBuffer);
                if (processType === json_stream_transformer_1.ParserValueType.Array) {
                    this.elementBuffer = '';
                    this.continueOnPsik = true;
                }
                else {
                    this.emit('done');
                    this.elementBuffer = '';
                    break;
                }
            }
            lastIndex = match.index + 1;
        }
        if (this.buffer.length > lastIndex) {
            this.elementBuffer += this.buffer.substring(lastIndex);
        }
    };
    JsonStreamBufferManager.prototype.findClosestAttribute = function () {
        var regexExp = "" + JsonStreamBufferManager.DETECTION_REGEX;
        var attributeRegexMap = new Map();
        for (var _i = 0, _a = this.options.getAttributesToProcess(); _i < _a.length; _i++) {
            var attr = _a[_i];
            regexExp = regexExp.concat("|" + this.options.getAttributeRegex(attr));
            attributeRegexMap.set(this.options.getAttributeRegex(attr), attr);
        }
        var regex = new RegExp(regexExp, 'g');
        var match;
        while ((match = regex.exec(this.detectionBuffer)) !== null) {
            if (attributeRegexMap.has(match[0])) {
                if (this.bracketNum === 0) {
                    console.log('found');
                    return { value: match.index, attribute: attributeRegexMap.get(match[0]) };
                }
                // handle attribute see if brackets match
            }
            else {
                this.processSingleChar(match[0]);
            }
        }
    };
    JsonStreamBufferManager.prototype.detectRelevantObject = function () {
        this.detectionBuffer = (this.detectionBuffer.length > this.buffer.length * 2 ? this.detectionBuffer.substring(this.buffer.length) : '') + this.buffer;
        var nextAttribute = this.findClosestAttribute();
        if (nextAttribute) {
            this.options.setAttributeInProgress(nextAttribute.attribute);
            console.info("detected start of relevant key " + nextAttribute);
            var attributeLength = nextAttribute.attribute.length;
            var offset = this.options.getAttributeInProgress('type') === json_stream_transformer_1.ParserValueType.Array ? JsonStreamBufferManager.ADD_REQUIRED_CHARS_TO_START_ARR_INDEX : JsonStreamBufferManager.ADD_REQUIRED_CHARS_TO_START_OBJ_INDEX;
            this.buffer = this.buffer.substring(nextAttribute.value + attributeLength + offset);
        }
    };
    JsonStreamBufferManager.prototype.addToElementBuffer = function (start, end) {
        this.elementBuffer += this.buffer.substring(start, end);
    };
    JsonStreamBufferManager.DETECTION_REGEX = '[{}\[\],"\\]';
    JsonStreamBufferManager.ADD_REQUIRED_CHARS_TO_START_ARR_INDEX = 4; // "attr":[
    JsonStreamBufferManager.ADD_REQUIRED_CHARS_TO_START_OBJ_INDEX = 3; // "attr":
    return JsonStreamBufferManager;
}(events_1.EventEmitter));
exports.JsonStreamBufferManager = JsonStreamBufferManager;
