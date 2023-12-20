"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonStreamOptionsManager = void 0;
var json_stream_transformer_1 = require("./json-stream-transformer");
var JsonStreamOptionsManager = /** @class */ (function () {
    function JsonStreamOptionsManager(options) {
        this.options = options;
        this.attributeProcessed = [];
    }
    JsonStreamOptionsManager.prototype.getAttributesToProcess = function () {
        var _this = this;
        return this.options.filter(function (o) { return !_this.attributeProcessed.includes(o.attributeName); }).map(function (o) { return o.attributeName; });
    };
    JsonStreamOptionsManager.prototype.getAttributeInProgress = function (option) {
        var _this = this;
        return this.options.find(function (o) { return o.attributeName === _this.currentAttribute; })[option];
    };
    JsonStreamOptionsManager.prototype.isAttributeInProgress = function () {
        return !!this.currentAttribute;
    };
    JsonStreamOptionsManager.prototype.getProcessType = function (attributeName) {
        return this.options.find(function (o) { return o.attributeName === attributeName; }).type;
    };
    JsonStreamOptionsManager.prototype.getMode = function (attributeName) {
        return this.options.find(function (o) { return o.attributeName === attributeName; }).mode;
    };
    JsonStreamOptionsManager.prototype.setAttributeProcessed = function (attributeName) {
        this.attributeProcessed.push(attributeName);
    };
    JsonStreamOptionsManager.prototype.setAttributeInProgress = function (attributeName) {
        this.currentAttribute = attributeName;
    };
    JsonStreamOptionsManager.prototype.validateObject = function (buffer) {
        var _this = this;
        try {
            var element = JSON.parse(buffer);
            return this.options.find(function (o) { return o.attributeName === _this.currentAttribute; }).validator(element) ? element : null;
        }
        catch (e) {
            console.warn('first element failed JSON.parse');
            return null;
        }
    };
    JsonStreamOptionsManager.prototype.getAttributeRegex = function (attributeName) {
        var char = this.options.find(function (o) { return o.attributeName === attributeName; }).type === json_stream_transformer_1.ParserValueType.Array ? '[' : '{';
        return "\"" + attributeName + "\":" + char;
    };
    return JsonStreamOptionsManager;
}());
exports.JsonStreamOptionsManager = JsonStreamOptionsManager;
