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
exports.JsonStreamElementManager = void 0;
var json_stream_transformer_1 = require("./json-stream-transformer");
var events_1 = require("events");
var JsonStreamElementManager = /** @class */ (function (_super) {
    __extends(JsonStreamElementManager, _super);
    function JsonStreamElementManager(attributeOptionsManager) {
        var _this = _super.call(this) || this;
        _this.attributeOptionsManager = attributeOptionsManager;
        _this.elementCount = 0;
        _this.relevantElementCount = 0;
        _this.elementsArray = [];
        return _this;
    }
    JsonStreamElementManager.prototype.processNewElement = function (buffer) {
        if (this.elementCount === 0) {
            console.info('validating first element');
            var validate = this.attributeOptionsManager.validateObject(buffer);
            if (!validate) {
                console.warn('first element did not pass validation, resetting entry point logic...');
                throw new Error('failed to validate first object');
            }
        }
        this.elementCount++;
        var mode = this.attributeOptionsManager.getAttributeInProgress('mode');
        var batchSize = this.attributeOptionsManager.getAttributeInProgress('batchSize');
        var skip = this.attributeOptionsManager.getAttributeInProgress('skip');
        var outputMode = this.attributeOptionsManager.getAttributeInProgress('output');
        switch (mode) {
            case json_stream_transformer_1.ParserMode.BatchAndProcess:
                this.relevantElementCount++;
                this.elementsArray.push(buffer);
                if (batchSize === this.relevantElementCount) {
                    this.emit('data', JSON.parse("[" + this.elementsArray.join(',') + "]"));
                    this.relevantElementCount = 0;
                    this.elementsArray = [];
                    var output = "[" + this.elementsArray.join(',') + "]";
                    if (outputMode === json_stream_transformer_1.OutputMode.JSON) {
                        output = JSON.parse(output);
                    }
                    this.emit('data', output);
                }
                break;
            case json_stream_transformer_1.ParserMode.SkipAndBatch:
                if (this.elementCount > skip) {
                    this.relevantElementCount++;
                    this.elementsArray.push(buffer);
                    if (batchSize === this.relevantElementCount) {
                        this.emit('data', JSON.parse("[" + this.elementsArray.join(',') + "]"));
                        return true;
                    }
                }
                break;
            case json_stream_transformer_1.ParserMode.SkipAndStream:
                if (this.elementCount > skip) {
                    this.relevantElementCount++;
                    this.emit('data', JSON.parse(buffer));
                    if (batchSize === this.relevantElementCount) {
                        return true;
                    }
                }
                break;
        }
        this.logProgress();
        return false;
    };
    JsonStreamElementManager.prototype.logProgress = function () {
        if (this.elementCount === 1) {
            console.info('Found first element');
        }
        if (this.relevantElementCount === 1) {
            console.info('Found first relevant element');
        }
        if (this.relevantElementCount > 0 && this.relevantElementCount % 1000 === 0) {
            console.info("Relevant Element number " + this.elementCount, {
                memoryUsage: formatBytes(process.memoryUsage().rss), cpuUsage: process.cpuUsage()
            });
        }
        else if (this.elementCount % 1000 === 0) {
            console.info("Element number " + this.elementCount, {
                memoryUsage: formatBytes(process.memoryUsage().rss), cpuUsage: process.cpuUsage()
            });
        }
        function formatBytes(bytes, decimals) {
            if (decimals === void 0) { decimals = 2; }
            if (bytes === 0)
                return '0 Bytes';
            var k = 1024;
            var dm = decimals < 0 ? 0 : decimals;
            var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
            var i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        }
    };
    return JsonStreamElementManager;
}(events_1.EventEmitter));
exports.JsonStreamElementManager = JsonStreamElementManager;
